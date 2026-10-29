'use strict';

/**
 * Ekspor data ke Excel (.xlsx) / CSV.
 *
 * Aturan penting:
 * - Cakupan SELALU memakai `ids` yang sudah divalidasi pemanggil (ctx.scopeIds),
 *   jadi file tidak pernah memuat entitas di luar hak akses pengguna.
 * - Angka dikirim sebagai number (bukan string "Rp 32.000") supaya bisa langsung
 *   di-SUM/pivot di Excel; kolom mata uang memakai format number di sheet.
 * - Nama file selalu menyertakan periode + cakupan agar mudah diarsipkan akuntan.
 */

const XLSX = require('xlsx');
const U = require('./util');
const Q = require('./queries');
const statements = require('./statements');

const posOptions = require('./pos-options');
const TYPE_LABEL = { b2c: 'Member B2C', b2b: 'Pelanggan B2B' };
const ATT_STATUS = { present: 'Hadir', late: 'Terlambat', absent: 'Tidak hadir', leave: 'Izin/Cuti' };

const MAX_ITEM_ROWS = 60000; // pengaman ukuran file

function ph(n) {
  return new Array(n).fill('?').join(',');
}

function stamp() {
  return U.localNow().slice(0, 16).replace(':', '.');
}

function fileBase(kind, month, scopeLabel) {
  const scope = U.slug(String(scopeLabel || 'konsolidasi')).slice(0, 40) || 'konsolidasi';
  return `${kind}-${month}-${scope}`;
}

/** Konversi array-of-array (baris pertama = header) menjadi worksheet dengan lebar kolom wajar. */
function sheetFromRows(rows, opts = {}) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const header = rows[0] || [];
  ws['!cols'] = header.map((h, i) => {
    let width = String(h || '').length + 2;
    for (const row of rows.slice(1, 200)) {
      const v = row[i];
      const len = v instanceof Date ? 12 : String(v === undefined || v === null ? '' : v).length + 2;
      if (len > width) width = len;
    }
    return { wch: Math.min(Math.max(width, 9), opts.maxWidth || 42) };
  });
  if (rows.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: header.length - 1 } }) };
  return ws;
}

function workbookToBuffer(wb) {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
}

/** CSV dari satu set baris (array-of-array). Memakai BOM agar Excel membaca UTF-8 dengan benar. */
function rowsToCsv(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
  return '\uFEFF' + csv;
}

