'use strict';

const U = require('./util');
const attendance = require('./attendance');

function ph(n) {
  return new Array(n).fill('?').join(',');
}

function financeFor(db, ids, month) {
  if (!ids.length) return { revenue: 0, cogs: 0, expenses: 0, income: 0, transactions: 0, gross: 0, net: 0 };
  const p = ph(ids.length);
  const s = db.prepare(`SELECT COALESCE(SUM(total),0) revenue, COALESCE(SUM(cogs),0) cogs, COUNT(*) transactions
    FROM sales WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7)=?`).get(...ids, month);
  const tx = db.prepare(`SELECT type, COALESCE(SUM(amount),0) amount FROM transactions
    WHERE company_id IN (${p}) AND substr(occurred_at,1,7)=? GROUP BY type`).all(...ids, month);
  const expenses = (tx.find((t) => t.type === 'expense') || {}).amount || 0;
  const income = (tx.find((t) => t.type === 'income') || {}).amount || 0;
  const gross = s.revenue - s.cogs;
  const net = gross - expenses + income;
  return {
    revenue: s.revenue,
    cogs: s.cogs,
    gross,
    expenses,
    income,
    net,
    transactions: s.transactions,
    avgTicket: s.transactions ? s.revenue / s.transactions : 0,
    grossMargin: s.revenue ? (gross / s.revenue) * 100 : 0,
    margin: s.revenue ? (net / s.revenue) * 100 : 0,
    expenseRatio: s.revenue ? (expenses / s.revenue) * 100 : 0,
  };
}

function seriesFor(db, ids, months) {
  const out = new Map();
  for (const m of months) out.set(m, { month: m, revenue: 0, cogs: 0, expenses: 0, income: 0, net: 0, transactions: 0 });
  if (!ids.length) return months.map((m) => out.get(m));
  const p = ph(ids.length);
  const from = months[0] + '-01';
  const to = months[months.length - 1] + '-31';
  const sales = db.prepare(`SELECT substr(sold_at,1,7) m, COALESCE(SUM(total),0) revenue, COALESCE(SUM(cogs),0) cogs, COUNT(*) n
    FROM sales WHERE status='paid' AND company_id IN (${p}) AND sold_at >= ? AND sold_at <= ?
    GROUP BY m`).all(...ids, from, to);
  for (const row of sales) {
    const bucket = out.get(row.m);
    if (!bucket) continue;
    bucket.revenue = row.revenue;
    bucket.cogs = row.cogs;
    bucket.transactions = row.n;
  }
  const txs = db.prepare(`SELECT substr(occurred_at,1,7) m, type, COALESCE(SUM(amount),0) amount
    FROM transactions WHERE company_id IN (${p}) AND occurred_at >= ? AND occurred_at <= ?
    GROUP BY m, type`).all(...ids, from, to);
  for (const row of txs) {
    const bucket = out.get(row.m);
    if (!bucket) continue;
    if (row.type === 'expense') bucket.expenses = row.amount;
    else bucket.income = row.amount;
  }
  for (const b of out.values()) {
    b.net = b.revenue - b.cogs - b.expenses + b.income;
    b.margin = b.revenue ? (b.net / b.revenue) * 100 : 0;
  }
  return months.map((m) => out.get(m));
}

function expenseBreakdown(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT COALESCE(category,'Lain-lain') category, COALESCE(SUM(amount),0) amount
    FROM transactions WHERE type='expense' AND company_id IN (${p}) AND substr(occurred_at,1,7)=?
    GROUP BY category ORDER BY amount DESC`).all(...ids, month);
}

function topProducts(db, ids, month, limit = 6) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT si.name, SUM(si.qty) qty, SUM(si.line_total) revenue, SUM(si.qty*si.cost) cogs
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status='paid' AND s.company_id IN (${p}) AND substr(s.sold_at,1,7)=?
    GROUP BY si.name ORDER BY revenue DESC LIMIT ?`).all(...ids, month, limit);
}

function revenueByCompany(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT s.company_id, COALESCE(SUM(s.total),0) revenue, COUNT(*) transactions,
      (SELECT COALESCE(revenue_target,0) FROM targets t WHERE t.company_id = s.company_id AND t.period = ?) target
    FROM sales s WHERE s.status='paid' AND s.company_id IN (${p}) AND substr(s.sold_at,1,7)=?
    GROUP BY s.company_id ORDER BY revenue DESC`).all(month, ...ids, month);
}

function expensesByCompany(db, ids, month) {
  if (!ids.length) return new Map();
  const p = ph(ids.length);
  const rows = db.prepare(`SELECT company_id, COALESCE(SUM(amount),0) amount FROM transactions
    WHERE type='expense' AND company_id IN (${p}) AND substr(occurred_at,1,7)=? GROUP BY company_id`).all(...ids, month);
  return new Map(rows.map((r) => [r.company_id, r.amount]));
}

function targetFor(db, ids, month) {
  if (!ids.length) return 0;
  const p = ph(ids.length);
  return db.prepare(`SELECT COALESCE(SUM(revenue_target),0) v FROM targets WHERE period=? AND company_id IN (${p})`).get(month, ...ids).v;
}

function paymentMix(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT payment_method method, COALESCE(SUM(total),0) amount, COUNT(*) n FROM sales
    WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7)=? GROUP BY payment_method ORDER BY amount DESC`)
    .all(...ids, month);
}

