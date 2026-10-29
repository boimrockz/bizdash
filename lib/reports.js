'use strict';

const U = require('./util');
const Q = require('./queries');
const F = require('./forecast');
const attendance = require('./attendance');
const subscriptions = require('./subscriptions');
const inventory = require('./inventory');
const wa = require('./whatsapp');
const mailer = require('./mailer');
const settings = require('./settings');

/**
 * Menyusun ringkasan harian: keuangan bulan berjalan, penjualan kemarin,
 * cabang terbaik, absensi, stok kritis, dan langganan yang perlu ditagih.
 */
function buildSummary(db, scopeIds, opts = {}) {
  const month = opts.month || U.currentMonthKey();
  const today = U.todayISO();
  const prevDay = shiftDate(today, -1);
  const ph = scopeIds.map(() => '?').join(',') || 'NULL';

  const fin = Q.financeFor(db, scopeIds, month);
  const cash = F.cashFlow(db, scopeIds, month);
  const series = Q.seriesFor(db, scopeIds, U.monthRange(month, 6));
  const projection = F.project(series, { horizon: 3 });

  const daySales = db.prepare(`SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM sales
    WHERE status='paid' AND company_id IN (${ph}) AND substr(sold_at,1,10) = ?`).get(...scopeIds, prevDay);
  const dayBefore = db.prepare(`SELECT COALESCE(SUM(total),0) v FROM sales
    WHERE status='paid' AND company_id IN (${ph}) AND substr(sold_at,1,10) = ?`).get(...scopeIds, shiftDate(today, -2));

  const channels = Q.channelMix(db, scopeIds, month);
  const members = Q.memberStats(db, scopeIds, month);
  const att = attendance.recap(db, scopeIds, month);
  const lowStock = inventory.summary(db, scopeIds).low.slice(0, 3);
  const subs = subscriptions.stats(db, scopeIds);
  const dueSoon = subscriptions.upcoming(db, scopeIds, 7);
  const okrs = Q.okrRows(db, scopeIds, U.quarterOf(month));
  const kpis = Q.kpiRows(db, scopeIds, month);
  const weakKpi = kpis.filter((k) => k.hasActual && k.score < 85).sort((a, b) => a.score - b.score).slice(0, 3);

  // peringkat cabang: cukup realisasi vs target (tanpa beban query berat)
  const perCompany = Q.revenueByCompany(db, scopeIds, month)
    .map((r) => ({ ...r, ach: r.target ? (r.revenue / r.target) * 100 : null }))
    .sort((a, b) => (b.ach || 0) - (a.ach || 0));
  const companyName = (id) => {
    const c = db.prepare('SELECT name FROM companies WHERE id = ?').get(id);
    return c ? c.name : '';
  };

  return {
    date: today,
    month,
    fin,
    cash,
    projection,
    daySales,
    dayBefore,
    channels,
    members,
    attendance: att.totals,
    lowStock,
    subs,
    dueSoon,
    okrs,
    weakKpi,
    topBranch: perCompany[0] ? { name: companyName(perCompany[0].company_id), ach: perCompany[0].ach, revenue: perCompany[0].revenue } : null,
    bottomBranch: perCompany.length > 1 ? { name: companyName(perCompany[perCompany.length - 1].company_id), ach: perCompany[perCompany.length - 1].ach, revenue: perCompany[perCompany.length - 1].revenue } : null,
  };
}

function shiftDate(dateStr, delta) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function fmt(n) {
  return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
}

