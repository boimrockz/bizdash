'use strict';

/**
 * Ondeway Coffee Academy — mesin LMS.
 *
 * Alur kompetensi (mengikuti framework): enrol → materi → kuis teori (≥80/85)
 * → asesmen praktik oleh trainer (rubrik berbobot) → sertifikat & badge.
 * Badge/sertifikat hanya terbit bila kompetensi terbukti, bukan karena video selesai.
 */

const U = require('./util');
const settings = require('./settings');
const video = require('./video');
const { COURSES, PATHS, BADGES, TRACK_LABEL, TRACK_TONE, LEVEL_LABEL, LEVELS, buildDocs } = require('./lms/curriculum');

const SEED_FLAG = 'lms_seed_version';
const SEED_VERSION = '2026-11-academy-3';
const CERT_VALID_DAYS = 365;
const POINTS = { module: 10, theory: 10, practical: 20, badge: 15 };

const byCode = new Map(COURSES.map((c) => [c.code, c]));

// ---------------------------------------------------------------- seed

function seedLms(db) {
  const tx = db.transaction(() => {
    const insertCourse = db.prepare(`INSERT INTO lms_courses
      (code, title, track, level, summary, objectives, relevance, prerequisites, materials, sop, rubric,
       pass_theory, pass_practical, gate, badge, version, owner, review_date, status, duration_min, sort_order, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'published', ?,?,?)
      ON CONFLICT(code) DO NOTHING`);
    const insertQuestion = db.prepare(`INSERT INTO lms_questions (course_id, question, options, answer, why, sort_order)
      VALUES (?,?,?,?,?,?)`);

    for (const c of COURSES) {
      const exists = db.prepare('SELECT id FROM lms_courses WHERE code = ?').get(c.code);
      if (exists) continue;
      const info = insertCourse.run(c.code, c.title, c.track, c.level, c.summary || '',
        JSON.stringify(c.objectives || []), c.relevance || '', JSON.stringify(c.prerequisites || []),
        JSON.stringify(c.materials || []), JSON.stringify(c.sop || null), JSON.stringify(c.rubric || []),
        c.passTheory || 80, c.passPractical || 85, c.gate || '', c.badge || null,
        c.version, c.owner, c.review_date, c.duration || 30, c.sort_order, U.nowISO());
      const courseId = info.lastInsertRowid;
      (c.quiz || []).forEach((q, i) => {
        insertQuestion.run(courseId, q.question, JSON.stringify(q.options), q.answer, q.why || '', i + 1);
      });
    }

    const insertPath = db.prepare(`INSERT INTO lms_paths (code, name, role_target, description, courses, track, sort_order)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(code) DO NOTHING`);
    PATHS.forEach((p, i) => insertPath.run(p.code, p.name, p.role_target, p.description, JSON.stringify(p.courses), p.track, i + 1));

    const insertDoc = db.prepare(`INSERT INTO lms_docs (kind, code, title, version, status, owner, effective_date,
        summary, body, course_code, created_at, source, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, 'seed', ?) ON CONFLICT(code) DO NOTHING`);
    for (const d of buildDocs()) {
      insertDoc.run(d.kind, d.code, d.title, d.version, d.status, d.owner, U.todayISO(), d.summary, d.body,
        d.course_code, U.nowISO(), U.nowISO());
    }

    seedMaterials(db);
  });
  tx();

  // Penugasan awal hanya sekali per versi seed, tidak menimpa penugasan manual.
  if (settings.get(db, SEED_FLAG) !== SEED_VERSION) {
    autoEnroll(db);
    settings.set(db, SEED_FLAG, SEED_VERSION);
  }
}

/**
 * Jenjang kepemimpinan mengikuti **jabatan di struktur organisasi** (`positions.level`),
 * bukan hanya `users.role`: seorang Head Barista ber-role kasir tetap Supervisor (S1),
 * dan Manajer Outlet ber-role manager mendapat jalur Manajer (M2).
 * Bila pengguna belum punya jabatan, dipetakan dari role-nya.
 */
const POSITION_PATH = { supervisor: 'PATH-SUP', manager: 'PATH-MGR', director: 'PATH-DIR', owner: 'PATH-DIR' };
const ROLE_PATH = { owner: 'PATH-DIR', director: 'PATH-DIR', manager: 'PATH-MGR', finance: 'PATH-MGR' };

function autoEnroll(db) {
  const users = db.prepare(`SELECT u.id, u.role, u.job_title, p.level position_level
    FROM users u LEFT JOIN positions p ON p.id = u.position_id WHERE u.active = 1`).all();
  const decide = (user) => {
    const title = String(user.job_title || '').toLowerCase();
    // Foundation & Hospitality wajib untuk semua yang bekerja di operasional/berhadapan dengan pelanggan.
    const paths = ['PATH-FND', 'PATH-HOS'];
    if (/barista|kasir|bar|kopi|coffee|roaster|produksi|outlet/.test(title) || ['cashier'].includes(user.role)) {
      if (!paths.includes('PATH-HOS')) paths.push('PATH-HOS');
    }
    // Jalur teknis barista hanya untuk yang meracik minuman.
    if (/barista|head bar|supervisor bar|bar supervisor|roaster|produksi/.test(title)) paths.push('PATH-BAR');
    // Jalur kepemimpinan sesuai jenjang jabatan.
    const level = String(user.position_level || '').toLowerCase();
    const leadership = POSITION_PATH[level] || ROLE_PATH[user.role];
    if (leadership && !paths.includes(leadership)) paths.push(leadership);
    return paths;
  };
  for (const user of users) {
    for (const pathCode of decide(user)) {
      try {
        enrollPath(db, { userId: user.id, pathCode, assignedBy: null, silent: true });
      } catch (err) { /* seed tidak boleh gagal karena satu pengguna */ }
    }
  }
}

