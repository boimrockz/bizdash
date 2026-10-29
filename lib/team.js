'use strict';

/**
 * Master data karyawan — satu tempat untuk melihat dan menyesuaikan data kepegawaian
 * (profil, penempatan) sekaligus kredensial akun (email, role, status, password, sesi).
 *
 * Aturan penting:
 * - Cakupan SELALU dari `ctx.allowedIds`; pengguna di luar cakupan tidak bisa dibaca/diubah.
 * - Data kepegawaian (nama, telepon, jabatan, atasan, entitas, tarif) = `team_write`
 *   (owner & manajer). Kredensial (email, role, password, status aktif, hapus) = `team_credential`
 *   (owner saja) supaya manajer tidak bisa menaikkan hak akses atau mengambil alih akun.
 * - Jabatan harus berada di entitas yang sama; atasan tidak boleh diri sendiri / membentuk siklus.
 * - Owner terakhir tidak boleh diturunkan role-nya, dinonaktifkan, atau dihapus.
 */

const auth = require('./auth');
const { hashPassword } = require('./password');
const U = require('./util');

const SESSION_HINT = 'Semua sesi lain pengguna ini akan keluar.';

function todayISO() {
  return U.todayISO();
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

/** Satu baris karyawan lengkap dengan jabatan, entitas, atasan, dan jumlah sesi aktif. */
const SELECT_ROW = `SELECT u.*, c.name company_name, c.level company_level,
    p.name position_name, p.level position_level,
    m.name manager_name, m.job_title manager_job,
    (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) session_count
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN positions p ON p.id = u.position_id
  LEFT JOIN users m ON m.id = u.manager_id`;

function rowById(db, id) {
  return db.prepare(`${SELECT_ROW} WHERE u.id = ?`).get(U.nowISO(), Number(id) || 0) || null;
}

function inScope(ctx, user) {
  return !!user && ctx.allowedIds.has(user.company_id);
}

/** Daftar karyawan dalam cakupan, terfilter. */
function list(db, ctx, filter = {}) {
  const ids = [...ctx.allowedIds];
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`${SELECT_ROW} WHERE u.company_id IN (${ph}) ORDER BY u.name`).all(U.nowISO(), ...ids);
  const q = String(filter.q || '').trim().toLowerCase();
  return rows.filter((u) => {
    if (filter.role && u.role !== filter.role) return false;
    if (filter.company && Number(u.company_id) !== Number(filter.company)) return false;
    if (filter.status === 'active' && !u.active) return false;
    if (filter.status === 'inactive' && u.active) return false;
    if (filter.position === 'none' && u.position_id) return false;
    if (filter.position === 'filled' && !u.position_id) return false;
    if (q) {
      const hay = `${u.name} ${u.email} ${u.job_title || ''} ${u.position_name || ''} ${u.company_name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function stats(db, rows) {
  const perRole = {};
  for (const role of Object.keys(auth.ROLE_LABELS)) perRole[role] = 0;
  let active = 0;
  let sessions = 0;
  let noPosition = 0;
  let noManager = 0;
  for (const u of rows) {
    perRole[u.role] = (perRole[u.role] || 0) + 1;
    if (u.active) active += 1;
    sessions += Number(u.session_count) || 0;
    if (!u.position_id) noPosition += 1;
    if (!u.manager_id) noManager += 1;
  }
  return {
    total: rows.length,
    active,
    inactive: rows.length - active,
    sessions,
    noPosition,
    noManager,
    perRole,
  };
}

/** Pilihan jabatan yang boleh dipakai untuk entitas tertentu. */
function positionOptions(db, companyId) {
  return db.prepare('SELECT id, name, level FROM positions WHERE company_id = ? AND active = 1 ORDER BY sort_order, id')
    .all(Number(companyId) || 0);
}

/** Calon atasan: pengguna aktif lain di entitas yang sama (atau induknya). */
function managerOptions(db, ctx, user) {
  const ids = [...ctx.allowedIds];
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT u.id, u.name, u.job_title, u.role, u.company_id, c.name company_name
    FROM users u LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.active = 1 AND u.company_id IN (${ph}) AND u.id != ? ORDER BY u.name`)
    .all(...ids, Number(user && user.id) || 0);
}

function hasRoleCycle(db, userId, managerId) {
  let cur = managerId ? db.prepare('SELECT id, manager_id FROM users WHERE id = ?').get(managerId) : null;
  let guard = 0;
  while (cur && guard++ < 60) {
    if (cur.id === Number(userId)) return true;
    cur = cur.manager_id ? db.prepare('SELECT id, manager_id FROM users WHERE id = ?').get(cur.manager_id) : null;
  }
  return false;
}

function isLastOwner(db, user) {
  if (user.role !== 'owner') return false;
  const owners = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'owner' AND active = 1").get().c;
  return owners <= 1;
}

/**
 * Simpan data kepegawaian (profil + penempatan).
 * Tidak menyentuh email/role/password — itu ada di saveCredential().
 */
function saveProfile(db, ctx, id, body = {}) {
  const user = rowById(db, id);
  if (!user) return { ok: false, error: 'Karyawan tidak ditemukan.' };
  if (!inScope(ctx, user)) return { ok: false, error: 'Karyawan berada di luar cakupan Anda.' };

  const name = cleanText(body.name, 120);
  if (!name) return { ok: false, error: 'Nama karyawan wajib diisi.' };

  const companyId = Number(body.company_id) || user.company_id;
  if (!ctx.allowedIds.has(companyId)) return { ok: false, error: 'Entitas di luar cakupan Anda.' };

  const positionId = Number(body.position_id) || null;
  let position = null;
  if (positionId) {
    position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position || !ctx.allowedIds.has(position.company_id)) {
      return { ok: false, error: 'Jabatan tidak valid atau di luar cakupan Anda.' };
    }
    if (Number(position.company_id) !== Number(companyId)) {
      return { ok: false, error: 'Jabatan harus berada di entitas yang sama dengan karyawan.' };
    }
  }

  const managerId = Number(body.manager_id) || null;
  if (managerId) {
    if (managerId === Number(user.id)) return { ok: false, error: 'Karyawan tidak dapat menjadi atasannya sendiri.' };
    const manager = db.prepare('SELECT id, company_id, active FROM users WHERE id = ?').get(managerId);
    if (!manager || !ctx.allowedIds.has(manager.company_id)) {
      return { ok: false, error: 'Atasan tidak valid atau di luar cakupan Anda.' };
    }
    if (!manager.active) return { ok: false, error: 'Atasan yang dipilih sedang nonaktif.' };
    if (hasRoleCycle(db, user.id, managerId)) return { ok: false, error: 'Rantai atasan membentuk siklus.' };
  }

  if (!isDate(body.joined_at)) {
    // tanggal bergabung boleh kosong
  } else if (String(body.joined_at) > todayISO()) {
    return { ok: false, error: 'Tanggal bergabung tidak boleh di masa depan.' };
  }

  const rate = Math.max(0, Math.min(10000000, Number(body.hourly_rate) || 0));
  const photo = String(body.photo_url || '').trim().slice(0, 400);
  const dropPhoto = String(body.remove_photo || '') === '1';
  if (photo && !/^https?:\/\//i.test(photo)) {
    return { ok: false, error: 'URL foto harus dimulai dengan http:// atau https://.' };
  }

  db.prepare(`UPDATE users SET company_id = ?, name = ?, job_title = ?, position_id = ?, manager_id = ?,
      phone = ?, location = ?, bio = ?, joined_at = ?, hourly_rate = ?, photo_url = ?
    WHERE id = ?`).run(
    companyId,
    name,
    cleanText(body.job_title, 80) || (position ? position.name : null),
    positionId,
    managerId,
    cleanText(body.phone, 30) || null,
    cleanText(body.location, 120) || null,
    cleanText(body.bio, 600) || null,
    isDate(body.joined_at) ? String(body.joined_at) : null,
    rate,
    dropPhoto ? null : (photo || user.photo_url || null),
    user.id,
  );

  const saved = rowById(db, user.id);
  const moved = Number(saved.company_id) !== Number(user.company_id);
  return { ok: true, user: saved, moved };
}

/** Kredensial: email, role, status aktif, password. Hanya untuk pemegang `team_credential`. */
function saveCredential(db, ctx, id, body = {}) {
  const user = rowById(db, id);
  if (!user) return { ok: false, error: 'Karyawan tidak ditemukan.' };
  if (!ctx.allowedIds.has(user.company_id)) return { ok: false, error: 'Karyawan berada di luar cakupan Anda.' };

  const changes = [];
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    const email = cleanText(body.email, 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Format email tidak valid.' };
    const clash = db.prepare('SELECT id FROM users WHERE lower(email) = ? AND id != ?').get(email, user.id);
    if (clash) return { ok: false, error: 'Email sudah dipakai akun lain.' };
    if (email !== String(user.email).toLowerCase()) changes.push('email');
    patch.email = email;
  }

  if (body.role) {
    if (!auth.ROLE_LABELS[body.role]) return { ok: false, error: 'Role tidak dikenal.' };
    if (body.role !== user.role) {
      if (isLastOwner(db, user)) return { ok: false, error: 'Owner aktif terakhir tidak bisa diturunkan role-nya.' };
      changes.push(`role ${user.role} → ${body.role}`);
      patch.role = body.role;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'active')) {
    const active = String(body.active) === '1' ? 1 : 0;
    if (!active && user.id === ctx.user.id) return { ok: false, error: 'Anda tidak dapat menonaktifkan akun sendiri.' };
    if (!active && isLastOwner(db, user)) return { ok: false, error: 'Owner aktif terakhir tidak bisa dinonaktifkan.' };
    if (active !== Number(user.active)) {
      changes.push(active ? 'aktif' : 'nonaktif');
      patch.active = active;
      if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    }
  }

  const password = String(body.password || '');
  if (password) {
    if (password.length < 6) return { ok: false, error: 'Password minimal 6 karakter.' };
    if (password !== String(body.password_confirm || '')) return { ok: false, error: 'Konfirmasi password tidak sama.' };
    patch.password_hash = hashPassword(password);
    changes.push('password diperbarui');
  }

  if (!Object.keys(patch).length) return { ok: false, error: 'Tidak ada perubahan kredensial yang dikirim.' };

  const fields = Object.keys(patch);
  db.prepare(`UPDATE users SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`)
    .run(...fields.map((f) => patch[f]), user.id);

  // Password baru & penonaktifan memaksa keluar semua sesi (kecuali sesi pemilik saat ini bila dirinya sendiri).
  if (patch.password_hash) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, ctx.sessionToken || '');
  }

  return { ok: true, user: rowById(db, user.id), changes };
}