function recentSales(db, ids, limit = 8) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT s.id, s.invoice_no, s.sold_at, s.total, s.status, s.source, s.payment_method, c.name company
    FROM sales s LEFT JOIN companies c ON c.id = s.company_id
    WHERE s.company_id IN (${p}) ORDER BY s.sold_at DESC, s.id DESC LIMIT ?`).all(...ids, limit);
}

function dailySeries(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT substr(sold_at,9,2) d, COALESCE(SUM(total),0) revenue, COUNT(*) n FROM sales
    WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7)=?
    GROUP BY d ORDER BY d`).all(...ids, month);
}

// ---------- Performa: KPI, BSC, OKR, RACI ----------

function kpiRows(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  const rows = db.prepare(`SELECT k.*, u.name owner_name,
      (SELECT value FROM kpi_entries e WHERE e.kpi_id = k.id AND e.period = ?) entry_value,
      c.name company_name
    FROM kpis k LEFT JOIN users u ON u.id = k.owner_id LEFT JOIN companies c ON c.id = k.company_id
    WHERE k.company_id IN (${p}) ORDER BY k.perspective, k.id`).all(month, ...ids);

  const cache = new Map();
  const scopeCache = new Map();
  const scopeOf = (companyId) => {
    if (!scopeCache.has(companyId)) {
      const scope = db.prepare(`WITH RECURSIVE tree(id) AS (
          SELECT id FROM companies WHERE id = ?
          UNION ALL SELECT c.id FROM companies c JOIN tree t ON c.parent_id = t.id
        ) SELECT id FROM tree`).all(companyId).map((r) => r.id);
      scopeCache.set(companyId, scope);
    }
    return scopeCache.get(companyId);
  };
  const summaryFor = (companyId) => {
    if (!cache.has(companyId)) cache.set(companyId, financeFor(db, scopeOf(companyId), month));
    return cache.get(companyId);
  };

  return rows.map((k) => {
    const fin = summaryFor(k.company_id);
    let actual;
    switch (k.metric) {
      case 'revenue': actual = fin.revenue; break;
      case 'net_profit': actual = fin.net; break;
      case 'gross_profit': actual = fin.gross; break;
      case 'margin': actual = fin.margin; break;
      case 'gross_margin': actual = fin.grossMargin; break;
      case 'expense_ratio': actual = fin.expenseRatio; break;
      case 'transactions': actual = fin.transactions; break;
      case 'avg_ticket': actual = fin.avgTicket; break;
      case 'hpp_ratio': actual = fin.revenue ? (fin.cogs / fin.revenue) * 100 : 0; break;
      case 'b2b_share': {
        const mix = channelMix(db, scopeOf(k.company_id), month);
        const total = mix.reduce((a, r) => a + r.revenue, 0);
        const b2b = mix.filter((r) => r.channel === 'b2b').reduce((a, r) => a + r.revenue, 0);
        actual = total ? (b2b / total) * 100 : 0;
        break;
      }
      case 'labor_cost_ratio': {
        const fin2 = summaryFor(k.company_id);
        const labor = attendance.laborCost(db, scopeOf(k.company_id), month);
        actual = fin2.revenue ? (labor.cost / fin2.revenue) * 100 : 0;
        break;
      }
      case 'member_share': {
        const ms = memberStats(db, scopeOf(k.company_id), month);
        actual = ms.share;
        break;
      }
      default: actual = k.entry_value === null || k.entry_value === undefined ? null : k.entry_value;
    }
    const isAuto = k.metric !== 'manual';
    const hasActual = actual !== null && actual !== undefined;
    const score = hasActual ? U.kpiScore(actual, k.target_value, k.polarity) : 0;
    return {
      ...k,
      actual: hasActual ? actual : null,
      isAuto,
      hasActual,
      score,
      status: hasActual ? U.scoreStatus(score) : { key: 'empty', label: 'Belum diisi', tone: 'muted' },
    };
  });
}

