'use strict';

const XLSX = require('xlsx');
const { persistSale, nextInvoiceNo } = require('./sales');
const { ancestors } = require('./auth');
const { POINT_EARN_PER } = require('./pos-engine');
const U = require('./util');

function normKey(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(row, aliases) {
  for (const key of Object.keys(row)) {
    if (aliases.includes(normKey(key))) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  return '';
}

function parseNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim();
  if (!s) return 0;
  let cleaned = s.replace(/[Rp$\s]/gi, '').replace(/%/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    cleaned = parts.length === 2 && parts[1].length <= 2 ? parts.join('.') : parts.join('');
  } else {
    cleaned = cleaned.replace(/\./g, '');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime());
  if (typeof v === 'number' && v > 20000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  const parsed = new Date(s);
  return isNaN(parsed) ? null : parsed;
}

function readRows(buffer, filename) {
  const isCsv = /\.csv$/i.test(filename || '');
  const wb = isCsv
    ? XLSX.read(buffer.toString('utf8'), { type: 'string', raw: false })
    : XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
}

const ALIASES = {
  date: ['tanggal', 'date', 'tgl', 'waktu', 'datetime', 'transactiondate', 'tanggaltransaksi'],
  outlet: ['outlet', 'toko', 'gerai', 'entitas', 'company', 'cabang', 'store', 'unit', 'lokasi'],
  sku: ['sku', 'kode', 'kodeproduk', 'productcode', 'kodesku', 'kodebarang'],
  product: ['produk', 'product', 'namaproduk', 'item', 'namaitem', 'nama', 'productname', 'menu'],
  qty: ['qty', 'quantity', 'jumlah', 'jumlahitem', 'qtyitem', 'kuantitas'],
  price: ['harga', 'price', 'hargajual', 'unitprice', 'priceperunit', 'hargasatuan'],
  total: ['total', 'totalpenjualan', 'amount', 'nilai', 'grandtotal', 'omzet', 'totalamount'],
  discount: ['diskon', 'discount', 'potongan', 'potonganharga'],
  payment: ['metode', 'metodepembayaran', 'payment', 'paymentmethod', 'bayar'],
  invoice: ['invoice', 'noinvoice', 'nonota', 'nomornota', 'nota', 'receipt', 'invoiceno'],
  cogs: ['hpp', 'cogs', 'hargapokok', 'cost', 'hargapokokpenjualan'],
  category: ['kategori', 'category', 'grup', 'group'],
  stock: ['stok', 'stock', 'qtyStok', 'stokakhir'],
  grosir: ['hargagrosir', 'grosir', 'pricegrosir', 'hargawholesale'],
  distributor: ['hargadistributor', 'distributor', 'pricedistributor'],
  customer: ['pelanggan', 'customer', 'member', 'namapelanggan', 'customername'],
  phone: ['hp', 'telepon', 'phone', 'nohp', 'whatsapp', 'wa'],
};

function findCompany(ctx, raw, codeRaw) {
  const q = normKey(raw);
  const qc = normKey(codeRaw);
  if (!q && !qc) return null;
  const candidates = ctx.companies.filter((c) => ctx.allowedIds.has(c.id));
  return candidates.find((c) => qc && normKey(c.code) === qc)
    || candidates.find((c) => q && normKey(c.name) === q)
    || candidates.find((c) => q && (normKey(c.name).includes(q) || q.includes(normKey(c.name))))
    || null;
}

function productsForOutlet(ctx, outletId) {
  const ids = ancestors(ctx.companies, outletId);
  const ph = ids.map(() => '?').join(',');
  return ctx.db.prepare(`SELECT * FROM products WHERE company_id IN (${ph}) AND active = 1`).all(...ids);
}

function findCustomer(ctx, nameRaw, phoneRaw, outletId) {
  const phone = String(phoneRaw || '').replace(/[^0-9]/g, '');
  const name = normKey(nameRaw);
  if (!phone && !name) return null;
  const ids = ancestors(ctx.companies, outletId);
  const ph = ids.map(() => '?').join(',');
  const rows = ctx.db.prepare(`SELECT * FROM customers WHERE active = 1 AND company_id IN (${ph})`).all(...ids);
  if (phone) {
    const byPhone = rows.find((c) => String(c.phone || '').replace(/[^0-9]/g, '') === phone);
    if (byPhone) return byPhone;
  }
  if (name) {
    return rows.find((c) => normKey(c.name) === name)
      || rows.find((c) => normKey(c.company_name) === name)
      || rows.find((c) => normKey(c.name).includes(name) || name.includes(normKey(c.name)))
      || null;
  }
  return null;
}

function tierPriceOf(product, customer) {
  if (customer && customer.type === 'b2b') {
    if (customer.price_tier === 'distributor' && product.price_distributor > 0) return product.price_distributor;
    if (customer.price_tier === 'grosir' && product.price_grosir > 0) return product.price_grosir;
  }
  return product.price;
}

function importSales(ctx, rows, mode) {
  const db = ctx.db;
  const errors = [];
  let created = 0;
  let skipped = 0;
  let rowCount = 0;
  const groups = new Map();

  rows.forEach((row, idx) => {
    rowCount++;
    const line = idx + 2;
    const date = parseDate(pick(row, ALIASES.date));
    const outlet = findCompany(ctx, pick(row, ALIASES.outlet), '');
    if (!date) { skipped++; if (errors.length < 12) errors.push(`Baris ${line}: tanggal tidak dikenali`); return; }
    if (!outlet) { skipped++; if (errors.length < 12) errors.push(`Baris ${line}: outlet "${pick(row, ALIASES.outlet) || '-'}" tidak ditemukan dalam cakupan Anda`); return; }
    if (outlet.level === 'holding') { skipped++; if (errors.length < 12) errors.push(`Baris ${line}: penjualan tidak boleh dicatat di level holding`); return; }

    const customer = findCustomer(ctx, pick(row, ALIASES.customer), pick(row, ALIASES.phone), outlet.id);
    const invoiceRaw = String(pick(row, ALIASES.invoice) || '').trim();
    const key = invoiceRaw ? 'inv:' + invoiceRaw : `${date.toISOString().slice(0, 10)}|${outlet.id}`;
    if (!groups.has(key)) {
      groups.set(key, { date, outlet, invoice: invoiceRaw || null, lines: [], discount: 0, payment: 'cash', customer });
    }
    const group = groups.get(key);
    if (customer) group.customer = customer;

    const discountVal = parseNumber(pick(row, ALIASES.discount));
    if (discountVal) group.discount += discountVal;

    if (mode === 'summary') {
      const total = parseNumber(pick(row, ALIASES.total));
      const hpp = parseNumber(pick(row, ALIASES.cogs));
      if (!total) { skipped++; if (errors.length < 12) errors.push(`Baris ${line}: kolom total kosong`); return; }
      group.lines.push({ productId: null, name: 'Rekap penjualan harian', kind: 'menu', qty: 1, price: total, cost: hpp, lineTotal: total });
    } else {
      const sku = String(pick(row, ALIASES.sku) || '').trim();
      const name = String(pick(row, ALIASES.product) || '').trim();
      const catalog = productsForOutlet(ctx, outlet.id);
      const product = catalog.find((p) => sku && normKey(p.sku) === normKey(sku))
        || catalog.find((p) => name && normKey(p.name) === normKey(name))
        || (sku || name ? catalog.find((p) => normKey(p.name).includes(normKey(name || sku))) : null);
      if (!product) {
        skipped++;
        if (errors.length < 12) errors.push(`Baris ${line}: produk "${sku || name || '-'}" tidak ditemukan untuk ${outlet.name}`);
        return;
      }
      const qty = parseNumber(pick(row, ALIASES.qty)) || 1;
      const priceOverride = parseNumber(pick(row, ALIASES.price));
      const price = priceOverride > 0 ? priceOverride : tierPriceOf(product, customer);
      group.lines.push({
        productId: product.id,
        name: product.name,
        kind: product.kind,
        qty,
        price,
        cost: product.cost,
        lineTotal: Math.round(price * qty),
      });
    }

    const payment = String(pick(row, ALIASES.payment) || '').toLowerCase();
    if (payment) {
      const map = { tunai: 'cash', cash: 'cash', qris: 'qris', qr: 'qris', debit: 'debit', kredit: 'debit', transfer: 'transfer', edc: 'debit' };
      group.payment = map[payment] || 'cash';
    }
  });

  for (const group of groups.values()) {
    if (!group.lines.length) continue;
    const soldAt = `${group.date.toISOString().slice(0, 10)} 12:00:00`;
    const invoice = group.invoice || nextInvoiceNo(db, soldAt);
    const exists = db.prepare('SELECT id FROM sales WHERE invoice_no = ?').get(invoice);
    if (exists) {
      skipped += group.lines.length;
      if (errors.length < 12) errors.push(`Invoice ${invoice} sudah ada — dilewati`);
      continue;
    }

    const subtotal = group.lines.reduce((a, l) => a + l.lineTotal, 0);
    const cogs = group.lines.reduce((a, l) => a + l.cost * l.qty, 0);
    const discount = Math.max(0, Math.min(group.discount, subtotal));
    const total = subtotal - discount;
    const customer = group.customer;
    const q = {
      companyId: group.outlet.id,
      customer: customer
        ? { id: customer.id, name: customer.name, type: customer.type, tier: customer.price_tier, points: customer.points, company_name: customer.company_name }
        : null,
      channel: customer ? customer.type : 'walkin',
      priceTier: customer ? customer.price_tier : 'retail',
      lines: group.lines,
      subtotal,
      cogs,
      promo: null,
      promoDiscount: 0,
      pointsUsed: 0,
      pointsValue: 0,
      pointsEarned: customer ? Math.floor(total / POINT_EARN_PER) : 0,
      total,
    };
    persistSale(db, q, {
      companyId: group.outlet.id,
      userId: ctx.user.id,
      soldAt,
      paymentMethod: group.payment,
      source: 'import',
      note: 'Import file',
      invoiceNo: invoice,
    });
    created++;
  }

  return { created, skipped, rowCount, errors };
}

function importProducts(ctx, rows, companyId) {
  const db = ctx.db;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const name = String(pick(row, ALIASES.product) || '').trim();
    const sku = String(pick(row, ALIASES.sku) || '').trim() || (name ? U.slug(name).toUpperCase() : '');
    if (!name || !sku) { skipped++; if (errors.length < 10) errors.push(`Baris ${line}: nama/SKU kosong`); return; }
    const price = parseNumber(pick(row, ALIASES.price));
    const grosir = parseNumber(pick(row, ALIASES.grosir));
    const distributor = parseNumber(pick(row, ALIASES.distributor));
    const stock = parseNumber(pick(row, ALIASES.stock));
    const category = String(pick(row, ALIASES.category) || '').trim();
    const existing = db.prepare('SELECT id FROM products WHERE company_id = ? AND lower(sku) = lower(?)').get(companyId, sku);
    if (existing) {
      db.prepare('UPDATE products SET name = ?, category = ?, price = ?, price_grosir = ?, price_distributor = ?, stock = ? WHERE id = ?')
        .run(name, category, price, grosir, distributor, stock, existing.id);
      updated++;
    } else {
      db.prepare(`INSERT INTO products (company_id, sku, name, category, kind, price, price_grosir, price_distributor, cost, stock, active, created_at)
        VALUES (?,?,?,?,?,?,?,?,0,?,1,?)`)
        .run(companyId, sku, name, category, /bean|biji/i.test(category) ? 'bean' : 'menu', price, grosir, distributor, stock, U.nowISO());
      created++;
    }
  });

  return { created, updated, skipped, errors };
}