/** Buat akun karyawan baru (owner). */
function create(db, ctx, body = {}) {
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 160).toLowerCase();
  const password = String(body.password || '');
  const companyId = Number(body.company_id) || 0;
  const role = auth.ROLE_LABELS[body.role] ? body.role : 'staff';

  if (!name) return { ok: false, error: 'Nama karyawan wajib diisi.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Format email tidak valid.' };
  if (password.length < 6) return { ok: false, error: 'Password minimal 6 karakter.' };
  if (password !== String(body.password_confirm || password)) {
    return { ok: false, error: 'Konfirmasi password tidak sama.' };
  }
  if (!ctx.allowedIds.has(companyId)) return { ok: false, error: 'Entitas tidak valid.' };
  if (db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email)) {
    return { ok: false, error: 'Email sudah terdaftar.' };
  }

  const positionId = Number(body.position_id) || null;
  if (positionId) {
    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position || Number(position.company_id) !== companyId) {
      return { ok: false, error: 'Jabatan harus berada di entitas yang dipilih.' };
    }
  }
  const managerId = Number(body.manager_id) || null;
  if (managerId) {
    const manager = db.prepare('SELECT id, company_id FROM users WHERE id = ?').get(managerId);
    if (!manager || !ctx.allowedIds.has(manager.company_id)) return { ok: false, error: 'Atasan tidak valid.' };
  }
  const joined = isDate(body.joined_at) && String(body.joined_at) <= todayISO() ? String(body.joined_at) : todayISO();
  const rate = Math.max(0, Number(body.hourly_rate) || 0);

  const info = db.prepare(`INSERT INTO users (company_id, name, email, password_hash, role, active, created_at,
      job_title, position_id, manager_id, phone, joined_at, hourly_rate)
    VALUES (?,?,?,?,?,1,?,?,?,?,?,?,?)`)
    .run(companyId, name, email, hashPassword(password), role, U.nowISO(),
      cleanText(body.job_title, 80) || null, positionId, managerId, cleanText(body.phone, 30) || null, joined, rate);
  return { ok: true, user: rowById(db, info.lastInsertRowid) };
}

