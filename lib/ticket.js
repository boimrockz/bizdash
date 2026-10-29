'use strict';

/**
 * Struk (receipt) untuk printer thermal.
 *
 * Satu sumber kebenaran: server menyusun MODEL struk dari transaksi (harga, promo,
 * poin, metode bayar, QRIS) lalu:
 *  - `textLines()` → pratinjau teks & fallback cetak biasa,
 *  - klien (`public/receipt.js`) mengubah model yang sama menjadi byte ESC/POS.
 * Lebar kertas 58mm = 32 karakter, 80mm = 48 karakter.
 */

const U = require('./util');
const settings = require('./settings');
const qris = require('./qris');
const posOptions = require('./pos-options');

const PAY_LABEL = { cash: 'Tunai', qris: 'QRIS', debit: 'Kartu debit/kredit', transfer: 'Transfer' };

function paperWidth(db) {
  const raw = String(settings.get(db, 'receipt_width', '58'));
  return raw === '80' ? { mm: 80, cols: 48, label: '80 mm' } : { mm: 58, cols: 32, label: '58 mm' };
}

function storeInfo(db, companyId) {
  const company = db.prepare('SELECT id, name, parent_id, level, address, phone FROM companies WHERE id = ?').get(Number(companyId));
  const parent = company && company.parent_id
    ? db.prepare('SELECT name, address, phone FROM companies WHERE id = ?').get(company.parent_id) : null;
  const brand = settings.get(db, 'brand_name', '') || (company ? company.name.replace(/^PT\.?\s+/i, '') : 'Ondeway');
  return {
    name: company ? company.name : brand,
    brand,
    address: (company && company.address) || (parent && parent.address) || '',
    phone: (company && company.phone) || (parent && parent.phone) || '',
    header: String(settings.get(db, 'receipt_header', '') || '').trim(),
  };
}

/** Model struk lengkap untuk satu transaksi. */
function build(db, saleId, opts = {}) {
  const sale = db.prepare(`SELECT s.*, c.name company, u.name cashier, cu.name customer, cu.phone customer_phone
    FROM sales s LEFT JOIN companies c ON c.id = s.company_id LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN customers cu ON cu.id = s.customer_id WHERE s.id = ?`).get(Number(saleId));
  if (!sale) return null;
  const items = db.prepare('SELECT name, qty, price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id').all(sale.id);
  const paper = paperWidth(db);
  const payment = db.prepare("SELECT * FROM payments WHERE sale_id = ? AND status = 'paid' ORDER BY id DESC LIMIT 1").get(sale.id)
    || db.prepare('SELECT * FROM payments WHERE invoice_no = ? ORDER BY id DESC LIMIT 1').get(sale.invoice_no);
  const store = storeInfo(db, sale.company_id);
  const footer = String(settings.get(db, 'receipt_footer', '') || 'Terima kasih telah ngopi di tempat kami').trim();

  return {
    version: 1,
    saleId: sale.id,
    paper: { mm: paper.mm, cols: paper.cols, label: paper.label },
    store,
    meta: {
      invoice: sale.invoice_no,
      datetime: sale.sold_at,
      date: U.dateLabel(sale.sold_at),
      time: U.timeLabel(sale.sold_at),
      cashier: sale.cashier || '—',
      outlet: sale.company || '',
      customer: sale.customer || '',
      customerPhone: sale.customer_phone || '',
      channel: sale.channel || 'walkin',
      note: sale.note || '',
      status: sale.status,
      source: sale.source,
    },
    items: items.map((i) => ({
      name: i.name,
      qty: Number(i.qty) || 0,
      price: Number(i.price) || 0,
      total: Number(i.line_total) || 0,
    })),
    totals: {
      subtotal: Number(sale.subtotal) || 0,
      discount: Number(sale.discount) || 0,
      promoDiscount: Number(sale.promo_discount) || 0,
      promoLabel: sale.promo_label || '',
      pointsUsed: Number(sale.points_used) || 0,
      pointsValue: Number(sale.points_value) || 0,
      pointsEarned: Number(sale.points_earned) || 0,
      total: Number(sale.total) || 0,
    },
    payment: {
      method: sale.payment_method,
      label: posOptions.label(db, 'payment_method', sale.payment_method, sale.payment_method),
      reference: payment ? payment.reference : '',
      status: payment ? qris.STATUS[payment.status] || payment.status : '',
      provider: payment ? payment.provider : '',
      paidAt: payment && payment.paid_at ? payment.paid_at : '',
    },
    qris: payment && payment.payload
      ? { reference: payment.reference, payload: payment.payload }
      : null,
    footer,
    printedAt: U.localNow(),
    reprint: !!opts.reprint,
    copyLabel: opts.copyLabel || '',
  };
}

