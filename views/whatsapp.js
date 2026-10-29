'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const WA = require('../lib/whatsapp');
const settings = require('../lib/settings');

function statusBadge(status) {
  const tone = status === 'sent' || status === 'delivered' || status === 'read' ? 'good'
    : status === 'failed' ? 'bad'
      : status === 'simulated' ? 'warn'
        : status === 'received' ? 'indigo' : 'muted';
  return L.badge(WA.STATUS_LABEL[status] || status, tone);
}

function renderMessages(msgs) {
  return msgs.map((m) => {
    const cls = m.direction === 'in' ? 'in' : (m.is_bot ? 'bot' : 'out');
    return `<div class="wa-bubble ${cls}">
      ${m.is_bot ? '<span class="wa-tag">Balasan otomatis</span>' : ''}
      ${U.h(m.body).replace(/\n/g, '<br>')}
      <small>${U.h(String(m.created_at).slice(11, 16))} · ${U.h(WA.STATUS_LABEL[m.status] || m.status)}${m.error ? ' · ' + U.h(m.error.slice(0, 40)) : ''}</small>
    </div>`;
  }).join('');
}

function whatsappPage(ctx, data) {
  const { mode, stats, threads, activeThread, messages, rules, outbox, customersToBroadcast, preset, webhookUrl } = data;
  const canWrite = can(ctx.user, 'wa_write');
  const cfg = (k) => settings.get(ctx.db, k, '');

  const threadRows = threads.map((t) => `<a class="wa-thread ${activeThread && activeThread.wa_id === t.wa_id ? 'is-active' : ''}"
      href="${ctx.link('/whatsapp', { chat: t.wa_id })}">
    <span class="mini-avatar">${U.h(U.initials(t.displayName))}</span>
    <span class="wa-thread__body">
      <span class="wa-thread__top">
        <span class="wa-thread__name">${U.h(t.displayName)}</span>
        <span class="wa-thread__time">${U.h(String(t.last_at).slice(5, 16))}</span>
      </span>
      <span class="wa-thread__preview">${t.last_dir === 'out' ? '↗ ' : ''}${U.h(String(t.last_body || '').slice(0, 60))}</span>
    </span>
    ${t.customer ? L.badge(t.customer.type === 'b2b' ? 'B2B' : 'Member', t.customer.type === 'b2b' ? 'indigo' : 'good') : ''}
  </a>`).join('');

  const chatPanel = activeThread ? `
    <div class="wa-chat">
      <header class="wa-chat__head">
        <div>
          <div class="list-title">${U.h(activeThread.displayName)}</div>
          <div class="list-sub">${U.h(WA.prettyPhone(activeThread.wa_id))}${activeThread.customer ? ` · ${U.h(activeThread.customer.company_name || '')} · ${U.num(activeThread.customer.points)} poin` : ''}</div>
        </div>
        ${activeThread.customer ? `<a class="btn btn-ghost btn-sm" href="${ctx.link('/members', { customer: activeThread.customer.id })}">Detail member</a>` : ''}
      </header>
      <div class="wa-chat__msgs">${renderMessages(messages)}</div>
      ${canWrite ? `<form class="wa-chat__reply" method="post" action="${ctx.base}/whatsapp/send">
        ${ctx.csrfField}${ctx.backField}
        <input type="hidden" name="to" value="${U.h(activeThread.wa_id)}">
        <input type="hidden" name="name" value="${U.h(activeThread.displayName)}">
        ${activeThread.customer ? `<input type="hidden" name="customer_id" value="${activeThread.customer.id}">` : ''}
        <textarea name="body" placeholder="Tulis balasan…" required></textarea>
        <button class="btn btn-primary" type="submit">${L.icon('send', 16)} Kirim</button>
      </form>` : '<div class="wa-chat__reply"><p class="hint-text">Role Anda hanya dapat melihat percakapan.</p></div>'}
    </div>` : `<div class="wa-empty">
      <div>
        ${L.icon('chat', 30)}
        <p style="margin-top:10px;font-size:13px;color:var(--ink-soft);font-weight:600">Pilih percakapan</p>
        <span class="hint-text">Klik salah satu pelanggan di kiri untuk melihat dan membalas pesan.</span>
      </div>
    </div>`;

  const ruleRows = rules.map((r) => `<div class="rule-row">
    <span class="rule-key">${U.h(r.keyword)}</span>
    <span class="rule-reply">${U.h(r.reply)}</span>
    <span class="hint-text" style="white-space:nowrap">${U.num(r.hits)}× dipakai</span>
    ${canWrite ? `<div style="display:flex;gap:6px">
      <form method="post" action="${ctx.base}/whatsapp/rules/${r.id}/toggle">
        ${ctx.csrfField}${ctx.backField}
        <button class="btn btn-ghost btn-sm" type="submit">${r.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
      </form>
      <form method="post" action="${ctx.base}/whatsapp/rules/${r.id}/delete" data-confirm="Hapus aturan balasan ini?">
        ${ctx.csrfField}${ctx.backField}
        <button class="btn btn-danger btn-sm" type="submit">Hapus</button>
      </form>
    </div>` : ''}
  </div>`).join('');

  const outboxRows = outbox.map((m) => `<tr>
    <td class="muted">${U.h(String(m.created_at).slice(5, 16))}</td>
    <td><span class="strong">${U.h(m.name || WA.prettyPhone(m.wa_id))}</span>${m.is_bot ? `<span class="sub-cell">otomatis</span>` : ''}</td>
    <td class="muted">${U.h(String(m.body || '').slice(0, 64))}</td>
    <td>${statusBadge(m.status)}</td>
    <td class="num">${canWrite && m.direction === 'out' && m.status !== 'sent' ? `<form method="post" action="${ctx.base}/whatsapp/messages/${m.id}/retry">
      ${ctx.csrfField}${ctx.backField}
      <button class="btn btn-ghost btn-sm" type="submit">Kirim ulang</button>
    </form>` : ''}</td>
  </tr>`).join('');

  const body = `
    <div class="wa-status">
      ${mode.live ? '<span class="dot-live"></span>' : '<span class="dot-sim"></span>'}
      <div style="flex:1">
        <strong>${mode.live ? 'Terhubung ke ' + U.h(mode.label) : 'Mode simulasi'}</strong>
        <p>${mode.live
    ? 'Pesan keluar dikirim lewat API resmi. Balasan pelanggan otomatis diproses oleh mesin aturan di bawah.'
    : 'Belum ada kredensial provider. Semua pesan tetap tercatat di kotak keluar dan bisa dikirim ulang setelah kredensial diisi — tidak ada yang hilang.'}</p>
      </div>
      <div class="chip-row">
        ${L.badge(U.num(stats.threads) + ' percakapan', 'indigo')}
        ${L.badge(U.num(stats.inbound) + ' pesan masuk', 'muted')}
        ${stats.failed ? L.badge(stats.failed + ' gagal', 'bad') : L.badge('Tidak ada kegagalan', 'good')}
      </div>
    </div>

    <div class="grid grid-4">
      ${[
        ['Pesan masuk', U.num(stats.inbound), 'dari pelanggan'],
        ['Terkirim', U.num(stats.sent), 'via API provider'],
        ['Simulasi', U.num(stats.simulated), 'tersimpan di outbox'],
        ['Gagal', U.num(stats.failed), stats.queued + ' menunggu'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Kotak masuk WhatsApp', subtitle: 'Balasan otomatis berjalan 24/7; percakapan bisa diambil alih manual kapan saja' }, `
      <div class="wa-inbox">
        <div class="wa-thread-list">${threadRows || L.empty('Belum ada percakapan', 'Pesan yang masuk lewat webhook akan muncul di sini.')}</div>
        ${chatPanel}
      </div>`)}

    ${canWrite ? L.card({ title: 'Kirim pesan / broadcast', subtitle: 'Pesan promosi ke member aktif, atau kirim ke satu nomor' }, `
      <div class="grid grid-side">
        <form method="post" action="${ctx.base}/whatsapp/broadcast">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Target</span>
              <select name="type">
                <option value="all">Semua pelanggan (opt-in)</option>
                <option value="b2c">Member B2C</option>
                <option value="b2b">Pelanggan B2B</option>
              </select>
            </label>
            <label class="field"><span>Minimum poin</span><input name="min_points" type="number" min="0" value="0"></label>
            <label class="field field-full"><span>Isi pesan broadcast</span>
              <textarea name="message" required placeholder="Promo akhir pekan: diskon 15% untuk semua menu…">${U.h(preset || '')}</textarea>
            </label>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" type="submit">${L.icon('send', 15)} Kirim broadcast</button>
            <span class="hint-text">${U.num(customersToBroadcast)} pelanggan memiliki nomor WhatsApp & opt-in.</span>
          </div>
        </form>
        <form method="post" action="${ctx.base}/whatsapp/send">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Nomor WhatsApp</span><input name="to" required placeholder="08xx / 62xx"></label>
            <label class="field"><span>Nama (opsional)</span><input name="name" placeholder="Nama pelanggan"></label>
            <label class="field field-full"><span>Pesan</span><textarea name="body" required placeholder="Halo, pesanan Anda sudah siap…"></textarea></label>
          </div>
          <div class="form-actions"><button class="btn btn-ghost" type="submit">Kirim ke satu nomor</button></div>
        </form>
      </div>`) : ''}

    <div class="grid grid-side">
      ${L.card({ title: 'Balasan otomatis', subtitle: 'Kata kunci dipisahkan koma; yang pertama cocok akan dipakai' }, `
        <div>${ruleRows || L.empty('Belum ada aturan balasan')}</div>
        ${canWrite ? `<details class="disclosure" style="margin-top:14px">
          <summary>${L.icon('plus', 15)} Tambah aturan balasan</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/whatsapp/rules">
              ${ctx.csrfField}${ctx.backField}
              <div class="form-grid">
                <label class="field"><span>Kata kunci</span><input name="keyword" required placeholder="mis. menu,harga,daftar"></label>
                <label class="field field-full"><span>Balasan</span><textarea name="reply" required placeholder="Tulis balasan yang akan dikirim otomatis"></textarea></label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan aturan</button></div>
            </form>
          </div>
        </details>` : ''}`)}

      ${L.card({ title: 'Pengaturan integrasi', subtitle: 'Kredensial disimpan di server dan tidak pernah dikirim ke browser' }, `
        ${canWrite ? `<form method="post" action="${ctx.base}/whatsapp/settings">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Provider</span>
              <select name="wa_provider">
                ${Object.entries(WA.PROVIDERS).map(([k, v]) => `<option value="${k}" ${cfg('wa_provider') === k ? 'selected' : ''}>${U.h(v.label)}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Access token / API key</span>
              <input name="wa_token" type="password" placeholder="${cfg('wa_token') ? U.h(settings.mask(cfg('wa_token'))) : 'belum diisi'}" autocomplete="off">
            </label>
            <label class="field"><span>Phone Number ID (Meta)</span><input name="wa_phone_id" value="${U.h(cfg('wa_phone_id'))}" placeholder="mis. 1234567890"></label>
            <label class="field"><span>Base URL API (opsional)</span><input name="wa_api_url" value="${U.h(cfg('wa_api_url'))}" placeholder="https://graph.facebook.com/v20.0"></label>
            <label class="field"><span>Verify token webhook</span><input name="wa_verify_token" value="${U.h(cfg('wa_verify_token'))}"></label>
            <label class="field"><span>App secret (verifikasi signature)</span><input name="wa_app_secret" type="password" placeholder="${cfg('wa_app_secret') ? 'tersimpan' : 'opsional'}"></label>
            <label class="field"><span>Notifikasi struk</span>
              <select name="wa_notify_receipt"><option value="1" ${cfg('wa_notify_receipt') === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${cfg('wa_notify_receipt') !== '1' ? 'selected' : ''}>Nonaktif</option></select>
            </label>
            <label class="field"><span>Notifikasi member baru</span>
              <select name="wa_notify_member"><option value="1" ${cfg('wa_notify_member') === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${cfg('wa_notify_member') !== '1' ? 'selected' : ''}>Nonaktif</option></select>
            </label>
            <label class="field"><span>Balasan otomatis</span>
              <select name="wa_auto_reply"><option value="1" ${cfg('wa_auto_reply') === '1' ? 'selected' : ''}>Aktif</option><option value="0" ${cfg('wa_auto_reply') !== '1' ? 'selected' : ''}>Nonaktif</option></select>
            </label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Simpan pengaturan</button></div>
        </form>` : '<p class="hint-text">Hanya owner/manajer yang dapat mengubah kredensial.</p>'}
        <div style="margin-top:16px">
          <p class="persp-meta">URL webhook untuk provider</p>
          <div class="ds-code" style="margin-top:6px">${U.h(webhookUrl)}
GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
POST JSON (Meta / Fonnte / Wablas / format sederhana)</div>
          <div class="chip-row" style="margin-top:8px">
            <button class="btn btn-ghost btn-sm" type="button" data-copy="${U.h(webhookUrl)}">${L.icon('copy', 14)} Salin URL webhook</button>
          </div>
          <p class="hint-text" style="margin-top:8px">Daftarkan URL di atas pada dashboard provider Anda. Semua pesan masuk otomatis dicatat dan dibalas sesuai aturan.</p>
        </div>`) }
    </div>

    ${L.card({ title: 'Kotak keluar terakhir', subtitle: 'Riwayat pesan keluar beserta status pengiriman' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Waktu</th><th>Penerima</th><th>Pesan</th><th>Status</th><th></th></tr></thead>
        <tbody>${outboxRows || `<tr><td colspan="5">${L.empty('Belum ada pesan keluar')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'WhatsApp Business',
    subtitle: 'Notifikasi otomatis & balasan pelanggan',
    active: '/whatsapp',
    content: body,
  });
}

module.exports = { whatsappPage, statusBadge, renderMessages };
