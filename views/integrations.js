'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const settings = require('../lib/settings');
const WA = require('../lib/whatsapp');
const SHIPPING = require('../lib/shipping');
const MAIL = require('../lib/mailer');

function secretField(name, value, placeholder) {
  return `<input name="${name}" type="password" autocomplete="off" value=""
    placeholder="${settings.mask(value) || placeholder || 'belum diisi'}">`;
}

function stateChip(live, labelLive, labelSim) {
  return live ? L.badge(labelLive, 'good') : L.badge(labelSim, 'warn');
}

function integrationsPage(ctx, data) {
  const { waMode, mailMode, shipMode, webhooks, lastUpdated, testResult, origins } = data;
  const canWrite = can(ctx.user, 'integration_write');
  const cfg = (k, d = '') => settings.get(ctx.db, k, d);

  const webhookRows = webhooks.map((w) => `<tr>
    <td><span class="strong">${U.h(w.name)}</span><span class="sub-cell">${U.h(w.description)}</span></td>
    <td><code style="font-size:var(--fs-2xs);word-break:break-all">${U.h(w.url)}</code></td>
    <td>${L.badge(w.auth, w.auth === 'Publik' ? 'warn' : 'good')}</td>
    <td class="num"><button class="btn btn-ghost btn-sm" type="button" data-copy="${U.h(w.url)}">${L.icon('copy', 13)} Salin</button></td>
  </tr>`).join('');

  const body = `
    ${testResult ? `<div class="flash flash-${testResult.ok ? 'success' : 'error'}">
      ${L.icon(testResult.ok ? 'check' : 'alert', 18)}<span>${U.h(testResult.msg)}</span></div>` : ''}

    <div class="grid grid-3">
      ${[
        ['WhatsApp Business', waMode.live, waMode.label, waMode.live ? 'Siap mengirim pesan' : 'Mode simulasi: pesan disimpan'],
        ['Email laporan', mailMode.live, mailMode.label, mailMode.live ? 'Siap mengirim email' : 'Mode simulasi: laporan dicatat'],
        ['Pengiriman', shipMode.live, shipMode.label, shipMode.live ? 'Tarif & tracking real-time' : 'Tarif manual per kota'],
      ].map(([name, live, label, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(name)}</span>${stateChip(live, 'Terhubung', 'Simulasi')}</div>
        <div class="stat-value" style="font-size:var(--fs-lg)">${U.h(label)}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Keamanan kredensial', subtitle: 'Semua API key disimpan di server dan tidak pernah dikirim utuh ke browser' }, `
      <div class="grid grid-side">
        <ul class="labour-notes">
          <li>Kunci hanya dibaca oleh proses server saat memanggil API pihak ketiga.</li>
          <li>Di halaman ini kunci <b>selalu disamarkan</b> (contoh: <code>${U.h(settings.mask('abcdefghijklmnop') || 'ab••••••mnop')}</code>).</li>
          <li>Kolom kosong berarti nilai lama dipertahankan — isi hanya bila ingin mengganti.</li>
          <li>Riwayat pemakaian tercatat di <a href="${ctx.base}/admin">audit log</a> (aksi <code>integration.*</code>).</li>
          <li>Webhook diverifikasi dengan token/signature; endpoint publik tidak menerima perintah tulis lain.</li>
        </ul>
        <div>
          <div class="persp-meta" style="margin-bottom:6px">Ringkasan status kunci</div>
          <div class="table-wrap"><table class="data">
            <tbody>
              <tr><td class="muted">Token WhatsApp</td><td>${cfg('wa_token') ? stateChip(true, settings.mask(cfg('wa_token')), '') : L.badge('Belum diisi', 'muted')}</td></tr>
              <tr><td class="muted">App secret WhatsApp</td><td>${cfg('wa_app_secret') ? L.badge('Tersimpan', 'good') : L.badge('Belum diisi', 'muted')}</td></tr>
              <tr><td class="muted">API key pengiriman</td><td>${cfg('ship_api_key') ? stateChip(true, settings.mask(cfg('ship_api_key')), '') : L.badge('Belum diisi', 'muted')}</td></tr>
              <tr><td class="muted">API key email</td><td>${cfg('mail_api_key') ? stateChip(true, settings.mask(cfg('mail_api_key')), '') : L.badge('Belum diisi', 'muted')}</td></tr>
              <tr><td class="muted">Terakhir diubah</td><td>${U.h(lastUpdated || '—')}</td></tr>
            </tbody>
          </table></div>
          ${canWrite ? `<div class="form-actions">
            <form method="post" action="${ctx.base}/integrations/test" style="display:flex;gap:6px">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="kind" value="whatsapp">
              <button class="btn btn-ghost btn-sm" type="submit">Uji WhatsApp</button>
            </form>
            <form method="post" action="${ctx.base}/integrations/test">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="kind" value="email">
              <button class="btn btn-ghost btn-sm" type="submit">Uji email</button>
            </form>
            <form method="post" action="${ctx.base}/integrations/test">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="kind" value="shipping">
              <button class="btn btn-ghost btn-sm" type="submit">Uji tarif kurir</button>
            </form>
          </div>` : ''}
        </div>
      </div>`)}

    ${canWrite ? `
    <div class="grid grid-side">
      ${L.card({ title: 'WhatsApp Business', subtitle: 'Pengirim notifikasi, balasan otomatis, dan laporan pagi' }, `
        <form method="post" action="${ctx.base}/integrations/wa">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Provider</span>
              <select name="wa_provider">${Object.entries(WA.PROVIDERS).map(([k, v]) => `<option value="${k}" ${cfg('wa_provider') === k ? 'selected' : ''}>${U.h(v.label)}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Access token / API key</span>${secretField('wa_token', cfg('wa_token'))}</label>
            <label class="field"><span>Phone Number ID (Meta)</span><input name="wa_phone_id" value="${U.h(cfg('wa_phone_id'))}"></label>
            <label class="field"><span>Base URL API</span><input name="wa_api_url" value="${U.h(cfg('wa_api_url'))}" placeholder="opsional"></label>
            <label class="field"><span>Verify token webhook</span><input name="wa_verify_token" value="${U.h(cfg('wa_verify_token'))}"></label>
            <label class="field"><span>Nama brand di pesan pelanggan</span>
              <input name="brand_name" value="${U.h(cfg('brand_name'))}" placeholder="mis. Ondeway">
              <span class="hint-text">Dipakai di struk WhatsApp, sambutan member, dan balasan otomatis. Kosongkan = nama entitas utama.</span>
            </label>
            <label class="field"><span>App secret (signature)</span>${secretField('wa_app_secret', cfg('wa_app_secret'), 'opsional')}</label>
            <label class="field"><span>Notifikasi struk POS</span>
              <select name="wa_notify_receipt"><option value="1" ${cfg('wa_notify_receipt') === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${cfg('wa_notify_receipt') !== '1' ? 'selected' : ''}>Nonaktif</option></select>
            </label>
            <label class="field"><span>Balasan otomatis</span>
              <select name="wa_auto_reply"><option value="1" ${cfg('wa_auto_reply') === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${cfg('wa_auto_reply') !== '1' ? 'selected' : ''}>Nonaktif</option></select>
            </label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan WhatsApp</button></div>
        </form>`)}

      ${L.card({ title: 'Email (laporan & notifikasi)', subtitle: 'Untuk pengiriman ringkasan harian ke tim' }, `
        <form method="post" action="${ctx.base}/integrations/mail">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Provider</span>
              <select name="mail_provider">${Object.entries(MAIL.PROVIDERS).map(([k, v]) => `<option value="${k}" ${cfg('mail_provider') === k ? 'selected' : ''}>${U.h(v.label)}</option>`).join('')}</select>
            </label>
            <label class="field"><span>API key</span>${secretField('mail_api_key', cfg('mail_api_key'))}</label>
            <label class="field"><span>Email pengirim</span><input name="mail_from" value="${U.h(cfg('mail_from'))}" placeholder="laporan@domainanda.id"></label>
            <label class="field"><span>Reply-to</span><input name="mail_reply_to" value="${U.h(cfg('mail_reply_to'))}" placeholder="opsional"></label>
            <label class="field"><span>Domain Mailgun</span><input name="mail_domain" value="${U.h(cfg('mail_domain'))}" placeholder="mg.domainanda.id"></label>
            <label class="field"><span>URL webhook email</span><input name="mail_webhook_url" value="${U.h(cfg('mail_webhook_url'))}" placeholder="https://hooks…"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan email</button></div>
        </form>`) }
    </div>

    <div class="grid grid-side">
      ${L.card({ title: 'Layanan pengiriman', subtitle: 'Tarif lintas kurir & tracking otomatis' }, `
        <form method="post" action="${ctx.base}/integrations/shipping">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Provider</span>
              <select name="ship_provider">${Object.entries(SHIPPING.PROVIDERS).map(([k, v]) => `<option value="${k}" ${cfg('ship_provider') === k ? 'selected' : ''}>${U.h(v.label)}</option>`).join('')}</select>
            </label>
            <label class="field"><span>API key</span>${secretField('ship_api_key', cfg('ship_api_key'))}</label>
            <label class="field"><span>Base URL API</span><input name="ship_base_url" value="${U.h(cfg('ship_base_url'))}" placeholder="https://api.biteship.com"></label>
            <label class="field"><span>Kurir aktif (pisahkan koma)</span><input name="ship_couriers" value="${U.h(cfg('ship_couriers'))}"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan pengiriman</button></div>
        </form>
        <div style="margin-top:14px">
          <p class="persp-meta" style="margin-bottom:6px">Alamat asal per outlet</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Outlet</th><th>Kota/area</th><th class="num">Kode pos</th></tr></thead>
            <tbody>${origins.map((o) => `<tr><td>${U.h(o.name)}</td><td>${U.h(o.origin_area || '—')}</td><td class="num">${U.h(o.origin_zip || '—')}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>`)}

      ${L.card({ title: 'Scheduled report', subtitle: 'Ringkasan performa otomatis setiap pagi' }, `
        <form method="post" action="${ctx.base}/integrations/report">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Status</span>
              <select name="report_enabled"><option value="1" ${cfg('report_enabled', '1') === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${cfg('report_enabled', '1') !== '1' ? 'selected' : ''}>Nonaktif</option></select>
            </label>
            <label class="field"><span>Jam kirim (WIB)</span><input name="report_time" type="time" value="${U.h(cfg('report_time', '07:00'))}"></label>
            <label class="field"><span>Kanal</span>
              <select name="report_channel">
                <option value="whatsapp" ${cfg('report_channel') === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                <option value="email" ${cfg('report_channel') === 'email' ? 'selected' : ''}>Email</option>
                <option value="both" ${cfg('report_channel') === 'both' ? 'selected' : ''}>WhatsApp + Email</option>
              </select>
            </label>
            <label class="field"><span>Nomor WhatsApp penerima</span><input name="report_phones" value="${U.h(cfg('report_phones'))}" placeholder="0812xxx, 0813xxx"></label>
            <label class="field field-full"><span>Email penerima</span><input name="report_emails" value="${U.h(cfg('report_emails'))}" placeholder="owner@kopirimba.id, manager@kopirimba.id"></label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">Simpan jadwal</button>
            <a class="btn btn-ghost btn-sm" href="${ctx.base}/reports">Buka halaman laporan</a>
          </div>
        </form>`) }
    </div>` : L.card({ title: 'Akses terbatas', subtitle: 'Hanya owner yang dapat mengubah kredensial' }, `
      <p class="hint-text">Role Anda dapat melihat status integrasi, tetapi perubahan kredensial memerlukan izin owner.</p>`)}

    ${L.card({ title: 'Endpoint webhook', subtitle: 'Daftarkan URL ini di dashboard provider masing-masing' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Endpoint</th><th>URL</th><th>Autentikasi</th><th></th></tr></thead>
        <tbody>${webhookRows}</tbody>
      </table></div>
      <p class="hint-text" style="margin-top:10px">Webhook menerima POST pihak ketiga tanpa sesi login, sehingga hanya menerima payload yang sudah diverifikasi (token/signature) dan tidak mengekspos data internal.</p>`)}
  `;

  return L.shell(ctx, {
    title: 'Pengaturan Integrasi',
    subtitle: 'API key, webhook, dan jadwal laporan dalam satu tempat',
    active: '/settings/integrations',
    content: body,
  });
}

module.exports = { integrationsPage };