function revokeSessions(db, id, keepToken = '') {
  const user = rowById(db, id);
  if (!user) return { ok: false, error: 'Karyawan tidak ditemukan.' };
  const info = db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(user.id, keepToken || '');
  return { ok: true, removed: info.changes, user };
}

function remove(db, ctx, id) {
  const user = rowById(db, id);
  if (!user) return { ok: false, error: 'Karyawan tidak ditemukan.' };
  if (!ctx.allowedIds.has(user.company_id)) return { ok: false, error: 'Karyawan berada di luar cakupan Anda.' };
  if (user.id === ctx.user.id) return { ok: false, error: 'Anda tidak dapat menghapus akun sendiri.' };
  if (isLastOwner(db, user)) return { ok: false, error: 'Owner aktif terakhir tidak bisa dihapus.' };
  const sales = db.prepare('SELECT COUNT(*) c FROM sales WHERE user_id = ?').get(user.id).c;
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('UPDATE users SET manager_id = NULL WHERE manager_id = ?').run(user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  return { ok: true, user, sales };
}

/** Ringkasan aktivitas: audit log terakhir, sesi, absensi 30 hari, progres Academy. */
function activity(db, user) {
  const logs = db.prepare(`SELECT action, detail, created_at FROM audit_log WHERE user_id = ?
    ORDER BY id DESC LIMIT 8`).all(user.id);
  const sessions = db.prepare(`SELECT token, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > ?
    ORDER BY created_at DESC LIMIT 5`).all(user.id, U.nowISO());
  const attendance = db.prepare(`SELECT COUNT(*) days,
      COALESCE(SUM(work_minutes), 0) minutes,
      COALESCE(SUM(late_minutes), 0) late
    FROM attendance WHERE user_id = ? AND date >= ?`).get(user.id, U.todayISO(new Date(Date.now() - 30 * 86400000)));
  const lms = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) done
    FROM lms_enrollments WHERE user_id = ?`).get(user.id);
  const certs = db.prepare("SELECT COUNT(*) c FROM lms_certificates WHERE user_id = ? AND status = 'active'").get(user.id).c;
  const sales = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(total), 0) v FROM sales WHERE user_id = ? AND status = 'paid'`)
    .get(user.id);
  return {
    logs,
    sessions,
    attendance: { days: attendance.days || 0, minutes: attendance.minutes || 0, late: attendance.late || 0 },
    lms: { total: lms.total || 0, done: lms.done || 0 },
    certificates: certs,
    sales: { count: sales.c || 0, value: sales.v || 0 },
  };
}

module.exports = {
  list, stats, rowById, positionOptions, managerOptions, saveProfile, saveCredential,
  create, revokeSessions, remove, activity, inScope, isLastOwner, hasRoleCycle,
};
