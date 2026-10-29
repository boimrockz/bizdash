'use strict';

const U = require('../lib/util');
const L = require('./layout');
const C = require('./charts');
const { can, ROLE_LABELS } = require('../lib/auth');

function statCard(opts) {
  const { label, value, icon, delta, sub, tone } = opts;
  const deltaHtml = delta === null || delta === undefined ? '' : (() => {
    const cls = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';
    const ico = delta > 0.5 ? 'trendUp' : delta < -0.5 ? 'trendDown' : 'arrowRight';
    return `<span class="delta ${cls}">${L.icon(ico, 12)} ${Math.abs(delta).toFixed(1)}%</span>`;
  })();
  return `<article class="stat">
    <div class="stat-top"><span class="stat-label">${U.h(label)}</span><span class="stat-ico">${L.icon(icon, 17)}</span></div>
    <div class="stat-value" ${tone ? `style="color:${tone}"` : ''}>${value}</div>
    <div class="stat-sub">${deltaHtml} ${sub || ''}</div>
  </article>`;
}

function alertsList(alerts) {
  if (!alerts.length) {
    return `<div class="alert-row"><div class="alert-ico good">${L.icon('check', 16)}</div>
      <div class="alert-text"><strong>Semua indikator utama terkendali</strong><span>Tidak ada KPI, OKR, atau aktivitas RACI yang melewati ambang batas risiko bulan ini.</span></div></div>`;
  }
  return alerts.map((a) => `<div class="alert-row">
    <div class="alert-ico ${a.tone}">${L.icon(a.icon || 'alert', 16)}</div>
    <div class="alert-text"><strong>${U.h(a.title)}</strong><span>${U.h(a.detail)}</span></div>
  </div>`).join('');
}

function narrative(fin, prev, target, bsc, companyName) {
  const parts = [];
  const ach = target ? (fin.revenue / target) * 100 : 0;
  const growth = U.deltaPct(fin.revenue, prev.revenue);
  parts.push(`Pendapatan ${U.h(companyName)} dari kebun sampai cangkir pada ${U.h(U.monthLabel(fin.month))} mencapai <b>${U.idr(fin.revenue)}</b> (${growth >= 0 ? 'naik' : 'turun'} ${U.pct(Math.abs(growth))} dibanding bulan lalu)${target ? `, atau <b>${U.pct(ach, 0)}</b> dari target <b>${U.idr(target)}</b>` : ''}.`);
  parts.push(`Laba bersih <b>${U.idr(fin.net)}</b> dengan margin <b>${U.pct(fin.margin)}</b>, sementara rasio beban operasional berada di <b>${U.pct(fin.expenseRatio)}</b> dari pendapatan.`);
  if (bsc && bsc.overall) {
    const weak = [...bsc.perspectives].filter((p) => p.kpiCount > 0).sort((a, b) => a.score - b.score)[0];
    parts.push(`Skor Balanced Scorecard keseluruhan <b>${U.pct(bsc.overall, 0)}</b>${weak && weak.score < 85 ? `, dengan perspektif <b>${U.h(weak.label)}</b> paling perlu perhatian (${U.pct(weak.score, 0)})` : ''}.`);
  }
  return `<div class="narrative">${parts.join(' ')}</div>`;
}

function channelBars(mix, total) {
  const rows = [
    ['Member B2C', mix.find((m) => m.channel === 'b2c') || { revenue: 0, n: 0 }, 'linear-gradient(90deg,#c1352d,#d9822b)'],
    ['Walk-in', mix.find((m) => m.channel === 'walkin') || { revenue: 0, n: 0 }, 'linear-gradient(90deg,#38bdf8,#22d3ee)'],
    ['B2B (kafe/distributor)', mix.find((m) => m.channel === 'b2b') || { revenue: 0, n: 0 }, 'linear-gradient(90deg,#f59e0b,#fbbf24)'],
  ];
  return rows.map(([label, row, grad]) => `<div class="channel-row">
    <div class="channel-head"><span>${U.h(label)}</span><strong>${U.idrShort(row.revenue)}</strong></div>
    <div class="pbar pbar-8"><span class="pbar-fill" style="width:${total ? U.clamp((row.revenue / total) * 100, 0, 100) : 0}%;background:${grad}"></span></div>
    <div class="channel-meta">${U.num(row.n)} nota · ${U.pct(total ? (row.revenue / total) * 100 : 0, 1)} dari pendapatan</div>
  </div>`).join('');
}