function bscSummary(kpis, objectives) {
  const perspectives = ['financial', 'customer', 'process', 'growth'];
  const labels = {
    financial: 'Financial',
    customer: 'Customer',
    process: 'Internal Process',
    growth: 'Learning & Growth',
  };
  const out = perspectives.map((key) => {
    let weighted = 0;
    let weightSum = 0;
    for (const k of kpis.filter((x) => x.perspective === key && x.hasActual)) {
      weighted += k.score * (k.weight || 1);
      weightSum += k.weight || 1;
    }
    const objs = objectives.filter((o) => o.perspective === key).map((o) => {
      const linked = kpis.filter((k) => k.objective_id === o.id && k.hasActual);
      const w = linked.reduce((a, k) => a + (k.weight || 1), 0);
      const score = w ? linked.reduce((a, k) => a + k.score * (k.weight || 1), 0) / w : 0;
      return { ...o, score, kpiCount: linked.length };
    });
    return {
      key,
      label: labels[key],
      score: weightSum ? weighted / weightSum : 0,
      objectives: objs,
      kpiCount: kpis.filter((x) => x.perspective === key).length,
    };
  });
  const active = out.filter((p) => p.kpiCount > 0);
  const totalWeight = active.reduce((a, p) => a + p.kpiCount, 0);
  const overall = totalWeight ? active.reduce((a, p) => a + p.score * p.kpiCount, 0) / totalWeight : 0;
  return { perspectives: out, overall };
}

function krProgress(kr) {
  const start = Number(kr.start_value) || 0;
  const target = Number(kr.target_value) || 0;
  const current = Number(kr.current_value) || 0;
  const span = target - start;
  if (!span) return { pct: current >= target ? 100 : 0, raw: current >= target ? 1 : 0 };
  const raw = (current - start) / span;
  return { pct: U.clamp(raw * 100, 0, 100), raw };
}

function okrRows(db, ids, quarter) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  const okrs = db.prepare(`SELECT o.*, u.name owner_name, c.name company_name FROM okrs o
    LEFT JOIN users u ON u.id = o.owner_id LEFT JOIN companies c ON c.id = o.company_id
    WHERE o.company_id IN (${p}) AND o.period = ? ORDER BY o.id`).all(...ids, quarter);
  if (!okrs.length) return [];
  const idsList = okrs.map((o) => o.id);
  const krs = db.prepare(`SELECT * FROM key_results WHERE okr_id IN (${ph(idsList.length)}) ORDER BY id`).all(...idsList);
  return okrs.map((o) => {
    const own = krs.filter((k) => k.okr_id === o.id).map((k) => ({ ...k, progress: krProgress(k) }));
    const weightSum = own.reduce((a, k) => a + (k.weight || 1), 0);
    const progress = weightSum ? own.reduce((a, k) => a + k.progress.pct * (k.weight || 1), 0) / weightSum : 0;
    return { ...o, krs: own, progress };
  });
}

const RACI_STATUS = {
  not_started: 'Belum mulai',
  in_progress: 'Berjalan',
  blocked: 'Terhambat',
  done: 'Selesai',
};

function raciRows(db, ids) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT r.*, c.name company_name,
      ru.name responsible_name, au.name accountable_name
    FROM raci r LEFT JOIN companies c ON c.id = r.company_id
    LEFT JOIN users ru ON ru.id = r.responsible_id LEFT JOIN users au ON au.id = r.accountable_id
    WHERE r.company_id IN (${p}) ORDER BY
      CASE r.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'not_started' THEN 2 ELSE 3 END, r.due_date`).all(...ids);
}

function objectivesFor(db, ids) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT o.*, u.name owner_name FROM objectives o
    LEFT JOIN users u ON u.id = o.owner_id
    WHERE o.company_id IN (${p}) ORDER BY o.id`).all(...ids);
}

