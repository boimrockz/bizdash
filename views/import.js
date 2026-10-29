'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');

function importPage(ctx, data) {
  const { templates, logs } = data;
  const canImport = can(ctx.user, 'import');

  const body = `
    <div class="grid grid-side">
      ${L.card({ title: 'Import data penjualan (CSV / Excel)', subtitle: 'Cocok untuk memindahkan riwayat POS lama atau rekap harian dari mesin kasir lain' }, `
        ${canImport ? `<form method="post" action="${ctx.base}/import/sales" enctype="multipart/form-data">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>File (.csv, .xlsx, .xls)</span><input type="file" name="file" accept=".csv,.xlsx,.xls" required></label>
            <label class="field"><span>Sumber data</span>
              <select name="mode">
                <option value="items">Detail item per baris (tanggal, outlet, sku, qty)</option>
                <option value="summary">Ringkasan harian (tanggal, outlet, total)</option>
              </select>
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">${L.icon('upload', 15)} Import penjualan</button>
            <a class="btn btn-ghost" href="${ctx.base}/import/template?type=sales">Unduh template CSV</a>
          </div>
        </form>` : `<p class="hint-text">Role Anda tidak memiliki izin import data.</p>`}
        <div style="margin-top:16px">
          <p class="persp-meta" style="margin-bottom:6px">Kolom yang dikenali</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Kolom</th><th>Wajib</th><th>Contoh</th></tr></thead>
            <tbody>
              ${templates.sales.map((r) => `<tr><td class="strong">${U.h(r[0])}</td><td>${r[1] ? L.badge('Wajib', 'indigo') : L.badge('Opsional', 'muted')}</td><td class="muted">${U.h(r[2])}</td></tr>`).join('')}
            </tbody>
          </table></div>
          <p class="hint-text" style="margin-top:8px">Baris dengan produk/outlet yang tidak dikenal akan dilewati dan dilaporkan. Kolom <b>pelanggan</b> opsional: jika cocok dengan member (nama/no. HP), transaksi otomatis terhubung ke member dan harga tier B2B dipakai.</p>
        </div>`)}

      ${L.card({ title: 'Import menu & harga', subtitle: 'Tambahkan atau perbarui katalog menu/biji kopi sekaligus' }, `
        ${canImport ? `<form method="post" action="${ctx.base}/import/products" enctype="multipart/form-data">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>File (.csv, .xlsx, .xls)</span><input type="file" name="file" accept=".csv,.xlsx,.xls" required></label>
            <label class="field"><span>Entitas pemilik</span>
              <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.selectedCompanyId === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">${L.icon('upload', 15)} Import produk</button>
            <a class="btn btn-ghost" href="${ctx.base}/import/template?type=products">Unduh template CSV</a>
          </div>
        </form>` : ''}
        <div style="margin-top:16px">
          <p class="persp-meta" style="margin-bottom:6px">Kolom yang dikenali</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Kolom</th><th>Wajib</th><th>Contoh</th></tr></thead>
            <tbody>
              ${templates.products.map((r) => `<tr><td class="strong">${U.h(r[0])}</td><td>${r[1] ? L.badge('Wajib', 'indigo') : L.badge('Opsional', 'muted')}</td><td class="muted">${U.h(r[2])}</td></tr>`).join('')}
            </tbody>
          </table></div>
          <p class="hint-text" style="margin-top:8px">SKU yang sudah ada akan diperbarui (nama, kategori, harga retail/grosir/distributor, stok). HPP dihitung dari resep, bukan dari file.</p>
        </div>`)}
    </div>

    ${L.card({ title: 'Riwayat import', subtitle: 'Aktivitas import terakhir pada akun ini' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Waktu</th><th>Aksi</th><th>Detail</th></tr></thead>
        <tbody>${logs.map((l) => `<tr><td>${U.h(l.created_at)}</td><td>${L.badge(l.action, 'indigo')}</td><td class="muted">${U.h(l.detail)}</td></tr>`).join('') || `<tr><td colspan="3">${L.empty('Belum ada aktivitas import')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Import Data',
    subtitle: 'Masukkan penjualan historis atau katalog menu dari file CSV/Excel',
    active: '/import',
    content: body,
  });
}

module.exports = { importPage };
