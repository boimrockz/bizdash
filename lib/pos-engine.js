'use strict';

// Mesin harga POS: resep → HPP, tier harga B2B, promo/voucher, dan poin member.
// Semua perhitungan uang ada di sini supaya UI, checkout, dan laporan memakai satu rumus.

const POINT_EARN_PER = 10000; // 1 poin per Rp 10.000 belanja bersih
const POINT_VALUE = 100; // 1 poin = Rp 100 saat ditukar

function money(n) {
  return Math.round(Number(n) || 0);
}

function tierPrice(product, customer, overrideMap) {
  if (customer && overrideMap && overrideMap.has(customer.id + ':' + product.id)) {
    return overrideMap.get(customer.id + ':' + product.id);
  }
  if (customer && customer.type === 'b2b') {
    if (customer.price_tier === 'distributor' && product.price_distributor > 0) return product.price_distributor;
    if (customer.price_tier === 'grosir' && product.price_grosir > 0) return product.price_grosir;
  }
  return product.price;
}

function recipeCost(db, product) {
  const rows = db.prepare(`SELECT r.material_name, r.qty, r.unit,
      (SELECT cost FROM materials m WHERE m.company_id = ? AND m.name = r.material_name LIMIT 1) cost,
      (SELECT stock FROM materials m WHERE m.company_id = ? AND m.name = r.material_name LIMIT 1) stock
    FROM product_recipes r WHERE r.product_id = ? ORDER BY r.id`).all(product.company_id, product.company_id, product.id);
  let total = 0;
  const detail = rows.map((r) => {
    const subtotal = (Number(r.cost) || 0) * (Number(r.qty) || 0);
    total += subtotal;
    return { ...r, subtotal, missing: r.cost === null };
  });
  return { total: money(total), rows: detail };
}

function loadOverrides(db, customerId) {
  const map = new Map();
  if (!customerId) return map;
  for (const row of db.prepare('SELECT customer_id, product_id, price FROM customer_prices WHERE customer_id = ?').all(customerId)) {
    map.set(row.customer_id + ':' + row.product_id, row.price);
  }
  return map;
}

function ancestorsOf(db, companyId) {
  const out = [];
  let cur = db.prepare('SELECT id, parent_id FROM companies WHERE id = ?').get(companyId);
  let guard = 0;
  while (cur && guard++ < 10) {
    out.push(cur.id);
    cur = cur.parent_id ? db.prepare('SELECT id, parent_id FROM companies WHERE id = ?').get(cur.parent_id) : null;
  }
  return out;
}

function activePromos(db, companyId, atDate) {
  const ids = ancestorsOf(db, companyId);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const date = String(atDate || '').slice(0, 10);
  return db.prepare(`SELECT * FROM promos WHERE active = 1 AND company_id IN (${ph})
      AND (start_date IS NULL OR start_date = '' OR start_date <= ?)
      AND (end_date IS NULL OR end_date = '' OR end_date >= ?)
      AND (usage_limit = 0 OR used_count < usage_limit)
    ORDER BY id`).all(...ids, date, date);
}