function summaryText(s) {
  const lines = [];
  lines.push(`*Ringkasan Bisnis ${U.dateLabel(s.date)}*`);
  lines.push(`Kopi Rimba · data ${U.monthLabel(s.month)}`);
  lines.push('');
  lines.push(`*Keuangan bulan ini*`);
  lines.push(`Pemasukan: ${fmt(s.cash.inflow)}`);
  lines.push(`Pengeluaran: ${fmt(s.cash.outflow)}`);
  lines.push(`Arus kas bersih: ${fmt(s.cash.net)}`);
  lines.push(`Laba bersih: ${fmt(s.fin.net)} (margin ${U.pct(s.fin.margin)})`);
  lines.push('');
  lines.push(`*Penjualan kemarin*`);
  lines.push(`${s.daySales.n} nota · ${fmt(s.daySales.v)}`);
  const deltaDay = s.dayBefore.v ? ((s.daySales.v - s.dayBefore.v) / s.dayBefore.v) * 100 : 0;
  lines.push(`vs hari sebelumnya: ${deltaDay >= 0 ? '+' : ''}${U.pct(deltaDay)}`);
  lines.push('');
  lines.push(`*Cabang*`);
  if (s.topBranch) lines.push(`Terbaik: ${s.topBranch.name} (${s.topBranch.ach ? U.pct(s.topBranch.ach, 0) : '-'} target)`);
  if (s.bottomBranch) lines.push(`Perlu dorongan: ${s.bottomBranch.name} (${s.bottomBranch.ach ? U.pct(s.bottomBranch.ach, 0) : '-'} target)`);
  lines.push('');
  lines.push(`*Tim & operasional*`);
  lines.push(`Jam kerja: ${U.num(s.attendance.hours, 1)} jam · telat ${s.attendance.lateDays} hari · absen ${s.attendance.absentDays} hari`);
  if (s.lowStock.length) lines.push(`Stok menipis: ${s.lowStock.map((m) => m.name).join(', ')}`);
  lines.push('');
  lines.push(`*Langganan*`);
  lines.push(`Aktif ${s.subs.active} · menunggak ${s.subs.overdue} · MRR ${fmt(s.subs.mrr)}`);
  if (s.dueSoon.length) lines.push(`Jatuh tempo ≤7 hari: ${s.dueSoon.length} pelanggan (${s.dueSoon.slice(0, 3).map((d) => d.customer_name).join(', ')})`);
  if (s.weakKpi.length) {
    lines.push('');
    lines.push(`*KPI perlu perhatian*`);
    for (const k of s.weakKpi) lines.push(`- ${k.name}: ${U.pct(k.score, 0)}`);
  }
  const p1 = s.projection.months[0];
  if (p1) {
    lines.push('');
    lines.push(`*Proyeksi ${U.monthLabel(p1.month)}*`);
    lines.push(`Arus kas bersih ${fmt(p1.net)} (rentang ${fmt(p1.low)} – ${fmt(p1.high)})`);
  }
  return lines.join('\n').trim();
}