const TEMPLATES = {
  sales: [
    ['tanggal', true, '2026-10-01'],
    ['outlet', true, 'Coffee Station 1.0'],
    ['sku', true, 'MN-03'],
    ['qty', true, '2'],
    ['pelanggan', false, 'nama member / nama perusahaan (opsional)'],
    ['hp', false, '08xxxxxxxxxx (opsional, untuk mencocokkan member)'],
    ['diskon', false, '5000'],
    ['harga', false, 'kosongkan untuk memakai harga tier pelanggan'],
    ['metode', false, 'qris'],
    ['invoice', false, 'INV-20261001-0001 (opsional, untuk menggabungkan baris)'],
  ],
  products: [
    ['sku', true, 'MN-12'],
    ['nama', true, 'Es Kopi Susu Pandan'],
    ['kategori', false, 'Kopi'],
    ['harga', true, '32000'],
    ['hargagrosir', false, '29000'],
    ['hargadistributor', false, '27500'],
    ['stok', false, '0'],
  ],
};

function templateCsv(type) {
  if (type === 'products') {
    return 'sku,nama,kategori,harga,hargagrosir,hargadistributor,stok\nMN-12,Es Kopi Susu Pandan,Kopi,32000,29000,27500,0\nBG-06,House Blend Roasted 1kg,Biji Kopi,285000,262000,248000,40\n';
  }
  return 'tanggal,outlet,sku,qty,pelanggan,hp,diskon,metode,invoice\n2026-10-01,Coffee Station 1.0,MN-03,2,Nadia Salsabila,081234567890,0,qris,INV-IMP-0001\n2026-10-01,Coffee Station 1.0,MN-02,1,,,0,cash,INV-IMP-0001\n2026-10-02,Ondeway Coffee Roaster,BG-01,3,PT Kopi Senja,,0,transfer,INV-IMP-0002\n';
}

module.exports = { readRows, importSales, importProducts, TEMPLATES, templateCsv, parseNumber, parseDate };