function promoEligibility(promo, ctx) {
  const { subtotal, customer, lines } = ctx;
  if (promo.min_spend > 0 && subtotal < promo.min_spend) {
    return { ok: false, reason: `Minimal belanja Rp ${Number(promo.min_spend).toLocaleString('id-ID')}` };
  }
  if (promo.member_only && !customer) return { ok: false, reason: 'Khusus member/pelanggan terdaftar' };
  if (promo.customer_type === 'b2c' && (!customer || customer.type !== 'b2c')) {
    return { ok: false, reason: 'Khusus pelanggan B2C' };
  }
  if (promo.customer_type === 'b2b' && (!customer || customer.type !== 'b2b')) {
    return { ok: false, reason: 'Khusus pelanggan B2B' };
  }
  if (promo.kind === 'bundle') {
    let items = [];
    try { items = JSON.parse(promo.bundle_items || '[]'); } catch (err) { items = []; }
    if (!items.length) return { ok: false, reason: 'Paket belum dikonfigurasi' };
    for (const item of items) {
      const line = lines.find((l) => l.productId === item.product_id);
      if (!line || line.qty < item.qty) return { ok: false, reason: 'Item paket belum lengkap di keranjang' };
    }
  }
  if (promo.kind === 'bogo') {
    const buy = lines.find((l) => l.productId === promo.buy_product_id);
    if (!buy) return { ok: false, reason: 'Item pembelian belum ada di keranjang' };
    if (promo.buy_qty > 0 && buy.qty < promo.buy_qty) return { ok: false, reason: `Butuh minimal ${promo.buy_qty} item` };
    if (promo.get_product_id && promo.get_product_id !== promo.buy_product_id) {
      const get = lines.find((l) => l.productId === promo.get_product_id);
      if (!get) return { ok: false, reason: 'Item bonus belum ada di keranjang' };
    }
  }
  return { ok: true };
}

function promoDiscount(promo, ctx) {
  const { subtotal, lines } = ctx;
  switch (promo.kind) {
    case 'percent': {
      let d = Math.round((subtotal * (Number(promo.value) || 0)) / 100);
      if (promo.max_discount > 0) d = Math.min(d, promo.max_discount);
      if (promo.customer_type === 'b2b' || promo.customer_type === 'b2c') {
        // diskon hanya untuk baris yang relevan (semua baris di sini pelanggan yang sama)
      }
      return Math.min(d, subtotal);
    }
    case 'amount':
      return Math.min(Number(promo.value) || 0, subtotal);
    case 'bogo': {
      const buy = lines.find((l) => l.productId === promo.buy_product_id);
      if (!buy) return 0;
      const bundles = Math.floor(buy.qty / Math.max(1, promo.buy_qty || 1));
      const freeQty = bundles * (Number(promo.get_qty) || 1);
      if (!freeQty) return 0;
      if (promo.get_product_id === promo.buy_product_id) {
        return Math.min(subtotal, freeQty * buy.price);
      }
      const get = lines.find((l) => l.productId === promo.get_product_id);
      if (!get) return 0;
      return Math.min(subtotal, Math.min(freeQty, get.qty) * get.price);
    }
    case 'bundle': {
      let items = [];
      try { items = JSON.parse(promo.bundle_items || '[]'); } catch (err) { items = []; }
      let count = Infinity;
      let normal = 0;
      for (const item of items) {
        const line = lines.find((l) => l.productId === item.product_id);
        if (!line) return 0;
        count = Math.min(count, Math.floor(line.qty / Math.max(1, item.qty || 1)));
        normal += line.price * item.qty;
      }
      if (!Number.isFinite(count) || count < 1) return 0;
      const diff = normal - (Number(promo.bundle_price) || 0);
      return diff > 0 ? Math.min(subtotal, diff * count) : 0;
    }
    default:
      return 0;
  }
}

/**
 * Hitung keranjang lengkap.
 * opts: { companyId, items: [{id, qty}], customerId, code, points, atDate }
 */