function channelMix(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT channel, COUNT(*) n, COALESCE(SUM(total),0) revenue, COALESCE(SUM(cogs),0) cogs
    FROM sales WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7)=?
    GROUP BY channel ORDER BY revenue DESC`).all(...ids, month);
}

function memberStats(db, ids, month) {
  if (!ids.length) return { total: 0, active: 0, memberRevenue: 0, revenue: 0, share: 0, newMembers: 0, pointsBalance: 0, pointsEarned: 0, pointsUsed: 0, b2c: 0, b2b: 0 };
  const p = ph(ids.length);
  const totals = db.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN type='b2c' THEN 1 ELSE 0 END) b2c,
      SUM(CASE WHEN type='b2b' THEN 1 ELSE 0 END) b2b,
      COALESCE(SUM(points),0) points_balance
    FROM customers WHERE company_id IN (${p}) AND active = 1`).get(...ids);
  const sales = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN customer_id IS NOT NULL THEN total ELSE 0 END),0) member_revenue,
      COALESCE(SUM(total),0) revenue,
      COUNT(DISTINCT CASE WHEN customer_id IS NOT NULL THEN customer_id END) active_members,
      COALESCE(SUM(points_earned),0) points_earned,
      COALESCE(SUM(points_used),0) points_used
    FROM sales WHERE status='paid' AND company_id IN (${p}) AND substr(sold_at,1,7)=?`).get(...ids, month);
  const newMembers = db.prepare(`SELECT COUNT(*) c FROM customers WHERE company_id IN (${p}) AND substr(created_at,1,7)=?`)
    .get(...ids, month).c;
  return {
    total: totals.total || 0,
    b2c: totals.b2c || 0,
    b2b: totals.b2b || 0,
    active: sales.active_members || 0,
    memberRevenue: sales.member_revenue || 0,
    revenue: sales.revenue || 0,
    share: sales.revenue ? (sales.member_revenue / sales.revenue) * 100 : 0,
    newMembers,
    pointsBalance: totals.points_balance || 0,
    pointsEarned: sales.points_earned || 0,
    pointsUsed: sales.points_used || 0,
  };
}

function promoImpact(db, ids, month, limit = 6) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT COALESCE(promo_label, 'Tanpa promo') label, COUNT(*) n,
      COALESCE(SUM(promo_discount),0) discount, COALESCE(SUM(total),0) revenue
    FROM sales WHERE status='paid' AND promo_discount > 0 AND company_id IN (${p}) AND substr(sold_at,1,7)=?
    GROUP BY promo_label ORDER BY discount DESC LIMIT ?`).all(...ids, month, limit);
}

function activePromoList(db, ids) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT p.*, c.name company_name FROM promos p LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.company_id IN (${p}) ORDER BY p.active DESC, p.id DESC`).all(...ids);
}

function topMenus(db, ids, month, limit = 6) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT si.name, p.kind, p.category, SUM(si.qty) qty, SUM(si.line_total) revenue,
      SUM(si.qty * si.cost) cogs
    FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN products p ON p.id = si.product_id
    WHERE s.status='paid' AND s.company_id IN (${p}) AND substr(s.sold_at,1,7)=?
    GROUP BY si.name ORDER BY qty DESC LIMIT ?`).all(...ids, month, limit);
}

function customerList(db, ids, opts = {}) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  const where = [`cu.company_id IN (${p})`];
  const args = [...ids];
  if (opts.type && opts.type !== 'all') { where.push('cu.type = ?'); args.push(opts.type); }
  if (opts.search) {
    where.push('(lower(cu.name) LIKE ? OR lower(COALESCE(cu.company_name,\'\')) LIKE ? OR cu.phone LIKE ?)');
    const q = '%' + String(opts.search).toLowerCase() + '%';
    args.push(q, q, q);
  }
  return db.prepare(`SELECT cu.*, c.name company_name,
      (SELECT COUNT(*) FROM sales s WHERE s.customer_id = cu.id AND s.status='paid') trx,
      (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id = cu.id AND s.status='paid') spend,
      (SELECT MAX(sold_at) FROM sales s WHERE s.customer_id = cu.id AND s.status='paid') last_visit
    FROM customers cu LEFT JOIN companies c ON c.id = cu.company_id
    WHERE ${where.join(' AND ')} ORDER BY cu.type DESC, spend DESC, cu.name LIMIT ?`).all(...args, Number(opts.limit) || 60);
}

function customerById(db, id) {
  return db.prepare(`SELECT cu.*, c.name company_name FROM customers cu LEFT JOIN companies c ON c.id = cu.company_id WHERE cu.id = ?`).get(id);
}

function customerSales(db, id, limit = 12) {
  return db.prepare(`SELECT s.*, c.name company_name FROM sales s LEFT JOIN companies c ON c.id = s.company_id
    WHERE s.customer_id = ? ORDER BY s.sold_at DESC, s.id DESC LIMIT ?`).all(id, limit);
}

function customerPrices(db, id) {
  return db.prepare(`SELECT cp.*, p.name product_name, p.price base_price FROM customer_prices cp
    JOIN products p ON p.id = cp.product_id WHERE cp.customer_id = ? ORDER BY p.name`).all(id);
}

function usersById(db) {
  const rows = db.prepare('SELECT id, name, role, company_id, email, active FROM users ORDER BY name').all();
  return new Map(rows.map((u) => [u.id, u]));
}

module.exports = {
  financeFor, seriesFor, expenseBreakdown, topProducts, revenueByCompany, expensesByCompany,
  targetFor, paymentMix, recentSales, dailySeries, kpiRows, bscSummary, okrRows, raciRows,
  krProgress, usersById, RACI_STATUS, objectivesFor, channelMix, memberStats, promoImpact,
  activePromoList, topMenus, customerList, customerById, customerSales, customerPrices,
};
