'use strict';

const U = require('../lib/util');
const L = require('./layout');
const R = require('../lib/ranking');
const { ROLE_LABELS } = require('../lib/auth');

const MEDALS = ['🥇', '🥈', '🥉'];

function scoreRing(score) {
  const val = U.clamp(score, 0, 130);
  const pct = (val / 130) * 100;
  const color = val >= 95 ? 'var(--good)' : val >= 85 ? 'var(--brand)' : val >= 70 ? 'var(--warn)' : 'var(--bad)';
  return `<span class="rank-score" style="--pct:${pct.toFixed(1)};--ring:${color}"><b>${U.num(score, 1)}</b></span>`;
}

function indicatorBars(row) {
  const items = [
    ['Capaian target', row.indicator.achievement],
    ['Pertumbuhan', row.indicator.growth],
    ['Margin', row.indicator.margin],
    ['Member', row.indicator.member],
    ['Kedisiplinan', row.indicator.discipline],
  ];
  return `<div class="rank-indicators">${items.map(([label, v]) => `
    <div class="rank-ind">
      <span>${U.h(label)}</span>
      ${L.pbar(v, v >= 90 ? 'good' : v >= 75 ? 'indigo' : v >= 60 ? 'warn' : 'bad', 6)}
      <em>${Math.round(v)}</em>
    </div>`).join('')}</div>`;
}

function leaderboardPage(ctx, data) {
  const { branches, teams, summary, month } = data;

  const branchRows = branches.map((r) => `<article class="rank-card ${r.rank <= 3 ? 'is-top' : ''}">
    <div class="rank-head">
      <div class="rank-pos">${MEDALS[r.rank - 1] || '#' + r.rank}</div>
      <div class="rank-name">
        <strong>${U.h(r.name)}</strong>
        <span>${U.h(r.level === 'outlet' ? 'Outlet' : 'Unit')} · ${U.num(r.transactions)} nota</span>
      </div>
      ${scoreRing(r.score)}
    </div>
    <div class="rank-metrics">
      <div><span>Pendapatan</span><b>${U.idrShort(r.revenue)}</b></div>
      <div><span>vs bulan lalu</span><b class="${r.growth >= 0 ? 'up' : 'down'}">${r.growth >= 0 ? '+' : ''}${U.pct(r.growth)}</b></div>
      <div><span>Target</span><b>${r.achievement ? U.pct(r.achievement, 0) : '—'}</b></div>
      <div><span>Margin</span><b>${U.pct(r.margin)}</b></div>
      <div><span>Member</span><b>${U.pct(r.memberShare, 0)}</b></div>
      <div><span>Telat</span><b>${r.lateDays} hari</b></div>
    </div>
    ${indicatorBars(r)}
  </article>`).join('');

  const teamRows = teams.map((t) => `<tr>
    <td class="num"><span class="rank-mini ${t.rank <= 3 ? 'is-top' : ''}">${MEDALS[t.rank - 1] || t.rank}</span></td>
    <td><span class="strong">${U.h(t.name)}</span><span class="sub-cell">${U.h(ROLE_LABELS[t.role] || t.role)} · ${U.h(t.company || '')}</span></td>
    <td class="num">${scoreRing(t.score)}</td>
    <td class="num">${t.kpiCount ? U.pct(t.kpiScore, 0) : '—'}</td>
    <td class="num">${U.num(t.hours, 1)} jam</td>
    <td class="num">${t.lateDays ? `<span style="color:var(--warn)">${t.lateDays}×</span>` : '—'}</td>
    <td class="num">${U.pct(t.punctuality, 0)}</td>
  </tr>`).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Cabang terbaik', summary.best ? summary.best.name : '—', summary.best ? `skor ${U.num(summary.best.score, 1)}` : 'belum ada data'],
        ['Rata-rata skor cabang', U.num(summary.avg, 1), `${branches.length} cabang dinilai`],
        ['Selisih terbaik–terlemah', U.num(summary.spread, 1) + ' poin', summary.worst ? `terlemah: ${summary.worst.name}` : '—'],
        ['Anggota tim terbaik', summary.bestTeam ? summary.bestTeam.name : '—', summary.bestTeam ? `skor ${U.num(summary.bestTeam.score, 1)}` : 'belum ada data'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value" style="font-size:var(--fs-lg)">${U.h(value)}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Leaderboard cabang', subtitle: `${U.monthLabel(month)} · skor komposit 5 indikator (target 30%, pertumbuhan 20%, margin 20%, member 15%, kedisiplinan 15%)` }, `
      <div class="rank-list">${branchRows || L.empty('Belum ada cabang untuk dinilai')}</div>`)}

    ${L.card({ title: 'Leaderboard tim', subtitle: 'Skor dari pencapaian KPI (50%), ketepatan waktu (25%), jam kerja (15%), dan kehadiran (10%)' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th class="num">#</th><th>Anggota</th><th class="num">Skor</th><th class="num">KPI</th><th class="num">Jam kerja</th><th class="num">Terlambat</th><th class="num">Ketepatan</th></tr></thead>
        <tbody>${teamRows || `<tr><td colspan="7">${L.empty('Belum ada anggota tim')}</td></tr>`}</tbody>
      </table></div>`)}

    ${L.card({ title: 'Cara skor dihitung', subtitle: 'Transparan agar tim tahu apa yang dikejar' }, `
      <div class="grid grid-side">
        <div>
          <p class="persp-meta" style="margin-bottom:6px">Cabang / outlet</p>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Indikator</th><th class="num">Bobot</th><th>Sumber</th></tr></thead>
            <tbody>
              <tr><td>Capaian vs target</td><td class="num">${R.WEIGHTS.achievement}%</td><td class="muted">Target bulanan di halaman keuangan</td></tr>
              <tr><td>Pertumbuhan MoM</td><td class="num">${R.WEIGHTS.growth}%</td><td class="muted">Pendapatan vs bulan sebelumnya</td></tr>
              <tr><td>Margin bersih</td><td class="num">${R.WEIGHTS.margin}%</td><td class="muted">POS + beban operasional</td></tr>
              <tr><td>Porsi transaksi member</td><td class="num">${R.WEIGHTS.member}%</td><td class="muted">Kanal B2C member</td></tr>
              <tr><td>Kedisiplinan absensi</td><td class="num">${R.WEIGHTS.discipline}%</td><td class="muted">Hari hadir / hari terjadwal</td></tr>
            </tbody>
          </table></div>
        </div>
        <ul class="labour-notes">
          <li>Skor per indikator dibatasi 0–130 agar prestasi luar biasa tetap terlihat tanpa mendominasi.</li>
          <li>Cabang tanpa penjualan tidak diberi skor nol, tetapi dihitung dari target bila tersedia.</li>
          <li>Unit bisnis yang memiliki outlet tidak dinilai terpisah agar tidak dobel.</li>
          <li>Bandingkan dengan periode lain lewat filter bulan di atas.</li>
        </ul>
      </div>`)}
  `;

  return L.shell(ctx, {
    title: 'Leaderboard Performa',
    subtitle: `Perbandingan cabang & tim · ${U.monthLabel(month)}`,
    active: '/leaderboard',
    content: body,
  });
}

module.exports = { leaderboardPage, scoreRing, MEDALS };
