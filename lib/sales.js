'use strict';

const U = require('./util');
const inventory = require('./inventory');
const posOptions = require('./pos-options');

function nextInvoiceNo(db, dateStr) {
  const month = String(dateStr || '').slice(0, 7).replace(/-/g, '');
  const stem = `INV-${month}-`;
  const last = db.prepare('SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1').get(stem + '%');
  let seq = 1;
  if (last) {
    const parsed = Number(String(last.invoice_no).slice(stem.length));
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return stem + String(seq).padStart(5, '0');
}

/**
 * Simpan hasil quote() menjadi transaksi: sales, sale_items, pemakaian bahan,
 * poin member, dan counter promo.
 */
function persistSale(db, q, meta) {
  const {
    companyId, userId = null, paymentMethod = 'cash', source = 'pos', note = null,
    soldAt = null, invoiceNo = null, allowPointsTopup = true,
  } = meta;
  const at = soldAt || U.localNow();
  return db.transaction(() => {
    const invoice = invoiceNo || nextInvoiceNo(db, at);
    const discountTotal = q.promoDiscount + q.pointsValue;
    const saleId = db.prepare(`INSERT INTO sales
      (company_id, user_id, customer_id, channel, price_tier, invoice_no, sold_at, subtotal, discount,
       promo_id, promo_label, promo_discount, points_used, points_value, points_earned, total, cogs,
       payment_method, status, source, note, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'paid',?,?,?)`)
      .run(companyId, userId, q.customer ? q.customer.id : null, q.channel, q.priceTier, invoice, at,
        q.subtotal, discountTotal, q.promo ? q.promo.id : null, q.promo ? q.promo.label : null,
        q.promoDiscount, q.pointsUsed, q.pointsValue, q.pointsEarned, q.total, q.cogs,
        paymentMethod, source, note, at).lastInsertRowid;

    const insItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost, line_total) VALUES (?,?,?,?,?,?,?)');
    for (const line of q.lines) {
      insItem.run(saleId, line.productId, line.name, line.qty, line.price, line.cost, line.lineTotal);
    }

    inventory.consumeForSale(db, companyId, q.lines, saleId, userId, at);

    // stok produk jadi (mis. biji kopi kemasan) hanya dikurangi untuk jenis menu yang
    // ditandai "lacak stok" di Settings → Master Data POS
    const stocked = new Set(posOptions.stockedKinds(db));
    const decProduct = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ? AND stock > 0');
    for (const line of q.lines) {
      if (stocked.has(line.kind)) decProduct.run(line.qty, line.productId);
    }

    if (q.customer) {
      const ledger = db.prepare('INSERT INTO points_ledger (customer_id, sale_id, type, points, note, created_at) VALUES (?,?,?,?,?,?)');
      if (q.pointsEarned > 0) ledger.run(q.customer.id, saleId, 'earn', q.pointsEarned, `Belanja ${invoice}`, at);
      if (q.pointsUsed > 0) ledger.run(q.customer.id, saleId, 'redeem', -q.pointsUsed, `Tukar poin ${invoice}`, at);
      const delta = q.pointsEarned - q.pointsUsed;
      if (delta !== 0) db.prepare('UPDATE customers SET points = MAX(0, points + ?) WHERE id = ?').run(delta, q.customer.id);
    }

    if (q.promo && q.promo.id && q.promoDiscount > 0) {
      db.prepare('UPDATE promos SET used_count = used_count + 1 WHERE id = ?').run(q.promo.id);
    }
    if (!allowPointsTopup) {
      // placeholder untuk aturan masa depan (mis. top-up poin manual)
    }

    return { id: saleId, invoiceNo: invoice, total: q.total, discount: discountTotal, pointsEarned: q.pointsEarned };
  })();
}

function voidSale(db, saleId, userId = null) {
  return db.transaction(() => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale || sale.status === 'void') return null;

    db.prepare("UPDATE sales SET status='void' WHERE id = ?").run(saleId);

    // kembalikan stok bahan yang terpakai
    const moves = db.prepare("SELECT * FROM material_moves WHERE ref_type='sale' AND ref_id = ? AND type='out'").all(saleId);
    const restore = db.prepare('UPDATE materials SET stock = stock + ? WHERE id = ?');
    const ins = db.prepare(`INSERT INTO material_moves (company_id, material_id, type, qty, unit_cost, note, ref_type, ref_id, occurred_at, user_id, created_at)
      VALUES (?,?,'in',?,?,?,'void',?,?,?,?)`);
    for (const mv of moves) {
      restore.run(mv.qty, mv.material_id);
      ins.run(mv.company_id, mv.material_id, mv.qty, mv.unit_cost, 'Pembatalan transaksi', saleId, U.localNow(), userId, U.nowISO());
    }

    // kembalikan stok produk jadi (hanya jenis menu yang dilacak stoknya)
    const items = db.prepare('SELECT product_id, qty FROM sale_items WHERE sale_id = ?').all(saleId);
    const stocked = posOptions.stockedKinds(db);
    const ph = stocked.map(() => '?').join(',');
    const restoreProduct = db.prepare(`UPDATE products SET stock = stock + ? WHERE id = ? AND kind IN (${ph})`);
    for (const it of items) if (it.product_id) restoreProduct.run(it.qty, it.product_id, ...stocked);

    // koreksi poin member
    if (sale.customer_id) {
      const delta = (sale.points_used || 0) - (sale.points_earned || 0);
      if (delta !== 0) db.prepare('UPDATE customers SET points = MAX(0, points + ?) WHERE id = ?').run(delta, sale.customer_id);
      db.prepare('INSERT INTO points_ledger (customer_id, sale_id, type, points, note, created_at) VALUES (?,?,?,?,?,?)')
        .run(sale.customer_id, saleId, 'adjust', delta, `Pembatalan ${sale.invoice_no}`, U.localNow());
    }
    if (sale.promo_id && sale.promo_discount > 0) {
      db.prepare('UPDATE promos SET used_count = MAX(0, used_count - 1) WHERE id = ?').run(sale.promo_id);
    }
    return sale;
  })();
}

module.exports = { createSale: persistSale, persistSale, voidSale, nextInvoiceNo };