// ---------------------------------------------------------------- PENJUALAN
function salesData(db, opts) {
  const { ids, month, companyName } = opts;
  // label mengikuti Master Data POS (nama metode bayar / tier / kanal bisa diubah pemilik)
  const PAY_LABEL = posOptions.labelMap(db, 'payment_method');
  const CHANNEL_LABEL = posOptions.labelMap(db, 'channel');
  const TIER_LABEL = posOptions.labelMap(db, 'price_tier');
  const p = ph(ids.length);
  const sales = db.prepare(`SELECT s.*, c.name outlet, u.name cashier, cu.name customer, cu.type customer_type
    FROM sales s
    LEFT JOIN companies c ON c.id = s.company_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN customers cu ON cu.id = s.customer_id
    WHERE s.company_id IN (${p}) AND substr(s.sold_at,1,7) = ?
    ORDER BY s.sold_at, s.id`).all(...ids, month);

  const items = db.prepare(`SELECT si.sale_id, si.name, si.qty, si.price, si.cost, si.line_total,
      p.sku, s.invoice_no, s.sold_at, c.name outlet
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    LEFT JOIN companies c ON c.id = s.company_id
    WHERE s.company_id IN (${p}) AND substr(s.sold_at,1,7) = ?
    ORDER BY s.sold_at, si.sale_id, si.id
    LIMIT ${MAX_ITEM_ROWS}`).all(...ids, month);

  const paid = sales.filter((s) => s.status === 'paid');
  const revenue = paid.reduce((a, s) => a + s.total, 0);
  const cogs = paid.reduce((a, s) => a + s.cogs, 0);
  const promo = paid.reduce((a, s) => a + s.promo_discount, 0);
  const voided = sales.filter((s) => s.status === 'void');

  const overview = [
    ['Penjualan', 'BizDash Kopi'],
    ['Periode', U.monthLabel(month)],
    ['Cakupan', companyName],
    ['Dibuat', U.localNow()],
    [],
    ['Ringkasan', 'Nilai'],
    ['Jumlah nota (lunas)', paid.length],
    ['Omzet', revenue],
    ['HPP', cogs],
    ['Laba kotor', revenue - cogs],
    ['Margin kotor (%)', revenue ? Number(((revenue - cogs) / revenue * 100).toFixed(2)) : 0],
    ['Rata-rata per nota', paid.length ? Math.round(revenue / paid.length) : 0],
    ['Diskon promo', promo],
    ['Poin ditukar', paid.reduce((a, s) => a + (s.points_value || 0), 0)],
    ['Poin diperoleh', paid.reduce((a, s) => a + (s.points_earned || 0), 0)],
    ['Nota void', voided.length],
    ['Nilai void', voided.reduce((a, s) => a + s.total, 0)],
    ['Transaksi member', paid.filter((s) => s.customer_id).length],
    [],
    ['Per outlet', 'Nota', 'Omzet', 'HPP', 'Laba kotor'],
  ];
  const byOutlet = new Map();
  for (const s of paid) {
    const row = byOutlet.get(s.company_id) || { name: s.outlet, n: 0, revenue: 0, cogs: 0 };
    row.n += 1;
    row.revenue += s.total;
    row.cogs += s.cogs;
    byOutlet.set(s.company_id, row);
  }
  for (const row of [...byOutlet.values()].sort((a, b) => b.revenue - a.revenue)) {
    overview.push([row.name, row.n, row.revenue, row.cogs, row.revenue - row.cogs]);
  }
  overview.push([]);
  overview.push(['Per metode bayar', 'Nota', 'Omzet']);
  const byPay = new Map();
  for (const s of paid) {
    const key = s.payment_method || 'lain';
    const row = byPay.get(key) || { n: 0, revenue: 0 };
    row.n += 1;
    row.revenue += s.total;
    byPay.set(key, row);
  }
  for (const [key, row] of [...byPay.entries()].sort((a, b) => b[1].revenue - a[1].revenue)) {
    overview.push([PAY_LABEL[key] || key, row.n, row.revenue]);
  }

  const perDay = [['Tanggal', 'Nota', 'Omzet', 'HPP', 'Laba kotor', 'Transaksi member']];
  const byDay = new Map();
  for (const s of sales) {
    const day = s.sold_at.slice(0, 10);
    const row = byDay.get(day) || { n: 0, revenue: 0, cogs: 0, member: 0 };
    if (s.status === 'paid') {
      row.n += 1;
      row.revenue += s.total;
      row.cogs += s.cogs;
      if (s.customer_id) row.member += 1;
    }
    byDay.set(day, row);
  }
  for (const day of [...byDay.keys()].sort()) {
    const r = byDay.get(day);
    perDay.push([day, r.n, r.revenue, r.cogs, r.revenue - r.cogs, r.member]);
  }

  const txRows = [['Tanggal', 'Jam', 'Invoice', 'Outlet', 'Kasir', 'Pelanggan', 'Kanal', 'Tier harga',
    'Metode bayar', 'Subtotal', 'Diskon', 'Promo', 'Nilai poin', 'Total', 'HPP', 'Status', 'Sumber']];
  for (const s of sales) {
    txRows.push([
      s.sold_at.slice(0, 10), s.sold_at.slice(11, 16), s.invoice_no, s.outlet || '', s.cashier || '',
      s.customer || 'Walk-in', CHANNEL_LABEL[s.channel] || s.channel || '',
      TIER_LABEL[s.price_tier] || s.price_tier || '', PAY_LABEL[s.payment_method] || s.payment_method || '',
      s.subtotal, s.discount, s.promo_discount || 0, s.points_value || 0, s.total, s.cogs,
      s.status === 'void' ? 'Void' : 'Lunas', s.source === 'import' ? 'Import' : 'POS',
    ]);
  }

  const itemRows = [['Tanggal', 'Invoice', 'Outlet', 'SKU', 'Produk', 'Qty', 'Harga satuan', 'Subtotal', 'HPP satuan']];
  for (const it of items) {
    itemRows.push([it.sold_at.slice(0, 10), it.invoice_no, it.outlet || '', it.sku || '', it.name,
      it.qty, it.price, it.line_total, it.cost]);
  }

  return {
    kind: 'sales',
    label: 'Penjualan',
    filename: fileBase('penjualan', month, companyName),
    sheets: [
      { name: 'Ringkasan', rows: overview },
      { name: 'Transaksi', rows: txRows },
      { name: 'Item', rows: itemRows },
      { name: 'Harian', rows: perDay },
    ],
    counts: { transaksi: sales.length, item: items.length },
    csvSheet: 'Transaksi',
  };
}

