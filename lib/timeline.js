'use strict';

/**
 * Timeline proyek (Gantt chart) — satu sumber data untuk dua jenis pekerjaan:
 *   1. `project_tasks`  : tugas proyek dengan tanggal mulai & selesai sendiri
 *   2. `raci`           : aktivitas organisasi yang sudah ada (pakai `start_date` + `due_date`)
 *
 * Keduanya ditampilkan di satu timeline supaya progres tim terlihat utuh, tanpa
 * menduplikasi data RACI. Semua perubahan tanggal (drag & drop) divalidasi di server:
 * tanggal harus YYYY-MM-DD, selesai ≥ mulai, dan rentang maksimal 2 tahun.
 */

const U = require('./util');

const STATUS = {
  not_started: 'Belum mulai',
  in_progress: 'Berjalan',
  blocked: 'Terhambat',
  done: 'Selesai',
};

const STATUS_TONE = { not_started: 'muted', in_progress: 'indigo', blocked: 'bad', done: 'good' };

/** Zoom → jumlah hari yang ditampilkan (mobile-first: 2 minggu paling ringkas). */
const ZOOMS = { '2w': 14, '4w': 28, '6w': 42 };
const DEFAULT_ZOOM = '4w';
const MAX_SPAN_DAYS = 730;

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function toDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(iso, days) {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function daysBetween(from, to) {
  return Math.round((toDate(to) - toDate(from)) / 86400000);
}

/** Senin pada minggu tanggal tersebut (agar tampilan mingguan rapi). */
function weekStart(iso) {
  const d = toDate(iso);
  const dow = (d.getDay() + 6) % 7; // Senin = 0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

function windowFor(opts = {}) {
  const zoom = ZOOMS[opts.zoom] ? opts.zoom : DEFAULT_ZOOM;
  const days = ZOOMS[zoom];
  const from = isDate(opts.from) ? opts.from : weekStart(opts.today || U.todayISO());
  return { from, to: addDays(from, days - 1), days, zoom };
}

function shiftWindow(win, direction) {
  return {
    ...win,
    from: addDays(win.from, win.days * direction),
    to: addDays(win.to, win.days * direction),
  };
}

function statusLabel(status) {
  return STATUS[status] || status || '—';
}

function statusTone(status) {
  return STATUS_TONE[status] || 'muted';
}

/**
 * Ambil seluruh pekerjaan yang beririsan dengan jendela tanggal.
 * @returns {{items:Array, undated:Array}}
 */
function collect(db, ids, win, filter = {}) {
  if (!ids.length) return { items: [], undated: [] };
  const ph = ids.map(() => '?').join(',');
  const items = [];

  const tasks = db.prepare(`SELECT t.*, c.name company, u.name owner_name
    FROM project_tasks t
    LEFT JOIN companies c ON c.id = t.company_id
    LEFT JOIN users u ON u.id = t.owner_id
    WHERE t.company_id IN (${ph})`).all(...ids);
  for (const t of tasks) {
    items.push({
      source: 'task',
      id: t.id,
      company_id: t.company_id,
      company: t.company || '',
      title: t.title,
      description: t.description || '',
      owner_id: t.owner_id,
      owner: t.owner_name || '',
      start: t.start_date,
      end: t.end_date > t.start_date ? t.end_date : t.start_date,
      progress: Math.max(0, Math.min(100, Number(t.progress) || 0)),
      status: t.status,
      track: t.track || '',
    });
  }

  const raci = db.prepare(`SELECT r.*, c.name company, u.name owner_name
    FROM raci r
    LEFT JOIN companies c ON c.id = r.company_id
    LEFT JOIN users u ON u.id = r.responsible_id
    WHERE r.company_id IN (${ph})`).all(...ids);
  const undated = [];
  for (const r of raci) {
    const end = isDate(r.due_date) ? r.due_date : '';
    let start = isDate(r.start_date) ? r.start_date : '';
    if (!start && end) start = addDays(end, -6);
    if (!end && start) {
      // aktivitas dengan tanggal mulai saja: anggap 1 hari
      items.push({
        source: 'raci', id: r.id, company_id: r.company_id, company: r.company || '',
        title: r.activity, description: r.description || '', owner_id: r.responsible_id,
        owner: r.owner_name || '', start, end: start,
        progress: Math.max(0, Math.min(100, Number(r.progress) || 0)), status: r.status, track: 'RACI',
      });
      continue;
    }
    if (!start || !end) { undated.push(r); continue; }
    items.push({
      source: 'raci', id: r.id, company_id: r.company_id, company: r.company || '',
      title: r.activity, description: r.description || '', owner_id: r.responsible_id,
      owner: r.owner_name || '', start, end: end > start ? end : start,
      progress: Math.max(0, Math.min(100, Number(r.progress) || 0)), status: r.status, track: 'RACI',
    });
  }

  const visible = items.filter((it) => it.end >= win.from && it.start <= win.to)
    .filter((it) => {
      if (filter.companyId && it.company_id !== Number(filter.companyId)) return false;
      if (filter.status && it.status !== filter.status) return false;
      if (filter.source && it.source !== filter.source) return false;
      return true;
    })
    .sort((a, b) => (a.start === b.start ? a.title.localeCompare(b.title) : a.start.localeCompare(b.start)));

  return { items: visible, undated };
}

/** Posisi bar di dalam jendela (persen) — dikerjakan di server agar tetap benar tanpa JS. */
function place(item, win) {
  const startIdx = Math.max(0, daysBetween(win.from, item.start));
  const endIdx = Math.min(win.days - 1, daysBetween(win.from, item.end));
  const span = Math.max(1, endIdx - startIdx + 1);
  const clippedLeft = item.start < win.from;
  const clippedRight = item.end > win.to;
  return {
    ...item,
    leftPct: (startIdx / win.days) * 100,
    widthPct: Math.max((1 / win.days) * 100, (span / win.days) * 100),
    spanDays: Math.max(1, daysBetween(item.start, item.end) + 1),
    clippedLeft,
    clippedRight,
    late: item.status !== 'done' && item.end < U.todayISO(),
    startLabel: U.dateLabel(item.start),
    endLabel: U.dateLabel(item.end),
  };
}

function stats(items) {
  const today = U.todayISO();
  const done = items.filter((i) => i.status === 'done').length;
  const running = items.filter((i) => i.status === 'in_progress').length;
  const late = items.filter((i) => i.status !== 'done' && i.end < today).length;
  const blocked = items.filter((i) => i.status === 'blocked').length;
  const avg = items.length ? items.reduce((a, i) => a + i.progress, 0) / items.length : 0;
  return { total: items.length, done, running, late, blocked, avg };
}

// ---------------------------------------------------------------- validasi & simpan

function cleanPayload(db, ids, body) {
  const title = String(body.title || '').trim().slice(0, 160);
  if (!title) return { ok: false, error: 'Nama tugas wajib diisi.' };
  let start = String(body.start_date || '').trim();
  let end = String(body.end_date || '').trim();
  if (!isDate(start) || !isDate(end)) return { ok: false, error: 'Tanggal mulai & selesai wajib format YYYY-MM-DD.' };
  if (end < start) { const tmp = start; start = end; end = tmp; }
  if (daysBetween(start, end) > MAX_SPAN_DAYS) return { ok: false, error: 'Rentang tugas maksimal 2 tahun.' };
  const companyId = Number(body.company_id);
  if (!ids.includes(companyId)) return { ok: false, error: 'Entitas di luar cakupan Anda.' };
  const status = STATUS[body.status] ? body.status : 'not_started';
  const progress = Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));
  const ownerId = Number(body.owner_id) || null;
  if (ownerId) {
    const owner = db.prepare('SELECT id, company_id FROM users WHERE id = ?').get(ownerId);
    if (!owner || !ids.includes(owner.company_id)) return { ok: false, error: 'PIC di luar cakupan Anda.' };
  }
  return {
    ok: true,
    task: {
      title,
      description: String(body.description || '').slice(0, 2000),
      company_id: companyId,
      owner_id: ownerId,
      start_date: start,
      end_date: end,
      status: status === 'done' ? 'done' : status,
      progress: status === 'done' ? 100 : progress,
      track: String(body.track || '').trim().slice(0, 60),
    },
  };
}

