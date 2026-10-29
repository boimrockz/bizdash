'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');

const KIND_LABEL = {
  percent: 'Diskon persen',
  amount: 'Potongan nominal',
  bogo: 'Beli X gratis Y',
  bundle: 'Harga paket',
};


/**
 * Kolom form promo dipakai bersama oleh form "buat" dan "ubah" supaya
 * aturan validasi di server dan tampilan selalu konsisten.
 */
function promoFields(ctx, products, p = {}) {
  const today = U.todayISO();
  let bundleItems = [];
  try { bundleItems = JSON.parse(p.bundle_items || '[]'); } catch (err) { bundleItems = []; }
  const inBundle = new Map(bundleItems.map((i) => [Number(i.product_id), Number(i.qty) || 1]));
  return `
    <div class="form-grid cols-3">
      <label class="field"><span>Nama promo</span><input name="name" required value="${U.h(p.name || '')}" placeholder="mis. Promo Ngopi Pagi"></label>
      <label class="field"><span>Kode voucher (opsional)</span><input name="code" value="${U.h(p.code || '')}" placeholder="kosongkan = otomatis"></label>
      <label class="field"><span>Jenis promo</span>
        <select name="kind" data-promo-kind>
          ${Object.entries(KIND_LABEL).map(([k, v]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Nilai (% atau Rp)</span><input name="value" type="number" min="0" step="1000" value="${Number(p.value) || 0}"></label>
      <label class="field"><span>Maksimal diskon (Rp, 0 = tanpa batas)</span><input name="max_discount" type="number" min="0" step="1000" value="${Number(p.max_discount) || 0}"></label>
      <label class="field"><span>Minimum belanja (Rp)</span><input name="min_spend" type="number" min="0" step="1000" value="${Number(p.min_spend) || 0}"></label>
      <label class="field"><span>Berlaku untuk</span>
        <select name="customer_type">
          ${[['all', 'Semua pelanggan'], ['b2c', 'Hanya B2C'], ['b2b', 'Hanya B2B']].map(([k, v]) => `<option value="${k}" ${p.customer_type === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Khusus member</span>
        <select name="member_only">
          <option value="0" ${p.member_only ? '' : 'selected'}>Tidak</option>
          <option value="1" ${p.member_only ? 'selected' : ''}>Ya (harus terdaftar)</option>
        </select>
      </label>
      <label class="field"><span>Batas pemakaian (0 = tanpa batas)</span><input name="usage_limit" type="number" min="0" value="${Number(p.usage_limit) || 0}"></label>
      <label class="field"><span>Mulai</span><input name="start_date" type="date" value="${U.h((p.start_date || today).slice(0, 10))}"></label>
      <label class="field"><span>Berakhir</span><input name="end_date" type="date" value="${U.h((p.end_date || '2026-12-31').slice(0, 10))}"></label>
      <label class="field"><span>Entitas</span>
        <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${Number(p.company_id || ctx.selectedCompanyId) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
      </label>
    </div>

    <div class="promo-extra" data-kind="bogo" ${p.kind === 'bogo' ? '' : 'hidden'}>
      <p class="form-section">Aturan beli X gratis Y</p>
      <div class="form-grid cols-3">
        <label class="field"><span>Produk yang dibeli</span>
          <select name="buy_product_id">${products.map((x) => `<option value="${x.id}" ${Number(p.buy_product_id) === x.id ? 'selected' : ''}>${U.h(x.name)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Jumlah dibeli</span><input name="buy_qty" type="number" min="1" value="${Number(p.buy_qty) || 1}"></label>
        <label class="field"><span>Produk bonus</span>
          <select name="get_product_id">${products.map((x) => `<option value="${x.id}" ${Number(p.get_product_id) === x.id ? 'selected' : ''}>${U.h(x.name)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Jumlah bonus</span><input name="get_qty" type="number" min="1" value="${Number(p.get_qty) || 1}"></label>
      </div>
    </div>

    <div class="promo-extra" data-kind="bundle" ${p.kind === 'bundle' ? '' : 'hidden'}>
      <p class="form-section">Isi paket & harga paket</p>
      <div class="bundle-grid">
        ${products.map((x) => `<label class="bundle-item">
          <input type="checkbox" name="bundle_product" value="${x.id}" ${inBundle.has(x.id) ? 'checked' : ''}>
          <span>${U.h(x.name)}</span>
          <input type="number" name="bundle_qty_${x.id}" min="1" value="${inBundle.get(x.id) || 1}" aria-label="qty">
        </label>`).join('')}
      </div>
      <label class="field" style="max-width:240px;margin-top:10px"><span>Harga paket (Rp)</span>
        <input name="bundle_price" type="number" min="0" step="1000" value="${Number(p.bundle_price) || 0}">
      </label>
    </div>`;
}

const IMAGE_FORMS = (ctx, p) => `
  <form method="post" action="${ctx.base}/promos/${p.id}/image" enctype="multipart/form-data" class="promo-image-form">
    ${ctx.csrfField}${ctx.backField}
    <div class="promo-image-preview">${p.image_url && /^https?:\/\//i.test(p.image_url)
      ? `<img src="${U.h(p.image_url)}" alt="">`
      : `<span class="promo-image-empty">${L.icon('gift', 18)}</span>`}</div>
    <div class="promo-image-fields">
      <label class="field"><span>Gambar promo / paket</span><input type="file" name="image" accept="image/*"></label>
      <label class="field"><span>atau URL gambar</span><input name="image_url" placeholder="https://…" value="${U.h(p.image_url && /^https?:\/\//i.test(p.image_url) ? p.image_url : '')}"></label>
      <div class="form-actions">
        <button class="btn btn-primary btn-sm" type="submit">Simpan gambar</button>
        ${p.image_url ? `<button class="btn btn-ghost btn-sm" type="submit" name="remove" value="1">Hapus</button>` : ''}
      </div>
    </div>
  </form>`;

function promosPage(ctx, data) {
  const { promos, products, impact } = data;
  const canWrite = can(ctx.user, 'promo_write');
  const today = U.todayISO();

  const cards = promos.map((p) => {
    let items = [];
    try { items = JSON.parse(p.bundle_items || '[]'); } catch (err) { items = []; }
    const bundleText = items.map((i) => {
      const prod = products.find((x) => x.id === i.product_id);
      return `${i.qty}× ${prod ? prod.name : 'produk dihapus'}`;
    }).join(' + ');
    const buy = products.find((x) => x.id === p.buy_product_id);
    const get = products.find((x) => x.id === p.get_product_id);
    const active = p.active && (!p.start_date || p.start_date <= today) && (!p.end_date || p.end_date >= today)
      && (p.usage_limit === 0 || p.used_count < p.usage_limit);

    const rule = p.kind === 'percent' ? `${U.num(p.value, 0)}%${p.max_discount ? ` (maks ${U.idrShort(p.max_discount)})` : ''}`
      : p.kind === 'amount' ? `Potongan ${U.idr(p.value)}`
        : p.kind === 'bogo' ? `Beli ${U.num(p.buy_qty, 0)} ${buy ? buy.name : ''} gratis ${U.num(p.get_qty, 0)} ${get ? get.name : ''}`
          : `Paket ${bundleText} → ${U.idr(p.bundle_price)}`;

    return `<article class="promo-card ${active ? '' : 'is-off'}" data-promo="${p.id}">
      ${p.image_url && /^https?:\/\//i.test(p.image_url)
        ? `<div class="promo-thumb"><img src="${U.h(p.image_url)}" alt="" loading="lazy"></div>`
        : ''}
      <header>
        <div>
          <div class="promo-code">${p.code ? U.h(p.code) : '<span class="badge badge-indigo">Otomatis</span>'}</div>
          <h3>${U.h(p.name)}</h3>
        </div>
        ${active ? L.badge('Aktif', 'good') : L.badge('Tidak aktif', 'muted')}
      </header>
      <p class="promo-rule">${U.h(rule)}</p>
      <div class="chip-row">
        ${L.badge(KIND_LABEL[p.kind] || p.kind, 'indigo')}
        ${p.min_spend ? L.badge('Min ' + U.idrShort(p.min_spend), 'muted') : ''}
        ${p.member_only ? L.badge('Khusus member', 'warn') : ''}
        ${p.customer_type !== 'all' ? L.badge(p.customer_type === 'b2b' ? 'Hanya B2B' : 'Hanya B2C', 'muted') : ''}
      </div>
      <div class="promo-meta">
        <span>${U.h(p.company_name)}</span>
        <span>${p.start_date ? U.h(p.start_date) : '—'} s/d ${p.end_date ? U.h(p.end_date) : '—'}</span>
        <span>Terpakai ${U.num(p.used_count)}${p.usage_limit ? ' / ' + U.num(p.usage_limit) : ''}</span>
      </div>
      ${canWrite ? `<div class="promo-actions">
        <details class="promo-edit">
          <summary class="btn btn-ghost btn-sm">Ubah</summary>
          <div class="promo-edit-body">
            ${IMAGE_FORMS(ctx, p)}
            <form method="post" action="${ctx.base}/promos/save">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="id" value="${p.id}">
              ${promoFields(ctx, products, p)}
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan perubahan</button></div>
            </form>
          </div>
        </details>
        <form method="post" action="${ctx.base}/promos/${p.id}/toggle">
          ${ctx.csrfField}${ctx.backField}
          <button class="btn ${p.active ? 'btn-ghost' : 'btn-primary'} btn-sm" type="submit">${p.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        </form>
        <form method="post" action="${ctx.base}/promos/${p.id}/delete" data-confirm="Hapus promo ${U.h(p.name)}?">
          ${ctx.csrfField}${ctx.backField}
          <button class="btn btn-danger btn-sm" type="submit">Hapus</button>
        </form>
      </div>` : ''}
    </article>`;
  }).join('');

  const impactRows = impact.map((r) => `<tr>
    <td>${U.h(r.label)}</td>
    <td class="num">${U.num(r.n)}</td>
    <td class="num">${U.idr(r.revenue)}</td>
    <td class="num" style="color:var(--bad)">− ${U.idr(r.discount)}</td>
    <td class="num">${U.pct(r.revenue ? (r.discount / r.revenue) * 100 : 0)}</td>
  </tr>`).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Promo aktif', U.num(promos.filter((p) => p.active).length), `dari ${promos.length} promo`],
        ['Nota pakai promo', U.num(impact.reduce((a, r) => a + r.n, 0)), U.monthLabel(ctx.month)],
        ['Diskon diberikan', U.idrShort(impact.reduce((a, r) => a + r.discount, 0)), 'bulan berjalan'],
        ['Voucher beredar', U.num(promos.filter((p) => p.code).length), 'promo berbasis kode'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Dampak promo bulan ini', subtitle: 'Promo mana yang paling banyak dipakai dan berapa diskonnya' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Promo</th><th class="num">Nota</th><th class="num">Penjualan</th><th class="num">Diskon</th><th class="num">% dari penjualan</th></tr></thead>
        <tbody>${impactRows || `<tr><td colspan="5">${L.empty('Belum ada transaksi memakai promo bulan ini')}</td></tr>`}</tbody>
      </table></div>`)}

    <div class="section-title"><h2>Daftar promo</h2><span class="hint">Promo tanpa kode otomatis dipilih sistem saat paling menguntungkan</span></div>
    <div class="promo-grid">${cards || L.card({}, L.empty('Belum ada promo', 'Buat promo pertama di bawah.'))}</div>

    ${canWrite ? L.card({ title: 'Buat promo baru', subtitle: 'Diskon, voucher, beli 1 gratis 1, paket hemat, atau khusus member' }, `
      <form method="post" action="${ctx.base}/promos/save" id="promo-form">
        ${ctx.csrfField}${ctx.backField}
        ${promoFields(ctx, products, {})}
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('gift', 15)} Simpan promo</button></div>
      </form>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'Promo & Voucher',
    subtitle: 'Diskon, voucher, bundling, BOGO, dan promo khusus member',
    active: '/promos',
    content: body,
  });
}

module.exports = { promosPage, KIND_LABEL };