const SHIPPING = require('../lib/shipping');
const PO = require('../lib/pos-options');

// Sapaan mengikuti jam WIB supaya hero terasa hidup tanpa data tambahan.
function greeting() {
  const hour = Number(U.localNow().slice(11, 13)) || 9;
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/**
 * Hero halaman utama. Layer dekoratif (glow, cincin, biji kopi) digeser lebih lambat
 * dari scroll lewat `--par-y` (lihat initParallax di public/app.js) — parallax ringan,
 * dimatikan otomatis untuk pengguna prefers-reduced-motion.
 */
function dashHero(ctx, data) {
  const { fin, prev, target, bsc, okrs, raci } = data;
  const canFin = can(ctx.user, 'finance_read');
  const firstName = String(ctx.user.name || '').split(' ')[0];
  const scopeName = ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi semua unit';
  const growth = U.deltaPct(fin.revenue, prev.revenue);
  const achievement = target ? U.clamp((fin.revenue / target) * 100, 0, 999) : null;
  const okrAvg = okrs.length ? okrs.reduce((a, o) => a + o.progress, 0) / okrs.length : 0;
  const raciOpen = raci.filter((r) => r.status !== 'done').length;

  const today = U.todayISO();
  const daysInMonth = new Date(Number(ctx.month.slice(0, 4)), Number(ctx.month.slice(5, 7)), 0).getDate();
  const daysLeft = ctx.month === today.slice(0, 7) ? Math.max(0, daysInMonth - Number(today.slice(8, 10))) : 0;

  const copy = canFin
    ? `Pendapatan ${U.idr(fin.revenue)} (${growth >= 0 ? 'naik' : 'turun'} ${U.pct(Math.abs(growth))} dari bulan lalu) dengan laba bersih ${U.idr(fin.net)} — margin ${U.pct(fin.margin)}.`
    : `Ringkasan performa tim, KPI, dan aktivitas yang perlu perhatian pada ${U.monthLabel(ctx.month)}.`;

  const targetBlock = canFin
    ? (achievement === null
      ? `<p class="dash-hero__hint">Target pendapatan bulan ini belum ditetapkan.</p>`
      : `<div class="dash-hero__target">
          <div class="dash-hero__target-top"><span>Capaian target</span><strong>${U.pct(achievement, 0)}</strong></div>
          ${L.pbar(U.clamp(achievement, 0, 100), achievement >= 100 ? 'good' : 'indigo', 10)}
          <div class="dash-hero__target-meta">
            <span>Target ${U.idrShort(target)}</span>
            <span>${achievement >= 100 ? 'Target terlampaui' : 'Kurang ' + U.idrShort(Math.max(0, target - fin.revenue))}</span>
          </div>
          ${daysLeft ? `<p class="dash-hero__hint">${daysLeft} hari lagi di bulan ini.</p>` : ''}
        </div>`)
    : `<div class="dash-hero__target">
        <div class="dash-hero__target-top"><span>Progres OKR</span><strong>${U.pct(okrAvg, 0)}</strong></div>
        ${L.pbar(U.clamp(okrAvg, 0, 100), 'indigo', 10)}
        <div class="dash-hero__target-meta"><span>${okrs.length} objective</span><span>BSC ${U.pct(bsc.overall, 0)}</span></div>
        <p class="dash-hero__hint">${raciOpen} aktivitas RACI belum selesai.</p>
      </div>`;

  const actions = [
    can(ctx.user, 'pos_write') ? `<a class="btn btn-primary btn-sm" href="${ctx.base}/pos">${L.icon('plus', 15)} Transaksi baru</a>` : '',
    canFin ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/finance">${L.icon('wallet', 15)} Laporan keuangan</a>` : '',
    !canFin && can(ctx.user, 'perf_read') ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/performance/kpi">${L.icon('gauge', 15)} KPI tim</a>` : '',
  ].filter(Boolean).join('');

  return `<section class="dash-hero" data-parallax aria-label="Ringkasan utama">
    <div class="dash-hero__layer dash-hero__layer--glow" aria-hidden="true"></div>
    <div class="dash-hero__layer dash-hero__layer--ring" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="100" cy="100" r="96"/><circle cx="100" cy="100" r="72"/><circle cx="100" cy="100" r="48"/></svg>
    </div>
    <div class="dash-hero__layer dash-hero__layer--bean" aria-hidden="true">
      <svg viewBox="0 0 100 140" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><ellipse cx="50" cy="70" rx="33" ry="51"/><path d="M50 23c15 21 15 73 0 94"/></svg>
    </div>
    <div class="dash-hero__inner">
      <p class="dash-hero__eyebrow">${U.h(U.monthLabel(ctx.month))} · ${U.h(scopeName)}</p>
      <h2>${U.h(greeting())}, ${U.h(firstName)}</h2>
      <p class="dash-hero__copy">${U.h(copy)}</p>
      <div class="dash-hero__actions">${actions}</div>
    </div>
    <div class="dash-hero__side">${targetBlock}</div>
  </section>`;
}

function dashboard(ctx, data) {
  const { fin, prev, target, series, bsc, kpis, okrs, raci, perCompany, topProducts, expenseRows, recent, alerts,
    channel, members, promo, materials, labor, attendanceRecap, attendanceToday,
    waStats, waThreads, shipStats, shipActive } = data;
  const canFin = can(ctx.user, 'finance_read');
  const canPerf = can(ctx.user, 'perf_read');
  const scopeName = ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi grup';
  const achievement = target ? (fin.revenue / target) * 100 : null;
  const kpiScored = kpis.filter((k) => k.hasActual);
  const onTrack = kpiScored.filter((k) => k.score >= 85).length;
  const okrAvg = okrs.length ? okrs.reduce((a, o) => a + o.progress, 0) / okrs.length : 0;
  const raciOpen = raci.filter((r) => r.status !== 'done');
  const today = U.todayISO();

  const finStats = [];
  const perfStats = [];
  if (canFin) {
    finStats.push(statCard({
      label: 'Pendapatan bulan ini', value: U.idr(fin.revenue), icon: 'trendUp',
      delta: U.deltaPct(fin.revenue, prev.revenue),
      sub: achievement !== null ? `· ${U.pct(achievement, 0)} dari target` : '',
    }));
    finStats.push(statCard({
      label: 'Laba bersih', value: U.idr(fin.net), icon: 'wallet',
      delta: U.deltaPct(fin.net, prev.net),
      sub: `· margin ${U.pct(fin.margin)}`,
    }));
    finStats.push(statCard({
      label: 'Beban operasional', value: U.idr(fin.expenses), icon: 'layers',
      delta: U.deltaPct(fin.expenses, prev.expenses),
      sub: `· rasio ${U.pct(fin.expenseRatio)}`,
    }));
    finStats.push(statCard({
      label: 'Transaksi POS', value: U.num(fin.transactions) + ' nota', icon: 'cart',
      delta: U.deltaPct(fin.transactions, prev.transactions),
      sub: `· rata-rata ${U.idrShort(fin.avgTicket)}`,
    }));
  }
  if (canPerf) {
    perfStats.push(statCard({
      label: 'Skor Balanced Scorecard', value: U.pct(bsc.overall, 0), icon: 'layers',
      sub: `· ${onTrack}/${kpiScored.length} KPI on track`,
      tone: bsc.overall >= 85 ? '#0f9d76' : bsc.overall >= 70 ? '#d97706' : '#dc2626',
    }));
    perfStats.push(statCard({
      label: 'Progres OKR', value: U.pct(okrAvg, 0), icon: 'target',
      sub: `· ${okrs.length} objective aktif kuartal ini`,
      tone: okrAvg >= 60 ? '#c1352d' : '#b9791a',
    }));
    perfStats.push(statCard({
      label: 'Aktivitas RACI terbuka', value: String(raciOpen.length), icon: 'users',
      sub: `· ${raci.filter((r) => r.status === 'blocked').length} terhambat, ${raci.filter((r) => r.status === 'done').length} selesai`,
    }));
  }
  if (!canFin && !canPerf) {
    finStats.push(statCard({ label: 'Transaksi bulan ini', value: U.num(fin.transactions), icon: 'cart', sub: `· ${U.idr(fin.revenue)} penjualan` }));
  }


  const perCompanyRows = perCompany.map((row) => {
    const comp = data.companyMap.get(row.company_id);
    const ach = row.target ? (row.revenue / row.target) * 100 : null;
    return `<tr>
      <td><span class="strong">${U.h(comp ? comp.name : '—')}</span><span class="sub-cell">${U.h(comp ? comp.level : '')}</span></td>
      <td class="num">${U.idrShort(row.revenue)}</td>
      <td class="num">${row.target ? U.idrShort(row.target) : '—'}</td>
      <td class="num">${ach === null ? '—' : `<span class="badge badge-${ach >= 100 ? 'good' : ach >= 85 ? 'indigo' : ach >= 70 ? 'warn' : 'bad'}">${U.pct(ach, 0)}</span>`}</td>
      <td class="num">${U.num(row.transactions)}</td>
    </tr>`;
  }).join('');

  // label metode bayar & jenis menu mengikuti Master Data POS
  const payLabels = PO.labelMap(ctx.db, 'payment_method');
  const kindLabels = PO.labelMap(ctx.db, 'menu_type');

  const topProductRows = topProducts.map((p) => `<tr>
    <td><span class="strong">${U.h(p.name)}</span><span class="sub-cell">${U.h(p.category || '—')}${p.kind && p.kind !== 'menu' ? ' · ' + U.h(kindLabels[p.kind] || p.kind) : ''}</span></td>
    <td class="num">${U.num(p.qty)}</td>
    <td class="num">${U.idrShort(p.revenue)}</td>
    <td class="num">${U.pct(p.revenue ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0, 0)}</td>
  </tr>`).join('');

  const pnlRows = [
    ['Pendapatan penjualan', fin.revenue, ''],
    ['Harga pokok penjualan', -fin.cogs, 'muted'],
    ['Laba kotor', fin.gross, 'total'],
    ['Beban operasional', -fin.expenses, 'muted'],
    ['Pendapatan lain-lain', fin.income, 'muted'],
    ['Laba bersih', fin.net, 'total'],
  ];

  const attention = kpiScored.filter((k) => k.score < 85).sort((a, b) => a.score - b.score).slice(0, 5);

  const okrCards = okrs.map((o) => {
    const tone = o.status === 'off_track' ? 'bad' : o.status === 'at_risk' ? 'warn' : 'good';
    const label = o.status === 'off_track' ? 'Off track' : o.status === 'at_risk' ? 'Berisiko' : o.status === 'done' ? 'Selesai' : 'On track';
    return `<div class="okr">
      <div class="okr-head">
        <div>
          <div class="okr-title">${U.h(o.title)}</div>
          <div class="okr-sub">${U.h(o.company_name)} · ${U.h(U.quarterLabel(o.period))} · PIC ${U.h(o.owner_name || '—')}</div>
        </div>
        ${L.badge(label, tone)}
      </div>
      ${o.krs.slice(0, 3).map((kr) => `
        <div class="kr">
          <span class="kr-name">${U.h(kr.title)}</span>
          <span class="kr-val">${U.formatCompact(kr.current_value, kr.unit)} / ${U.formatCompact(kr.target_value, kr.unit)}</span>
          ${L.pbar(kr.progress.pct, kr.progress.pct >= 70 ? 'good' : kr.progress.pct >= 40 ? 'indigo' : 'warn')}
        </div>`).join('')}
      <div class="meter-row">
        <span class="meter-label" style="color:var(--ink-mute);font-size:11.5px">Progres objective</span>
        <span class="meter-value">${U.pct(o.progress, 0)}</span>
      </div>
      ${L.pbar(o.progress, 'indigo')}
    </div>`;
  }).join('');

  const raciCounts = ['blocked', 'in_progress', 'not_started', 'done'].map((s) => ({
    status: s,
    label: require('../lib/queries').RACI_STATUS[s],
    count: raci.filter((r) => r.status === s).length,
  }));
  const overdue = raci.filter((r) => r.status !== 'done' && r.due_date && r.due_date < today);

  const recentRows = recent.map((s) => `<tr>
    <td><span class="strong">${U.h(s.invoice_no)}</span><span class="sub-cell">${U.h(payLabels[s.payment_method] || s.payment_method)} · ${U.h(s.source)}</span></td>
    <td>${U.h(s.company)}</td>
    <td class="num">${U.h(s.sold_at.slice(0, 10))}</td>
    <td class="num strong">${U.idr(s.total)}</td>
  </tr>`).join('');

  const body = `
    ${dashHero(ctx, data)}

    ${finStats.length ? `<div class="grid grid-4">${finStats.join('')}</div>` : ''}

    ${canFin ? `<section class="card"><div class="card-body">
      ${narrative(fin, prev, target, canPerf ? bsc : null, scopeName)}
    </div></section>` : ''}

    ${canFin ? L.card({ title: 'Kinerja keuangan 12 bulan', subtitle: 'Pendapatan, beban operasional, dan laba bersih per bulan' }, `
      ${C.comboChart(series)}
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot rev"></span>Pendapatan</span>
        <span class="legend-item"><span class="legend-dot exp"></span>Beban operasional</span>
        <span class="legend-item"><span class="legend-dot net"></span>Laba bersih</span>
      </div>`) : ''}

    ${canFin ? `<div class="grid grid-side">
      ${L.card({ title: 'Kanal penjualan', subtitle: 'B2C member, walk-in, dan B2B ' + U.monthLabel(fin.month) }, `
        <div class="channel-list">${channelBars(channel, channel.reduce((a, r) => a + r.revenue, 0))}</div>
        <div class="chip-row" style="margin-top:14px">
          ${L.badge('Total ' + U.idrShort(channel.reduce((a, r) => a + r.revenue, 0)), 'indigo')}
          ${L.badge('Nota ' + U.num(channel.reduce((a, r) => a + r.n, 0)), 'muted')}
        </div>`)}

      ${L.card({ title: 'Membership & poin', subtitle: 'Basis pelanggan setia Anda' }, `
        <div class="grid grid-2" style="gap:10px">
          ${[
            ['Member B2C', U.num(members.b2c), 'terdaftar'],
            ['Pelanggan B2B', U.num(members.b2b), 'kafe & distributor'],
            ['Aktif bulan ini', U.num(members.active), 'pernah bertransaksi'],
            ['Poin beredar', U.num(members.pointsBalance), U.idrShort(members.pointsBalance * 100)],
          ].map(([label, value, sub]) => `<div class="mini-stat">
            <span>${U.h(label)}</span><strong>${value}</strong><em>${U.h(sub)}</em>
          </div>`).join('')}
        </div>
        <div class="meter-row" style="margin-top:14px">
          <span class="meter-label">Porsi transaksi member</span>
          <span class="meter-value">${U.pct(members.share, 0)}</span>
        </div>
        ${L.pbar(members.share, members.share >= 60 ? 'good' : 'indigo', 8)}
        <div class="chip-row" style="margin-top:12px">
          ${L.badge('Poin terbit ' + U.num(members.pointsEarned), 'good')}
          ${L.badge('Poin ditukar ' + U.num(members.pointsUsed), 'warn')}
        </div>`)}
    </div>` : ''}

    ${canFin ? `<div class="grid grid-side">
      ${L.card({ title: 'Laba rugi ' + U.monthLabel(fin.month), subtitle: 'Ringkasan bulan berjalan' }, `
        <div class="table-wrap"><table class="data">
          <tbody>
            ${pnlRows.map(([label, val, kind]) => `<tr class="${kind === 'total' ? 'is-total' : ''}">
              <td class="${kind === 'muted' ? 'muted' : ''}">${U.h(label)}</td>
              <td class="num ${val < 0 ? '' : 'strong'}" style="${val < 0 ? 'color:var(--ink-soft)' : ''}">${val < 0 ? '(' + U.idr(Math.abs(val)) + ')' : U.idr(val)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="chip-row" style="margin-top:14px">
          ${L.badge('Margin kotor ' + U.pct(fin.grossMargin), 'indigo')}
          ${L.badge('Margin bersih ' + U.pct(fin.margin), fin.margin >= 10 ? 'good' : 'warn')}
          ${L.badge('Rasio beban ' + U.pct(fin.expenseRatio), 'muted')}
        </div>`)}

      ${L.card({ title: 'Komposisi beban operasional', subtitle: U.monthLabel(fin.month) }, C.expenseDonut(expenseRows, fin.expenses))}
    </div>` : ''}

    ${canFin ? `<div class="grid grid-side">
      ${L.card({ title: 'Promo paling berdampak', subtitle: 'Diskon yang diberikan bulan ini', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/promos">Kelola</a>` }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Promo</th><th class="num">Nota</th><th class="num">Diskon</th></tr></thead>
          <tbody>${promo.map((r) => `<tr>
            <td><span class="strong">${U.h(r.label)}</span></td>
            <td class="num">${U.num(r.n)}</td>
            <td class="num" style="color:var(--bad)">− ${U.idrShort(r.discount)}</td>
          </tr>`).join('') || `<tr><td colspan="3">${L.empty('Belum ada promo terpakai bulan ini')}</td></tr>`}</tbody>
        </table></div>`)}

      ${L.card({ title: 'Bahan baku perlu restock', subtitle: 'Stok di bawah ambang minimum', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/farm">Stok</a>` }, `
        ${materials.low.length ? materials.low.slice(0, 5).map((m) => `<div class="alert-row">
          <div class="alert-ico ${m.stock <= 0 ? 'bad' : 'warn'}">${L.icon('sprinkle', 16)}</div>
          <div class="alert-text"><strong>${U.h(m.name)}</strong><span>${U.h(m.company_name)} · sisa ${U.num(m.stock, 2)} ${U.h(m.unit)} (min ${U.num(m.min_stock, 2)})</span></div>
        </div>`).join('') : `<div class="alert-row"><div class="alert-ico good">${L.icon('check', 16)}</div>
          <div class="alert-text"><strong>Stok bahan aman</strong><span>Nilai stok ${U.idrShort(materials.value)} di ${materials.count} jenis bahan.</span></div></div>`}
        <div class="chip-row" style="margin-top:12px">${L.badge('Nilai stok ' + U.idrShort(materials.value), 'indigo')}</div>`)}
    </div>` : ''}

    ${canFin ? `<div class="grid grid-side">
      ${L.card({ title: 'Kinerja per unit & outlet', subtitle: 'Pendapatan bulan berjalan vs target' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Entitas</th><th class="num">Pendapatan</th><th class="num">Target</th><th class="num">Capaian</th><th class="num">Nota</th></tr></thead>
          <tbody>${perCompanyRows || `<tr><td colspan="5">${L.empty('Belum ada penjualan pada periode ini')}</td></tr>`}</tbody>
        </table></div>`)}

      ${L.card({ title: 'Menu & produk terlaris', subtitle: 'Berdasarkan jumlah terjual bulan ini', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/pos/products">Menu & resep</a>` }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Menu / produk</th><th class="num">Qty</th><th class="num">Penjualan</th><th class="num">Margin</th></tr></thead>
          <tbody>${topProductRows || `<tr><td colspan="4">${L.empty('Belum ada data penjualan')}</td></tr>`}</tbody>
        </table></div>`)}
    </div>` : ''}

    ${(waStats || shipStats) ? `<div class="grid grid-side">
      ${waStats ? L.card({ title: 'WhatsApp Business', subtitle: 'Pesan pelanggan & notifikasi otomatis', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/whatsapp">Buka inbox</a>` }, `
        <div class="grid grid-4" style="gap:10px">
          ${[
            ['Percakapan', U.num(waStats.threads), 'aktif'],
            ['Pesan masuk', U.num(waStats.inbound), 'dari pelanggan'],
            ['Terkirim', U.num(waStats.sent), 'via API'],
            ['Simulasi', U.num(waStats.simulated), waStats.failed ? waStats.failed + ' gagal' : 'tanpa kegagalan'],
          ].map(([label, value, sub]) => `<div class="mini-stat">
            <span>${U.h(label)}</span><strong>${value}</strong><em>${U.h(sub)}</em>
          </div>`).join('')}
        </div>
        <div style="margin-top:14px" class="list">
          ${waThreads.map((t) => `<div class="list-item" style="padding:9px 0">
            <div class="list-main">
              <div class="list-title">${U.h(t.displayName)}</div>
              <div class="list-sub">${U.h(String(t.last_body || '').slice(0, 70))}</div>
            </div>
            <a class="btn btn-ghost btn-sm" href="${ctx.link('/whatsapp', { chat: t.wa_id })}">Balas</a>
          </div>`).join('') || '<p class="hint-text">Belum ada percakapan masuk.</p>'}
        </div>`) : ''}

      ${shipStats ? L.card({ title: 'Pengiriman', subtitle: 'Cek ongkir & tracking lintas kurir', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/shipping">Kelola</a>` }, `
        <div class="grid grid-4" style="gap:10px">
          ${[
            ['Berjalan', U.num(shipStats.active), shipStats.pending + ' menunggu jemput'],
            ['Terkirim', U.num(shipStats.delivered), 'selesai'],
            ['Bermasalah', U.num(shipStats.problem), 'retur / batal'],
            ['Total ongkir', U.idrShort(shipStats.cost), 'semua waktu'],
          ].map(([label, value, sub]) => `<div class="mini-stat">
            <span>${U.h(label)}</span><strong>${value}</strong><em>${U.h(sub)}</em>
          </div>`).join('')}
        </div>
        <div class="table-wrap" style="margin-top:12px"><table class="data">
          <thead><tr><th>Resi</th><th>Kurir</th><th>Tujuan</th><th>Status</th></tr></thead>
          <tbody>${shipActive.map((sh) => `<tr>
            <td><span class="awb">${U.h(sh.awb || '—')}</span></td>
            <td>${U.h(SHIPPING.COURIERS[sh.courier] || sh.courier)}</td>
            <td>${U.h(sh.dest_area || '—')}</td>
            <td>${L.badge((SHIPPING.STATUS[sh.status] || {}).label || sh.status, sh.status === 'delivered' ? 'good' : sh.status === 'in_transit' ? 'warn' : 'indigo')}</td>
          </tr>`).join('') || `<tr><td colspan="4"><p class="hint-text">Tidak ada pengiriman berjalan.</p></td></tr>`}</tbody>
        </table></div>`) : ''}
    </div>` : ''}

    ${labor && labor.people ? `<div class="grid grid-side">
      ${L.card({ title: 'Tim & absensi bulan ini', subtitle: 'Jam kerja aktual, keterlambatan, dan estimasi biaya tenaga kerja',
    action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/attendance">Detail</a>` }, `
        <div class="grid grid-4" style="gap:10px">
          ${[
            ['Jam kerja', U.num(labor.hours, 1) + ' jam', 'total tim'],
            ['Hari terlambat', U.num(attendanceRecap.totals.lateDays), U.num(attendanceRecap.totals.lateMinutes) + ' menit'],
            ['Tidak hadir', U.num(attendanceRecap.totals.absentDays) + ' hari', 'tanpa keterangan'],
            ['Est. biaya tenaga kerja', U.idrShort(labor.cost), U.num(labor.people) + ' orang'],
          ].map(([label, value, sub]) => `<div class="mini-stat">
            <span>${U.h(label)}</span><strong>${value}</strong><em>${U.h(sub)}</em>
          </div>`).join('')}
        </div>
        <div class="table-wrap" style="margin-top:14px"><table class="data">
          <thead><tr><th>Barista</th><th class="num">Hadir</th><th class="num">Telat</th><th class="num">Jam</th><th class="num">Est. biaya</th></tr></thead>
          <tbody>${attendanceRecap.rows.slice(0, 5).map((r) => `<tr>
            <td><span class="strong">${U.h(r.user_name)}</span><span class="sub-cell">${U.h(r.company_name)}</span></td>
            <td class="num">${U.num(r.present_days + r.late_days)}</td>
            <td class="num">${r.late_days ? `<span style="color:var(--warn)">${U.num(r.late_days)}×</span>` : '—'}</td>
            <td class="num">${U.num(r.hours, 1)}</td>
            <td class="num">${U.idrShort(r.cost)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${labor.recorded ? `<div class="chip-row" style="margin-top:12px">
          ${L.badge('Gaji tercatat ' + U.idrShort(labor.recorded), 'muted')}
          ${L.badge('Cakupan absensi ' + U.pct(labor.recorded ? (labor.cost / labor.recorded) * 100 : 0, 0), 'indigo')}
        </div>` : ''}`)}

      ${L.card({ title: 'Status kehadiran hari ini', subtitle: U.dateLabel(U.todayISO()), action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/attendance/schedule">Jadwal shift</a>` }, `
        ${attendanceToday.length ? (() => {
          const t = attendanceToday[0];
          return `<div class="channel-list">
            <div class="channel-row">
              <div class="channel-head"><span>Hadir</span><strong>${U.num(t.people - t.absent - (t.late || 0))} orang</strong></div>
              ${L.pbar(t.people ? ((t.people - t.absent - (t.late || 0)) / t.people) * 100 : 0, 'good')}
            </div>
            <div class="channel-row">
              <div class="channel-head"><span>Terlambat</span><strong>${U.num(t.late)} orang</strong></div>
              ${L.pbar(t.people ? ((t.late || 0) / t.people) * 100 : 0, 'warn')}
            </div>
            <div class="channel-row">
              <div class="channel-head"><span>Tidak hadir</span><strong>${U.num(t.absent)} orang</strong></div>
              ${L.pbar(t.people ? ((t.absent || 0) / t.people) * 100 : 0, 'bad')}
            </div>
          </div>
          <div class="chip-row" style="margin-top:12px">
            ${L.badge('Total absensi hari ini ' + U.num(t.people), 'indigo')}
            ${L.badge('Jam kerja tercatat ' + U.num(t.work_minutes / 60, 1) + ' jam', 'muted')}
          </div>`;
        })() : `<p class="hint-text">Belum ada absensi tercatat hari ini.</p>
          <div class="form-actions"><a class="btn btn-primary btn-sm" href="${ctx.base}/attendance">Absen sekarang</a></div>`}`)}
    </div>` : ''}

    ${perfStats.length ? `<div class="grid grid-3">${perfStats.join('')}</div>` : ''}

    ${canPerf ? `
      <div class="section-title"><h2>Balanced Scorecard</h2><a class="hint" href="${ctx.base}/performance/bsc">Kelola scorecard →</a></div>
      <div class="grid grid-4">
        ${bsc.perspectives.map((p) => `<article class="persp">
          <div class="persp-head"><span class="persp-name">${U.h(p.label)}</span><span class="persp-score" style="color:${p.score >= 85 ? 'var(--good)' : p.score >= 70 ? 'var(--warn)' : 'var(--bad)'}">${U.pct(p.score, 0)}</span></div>
          ${L.pbar(p.score, L.scoreTone(p.score))}
          <div class="persp-meta">${p.kpiCount} KPI · ${p.objectives.length} objective</div>
        </article>`).join('')}
      </div>

      <div class="grid grid-side">
        ${L.card({ title: 'KPI perlu perhatian', subtitle: 'Pencapaian di bawah 85% dari target', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/performance/kpi">Semua KPI</a>` }, `
          ${attention.length ? `<div class="list">${attention.map((k) => `
            <div class="list-item">
              ${C.scoreRing(k.score)}
              <div class="list-main">
                <div class="list-title">${U.h(k.name)}</div>
                <div class="list-sub">${U.h(k.company_name)} · ${U.formatValue(k.actual, k.unit)} dari target ${U.formatValue(k.target_value, k.unit)} · PIC ${U.h(k.owner_name || '—')}</div>
              </div>
              <div class="list-right">${L.badge(k.status.label, k.status.tone === 'good' ? 'good' : k.status.tone === 'warn' ? 'warn' : 'bad')}</div>
            </div>`).join('')}</div>` : L.empty('Semua KPI di atas 85%', 'Pertahankan ritme pencapaian tim.')}
          `)}
        ${L.card({ title: 'Perlu tindakan Anda', subtitle: 'Alert otomatis dari seluruh modul' }, alertsList(alerts))}
      </div>

      <div class="section-title"><h2>OKR kuartal ini</h2><a class="hint" href="${ctx.base}/performance/okr">Kelola OKR →</a></div>
      <div class="grid grid-3">${okrCards || L.card({}, L.empty('Belum ada OKR pada kuartal ini'))}</div>

      <div class="grid grid-side">
        ${L.card({ title: 'Status RACI', subtitle: 'Aktivitas lintas fungsi dan penanggung jawabnya' }, `
          <div class="grid grid-4" style="gap:10px">
            ${raciCounts.map((c) => `<div class="persp" style="padding:11px;gap:5px">
              <span class="persp-meta">${U.h(c.label)}</span>
              <span class="persp-score" style="font-size:19px">${c.count}</span>
            </div>`).join('')}
          </div>
          <div style="margin-top:14px">
            ${overdue.length ? overdue.slice(0, 3).map((r) => `<div class="list-item" style="padding:9px 0">
              <div class="list-main"><div class="list-title">${U.h(r.activity)}</div><div class="list-sub">Jatuh tempo ${U.h(r.due_date)} · PIC ${U.h(r.responsible_name || '—')}</div></div>
              <div class="list-right">${L.badge('Terlambat', 'bad')}</div>
            </div>`).join('') : `<p class="hint-text">Tidak ada aktivitas yang melewati tenggat.</p>`}
          </div>`)}
        ${L.card({ title: 'Transaksi POS terakhir', action: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/pos/sales">Riwayat</a>` }, `
          <div class="table-wrap"><table class="data">
            <tbody>${recentRows || `<tr><td>${L.empty('Belum ada transaksi')}</td></tr>`}</tbody>
          </table></div>`)}
      </div>` : ''}
  `;

  return L.shell(ctx, {
    title: 'Dashboard Eksekutif',
    subtitle: `${ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi grup kopi'} · ${U.monthLabel(ctx.month)} · ${ROLE_LABELS[ctx.user.role]}`,
    active: '/',
    content: body,
    toolbar: can(ctx.user, 'pos_write') ? `<a class="btn btn-primary btn-sm" href="${ctx.base}/pos">${L.icon('plus', 15)} Transaksi Baru</a>` : '',
  });
}

module.exports = { dashboard, statCard, alertsList };