// ---------------------------------------------------------------- KEUANGAN
function financeData(db, opts) {
  const { ids, month, companyName } = opts;
  const p = ph(ids.length);

  const fin = Q.financeFor(db, ids, month);
  const series = Q.seriesFor(db, ids, U.monthRange(month, 6));
  const expenses = Q.expenseBreakdown(db, ids, month);
  const txs = db.prepare(`SELECT t.*, c.name company, u.name user_name
    FROM transactions t LEFT JOIN companies c ON c.id = t.company_id LEFT JOIN users u ON u.id = t.user_id
    WHERE t.company_id IN (${p}) AND substr(t.occurred_at,1,7) = ?
    ORDER BY t.occurred_at, t.id`).all(...ids, month);
  const salesDaily = Q.dailySeries(db, ids, month);

  const pl = [
    ['Laba Rugi', 'BizDash Kopi'],
    ['Periode', U.monthLabel(month)],
    ['Cakupan', companyName],
    ['Dibuat', U.localNow()],
    [],
    ['Komponen', 'Nilai (Rp)', '% dari omzet'],
    ['Pendapatan penjualan', fin.revenue, 100],
    ['Harga pokok penjualan (HPP)', -fin.cogs, fin.revenue ? Number((-fin.cogs / fin.revenue * 100).toFixed(2)) : 0],
    ['Laba kotor', fin.gross, fin.revenue ? Number((fin.gross / fin.revenue * 100).toFixed(2)) : 0],
  ];
  for (const e of expenses) {
    pl.push([`Beban · ${e.category}`, -e.amount, fin.revenue ? Number((-e.amount / fin.revenue * 100).toFixed(2)) : 0]);
  }
  if (fin.income) pl.push(['Pendapatan lain-lain', fin.income, fin.revenue ? Number((fin.income / fin.revenue * 100).toFixed(2)) : 0]);
  pl.push(['Total beban', -fin.expenses, fin.revenue ? Number((-fin.expenses / fin.revenue * 100).toFixed(2)) : 0]);
  pl.push(['Laba bersih', fin.net, fin.revenue ? Number((fin.net / fin.revenue * 100).toFixed(2)) : 0]);
  pl.push([]);
  pl.push(['Indikator', 'Nilai']);
  pl.push(['Jumlah nota', fin.transactions]);
  pl.push(['Rata-rata per nota', fin.avgTicket]);
  pl.push(['Margin kotor (%)', Number(fin.grossMargin.toFixed(2))]);
  pl.push(['Margin bersih (%)', Number(fin.margin.toFixed(2))]);
  pl.push(['Rasio beban terhadap omzet (%)', Number(fin.expenseRatio.toFixed(2))]);

  const txRows = [['Tanggal', 'Entitas', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah', 'Sumber', 'Dicatat oleh']];
  for (const t of txs) {
    txRows.push([t.occurred_at.slice(0, 10), t.company || '', t.type === 'expense' ? 'Beban' : 'Pendapatan',
      t.category || '', t.description || '', t.type === 'expense' ? -t.amount : t.amount, t.source || 'manual', t.user_name || '']);
  }

  const trend = [['Bulan', 'Omzet', 'HPP', 'Laba kotor', 'Beban', 'Pendapatan lain', 'Laba bersih', 'Margin bersih (%)', 'Nota']];
  for (const s of series) {
    trend.push([U.monthLabel(s.month), s.revenue, s.cogs, s.revenue - s.cogs, s.expenses, s.income, s.net,
      s.revenue ? Number((s.net / s.revenue * 100).toFixed(2)) : 0, s.transactions]);
  }

  // Neraca & arus kas ikut diekspor supaya akuntan menerima paket lengkap.
  const bs = statements.balanceSheet(db, ids, month);
  const cf = statements.cashFlow(db, ids, month);
  const bsRows = [['Neraca per akhir periode', 'Nilai (Rp)'], []];
  for (const grp of bs.groups) {
    bsRows.push([grp.label, grp.total]);
    for (const row of grp.rows) bsRows.push(['  ' + row.label, row.value]);
    bsRows.push([]);
  }
  bsRows.push(['Total Aset', bs.totalAssets]);
  bsRows.push(['Total Kewajiban', bs.totalLiabilities]);
  bsRows.push(['Total Ekuitas', bs.totalEquity]);

  const cfRows = [
    ['Arus Kas', 'Jumlah (Rp)'],
    ['Kas awal periode', cf.beginBalance],
    [],
    ['Operasional', ''],
    ['Penerimaan dari penjualan', cf.pl.revenue],
    ['Penerimaan lain (operasional)', cf.groups.operating.in],
    ['Pembayaran HPP / bahan', -cf.pl.cogs],
    ['Pembayaran beban operasional', -cf.groups.operating.out],
    ['Arus kas operasi bersih', cf.operating],
    [],
    ['Investasi', ''],
    ['Penerimaan penjualan aset', cf.groups.investing.in],
    ['Pembelian aset tetap', -cf.groups.investing.out],
    ['Arus kas investasi bersih', cf.investing],
    [],
    ['Pendanaan', ''],
    ['Setoran modal', cf.groups.financing.in],
    ['Pembayaran utang / dividen', -cf.groups.financing.out],
    ['Arus kas pendanaan bersih', cf.financing],
    [],
    ['Kenaikan / penurunan kas bersih', cf.netChange],
    ['Kas akhir periode', cf.endBalance],
  ];

  const daily = [['Tanggal', 'Omzet', 'Nota', 'Rata-rata per nota']];
  for (const d of salesDaily) {
    daily.push([`${month}-${d.d}`, d.revenue, d.n, d.n ? Math.round(d.revenue / d.n) : 0]);
  }

  return {
    kind: 'finance',
    label: 'Keuangan',
    filename: fileBase('keuangan', month, companyName),
    sheets: [
      { name: 'Laba Rugi', rows: pl },
      { name: 'Arus Kas', rows: cfRows },
      { name: 'Neraca', rows: bsRows },
      { name: 'Transaksi', rows: txRows },
      { name: 'Tren 6 Bulan', rows: trend },
      { name: 'Harian', rows: daily },
    ],
    counts: { transaksi: txs.length, baris_beban: expenses.length },
    csvSheet: 'Laba Rugi',
  };
}

// ---------------------------------------------------------------- STOK BAHAN
function stockData(db, opts) {
  const { ids, month, companyName } = opts;
  const p = ph(ids.length);
  const materials = db.prepare(`SELECT m.*, c.name company
    FROM materials m LEFT JOIN companies c ON c.id = m.company_id
    WHERE m.company_id IN (${p}) AND m.active = 1
    ORDER BY c.name, m.name`).all(...ids);

  const moves = db.prepare(`SELECT mv.*, m.name material, m.unit, c.name company
    FROM material_moves mv
    LEFT JOIN materials m ON m.id = mv.material_id
    LEFT JOIN companies c ON c.id = mv.company_id
    WHERE mv.company_id IN (${p}) AND substr(mv.occurred_at,1,7) = ?
    ORDER BY mv.occurred_at, mv.id`).all(...ids, month);

  const usage = new Map();
  for (const mv of moves) {
    const key = mv.material_id;
    const row = usage.get(key) || { in: 0, out: 0, adjust: 0 };
    if (mv.type === 'in') row.in += mv.qty;
    else if (mv.type === 'out') row.out += mv.qty;
    else row.adjust += mv.qty;
    usage.set(key, row);
  }

  const rows = [['Entitas', 'Bahan', 'Kategori', 'Satuan', 'Harga satuan', 'Stok', 'Stok minimum',
    'Nilai stok', 'Status', 'Masuk (periode)', 'Keluar (periode)', 'Penyesuaian (periode)']];
  for (const m of materials) {
    const u = usage.get(m.id) || { in: 0, out: 0, adjust: 0 };
    const status = m.stock <= 0 ? 'Habis' : (m.stock < m.min_stock ? 'Di bawah minimum' : 'Aman');
    rows.push([m.company || '', m.name, m.category || '', m.unit, m.cost, m.stock, m.min_stock,
      Number((m.stock * m.cost).toFixed(2)), status, u.in, u.out, u.adjust]);
  }

  const moveRows = [['Tanggal', 'Entitas', 'Bahan', 'Tipe', 'Qty', 'Satuan', 'Harga satuan', 'Nilai',
    'Referensi', 'Catatan']];
  for (const mv of moves) {
    const type = mv.type === 'in' ? 'Masuk' : (mv.type === 'out' ? 'Keluar' : 'Penyesuaian');
    moveRows.push([mv.occurred_at.slice(0, 16), mv.company || '', mv.material || '', type, mv.qty, mv.unit || '',
      mv.unit_cost || 0, Number(((mv.unit_cost || 0) * mv.qty).toFixed(2)),
      mv.ref_type ? `${mv.ref_type}${mv.ref_id ? ' #' + mv.ref_id : ''}` : 'manual', mv.note || '']);
  }

  const totalValue = materials.reduce((a, m) => a + m.stock * m.cost, 0);
  const low = materials.filter((m) => m.stock < m.min_stock);
  const summary = [
    ['Stok Bahan Baku', 'BizDash Kopi'],
    ['Periode mutasi', U.monthLabel(month)],
    ['Cakupan', companyName],
    ['Dibuat', U.localNow()],
    [],
    ['Ringkasan', 'Nilai'],
    ['Jumlah bahan aktif', materials.length],
    ['Nilai stok total', Number(totalValue.toFixed(2))],
    ['Bahan di bawah minimum', low.length],
    ['Bahan habis', materials.filter((m) => m.stock <= 0).length],
    ['Mutasi masuk (periode)', moves.filter((m) => m.type === 'in').length],
    ['Mutasi keluar (periode)', moves.filter((m) => m.type === 'out').length],
    [],
    ['Bahan perlu restock', 'Stok', 'Minimum', 'Kurang'],
  ];
  for (const m of low.sort((a, b) => (a.stock - a.min_stock) - (b.stock - b.min_stock))) {
    summary.push([`${m.name} (${m.company || ''})`, m.stock, m.min_stock, Number((m.min_stock - m.stock).toFixed(2))]);
  }

  return {
    kind: 'stock',
    label: 'Stok bahan baku',
    filename: fileBase('stok', month, companyName),
    sheets: [
      { name: 'Ringkasan', rows: summary },
      { name: 'Stok', rows },
      { name: 'Mutasi', rows: moveRows },
    ],
    counts: { bahan: materials.length, mutasi: moves.length },
    csvSheet: 'Stok',
  };
}

// ---------------------------------------------------------------- MEMBER
function membersData(db, opts) {
  const { ids } = opts;
  const TIER_LABEL = posOptions.labelMap(db, 'price_tier');
  const p = ph(ids.length);
  const rows = db.prepare(`SELECT cu.*, c.name company,
      (SELECT COUNT(*) FROM sales s WHERE s.customer_id = cu.id AND s.status='paid') visits,
      (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id = cu.id AND s.status='paid') ltv,
      (SELECT MAX(sold_at) FROM sales s WHERE s.customer_id = cu.id AND s.status='paid') last_visit
    FROM customers cu LEFT JOIN companies c ON c.id = cu.company_id
    WHERE cu.company_id IN (${p})
    ORDER BY ltv DESC, cu.name`).all(...ids);

  const header = ['Nama', 'Tipe', 'Tier harga', 'Entitas', 'Perusahaan', 'NPWP', 'Telepon', 'Email',
    'Poin aktif', 'Kunjungan', 'Total belanja', 'Rata-rata per kunjungan', 'Kunjungan terakhir', 'Opt-in WhatsApp', 'Status'];
  const body = rows.map((c) => [
    c.name, TYPE_LABEL[c.type] || c.type, c.type === 'b2b' ? (TIER_LABEL[c.price_tier] || c.price_tier) : '-',
    c.company || '', c.company_name || '', c.npwp || '', c.phone || '', c.email || '',
    c.points || 0, c.visits, c.ltv, c.visits ? Math.round(c.ltv / c.visits) : 0,
    c.last_visit ? c.last_visit.slice(0, 10) : '', c.wa_opt_in ? 'Ya' : 'Tidak', c.active ? 'Aktif' : 'Nonaktif',
  ]);

  const b2c = rows.filter((c) => c.type === 'b2c');
  const b2b = rows.filter((c) => c.type === 'b2b');
  const summary = [
    ['Member & Pelanggan', 'BizDash Kopi'],
    ['Cakupan', opts.companyName],
    ['Dibuat', U.localNow()],
    [],
    ['Ringkasan', 'Nilai'],
    ['Total pelanggan', rows.length],
    ['Member B2C', b2c.length],
    ['Pelanggan B2B', b2b.length],
    ['Pelanggan aktif', rows.filter((c) => c.active).length],
    ['Total poin beredar', rows.reduce((a, c) => a + (c.points || 0), 0)],
    ['Nilai poin (Rp 100/poin)', rows.reduce((a, c) => a + (c.points || 0), 0) * 100],
    ['Total belanja semua pelanggan', rows.reduce((a, c) => a + c.ltv, 0)],
    ['Opt-in WhatsApp', rows.filter((c) => c.wa_opt_in).length],
    [],
    ['Top 10 pelanggan', 'Total belanja', 'Kunjungan'],
  ];
  for (const c of rows.slice(0, 10)) summary.push([c.name, c.ltv, c.visits]);

  return {
    kind: 'members',
    label: 'Member & pelanggan',
    filename: fileBase('member', opts.month, opts.companyName),
    sheets: [{ name: 'Ringkasan', rows: summary }, { name: 'Member', rows: [header, ...body] }],
    counts: { pelanggan: rows.length },
    csvSheet: 'Member',
  };
}

// ---------------------------------------------------------------- ABSENSI
function attendanceData(db, opts) {
  const { ids, month, companyName } = opts;
  const p = ph(ids.length);
  const rows = db.prepare(`SELECT a.*, u.name user_name, u.email, u.hourly_rate, c.name company, sh.name shift_name,
      sh.start_time, sh.end_time
    FROM attendance a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN companies c ON c.id = a.company_id
    LEFT JOIN shifts sh ON sh.id = a.shift_id
    WHERE a.company_id IN (${p}) AND substr(a.date,1,7) = ?
    ORDER BY a.date, u.name`).all(...ids, month);

  const body = [['Tanggal', 'Karyawan', 'Entitas', 'Shift', 'Jam shift', 'Masuk', 'Pulang', 'Status',
    'Terlambat (menit)', 'Jam kerja', 'Tarif/jam', 'Estimasi biaya']];
  for (const a of rows) {
    const hours = (a.work_minutes || 0) / 60;
    body.push([a.date, a.user_name || '', a.company || '', a.shift_name || '',
      a.start_time ? `${a.start_time}–${a.end_time}` : '',
      a.clock_in ? a.clock_in.slice(11, 16) : '', a.clock_out ? a.clock_out.slice(11, 16) : '',
      ATT_STATUS[a.status] || a.status, a.late_minutes || 0, Number(hours.toFixed(2)),
      a.hourly_rate || 0, Math.round(hours * (a.hourly_rate || 0))]);
  }

  const perUser = new Map();
  for (const a of rows) {
    const key = a.user_id;
    const r = perUser.get(key) || { name: a.user_name, company: a.company, days: 0, late: 0, minutes: 0, cost: 0, rate: a.hourly_rate || 0 };
    r.days += 1;
    if (a.status === 'late') r.late += 1;
    r.minutes += a.work_minutes || 0;
    r.cost += ((a.work_minutes || 0) / 60) * (a.hourly_rate || 0);
    perUser.set(key, r);
  }
  const recap = [['Karyawan', 'Entitas', 'Hari tercatat', 'Terlambat', 'Total jam', 'Rata-rata jam/hari', 'Tarif/jam', 'Estimasi biaya']];
  for (const r of [...perUser.values()].sort((a, b) => b.cost - a.cost)) {
    recap.push([r.name || '', r.company || '', r.days, r.late, Number((r.minutes / 60).toFixed(2)),
      r.days ? Number((r.minutes / 60 / r.days).toFixed(2)) : 0, r.rate, Math.round(r.cost)]);
  }

  const summary = [
    ['Absensi & Jam Kerja', 'BizDash Kopi'],
    ['Periode', U.monthLabel(month)],
    ['Cakupan', companyName],
    ['Dibuat', U.localNow()],
    [],
    ['Ringkasan', 'Nilai'],
    ['Baris absensi', rows.length],
    ['Karyawan tercatat', perUser.size],
    ['Total jam kerja', Number((rows.reduce((a, r) => a + (r.work_minutes || 0), 0) / 60).toFixed(2))],
    ['Total keterlambatan', rows.filter((r) => r.status === 'late').length],
    ['Total menit terlambat', rows.reduce((a, r) => a + (r.late_minutes || 0), 0)],
    ['Estimasi biaya tenaga kerja', Math.round(rows.reduce((a, r) => a + ((r.work_minutes || 0) / 60) * (r.hourly_rate || 0), 0))],
  ];

  return {
    kind: 'attendance',
    label: 'Absensi & jam kerja',
    filename: fileBase('absensi', month, companyName),
    sheets: [
      { name: 'Ringkasan', rows: summary },
      { name: 'Absensi', rows: body },
      { name: 'Rekap Karyawan', rows: recap },
    ],
    counts: { absensi: rows.length, karyawan: perUser.size },
    csvSheet: 'Absensi',
  };
}

const KINDS = {
  sales: { build: salesData, cap: 'pos_read', label: 'Penjualan', desc: 'Nota, item terjual, ringkasan per outlet & harian.', icon: 'receipt' },
  finance: { build: financeData, cap: 'finance_read', label: 'Keuangan', desc: 'Laba rugi, transaksi beban/pendapatan, tren 6 bulan.', icon: 'wallet' },
  stock: { build: stockData, cap: 'inventory_read', label: 'Stok bahan baku', desc: 'Stok & nilai persediaan plus mutasi masuk/keluar.', icon: 'sprinkle' },
  members: { build: membersData, cap: 'customer_read', label: 'Member & pelanggan', desc: 'Poin, kunjungan, total belanja, data B2B.', icon: 'idcard' },
  attendance: { build: attendanceData, cap: 'attendance_read', label: 'Absensi & jam kerja', desc: 'Kehadiran, jam kerja, dan estimasi biaya tenaga kerja.', icon: 'clock' },
};

// Daftar sheet statis untuk halaman indeks (tanpa membangun workbook = tanpa query berat).
const SHEETS = {
  sales: ['Ringkasan', 'Transaksi', 'Item', 'Harian'],
  finance: ['Laba Rugi', 'Arus Kas', 'Neraca', 'Transaksi', 'Tren 6 Bulan', 'Harian'],
  stock: ['Ringkasan', 'Stok', 'Mutasi'],
  members: ['Ringkasan', 'Member'],
  attendance: ['Ringkasan', 'Absensi', 'Rekap Karyawan'],
};

/**
 * Membangun file ekspor. Mengembalikan { buffer, filename, mime, sheets, counts }.
 * `format`: 'xlsx' (semua sheet) atau 'csv' (satu sheet utama).
 */
function build(db, kind, opts = {}) {
  const def = KINDS[kind];
  if (!def) return { error: 'Jenis ekspor tidak dikenal.' };
  if (!opts.ids || !opts.ids.length) return { error: 'Tidak ada entitas dalam cakupan Anda.' };
  const data = def.build(db, { ...opts, month: opts.month || U.currentMonthKey() });
  const format = opts.format === 'csv' ? 'csv' : 'xlsx';

  if (format === 'csv') {
    const sheet = data.sheets.find((s) => s.name === data.csvSheet) || data.sheets[0];
    return {
      buffer: Buffer.from(rowsToCsv(sheet.rows), 'utf8'),
      filename: `${data.filename}-${U.slug(sheet.name)}.csv`,
      mime: 'text/csv; charset=utf-8',
      sheets: [sheet.name],
      counts: data.counts,
      kind,
      label: def.label,
    };
  }

  const wb = XLSX.utils.book_new();
  for (const sheet of data.sheets) {
    XLSX.utils.book_append_sheet(wb, sheetFromRows(sheet.rows), sheet.name.slice(0, 31));
  }
  return {
    buffer: workbookToBuffer(wb),
    filename: `${data.filename}.xlsx`,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sheets: data.sheets.map((s) => s.name),
    counts: data.counts,
    kind,
    label: def.label,
  };
}

module.exports = { build, KINDS, SHEETS, salesData, financeData, stockData, membersData, attendanceData, rowsToCsv };
