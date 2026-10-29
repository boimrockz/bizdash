'use strict';

const U = require('./util');

const STATUS_LABEL = {
  active: 'Aktif',
  past_due: 'Menunggak',
  paused: 'Ditangguhkan',
  cancelled: 'Berhenti',
  expiring: 'Segera jatuh tempo',
  overdue: 'Lewat jatuh tempo',
};

const STATUS_TONE = {
  active: 'good',
  past_due: 'bad',
  paused: 'warn',
  cancelled: 'muted',
  expiring: 'warn',
  overdue: 'bad',
};

// Status efektif mempertimbangkan tanggal jatuh tempo (bukan hanya kolom status).
function effectiveStatus(sub, today = U.todayISO()) {
  if (sub.status === 'cancelled') return 'cancelled';
  if (sub.status === 'paused') return 'paused';
  if (!sub.next_due) return sub.status === 'past_due' ? 'past_due' : 'active';
  const days = daysUntil(sub.next_due, today);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'expiring';
  return sub.status === 'past_due' ? 'past_due' : 'active';
}

function daysUntil(dateStr, today = U.todayISO()) {
  if (!dateStr) return null;
  const toMs = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(dateStr) - toMs(today)) / 86400000);
}

function intervalDays(interval) {
  if (interval === 'weekly') return 7;
  if (interval === 'quarterly') return 90;
  if (interval === 'yearly') return 365;
  return 30;
}