// ---------------------------------------------------------------- materi modul (bisa diedit trainer)

/**
 * Materi disimpan di tabel `lms_materials` (bukan lagi hanya JSON di `lms_courses.materials`)
 * supaya trainer bisa menambah/mengubah bagian tanpa menyentuh kurikulum inti.
 * Seed hanya mengisi modul yang BELUM punya baris materi — edit pengguna tidak pernah ditimpa.
 */
function seedMaterials(db) {
  const insert = db.prepare(`INSERT INTO lms_materials (course_id, sort_order, kind, title, body, url, provider, duration_min, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const courses = db.prepare('SELECT id, code, materials FROM lms_courses').all();
  for (const course of courses) {
    const has = db.prepare('SELECT COUNT(*) c FROM lms_materials WHERE course_id = ?').get(course.id).c;
    if (has) continue;
    const list = safeJson(course.materials, []);
    list.forEach((m, i) => {
      insert.run(course.id, i + 1, 'text', String(m.title || `Bagian ${i + 1}`).slice(0, 160),
        String(m.body || ''), '', '', Number(m.duration_min) || 0, U.nowISO());
    });
  }
}

function materialsOf(db, courseId) {
  const rows = db.prepare('SELECT * FROM lms_materials WHERE course_id = ? ORDER BY sort_order, id').all(Number(courseId));
  return rows.map((r) => ({
    ...r,
    kind: ['text', 'video', 'pdf'].includes(r.kind) ? r.kind : 'text',
    url: r.url || '',
  }));
}

function courseById(db, id) {
  return db.prepare('SELECT id, code, title FROM lms_courses WHERE id = ?').get(Number(id)) || null;
}

function materialById(db, id) {
  return db.prepare('SELECT * FROM lms_materials WHERE id = ?').get(Number(id)) || null;
}

function addMaterial(db, opts) {
  const video = require('./video');
  const course = courseRow(db, opts.code);
  if (!course) return { ok: false, error: 'Modul tidak ditemukan.' };
  const kind = ['text', 'video', 'pdf'].includes(opts.kind) ? opts.kind : 'text';
  const title = String(opts.title || '').trim().slice(0, 160);
  if (!title) return { ok: false, error: 'Judul materi wajib diisi.' };
  const body = String(opts.body || '').slice(0, 6000);
  if (kind === 'text' && !body.trim()) return { ok: false, error: 'Isi materi teks tidak boleh kosong.' };
  const prepared = video.prepare(kind, opts.url);
  if (!prepared.ok) return prepared;
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), 0) m FROM lms_materials WHERE course_id = ?').get(course.id).m + 1;
  const info = db.prepare(`INSERT INTO lms_materials (course_id, sort_order, kind, title, body, url, provider, duration_min, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(course.id, next, kind, title, body, prepared.openUrl || prepared.embedUrl || '', prepared.provider || '',
      Math.max(0, Math.min(600, Number(opts.duration_min) || 0)), U.nowISO());
  return { ok: true, id: info.lastInsertRowid, kind, course };
}

function updateMaterial(db, id, opts) {
  const video = require('./video');
  const row = materialById(db, id);
  if (!row) return { ok: false, error: 'Materi tidak ditemukan.' };
  const kind = ['text', 'video', 'pdf'].includes(opts.kind) ? opts.kind : row.kind;
  const title = String(opts.title || '').trim().slice(0, 160);
  if (!title) return { ok: false, error: 'Judul materi wajib diisi.' };
  const body = String(opts.body === undefined ? row.body || '' : opts.body).slice(0, 6000);
  if (kind === 'text' && !body.trim()) return { ok: false, error: 'Isi materi teks tidak boleh kosong.' };
  const prepared = video.prepare(kind, opts.url === undefined ? row.url : opts.url);
  if (!prepared.ok) return prepared;
  db.prepare(`UPDATE lms_materials SET kind = ?, title = ?, body = ?, url = ?, provider = ?, duration_min = ? WHERE id = ?`)
    .run(kind, title, body, prepared.openUrl || prepared.embedUrl || '', prepared.provider || '',
      Math.max(0, Math.min(600, Number(opts.duration_min === undefined ? row.duration_min : opts.duration_min) || 0)), row.id);
  return { ok: true, id: row.id, kind, course_id: row.course_id };
}

function deleteMaterial(db, id) {
  const row = materialById(db, id);
  if (!row) return { ok: false, error: 'Materi tidak ditemukan.' };
  const list = materialsOf(db, row.course_id);
  const idx = list.findIndex((m) => m.id === row.id);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM lms_materials WHERE id = ?').run(row.id);
    if (idx >= 0) {
      // Buang progres milik bagian yang dihapus, lalu geser bagian sesudahnya naik satu.
      db.prepare('DELETE FROM lms_progress WHERE course_id = ? AND section = ?').run(row.course_id, idx);
      shiftProgress(db, row.course_id, idx + 1, -1);
    }
  });
  tx();
  return { ok: true, course_id: row.course_id, title: row.title };
}

function moveMaterial(db, id, direction) {
  const row = materialById(db, id);
  if (!row) return { ok: false, error: 'Materi tidak ditemukan.' };
  const list = materialsOf(db, row.course_id);
  const idx = list.findIndex((m) => m.id === row.id);
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= list.length) return { ok: false, error: 'Sudah di urutan paling ujung.' };
  const tx = db.transaction(() => {
    list.forEach((m, i) => db.prepare('UPDATE lms_materials SET sort_order = ? WHERE id = ?').run(i + 1, m.id));
    db.prepare('UPDATE lms_materials SET sort_order = ? WHERE id = ?').run(target + 1, list[idx].id);
    db.prepare('UPDATE lms_materials SET sort_order = ? WHERE id = ?').run(idx + 1, list[target].id);
    // Progres ikut berpindah bersama materinya (bukan tertinggal di posisi lama).
    swapProgress(db, row.course_id, idx, target);
  });
  tx();
  return { ok: true, course_id: row.course_id };
}

