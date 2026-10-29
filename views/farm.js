'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');

const CATEGORY_LABEL = {
  green_bean: 'Green bean (kebun)',
  roasted_bean: 'Roasted bean',
  dairy: 'Susu & dairy',
  syrup: 'Sirup & gula',
  packaging: 'Kemasan & cup',
  other: 'Lain-lain',
};

function farmPage(ctx, data) {
  const { materials, summary, moves, recipes, usage } = data;
  const canWrite = can(ctx.user, 'inventory_write');

  const rows = materials.map((m) => `<tr class="${m.low ? 'row-low' : ''}">
    <td><span class="strong">${U.h(m.name)}</span><span class="sub-cell">${U.h(CATEGORY_LABEL[m.category] || m.category || '—')}</span></td>
    <td>${U.h(m.company_name)}</td>
    <td class="num">${U.num(m.stock, m.unit === 'pcs' ? 0 : 2)} ${U.h(m.unit)}</td>
    <td class="num muted">${U.num(m.min_stock, m.unit === 'pcs' ? 0 : 2)}</td>
    <td class="num">${U.idr(m.cost)}<span class="sub-cell">per ${U.h(m.unit)}</span></td>
    <td class="num strong">${U.idrShort(m.value)}</td>
    <td>${m.low ? L.badge('Perlu restock', 'bad') : L.badge('Aman', 'good')}</td>
    <td class="num">
      ${canWrite ? `<details class="disclosure" style="border:none;background:transparent">
        <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo);justify-content:flex-end">Kelola</summary>
        <div class="disc-body" style="padding:10px 0;min-width:300px;text-align:left">
          <form method="post" action="${ctx.base}/farm/${m.id}/stock-in" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${ctx.csrfField}${ctx.backField}
            <label class="field"><span>Stok masuk (${U.h(m.unit)})</span><input name="qty" type="number" min="0.001" step="0.001" required></label>
            <label class="field"><span>Harga beli / ${U.h(m.unit)}</span><input name="unit_cost" type="number" min="0" step="100" value="${m.cost}"></label>
            <label class="field" style="grid-column:1/-1"><span>Catatan</span><input name="note" placeholder="mis. pembelian green bean panen Okt"></label>
            <div style="grid-column:1/-1"><button class="btn btn-primary btn-sm" type="submit">Tambah stok</button></div>
          </form>
          <form method="post" action="${ctx.base}/farm/${m.id}/adjust" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px">
            ${ctx.csrfField}${ctx.backField}
            <label class="field"><span>Stok fisik (${U.h(m.unit)})</span><input name="stock" type="number" min="0" step="0.001" value="${m.stock}"></label>
            <label class="field"><span>Stok minimum</span><input name="min_stock" type="number" min="0" step="0.001" value="${m.min_stock}"></label>
            <label class="field"><span>Harga satuan</span><input name="cost" type="number" min="0" step="100" value="${m.cost}"></label>
            <div style="grid-column:1/-1"><button class="btn btn-ghost btn-sm" type="submit">Simpan penyesuaian</button></div>
          </form>
        </div>
      </details>` : ''}
    </td>
  </tr>`).join('');

  const recipeRows = recipes.map((r) => `<tr>
    <td><span class="strong">${U.h(r.name)}</span><span class="sub-cell">${U.h(r.company_name)} · HPP ${U.idr(r.cost)}</span></td>
    <td>${r.items || '<span class="muted">Belum ada resep</span>'}</td>
    <td class="num">${U.pct(r.foodCost, 1)}</td>
    <td class="num">${U.pct(r.margin, 1)}</td>
  </tr>`).join('');

  const lowRows = summary.low.slice(0, 6).map((m) => `<div class="alert-row">
    <div class="alert-ico ${m.stock <= 0 ? 'bad' : 'warn'}">${L.icon('alert', 16)}</div>
    <div class="alert-text"><strong>${U.h(m.name)}</strong><span>${U.h(m.company_name)} · sisa ${U.num(m.stock, 2)} ${U.h(m.unit)} (min ${U.num(m.min_stock, 2)})</span></div>
  </div>`).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Nilai stok bahan', U.idrShort(summary.value), `${summary.count} jenis bahan`],
        ['Perlu restock', U.num(summary.low.length), 'di bawah stok minimum'],
        ['Bahan terpakai bulan ini', U.idrShort(usage.value), `${U.num(usage.count)} pemakaian tercatat`],
        ['Pemakaian roasted bean', U.num(usage.beanKg, 1) + ' kg', 'dari resep menu terjual'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    <div class="grid grid-side">
      ${L.card({ title: 'Stok bahan baku', subtitle: 'Green bean, roasted bean, susu, cup, dan kemasan' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Bahan</th><th>Entitas</th><th class="num">Stok</th><th class="num">Min</th><th class="num">Harga</th><th class="num">Nilai</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">${L.empty('Belum ada bahan baku')}</td></tr>`}</tbody>
        </table></div>`)}

      ${L.card({ title: 'Perlu restock', subtitle: 'Bahan di bawah ambang minimum' }, `
        ${lowRows || `<div class="alert-row"><div class="alert-ico good">${L.icon('check', 16)}</div><div class="alert-text"><strong>Semua stok aman</strong><span>Belum ada bahan di bawah stok minimum.</span></div></div>`}`)}
    </div>

    ${L.card({ title: 'Resep & food cost per menu', subtitle: 'HPP dihitung dari pemakaian bahan per porsi' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Menu / produk</th><th>Komposisi resep</th><th class="num">Food cost</th><th class="num">Margin</th></tr></thead>
        <tbody>${recipeRows || `<tr><td colspan="4">${L.empty('Belum ada resep')}</td></tr>`}</tbody>
      </table></div>`)}

    ${canWrite ? L.card({ title: 'Tambah bahan baku baru', subtitle: 'Bahan langsung bisa dipakai di resep menu' }, `
      <form method="post" action="${ctx.base}/farm/materials">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama bahan</span><input name="name" required placeholder="mis. Green Bean Toraja"></label>
          <label class="field"><span>Kategori</span>
            <select name="category">${Object.entries(CATEGORY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Satuan</span>
            <select name="unit"><option value="kg">kg</option><option value="gram">gram</option><option value="liter">liter</option><option value="ml">ml</option><option value="pcs">pcs</option></select>
          </label>
          <label class="field"><span>Harga / satuan (Rp)</span><input name="cost" type="number" min="0" step="100" required value="0"></label>
          <label class="field"><span>Stok awal</span><input name="stock" type="number" min="0" step="0.001" value="0"></label>
          <label class="field"><span>Stok minimum</span><input name="min_stock" type="number" min="0" step="0.001" value="0"></label>
          <label class="field"><span>Entitas</span>
            <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.selectedCompanyId === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
          </label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan bahan</button></div>
      </form>`) : ''}

    ${L.card({ title: 'Riwayat pergerakan stok', subtitle: 'Penerimaan, pemakaian dari penjualan, dan penyesuaian' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Waktu</th><th>Bahan</th><th>Entitas</th><th>Jenis</th><th class="num">Qty</th><th>Catatan</th></tr></thead>
        <tbody>${moves.map((m) => `<tr>
          <td class="muted">${U.h(m.occurred_at.slice(0, 16))}</td>
          <td class="strong">${U.h(m.material_name || '—')}</td>
          <td>${U.h(m.company_name)}</td>
          <td>${m.type === 'in' ? L.badge('Masuk', 'good') : m.type === 'out' ? L.badge('Pemakaian', 'warn') : L.badge('Penyesuaian', 'muted')}</td>
          <td class="num">${m.type === 'out' ? '−' : '+'}${U.num(Math.abs(m.qty), 2)} ${U.h(m.unit || '')}</td>
          <td class="muted">${U.h(m.note || '')}</td>
        </tr>`).join('') || `<tr><td colspan="6">${L.empty('Belum ada pergerakan stok')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Bahan Baku & Stok',
    subtitle: 'Dari green bean kebun sampai cup di tangan pelanggan',
    active: '/farm',
    toolbar: L.exportButton(ctx, 'stock', 'Ekspor Excel'),
    content: body,
  });
}

module.exports = { farmPage, CATEGORY_LABEL };
