'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const { POINT_VALUE } = require('../lib/pos-engine');
const { labelsFor } = require('./pos');
const PO = require('../lib/pos-options');

const TYPE_LABEL = { b2c: 'Member B2C', b2b: 'Pelanggan B2B' };

function membersPage(ctx, data) {
  const { customers, stats, detail, detailSales, detailPrices, products, filter } = data;
  const canWrite = can(ctx.user, 'customer_write');
  // nama tier mengikuti Master Data POS (kode tier tetap retail/grosir/distributor)
  const TIER_LABEL = PO.labelMap(ctx.db, 'price_tier');
  const tierOption = (selected) => PO.rows(ctx.db, 'price_tier')
    .map((t) => `<option value="${U.h(t.code)}" ${t.code === selected ? 'selected' : ''}>${U.h(t.label)}</option>`).join('');

  const rows = customers.map((c) => `<tr>
    <td>
      <span class="strong">${U.h(c.type === 'b2b' ? (c.company_name || c.name) : c.name)}</span>
      <span class="sub-cell">${U.h(c.type === 'b2b' ? 'PIC ' + c.name : (c.phone || 'tanpa no. HP'))}</span>
    </td>
    <td>${L.badge(TYPE_LABEL[c.type] || c.type, c.type === 'b2b' ? 'indigo' : 'good')}</td>
    <td>${c.type === 'b2b' ? L.badge(TIER_LABEL[c.price_tier] || c.price_tier, c.price_tier === 'distributor' ? 'indigo' : 'muted') : '—'}</td>
    <td class="num strong">${U.num(c.points)}</td>
    <td class="num">${U.idrShort(c.spend)}</td>
    <td class="num">${U.num(c.trx)}</td>
    <td class="num muted">${c.last_visit ? U.h(c.last_visit.slice(0, 10)) : '—'}</td>
    <td class="num"><a class="btn btn-ghost btn-sm" href="${ctx.link('/members', { customer: c.id })}">Detail</a></td>
  </tr>`).join('');

  const detailBlock = detail ? `
    <div class="grid grid-side" style="margin-top:20px">
      ${L.card({ title: detail.type === 'b2b' ? (detail.company_name || detail.name) : detail.name, subtitle: `${TYPE_LABEL[detail.type]} · ${detail.company_name || ''}` }, `
        <div class="table-wrap"><table class="data">
          <tbody>
            <tr><td class="muted">Tipe pelanggan</td><td class="strong">${U.h(TYPE_LABEL[detail.type] || detail.type)}</td></tr>
            ${detail.type === 'b2b' ? `<tr><td class="muted">Tier harga</td><td class="strong">${U.h(TIER_LABEL[detail.price_tier])}</td></tr>
            <tr><td class="muted">NPWP</td><td>${U.h(detail.npwp || '—')}</td></tr>` : ''}
            <tr><td class="muted">Kontak</td><td>${U.h(detail.phone || '—')} ${detail.email ? '· ' + U.h(detail.email) : ''}</td></tr>
            <tr><td class="muted">Poin aktif</td><td class="strong">${U.num(detail.points)} poin <span class="muted">(≈ ${U.idr(detail.points * POINT_VALUE)})</span></td></tr>
            <tr><td class="muted">Total belanja</td><td>${U.idr(detail.spend || 0)} dari ${U.num(detail.trx || 0)} transaksi</td></tr>
            <tr><td class="muted">Entitas</td><td>${U.h(detail.company_name)}</td></tr>
          </tbody>
        </table></div>
        ${canWrite ? `
        <form method="post" action="${ctx.base}/members/${detail.id}/points" style="margin-top:14px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          ${ctx.csrfField}${ctx.backField}
          <label class="field"><span>Sesuaikan poin</span><input name="delta" type="number" step="1" placeholder="+/-" style="width:110px"></label>
          <label class="field" style="flex:1"><span>Catatan</span><input name="note" placeholder="mis. kompensasi komplain"></label>
          <button class="btn btn-ghost btn-sm" type="submit">Terapkan</button>
        </form>
        <details class="disclosure" style="margin-top:12px">
          <summary>${L.icon('settings', 15)} Ubah data pelanggan</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/members/save">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="id" value="${detail.id}">
              <div class="form-grid" style="gap:8px">
                <label class="field"><span>Nama / PIC</span><input name="name" value="${U.h(detail.name)}" required></label>
                <label class="field"><span>No. HP</span><input name="phone" value="${U.h(detail.phone || '')}"></label>
                <label class="field"><span>Email</span><input name="email" value="${U.h(detail.email || '')}"></label>
                <label class="field"><span>Tipe</span>
                  <select name="type">
                    <option value="b2c" ${detail.type === 'b2c' ? 'selected' : ''}>Member B2C</option>
                    <option value="b2b" ${detail.type === 'b2b' ? 'selected' : ''}>Pelanggan B2B</option>
                  </select>
                </label>
                <label class="field"><span>Nama perusahaan (B2B)</span><input name="company_name" value="${U.h(detail.company_name && detail.type === 'b2b' ? detail.company_name : '')}"></label>
                <label class="field"><span>NPWP</span><input name="npwp" value="${U.h(detail.npwp || '')}"></label>
                <label class="field"><span>Tier harga</span>
                  <select name="price_tier">${tierOption(detail.price_tier)}</select>
                </label>
                <label class="field"><span>Status</span>
                  <select name="active"><option value="1" ${detail.active ? 'selected' : ''}>Aktif</option><option value="0" ${!detail.active ? 'selected' : ''}>Nonaktif</option></select>
                </label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan perubahan</button></div>
            </form>
          </div>
        </details>` : ''}`)}

      ${L.card({ title: 'Harga khusus pelanggan', subtitle: detail.type === 'b2b' ? 'Override harga di atas tier default' : 'Umumnya hanya untuk B2B' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Produk</th><th class="num">Harga normal</th><th class="num">Harga khusus</th><th></th></tr></thead>
          <tbody>${detailPrices.map((p) => `<tr>
            <td>${U.h(p.product_name)}</td>
            <td class="num muted">${U.idr(p.base_price)}</td>
            <td class="num strong">${U.idr(p.price)}</td>
            <td class="num">${canWrite ? `<form method="post" action="${ctx.base}/members/${detail.id}/prices/${p.id}/delete">
              ${ctx.csrfField}${ctx.backField}<button class="btn btn-ghost btn-sm" type="submit">Hapus</button></form>` : ''}</td>
          </tr>`).join('') || `<tr><td colspan="4">${L.empty('Belum ada harga khusus')}</td></tr>`}</tbody>
        </table></div>
        ${canWrite ? `<form method="post" action="${ctx.base}/members/${detail.id}/prices" style="margin-top:14px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          ${ctx.csrfField}${ctx.backField}
          <label class="field" style="flex:2"><span>Produk</span>
            <select name="product_id">${products.map((p) => `<option value="${p.id}">${U.h(p.name)} · ${U.idr(p.price)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Harga khusus</span><input name="price" type="number" min="0" step="500" required style="width:130px"></label>
          <button class="btn btn-primary btn-sm" type="submit">Simpan</button>
        </form>` : ''}`)}
    </div>

    ${L.card({ title: 'Riwayat transaksi pelanggan', subtitle: `${detailSales.length} transaksi terakhir` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Invoice</th><th>Waktu</th><th>Outlet</th><th>Promo</th><th class="num">Poin</th><th class="num">Total</th></tr></thead>
        <tbody>${detailSales.map((s) => `<tr>
          <td class="strong">${U.h(s.invoice_no)}</td>
          <td>${U.h(s.sold_at.slice(0, 16))}</td>
          <td>${U.h(s.company_name)}</td>
          <td class="muted">${U.h(s.promo_label || '—')}</td>
          <td class="num">${s.points_earned ? '+' + U.num(s.points_earned) : ''}${s.points_used ? ' −' + U.num(s.points_used) : ''}${!s.points_earned && !s.points_used ? '—' : ''}</td>
          <td class="num strong">${U.idr(s.total)}</td>
        </tr>`).join('') || `<tr><td colspan="6">${L.empty('Belum ada transaksi')}</td></tr>`}</tbody>
      </table></div>`)}
  ` : '';

  const body = `
    <div class="grid grid-4">
      ${[
        ['Total member B2C', U.num(stats.b2c), 'terdaftar'],
        ['Pelanggan B2B', U.num(stats.b2b), 'kafe, kantor, reseller'],
        ['Porsi transaksi member', U.pct(stats.share, 0), 'dari nilai penjualan bulan ini'],
        ['Poin beredar', U.num(stats.pointsBalance), `≈ ${U.idrShort(stats.pointsBalance * POINT_VALUE)}`],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Member & pelanggan', subtitle: `${customers.length} data ditampilkan (maks. 60 teratas) · poin 1 = ${U.idr(POINT_VALUE)}` }, `
      <form method="get" action="${ctx.base}/members" class="inline-filters">
        ${ctx.selectedCompanyId ? `<input type="hidden" name="company" value="${ctx.selectedCompanyId}">` : ''}
        <input type="hidden" name="month" value="${ctx.month}">
        <input type="search" name="q" value="${U.h(filter.q || '')}" placeholder="Cari nama, perusahaan, atau no. HP…">
        <select name="type" data-autosubmit>
          <option value="all" ${filter.type === 'all' ? 'selected' : ''}>Semua tipe</option>
          <option value="b2c" ${filter.type === 'b2c' ? 'selected' : ''}>Member B2C</option>
          <option value="b2b" ${filter.type === 'b2b' ? 'selected' : ''}>Pelanggan B2B</option>
        </select>
        <button class="btn btn-ghost btn-sm" type="submit">Cari</button>
      </form>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Nama</th><th>Tipe</th><th>Tier harga</th><th class="num">Poin</th><th class="num">Total belanja</th><th class="num">Nota</th><th class="num">Terakhir</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8">${L.empty('Belum ada pelanggan', 'Tambahkan member pertama Anda di bawah.')}</td></tr>`}</tbody>
      </table></div>`)}

    ${canWrite ? L.card({ title: 'Tambah pelanggan', subtitle: 'B2C mendapat poin otomatis; B2B memakai harga grosir/distributor' }, `
      <form method="post" action="${ctx.base}/members/save">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama / PIC</span><input name="name" required placeholder="mis. Budi atau Ibu Sari"></label>
          <label class="field"><span>No. HP</span><input name="phone" placeholder="08xx"></label>
          <label class="field"><span>Email</span><input name="email" type="email" placeholder="opsional"></label>
          <label class="field"><span>Tipe pelanggan</span>
            <select name="type"><option value="b2c">Member B2C</option><option value="b2b">Pelanggan B2B</option></select>
          </label>
          <label class="field"><span>Nama perusahaan (B2B)</span><input name="company_name" placeholder="mis. PT Kopi Senja"></label>
          <label class="field"><span>NPWP (B2B)</span><input name="npwp" placeholder="opsional"></label>
          <label class="field"><span>Tier harga</span>
            <select name="price_tier">${tierOption('retail')}</select>
          </label>
          <label class="field"><span>Poin awal</span><input name="points" type="number" min="0" value="0"></label>
          <label class="field"><span>Entitas</span>
            <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.selectedCompanyId === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
          </label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan pelanggan</button></div>
      </form>`) : ''}
    ${detailBlock}
  `;

  return L.shell(ctx, {
    title: 'Member & Pelanggan',
    subtitle: 'B2C dengan poin, B2B dengan tier harga grosir/distributor',
    active: '/members',
    toolbar: L.exportButton(ctx, 'members', 'Ekspor Excel'),
    content: body,
  });
}

module.exports = { membersPage, TYPE_LABEL };