/** Modul + materinya (dipakai halaman modul & dasbor peserta). */
function courseWithMaterials(db, code) {
  const course = hydrate(courseRow(db, code));
  if (!course) return null;
  course.materials = materialsOf(db, course.id);
  return course;
}

// ---------------------------------------------------------------- katalog & enrolmen

function courseRow(db, code) {
  return db.prepare('SELECT * FROM lms_courses WHERE code = ?').get(String(code || '').toUpperCase());
}

function hydrate(row) {
  if (!row) return null;
  return {
    ...row,
    objectives: safeJson(row.objectives, []),
    prerequisites: safeJson(row.prerequisites, []),
    materials: safeJson(row.materials, []),
    sop: safeJson(row.sop, null),
    rubric: safeJson(row.rubric, []),
  };
}

function safeJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value; // sudah dihidrasi (mis. dari hydrate())
  try {
    const out = JSON.parse(value);
    return out === null || out === undefined ? fallback : out;
  } catch (err) {
    return fallback;
  }
}

function listCourses(db, filter = {}) {
  const rows = db.prepare('SELECT * FROM lms_courses ORDER BY sort_order, code').all().map(hydrate);
  return rows.filter((c) => {
    if (filter.track && c.track !== filter.track) return false;
    if (filter.level && c.level !== filter.level) return false;
    if (filter.status && c.status !== filter.status) return false;
    if (filter.q) {
      const hay = `${c.code} ${c.title} ${c.summary}`.toLowerCase();
      if (!hay.includes(String(filter.q).toLowerCase())) return false;
    }
    return true;
  });
}

function pathRows(db) {
  return db.prepare('SELECT * FROM lms_paths ORDER BY sort_order, id').all()
    .map((p) => ({ ...p, courses: safeJson(p.courses, []) }));
}

function enrollPath(db, opts) {
  const path = pathRows(db).find((p) => p.code === opts.pathCode);
  if (!path) return 0;
  const due = opts.dueDays === 0 ? null : U.todayISO(new Date(Date.now() + (opts.dueDays || 45) * 86400000));
  let added = 0;
  const tx = db.transaction(() => {
    for (const code of path.courses) {
      const course = courseRow(db, code);
      if (!course) continue;
      const info = db.prepare(`INSERT INTO lms_enrollments (course_id, user_id, assigned_by, due_date, status, created_at)
        VALUES (?,?,?,?, 'assigned', ?) ON CONFLICT(user_id, course_id) DO NOTHING`)
        .run(course.id, opts.userId, opts.assignedBy || null, due, U.nowISO());
      if (info.changes) added += 1;
    }
  });
  tx();
  return added;
}

function assignCourse(db, opts) {
  const course = courseRow(db, opts.code);
  if (!course) return false;
  const due = opts.dueDate || U.todayISO(new Date(Date.now() + 30 * 86400000));
  const info = db.prepare(`INSERT INTO lms_enrollments (course_id, user_id, assigned_by, due_date, status, created_at)
    VALUES (?,?,?,?, 'assigned', ?) ON CONFLICT(user_id, course_id) DO NOTHING`)
    .run(course.id, opts.userId, opts.assignedBy || null, due, U.nowISO());
  return !!info.changes;
}

function enrollment(db, userId, courseId) {
  return db.prepare('SELECT * FROM lms_enrollments WHERE user_id = ? AND course_id = ?').get(userId, courseId);
}

function enrollmentsOf(db, userId) {
  return db.prepare(`SELECT e.*, c.code, c.title, c.track, c.level, c.duration_min, c.pass_theory, c.pass_practical, c.sort_order
    FROM lms_enrollments e JOIN lms_courses c ON c.id = e.course_id
    WHERE e.user_id = ? ORDER BY c.sort_order`).all(userId);
}

function ensureEnrollment(db, userId, courseId) {
  const row = enrollment(db, userId, courseId);
  if (row) return row;
  db.prepare(`INSERT INTO lms_enrollments (course_id, user_id, status, created_at) VALUES (?,?, 'in_progress', ?)
    ON CONFLICT(user_id, course_id) DO NOTHING`).run(courseId, userId, U.nowISO());
  return enrollment(db, userId, courseId);
}

// ---------------------------------------------------------------- progres belajar

function sectionsDone(db, userId, courseId) {
  return db.prepare('SELECT section FROM lms_progress WHERE user_id = ? AND course_id = ?').all(userId, courseId).map((r) => r.section);
}

/**
 * Progres materi disimpan per **posisi** bagian (`lms_progress.section`). Karena itu
 * menambah/mengurutkan/menghapus materi harus ikut menggeser baris progres — kalau tidak,
 * tanda "selesai" menempel ke materi yang salah. `addMaterial` selalu menaruh materi baru
 * di urutan terakhir, jadi hanya geser & hapus yang perlu penyesuaian.
 */
function shiftProgress(db, courseId, fromIndex, delta) {
  db.prepare('UPDATE lms_progress SET section = section + ? WHERE course_id = ? AND section >= ?')
    .run(delta, Number(courseId), Number(fromIndex));
}

function swapProgress(db, courseId, a, b) {
  const tx = db.transaction(() => {
    db.prepare('UPDATE lms_progress SET section = -1 WHERE course_id = ? AND section = ?').run(Number(courseId), Number(a));
    db.prepare('UPDATE lms_progress SET section = ? WHERE course_id = ? AND section = ?').run(Number(a), Number(courseId), Number(b));
    db.prepare('UPDATE lms_progress SET section = ? WHERE course_id = ? AND section = -1').run(Number(b), Number(courseId));
  });
  tx();
}

