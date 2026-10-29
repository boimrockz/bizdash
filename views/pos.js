'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const { POINT_VALUE, POINT_EARN_PER, recipeCost } = require('../lib/pos-engine');
const { receiptCard } = require('./receipt');
const PO = require('../lib/pos-options');

// Label bawaan hanya dipakai sebagai cadangan; sumber utamanya Master Data POS
// (Settings → Master Data POS) sehingga nama bisa diubah pemilik.
const PAY_LABEL = { cash: 'Tunai', qris: 'QRIS', debit: 'Debit/Kredit', transfer: 'Transfer' };
const CHANNEL_LABEL = { walkin: 'Walk-in', b2c: 'Member B2C', b2b: 'B2B' };
const TIER_LABEL = { retail: 'Retail', grosir: 'Grosir', distributor: 'Distributor' };

function labelsFor(db, kind, fallback) {
  return { ...(fallback || {}), ...PO.labelMap(db, kind) };
}

function outletOptions(outlets, selected) {
  return outlets.map((c) => `<option value="${c.id}" ${Number(selected) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('');
}

function customerOptions(customers, selected, outletId) {
  const walkin = `<option value="">Walk-in (tanpa member)</option>`;
  const b2c = customers.filter((c) => c.type === 'b2c');
  const b2b = customers.filter((c) => c.type === 'b2b');
  const row = (c) => `<option value="${c.id}" data-type="${c.type}" data-tier="${U.h(c.price_tier)}" data-points="${c.points}"${Number(selected) === c.id ? ' selected' : ''}>${U.h(c.name)}${c.points ? ` · ${U.num(c.points)} poin` : ''}</option>`;
  return `${walkin}
    <optgroup label="Member B2C (${b2c.length})">${b2c.map(row).join('')}</optgroup>
    <optgroup label="Pelanggan B2B (${b2b.length})">${b2b.map((c) => `<option value="${c.id}" data-type="b2b" data-tier="${U.h(c.price_tier)}" data-points="${c.points}"${Number(selected) === c.id ? ' selected' : ''}>${U.h(c.company_name || c.name)} · ${U.h(TIER_LABEL[c.price_tier] || c.price_tier)}</option>`).join('')}</optgroup>`;
}

function categoryIcon(cat, icons) {
  const key = String(cat || '');
  if (icons && icons[key]) return icons[key];
  const c = key.toLowerCase();
  if (c.includes('signature')) return 'coffee';
  if (c.includes('manual')) return 'sprinkle';
  if (c.includes('biji')) return 'box';
  if (c.includes('makan') || c.includes('pastry')) return 'layers';
  if (c.includes('merch')) return 'gift';
  if (c.includes('non')) return 'cart';
  return 'cart';
}

function posPage(ctx, data) {
  const {
    products, customers, saleCompanyId, outlets, promos, today, productHpp,
    qrisMode = { live: false, enforced: false, provider: 'static', merchant: '', hint: '' },
    receipt = { width: 58, auto: false, last: null },
  } = data;
  const canCreateMember = can(ctx.user, 'customer_write');
  const qrisReady = !!qrisMode.live;
  const catIcons = PO.iconMap(ctx.db, 'category');
  const catOptions = PO.activeRows(ctx.db, 'category');
  // kategori aktif dari pengaturan + kategori lama yang masih dipakai produk
  const categories = [
    ...catOptions.map((c) => c.code),
    ...[...new Set(products.map((p) => p.category).filter(Boolean))].filter(
      (c) => !catOptions.some((o) => o.code === c),
    ).sort(),
  ];
  const payMethods = PO.activeRows(ctx.db, 'payment_method');
  const defaultPay = payMethods.some((m) => m.code === 'qris') ? 'qris' : (payMethods[0] || {}).code || 'cash';

  const tile = (p) => {
    const hpp = productHpp.get(p.id) || p.cost;
    const margin = p.price ? ((p.price - hpp) / p.price) * 100 : 0;
    return `<button type="button" class="tile" data-add-product="${p.id}" data-name="${U.h(p.name)}" data-sku="${U.h(p.sku)}"
      data-cat="${U.h(p.category || '')}" data-price="${p.price}" data-grosir="${p.price_grosir || 0}" data-distributor="${p.price_distributor || 0}">
      <span class="tile-art tone-${Math.abs(Number(p.id)) % 5}">${p.image_url && /^https?:\/\//i.test(p.image_url)
        ? `<img src="${U.h(p.image_url)}" alt="" loading="lazy">`
        : L.icon(categoryIcon(p.category), 22)}</span>
      <span class="tile-body">
        <span class="tile-name">${U.h(p.name)}</span>
        <span class="tile-meta">${U.h(p.sku)} · HPP ${U.idrShort(hpp)} · margin ${U.pct(margin, 0)}</span>
      </span>
      <span class="tile-price">
        <strong data-price-label>${U.idr(p.price)}</strong>
        ${p.price_grosir ? `<em>G ${U.idrShort(p.price_grosir)} · D ${U.idrShort(p.price_distributor)}</em>` : ''}
      </span>
    </button>`;
  };

  const railItems = [`<button type="button" class="rail-item is-active" data-rail="">
      <span class="rail-ico">${L.icon('grid', 20)}</span><span>Semua</span>
    </button>`]
    .concat(categories.map((c) => {
      const opt = catOptions.find((o) => o.code === c);
      return `<button type="button" class="rail-item" data-rail="${U.h(c)}">
      <span class="rail-ico">${L.icon(categoryIcon(c, catIcons), 20)}</span><span>${U.h(opt ? opt.label : c)}</span>
    </button>`;
    })).join('');

  // ---- Info promo yang berlaku untuk outlet ini (dibaca kasir sebelum menawarkan) ----
  const promoPill = (p) => `<span class="promo-pill"><b>${U.h(p.codeLabel)}</b>${U.h(p.kindLabel)} ${U.h(p.valueText)}${p.memberOnly ? ' · member' : ''}</span>`;
  const promoStrip = promos.slice(0, 6).map(promoPill).join('');
  const promoRows = promos.map((p) => {
    const notes = [];
    if (p.minSpend > 0) notes.push(`min. belanja ${U.idr(p.minSpend)}`);
    if (p.memberOnly) notes.push('khusus member');
    if (p.customerType === 'b2c' || p.customerType === 'b2b') notes.push(p.customerTypeLabel.toLowerCase());
    if (p.items.length) notes.push(p.items.join(', '));
    const quota = p.remaining === null ? 'kuota tak terbatas'
      : p.lowQuota ? `sisa ${U.num(p.remaining)} pemakaian` : `sisa ${U.num(p.remaining)} dari ${U.num(p.usage_limit)}`;
    return `<li class="promo-row" data-promo-id="${p.id}" data-promo-kind="${U.h(p.kind)}">
      <div class="promo-row-main">
        <span class="promo-row-name">${U.h(p.name)}</span>
        <span class="promo-row-tags">
          ${L.badge(p.codeLabel, p.code ? 'indigo' : 'muted')}
          ${L.badge(`${p.kindLabel} ${p.valueText}`, 'good')}
          ${p.memberOnly ? L.badge('Member', 'warn') : ''}
          ${p.fromParent ? L.badge('Dari ' + p.companyLabel, 'muted') : ''}
          ${p.endingSoon ? L.badge(`Berakhir ${p.endsIn === 0 ? 'hari ini' : p.endsIn + ' hari lagi'}`, 'bad') : ''}
        </span>
      </div>
      <div class="promo-row-meta">
        <span>${L.icon('clock', 12)} ${U.h(p.periodLabel)}</span>
        <span>${L.icon('gauge', 12)} ${U.h(quota)}</span>
        <span>${L.icon('check', 12)} ${U.h(notes.length ? notes.join(' · ') : 'tanpa syarat tambahan')}</span>
      </div>
    </li>`;
  }).join('');

  const promoPanel = promos.length ? `<section class="promo-panel" data-promo-panel aria-label="Promo yang berlaku">
      <div class="promo-panel-head">
        <span class="promo-panel-title">${L.icon('gift', 16)} Promo berlaku <b>${U.num(promos.length)}</b></span>
        <span class="promo-panel-sub">Ketik kode di keranjang, atau biarkan sistem memilih promo otomatis terbaik.</span>
      </div>
      <div class="promo-strip">${promoStrip}</div>
      <details class="disclosure promo-panel-more">
        <summary>${L.icon('receipt', 14)} Rincian syarat &amp; masa berlaku</summary>
        <div class="disc-body">
          <ul class="promo-list">${promoRows}</ul>
        </div>
      </details>
    </section>` : `<p class="promo-empty hint-text" data-promo-empty>${L.icon('gift', 14)} Tidak ada promo yang berlaku untuk outlet ini hari ini.</p>`;

  // Paket bundling tampil sebagai kartu sendiri (gambar + harga paket).
  const bundles = promos.filter((p) => p.kind === 'bundle' && p.bundle_price > 0);
  const bundleTiles = bundles.map((p) => {
    let items = [];
    try { items = JSON.parse(p.bundle_items || '[]'); } catch (err) { items = []; }
    const detail = items.map((i) => {
      const prod = products.find((x) => x.id === i.product_id);
      return prod ? `${i.qty}× ${prod.name}` : '';
    }).filter(Boolean).join(' + ');
    const payload = U.h(JSON.stringify(items.map((i) => ({ id: i.product_id, qty: Math.max(1, Number(i.qty) || 1) }))));
    return `<button type="button" class="bundle-tile" data-bundle='${payload}' data-bundle-code="${U.h(p.code || '')}"
      data-bundle-name="${U.h(p.name)}" data-bundle-price="${p.bundle_price}" data-cat="Paket">
      <span class="bundle-art">${p.image_url && /^https?:\/\//i.test(p.image_url)
        ? `<img src="${U.h(p.image_url)}" alt="" loading="lazy">`
        : L.icon('gift', 22)}</span>
      <span class="bundle-body">
        <span class="bundle-name">${U.h(p.name)}</span>
        <span class="bundle-detail">${U.h(detail)}</span>
      </span>
      <span class="bundle-price">${U.idr(p.bundle_price)}</span>
    </button>`;
  }).join('');

  const receiptBlock = receipt && receipt.lastTicket
    ? receiptCard(ctx, { ticket: receipt.lastTicket, lines: receipt.lastLines || [] })
    : '';

  const body = `
    ${receiptBlock}
    <div class="pos-shell" id="pos"
      data-point-value="${POINT_VALUE}" data-point-earn="${POINT_EARN_PER}"
      data-quote-url="${ctx.base}/pos/quote"
      data-qris-create="${ctx.base}/pos/qris"
      data-qris-status="${ctx.base}/pos/qris/__REF__"
      data-qris-ready="${qrisReady ? '1' : '0'}"
      data-qris-enforced="${qrisMode.enforced ? '1' : '0'}"
      data-qris-provider="${U.h(qrisMode.provider)}"
      data-ticket-url="${ctx.base}/pos/sales/__ID__/ticket"
      data-receipt-width="${Number(receipt.width) || 58}"
      data-receipt-auto="${receipt.auto ? '1' : '0'}"
      data-last-sale="${receipt.last ? Number(receipt.last) : ''}">
      <aside class="pos-rail">
        <div class="rail-brand">${L.icon('coffee', 22)}<span>${U.h(ctx.companyName(saleCompanyId))}</span></div>
        ${railItems}
        <div class="rail-foot">
          <span>${U.num(products.length)} item</span>
          <em>${U.h(U.dateLabel(today))}</em>
        </div>
      </aside>

      <section class="pos-main">
        <div class="pos-head">
          <a class="pos-back" href="${ctx.base}/" aria-label="Kembali ke beranda">${L.icon('grid', 18)}<span>Beranda</span></a>
          <label class="pos-search">
            ${L.icon('grid', 18)}
            <input id="pos-search" type="search" placeholder="Cari menu, biji kopi, atau SKU…" aria-label="Cari produk">
          </label>
          <select id="pos-category" class="pos-cat-select" aria-label="Kategori">
            <option value="">Semua kategori</option>
            ${categories.map((c) => {
              const opt = catOptions.find((o) => o.code === c);
              return `<option value="${U.h(c)}">${U.h(opt ? opt.label : c)}</option>`;
            }).join('')}
          </select>
          <label class="pos-outlet">
            <span>Outlet</span>
            <select name="company_id" form="pos-form">${outletOptions(outlets, saleCompanyId)}</select>
          </label>
        </div>
        ${promoPanel}
        ${bundleTiles ? `<div class="bundle-strip"><span class="bundle-strip-label">${L.icon('gift', 15)} Paket hemat</span>
          <div class="bundle-row">${bundleTiles}</div></div>` : ''}
        <div class="tile-grid" id="pos-grid">${products.map(tile).join('') || L.empty('Belum ada produk untuk outlet ini')}</div>
      </section>

      <aside class="pos-cart" id="pos-cart">
        <header class="cart-head">
          <div>
            <p class="cart-eyebrow">Pesanan baru</p>
            <h2><span id="cart-count">0</span> item</h2>
          </div>
          <div class="cart-head-side">
            <button class="printer-chip" type="button" data-printer-open title="Printer struk Bluetooth">
              ${L.icon('printer', 15)}<span data-printer-chip-label>Printer</span>
            </button>
            <span class="cart-outlet">${U.h(ctx.companyName(saleCompanyId))}</span>
          </div>
        </header>

        <form method="post" action="${ctx.base}/pos/checkout" id="pos-form" class="cart-form">
          ${ctx.csrfField}${ctx.backField}

          <label class="cart-field">
            <span>Pelanggan</span>
            <select name="customer_id" id="pos-customer">${customerOptions(customers, data.selectedCustomerId || null, saleCompanyId)}</select>
          </label>
          <div class="customer-badge" id="customer-badge" hidden></div>

          <div class="cart-scroll">
            <div class="cart-lines" id="cart-lines"></div>
            <div class="cart-empty" id="cart-empty">
              ${L.icon('cart', 26)}
              <p>Keranjang masih kosong</p>
              <span>Ketuk menu di kiri untuk menambah pesanan.</span>
            </div>
          </div>

          <div class="cart-totals">
            <div class="cart-row"><span>Subtotal</span><strong id="cart-subtotal">Rp 0</strong></div>
            <div class="cart-row cart-row-input">
              <span>Kode promo</span>
              <span class="inline-input">
                <input id="promo-code" name="promo_code" type="text" placeholder="mis. NGOPI10" autocomplete="off">
                <button class="btn btn-ghost btn-sm" type="button" id="promo-clear">↺</button>
              </span>
            </div>
            <div class="cart-row"><span>Diskon promo</span><strong id="cart-promo">− Rp 0</strong></div>
            <div class="cart-row cart-row-input">
              <span>Tukar poin</span>
              <span class="inline-input">
                <input id="points-input" name="points" type="number" min="0" step="10" value="0" disabled>
                <button class="btn btn-ghost btn-sm" type="button" id="points-max" disabled>Max</button>
              </span>
            </div>
            <div class="cart-row"><span>Nilai poin</span><strong id="cart-points">− Rp 0</strong></div>
            <div class="quote-note" id="quote-note" hidden></div>
            <div class="cart-row" id="earn-row" hidden><span>Poin didapat</span><strong id="cart-earn">0 poin</strong></div>
          </div>

          <div class="cart-pay">
            <div class="pay-total"><span>Total</span><strong id="cart-total">Rp 0</strong></div>
            <div class="pay-options">
              ${payMethods.map((m) => `<label class="pay-chip"><input type="radio" name="payment_method" value="${U.h(m.code)}" ${m.code === defaultPay ? 'checked' : ''}><span>${U.h(m.label)}</span></label>`).join('')}
              ${payMethods.length ? '' : '<span class="hint-text">Belum ada metode bayar aktif — atur di Pengaturan → Master Data POS.</span>'}
            </div>
            <input type="hidden" name="qris_ref" id="qris-ref-input" value="">
            <div class="qris-note ${qrisReady ? 'is-ready' : 'is-off'}" id="qris-note">
              ${L.icon(qrisReady ? 'check' : 'alert', 14)}
              <span>${qrisReady
                ? (qrisMode.enforced
                  ? `QRIS aktif${qrisMode.merchant ? ' · ' + U.h(qrisMode.merchant) : ''} — QR dibuat otomatis saat menekan Bayar.`
                  : 'QRIS siap — verifikasi QRIS opsional untuk transaksi ini.')
                : 'QRIS belum diatur. Buka Pengaturan → Kasir, QRIS & Struk.'}</span>
            </div>
            <label class="cart-field compact">
              <span>Catatan</span>
              <input name="note" type="text" placeholder="mis. nama pelanggan / no. meja">
            </label>
            <input type="hidden" name="items" id="cart-payload" value="[]">
            <button class="btn btn-primary btn-pay" type="submit" id="checkout-btn" disabled>
              ${L.icon('check', 18)} Bayar &amp; simpan
            </button>
          </div>
        </form>

        ${canCreateMember ? `<details class="disclosure cart-newmember">
          <summary>${L.icon('plus', 15)} Daftarkan member baru</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/members/save">
              ${ctx.csrfField}${ctx.backField}
              <div class="form-grid" style="gap:8px">
                <label class="field"><span>Nama</span><input name="name" required placeholder="Nama pelanggan"></label>
                <label class="field"><span>No. HP</span><input name="phone" placeholder="08xx"></label>
                <label class="field"><span>Tipe</span>
                  <select name="type"><option value="b2c">Member B2C</option><option value="b2b">Pelanggan B2B</option></select>
                </label>
                <label class="field"><span>Entitas</span>
                  <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${c.id === saleCompanyId ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
                </label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan member</button></div>
            </form>
          </div>
        </details>` : ''}
      </aside>
      <div class="pos-cartbar" aria-hidden="false">
        <button class="pos-cartbar-btn" type="button" data-cart-jump>
          <span class="pos-cartbar-ico">${L.icon('cart', 18)}<b id="pos-cartbar-count">0</b></span>
          <span class="pos-cartbar-copy"><small>Total pesanan</small><strong id="pos-cartbar-total">Rp 0</strong></span>
          <span class="pos-cartbar-go">Lihat keranjang ${L.icon('arrowRight', 15)}</span>
        </button>
      </div>
    </div>

    <div class="pos-modal-scrim" data-modal-close hidden></div>

    <section class="pos-modal" id="qris-modal" role="dialog" aria-modal="true" aria-labelledby="qris-title" hidden>
      <header class="pos-modal-head">
        <div>
          <p class="cart-eyebrow">Pembayaran QRIS</p>
          <h3 id="qris-title">Pindai QR dengan aplikasi bank / e-wallet</h3>
        </div>
        <button class="btn btn-ghost btn-icon" type="button" data-qris-cancel aria-label="Tutup">${L.icon('plus', 18)}</button>
      </header>
      <div class="pos-modal-body qris-body">
        <div class="qris-amount"><span>Nominal</span><strong id="qris-amount">Rp 0</strong></div>
        <div class="qris-frame">
          <img id="qris-image" alt="QR QRIS pembayaran" width="252" height="252" hidden>
          <div class="qris-loading" id="qris-loading">${L.icon('clock', 22)}<span>Menyiapkan QR…</span></div>
        </div>
        <p class="qris-meta">
          <span>Ref <b id="qris-modal-ref">—</b></span>
          <span id="qris-status-label">Menunggu pembayaran</span>
          <span id="qris-countdown">—</span>
        </p>
        <p class="qris-error" id="qris-error" hidden></p>
        <div class="pos-modal-actions">
          <button class="btn btn-ghost" type="button" data-qris-cancel>Batalkan</button>
          <button class="btn btn-primary" type="button" id="qris-mark-paid" hidden>${L.icon('check', 16)} Sudah dibayar</button>
        </div>
        <p class="hint-text" id="qris-hint">
          ${qrisMode.provider === 'static'
            ? 'Mode QRIS statis: pastikan notifikasi pembayaran masuk di HP kasir, lalu tekan “Sudah dibayar”.'
            : 'Status pembayaran diperiksa otomatis dari gateway setiap beberapa detik.'}
        </p>
      </div>
    </section>

    <section class="pos-modal" id="printer-modal" role="dialog" aria-modal="true" aria-labelledby="printer-title" hidden>
      <header class="pos-modal-head">
        <div>
          <p class="cart-eyebrow">Printer struk</p>
          <h3 id="printer-title">Printer thermal Bluetooth</h3>
        </div>
        <button class="btn btn-ghost btn-icon" type="button" data-modal-close aria-label="Tutup">${L.icon('plus', 18)}</button>
      </header>
      <div class="pos-modal-body">
        <div class="printer-state" data-printer-state>
          <span class="printer-dot"></span>
          <div>
            <strong data-printer-name>Printer belum terhubung</strong>
            <small data-printer-hint>Hubungkan printer ESC/POS 58/80 mm.</small>
          </div>
        </div>
        <div class="receipt-tool-grid">
          <button class="btn btn-primary btn-sm" type="button" data-printer-connect>${L.icon('printer', 15)} Hubungkan printer</button>
          <button class="btn btn-ghost btn-sm" type="button" data-printer-disconnect>Putuskan</button>
          <button class="btn btn-ghost btn-sm" type="button" data-printer-test>Tes cetak</button>
        </div>
        <div class="form-grid" style="gap:10px">
          <label class="field"><span>Lebar kertas</span>
            <select data-receipt-width-select>
              <option value="58" ${Number(receipt.width) === 80 ? '' : 'selected'}>58 mm (32 karakter)</option>
              <option value="80" ${Number(receipt.width) === 80 ? 'selected' : ''}>80 mm (48 karakter)</option>
            </select>
          </label>
          <label class="field"><span>Ukuran kiriman BLE</span>
            <select data-printer-chunk>
              <option value="100">Aman (100 byte)</option>
              <option value="180">Cepat (180 byte)</option>
              <option value="20">Kompatibel (20 byte)</option>
            </select>
          </label>
        </div>
        <label class="checkline"><input type="checkbox" data-receipt-auto ${receipt.auto ? 'checked' : ''}> Cetak otomatis setiap transaksi selesai</label>
        <label class="checkline"><input type="checkbox" data-receipt-qr ${receipt.printQris === false ? '' : 'checked'}> Sertakan QR QRIS di struk</label>
        <p class="hint-text" data-printer-error hidden></p>
        <p class="hint-text">
          Web Bluetooth tersedia di Chrome (Android/desktop). iPhone/Safari: gunakan
          <b>Cetak via browser</b> di halaman struk (AirPrint) atau kirim struk lewat WhatsApp.
        </p>
        <div class="pos-modal-actions">
          <a class="btn btn-ghost btn-sm" href="${ctx.base}/settings/pos">${L.icon('settings', 15)} Pengaturan struk</a>
          <button class="btn btn-primary btn-sm" type="button" data-modal-close>Simpan &amp; tutup</button>
        </div>
      </div>
    </section>`;

  return L.shell(ctx, {
    title: 'Kasir (POS)',
    subtitle: `${U.h(ctx.companyName(saleCompanyId))} · ${U.dateLabel(today)}`,
    active: '/pos',
    content: body,
    bodyClass: 'pos-mode',
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.link('/pos/sales')}">${L.icon('receipt', 15)} Riwayat</a>`,
  });
}

