'use strict';

const U = require('../lib/util');

function niceMax(v) {
  if (!v || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  let step;
  if (n <= 1) step = 1;
  else if (n <= 1.5) step = 1.5;
  else if (n <= 2) step = 2;
  else if (n <= 3) step = 3;
  else if (n <= 4) step = 4;
  else if (n <= 5) step = 5;
  else if (n <= 7.5) step = 7.5;
  else step = 10;
  return step * base;
}

function axisShort(v) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
  if (abs >= 1e6) return (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' jt';
  if (abs >= 1e3) return (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
  return String(Math.round(v));
}

function comboChart(series, opts = {}) {
  const W = 1080;
  const H = opts.height || 300;
  const pad = { t: 18, r: 18, b: 30, l: 56 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const data = series.length ? series : [{ month: U.currentMonthKey(), revenue: 0, expenses: 0, net: 0 }];
  const maxVal = niceMax(Math.max(1, ...data.map((d) => Math.max(d.revenue || 0, d.expenses || 0, (d.net || 0) > 0 ? d.net : 0))));
  const groupW = innerW / data.length;
  const barW = Math.max(6, Math.min(18, groupW * 0.26));

  const yFor = (v) => pad.t + innerH - ((v || 0) / maxVal) * innerH;
  const xCenter = (i) => pad.l + groupW * i + groupW / 2;

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = yFor(val);
    grid += `<line class="grid-line" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`;
    grid += `<text class="axis-label" x="${pad.l - 9}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${axisShort(val)}</text>`;
  }

  let bars = '';
  data.forEach((d, i) => {
    const cx = xCenter(i);
    const revH = Math.max(1, ((d.revenue || 0) / maxVal) * innerH);
    const expH = Math.max(1, ((d.expenses || 0) / maxVal) * innerH);
    bars += `<rect class="bar-rev" x="${(cx - barW - 1.5).toFixed(1)}" y="${(pad.t + innerH - revH).toFixed(1)}" width="${barW.toFixed(1)}" height="${revH.toFixed(1)}" rx="${Math.min(4, barW / 2).toFixed(1)}"><title>${U.monthLabel(d.month)} · Pendapatan ${U.idr(d.revenue)}</title></rect>`;
    bars += `<rect class="bar-exp" x="${(cx + 1.5).toFixed(1)}" y="${(pad.t + innerH - expH).toFixed(1)}" width="${barW.toFixed(1)}" height="${expH.toFixed(1)}" rx="${Math.min(4, barW / 2).toFixed(1)}"><title>${U.monthLabel(d.month)} · Beban ${U.idr(d.expenses)}</title></rect>`;
    bars += `<text class="value-label" x="${cx.toFixed(1)}" y="${(pad.t + innerH + 16).toFixed(1)}" text-anchor="middle">${U.monthShort(d.month)}</text>`;
  });

  const points = data.map((d, i) => `${xCenter(i).toFixed(1)},${yFor(Math.max(0, d.net || 0)).toFixed(1)}`).join(' ');
  const dots = data.map((d, i) => `<circle class="dot-net" cx="${xCenter(i).toFixed(1)}" cy="${yFor(Math.max(0, d.net || 0)).toFixed(1)}" r="3.2"><title>${U.monthLabel(d.month)} · Laba bersih ${U.idr(d.net)}</title></circle>`).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren pendapatan, beban dan laba bersih">
    <defs>
      <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:var(--chart-1)"/><stop offset="100%" style="stop-color:var(--chart-4)"/>
      </linearGradient>
      <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:var(--chart-muted)"/><stop offset="100%" style="stop-color:var(--surface-inset)"/>
      </linearGradient>
    </defs>
    ${grid}
    ${bars}
    <polyline class="line-net" points="${points}"/>
    ${dots}
  </svg>`;
}

const DONUT_COLORS = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-8)', 'var(--chart-muted)'];

function expenseDonut(breakdown, total) {
  const rows = breakdown.slice(0, 7);
  const sum = rows.reduce((a, r) => a + r.amount, 0) || 1;
  let acc = 0;
  const stops = rows.map((r, i) => {
    const start = (acc / sum) * 100;
    acc += r.amount;
    const end = (acc / sum) * 100;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  const legend = rows.map((r, i) => `
    <div class="item">
      <span class="dot" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>
      <span>${U.h(r.category)}</span>
      <span class="amount">${U.idrShort(r.amount)}</span>
    </div>`).join('');
  return `<div class="donut-wrap">
    <div class="donut" style="background: conic-gradient(${stops.join(',')})">
      <div class="donut-hole"><div><strong>${U.idrShort(total)}</strong><span>total beban</span></div></div>
    </div>
    <div class="legend-list">${legend || '<p class="hint-text">Belum ada beban tercatat.</p>'}</div>
  </div>`;
}

function scoreRing(score) {
  const val = U.clamp(Number(score) || 0, 0, 100);
  let color = 'var(--bad)';
  if (val >= 100) color = 'var(--good)';
  else if (val >= 85) color = 'var(--brand)';
  else if (val >= 70) color = 'var(--warn)';
  return `<div class="score-ring" style="--ring:${val.toFixed(1)};--ring-color:${color}"><span>${Math.round(val)}</span></div>`;
}

function miniBars(values, opts = {}) {
  const W = 120;
  const H = 34;
  const max = Math.max(1, ...values);
  const bw = W / Math.max(1, values.length);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" aria-hidden="true">${values.map((v, i) => {
    const h = Math.max(1, (v / max) * (H - 2));
    const opacity = (0.28 + (i / values.length) * 0.62).toFixed(2);
    return `<rect class="mini-bar" x="${(i * bw + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" style="opacity:${opacity}"/>`;
  }).join('')}</svg>`;
}

/**
 * Grafik arus kas: batang pemasukan/pengeluaran historis + area proyeksi putus-putus
 * dengan rentang keyakinan. Dipakai di dashboard keuangan.
 */
function cashflowChart(history, projection, opts = {}) {
  const W = 1080;
  const H = opts.height || 320;
  const pad = { t: 22, r: 20, b: 34, l: 62 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const hist = history.map((h) => ({ month: h.month, inflow: h.revenue + (h.income || 0), outflow: (h.cogs || 0) + (h.expenses || 0), projected: false }));
  const proj = (projection && projection.months ? projection.months : []).map((p) => ({ ...p, projected: true }));
  const data = [...hist, ...proj];
  if (!data.length) return '';
  const maxVal = niceMax(Math.max(1, ...data.map((d) => Math.max(d.inflow || 0, d.outflow || 0))));
  const groupW = innerW / data.length;
  const barW = Math.max(5, Math.min(15, groupW * 0.24));
  const yFor = (v) => pad.t + innerH - ((v || 0) / maxVal) * innerH;
  const cx = (i) => pad.l + groupW * i + groupW / 2;

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = yFor(val);
    grid += `<line class="grid-line" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>`;
    grid += `<text class="axis-label" x="${pad.l - 10}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${axisShort(val)}</text>`;
  }

  const projStart = hist.length ? pad.l + groupW * hist.length : pad.l;
  const projWidth = innerW - groupW * hist.length;

  let bars = '';
  data.forEach((d, i) => {
    const x = cx(i);
    const inH = Math.max(1, ((d.inflow || 0) / maxVal) * innerH);
    const outH = Math.max(1, ((d.outflow || 0) / maxVal) * innerH);
    const inFill = d.projected ? 'url(#gradProjIn)' : 'url(#gradIn)';
    const outFill = d.projected ? 'url(#gradProjOut)' : 'url(#gradOut)';
    bars += `<rect x="${(x - barW - 1.5).toFixed(1)}" y="${(pad.t + innerH - inH).toFixed(1)}" width="${barW.toFixed(1)}" height="${inH.toFixed(1)}" rx="3" fill="${inFill}" ${d.projected ? 'stroke="rgba(193,53,45,.45)" stroke-dasharray="3 3" stroke-width="1"' : ''}><title>${U.monthLabel(d.month)} · Pemasukan ${U.idr(d.inflow)}${d.projected ? ' (proyeksi)' : ''}</title></rect>`;
    bars += `<rect x="${(x + 1.5).toFixed(1)}" y="${(pad.t + innerH - outH).toFixed(1)}" width="${barW.toFixed(1)}" height="${outH.toFixed(1)}" rx="3" fill="${outFill}" ${d.projected ? 'stroke="rgba(220,38,38,.4)" stroke-dasharray="3 3" stroke-width="1"' : ''}><title>${U.monthLabel(d.month)} · Pengeluaran ${U.idr(d.outflow)}${d.projected ? ' (proyeksi)' : ''}</title></rect>`;
    bars += `<text class="value-label" x="${x.toFixed(1)}" y="${(pad.t + innerH + 17).toFixed(1)}" text-anchor="middle">${U.monthShort(d.month)}</text>`;
  });

  // garis arus kas bersih
  const netPts = data.map((d, i) => `${cx(i).toFixed(1)},${yFor(Math.max(0, (d.inflow || 0) - (d.outflow || 0))).toFixed(1)}`);
  const dots = data.map((d, i) => {
    const net = Math.max(0, (d.inflow || 0) - (d.outflow || 0));
    return `<circle class="dot-net" cx="${cx(i).toFixed(1)}" cy="${yFor(net).toFixed(1)}" r="3" ${d.projected ? 'style="fill:var(--surface-solid)" stroke-dasharray="2 2"' : ''}><title>Arus kas ${U.monthLabel(d.month)}: ${U.idr((d.inflow || 0) - (d.outflow || 0))}</title></circle>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Arus kas dan proyeksi">
    <defs>
      <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--chart-2)"/><stop offset="100%" style="stop-color:var(--green-400)"/></linearGradient>
      <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--chart-7)"/><stop offset="100%" style="stop-color:var(--red-500)" stop-opacity="0.45"/></linearGradient>
      <linearGradient id="gradProjIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--green-500)" stop-opacity="0.32"/><stop offset="100%" style="stop-color:var(--green-400)" stop-opacity="0.16"/></linearGradient>
      <linearGradient id="gradProjOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--red-500)" stop-opacity="0.28"/><stop offset="100%" style="stop-color:var(--red-500)" stop-opacity="0.14"/></linearGradient>
    </defs>
    ${grid}
    ${proj.length ? `<rect x="${projStart.toFixed(1)}" y="${pad.t}" width="${Math.max(0, projWidth).toFixed(1)}" height="${innerH}" fill="var(--brand-soft)" opacity="0.45" rx="8"/>
      <line x1="${projStart.toFixed(1)}" y1="${pad.t}" x2="${projStart.toFixed(1)}" y2="${pad.t + innerH}" stroke="var(--brand)" stroke-dasharray="4 4" stroke-width="1.2"/>
      <text class="axis-label" x="${(projStart + 8).toFixed(1)}" y="${(pad.t + 12).toFixed(1)}" fill="var(--brand)">proyeksi →</text>` : ''}
    ${bars}
    <polyline class="line-net" points="${netPts.join(' ')}"/>
    ${dots}
  </svg>`;
}

/** Sparkline ringkas untuk dashboard mobile. */
function sparkline(values, opts = {}) {
  const W = opts.width || 120;
  const H = opts.height || 36;
  const vals = values.length ? values : [0, 0];
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const step = W / Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / span) * (H - 4) - 2).toFixed(1)}`);
  const color = opts.color || 'var(--chart-1)';
  const area = `${pts.join(' ')} ${W},${H} 0,${H}`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" style="height:${H}px" aria-hidden="true">
    <polygon points="${area}" fill="${color}" opacity="0.12"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

module.exports = { comboChart, expenseDonut, scoreRing, miniBars, axisShort, niceMax, DONUT_COLORS, cashflowChart, sparkline };