function completeSection(db, userId, courseId, section) {
  const index = Number(section);
  const total = db.prepare('SELECT COUNT(*) c FROM lms_materials WHERE course_id = ?').get(Number(courseId)).c;
  if (!Number.isInteger(index) || index < 0) return false;
  if (total > 0 && index >= total) return false;
  const row = ensureEnrollment(db, userId, courseId);
  db.prepare(`INSERT INTO lms_progress (course_id, user_id, section, completed_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id, course_id, section) DO NOTHING`).run(courseId, userId, index, U.nowISO());
  if (row.status === 'assigned') {
    db.prepare("UPDATE lms_enrollments SET status = 'in_progress', started_at = COALESCE(started_at, ?) WHERE id = ?")
      .run(U.nowISO(), row.id);
  }
  return true;
}

function questionsOf(db, courseId, withAnswer = false) {
  const rows = db.prepare('SELECT * FROM lms_questions WHERE course_id = ? ORDER BY sort_order, id').all(courseId);
  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    options: safeJson(r.options, []),
    why: withAnswer ? r.why : '',
    answer: withAnswer ? r.answer : null,
  }));
}

function attemptsOf(db, userId, courseId) {
  return db.prepare('SELECT * FROM lms_attempts WHERE user_id = ? AND course_id = ? ORDER BY id DESC').all(userId, courseId);
}

/** Nilai kuis; satu jawaban benar = bobot sama. Kelulusan mengikuti course.pass_theory. */
function gradeQuiz(db, opts) {
  const course = courseRow(db, opts.code);
  if (!course) return { ok: false, error: 'Modul tidak ditemukan.' };
  const questions = questionsOf(db, course.id, true);
  if (!questions.length) return { ok: false, error: 'Modul ini belum memiliki kuis.' };
  const answers = opts.answers || {};
  let correct = 0;
  const detail = questions.map((q) => {
    const given = Number(answers[q.id]);
    const isCorrect = given === q.answer;
    if (isCorrect) correct += 1;
    return { id: q.id, given, answer: q.answer, correct: isCorrect, why: q.why };
  });
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= (course.pass_theory || 80);
  const row = ensureEnrollment(db, opts.userId, course.id);
  db.prepare('INSERT INTO lms_attempts (course_id, user_id, score, passed, answers, created_at) VALUES (?,?,?,?,?,?)')
    .run(course.id, opts.userId, score, passed ? 1 : 0, JSON.stringify(detail), U.nowISO());
  db.prepare(`UPDATE lms_enrollments SET theory_score = MAX(COALESCE(theory_score, 0), ?),
      status = CASE WHEN ? = 1 AND status IN ('assigned','in_progress') THEN 'theory_passed' ELSE status END,
      started_at = COALESCE(started_at, ?) WHERE id = ?`)
    .run(score, passed ? 1 : 0, U.nowISO(), row.id);
  return { ok: true, score, passed, correct, total: questions.length, detail };
}

// ---------------------------------------------------------------- asesmen praktik

function practicalsOf(db, userId, courseId) {
  return db.prepare(`SELECT p.*, a.name assessor FROM lms_practicals p LEFT JOIN users a ON a.id = p.assessor_id
    WHERE p.user_id = ? AND p.course_id = ? ORDER BY p.id DESC`).all(userId, courseId);
}

/** Skor praktik = Σ(bobot aspek × skor 1..4 / 4). Aspek kritis bernilai 0 membuat gagal. */
function scorePractical(rubric, scores) {
  let total = 0;
  let criticalFail = false;
  for (const aspect of rubric) {
    const raw = Number(scores[aspect.aspect]);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(4, raw)) : 0;
    if (aspect.critical && value === 0) criticalFail = true;
    total += (aspect.weight / 4) * value;
  }
  return { total: Math.round(total), criticalFail };
}

function recordPractical(db, opts) {
  const course = courseRow(db, opts.code);
  if (!course) return { ok: false, error: 'Modul tidak ditemukan.' };
  const rubric = safeJson(course.rubric, []);
  if (!rubric.length) return { ok: false, error: 'Modul ini belum memiliki rubrik praktik.' };
  const { total, criticalFail } = scorePractical(rubric, opts.scores || {});
  const passed = !criticalFail && total >= (course.pass_practical || 85);
  const row = ensureEnrollment(db, opts.userId, course.id);
  db.prepare(`INSERT INTO lms_practicals (course_id, user_id, assessor_id, scores, total, passed, critical_fail, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(course.id, opts.userId, opts.assessorId || null, JSON.stringify(opts.scores || {}), total, passed ? 1 : 0,
      criticalFail ? 1 : 0, String(opts.note || '').slice(0, 400), U.nowISO());
  const theoryOk = Number(row.theory_score || 0) >= (course.pass_theory || 80);
  const complete = passed && theoryOk;
  db.prepare(`UPDATE lms_enrollments SET practical_score = MAX(COALESCE(practical_score, 0), ?),
      status = CASE WHEN ? = 1 THEN 'completed' ELSE status END,
      completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END WHERE id = ?`)
    .run(total, complete ? 1 : 0, complete ? 1 : 0, U.nowISO(), row.id);
  let badges = [];
  if (complete) {
    badges = awardBadges(db, opts.userId);
    maybeIssueCertificates(db, opts.userId, opts.assessorId || null);
  }
  return { ok: true, total, passed, criticalFail, theoryOk, complete, badges };
}

// ---------------------------------------------------------------- sertifikat & badge

function levelCourses(db, track, level) {
  return db.prepare("SELECT id, code FROM lms_courses WHERE track = ? AND level = ? AND status = 'published'").all(track, level);
}

function levelComplete(db, userId, track, level) {
  const courses = levelCourses(db, track, level);
  if (!courses.length) return { total: 0, done: 0, complete: false };
  const done = courses.filter((c) => {
    const e = enrollment(db, userId, c.id);
    return e && e.status === 'completed';
  }).length;
  return { total: courses.length, done, complete: done === courses.length };
}

function maybeIssueCertificates(db, userId, issuedBy) {
  const issued = [];
  for (const track of ['foundation', 'barista', 'hospitality', 'leadership']) {
    const levels = [...new Set(db.prepare('SELECT level FROM lms_courses WHERE track = ?').all(track).map((r) => r.level))];
    for (const level of levels) {
      const state = levelComplete(db, userId, track, level);
      if (!state.complete) continue;
      const exists = db.prepare("SELECT id FROM lms_certificates WHERE user_id = ? AND track = ? AND level = ? AND status = 'active'")
        .get(userId, track, level);
      if (exists) continue;
      const prefix = { foundation: 'FND', barista: 'BAR', hospitality: 'HOS', kitchen: 'KIT', leadership: 'LDR' }[track] || track.slice(0, 3).toUpperCase();
      const code = `LMS-${prefix}-${level}-${String(userId).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
      const expires = U.todayISO(new Date(Date.now() + CERT_VALID_DAYS * 86400000));
      db.prepare(`INSERT INTO lms_certificates (user_id, track, level, code, issued_by, issued_at, expires_at, status, note)
        VALUES (?,?,?,?,?,?,?, 'active', ?)`).run(userId, track, level, code, issuedBy || null, U.nowISO(), expires,
        `${state.done}/${state.total} modul lulus`);
      issued.push({ track, level, code });
    }
  }
  return issued;
}