function salesPage(ctx, data) {
  const { sales, summary } = data;
  const payLabels = labelsFor(ctx.db, 'payment_method', PAY_LABEL);
  const tierLabels = labelsFor(ctx.db, 'price_tier', TIER_LABEL);
  const channelLabels = labelsFor(ctx.db, 'channel', CHANNEL_LABEL);
  const rows = sales.map((s) => `<tr>
    <td><span class="strong">${U.h(s.invoice_no)}</span><span class="sub-cell">${U.h(s.item_count || 0)} item · ${U.h(payLabels[s.payment_method] || s.payment_method)}</span></td>
    <td>${U.h(s.sold_at.slice(0, 16))}</td>
    <td>${U.h(s.company)}</td>
    <td>${s.customer_name ? `<span class="strong">${U.h(s.customer_name)}</span><span class="sub-cell">${U.h(channelLabels[s.channel] || s.channel)}${s.price_tier && s.price_tier !== 'retail' ? ' · ' + U.h(tierLabels[s.price_tier] || s.price_tier) : ''}</span>` : `<span class="muted">Walk-in</span>`}</td>
    <td class="num">${U.idr(s.subtotal)}</td>
    <td class="num">${s.promo_discount ? `− ${U.idr(s.promo_discount)}${s.promo_label ? `<span class="sub-cell">${U.h(s.promo_label)}</span>` : ''}` : '—'}</td>
    <td class="num">${s.points_used ? `<span class="sub-cell">${U.num(s.points_used)} poin</span>` : '—'}</td>
    <td class="num strong">${U.idr(s.total)}</td>
    <td>${s.status === 'void' ? L.badge('Void', 'bad') : L.badge(s.source === 'import' ? 'Import' : 'POS', s.source === 'import' ? 'indigo' : 'good')}</td>
    <td class="num">
      <a class="btn btn-ghost btn-sm" href="${ctx.base}/pos/sales/${s.id}/struk">${L.icon('printer', 14)} Struk</a>
      ${s.status === 'paid' && data.canVoid ? `<form method="post" action="${ctx.base}/pos/sales/${s.id}/void" data-confirm="Batalkan transaksi ${U.h(s.invoice_no)}? Stok bahan & poin akan dikembalikan." style="display:inline">
      ${ctx.csrfField}${ctx.backField}
      <button class="btn btn-danger btn-sm" type="submit">Void</button>
    </form>` : ''}
    </td>
  </tr>`).join('');

  const stats = [
    ['Total penjualan', U.idr(summary.revenue), `${summary.count} nota`],
    ['Rata-rata / nota', U.idr(summary.avg), 'per transaksi'],
    ['Transaksi member', U.num(summary.memberCount), summary.share + ' dari nilai penjualan'],
    ['Diskon & promo', U.idr(summary.promo), `${summary.promoCount} nota memakai promo`],
  ];

  const body = `
    <div class="grid grid-4">
      ${stats.map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Riwayat transaksi', subtitle: `${U.monthLabel(ctx.month)} · ${ctx.scopeCompany ? ctx.scopeCompany.name : 'konsolidasi'} · maks. 150 terbaru` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Invoice</th><th>Waktu</th><th>Outlet</th><th>Pelanggan</th><th class="num">Subtotal</th><th class="num">Promo</th><th class="num">Poin</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10">${L.empty('Belum ada transaksi pada periode ini')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Riwayat Transaksi',
    subtitle: `${U.monthLabel(ctx.month)} · ${summary.count} nota`,
    active: '/pos/sales',
    content: body,
    toolbar: `${L.exportButton(ctx, 'sales')}<a class="btn btn-primary btn-sm" href="${ctx.link('/pos')}">${L.icon('plus', 15)} Transaksi baru</a>`,
  });
}

function productsPage(ctx, data) {
  const { products, materials } = data;
  const canWrite = can(ctx.user, 'pos_write');
  const materialNames = [...new Set(materials.map((m) => m.name))].sort();
  const menuTypes = PO.activeRows(ctx.db, 'menu_type');
  const kindLabels = PO.labelMap(ctx.db, 'menu_type');
  const catIcons = PO.iconMap(ctx.db, 'category');
  const cats = PO.categoryChoices(ctx.db, products.map((p) => p.category));
  const catList = [...cats.options, ...cats.extra];
  const kindOptions = (selected) => {
    const opts = menuTypes.map((t) => `<option value="${U.h(t.code)}" ${t.code === selected ? 'selected' : ''}>${U.h(t.label)}</option>`);
    // jenis yang sudah nonaktif tetap ditampilkan supaya menyimpan produk tidak diam-diam mengubah jenisnya
    if (selected && !menuTypes.some((t) => t.code === selected)) {
      opts.unshift(`<option value="${U.h(selected)}" selected>${U.h(kindLabels[selected] || selected)} (nonaktif)</option>`);
    }
    return opts.join('');
  };
  const catInput = (name, value, ph = 'mis. Kopi / Signature') => `<input name="${name}" list="pos-cat-list" value="${U.h(value || '')}" placeholder="${U.h(ph)}">`;
  const catDatalist = `<datalist id="pos-cat-list">${catList.map((c) => `<option value="${U.h(c.value)}">${U.h(c.label)}</option>`).join('')}</datalist>`;

  const rows = products.map((p) => {
    const recipe = recipeCost(ctx.db, p);
    const margin = p.price ? ((p.price - recipe.total) / p.price) * 100 : 0;
    const recipeRows = recipe.rows.map((r) => `<li><span>${U.h(r.material_name)}</span><span>${U.num(r.qty, 3)} ${U.h(r.unit)} × ${U.idrShort(r.cost || 0)} = <b>${U.idr(r.subtotal)}</b></span></li>`).join('');
    return `<tr>
      <td><span class="strong">${U.h(p.sku)}</span><span class="sub-cell">${U.h(p.company_name)}</span></td>
      <td>
        <div class="product-cell">
          <span class="product-thumb">${p.image_url && /^https?:\/\//i.test(p.image_url)
            ? `<img src="${U.h(p.image_url)}" alt="" loading="lazy">`
            : L.icon(categoryIcon(p.category, catIcons), 16)}</span>
          <span><span class="strong">${U.h(p.name)}</span><span class="sub-cell">${U.h(p.category || '—')} · ${U.h(kindLabels[p.kind] || p.kind || 'Menu')}</span></span>
        </div>
      </td>
      <td class="num">${U.idr(p.price)}</td>
      <td class="num">${p.price_grosir ? U.idr(p.price_grosir) : '—'}</td>
      <td class="num">${p.price_distributor ? U.idr(p.price_distributor) : '—'}</td>
      <td class="num strong">${U.idr(recipe.total)}</td>
      <td class="num">${U.pct(margin, 0)}</td>
      <td class="num">${recipe.rows.length}</td>
      <td class="num">
        ${canWrite ? `<details class="disclosure" style="border:none;background:transparent">
          <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo);justify-content:flex-end">Kelola</summary>
          <div class="disc-body" style="padding:10px 0;min-width:380px;text-align:left">
            <form method="post" action="${ctx.base}/pos/products/save">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="id" value="${p.id}">
              <div class="form-grid" style="gap:8px">
                <label class="field"><span>Nama</span><input name="name" value="${U.h(p.name)}" required></label>
                <label class="field"><span>SKU</span><input name="sku" value="${U.h(p.sku)}" required></label>
                <label class="field"><span>Kategori</span>${catInput('category', p.category)}</label>
                <label class="field"><span>Jenis</span>
                  <select name="kind">${kindOptions(p.kind || 'menu')}</select>
                </label>
                <label class="field"><span>Entitas</span>
                  <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${c.id === p.company_id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
                </label>
                <label class="field"><span>Harga retail</span><input name="price" type="number" min="0" step="500" value="${p.price}" required></label>
                <label class="field"><span>Harga grosir (B2B)</span><input name="price_grosir" type="number" min="0" step="500" value="${p.price_grosir || 0}"></label>
                <label class="field"><span>Harga distributor (B2B)</span><input name="price_distributor" type="number" min="0" step="500" value="${p.price_distributor || 0}"></label>
                <label class="field"><span>Stok produk jadi</span><input name="stock" type="number" min="0" step="1" value="${p.stock}"></label>
              </div>

              <p class="form-section">Resep / komposisi (per 1 porsi)</p>
              <ul class="recipe-list">${recipeRows || '<li class="muted">Belum ada resep — HPP belum terhitung.</li>'}</ul>
              <div class="recipe-editor" data-recipe-editor>
                ${[0, 1, 2, 3].map((i) => {
                  const cur = recipe.rows[i] || {};
                  return `<div class="recipe-row">
                    <select name="recipe_material_${i}">
                      <option value="">— bahan —</option>
                      ${materialNames.map((n) => `<option value="${U.h(n)}" ${cur.material_name === n ? 'selected' : ''}>${U.h(n)}</option>`).join('')}
                    </select>
                    <input name="recipe_qty_${i}" type="number" min="0" step="0.001" value="${cur.qty !== undefined ? cur.qty : ''}" placeholder="qty">
                  </div>`;
                }).join('')}
                <p class="hint-text">Qty memakai satuan bahan (kg/liter/pcs). HPP dihitung otomatis dari harga bahan.</p>
              </div>
              <div class="form-actions" style="margin-top:10px"><button class="btn btn-primary btn-sm" type="submit">Simpan produk</button></div>
            </form>
            <form method="post" action="${ctx.base}/pos/products/${p.id}/image" enctype="multipart/form-data" class="entity-image-form">
              ${ctx.csrfField}${ctx.backField}
              <div class="entity-image-row">
                <span class="product-thumb lg">${p.image_url && /^https?:\/\//i.test(p.image_url)
                  ? `<img src="${U.h(p.image_url)}" alt="">`
                  : L.icon(categoryIcon(p.category, catIcons), 20)}</span>
                <div class="entity-image-fields">
                  <label class="field"><span>Gambar menu</span><input type="file" name="image" accept="image/*"></label>
                  <label class="field"><span>atau URL gambar</span><input name="image_url" placeholder="https://…" value="${U.h(p.image_url && /^https?:\/\//i.test(p.image_url) ? p.image_url : '')}"></label>
                  <div class="form-actions">
                    <button class="btn btn-ghost btn-sm" type="submit">Simpan gambar</button>
                    ${p.image_url ? `<button class="btn btn-ghost btn-sm" type="submit" name="remove" value="1">Hapus</button>` : ''}
                  </div>
                </div>
              </div>
            </form>
            <form method="post" action="${ctx.base}/pos/products/${p.id}/delete" data-confirm="Hapus produk ${U.h(p.name)}?" style="margin-top:8px">
              ${ctx.csrfField}${ctx.backField}
              <button class="btn btn-danger btn-sm" type="submit">Hapus produk</button>
            </form>
          </div>
        </details>` : ''}
      </td>
    </tr>`;
  }).join('');

  const body = `
    ${catDatalist}
    ${L.card({ title: 'Menu, resep & harga', subtitle: `${products.length} produk · HPP dihitung dari resep bahan baku` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>SKU</th><th>Produk</th><th class="num">Retail</th><th class="num">Grosir</th><th class="num">Distributor</th><th class="num">HPP resep</th><th class="num">Margin</th><th class="num">Bahan</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9">${L.empty('Belum ada produk')}</td></tr>`}</tbody>
      </table></div>`)}

    ${canWrite ? L.card({ title: 'Tambah menu / produk', subtitle: 'Isi resep agar HPP dan margin langsung terhitung' }, `
      <form method="post" action="${ctx.base}/pos/products/save">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama produk</span><input name="name" required placeholder="mis. Es Kopi Susu Pandan"></label>
          <label class="field"><span>SKU</span><input name="sku" required placeholder="mis. MN-12"></label>
          <label class="field"><span>Kategori</span>${catInput('category', '', 'Kopi / Signature / Biji Kopi')}</label>
          <label class="field"><span>Jenis</span>
            <select name="kind">${kindOptions('menu')}</select>
          </label>
          <label class="field"><span>Entitas</span>
            <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.selectedCompanyId === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Harga retail</span><input name="price" type="number" min="0" step="500" required value="0"></label>
          <label class="field"><span>Harga grosir</span><input name="price_grosir" type="number" min="0" step="500" value="0"></label>
          <label class="field"><span>Harga distributor</span><input name="price_distributor" type="number" min="0" step="500" value="0"></label>
          <label class="field"><span>Stok produk jadi</span><input name="stock" type="number" min="0" step="1" value="0"></label>
        </div>
        <p class="form-section">Resep (opsional, bisa dilengkapi nanti)</p>
        <div class="recipe-editor">
          ${[0, 1, 2, 3].map((i) => `<div class="recipe-row">
            <select name="recipe_material_${i}">
              <option value="">— bahan —</option>
              ${materialNames.map((n) => `<option value="${U.h(n)}">${U.h(n)}</option>`).join('')}
            </select>
            <input name="recipe_qty_${i}" type="number" min="0" step="0.001" placeholder="qty">
          </div>`).join('')}
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan produk</button></div>
      </form>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'Menu, Resep & Harga',
    subtitle: 'HPP dihitung dari resep bahan baku · harga tier untuk pelanggan B2B',
    active: '/pos/products',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.link('/farm')}">${L.icon('sprinkle', 15)} Bahan baku</a>`,
  });
}

module.exports = { posPage, salesPage, productsPage, PAY_LABEL, CHANNEL_LABEL, TIER_LABEL, labelsFor };