// ---------------------------------------------------------------- teks

function rupiah(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

/** Bungkus teks ke lebar kolom tanpa memotong kata (kata sangat panjang dipotong). */
function wrap(text, cols) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line.length) {
      if (word.length <= cols) line = word;
      else {
        let rest = word;
        while (rest.length > cols) { lines.push(rest.slice(0, cols)); rest = rest.slice(cols); }
        line = rest;
      }
      continue;
    }
    if (line.length + 1 + word.length <= cols) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [''];
}

function padLine(left, right, cols) {
  const l = String(left);
  const r = String(right);
  const space = cols - l.length - r.length;
  if (space >= 1) return l + ' '.repeat(space) + r;
  // tidak muat: turunkan nilai ke baris berikutnya
  return l + '\n' + ' '.repeat(Math.max(0, cols - r.length)) + r;
}

function center(text, cols) {
  const t = String(text).slice(0, cols);
  const left = Math.floor((cols - t.length) / 2);
  return ' '.repeat(Math.max(0, left)) + t;
}

/** Pratinjau struk sebagai baris teks (dipakai UI & tes cetak). */
function textLines(ticket) {
  if (!ticket) return [];
  const cols = ticket.paper.cols;
  const out = [];
  const line = (ch = '-') => out.push(ch.repeat(cols));

  out.push(center(ticket.store.name.toUpperCase(), cols));
  if (ticket.store.address) wrap(ticket.store.address, cols).forEach((l) => out.push(center(l, cols)));
  if (ticket.store.phone) out.push(center('Telp ' + ticket.store.phone, cols));
  if (ticket.store.header) wrap(ticket.store.header, cols).forEach((l) => out.push(l));
  line();
  out.push(padLine('No', ticket.meta.invoice, cols));
  out.push(padLine('Tanggal', `${ticket.meta.date} ${ticket.meta.time}`, cols));
  out.push(padLine('Kasir', ticket.meta.cashier, cols));
  if (ticket.meta.outlet) out.push(padLine('Outlet', ticket.meta.outlet, cols));
  if (ticket.meta.customer) out.push(padLine('Pelanggan', ticket.meta.customer, cols));
  if (ticket.meta.note) wrap('Catatan: ' + ticket.meta.note, cols).forEach((l) => out.push(l));
  line();
  for (const item of ticket.items) {
    wrap(item.name, cols).forEach((l) => out.push(l));
    out.push(padLine(`${U.num(item.qty, item.qty % 1 === 0 ? 0 : 2)} x ${rupiah(item.price)}`, rupiah(item.total), cols));
  }
  line();
  out.push(padLine('Subtotal', rupiah(ticket.totals.subtotal), cols));
  if (ticket.totals.promoDiscount > 0) {
    out.push(padLine(`Promo${ticket.totals.promoLabel ? ' (' + ticket.totals.promoLabel + ')' : ''}`, '-' + rupiah(ticket.totals.promoDiscount), cols));
  }
  if (ticket.totals.pointsValue > 0) {
    out.push(padLine(`Poin ${U.num(ticket.totals.pointsUsed)}`, '-' + rupiah(ticket.totals.pointsValue), cols));
  }
  out.push(padLine('TOTAL', rupiah(ticket.totals.total), cols));
  out.push(padLine('Bayar', ticket.payment.label, cols));
  if (ticket.payment.reference) out.push(padLine('Ref QRIS', ticket.payment.reference, cols));
  if (ticket.payment.status) out.push(padLine('Status', ticket.payment.status, cols));
  if (ticket.totals.pointsEarned > 0) out.push(padLine('Poin didapat', `+${U.num(ticket.totals.pointsEarned)}`, cols));
  line();
  if (ticket.footer) wrap(ticket.footer, cols).forEach((l) => out.push(center(l, cols)));
  if (ticket.reprint) out.push(center('*** CETAK ULANG ***', cols));
  if (ticket.copyLabel) out.push(center(ticket.copyLabel, cols));
  out.push(center(ticket.store.brand ? `Powered by ${ticket.store.brand}` : '', cols).trimEnd());
  return out.filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
}

function text(ticket) {
  return textLines(ticket).join('\n');
}

module.exports = { build, textLines, text, wrap, padLine, center, rupiah, paperWidth, storeInfo, PAY_LABEL };