function hasBadge(db, userId, badge) {
  return !!db.prepare('SELECT id FROM lms_badges WHERE user_id = ? AND badge = ?').get(userId, badge);
}

/** Badge dari framework; hanya terbit bila seluruh modul level terkait lulus. */
function awardBadges(db, userId) {
  const awarded = [];
  const give = (code, condition) => {
    if (!condition || hasBadge(db, userId, code)) return;
    db.prepare('INSERT INTO lms_badges (user_id, badge, awarded_at) VALUES (?,?,?) ON CONFLICT(user_id, badge) DO NOTHING')
      .run(userId, code, U.nowISO());
    awarded.push(code);
  };
  give('explorer', levelComplete(db, userId, 'foundation', 'FND').complete);
  give('coffee_learner', levelComplete(db, userId, 'barista', 'B0').complete);
  give('espresso_ready', levelComplete(db, userId, 'barista', 'B1').complete);
  give('service_excellence', levelComplete(db, userId, 'hospitality', 'HOS').complete);
  give('quality_guardian', levelComplete(db, userId, 'barista', 'B2').complete);
  give('shift_leader', levelComplete(db, userId, 'barista', 'B3').complete);
  const sig = enrollment(db, userId, (courseRow(db, 'BAR-206') || {}).id);
  give('signature_specialist', sig && sig.status === 'completed');
  const mentor = enrollment(db, userId, (courseRow(db, 'BAR-408') || {}).id);
  give('mentor', mentor && mentor.status === 'completed');

  // Leadership Academy — satu badge per jenjang, plus pengakuan kompetensi khusus.
  const completed = (code) => {
    const row = courseRow(db, code);
    const e = row ? enrollment(db, userId, row.id) : null;
    return !!e && e.status === 'completed';
  };
  give('floor_leader', levelComplete(db, userId, 'leadership', 'SUP').complete);
  give('people_developer', completed('SUP-104'));
  give('unit_manager', levelComplete(db, userId, 'leadership', 'MGR').complete);
  give('cost_controller', completed('MGR-103') && completed('MGR-107'));
  give('strategy_executive', levelComplete(db, userId, 'leadership', 'DIR').complete);
  give('board_ready', completed('DIR-108'));
  return awarded;
}

function badgesOf(db, userId) {
  return db.prepare('SELECT * FROM lms_badges WHERE user_id = ? ORDER BY id').all(userId)
    .map((b) => ({ ...b, meta: BADGES.find((x) => x.code === b.badge) || { name: b.badge, icon: 'trophy' } }));
}

function certificatesOf(db, userId) {
  return db.prepare(`SELECT c.*, u.name issued_by_name FROM lms_certificates c LEFT JOIN users u ON u.id = c.issued_by
    WHERE c.user_id = ? ORDER BY c.id DESC`).all(userId);
}

// ---------------------------------------------------------------- dashboard & KPI

function learnerDashboard(db, userId) {
  const enrolls = enrollmentsOf(db, userId);
  const progress = enrolls.map((e) => {
    const course = courseRow(db, e.code);
    const done = sectionsDone(db, userId, e.course_id);
    const practicals = practicalsOf(db, userId, e.course_id);
    return {
      ...e,
      sections: (course && materialsOf(db, course.id).length) || 0,
      sectionsDone: done.length,
      attempts: attemptsOf(db, userId, e.course_id).length,
      lastPractical: practicals[0] || null,
      trackLabel: TRACK_LABEL[e.track] || e.track,
      levelLabel: LEVEL_LABEL[e.level] || e.level,
    };
  });
  const assigned = progress.length;
  const completed = progress.filter((p) => p.status === 'completed').length;
  const overdue = progress.filter((p) => p.status !== 'completed' && p.due_date && p.due_date < U.todayISO()).length;
  const minutes = progress.filter((p) => p.status === 'completed').reduce((a, p) => a + (p.duration_min || 0), 0);
  const points = completed * POINTS.module
    + db.prepare('SELECT COUNT(*) c FROM lms_attempts WHERE user_id = ? AND passed = 1').get(userId).c * POINTS.theory
    + db.prepare('SELECT COUNT(*) c FROM lms_practicals WHERE user_id = ? AND passed = 1').get(userId).c * POINTS.practical
    + badgesOf(db, userId).length * POINTS.badge;
  return {
    progress,
    summary: {
      assigned, completed,
      completion: assigned ? Math.round((completed / assigned) * 100) : 0,
      overdue, minutes, points,
      badges: badgesOf(db, userId),
      certificates: certificatesOf(db, userId),
    },
  };
}

