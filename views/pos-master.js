'use strict';

/**
 * Settings → Master Data POS.
 * Satu halaman untuk menambah/mengubah: jenis menu, kategori menu, metode pembayaran,
 * nama tier harga, nama kanal, plus pintasan ke pengelolaan entitas/outlet.
 */

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const PO = require('../lib/pos-options');

function iconOptions(current) {
  return PO.ICON_CHOICES.map((k) => `<option value="${k}" ${k === current ? 'selected' : ''}>${k}</option>`).join('');
}

function statusBadge(row, kind) {
  if (PO.KINDS[kind].locked) return L.badge('Sistem', 'muted');
  return row.active ? L.badge('Aktif', 'good') : L.badge('Nonaktif', 'muted');
}

/** Form ubah satu baris (dibuka lewat disclosure di kolom aksi). */
function editForm(ctx, kind, row) {
  const def = PO.KINDS[kind];
  const fields = [];
  if (def.form.includes('label')) {
    fields.push(`<label class="field"><span>Nama tampilan</span><input name="label" value="${U.h(row.label)}" required maxlength="60"></label>`);
  }
  if (def.form.includes('code')) {
    fields.push(`<label class="field"><span>Kode</span><input name="code" value="${U.h(row.code)}" maxlength="40"></label>`);
  }
  if (def.form.includes('icon')) {
    fields.push(`<label class="field"><span>Ikon</span><select name="icon"><option value="">— tanpa ikon —</option>${iconOptions(row.icon || '')}</select></label>`);
  }
  if (def.form.includes('sort_order')) {
    fields.push(`<label class="field"><span>Urutan</span><input type="number" name="sort_order" value="${row.sort_order}" step="1"></label>`);
  }
  if (def.form.includes('tracks_stock')) {
    fields.push(`<label class="checkline"><input type="checkbox" name="tracks_stock" value="1" ${row.tracks_stock ? 'checked' : ''}> Lacak stok produk jadi</label>`);
  }
  if (def.form.includes('active') && !def.locked) {
    fields.push(`<label class="field"><span>Status</span>
      <select name="active"><option value="1" ${row.active ? 'selected' : ''}>Aktif</option><option value="0" ${row.active ? '' : 'selected'}>Nonaktif</option></select>
    </label>`);
  }
  const used = row.used || 0;
  return `<form method="post" action="${ctx.base}/settings/pos/master/save" class="stack-form">
    ${ctx.csrfField}${ctx.backField}
    <input type="hidden" name="kind" value="${kind}">
    <input type="hidden" name="id" value="${row.id}">
    <div class="form-grid" style="gap:10px">${fields.join('')}</div>
    ${def.form.includes('code') && used
      ? `<p class="hint-text">Kode dipakai ${U.num(used)} data — kode tidak bisa diubah, ubah namanya saja.</p>` : ''}
    <div class="form-actions">
      <button class="btn btn-primary btn-sm" type="submit">Simpan</button>
      ${def.locked || (row.is_system && PO.LOCKED_CODES[kind] && PO.LOCKED_CODES[kind].includes(row.code)) ? '' : `<button class="btn btn-ghost btn-sm" type="submit"
        formaction="${ctx.base}/settings/pos/master/${row.id}/toggle" formnovalidate>${row.active ? 'Nonaktifkan' : 'Aktifkan'}</button>`}
      ${def.locked || row.is_system ? '' : `<button class="btn btn-danger btn-sm" type="submit" formaction="${ctx.base}/settings/pos/master/${row.id}/delete"
        formnovalidate data-confirm="Hapus ${U.h(row.label)}?">Hapus</button>`}
    </div>
  </form>`;
}

