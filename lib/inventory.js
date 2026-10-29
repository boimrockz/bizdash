'use strict';

const U = require('./util');

function list(db, ids) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT m.*, c.name company_name,
      (m.stock <= m.min_stock) low,
      (m.stock * m.cost) value
    FROM materials m LEFT JOIN companies c ON c.id = m.company_id
    WHERE m.company_id IN (${ph}) ORDER BY c.name, m.category, m.name`).all(...ids);
}

function summary(db, ids) {
  if (!ids.length) return { value: 0, count: 0, low: [] };
  const rows = list(db, ids);
  return {
    value: rows.reduce((a, r) => a + (r.value || 0), 0),
    count: rows.length,
    low: rows.filter((r) => r.low),
  };
}

function moves(db, ids, limit = 40) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT mv.*, m.name material_name, m.unit, c.name company_name, u.name user_name
    FROM material_moves mv LEFT JOIN materials m ON m.id = mv.material_id
    LEFT JOIN companies c ON c.id = mv.company_id LEFT JOIN users u ON u.id = mv.user_id
    WHERE mv.company_id IN (${ph}) ORDER BY mv.occurred_at DESC, mv.id DESC LIMIT ?`).all(...ids, limit);
}

function stockIn(db, opts) {
  const { companyId, materialId, qty, unitCost, note, userId, occurredAt } = opts;
  const material = db.prepare('SELECT * FROM materials WHERE id = ? AND company_id = ?').get(materialId, companyId);
  if (!material) return null;
  const at = occurredAt || U.localNow();
  return db.transaction(() => {
    const newCost = Number(unitCost) > 0 ? Number(unitCost) : material.cost;
    db.prepare('UPDATE materials SET stock = stock + ?, cost = ? WHERE id = ?').run(qty, newCost, material.id);
    db.prepare(`INSERT INTO material_moves (company_id, material_id, type, qty, unit_cost, note, ref_type, occurred_at, user_id, created_at)
      VALUES (?,?,'in',?,?,?,'manual',?,?,?)`)
      .run(companyId, material.id, qty, newCost, note || 'Penerimaan bahan', at, userId || null, U.nowISO());
    return { material, qty, cost: newCost };
  })();
}

function adjustStock(db, opts) {
  const { companyId, materialId, stock, minStock, cost, note, userId } = opts;
  const material = db.prepare('SELECT * FROM materials WHERE id = ? AND company_id = ?').get(materialId, companyId);
  if (!material) return null;
  const diff = Number(stock) - material.stock;
  return db.transaction(() => {
    db.prepare('UPDATE materials SET stock = ?, min_stock = ?, cost = ? WHERE id = ?')
      .run(Number(stock), Number(minStock) >= 0 ? Number(minStock) : material.min_stock,
        Number(cost) >= 0 ? Number(cost) : material.cost, material.id);
    db.prepare(`INSERT INTO material_moves (company_id, material_id, type, qty, unit_cost, note, ref_type, occurred_at, user_id, created_at)
      VALUES (?,?,'adjust',?,?,?,'manual',?,?,?)`)
      .run(companyId, material.id, diff, material.cost, note || 'Penyesuaian stok', U.localNow(), userId || null, U.nowISO());
    return { material, diff };
  })();
}

function createMaterial(db, opts) {
  const { companyId, name, category, unit, cost, stock, minStock } = opts;
  const id = db.prepare(`INSERT INTO materials (company_id, name, category, unit, cost, stock, min_stock, active, created_at)
    VALUES (?,?,?,?,?,?,?,1,?)`)
    .run(companyId, name, category || 'other', unit || 'kg', Number(cost) || 0, Number(stock) || 0, Number(minStock) || 0, U.nowISO())
    .lastInsertRowid;
  db.prepare(`INSERT INTO material_moves (company_id, material_id, type, qty, unit_cost, note, ref_type, occurred_at, user_id, created_at)
    VALUES (?,?,'in',?,?,?,'initial',?,?,?)`)
    .run(companyId, id, Number(stock) || 0, Number(cost) || 0, 'Stok awal', U.localNow(), null, U.nowISO());
  return id;
}

// Kurangi stok bahan sesuai resep saat penjualan terjadi.
function consumeForSale(db, companyId, lines, saleId, userId, occurredAt) {
  if (!lines.length) return;
  const findMaterial = db.prepare('SELECT * FROM materials WHERE company_id = ? AND name = ? LIMIT 1');
  const upd = db.prepare('UPDATE materials SET stock = stock - ? WHERE id = ?');
  const ins = db.prepare(`INSERT INTO material_moves (company_id, material_id, type, qty, unit_cost, note, ref_type, ref_id, occurred_at, user_id, created_at)
    VALUES (?,?,'out',?,?,?,'sale',?,?,?,?)`);
  const recipes = db.prepare('SELECT material_name, qty FROM product_recipes WHERE product_id = ?');
  const at = occurredAt || U.localNow();
  for (const line of lines) {
    if (!line.productId) continue;
    for (const r of recipes.all(line.productId)) {
      const material = findMaterial.get(companyId, r.material_name);
      if (!material) continue;
      const used = (Number(r.qty) || 0) * (Number(line.qty) || 0);
      if (used <= 0) continue;
      upd.run(used, material.id);
      ins.run(companyId, material.id, used, material.cost, `Pemakaian ${line.name}`, saleId, at, userId || null, U.nowISO());
    }
  }
}

function recipeRows(db, productId) {
  return db.prepare(`SELECT r.*,
      (SELECT m.cost FROM materials m WHERE m.company_id = (SELECT company_id FROM products WHERE id = r.product_id) AND m.name = r.material_name LIMIT 1) cost,
      (SELECT m.unit FROM materials m WHERE m.company_id = (SELECT company_id FROM products WHERE id = r.product_id) AND m.name = r.material_name LIMIT 1) material_unit
    FROM product_recipes r WHERE r.product_id = ? ORDER BY r.id`).all(productId);
}

function saveRecipe(db, productId, rows) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return null;
  return db.transaction(() => {
    db.prepare('DELETE FROM product_recipes WHERE product_id = ?').run(productId);
    let cost = 0;
    for (const row of rows) {
      const name = String(row.material_name || '').trim();
      const qty = Number(row.qty) || 0;
      if (!name || qty <= 0) continue;
      const material = db.prepare('SELECT * FROM materials WHERE company_id = ? AND name = ? LIMIT 1').get(product.company_id, name);
      db.prepare('INSERT INTO product_recipes (product_id, material_name, qty, unit) VALUES (?,?,?,?)')
        .run(productId, name, qty, material ? material.unit : (row.unit || 'kg'));
      cost += (material ? material.cost : 0) * qty;
    }
    db.prepare('UPDATE products SET cost = ? WHERE id = ?').run(Math.round(cost), productId);
    return { cost: Math.round(cost) };
  })();
}

module.exports = { list, summary, moves, stockIn, adjustStock, createMaterial, consumeForSale, recipeRows, saveRecipe };
