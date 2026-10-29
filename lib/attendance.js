'use strict';

const U = require('./util');

const STATUS_LABEL = {
  present: 'Hadir',
  late: 'Terlambat',
  absent: 'Tidak hadir',
  leave: 'Izin/Cuti',
  open: 'Belum absen pulang',
};

function timeToMin(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function minToTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function nowParts() {
  const now = U.localNow(); // YYYY-MM-DD HH:MM:SS (WIB)
  return { date: now.slice(0, 10), time: now.slice(11, 16), stamp: now };
}

function diffMinutes(stampA, stampB) {
  const toMs = (s) => {
    const [d, t] = String(s).split(' ');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = (t || '00:00:00').split(':').map(Number);
    return Date.UTC(y, mo - 1, da, h, mi);
  };
  return Math.round((toMs(stampB) - toMs(stampA)) / 60000);
}

function ph(n) {
  return new Array(n).fill('?').join(',');
}

function shiftsOf(db, ids, onlyActive = true) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT s.*, c.name company_name FROM shifts s LEFT JOIN companies c ON c.id = s.company_id
    WHERE s.company_id IN (${p}) ${onlyActive ? 'AND s.active = 1' : ''} ORDER BY c.name, s.start_time`).all(...ids);
}

function scheduleForDate(db, userId, date) {
  return db.prepare(`SELECT ss.*, s.name shift_name, s.start_time, s.end_time, s.break_minutes, c.name company_name
    FROM shift_schedules ss LEFT JOIN shifts s ON s.id = ss.shift_id
    LEFT JOIN companies c ON c.id = ss.company_id
    WHERE ss.user_id = ? AND ss.date = ?`).get(userId, date);
}

function attendanceForDate(db, userId, date) {
  return db.prepare(`SELECT a.*, s.name shift_name, s.start_time, s.end_time, s.break_minutes
    FROM attendance a LEFT JOIN shifts s ON s.id = a.shift_id
    WHERE a.user_id = ? AND a.date = ?`).get(userId, date);
}

function todayState(db, user) {
  const { date } = nowParts();
  const att = attendanceForDate(db, user.id, date);
  const schedule = scheduleForDate(db, user.id, date);
  return { date, attendance: att || null, schedule: schedule || null };
}

function expectedShift(db, userId, date, fallbackCompanyId) {
  const schedule = scheduleForDate(db, userId, date);
  if (schedule) return schedule;
  const shift = db.prepare('SELECT s.*, c.name company_name FROM shifts s LEFT JOIN companies c ON c.id = s.company_id WHERE s.company_id = ? AND s.active = 1 ORDER BY s.start_time LIMIT 1')
    .get(fallbackCompanyId);
  return shift ? { ...shift, shift_name: shift.name, fallback: true } : null;
}

function clockIn(db, user, opts = {}) {
  const { date, stamp, time } = nowParts();
  const existing = attendanceForDate(db, user.id, date);
  if (existing && existing.clock_in) return { error: 'Anda sudah absen masuk hari ini.' };

  const shift = expectedShift(db, user.id, date, user.company_id);
  const shiftStart = shift ? timeToMin(shift.start_time) : null;
  const late = shiftStart !== null ? Math.max(0, timeToMin(time) - shiftStart) : 0;
  const status = late > 0 ? 'late' : 'present';
  const companyId = opts.companyId && user.role !== 'cashier'
    ? opts.companyId
    : (shift && shift.company_id ? shift.company_id : user.company_id);

  db.prepare(`INSERT INTO attendance (company_id, user_id, shift_id, date, clock_in, clock_out, status, late_minutes, work_minutes, note, created_at)
    VALUES (?,?,?,?,?,NULL,?,?,0,?,?)
    ON CONFLICT(user_id, date) DO UPDATE SET clock_in = excluded.clock_in, shift_id = excluded.shift_id,
      status = excluded.status, late_minutes = excluded.late_minutes, company_id = excluded.company_id`)
    .run(companyId, user.id, shift ? shift.id : null, date, stamp, status, late,
      opts.note ? String(opts.note).slice(0, 160) : null, U.nowISO());

  return { ok: true, date, clockIn: stamp, lateMinutes: late, shift };
}

function clockOut(db, user) {
  const { date, stamp } = nowParts();
  const existing = attendanceForDate(db, user.id, date);
  if (!existing || !existing.clock_in) return { error: 'Belum ada absen masuk hari ini.' };
  if (existing.clock_out) return { error: 'Anda sudah absen pulang hari ini.' };

  const total = diffMinutes(existing.clock_in, stamp);
  if (total < 0) {
    return { error: 'Jam perangkat lebih awal dari jam masuk. Periksa pengaturan waktu atau gunakan catatan absensi manual.' };
  }
  const breakMinutes = Math.min(existing.break_minutes || 0, Math.max(0, total - 60));
  const worked = Math.max(0, total - breakMinutes);
  db.prepare('UPDATE attendance SET clock_out = ?, work_minutes = ?, status = ?, note = COALESCE(note, ?) WHERE id = ?')
    .run(stamp, worked, existing.status === 'late' ? 'late' : 'present',
      worked < 120 ? 'Durasi kerja sangat singkat' : null, existing.id);
  return { ok: true, date, clockOut: stamp, workMinutes: worked, breakMinutes, totalMinutes: total };
}

function scheduleRange(db, ids, fromDate, days, filters = {}) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  const toDate = U.todayISO().slice(0, 10) >= fromDate ? addDays(fromDate, days - 1) : addDays(fromDate, days - 1);
  const args = [...ids, fromDate, toDate];
  let where = `ss.company_id IN (${p}) AND ss.date >= ? AND ss.date <= ?`;
  if (filters.userId) { where += ' AND ss.user_id = ?'; args.push(filters.userId); }
  return db.prepare(`SELECT ss.*, s.name shift_name, s.start_time, s.end_time, u.name user_name, u.role,
      c.name company_name,
      (SELECT a.status FROM attendance a WHERE a.user_id = ss.user_id AND a.date = ss.date) att_status,
      (SELECT a.late_minutes FROM attendance a WHERE a.user_id = ss.user_id AND a.date = ss.date) late_minutes
    FROM shift_schedules ss
    LEFT JOIN shifts s ON s.id = ss.shift_id
    LEFT JOIN users u ON u.id = ss.user_id
    LEFT JOIN companies c ON c.id = ss.company_id
    WHERE ${where} ORDER BY ss.date, s.start_time, u.name`).all(...args);
}

function addDays(dateStr, delta) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function attendanceRows(db, ids, month, filters = {}) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  const args = [...ids, month];
  let where = `a.company_id IN (${p}) AND substr(a.date,1,7) = ?`;
  if (filters.userId) { where += ' AND a.user_id = ?'; args.push(filters.userId); }
  if (filters.status && filters.status !== 'all') { where += ' AND a.status = ?'; args.push(filters.status); }
  return db.prepare(`SELECT a.*, u.name user_name, u.role, c.name company_name, s.name shift_name,
      s.start_time, s.end_time
    FROM attendance a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN companies c ON c.id = a.company_id
    LEFT JOIN shifts s ON s.id = a.shift_id
    WHERE ${where} ORDER BY a.date DESC, u.name LIMIT ?`).all(...args, Number(filters.limit) || 80);
}

function recap(db, ids, month) {
  if (!ids.length) return { rows: [], totals: {} };
  const p = ph(ids.length);
  const rows = db.prepare(`SELECT u.id user_id, u.name user_name, u.role, u.hourly_rate, c.name company_name,
      COUNT(a.id) shifts_scheduled,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) present_days,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) late_days,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) absent_days,
      COALESCE(SUM(a.late_minutes),0) late_minutes,
      COALESCE(SUM(a.work_minutes),0) work_minutes,
      MAX(a.date) last_date
    FROM attendance a JOIN users u ON u.id = a.user_id LEFT JOIN companies c ON c.id = a.company_id
    WHERE a.company_id IN (${p}) AND substr(a.date,1,7) = ?
    GROUP BY u.id ORDER BY work_minutes DESC`).all(...ids, month);

  const enriched = rows.map((r) => ({
    ...r,
    hours: r.work_minutes / 60,
    cost: (r.work_minutes / 60) * (r.hourly_rate || 0),
    punctuality: r.present_days + r.late_days + r.absent_days
      ? ((r.present_days / (r.present_days + r.late_days + r.absent_days)) * 100)
      : 0,
  }));
  const totals = {
    people: enriched.length,
    days: enriched.reduce((a, r) => a + r.present_days + r.late_days, 0),
    lateDays: enriched.reduce((a, r) => a + r.late_days, 0),
    absentDays: enriched.reduce((a, r) => a + r.absent_days, 0),
    lateMinutes: enriched.reduce((a, r) => a + r.late_minutes, 0),
    hours: enriched.reduce((a, r) => a + r.hours, 0),
    cost: enriched.reduce((a, r) => a + r.cost, 0),
  };
  return { rows: enriched, totals };
}

function dailySeries(db, ids, month) {
  if (!ids.length) return [];
  const p = ph(ids.length);
  return db.prepare(`SELECT date, COUNT(*) people,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) late,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) absent,
      COALESCE(SUM(work_minutes),0) work_minutes
    FROM attendance WHERE company_id IN (${p}) AND substr(date,1,7) = ?
    GROUP BY date ORDER BY date DESC LIMIT 14`).all(...ids, month);
}

// Estimasi biaya tenaga kerja: jam kerja aktual × tarif per jam.
function laborCost(db, ids, month) {
  if (!ids.length) return { hours: 0, cost: 0, people: 0, recorded: 0, variance: 0 };
  const r = recap(db, ids, month);
  const p = ph(ids.length);
  const recorded = db.prepare(`SELECT COALESCE(SUM(amount),0) v FROM transactions
    WHERE type = 'expense' AND (lower(category) LIKE '%gaji%' OR lower(category) LIKE '%tenaga kerja%' OR lower(category) LIKE '%upah%')
      AND company_id IN (${p}) AND substr(occurred_at,1,7) = ?`).get(...ids, month).v;
  return {
    hours: r.totals.hours,
    cost: r.totals.cost,
    people: r.totals.people,
    recorded,
    variance: recorded - r.totals.cost,
  };
}

module.exports = {
  STATUS_LABEL, shiftsOf, scheduleForDate, attendanceForDate, todayState, expectedShift,
  clockIn, clockOut, scheduleRange, attendanceRows, recap, dailySeries, laborCost,
  timeToMin, minToTime, addDays, nowParts,
};
