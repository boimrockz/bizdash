'use strict';

/**
 * Master data POS yang bisa diatur sendiri oleh pemilik (Settings → Master Data POS).
 *
 * Semua daftar "pilihan" di POS tidak lagi ditulis mati di kode:
 *   - menu_type      → jenis menu (dipakai `products.kind`, mis. menu/bean di kode lama)
 *   - category       → kategori menu (nilai teks `products.category`)
 *   - payment_method → metode bayar (`sales.payment_method`)
 *   - price_tier     → tier harga pelanggan B2B (`customers.price_tier`, kode tetap)
 *   - channel        → kanal penjualan (`sales.channel`, kode tetap)
 *
 * Aturan penting:
 *   - Kode (`code`) adalah nilai yang DISIMPAN di transaksi/produk dan tidak boleh
 *     berubah sembarangan: tier & kanal dikunci penuh, `qris`/`cash` tidak bisa dihapus.
 *   - Baris bawaan bersifat `is_system = 1` → boleh diubah labelnya/nonaktif, tidak dihapus.
 *   - Baris nonaktif TETAP dipakai untuk menerjemahkan data lama (labelMap memuat semua baris),
 *     jadi struk/ekspor transaksi lama tidak pernah kehilangan nama metode bayar.
 *   - `company_id = 0` berarti berlaku untuk semua entitas (seed selalu global).
 */

const U = require('./util');

const GLOBAL = 0;

const KINDS = {
  menu_type: {
    label: 'Jenis menu',
    helper: 'Jenis menentukan perilaku produk. Jenis dengan "lacak stok" akan mengurangi stok produk jadi setiap penjualan (mis. biji kopi kemasan).',
    form: ['code', 'label', 'icon', 'tracks_stock', 'sort_order', 'active'],
    locked: false,
  },
  category: {
    label: 'Kategori menu',
    helper: 'Kategori dipakai untuk rail filter di layar kasir dan kolom kategori pada produk. Mengganti nama kategori otomatis memperbarui produk yang memakainya.',
    form: ['label', 'icon', 'sort_order', 'active'],
    locked: false,
  },
  payment_method: {
    label: 'Metode pembayaran',
    helper: 'Urutan di sini menentukan urutan tombol bayar di POS. QRIS dan Tunai adalah metode sistem (boleh diganti namanya, tidak bisa dihapus).',
    form: ['code', 'label', 'sort_order', 'active'],
    locked: false,
  },
  price_tier: {
    label: 'Tier harga pelanggan',
    helper: 'Kode tier terikat ke kolom harga produk (retail / grosir / distributor), jadi hanya namanya yang bisa diubah.',
    form: ['label'],
    locked: true,
  },
  channel: {
    label: 'Kanal penjualan',
    helper: 'Kanal dihitung otomatis dari jenis pelanggan (walk-in, member B2C, B2B). Hanya nama tampilannya yang bisa diubah.',
    form: ['label'],
    locked: true,
  },
};

const ICON_CHOICES = ['coffee', 'cart', 'box', 'gift', 'sprinkle', 'wallet', 'receipt', 'layers', 'idcard', 'sparkles', 'pin', 'truck', 'clock', 'trophy'];

