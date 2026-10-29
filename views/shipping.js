'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const S = require('../lib/shipping');
const settings = require('../lib/settings');

function statusBadge(status) {
  const meta = S.STATUS[status] || { label: status, tone: 'muted' };
  return L.badge(meta.label, meta.tone);
}

function timeline(history) {
  const last = history[history.length - 1];
  return `<div class="timeline">${history.map((h) => {
    const done = h.status === 'delivered';
    const current = last && h.id === last.id && !done;
    return `<div class="timeline__item ${done || !current ? 'is-done' : ''} ${current ? 'is-current' : ''}">
      <span class="timeline__dot"></span>
      <div>
        <div class="timeline__title">${U.h((S.STATUS[h.status] || {}).label || h.status)}</div>
        <div class="timeline__meta">${U.h(h.description || '')} · ${U.h(String(h.occurred_at).slice(0, 16))} · ${U.h(h.source)}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function shippingPage(ctx, data) {
  const {
    mode, stats, shipments, detail, rateResult, rateQuery, courierOptions,
    originCompanies, sales, selectedSale, manualRates, webhookUrl,
  } = data;
  const canWrite = can(ctx.user, 'shipping_write');

  const statsCards = [
    ['Total pengiriman', U.num(stats.total), 'semua waktu'],
    ['Sedang berjalan', U.num(stats.active), `${stats.pending} menunggu jemput`],
    ['Terkirim', U.num(stats.delivered), 'selesai'],
    ['Total ongkir', U.idrShort(stats.cost), 'biaya pengiriman'],
  ];

  const rows = shipments.map((s) => `<tr>
    <td><span class="awb strong">${U.h(s.awb || '—')}</span><span class="sub-cell">${U.h(s.invoice_no || 'tanpa invoice')}</span></td>
    <td><span class="strong">${U.h(S.COURIERS[s.courier] || s.courier)}</span><span class="sub-cell">${U.h(s.service || '')} · ${U.num(s.weight)} g</span></td>
    <td>${U.h(s.dest_name || '—')}<span class="sub-cell">${U.h(s.dest_area || '')}</span></td>
    <td>${statusBadge(s.status)}</td>
    <td class="num">${U.idr(s.cost)}</td>
    <td class="num muted">${U.h(String(s.last_event).slice(0, 16))}</td>
    <td class="num"><a class="btn btn-ghost btn-sm" href="${ctx.link('/shipping', { shipment: s.id })}">Detail</a></td>
  </tr>`).join('');

  const rateCards = rateResult && rateResult.rates.length ? rateResult.rates.map((r, idx) => `<div class="rate-card ${idx === 0 ? 'is-best' : ''}">
    <span class="rate-courier">${U.h(S.COURIERS[r.courier] || r.courier)}</span>
    <span class="rate-service">${U.h(r.service)}</span>
    <span class="rate-price">${U.idr(r.price)}</span>
    <span class="rate-eta">${U.h(r.eta || '—')}${idx === 0 ? ' · termurah' : ''}</span>
    ${canWrite ? `<form method="post" action="${ctx.base}/shipping/create" style="margin-top:6px">
      ${ctx.csrfField}${ctx.backField}
      <input type="hidden" name="courier" value="${U.h(r.courier)}">
      <input type="hidden" name="service" value="${U.h(r.service)}">
      <input type="hidden" name="cost" value="${r.price}">
      <input type="hidden" name="weight" value="${Number(rateQuery.weight) || 1000}">
      <input type="hidden" name="dest_area" value="${U.h(rateQuery.area || '')}">
      <input type="hidden" name="dest_name" value="${U.h(rateQuery.name || '')}">
      <input type="hidden" name="dest_phone" value="${U.h(rateQuery.phone || '')}">
      <input type="hidden" name="dest_address" value="${U.h(rateQuery.address || '')}">
      <input type="hidden" name="sale_id" value="${U.h(rateQuery.saleId || '')}">
      <input type="hidden" name="company_id" value="${U.h(rateQuery.companyId || '')}">
      <button class="btn btn-primary btn-sm btn-block" type="submit">Buat pengiriman</button>
    </form>` : ''}
  </div>`).join('') : '';

  const detailBlock = detail ? `
    <div class="grid grid-side" style="margin-top:20px">
      ${L.card({ title: 'Detail pengiriman', subtitle: `${S.COURIERS[detail.courier] || detail.courier} ${detail.service || ''}` }, `
        <div class="table-wrap"><table class="data">
          <tbody>
            <tr><td class="muted">No. resi (AWB)</td><td><span class="awb strong">${U.h(detail.awb || '—')}</span>
              ${detail.awb ? `<button class="copy-btn" type="button" data-copy="${U.h(detail.awb)}">salin</button>` : ''}</td></tr>
            <tr><td class="muted">Status</td><td>${statusBadge(detail.status)}</td></tr>
            <tr><td class="muted">Penerima</td><td>${U.h(detail.dest_name || '—')} · ${U.h(detail.dest_phone || '—')}</td></tr>
            <tr><td class="muted">Tujuan</td><td>${U.h(detail.dest_area || '—')}<span class="sub-cell">${U.h(detail.dest_address || '')}</span></td></tr>
            <tr><td class="muted">Asal</td><td>${U.h([detail.origin_area, detail.origin_zip].filter(Boolean).join(' · ') || detail.company_name || '—')}</td></tr>
            <tr><td class="muted">Berat / ongkir</td><td>${U.num(detail.weight)} g · ${U.idr(detail.cost)}</td></tr>
            <tr><td class="muted">Invoice</td><td>${U.h(detail.invoice_no || '—')}</td></tr>
          </tbody>
        </table></div>
        ${canWrite ? `<div class="form-actions">
          <form method="post" action="${ctx.base}/shipping/${detail.id}/sync">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-primary btn-sm" type="submit">Sinkronkan tracking</button>
          </form>
          <form method="post" action="${ctx.base}/shipping/${detail.id}/status" style="display:flex;gap:6px;align-items:center">
            ${ctx.csrfField}${ctx.backField}
            <select name="status" style="padding:7px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface-solid);color:var(--text);font:inherit;font-size:var(--fs-sm)">
              ${Object.entries(S.STATUS).map(([k, v]) => `<option value="${k}" ${detail.status === k ? 'selected' : ''}>${U.h(v.label)}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" type="submit">Ubah status</button>
          </form>
        </div>` : ''}`)}

      ${L.card({ title: 'Riwayat tracking', subtitle: 'Diperbarui otomatis dari kurir atau simulasi progres' }, `
        ${timeline(detail.history)}
        <p class="hint-text" style="margin-top:12px">${mode.live
    ? 'Tracking diambil dari API ' + U.h(mode.label) + '. Klik "Sinkronkan tracking" untuk memperbarui.'
    : 'Belum ada API key kurir — status dimajukan otomatis (simulasi) setiap 6 jam sejak pengiriman dibuat.'}</p>`)}
    </div>` : '';

  const manualRateRows = manualRates.map((r) => `<tr>
    <td class="strong">${U.h(r.dest_area)}</td>
    <td>${U.h(S.COURIERS[r.courier] || r.courier)}</td>
    <td>${U.h(r.service)}</td>
    <td class="num">${U.idr(r.base_price)}</td>
    <td class="num">${U.idr(r.price_per_kg)}</td>
    <td>${U.h(r.eta_text || '—')}</td>
    <td class="num">${r.active ? L.badge('Aktif', 'good') : L.badge('Nonaktif', 'muted')}</td>
    <td class="num">${canWrite ? `<form method="post" action="${ctx.base}/shipping/rates/${r.id}/delete" data-confirm="Hapus tarif ini?">
      ${ctx.csrfField}${ctx.backField}<button class="btn btn-ghost btn-sm" type="submit">Hapus</button></form>` : ''}</td>
  </tr>`).join('');

  const body = `
    <div class="wa-status">
      ${mode.live ? '<span class="dot-live"></span>' : '<span class="dot-sim"></span>'}
      <div style="flex:1">
        <strong>${mode.live ? 'Terhubung ke ' + U.h(mode.label) : 'Tarif manual aktif'}</strong>
        <p>${mode.live
    ? 'Cek ongkir real-time dan tracking otomatis lintas kurir aktif (API key tersimpan: ' + U.h(mode.key) + ').'
    : 'Belum ada API key kurir. Ongkir dihitung dari tabel tarif yang Anda atur, tracking memakai simulasi progres — semua alur tetap bisa dipakai sekarang.'}</p>
      </div>
      <div class="chip-row">${S.courierList(ctx.db).map((c) => L.badge(c.label, 'muted')).join('')}</div>
    </div>

    <div class="grid grid-4">
      ${statsCards.map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Cek ongkir lintas kurir', subtitle: 'Masukkan tujuan & berat untuk membandingkan semua kurir sekaligus' }, `
      <form method="get" action="${ctx.base}/shipping" class="form-grid cols-3">
        <label class="field"><span>Kota / area tujuan</span>
          <input name="area" list="area-list" value="${U.h(rateQuery.area || '')}" placeholder="mis. Bandung">
          <datalist id="area-list">${[...new Set(manualRates.map((r) => r.dest_area))].map((a) => `<option value="${U.h(a)}">`).join('')}</datalist>
        </label>
        <label class="field"><span>Berat (gram)</span><input name="weight" type="number" min="100" step="100" value="${Number(rateQuery.weight) || 1000}"></label>
        <label class="field"><span>Nilai barang (Rp)</span><input name="value" type="number" min="0" step="10000" value="${Number(rateQuery.value) || 100000}"></label>
        <label class="field"><span>Dikirim dari</span>
          <select name="company_id">${originCompanies.map((c) => `<option value="${c.id}" ${Number(rateQuery.companyId) === c.id ? 'selected' : ''}>${U.h(c.name)} · ${U.h(c.origin_area || 'asal belum diatur')}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Nama penerima</span><input name="name" value="${U.h(rateQuery.name || '')}" placeholder="opsional"></label>
        <label class="field"><span>No. HP penerima</span><input name="phone" value="${U.h(rateQuery.phone || '')}" placeholder="opsional"></label>
        <label class="field field-full"><span>Alamat lengkap</span><input name="address" value="${U.h(rateQuery.address || '')}" placeholder="jalan, nomor, kecamatan"></label>
        <div class="field field-full" style="flex-direction:row;gap:10px">
          <button class="btn btn-primary" type="submit">${L.icon('truck', 16)} Hitung ongkir</button>
          ${rateResult && rateResult.error ? `<span class="hint-text" style="color:var(--warn)">${U.h(rateResult.error)}</span>` : ''}
        </div>
      </form>
      ${rateCards ? `<div style="margin-top:16px">
        <div class="chip-row" style="margin-bottom:10px">
          ${L.badge(rateResult.source === 'manual' ? 'Sumber: tarif manual' : 'Sumber: ' + rateResult.source, rateResult.live ? 'good' : 'warn')}
          ${L.badge(U.num(rateResult.rates.length) + ' layanan', 'muted')}
          ${L.badge(rateQuery.weight + ' gram', 'muted')}
        </div>
        <div class="rate-grid">${rateCards}</div>
      </div>` : ''}`)}

    ${L.card({ title: 'Daftar pengiriman', subtitle: `${shipments.length} pengiriman terakhir` }, `
      <form method="get" action="${ctx.base}/shipping" class="inline-filters">
        ${ctx.selectedCompanyId ? `<input type="hidden" name="company" value="${ctx.selectedCompanyId}">` : ''}
        <input type="search" name="q" placeholder="Cari resi, penerima, invoice…">
        <select name="status" data-autosubmit>
          <option value="all">Semua status</option>
          ${Object.entries(S.STATUS).map(([k, v]) => `<option value="${k}">${U.h(v.label)}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" type="submit">Cari</button>
      </form>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Resi</th><th>Kurir</th><th>Penerima</th><th>Status</th><th class="num">Ongkir</th><th class="num">Update</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7">${L.empty('Belum ada pengiriman', 'Hitung ongkir di atas lalu klik "Buat pengiriman".')}</td></tr>`}</tbody>
      </table></div>`)}

    ${detailBlock}

    <div class="grid grid-side">
      ${L.card({ title: 'Pengaturan kurir & API', subtitle: 'Kredensial disimpan di server, tidak pernah dikirim ke browser' }, `
        ${canWrite ? `<form method="post" action="${ctx.base}/shipping/settings">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Provider tarif & tracking</span>
              <select name="ship_provider">
                ${Object.entries(S.PROVIDERS).map(([k, v]) => `<option value="${k}" ${settings.get(ctx.db, 'ship_provider') === k ? 'selected' : ''}>${U.h(v.label)}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>API key</span>
              <input name="ship_api_key" type="password" placeholder="${settings.get(ctx.db, 'ship_api_key') ? U.h(mode.key) : 'belum diisi'}" autocomplete="off">
            </label>
            <label class="field"><span>Base URL API (opsional)</span><input name="ship_base_url" value="${U.h(settings.get(ctx.db, 'ship_base_url'))}" placeholder="https://api.biteship.com"></label>
            <label class="field"><span>Kurir aktif</span><input name="ship_couriers" value="${U.h(settings.get(ctx.db, 'ship_couriers'))}" placeholder="jne,jnt,sicepat,anteraja,ninja"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan pengaturan</button></div>
        </form>` : ''}
        <div style="margin-top:14px">
          <p class="persp-meta">Webhook status kurir (Biteship)</p>
          <div class="ds-code" style="margin-top:6px">POST ${U.h(webhookUrl)}</div>
          <button class="btn btn-ghost btn-sm" type="button" data-copy="${U.h(webhookUrl)}" style="margin-top:8px">${L.icon('copy', 14)} Salin URL</button>
        </div>`)}

      ${L.card({ title: 'Tarif manual per kota', subtitle: 'Dipakai saat provider belum terhubung' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Kota</th><th>Kurir</th><th>Layanan</th><th class="num">Base</th><th class="num">/kg</th><th>ETA</th><th>Status</th><th></th></tr></thead>
          <tbody>${manualRateRows || `<tr><td colspan="8">${L.empty('Belum ada tarif manual')}</td></tr>`}</tbody>
        </table></div>
        ${canWrite ? `<form method="post" action="${ctx.base}/shipping/rates" style="margin-top:14px">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid cols-3">
            <label class="field"><span>Kota tujuan</span><input name="dest_area" required placeholder="mis. Yogyakarta"></label>
            <label class="field"><span>Kurir</span>
              <select name="courier">${courierOptions.map((c) => `<option value="${c.code}">${U.h(c.label)}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Layanan</span><input name="service" value="REG" required></label>
            <label class="field"><span>Harga dasar (Rp)</span><input name="base_price" type="number" min="0" step="500" required value="10000"></label>
            <label class="field"><span>Per kg berikutnya (Rp)</span><input name="price_per_kg" type="number" min="0" step="500" value="5000"></label>
            <label class="field"><span>Estimasi</span><input name="eta_text" placeholder="2-3 hari"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan tarif</button></div>
        </form>` : ''}`)}
    </div>
  `;

  return L.shell(ctx, {
    title: 'Pengiriman & Ongkir',
    subtitle: 'Cek ongkir lintas kurir dan tracking otomatis',
    active: '/shipping',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.link('/whatsapp')}">${L.icon('chat', 15)} Kirim resi via WA</a>`,
  });
}

module.exports = { shippingPage, statusBadge, timeline };