function scopeUserIds(ctx) {
  const ids = [...ctx.allowedIds];
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db(ctx).prepare(`SELECT id FROM users WHERE active = 1 AND company_id IN (${ph})`).all(...ids).map((r) => r.id);
}

function db(ctx) {
  return ctx.db;
}

function kpis(db, userIds) {
  if (!userIds.length) {
    return { learners: 0, completion: 0, passRate: 0, practicalPassRate: 0, certificateCoverage: 0, overdue: 0, assigned: 0, completed: 0, badges: 0, points: 0 };
  }
  const ph = userIds.map(() => '?').join(',');
  const enroll = db.prepare(`SELECT status, COUNT(*) c FROM lms_enrollments WHERE user_id IN (${ph}) GROUP BY status`).all(...userIds);
  const total = enroll.reduce((a, r) => a + r.c, 0);
  const completed = (enroll.find((r) => r.status === 'completed') || {}).c || 0;
  const overdue = db.prepare(`SELECT COUNT(*) c FROM lms_enrollments
    WHERE user_id IN (${ph}) AND status != 'completed' AND due_date IS NOT NULL AND due_date < ?`).get(...userIds, U.todayISO()).c;
  const attempts = db.prepare(`SELECT COUNT(*) c, SUM(passed) p FROM lms_attempts WHERE user_id IN (${ph})`).get(...userIds);
  const practicals = db.prepare(`SELECT COUNT(*) c, SUM(passed) p FROM lms_practicals WHERE user_id IN (${ph})`).get(...userIds);
  const certs = db.prepare(`SELECT COUNT(*) c FROM lms_certificates WHERE status = 'active' AND user_id IN (${ph})`).get(...userIds).c;
  const learnersWithCert = db.prepare(`SELECT COUNT(DISTINCT user_id) c FROM lms_certificates WHERE status = 'active' AND user_id IN (${ph})`).get(...userIds).c;
  const badges = db.prepare(`SELECT COUNT(*) c FROM lms_badges WHERE user_id IN (${ph})`).get(...userIds).c;
  return {
    learners: userIds.length,
    assigned: total,
    completed,
    completion: total ? Math.round((completed / total) * 100) : 0,
    overdue,
    passRate: attempts.c ? Math.round(((attempts.p || 0) / attempts.c) * 100) : 0,
    practicalPassRate: practicals.c ? Math.round(((practicals.p || 0) / practicals.c) * 100) : 0,
    certificates: certs,
    certificateCoverage: userIds.length ? Math.round((learnersWithCert / userIds.length) * 100) : 0,
    badges,
    points: completed * POINTS.module + (attempts.p || 0) * POINTS.theory + (practicals.p || 0) * POINTS.practical + badges * POINTS.badge,
  };
}

/** Matriks kompetensi: skor 0–4 per level + status sertifikat. */
function matrix(db, userIds) {
  if (!userIds.length) return [];
  const ph = userIds.map(() => '?').join(',');
  const users = db.prepare(`SELECT u.id, u.name, u.role, u.job_title, c.name company
    FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id IN (${ph}) ORDER BY u.name`).all(...userIds);
  const levels = LEVELS;
  const cells = db.prepare(`SELECT e.user_id, c.level, c.track, e.status, e.theory_score, e.practical_score
    FROM lms_enrollments e JOIN lms_courses c ON c.id = e.course_id WHERE e.user_id IN (${ph})`).all(...userIds);
  return users.map((user) => {
    const row = { user, levels: {} };
    for (const level of levels) {
      const list = cells.filter((c) => c.user_id === user.id && c.level === level);
      const total = list.length;
      const done = list.filter((c) => c.status === 'completed').length;
      const practicals = list.map((c) => c.practical_score || 0).filter((v) => v > 0);
      const avg = practicals.length ? practicals.reduce((a, v) => a + v, 0) / practicals.length : 0;
      const score = total === 0 ? null : done === total ? 4 : done > 0 ? Math.max(1, Math.round(avg / 100 * 3)) : 0;
      row.levels[level] = { total, done, score, complete: total > 0 && done === total };
    }
    row.certs = db.prepare("SELECT level FROM lms_certificates WHERE user_id = ? AND status = 'active'").all(user.id).map((r) => r.level);
    row.points = db.prepare('SELECT theory_score, practical_score FROM lms_enrollments WHERE user_id = ?').all(user.id)
      .reduce((a, e) => a + (e.theory_score || 0) + (e.practical_score || 0), 0);
    return row;
  });
}

// ---------------------------------------------------------------- pustaka dokumen

const DOC_KINDS = {
  sop: { label: 'SOP', hint: 'Prosedur langkah demi langkah untuk satu proses kerja.' },
  job_aid: { label: 'Job aid', hint: 'Kartu bantu cepat: checklist, tabel dosis, atau panduan di titik kerja.' },
  recipe: { label: 'Recipe master', hint: 'Resep baku: komponen, urutan, tampilan, kesalahan umum.' },
};
const DOC_STATUS = ['draft', 'review', 'published', 'archived'];
const ATTACHMENT_KINDS = { video: 'Video', pdf: 'Dokumen PDF' };
const MAX_DOC_BODY = 20000;

function docRow(db, id) {
  return db.prepare('SELECT * FROM lms_docs WHERE id = ?').get(Number(id) || 0) || null;
}

function docByCode(db, code) {
  return db.prepare('SELECT * FROM lms_docs WHERE code = ?').get(String(code || '').toUpperCase()) || null;
}

