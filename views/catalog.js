'use strict';

const U = require('../lib/util');
const PO = require('../lib/pos-options');
const L = require('./layout');
const { can } = require('../lib/auth');

function stars(rating, size = 14) {
  const full = Math.round(rating || 0);
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i <= full ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" style="color:${i <= full ? 'var(--amber-500)' : 'var(--border-strong)'}"><path d="m12 3 2.9 5.9 6.4.9-4.6 4.5 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.7 9.8l6.4-.9L12 3z"/></svg>`;
  }
  return out;
}

function catalogPage(ctx, data) {
  const { products, categories, filter, summary, canSeeCost } = data;
  // jenis menu yang dilacak stoknya mengikuti Master Data POS
  const stocked = new Set(PO.stockedKinds(ctx.db));

  const cards = products.map((p) => {
    const margin = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
    return `<article class="cat-card" data-product="${p.id}">
      <div class="cat-art tone-${Math.abs(p.id) % 5}${p.image_url && /^https?:\/\//i.test(p.image_url) ? ' has-image' : ''}">
        ${p.image_url && /^https?:\/\//i.test(p.image_url)
          ? `<img src="${U.h(p.image_url)}" alt="${U.h(p.name)}" loading="lazy">`
          : L.icon(p.kind === 'bean' ? 'box' : 'coffee', 26)}
        ${stocked.has(p.kind) ? '<span class="cat-flag">Stok produk jadi</span>' : ''}
      </div>
      <div class="cat-body">
        <span class="cat-cat">${U.h(p.category || 'Lainnya')}</span>
        <h3 class="cat-name">${U.h(p.name)}</h3>
        <div class="cat-rating">
          <span class="cat-stars">${stars(p.rating)}</span>
          <b>${p.rating ? U.num(p.rating, 1) : '—'}</b>
          <span class="hint-text">(${p.reviewCount} ulasan)</span>
        </div>
        <div class="cat-price-row">
          <strong>${U.idr(p.price)}</strong>
          ${p.price_grosir ? `<span class="hint-text">grosir ${U.idrShort(p.price_grosir)}</span>` : ''}
        </div>
        <div class="cat-meta">
          ${canSeeCost ? `<span>HPP ${U.idrShort(p.cost)} · margin ${U.pct(margin, 0)}</span>` : `<span>SKU ${U.h(p.sku)}</span>`}
          <span>${U.num(p.sold)} terjual</span>
        </div>
        <div class="chip-row">
          ${stocked.has(p.kind) ? L.badge('Stok ' + U.num(p.stock), p.stock > 10 ? 'good' : p.stock > 0 ? 'warn' : 'bad') : L.badge('Resep ' + p.recipeCount + ' bahan', 'muted')}
          ${p.rating >= 4.5 ? L.badge('Favorit', 'indigo') : ''}
          ${p.rating && p.rating < 4 ? L.badge('Perlu evaluasi', 'warn') : ''}
        </div>
        ${p.reviewSnippet ? `<p class="cat-review">“${U.h(p.reviewSnippet)}”</p>` : ''}
      </div>
    </article>`;
  }).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Total produk', U.num(summary.total), `${summary.menu} menu · ${summary.bean} biji kopi`],
        ['Rating rata-rata', summary.avgRating ? U.num(summary.avgRating, 2) + ' / 5' : '—', `${summary.reviews} ulasan pelanggan`],
        ['Kategori', U.num(categories.length), categories.slice(0, 3).join(', ')],
        ['Harga', `${U.idrShort(summary.minPrice)} – ${U.idrShort(summary.maxPrice)}`, 'rentang harga retail'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value" style="font-size:var(--fs-lg)">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Katalog produk', subtitle: `${products.length} produk ditampilkan` }, `
      <form method="get" action="${ctx.base}/catalog" class="cat-filters">
        ${ctx.selectedCompanyId ? `<input type="hidden" name="company" value="${ctx.selectedCompanyId}">` : ''}
        <input type="search" name="q" value="${U.h(filter.q)}" placeholder="Cari nama atau SKU…" aria-label="Cari produk">
        <select name="category" aria-label="Kategori">
          <option value="">Semua kategori</option>
          ${categories.map((c) => `<option value="${U.h(c)}" ${filter.category === c ? 'selected' : ''}>${U.h(c)}</option>`).join('')}
        </select>
        <label class="cat-range"><span>Harga</span>
          <input type="number" name="min" min="0" step="1000" value="${filter.min || ''}" placeholder="min">
          <span>–</span>
          <input type="number" name="max" min="0" step="1000" value="${filter.max || ''}" placeholder="maks">
        </label>
        <select name="rating" aria-label="Rating minimum">
          <option value="">Semua rating</option>
          ${[4.5, 4, 3.5, 3].map((r) => `<option value="${r}" ${String(filter.rating) === String(r) ? 'selected' : ''}>≥ ${String(r).replace('.', ',')} bintang</option>`).join('')}
        </select>
        <select name="sort" aria-label="Urutkan">
          <option value="popular" ${filter.sort === 'popular' ? 'selected' : ''}>Paling laris</option>
          <option value="rating" ${filter.sort === 'rating' ? 'selected' : ''}>Rating tertinggi</option>
          <option value="price_asc" ${filter.sort === 'price_asc' ? 'selected' : ''}>Harga termurah</option>
          <option value="price_desc" ${filter.sort === 'price_desc' ? 'selected' : ''}>Harga tertinggi</option>
          <option value="newest" ${filter.sort === 'newest' ? 'selected' : ''}>Terbaru</option>
        </select>
        <button class="btn btn-primary btn-sm" type="submit">Terapkan</button>
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/catalog">Reset</a>
      </form>
      <div class="cat-grid">${cards || L.empty('Tidak ada produk yang cocok', 'Coba longgarkan filter harga atau rating.')}</div>`)}
  `;

  return L.shell(ctx, {
    title: 'Katalog Produk',
    subtitle: 'Filter kategori, harga, dan rating pelanggan',
    active: '/catalog',
    content: body,
  });
}

module.exports = { catalogPage, stars };