function createTask(db, ids, body) {
  const out = cleanPayload(db, ids, body);
  if (!out.ok) return out;
  const t = out.task;
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), 0) m FROM project_tasks WHERE company_id = ?').get(t.company_id).m + 1;
  const info = db.prepare(`INSERT INTO project_tasks
    (company_id, title, description, owner_id, start_date, end_date, progress, status, track, sort_order, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(t.company_id, t.title, t.description, t.owner_id, t.start_date, t.end_date, t.progress, t.status, t.track, next, U.nowISO());
  return { ok: true, id: info.lastInsertRowid, task: t };
}

function taskById(db, id) {
  return db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(Number(id)) || null;
}

function updateTask(db, ids, id, body) {
  const row = taskById(db, id);
  if (!row || !ids.includes(row.company_id)) return { ok: false, error: 'Tugas tidak ditemukan dalam cakupan Anda.' };
  const out = cleanPayload(db, ids, body);
  if (!out.ok) return out;
  const t = out.task;
  db.prepare(`UPDATE project_tasks SET company_id = ?, title = ?, description = ?, owner_id = ?, start_date = ?,
    end_date = ?, progress = ?, status = ?, track = ? WHERE id = ?`)
    .run(t.company_id, t.title, t.description, t.owner_id, t.start_date, t.end_date, t.progress, t.status, t.track, row.id);
  return { ok: true, id: row.id, task: t };
}

function deleteTask(db, ids, id) {
  const row = taskById(db, id);
  if (!row || !ids.includes(row.company_id)) return { ok: false, error: 'Tugas tidak ditemukan dalam cakupan Anda.' };
  db.prepare('DELETE FROM project_tasks WHERE id = ?').run(row.id);
  return { ok: true, title: row.title };
}

/** Geser / ubah durasi lewat drag & drop (JSON). */
function moveDates(db, ids, source, id, body) {
  const start = String(body.start || '').trim();
  const end = String(body.end || '').trim();
  if (!isDate(start) || !isDate(end)) return { ok: false, error: 'Tanggal tidak valid.' };
  if (end < start) return { ok: false, error: 'Tanggal selesai tidak boleh sebelum mulai.' };
  if (daysBetween(start, end) > MAX_SPAN_DAYS) return { ok: false, error: 'Rentang tugas maksimal 2 tahun.' };

  if (source === 'raci') {
    const row = db.prepare('SELECT * FROM raci WHERE id = ?').get(Number(id));
    if (!row || !ids.includes(row.company_id)) return { ok: false, error: 'Aktivitas tidak ditemukan dalam cakupan Anda.' };
    db.prepare('UPDATE raci SET start_date = ?, due_date = ? WHERE id = ?').run(start, end, row.id);
    return { ok: true, start, end };
  }
  const row = taskById(db, id);
  if (!row || !ids.includes(row.company_id)) return { ok: false, error: 'Tugas tidak ditemukan dalam cakupan Anda.' };
  db.prepare('UPDATE project_tasks SET start_date = ?, end_date = ? WHERE id = ?').run(start, end, row.id);
  return { ok: true, start, end };
}

/** Ringkas: ubah status/progres aktivitas RACI langsung dari timeline. */
function updateRaciRow(db, ids, id, body) {
  const row = db.prepare('SELECT * FROM raci WHERE id = ?').get(Number(id));
  if (!row || !ids.includes(row.company_id)) return { ok: false, error: 'Aktivitas tidak ditemukan dalam cakupan Anda.' };
  const status = STATUS[body.status] ? body.status : row.status;
  const progress = Math.max(0, Math.min(100, Math.round(Number(body.progress === undefined ? row.progress : body.progress) || 0)));
  let start = isDate(body.start_date) ? body.start_date : row.start_date;
  const rawEnd = body.due_date || body.end_date;
  let end = isDate(rawEnd) ? rawEnd : row.due_date;
  if (start && end && end < start) { const tmp = start; start = end; end = tmp; }
  db.prepare('UPDATE raci SET status = ?, progress = ?, start_date = ?, due_date = ? WHERE id = ?')
    .run(status, status === 'done' ? 100 : progress, start || null, end || null, row.id);
  return { ok: true };
}

module.exports = {
  STATUS, STATUS_TONE, ZOOMS, DEFAULT_ZOOM, MAX_SPAN_DAYS,
  isDate, addDays, daysBetween, weekStart, windowFor, shiftWindow,
  statusLabel, statusTone, collect, place, stats,
  createTask, updateTask, deleteTask, moveDates, updateRaciRow, taskById,
};