function summaryHtml(s) {
  const row = (label, value) => `<tr><td style="padding:6px 0;color:#635e82;font-size:13px">${label}</td>
    <td style="padding:6px 0;text-align:right;font-weight:600;font-size:13px">${value}</td></tr>`;
  const section = (title, rows) => `<h3 style="margin:20px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#8b86a8">${title}</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows}</table>`;
  const deltaDay = s.dayBefore.v ? ((s.daySales.v - s.dayBefore.v) / s.dayBefore.v) * 100 : 0;
  const p1 = s.projection.months[0];
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f4f2fd;border-radius:16px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#1c1838">Ringkasan Bisnis</h1>
    <p style="margin:0 0 18px;color:#635e82;font-size:13px">Kopi Rimba · ${U.dateLabel(s.date)} · data ${U.monthLabel(s.month)}</p>
    <div style="background:#fff;border-radius:14px;padding:18px 20px">
      ${section('Keuangan bulan ini', [
        row('Pemasukan', fmt(s.cash.inflow)),
        row('Pengeluaran', fmt(s.cash.outflow)),
        row('Arus kas bersih', fmt(s.cash.net)),
        row('Laba bersih', `${fmt(s.fin.net)} (${U.pct(s.fin.margin)})`),
      ].join(''))}
      ${section('Penjualan kemarin', [
        row('Nota', U.num(s.daySales.n)),
        row('Nilai', fmt(s.daySales.v)),
        row('vs hari sebelumnya', `${deltaDay >= 0 ? '+' : ''}${U.pct(deltaDay)}`),
      ].join(''))}
      ${section('Cabang', [
        s.topBranch ? row('Terbaik', `${s.topBranch.name} (${s.topBranch.ach ? U.pct(s.topBranch.ach, 0) : '-'})`) : '',
        s.bottomBranch ? row('Perlu dorongan', `${s.bottomBranch.name} (${s.bottomBranch.ach ? U.pct(s.bottomBranch.ach, 0) : '-'})`) : '',
      ].join(''))}
      ${section('Tim & operasional', [
        row('Jam kerja', `${U.num(s.attendance.hours, 1)} jam`),
        row('Keterlambatan', `${s.attendance.lateDays} hari`),
        row('Tidak hadir', `${s.attendance.absentDays} hari`),
        s.lowStock.length ? row('Stok menipis', s.lowStock.map((m) => m.name).join(', ')) : '',
      ].join(''))}
      ${section('Langganan', [
        row('Aktif / menunggak', `${s.subs.active} / ${s.subs.overdue}`),
        row('MRR', fmt(s.subs.mrr)),
        s.dueSoon.length ? row('Jatuh tempo ≤7 hari', String(s.dueSoon.length)) : '',
      ].join(''))}
      ${p1 ? section(`Proyeksi ${U.monthLabel(p1.month)}`, [
        row('Arus kas bersih', fmt(p1.net)),
        row('Rentang', `${fmt(p1.low)} – ${fmt(p1.high)}`),
      ].join('')) : ''}
    </div>
    <p style="margin:18px 0 0;font-size:11px;color:#8b86a8">Dikirim otomatis oleh BizDash setiap pagi.</p>
  </div>`;
}

function recipients(db, channel) {
  if (channel === 'email') {
    return String(settings.get(db, 'report_emails', '')).split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (channel === 'whatsapp') {
    return String(settings.get(db, 'report_phones', '')).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function logRun(db, data) {
  db.prepare(`INSERT INTO report_runs (channel, recipients, subject, status, detail, created_at) VALUES (?,?,?,?,?,?)`)
    .run(data.channel, data.recipients || '', data.subject || '', data.status, String(data.detail || '').slice(0, 400), U.localNow());
}

/** Jalankan laporan sekarang (manual atau dari scheduler). */
async function run(db, opts = {}) {
  const channel = ['whatsapp', 'email', 'both'].includes(opts.channel)
    ? opts.channel
    : settings.get(db, 'report_channel', 'whatsapp');
  const scopeIds = opts.scopeIds && opts.scopeIds.length
    ? opts.scopeIds
    : db.prepare('SELECT id FROM companies').all().map((r) => r.id);

  const summary = buildSummary(db, scopeIds, { month: opts.month });
  const text = summaryText(summary);
  const html = summaryHtml(summary);
  const subject = `Ringkasan bisnis ${U.dateLabel(summary.date)}`;
  const results = [];

  if (channel === 'whatsapp' || channel === 'both') {
    const to = opts.phones && opts.phones.length ? opts.phones : recipients(db, 'whatsapp');
    if (!to.length) {
      logRun(db, { channel: 'whatsapp', status: 'skipped', subject, detail: 'Nomor WhatsApp penerima belum diatur.' });
      results.push({ channel: 'whatsapp', ok: false, error: 'Nomor WhatsApp penerima belum diatur.' });
    } else {
      for (const phone of to.slice(0, 20)) {
        const res = await wa.send(db, {
          to: phone, body: text, isBot: true, relatedType: 'daily_report', name: 'Laporan Harian',
        });
        logRun(db, {
          channel: 'whatsapp', recipients: phone, subject,
          status: res.ok ? (res.simulated ? 'simulated' : 'sent') : 'failed',
          detail: res.ok ? (res.simulated ? 'Mode simulasi (kredensial belum diisi)' : 'Terkirim') : res.error,
        });
        results.push({ channel: 'whatsapp', phone, ...res });
      }
    }
  }

  if (channel === 'email' || channel === 'both') {
    const to = opts.emails && opts.emails.length ? opts.emails : recipients(db, 'email');
    if (!to.length) {
      logRun(db, { channel: 'email', status: 'skipped', subject, detail: 'Alamat email penerima belum diatur.' });
      results.push({ channel: 'email', ok: false, error: 'Alamat email penerima belum diatur.' });
    } else {
      const res = await mailer.send(db, { to: to.join(','), subject, text, html });
      logRun(db, {
        channel: 'email', recipients: to.join(','), subject,
        status: res.ok ? (res.simulated ? 'simulated' : 'sent') : 'failed',
        detail: res.ok ? (res.simulated ? 'Mode simulasi (provider email belum diisi)' : 'Terkirim') : res.error,
      });
      results.push({ channel: 'email', ...res });
    }
  }

  settings.set(db, 'report_last_run', U.localNow());
  return { channel, subject, summary, text, results };
}

function history(db, limit = 15) {
  return db.prepare('SELECT * FROM report_runs ORDER BY id DESC LIMIT ?').all(limit);
}

// ---------- scheduler: cek tiap menit, kirim sekali per hari pada jam yang diatur ----------
function startScheduler(db, log = console.log) {
  const tick = async () => {
    try {
      if (String(settings.get(db, 'report_enabled', '1')) !== '1') return;
      const now = U.localNow();
      const today = now.slice(0, 10);
      const hhmm = now.slice(11, 16);
      const target = settings.get(db, 'report_time', '07:00') || '07:00';
      const lastRun = String(settings.get(db, 'report_last_run', '') || '').slice(0, 10);
      if (hhmm !== target || lastRun === today) return;
      const result = await run(db, {});
      log(`[report] ${today} ${hhmm} → ${result.results.map((r) => `${r.channel}:${r.ok ? 'ok' : 'fail'}`).join(', ')}`);
    } catch (err) {
      log('[report] gagal: ' + (err.message || err));
    }
  };
  const timer = setInterval(tick, 60 * 1000);
  if (timer.unref) timer.unref();
  // cek sekali saat start (berguna bila server hidup tepat setelah jam kirim)
  setTimeout(tick, 15 * 1000).unref?.();
  return timer;
}

module.exports = { buildSummary, summaryText, summaryHtml, run, history, startScheduler, recipients };
