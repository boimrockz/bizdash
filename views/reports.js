'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');

function statusBadge(status) {
  const map = { sent: ['Terkirim', 'good'], simulated: ['Simulasi', 'warn'], failed: ['Gagal', 'bad'], skipped: ['Dilewati', 'muted'] };
  const [label, tone] = map[status] || [status, 'muted'];
  return L.badge(label, tone);
}

function reportsPage(ctx, data) {
  const { history, lastRun, enabled, time, channel, phones, emails, waMode, mailMode, canWrite, preview } = data;

  const historyRows = history.map((h) => `<tr>
    <td class="muted">${U.h(String(h.created_at).slice(0, 16))}</td>
    <td>${L.badge(h.channel === 'email' ? 'Email' : 'WhatsApp', h.channel === 'email' ? 'indigo' : 'good')}</td>
    <td class="muted">${U.h(h.recipients || '—')}</td>
    <td>${statusBadge(h.status)}</td>
    <td class="muted">${U.h(h.detail || '')}</td>
  </tr>`).join('');

  const body = `
    ${preview ? `<div class="grid grid-side" style="align-items:start">
      ${L.card({ title: 'Pratinjau laporan hari ini', subtitle: U.dateLabel(preview.date) }, `
        <pre class="wa-preview">${U.h(preview.text)}</pre>`)}
      ${L.card({ title: 'Tampilan email', subtitle: 'HTML yang akan dikirim ke tim' }, `
        <div class="mail-preview">${preview.html}</div>`)}
    </div>` : ''}

    <div class="grid grid-4">
      ${[
        ['Jadwal', enabled ? `Setiap hari ${time}` : 'Nonaktif', enabled ? 'waktu WIB' : 'aktifkan di pengaturan'],
        ['Kanal', channel === 'both' ? 'WA + Email' : channel === 'email' ? 'Email' : 'WhatsApp', `${phones.length} nomor · ${emails.length} email`],
        ['WhatsApp', waMode.live ? 'Siap' : 'Simulasi', waMode.label],
        ['Email', mailMode.live ? 'Siap' : 'Simulasi', mailMode.label],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value" style="font-size:var(--fs-lg)">${U.h(value)}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${canWrite ? L.card({ title: 'Kirim sekarang', subtitle: 'Uji laporan tanpa menunggu jadwal pagi' }, `
      <form method="post" action="${ctx.base}/reports/run">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Kanal</span>
            <select name="channel">
              <option value="whatsapp" ${channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
              <option value="email" ${channel === 'email' ? 'selected' : ''}>Email</option>
              <option value="both" ${channel === 'both' ? 'selected' : ''}>WhatsApp + Email</option>
            </select>
          </label>
          <label class="field"><span>Nomor WhatsApp tambahan (opsional)</span><input name="phones" placeholder="0812xxx, 0813xxx"></label>
          <label class="field"><span>Email tambahan (opsional)</span><input name="emails" placeholder="owner@kopirimba.id"></label>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${L.icon('send', 15)} Kirim laporan sekarang</button>
          <a class="btn btn-ghost" href="${ctx.link('/reports', { preview: '1' })}">Lihat pratinjau</a>
          <a class="btn btn-ghost" href="${ctx.base}/settings/integrations">Atur jadwal & penerima</a>
        </div>
      </form>`) : ''}

    ${L.card({ title: 'Ringkasan yang dikirim', subtitle: 'Isi pesan laporan pagi (contoh dari data hari ini)' }, `
      <pre class="wa-preview">${U.h(preview ? preview.text : 'Buka pratinjau untuk melihat isi laporan.')}</pre>
      <p class="hint-text" style="margin-top:10px">Laporan menyertakan: pemasukan & pengeluaran bulan ini, penjualan kemarin, cabang terbaik, jam kerja tim, stok menipis, langganan jatuh tempo, KPI berisiko, dan proyeksi arus kas bulan depan.</p>`)}

    ${L.card({ title: 'Riwayat pengiriman', subtitle: `${history.length} pengiriman terakhir` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Waktu</th><th>Kanal</th><th>Penerima</th><th>Status</th><th>Catatan</th></tr></thead>
        <tbody>${historyRows || `<tr><td colspan="5">${L.empty('Belum ada laporan terkirim', 'Klik "Kirim laporan sekarang" untuk mencoba.')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Scheduled Report',
    subtitle: 'Ringkasan performa otomatis setiap pagi',
    active: '/reports',
    content: body,
  });
}

module.exports = { reportsPage, statusBadge };