/** Jumlah lampiran per dokumen (video/PDF) untuk daftar pustaka — tanpa query per baris. */
function attachmentCounts(db) {
  const rows = db.prepare('SELECT doc_id, kind, COUNT(*) c FROM lms_doc_attachments GROUP BY doc_id, kind').all();
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.doc_id) || { total: 0, video: 0, pdf: 0 };
    cur.total += r.c;
    if (r.kind === 'video') cur.video += r.c;
    if (r.kind === 'pdf') cur.pdf += r.c;
    map.set(r.doc_id, cur);
  }
  return map;
}

function attachmentsOf(db, docId) {
  const rows = db.prepare('SELECT * FROM lms_doc_attachments WHERE doc_id = ? ORDER BY sort_order, id').all(Number(docId) || 0);
  return rows.map((r) => ({ ...r, kind: ATTACHMENT_KINDS[r.kind] ? r.kind : 'pdf' }));
}

function libraryDocs(db, filter = {}) {
  const rows = db.prepare('SELECT * FROM lms_docs ORDER BY sort_order, kind DESC, code').all();
  const counts = attachmentCounts(db);
  return rows.filter((d) => {
    if (filter.kind && d.kind !== filter.kind) return false;
    if (filter.status && d.status !== filter.status) return false;
    if (filter.q) {
      const hay = `${d.code} ${d.title} ${d.summary || ''}`.toLowerCase();
      if (!hay.includes(String(filter.q).toLowerCase())) return false;
    }
    return true;
  }).map((d) => ({ ...d, attachments: counts.get(d.id) || { total: 0, video: 0, pdf: 0 } }));
}

function setDocStatus(db, id, status) {
  if (!DOC_STATUS.includes(status)) return false;
  db.prepare('UPDATE lms_docs SET status = ?, updated_at = ? WHERE id = ?').run(status, U.nowISO(), Number(id));
  return true;
}

/**
 * Simpan dokumen pustaka (SOP / job aid / recipe) — untuk membuat dokumen baru maupun
 * mengubah dokumen hasil seed kurikulum. Dokumen seed tidak pernah ditimpa lagi oleh seed
 * (`ON CONFLICT(code) DO NOTHING`), jadi penyesuaian pengguna aman.
 */
function normaliseDocCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function saveDoc(db, opts = {}) {
  const id = Number(opts.id) || 0;
  const existing = id ? docRow(db, id) : null;
  if (id && !existing) return { ok: false, error: 'Dokumen tidak ditemukan.' };

  const code = normaliseDocCode(opts.code || (existing && existing.code));
  if (!code) return { ok: false, error: 'Kode dokumen wajib diisi (huruf, angka, tanda hubung).' };
  const title = String(opts.title || '').trim().slice(0, 160);
  if (!title) return { ok: false, error: 'Judul dokumen wajib diisi.' };
  const kind = DOC_KINDS[opts.kind] ? opts.kind : (existing ? existing.kind : 'sop');
  const status = DOC_STATUS.includes(opts.status) ? opts.status : (existing ? existing.status : 'draft');
  const body = String(opts.body || '').slice(0, MAX_DOC_BODY);
  const summary = String(opts.summary || '').trim().slice(0, 400);
  const owner = String(opts.owner || '').trim().slice(0, 120) || null;
  const version = String(opts.version || '').trim().slice(0, 20) || (existing ? existing.version : '1.0');
  const effective = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.effective_date || ''))
    ? String(opts.effective_date)
    : (existing ? existing.effective_date : U.todayISO());
  const courseCode = String(opts.course_code || '').trim().toUpperCase();
  if (courseCode && !courseRow(db, courseCode)) {
    return { ok: false, error: `Modul ${courseCode} tidak ada di kurikulum.` };
  }
  const clash = db.prepare('SELECT id FROM lms_docs WHERE code = ? AND id != ?').get(code, id);
  if (clash) return { ok: false, error: `Kode ${code} sudah dipakai dokumen lain.` };

  if (id) {
    db.prepare(`UPDATE lms_docs SET code = ?, title = ?, kind = ?, status = ?, owner = ?, effective_date = ?,
        summary = ?, body = ?, course_code = ?, version = ?, updated_at = ? WHERE id = ?`)
      .run(code, title, kind, status, owner, effective, summary, body, courseCode || null, version, U.nowISO(), id);
    return { ok: true, doc: docRow(db, id), created: false };
  }

  const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 n FROM lms_docs').get().n;
  const info = db.prepare(`INSERT INTO lms_docs (kind, code, title, version, status, owner, effective_date,
      summary, body, course_code, created_at, source, updated_at, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, 'custom', ?, ?)`)
    .run(kind, code, title, version, status, owner, effective, summary, body, courseCode || null,
      U.nowISO(), U.nowISO(), order);
  return { ok: true, doc: docRow(db, info.lastInsertRowid), created: true };
}

/** Hanya dokumen buatan pengguna yang bisa dihapus; dokumen seed diarsipkan (seed akan membuatnya lagi). */
function deleteDoc(db, id) {
  const doc = docRow(db, id);
  if (!doc) return { ok: false, error: 'Dokumen tidak ditemukan.' };
  if (doc.source !== 'custom') {
    return {
      ok: false,
      error: `${doc.code} berasal dari kurikulum, jadi tidak bisa dihapus — ubah statusnya menjadi arsip bila sudah tidak dipakai.`,
    };
  }
  db.prepare('DELETE FROM lms_doc_attachments WHERE doc_id = ?').run(doc.id);
  db.prepare('DELETE FROM lms_docs WHERE id = ?').run(doc.id);
  return { ok: true, title: doc.title, code: doc.code };
}

