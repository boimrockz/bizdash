'use strict';

const U = require('../lib/util');
const L = require('./layout');
const C = require('./charts');
const { can, ROLE_LABELS } = require('../lib/auth');

/**
 * Dashboard khusus mobile: satu kolom, angka besar, aksi cepat di bawah.
 * Memakai shell yang sama tetapi tanpa sidebar (bodyClass mobile-mode).
 */
function mobilePage(ctx, data) {
  const {
    fin, prev, daySales, dayTrend, series7, topBranch, alerts,
    cash, projection, attendance, subs, activeShipments, tasks,
  } = data;
  const delta = U.deltaPct(fin.revenue, prev.revenue);
  const net = fin.net;

  const quick = [
    can(ctx.user, 'pos_write') ? ['/pos', 'Kasir', 'cart'] : null,
    can(ctx.user, 'wa_read') ? ['/whatsapp', 'WhatsApp', 'chat'] : null,
    can(ctx.user, 'shipping_read') ? ['/shipping', 'Kirim', 'truck'] : null,
    can(ctx.user, 'attendance_read') || can(ctx.user, 'attendance_self') ? ['/attendance', 'Absensi', 'clock'] : null,
    can(ctx.user, 'finance_read') ? ['/finance', 'Keuangan', 'wallet'] : null,
  ].filter(Boolean);

  const card = (label, value, sub, tone) => `<div class="m-card">
    <span class="m-label">${U.h(label)}</span>
    <strong class="m-value" ${tone ? `style="color:${tone}"` : ''}>${value}</strong>
    ${sub ? `<span class="m-sub">${sub}</span>` : ''}
  </div>`;

  const body = `
    <div class="m-head">
      <div>
        <span class="m-eyebrow">${U.dateLabel(U.todayISO())}</span>
        <h2>Halo, ${U.h(ctx.user.name.split(' ')[0])}</h2>
        <span class="m-sub">${U.h(ctx.scopeCompany ? ctx.scopeCompany.name : 'Semua cabang')} · ${U.h(ROLE_LABELS[ctx.user.role])}</span>
      </div>
      <a class="m-avatar" href="${ctx.base}/onboarding" title="Panduan fitur">${U.h(U.initials(ctx.user.name))}</a>
    </div>

    <div class="m-hero">
      <div class="m-hero-top">
        <span>Pendapatan bulan ini</span>
        <span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${U.pct(Math.abs(delta))}</span>
      </div>
      <strong>${U.idr(fin.revenue)}</strong>
      <div class="m-hero-row">
        <div><span>Arus kas bersih</span><b>${U.idrShort(cash.net)}</b></div>
        <div><span>Laba bersih</span><b>${U.idrShort(net)}</b></div>
        <div><span>Nota</span><b>${U.num(fin.transactions)}</b></div>
      </div>
      ${C.sparkline(series7.map((s) => s.revenue), { width: 300, height: 46, color: '#ffffff' })}
    </div>

    <div class="m-grid">
      ${card('Penjualan hari ini', U.idrShort(daySales.v), `${daySales.n} nota · ${dayTrend >= 0 ? '+' : ''}${U.pct(dayTrend)} vs kemarin`)}
      ${card('Margin bersih', U.pct(fin.margin), 'bulan berjalan', fin.margin >= 8 ? 'var(--good)' : 'var(--warn)')}
      ${card('Cabang teratas', topBranch ? topBranch.name : '—', topBranch && topBranch.ach ? `capaian ${U.pct(topBranch.ach, 0)}` : 'belum ada target')}
      ${card('Tim hadir', `${attendance.days} hari`, `telat ${attendance.lateDays} · absen ${attendance.absentDays}`)}
    </div>

    <a class="m-projection" href="${ctx.base}/finance">
      <div>
        <span class="m-label">Proyeksi arus kas ${projection.months[0] ? U.monthShort(projection.months[0].month) : 'depan'}</span>
        <strong>${projection.months[0] ? U.idrShort(projection.months[0].net) : '—'}</strong>
        <span class="m-sub">${projection.months[0] ? `rentang ${U.idrShort(projection.months[0].low)} – ${U.idrShort(projection.months[0].high)}` : ''}</span>
      </div>
      <span class="m-arrow">${L.icon('trendUp', 18)}</span>
    </a>

    <div class="m-section">
      <div class="m-section-head"><h3>Perlu perhatian</h3><a href="${ctx.base}/">Semua</a></div>
      ${alerts.slice(0, 4).map((a) => `<div class="m-alert ${a.tone}">
        <span class="m-alert-ico">${L.icon(a.icon || 'alert', 15)}</span>
        <div><strong>${U.h(a.title)}</strong><span>${U.h(a.detail)}</span></div>
      </div>`).join('') || `<p class="hint-text">Semua indikator aman hari ini.</p>`}
    </div>

    <div class="m-grid">
      ${card('Langganan aktif', U.num(subs.active), `${subs.overdue} menunggak · MRR ${U.idrShort(subs.mrr)}`)}
      ${card('Pengiriman berjalan', U.num(activeShipments), 'perlu dipantau')}
    </div>

    ${tasks.length ? `<div class="m-section">
      <div class="m-section-head"><h3>Tugas hari ini</h3><a href="${ctx.base}/attendance/schedule">Jadwal</a></div>
      ${tasks.map((t) => `<a class="m-task" href="${t.href}">
        <span class="m-task-dot" style="background:${t.color}"></span>
        <div><strong>${U.h(t.title)}</strong><span>${U.h(t.sub)}</span></div>
        ${L.icon('arrowRight', 15)}
      </a>`).join('')}
    </div>` : ''}

  `;

  return L.shell(ctx, {
    title: 'Dashboard Mobile',
    subtitle: 'Pantau bisnis dari HP',
    active: '/mobile',
    content: body,
    bodyClass: 'mobile-mode',
  });
}

module.exports = { mobilePage };