const DEFAULTS = {
  menu_type: [
    { code: 'menu', label: 'Menu (minuman)', icon: 'coffee', tracks_stock: 0, sort_order: 1 },
    { code: 'food', label: 'Makanan & pastry', icon: 'layers', tracks_stock: 0, sort_order: 2 },
    { code: 'bean', label: 'Biji kopi & kemasan', icon: 'box', tracks_stock: 1, sort_order: 3 },
    { code: 'merch', label: 'Merchandise', icon: 'gift', tracks_stock: 0, sort_order: 4 },
  ],
  category: [
    { code: 'Kopi', label: 'Kopi', icon: 'coffee', sort_order: 1 },
    { code: 'Signature', label: 'Signature', icon: 'sparkles', sort_order: 2 },
    { code: 'Manual Brew', label: 'Manual Brew', icon: 'sprinkle', sort_order: 3 },
    { code: 'Non-Coffee', label: 'Non-Coffee', icon: 'cart', sort_order: 4 },
    { code: 'Makanan', label: 'Makanan', icon: 'layers', sort_order: 5 },
    { code: 'Biji Kopi', label: 'Biji Kopi', icon: 'box', sort_order: 6 },
    { code: 'Merchandise', label: 'Merchandise', icon: 'gift', sort_order: 7 },
  ],
  payment_method: [
    { code: 'qris', label: 'QRIS', sort_order: 1, system: 1 },
    { code: 'cash', label: 'Tunai', sort_order: 2, system: 1 },
    { code: 'debit', label: 'Kartu debit/kredit', sort_order: 3 },
    { code: 'transfer', label: 'Transfer bank', sort_order: 4 },
  ],
  price_tier: [
    { code: 'retail', label: 'Retail', sort_order: 1 },
    { code: 'grosir', label: 'Grosir (B2B)', sort_order: 2 },
    { code: 'distributor', label: 'Distributor (B2B)', sort_order: 3 },
  ],
  channel: [
    { code: 'walkin', label: 'Walk-in', sort_order: 1 },
    { code: 'b2c', label: 'Member B2C', sort_order: 2 },
    { code: 'b2b', label: 'B2B', sort_order: 3 },
  ],
};

/** Kode yang tidak boleh dihapus/dinonaktifkan karena dipakai modul lain. */
const LOCKED_CODES = {
  payment_method: ['qris', 'cash'],
};

function slug(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .toLowerCase()
    .slice(0, 40);
}

// ---------------------------------------------------------------- seed

