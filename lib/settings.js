'use strict';

const U = require('./util');

const CACHE_TTL_MS = 5000;
let cache = { at: 0, map: new Map() };

function all(db, force = false) {
  if (!force && Date.now() - cache.at < CACHE_TTL_MS) return cache.map;
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  cache = { at: Date.now(), map };
  return map;
}

function get(db, key, fallback = '') {
  const map = all(db);
  const v = map.get(key);
  return v === undefined || v === null ? fallback : v;
}

function set(db, key, value) {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(key, value === null || value === undefined ? '' : String(value), U.nowISO());
  cache.at = 0;
}

function setMany(db, obj) {
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(obj)) set(db, k, v);
  });
  tx();
}

function mask(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 8) return '••••' + s.slice(-2);
  return s.slice(0, 4) + '••••••••' + s.slice(-4);
}

function flag(db, key) {
  return String(get(db, key, '0')) === '1';
}

/**
 * Nama brand yang dipakai di pesan ke pelanggan (struk WA, welcome member, balasan otomatis).
 * Prioritas: setting `brand_name` → nama holding (tanpa awalan "PT ") → 'Kopi Kami'.
 */
function brandName(db) {
  const explicit = get(db, 'brand_name', '').trim();
  if (explicit) return explicit;
  try {
    const holding = db.prepare(`SELECT name FROM companies
      ORDER BY CASE WHEN level = 'holding' THEN 0 ELSE 1 END, id LIMIT 1`).get();
    if (holding && holding.name) return holding.name.replace(/^PT\.?\s+/i, '');
  } catch (err) { /* tabel belum ada saat bootstrap awal */ }
  return 'Kopi Kami';
}

module.exports = { all, get, set, setMany, mask, flag, brandName, invalidate: () => { cache.at = 0; } };