/** Form tambah baris baru (tidak untuk jenis yang dikunci sistem). */
function addForm(ctx, kind) {
  const def = PO.KINDS[kind];
  if (def.locked) {
    return `<p class="hint-text">${U.h(def.label)} bersifat sistem: kode tidak bisa ditambah/dihapus, hanya namanya yang dapat diubah.</p>`;
  }
  const fields = [];
  if (def.form.includes('label')) fields.push(`<label class="field"><span>Nama baru</span><input name="label" required maxlength="60" placeholder="${kind === 'category' ? 'mis. Teh & Herbal' : 'mis. Paket katering'}"></label>`);
  if (def.form.includes('code')) fields.push(`<label class="field"><span>Kode (opsional)</span><input name="code" maxlength="40" placeholder="otomatis dari nama"></label>`);
  if (def.form.includes('icon')) fields.push(`<label class="field"><span>Ikon</span><select name="icon"><option value="">— tanpa ikon —</option>${iconOptions('')}</select></label>`);
  if (def.form.includes('sort_order')) fields.push(`<label class="field"><span>Urutan</span><input type="number" name="sort_order" value="50" step="1"></label>`);
  if (def.form.includes('tracks_stock')) fields.push(`<label class="checkline"><input type="checkbox" name="tracks_stock" value="1"> Lacak stok produk jadi</label>`);
  return `<form method="post" action="${ctx.base}/settings/pos/master/save" class="stack-form">
    ${ctx.csrfField}${ctx.backField}
    <input type="hidden" name="kind" value="${kind}">
    <div class="form-grid" style="gap:10px">${fields.join('')}</div>
    <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">${L.icon('plus', 14)} Tambah ${U.h(def.label.toLowerCase())}</button></div>
  </form>`;
}

function kindCard(ctx, kind, rows, canWrite) {
  const def = PO.KINDS[kind];
  const body = rows.map((row) => {
    const icon = def.form.includes('icon')
      ? (row.icon ? L.icon(row.icon, 16) : '<span class="muted">—</span>')
      : '<span class="muted">—</span>';
    return `<tr>
      <td><span class="strong">${U.h(row.label)}</span>${row.tracks_stock ? `<span class="sub-cell">lacak stok produk jadi</span>` : ''}</td>
      <td><span class="mono">${U.h(row.code)}</span></td>
      <td>${icon}</td>
      <td class="num">${U.num(row.used || 0)}</td>
      <td>${statusBadge(row, kind)}</td>
      <td class="num">
        ${canWrite ? `<details class="disclosure" style="border:none;background:transparent">
          <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo);justify-content:flex-end">Ubah</summary>
          <div class="disc-body" style="padding:10px 0;min-width:320px;text-align:left">${editForm(ctx, kind, row)}</div>
        </details>` : row.is_system ? L.badge('Bawaan', 'muted') : ''}
      </td>
    </tr>`;
  }).join('');

  return L.card({ title: def.label, subtitle: def.helper }, `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Nama</th><th>Kode</th><th>Ikon</th><th class="num">Dipakai</th><th>Status</th><th></th></tr></thead>
      <tbody>${body || `<tr><td colspan="6">${L.empty('Belum ada data')}</td></tr>`}</tbody>
    </table></div>
    ${canWrite ? `<div class="master-add"><p class="form-section">Tambah ${U.h(def.label.toLowerCase())}</p>${addForm(ctx, kind)}</div>` : ''}`);
}

