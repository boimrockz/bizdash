'use strict';

const { getDb } = require('./db');
const auth = require('./auth');
const attendance = require('./attendance');
const U = require('./util');

function loadCompanies(db) {
  return db.prepare(`SELECT id, name, code, parent_id, level, kind, address, phone, sort_order,
    origin_area, origin_city, origin_zip, origin_phone FROM companies ORDER BY id`).all();
}

function parseMonth(value) {
  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return U.currentMonthKey();
}

function makeCtx(req) {
  const db = getDb();
  const base = req.headers['x-public-base-path'] || '';
  const user = req.user || null;
  const companies = loadCompanies(db);
  const byId = new Map(companies.map((c) => [c.id, c]));

  let allowedCompanies = [];
  if (user) {
    if (user.role === 'owner') allowedCompanies = companies;
    else {
      const ids = new Set(auth.descendants(companies, user.company_id));
      allowedCompanies = companies.filter((c) => ids.has(c.id));
    }
  }
  const allowedIds = new Set(allowedCompanies.map((c) => c.id));

  let selectedCompanyId = Number(req.query.company) || null;
  if (selectedCompanyId && !allowedIds.has(selectedCompanyId)) selectedCompanyId = null;

  const month = parseMonth(req.query.month);
  const ids = user ? auth.scopeIds(companies, user, selectedCompanyId) : [];
  const scopeCompany = selectedCompanyId
    ? byId.get(selectedCompanyId)
    : (user && user.role !== 'owner' ? byId.get(user.company_id) : null);

  const flash = req.query.msg ? { msg: String(req.query.msg), tone: String(req.query.tone || 'success') } : null;

  const ctx = {
    db,
    base,
    user,
    companies,
    byId,
    allowedCompanies,
    allowedIds,
    selectedCompanyId,
    scopeCompany,
    scopeIds: ids,
    month,
    flash,
    csrf: user ? auth.csrfFor(req.sessionToken) : '',
    // Token sesi saat ini — dipakai agar aksi "keluar dari semua sesi"/ganti password tidak
    // mengeluarkan pengguna yang sedang melakukan aksi itu sendiri.
    sessionToken: req.sessionToken || '',
    path: req.originalUrl.split('?')[0],
  };

  if (user) {
    const state = attendance.todayState(db, user);
    ctx.todayAttendance = state.attendance;
    ctx.todaySchedule = state.schedule;
  }

  ctx.csrfField = `<input type="hidden" name="_csrf" value="${ctx.csrf}">`;
  ctx.backField = `<input type="hidden" name="_back" value="${U.h(req.originalUrl)}">`;
  // Path boleh sudah membawa query sendiri (mis. '/members?customer=3'); query digabung,
  // bukan ditempel lagi, supaya tidak jadi '?customer=3?msg=...' (flash hilang & param rusak).
  const splitPath = (path) => {
    const raw = String(path || '/');
    const i = raw.indexOf('?');
    return i === -1 ? [raw, new URLSearchParams()] : [raw.slice(0, i), new URLSearchParams(raw.slice(i + 1))];
  };
  ctx.link = (path, extra = {}) => {
    const [pathname, q] = splitPath(path);
    if (selectedCompanyId) q.set('company', String(selectedCompanyId));
    if (month !== U.currentMonthKey()) q.set('month', month);
    for (const [k, v] of Object.entries(extra)) {
      if (v === null || v === undefined || v === '') q.delete(k);
      else q.set(k, String(v));
    }
    const qs = q.toString();
    return ctx.base + pathname + (qs ? '?' + qs : '');
  };
  ctx.flashUrl = (path, msg, tone = 'success', extra = {}) => {
    const [pathname, q] = splitPath(path);
    if (selectedCompanyId) q.set('company', String(selectedCompanyId));
    if (month !== U.currentMonthKey()) q.set('month', month);
    q.set('msg', msg);
    q.set('tone', tone);
    for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined) q.set(k, String(v));
    return ctx.base + pathname + '?' + q.toString();
  };
  ctx.companyName = (id) => {
    const c = byId.get(id);
    return c ? c.name : '—';
  };
  return ctx;
}

function redirectBack(ctx, res, fallback, msg, tone = 'success') {
  const back = typeof fallback === 'string' ? fallback : '/';
  const target = msg ? ctx.flashUrl(back, msg, tone) : ctx.base + back;
  res.redirect(target);
}

module.exports = { makeCtx, loadCompanies, redirectBack, parseMonth };