function ensureSeed(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO pos_options
    (company_id, kind, code, label, icon, sort_order, active, is_system, tracks_stock, created_at)
    VALUES (?,?,?,?,?,?,1,?,?,?)`);
  const now = U.nowISO();
  for (const kind of Object.keys(DEFAULTS)) {
    for (const row of DEFAULTS[kind]) {
      insert.run(GLOBAL, kind, row.code, row.label, row.icon || null, row.sort_order || 0,
        row.system || row.code === 'qris' || row.code === 'cash' ? 1 : 0,
        row.tracks_stock ? 1 : 0, now);
    }
  }
  // Kategori/jenis yang sudah dipakai produk (mis. data lama "Pastry", "Non-Kopi") ikut
  // didaftarkan supaya bisa diubah nama/ikonnya di halaman pengaturan — bukan disembunyikan.
  const usedCats = db.prepare(`SELECT DISTINCT category c FROM products
    WHERE category IS NOT NULL AND TRIM(category) != ''`).all();
  let sort = 100;
  for (const row of usedCats) {
    insert.run(GLOBAL, 'category', String(row.c).trim(), String(row.c).trim(), null, sort++, 0, 0, now);
  }
  const usedKinds = db.prepare(`SELECT DISTINCT kind k FROM products WHERE kind IS NOT NULL AND TRIM(kind) != ''`).all();
  let kindSort = 100;
  for (const row of usedKinds) {
    const code = String(row.k).trim();
    insert.run(GLOBAL, 'menu_type', code, code, null, kindSort++, 1, code === 'bean' ? 1 : 0, now);
  }
}

// ---------------------------------------------------------------- baca

function rows(db, kind) {
  if (!KINDS[kind]) return [];
  return db.prepare(`SELECT * FROM pos_options WHERE kind = ? AND company_id = ?
    ORDER BY active DESC, sort_order, label`).all(kind, GLOBAL);
}

function activeRows(db, kind) {
  return rows(db, kind).filter((r) => r.active);
}

function activeCodes(db, kind) {
  return new Set(activeRows(db, kind).map((r) => r.code));
}

/** code → label, MEMUAT baris nonaktif supaya data lama tetap punya nama. */
function labelMap(db, kind) {
  const map = {};
  for (const row of rows(db, kind)) map[row.code] = row.label;
  // fallback ke bawaan bila tabel belum terisi (mis. DB sangat lama)
  for (const row of DEFAULTS[kind] || []) if (!map[row.code]) map[row.code] = row.label;
  return map;
}

function iconMap(db, kind) {
  const map = {};
  for (const row of rows(db, kind)) if (row.icon) map[row.code] = row.icon;
  for (const row of DEFAULTS[kind] || []) if (row.icon && !map[row.code]) map[row.code] = row.icon;
  return map;
}

function label(db, kind, code, fallback = '') {
  if (!code) return fallback || '—';
  return labelMap(db, kind)[code] || fallback || code;
}

function isActive(db, kind, code) {
  return !!db.prepare('SELECT 1 FROM pos_options WHERE kind = ? AND code = ? AND company_id = ? AND active = 1')
    .get(kind, String(code), GLOBAL);
}

/** Jenis menu yang mengurangi stok produk jadi (menggantikan cek `kind === 'bean'`). */
function stockedKinds(db) {
  const list = db.prepare("SELECT code FROM pos_options WHERE kind = 'menu_type' AND tracks_stock = 1")
    .all().map((r) => r.code);
  return list.length ? list : ['bean']; // fallback perilaku lama
}

/** Kategori untuk pemilih produk: gabungan opsi aktif + kategori yang sudah dipakai produk. */
function categoryChoices(db, usedCategories = []) {
  const opts = activeRows(db, 'category');
  // kategori yang sudah terdaftar (termasuk yang dinonaktifkan) tidak ditawarkan lagi;
  // "extra" hanya untuk kategori lama yang belum pernah masuk master data.
  const registered = new Set(rows(db, 'category').map((r) => r.code));
  const extra = [...new Set(usedCategories.filter(Boolean))].filter((c) => !registered.has(c)).sort();
  return {
    options: opts.map((r) => ({ value: r.code, label: r.label, icon: r.icon || '' })),
    extra: extra.map((c) => ({ value: c, label: c, icon: '' })),
  };
}

// ---------------------------------------------------------------- tulis

function usage(db, kind, code) {
  if (kind === 'menu_type') return db.prepare('SELECT COUNT(*) c FROM products WHERE kind = ?').get(code).c;
  if (kind === 'category') return db.prepare('SELECT COUNT(*) c FROM products WHERE category = ?').get(code).c;
  if (kind === 'payment_method') return db.prepare('SELECT COUNT(*) c FROM sales WHERE payment_method = ?').get(code).c;
  if (kind === 'price_tier') return db.prepare('SELECT COUNT(*) c FROM customers WHERE price_tier = ?').get(code).c;
  if (kind === 'channel') return db.prepare('SELECT COUNT(*) c FROM sales WHERE channel = ?').get(code).c;
  return 0;
}

/**
 * Simpan (tambah/ubah) satu baris master data.
 * @returns {{ok:boolean, id?:number, error?:string, renamed?:number}}
 */
function save(db, kind, input) {
  if (!KINDS[kind]) return { ok: false, error: 'Jenis master data tidak dikenal.' };
  const labelText = String(input.label || '').trim().slice(0, 60);
  if (!labelText) return { ok: false, error: 'Nama wajib diisi.' };
  const id = Number(input.id) || 0;
  const existing = id ? db.prepare('SELECT * FROM pos_options WHERE id = ? AND kind = ?').get(id, kind) : null;
  if (id && !existing) return { ok: false, error: 'Data tidak ditemukan.' };

  const icon = String(input.icon || '').trim();
  const sortOrder = Number(input.sort_order);
  const wantsActive = input.active === undefined || input.active === null ? true : !!Number(input.active);

  if (KINDS[kind].locked) {
    // tier & kanal: hanya nama (dan urutan) yang boleh berubah
    if (!existing) return { ok: false, error: `${KINDS[kind].label} bersifat sistem dan tidak bisa ditambah.` };
    db.prepare('UPDATE pos_options SET label = ?, sort_order = ? WHERE id = ?')
      .run(labelText, Number.isFinite(sortOrder) ? sortOrder : existing.sort_order, existing.id);
    return { ok: true, id: existing.id };
  }

  const lockedCodes = LOCKED_CODES[kind] || [];
  const isSystem = existing ? !!existing.is_system : (kind === 'payment_method' && ['qris', 'cash'].includes(slug(input.code || labelText)));
  if (existing && existing.is_system && (lockedCodes.includes(existing.code) || existing.code === 'qris' || existing.code === 'cash')) {
    if (!wantsActive) return { ok: false, error: `${existing.label} dipakai modul lain, tidak bisa dinonaktifkan.` };
  }

  // kode: kategori memakai label sebagai nilai tersimpan; lainnya memakai slug.
  let code = existing ? existing.code : '';
  if (kind === 'category') {
    code = labelText;
  } else {
    const raw = String(input.code || '').trim();
    code = slug(raw || labelText) || slug(existing ? existing.code : 'item');
  }
  if (!code) return { ok: false, error: 'Kode tidak valid.' };

  const duplicate = db.prepare('SELECT id FROM pos_options WHERE kind = ? AND company_id = ? AND code = ? AND id != ?')
    .get(kind, GLOBAL, code, existing ? existing.id : 0);
  if (duplicate) return { ok: false, error: `Kode/nama "${code}" sudah dipakai.` };

  const tracksStock = Number(input.tracks_stock) ? 1 : 0;
  const sort = Number.isFinite(sortOrder) ? sortOrder : (existing ? existing.sort_order : 50);

  if (existing) {
    const codeChanged = code !== existing.code;
    // Kategori memakai nama sebagai nilai tersimpan, jadi rename WAJIB boleh & ikut
    // memperbarui produk. Untuk jenis lain kode = kunci data historis → tidak boleh berubah.
    if (codeChanged && kind !== 'category' && usage(db, kind, existing.code) > 0) {
      return { ok: false, error: 'Kode sudah dipakai data transaksi/produk — ubah namanya saja, bukan kodenya.' };
    }
    db.prepare(`UPDATE pos_options SET code = ?, label = ?, icon = ?, sort_order = ?, active = ?, tracks_stock = ?
      WHERE id = ?`).run(code, labelText, icon || null, sort, wantsActive ? 1 : 0, tracksStock, existing.id);
    if (codeChanged && kind === 'category') {
      db.prepare('UPDATE products SET category = ? WHERE category = ?').run(code, existing.code);
    }
    return { ok: true, id: existing.id, renamed: codeChanged ? usage(db, kind, code) : 0 };
  }

  const info = db.prepare(`INSERT INTO pos_options
    (company_id, kind, code, label, icon, sort_order, active, is_system, tracks_stock, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(GLOBAL, kind, code, labelText, icon || null, sort, wantsActive ? 1 : 0, isSystem ? 1 : 0, tracksStock, U.nowISO());
  return { ok: true, id: info.lastInsertRowid };
}

function setActive(db, id, active) {
  const row = db.prepare('SELECT * FROM pos_options WHERE id = ?').get(Number(id));
  if (!row) return { ok: false, error: 'Data tidak ditemukan.' };
  if (KINDS[row.kind].locked) return { ok: false, error: `${KINDS[row.kind].label} bersifat sistem dan selalu aktif.` };
  if (!active && ['qris', 'cash'].includes(row.code) && row.kind === 'payment_method') {
    return { ok: false, error: `${row.label} dipakai modul QRIS/kasir, tidak bisa dinonaktifkan.` };
  }
  db.prepare('UPDATE pos_options SET active = ? WHERE id = ?').run(active ? 1 : 0, row.id);
  return { ok: true, row };
}

function remove(db, id) {
  const row = db.prepare('SELECT * FROM pos_options WHERE id = ?').get(Number(id));
  if (!row) return { ok: false, error: 'Data tidak ditemukan.' };
  if (KINDS[row.kind].locked) return { ok: false, error: `${KINDS[row.kind].label} bersifat sistem dan tidak bisa dihapus.` };
  if (row.is_system) return { ok: false, error: `${row.label} adalah data bawaan — nonaktifkan saja bila tidak dipakai.` };
  const used = usage(db, row.kind, row.code);
  if (used > 0) {
    return { ok: false, error: `${row.label} dipakai ${U.num(used)} data lain — nonaktifkan saja agar riwayat tetap utuh.` };
  }
  db.prepare('DELETE FROM pos_options WHERE id = ?').run(row.id);
  return { ok: true, row };
}

// ---------------------------------------------------------------- ringkasan untuk UI

function summary(db, kind) {
  const list = rows(db, kind);
  return list.map((r) => ({ ...r, used: usage(db, kind, r.code) }));
}

module.exports = {
  GLOBAL, KINDS, ICON_CHOICES, DEFAULTS, LOCKED_CODES,
  ensureSeed, rows, activeRows, activeCodes, labelMap, iconMap, label, isActive,
  stockedKinds, categoryChoices, usage, summary, save, setActive, remove, slug,
};