function posMasterPage(ctx, data) {
  const { groups, outlets, productCount, productKinds, categoryTop } = data;
  const canWrite = can(ctx.user, 'pos_write');

  const stats = [
    ['Jenis menu aktif', U.num((groups.menu_type || []).filter((r) => r.active).length), `${productCount} produk terdaftar`],
    ['Kategori aktif', U.num((groups.category || []).filter((r) => r.active).length), `${categoryTop} kategori terpakai`],
    ['Metode bayar aktif', U.num((groups.payment_method || []).filter((r) => r.active).length), `${groups.payment_method ? groups.payment_method.reduce((a, r) => a + (r.used || 0), 0) : 0} nota tercatat`],
    ['Outlet penjualan', U.num(outlets.length), 'entitas dalam cakupan'],
  ].map(([label, value, sub]) => `<article class="stat">
    <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
    <div class="stat-value">${value}</div>
    <div class="stat-sub">${U.h(sub)}</div>
  </article>`).join('');

  const outletRows = outlets.map((c) => `<tr>
    <td><span class="strong">${U.h(c.name)}</span><span class="sub-cell">${U.h(c.code || '')} · ${U.h(c.level)}</span></td>
    <td>${L.badge(c.level === 'outlet' ? 'Outlet penjualan' : c.level === 'unit' ? 'Unit' : 'Holding', c.level === 'outlet' ? 'good' : 'muted')}</td>
    <td class="num">${U.num((productKinds[c.id] || 0))} produk</td>
  </tr>`).join('');

  const body = `
    <div class="grid grid-4">${stats}</div>

    ${L.card({ title: 'Cara kerja master data POS', subtitle: 'Semua pilihan di layar kasir diambil dari daftar ini' }, `
      <ul class="acad-list">
        <li><b>Jenis menu</b> menentukan perilaku produk. Jenis dengan <b>lacak stok</b> akan mengurangi stok produk jadi setiap penjualan (mis. biji kopi kemasan); jenis lain hanya dihitung dari resep bahan baku.</li>
        <li><b>Kategori menu</b> muncul sebagai rail filter di layar kasir dan pilihan pada form produk. Mengganti nama kategori otomatis memperbarui semua produk yang memakainya.</li>
        <li><b>Metode pembayaran</b> menjadi tombol bayar di POS. QRIS & Tunai adalah metode sistem: boleh diganti namanya, tidak bisa dihapus atau dinonaktifkan karena dipakai modul QRIS.</li>
        <li><b>Tier harga</b> dan <b>kanal penjualan</b> terikat ke kolom data (harga grosir/distributor & jenis pelanggan), jadi hanya nama tampilannya yang bisa diubah agar riwayat tetap konsisten.</li>
        <li>Data yang sudah dipakai transaksi <b>tidak dihapus</b> — nonaktifkan saja supaya struk, laporan, dan ekspor lama tetap benar.</li>
      </ul>
      <div class="chip-row" style="margin-top:14px">
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/pos">${L.icon('cart', 15)} Buka kasir</a>
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/pos/products">${L.icon('coffee', 15)} Menu &amp; resep</a>
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/structure">${L.icon('sitemap', 15)} Entitas &amp; outlet</a>
      </div>`)}

    <div class="grid grid-2">
      ${kindCard(ctx, 'menu_type', groups.menu_type || [], canWrite)}
      ${kindCard(ctx, 'category', groups.category || [], canWrite)}
    </div>

    ${kindCard(ctx, 'payment_method', groups.payment_method || [], canWrite)}

    <div class="grid grid-2">
      ${kindCard(ctx, 'price_tier', groups.price_tier || [], canWrite)}
      ${kindCard(ctx, 'channel', groups.channel || [], canWrite)}
    </div>

    ${L.card({
      title: 'Entitas & outlet POS',
      subtitle: 'Tambah entitas/outlet baru agar muncul sebagai pilihan di layar kasir',
      action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/structure">${L.icon('sitemap', 15)} Kelola entitas</a>`,
    }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Entitas</th><th>Jenis</th><th class="num">Produk</th></tr></thead>
        <tbody>${outletRows || `<tr><td colspan="3">${L.empty('Belum ada entitas')}</td></tr>`}</tbody>
      </table></div>
      <p class="hint-text" style="margin-top:12px">
        Entitas (holding → unit → outlet) ditambahkan di halaman <a href="${ctx.base}/structure">Struktur Organisasi</a>.
        Setiap entitas bertipe <b>outlet</b> langsung bisa dipilih sebagai outlet penjualan di POS, dan produk
        bisa didaftarkan per entitas pada form Menu &amp; Resep.
      </p>`)}
  `;

  return L.shell(ctx, {
    title: 'Master Data POS',
    subtitle: 'Jenis menu, kategori, metode bayar, tier harga, dan outlet penjualan',
    active: '/settings/pos/master',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/settings/pos">${L.icon('printer', 15)} Kasir, QRIS &amp; Struk</a>`,
  });
}

module.exports = { posMasterPage };