function addDays(dateStr, days) {
  const [y, m, d] = String(dateStr || U.todayISO()).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function plans(db) {
  return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status IN ('active','past_due')) subscribers
    FROM subscription_plans p ORDER BY p.active DESC, p.price`).all();
}

function list(db, ids, filter = {}) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const params = [...ids];
  let where = `s.company_id IN (${ph})`;
  if (filter.status && filter.status !== 'all') {
    if (['active', 'past_due', 'paused', 'cancelled'].includes(filter.status)) {
      where += ' AND s.status = ?';
      params.push(filter.status);
    }
  }
  if (filter.q) {
    where += ' AND (lower(c.name) LIKE ? OR lower(COALESCE(c.company_name,\'\')) LIKE ? OR lower(COALESCE(c.phone,\'\')) LIKE ?)';
    const q = '%' + String(filter.q).toLowerCase() + '%';
    params.push(q, q, q);
  }
  const rows = db.prepare(`SELECT s.*, c.name customer_name, c.company_name, c.phone, c.type customer_type,
      p.name plan_name, p.interval plan_interval, co.name company_name
    FROM subscriptions s
    JOIN customers c ON c.id = s.customer_id
    JOIN subscription_plans p ON p.id = s.plan_id
    LEFT JOIN companies co ON co.id = s.company_id
    WHERE ${where} ORDER BY s.next_due IS NULL, s.next_due, c.name`).all(...params);

  const enriched = rows.map((r) => {
    const eff = effectiveStatus(r);
    return {
      ...r,
      effective: eff,
      effective_label: STATUS_LABEL[eff] || eff,
      tone: STATUS_TONE[eff] || 'muted',
      days_left: daysUntil(r.next_due),
      paid_total: 0,
    };
  });

  // total pembayaran per langganan
  if (enriched.length) {
    const subIds = enriched.map((r) => r.id);
    const ph2 = subIds.map(() => '?').join(',');
    const sums = db.prepare(`SELECT subscription_id, COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) paid,
        COUNT(CASE WHEN status='paid' THEN 1 END) n
      FROM subscription_payments WHERE subscription_id IN (${ph2}) GROUP BY subscription_id`).all(...subIds);
    const map = new Map(sums.map((s) => [s.subscription_id, s]));
    for (const r of enriched) {
      const s = map.get(r.id) || { paid: 0, n: 0 };
      r.paid_total = s.paid;
      r.paid_count = s.n;
    }
  }

  if (filter.status === 'expiring') return enriched.filter((r) => r.effective === 'expiring' || r.effective === 'overdue');
  return enriched;
}

function stats(db, ids) {
  const rows = list(db, ids);
  const today = U.todayISO();
  const active = rows.filter((r) => r.effective === 'active' || r.effective === 'expiring');
  const overdue = rows.filter((r) => r.effective === 'overdue' || r.effective === 'past_due');
  const expiring = rows.filter((r) => r.effective === 'expiring');
  const mrr = active.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const atRisk = overdue.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  let collected = 0;
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    collected = db.prepare(`SELECT COALESCE(SUM(p.amount),0) v FROM subscription_payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.company_id IN (${ph}) AND p.status = 'paid' AND substr(p.paid_at,1,7) = ?`).get(...ids, today.slice(0, 7)).v;
  }

  return {
    total: rows.length,
    active: active.length,
    overdue: overdue.length,
    expiring: expiring.length,
    mrr,
    atRisk,
    collected,
    churnRate: rows.length ? (rows.filter((r) => r.effective === 'cancelled').length / rows.length) * 100 : 0,
    rows,
  };
}

function detail(db, id) {
  const sub = db.prepare(`SELECT s.*, c.name customer_name, c.company_name, c.phone, c.email, c.type customer_type,
      p.name plan_name, p.interval plan_interval, p.perks, co.name company_name
    FROM subscriptions s JOIN customers c ON c.id = s.customer_id
    JOIN subscription_plans p ON p.id = s.plan_id
    LEFT JOIN companies co ON co.id = s.company_id WHERE s.id = ?`).get(id);
  if (!sub) return null;
  const payments = db.prepare('SELECT * FROM subscription_payments WHERE subscription_id = ? ORDER BY due_date DESC').all(id);
  const eff = effectiveStatus(sub);
  return {
    ...sub,
    payments,
    effective: eff,
    effective_label: STATUS_LABEL[eff] || eff,
    tone: STATUS_TONE[eff] || 'muted',
    days_left: daysUntil(sub.next_due),
    paid_total: payments.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0),
  };
}

function upcoming(db, ids, days = 30) {
  const rows = list(db, ids);
  return rows
    .filter((r) => r.days_left !== null && r.days_left >= 0 && r.days_left <= days && r.effective !== 'cancelled' && r.effective !== 'paused')
    .sort((a, b) => a.days_left - b.days_left);
}

function create(db, opts) {
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(Number(opts.planId));
  if (!plan) return { error: 'Paket langganan tidak ditemukan.' };
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(opts.customerId));
  if (!customer) return { error: 'Pelanggan tidak ditemukan.' };
  const started = opts.startedAt || U.todayISO();
  const amount = Number(opts.amount) > 0 ? Number(opts.amount) : plan.price;
  const nextDue = opts.nextDue || addDays(started, intervalDays(plan.interval));
  const id = db.prepare(`INSERT INTO subscriptions (company_id, customer_id, plan_id, status, started_at, next_due, amount, channel, note, created_at)
    VALUES (?,?,?,'active',?,?,?,?,?,?)`)
    .run(customer.company_id, customer.id, plan.id, started, nextDue, amount,
      String(opts.channel || 'whatsapp').slice(0, 20), opts.note ? String(opts.note).slice(0, 200) : null, U.nowISO()).lastInsertRowid;
  db.prepare(`INSERT INTO subscription_payments (subscription_id, due_date, paid_at, amount, method, status, note, created_at)
    VALUES (?,?,NULL,?,NULL,'pending','Tagihan pertama',?)`)
    .run(id, nextDue, amount, U.nowISO());
  return { id, plan, customer, nextDue, amount };
}

function pay(db, subscriptionId, paymentId, opts = {}) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!sub) return { error: 'Langganan tidak ditemukan.' };
  const pay = paymentId
    ? db.prepare('SELECT * FROM subscription_payments WHERE id = ? AND subscription_id = ?').get(paymentId, subscriptionId)
    : db.prepare("SELECT * FROM subscription_payments WHERE subscription_id = ? AND status <> 'paid' ORDER BY due_date LIMIT 1").get(subscriptionId);
  if (!pay) return { error: 'Tidak ada tagihan yang menunggu pembayaran.' };
  if (pay.status === 'paid') return { error: 'Tagihan ini sudah dibayar.' };

  return db.transaction(() => {
    const now = U.localNow();
    db.prepare("UPDATE subscription_payments SET status='paid', paid_at=?, method=? WHERE id=?")
      .run(now, String(opts.method || 'qris').slice(0, 20), pay.id);

    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(sub.plan_id);
    const nextDue = addDays(pay.due_date || sub.next_due || U.todayISO(), intervalDays(plan ? plan.interval : 'monthly'));
    db.prepare("UPDATE subscriptions SET status='active', next_due=? WHERE id=?").run(nextDue, sub.id);
    // buat tagihan periode berikutnya
    const exists = db.prepare("SELECT id FROM subscription_payments WHERE subscription_id = ? AND due_date = ?").get(sub.id, nextDue);
    if (!exists) {
      db.prepare(`INSERT INTO subscription_payments (subscription_id, due_date, paid_at, amount, method, status, note, created_at)
        VALUES (?,?,NULL,?,NULL,'pending','Perpanjangan otomatis',?)`)
        .run(sub.id, nextDue, sub.amount, U.nowISO());
    }
    return { ok: true, paidAmount: pay.amount, nextDue, subscriptionId: sub.id, customerId: sub.customer_id };
  })();
}

function setStatus(db, subscriptionId, status, opts = {}) {
  if (!['active', 'paused', 'cancelled', 'past_due'].includes(status)) return { error: 'Status tidak dikenal.' };
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!sub) return { error: 'Langganan tidak ditemukan.' };
  const nextDue = opts.nextDue || sub.next_due;
  db.prepare('UPDATE subscriptions SET status = ?, next_due = ? WHERE id = ?').run(status, nextDue, subscriptionId);
  return { ok: true, status, nextDue };
}

function extend(db, subscriptionId, days) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!sub) return { error: 'Langganan tidak ditemukan.' };
  const nextDue = addDays(sub.next_due || U.todayISO(), Number(days) || 30);
  db.prepare("UPDATE subscriptions SET next_due = ?, status = CASE WHEN status='past_due' THEN 'active' ELSE status END WHERE id = ?")
    .run(nextDue, subscriptionId);
  return { ok: true, nextDue };
}

function series(db, ids, months) {
  if (!ids.length) return months.map((m) => ({ month: m, collected: 0, due: 0 }));
  const ph = ids.map(() => '?').join(',');
  const from = months[0] + '-01';
  const paid = db.prepare(`SELECT substr(p.paid_at,1,7) m, COALESCE(SUM(p.amount),0) v
    FROM subscription_payments p JOIN subscriptions s ON s.id = p.subscription_id
    WHERE s.company_id IN (${ph}) AND p.status='paid' AND p.paid_at >= ? GROUP BY m`).all(...ids, from);
  const due = db.prepare(`SELECT substr(p.due_date,1,7) m, COALESCE(SUM(p.amount),0) v
    FROM subscription_payments p JOIN subscriptions s ON s.id = p.subscription_id
    WHERE s.company_id IN (${ph}) AND p.due_date >= ? GROUP BY m`).all(...ids, from);
  const paidMap = new Map(paid.map((r) => [r.m, r.v]));
  const dueMap = new Map(due.map((r) => [r.m, r.v]));
  return months.map((m) => ({ month: m, collected: paidMap.get(m) || 0, due: dueMap.get(m) || 0 }));
}

module.exports = {
  STATUS_LABEL, STATUS_TONE, effectiveStatus, daysUntil, intervalDays, addDays,
  plans, list, stats, detail, upcoming, create, pay, setStatus, extend, series,
};