function prepareAttachment(opts = {}) {
  const kind = String(opts.kind || '').trim();
  if (!ATTACHMENT_KINDS[kind]) return { ok: false, error: 'Jenis lampiran harus video atau dokumen PDF.' };
  const url = String(opts.url || '').trim().slice(0, 800);
  const prepared = video.prepare(kind, url);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const title = String(opts.title || '').trim().slice(0, 160)
    || (kind === 'video' ? 'Video prosedur' : 'Dokumen PDF');
  return {
    ok: true,
    kind,
    title,
    url,
    provider: prepared.provider,
    duration: Math.max(0, Math.min(600, Number(opts.duration_min) || 0)),
  };
}

/** Tambah lampiran video/PDF ke dokumen (hanya URL yang disimpan, tidak ada file di server). */
function addDocAttachment(db, docId, opts = {}) {
  const doc = docRow(db, docId);
  if (!doc) return { ok: false, error: 'Dokumen tidak ditemukan.' };
  const out = prepareAttachment(opts);
  if (!out.ok) return out;
  const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 n FROM lms_doc_attachments WHERE doc_id = ?').get(doc.id).n;
  db.prepare(`INSERT INTO lms_doc_attachments (doc_id, sort_order, kind, title, url, provider, duration_min, created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(doc.id, order, out.kind, out.title, out.url, out.provider, out.duration, U.nowISO());
  db.prepare('UPDATE lms_docs SET updated_at = ? WHERE id = ?').run(U.nowISO(), doc.id);
  return { ok: true, doc };
}

function attachmentRow(db, id) {
  return db.prepare('SELECT * FROM lms_doc_attachments WHERE id = ?').get(Number(id) || 0) || null;
}

function updateDocAttachment(db, id, opts = {}) {
  const row = attachmentRow(db, id);
  if (!row) return { ok: false, error: 'Lampiran tidak ditemukan.', doc_id: Number(opts.doc_id) || null };
  const out = prepareAttachment({ ...opts, kind: opts.kind || row.kind, url: opts.url || row.url });
  if (!out.ok) return { ...out, doc_id: row.doc_id };
  db.prepare('UPDATE lms_doc_attachments SET kind = ?, title = ?, url = ?, provider = ?, duration_min = ? WHERE id = ?')
    .run(out.kind, out.title, out.url, out.provider, out.duration, row.id);
  db.prepare('UPDATE lms_docs SET updated_at = ? WHERE id = ?').run(U.nowISO(), row.doc_id);
  return { ok: true, attachment: attachmentRow(db, row.id), doc_id: row.doc_id };
}

function deleteDocAttachment(db, id) {
  const row = attachmentRow(db, id);
  if (!row) return { ok: false, error: 'Lampiran tidak ditemukan.' };
  db.prepare('DELETE FROM lms_doc_attachments WHERE id = ?').run(row.id);
  db.prepare('UPDATE lms_docs SET updated_at = ? WHERE id = ?').run(U.nowISO(), row.doc_id);
  return { ok: true, doc_id: row.doc_id, title: row.title };
}

/** Urutan lampiran bisa diatur (naik/turun), sama seperti materi modul. */
function moveDocAttachment(db, id, direction) {
  const row = attachmentRow(db, id);
  if (!row) return { ok: false, error: 'Lampiran tidak ditemukan.' };
  const fail = (error) => ({ ok: false, error, doc_id: row.doc_id });
  const list = db.prepare('SELECT id, sort_order FROM lms_doc_attachments WHERE doc_id = ? ORDER BY sort_order, id').all(row.doc_id);
  const index = list.findIndex((r) => r.id === row.id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) {
    return fail(`Lampiran sudah di urutan paling ${direction === 'up' ? 'atas' : 'bawah'}.`);
  }
  db.transaction(() => {
    db.prepare('UPDATE lms_doc_attachments SET sort_order = ? WHERE id = ?').run(list[target].sort_order, list[index].id);
    db.prepare('UPDATE lms_doc_attachments SET sort_order = ? WHERE id = ?').run(list[index].sort_order, list[target].id);
  })();
  return { ok: true, doc_id: row.doc_id };
}


function setCourseStatus(db, id, status) {
  if (!['draft', 'review', 'published', 'archived'].includes(status)) return false;
  db.prepare('UPDATE lms_courses SET status = ? WHERE id = ?').run(status, Number(id));
  return true;
}

function updateCourseMeta(db, id, patch) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!['pass_theory', 'pass_practical', 'version', 'owner', 'review_date', 'gate', 'status'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (!fields.length) return false;
  db.prepare(`UPDATE lms_courses SET ${fields.join(', ')} WHERE id = ?`).run(...values, Number(id));
  return true;
}

module.exports = {
  COURSES, PATHS, BADGES, TRACK_LABEL, TRACK_TONE, LEVEL_LABEL, LEVELS,
  seedLms, autoEnroll, courseRow, hydrate, listCourses, pathRows, enrollPath, assignCourse,
  enrollment, enrollmentsOf, ensureEnrollment, sectionsDone, completeSection, questionsOf, attemptsOf,
  gradeQuiz, rubricOf: (row) => safeJson(row && row.rubric, []), practicalsOf, scorePractical, recordPractical,
  levelComplete, maybeIssueCertificates, awardBadges, badgesOf, certificatesOf,
  learnerDashboard, scopeUserIds, kpis, matrix, libraryDocs, setDocStatus, setCourseStatus, updateCourseMeta,
  DOC_KINDS, DOC_STATUS, ATTACHMENT_KINDS, docRow, docByCode, attachmentsOf, attachmentCounts,
  saveDoc, deleteDoc, addDocAttachment, updateDocAttachment, deleteDocAttachment, moveDocAttachment, attachmentRow,
  materialsOf, materialById, courseById, addMaterial, updateMaterial, deleteMaterial, moveMaterial, courseWithMaterials, seedMaterials,
  safeJson, POINTS,
};
