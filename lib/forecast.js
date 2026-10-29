'use strict';

const U = require('./util');

/**
 * Regresi linear sederhana (least squares) atas seri bulanan.
 * Mengembalikan slope & intercept dalam satuan nilai per bulan.
 */
function linearFit(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: values[0], r2: 0 };
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = meanY - slope * meanX;

  // koefisien determinasi untuk indikator kualitas prediksi
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    ssTot += (values[i] - meanY) ** 2;
    ssRes += (values[i] - pred) ** 2;
  }
  const r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2 };
}

/**
 * Proyeksi arus kas sederhana 3 bulan ke depan:
 * - basis = rata-rata 3 bulan terakhir yang dibobot (bulan terbaru lebih berat)
 * - arah tren dari regresi linear 6 bulan
 * - dibatasi agar tidak melejit (maks ±25% dari basis per bulan)
 */
function project(series, opts = {}) {
  const horizon = opts.horizon || 3;
  const history = series.filter((s) => s.revenue || s.expenses);
  if (!history.length) {
    const months = [];
    let cursor = U.currentMonthKey();
    for (let i = 1; i <= horizon; i++) months.push({ month: U.addMonths(cursor, i), revenue: 0, expenses: 0, net: 0, inflow: 0, outflow: 0, low: 0, high: 0 });
    return { months, trend: { revenue: 0, expenses: 0 }, confidence: 0, basis: { revenue: 0, expenses: 0 } };
  }

  const tail = history.slice(-6);
  const revenues = tail.map((s) => s.revenue || 0);
  const expenses = tail.map((s) => (s.expenses || 0) + (s.cogs || 0));
  const inflow = tail.map((s) => (s.revenue || 0) + (s.income || 0));
  const outflow = tail.map((s) => (s.cogs || 0) + (s.expenses || 0));

  // Rata-rata 3 bulan terakhir dengan bobot lebih besar pada bulan terbaru.
  const weightedBase = (arr) => {
    const ordered = arr.slice(-3).reverse();
    if (!ordered.length) return 0;
    const weights = ordered.length === 3 ? [0.5, 0.3, 0.2] : ordered.map(() => 1 / ordered.length);
    return ordered.reduce((a, v, i) => a + v * weights[i], 0);
  };

  const fitRev = linearFit(revenues);
  const fitExp = linearFit(expenses);
  const fitIn = linearFit(inflow);
  const fitOut = linearFit(outflow);

  const baseRev = weightedBase(revenues);
  const baseExp = weightedBase(expenses);
  const baseIn = weightedBase(inflow);
  const baseOut = weightedBase(outflow);
  const lastIndex = revenues.length - 1;

  const months = [];
  for (let i = 1; i <= horizon; i++) {
    const month = U.addMonths(history[history.length - 1].month, i);
    const trendRev = fitRev.intercept + fitRev.slope * (lastIndex + i);
    const trendExp = fitExp.intercept + fitExp.slope * (lastIndex + i);
    const trendIn = fitIn.intercept + fitIn.slope * (lastIndex + i);
    const trendOut = fitOut.intercept + fitOut.slope * (lastIndex + i);

    // campuran tren & basis, lalu dibatasi pergerakannya
    const blendedRev = baseRev + (Math.max(trendRev, 0) - baseRev) * 0.6;
    const blendedExp = baseExp + (Math.max(trendExp, 0) - baseExp) * 0.6;
    const rev = clampDelta(blendedRev, baseRev, 0.25);
    const exp = clampDelta(blendedExp, baseExp, 0.25);
    const inFlow = clampDelta(baseIn + (Math.max(trendIn, 0) - baseIn) * 0.6, baseIn, 0.25);
    const outFlow = clampDelta(baseOut + (Math.max(trendOut, 0) - baseOut) * 0.6, baseOut, 0.25);

    const band = 0.08 + i * 0.03; // ketidakpastian naik tiap bulan
    months.push({
      month,
      revenue: Math.round(rev),
      expenses: Math.round(exp),
      inflow: Math.round(inFlow),
      outflow: Math.round(outFlow),
      net: Math.round(inFlow - outFlow),
      low: Math.round((inFlow - outFlow) * (1 - band)),
      high: Math.round((inFlow - outFlow) * (1 + band)),
      projected: true,
    });
  }

  return {
    months,
    trend: {
      revenue: baseRev ? (fitRev.slope / baseRev) * 100 : 0,
      expenses: baseExp ? (fitExp.slope / baseExp) * 100 : 0,
    },
    confidence: Math.round(((fitRev.r2 + fitExp.r2) / 2) * 100),
    basis: { revenue: Math.round(baseRev), expenses: Math.round(baseExp), inflow: Math.round(baseIn), outflow: Math.round(baseOut) },
  };
}

function clampDelta(value, base, maxRatio) {
  if (!base) return Math.max(0, value);
  const min = base * (1 - maxRatio);
  const max = base * (1 + maxRatio);
  return Math.max(min, Math.min(max, value));
}

/** Ringkasan pemasukan vs pengeluaran (cash in/out) untuk satu bulan. */
function cashFlow(db, ids, month) {
  if (!ids.length) return { inflow: 0, outflow: 0, net: 0, revenue: 0, cogs: 0, expenses: 0, income: 0, subscription: 0 };
  const ph = ids.map(() => '?').join(',');
  const sales = db.prepare(`SELECT COALESCE(SUM(total),0) revenue, COALESCE(SUM(cogs),0) cogs
    FROM sales WHERE status='paid' AND company_id IN (${ph}) AND substr(sold_at,1,7)=?`).get(...ids, month);
  const tx = db.prepare(`SELECT type, COALESCE(SUM(amount),0) v FROM transactions
    WHERE company_id IN (${ph}) AND substr(occurred_at,1,7)=? GROUP BY type`).all(...ids, month);
  const expenses = (tx.find((t) => t.type === 'expense') || {}).v || 0;
  const income = (tx.find((t) => t.type === 'income') || {}).v || 0;
  const sub = db.prepare(`SELECT COALESCE(SUM(p.amount),0) v FROM subscription_payments p
    JOIN subscriptions s ON s.id = p.subscription_id
    WHERE s.company_id IN (${ph}) AND p.status='paid' AND substr(p.paid_at,1,7)=?`).get(...ids, month).v;

  const inflow = sales.revenue + income + sub;
  const outflow = sales.cogs + expenses;
  return {
    inflow, outflow, net: inflow - outflow,
    revenue: sales.revenue, cogs: sales.cogs, expenses, income, subscription: sub,
  };
}

module.exports = { linearFit, project, cashFlow };