function quote(db, opts) {
  const { companyId, items = [], customerId = null, code = '', atDate = null } = opts;
  const customer = customerId
    ? db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId)
    : null;
  const overrides = loadOverrides(db, customer ? customer.id : null);
  const products = new Map();
  for (const item of items) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.id);
    if (p) products.set(p.id, p);
  }

  const lines = [];
  for (const item of items) {
    const p = products.get(Number(item.id));
    if (!p) continue;
    const qty = Math.max(1, Math.min(999, Number(item.qty) || 1));
    const price = tierPrice(p, customer, overrides);
    const cost = p.cost || 0;
    lines.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      kind: p.kind,
      qty,
      price,
      listPrice: p.price,
      cost,
      lineTotal: money(price * qty),
      margin: price > 0 ? ((price - cost) / price) * 100 : 0,
    });
  }

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const cogs = lines.reduce((a, l) => a + l.cost * l.qty, 0);
  const promos = activePromos(db, companyId, atDate);
  const ctxPromo = { subtotal, customer, lines };

  const evaluated = promos.map((promo) => {
    const eligibility = promoEligibility(promo, ctxPromo);
    const discount = eligibility.ok ? promoDiscount(promo, ctxPromo) : 0;
    return { promo, eligibility, discount };
  });

  let chosen = null;
  const codeNorm = String(code || '').trim().toUpperCase();
  if (codeNorm) {
    const found = evaluated.find((e) => (e.promo.code || '').toUpperCase() === codeNorm);
    if (!found) {
      chosen = { error: `Kode promo "${codeNorm}" tidak dikenal atau sudah berakhir.` };
    } else if (!found.eligibility.ok) {
      chosen = { error: `${found.promo.name}: ${found.eligibility.reason}.` };
    } else if (found.discount <= 0) {
      chosen = { error: `Promo ${found.promo.name} belum menghasilkan potongan untuk keranjang ini.` };
    } else {
      chosen = found;
    }
  } else {
    const auto = evaluated
      .filter((e) => e.eligibility.ok && !(e.promo.code || '').trim() && e.discount > 0)
      .sort((a, b) => b.discount - a.discount);
    chosen = auto[0] || null;
  }

  const promoInfo = chosen && !chosen.error
    ? {
      id: chosen.promo.id,
      name: chosen.promo.name,
      code: chosen.promo.code,
      kind: chosen.promo.kind,
      discount: money(chosen.discount),
      label: chosen.promo.code ? `${chosen.promo.name} (${chosen.promo.code})` : chosen.promo.name,
    }
    : null;

  const promoDiscountValue = promoInfo ? Math.min(promoInfo.discount, subtotal) : 0;
  const afterPromo = Math.max(0, subtotal - promoDiscountValue);

  const pointBalance = customer ? customer.points : 0;
  const maxPointsByAmount = Math.floor(afterPromo / POINT_VALUE);
  const maxPoints = Math.min(pointBalance, maxPointsByAmount);
  let pointsUsed = Math.max(0, Math.floor(Number(opts.points) || 0));
  if (!customer) pointsUsed = 0;
  pointsUsed = Math.min(pointsUsed, maxPoints);
  const pointsValue = money(pointsUsed * POINT_VALUE);

  const total = Math.max(0, afterPromo - pointsValue);
  const pointsEarned = customer ? Math.floor(total / POINT_EARN_PER) : 0;

  const available = evaluated
    .filter((e) => e.eligibility.ok && e.discount > 0)
    .map((e) => ({
      id: e.promo.id,
      name: e.promo.name,
      code: e.promo.code,
      kind: e.promo.kind,
      discount: e.discount,
      auto: !(e.promo.code || '').trim(),
      memberOnly: !!e.promo.member_only,
    }))
    .sort((a, b) => b.discount - a.discount);

  return {
    companyId,
    customer: customer
      ? { id: customer.id, name: customer.name, type: customer.type, tier: customer.price_tier, points: customer.points, company_name: customer.company_name }
      : null,
    lines,
    subtotal: money(subtotal),
    cogs: money(cogs),
    promo: promoInfo,
    promoError: chosen && chosen.error ? chosen.error : '',
    promoDiscount: money(promoDiscountValue),
    pointsUsed,
    pointsValue,
    pointBalance,
    maxPoints,
    pointsEarned,
    total: money(total),
    grossMargin: subtotal ? ((subtotal - cogs) / subtotal) * 100 : 0,
    available,
    channel: customer ? customer.type : 'walkin',
    priceTier: customer ? customer.price_tier : 'retail',
  };
}

/**
 * Keterangan promo untuk ditampilkan di layar kasir (bukan untuk perhitungan).
 * Menghasilkan label yang bisa dibaca kasir: jenis, nilai, syarat, masa berlaku,
 * sisa kuota, cakupan entitas, produk yang terlibat, dan apakah butuh kode.
 */
