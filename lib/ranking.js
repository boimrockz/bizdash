'use strict';

const U = require('./util');
const Q = require('./queries');
const attendance = require('./attendance');

// Skor komposit 0-100 dari beberapa indikator; bobot total = 100.
const WEIGHTS = {
  achievement: 30,
  growth: 20,
  margin: 20,
  member: 15,
  discipline: 15,
};

function clampScore(v) {
  return Math.max(0, Math.min(130, Number(v) || 0));
}

/**
 * Leaderboard cabang/outlet: membandingkan realisasi vs target, pertumbuhan,
 * margin bersih, porsi transaksi member, dan kedisiplinan absensi barista.
 */
function branches(db, ids, month, companies) {
  if (!ids.length) return [];
  const prevMonth = U.addMonths(month, -1);
  const rows = [];
  // Hanya cabang/outlet yang dinilai: unit bisnis yang punya outlet tidak dihitung terpisah
  // (agar tidak muncul baris berskor rendah karena penjualan tercatat di outlet turunannya).
  const hasOutletChild = new Set(companies.filter((c) => c.level === 'outlet' && c.parent_id).map((c) => c.parent_id));
  const outlets = companies.filter((c) => ids.includes(c.id)
    && (c.level === 'outlet' || (c.level === 'unit' && !hasOutletChild.has(c.id))));

  for (const outlet of outlets) {
    const scope = [outlet.id];
    const fin = Q.financeFor(db, scope, month);
    const prev = Q.financeFor(db, scope, prevMonth);
    const target = Q.targetFor(db, scope, month);
    const members = Q.memberStats(db, scope, month);
    const recap = attendance.recap(db, scope, month);
    const att = recap.totals;
    const recorded = att.days + att.absentDays;
    const discipline = recorded ? (att.days / recorded) * 100 : 0;

    const achievement = target ? (fin.revenue / target) * 100 : (fin.revenue ? 100 : 0);
    const growth = prev.revenue ? ((fin.revenue - prev.revenue) / prev.revenue) * 100 : (fin.revenue ? 100 : 0);

    const indicator = {
      achievement: clampScore(achievement),
      growth: clampScore(100 + growth * 1.5),
      margin: clampScore(fin.margin * 8),
      member: clampScore(members.share * 1.5),
      discipline: clampScore(discipline),
    };
    const score = Math.round(
      (indicator.achievement * WEIGHTS.achievement
        + indicator.growth * WEIGHTS.growth
        + indicator.margin * WEIGHTS.margin
        + indicator.member * WEIGHTS.member
        + indicator.discipline * WEIGHTS.discipline) / 100 * 10,
    ) / 10;

    rows.push({
      id: outlet.id,
      name: outlet.name,
      level: outlet.level,
      kind: outlet.kind,
      revenue: fin.revenue,
      revenuePrev: prev.revenue,
      growth,
      target,
      achievement,
      margin: fin.margin,
      memberShare: members.share,
      transactions: fin.transactions,
      avgTicket: fin.avgTicket,
      hours: att.hours,
      lateDays: att.lateDays,
      absentDays: att.absentDays,
      discipline,
      indicator,
      score,
      trend: growth > 2 ? 'up' : growth < -2 ? 'down' : 'flat',
    });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Leaderboard tim/individu: performa pemilik KPI + jam kerja + ketepatan waktu.
 */
function teams(db, ids, month) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const users = db.prepare(`SELECT u.id, u.name, u.role, u.company_id, c.name company_name
    FROM users u LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.active = 1 AND u.company_id IN (${ph}) ORDER BY u.name`).all(...ids);
  if (!users.length) return [];

  const kpis = Q.kpiRows(db, ids, month);
  const recap = attendance.recap(db, ids, month);
  const recapByUser = new Map(recap.rows.map((r) => [r.user_id, r]));

  const rows = users.map((u) => {
    const own = kpis.filter((k) => k.owner_id === u.id && k.hasActual);
    const kpiAvg = own.length ? own.reduce((a, k) => a + k.score, 0) / own.length : 0;
    const att = recapByUser.get(u.id) || null;
    const recorded = att ? att.present_days + att.late_days + att.absent_days : 0;
    const discipline = recorded ? ((att.present_days + att.late_days) / recorded) * 100 : 0;
    const punctuality = att ? att.punctuality : 0;
    const hours = att ? att.hours : 0;

    const indicator = {
      kpi: clampScore(kpiAvg),
      punctuality: clampScore(punctuality),
      coverage: clampScore(recorded ? Math.min(100, (hours / (recorded * 7.5)) * 100) : 0),
      discipline: clampScore(discipline),
    };
    const score = Math.round(
      (indicator.kpi * 50 + indicator.punctuality * 25 + indicator.coverage * 15 + indicator.discipline * 10) / 100 * 10,
    ) / 10;

    return {
      id: u.id,
      name: u.name,
      role: u.role,
      company: u.company_name,
      kpiCount: own.length,
      kpiScore: kpiAvg,
      hours,
      lateDays: att ? att.late_days : 0,
      punctuality,
      indicator,
      score,
    };
  }).sort((a, b) => b.score - a.score);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function summary(branchRows, teamRows) {
  const best = branchRows[0] || null;
  const worst = branchRows[branchRows.length - 1] || null;
  const spread = best && worst ? best.score - worst.score : 0;
  const avg = branchRows.length ? branchRows.reduce((a, r) => a + r.score, 0) / branchRows.length : 0;
  return {
    best,
    worst,
    spread,
    avg,
    improving: branchRows.filter((r) => r.trend === 'up').length,
    declining: branchRows.filter((r) => r.trend === 'down').length,
    bestTeam: teamRows[0] || null,
  };
}

module.exports = { branches, teams, summary, WEIGHTS };