const PROMO_KIND_LABEL = {
  percent: 'Diskon persen',
  amount: 'Potongan nominal',
  bogo: 'Beli X gratis Y',
  bundle: 'Paket bundling',
};

const CUSTOMER_TYPE_LABEL = { all: 'Semua pelanggan', b2c: 'Pelanggan B2C', b2b: 'Pelanggan B2B' };

function promoValueText(promo) {
  switch (promo.kind) {
    case 'percent':
      return `${Number(promo.value).toLocaleString('id-ID')}%${promo.max_discount > 0
        ? ` (maks Rp ${Number(promo.max_discount).toLocaleString('id-ID')})` : ''}`;
    case 'amount':
      return `Rp ${Number(promo.value).toLocaleString('id-ID')}`;
    case 'bogo':
      return `beli ${Number(promo.buy_qty) || 1} gratis ${Number(promo.get_qty) || 1}`;
    case 'bundle':
      return `harga paket Rp ${Number(promo.bundle_price).toLocaleString('id-ID')}`;
    default:
      return '';
  }
}

function describePromos(db, promos, opts = {}) {
  const { outletId = null, products = [], atDate = null } = opts;
  const productName = new Map(products.map((p) => [p.id, p.name]));
  let companyName = () => '';
  try {
    const companies = db.prepare('SELECT id, name FROM companies').all();
    const map = new Map(companies.map((c) => [c.id, c.name]));
    companyName = (id) => map.get(id) || '';
  } catch (err) { companyName = () => ''; }
  const today = String(atDate || new Date().toISOString().slice(0, 10)).slice(0, 10);

  return promos.map((promo) => {
    let items = [];
    if (promo.kind === 'bundle') {
      try { items = JSON.parse(promo.bundle_items || '[]'); } catch (err) { items = []; }
    }
    const itemNames = items.map((i) => {
      const name = productName.get(i.product_id) || `#${i.product_id}`;
      return `${Math.max(1, Number(i.qty) || 1)}× ${name}`;
    });
    if (promo.kind === 'bogo') {
      const buy = productName.get(promo.buy_product_id) || `#${promo.buy_product_id || '?'}`;
      const get = productName.get(promo.get_product_id) || buy;
      itemNames.push(`${buy} → ${get}`);
    }

    const remaining = Number(promo.usage_limit) > 0
      ? Math.max(0, Number(promo.usage_limit) - Number(promo.used_count || 0))
      : null;
    const endIn = promo.end_date
      ? Math.round((new Date(`${promo.end_date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
      : null;

    return {
      ...promo,
      kindLabel: PROMO_KIND_LABEL[promo.kind] || promo.kind,
      valueText: promoValueText(promo),
      needsCode: !!promo.code,
      codeLabel: promo.code || 'Otomatis',
      minSpend: Number(promo.min_spend) || 0,
      memberOnly: !!promo.member_only,
      customerType: ['b2c', 'b2b'].includes(promo.customer_type) ? promo.customer_type : 'all',
      customerTypeLabel: CUSTOMER_TYPE_LABEL[promo.customer_type] || 'Semua pelanggan',
      items: itemNames,
      periodLabel: promo.start_date || promo.end_date
        ? `${promo.start_date || 'sekarang'} → ${promo.end_date || 'seterusnya'}`
        : 'Tanpa batas tanggal',
      endsIn: endIn,
      endingSoon: endIn !== null && endIn >= 0 && endIn <= 3,
      remaining,
      lowQuota: remaining !== null && remaining <= 5,
      companyLabel: companyName(promo.company_id),
      fromParent: !!(outletId && Number(promo.company_id) !== Number(outletId)),
    };
  });
}

module.exports = {
  POINT_EARN_PER, POINT_VALUE, quote, tierPrice, recipeCost, activePromos,
  promoEligibility, promoDiscount, loadOverrides, ancestorsOf, money,
  describePromos, promoValueText, PROMO_KIND_LABEL, CUSTOMER_TYPE_LABEL,
};
