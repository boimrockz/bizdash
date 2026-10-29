'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');

const { getDb, DB_PATH } = require('./lib/db');
const U = require('./lib/util');
const auth = require('./lib/auth');
const Q = require('./lib/queries');
const { makeCtx } = require('./lib/ctx');
const { buildAlerts } = require('./lib/insights');
const { createSale, voidSale } = require('./lib/sales');
const engine = require('./lib/pos-engine');
const inventory = require('./lib/inventory');
const attendance = require('./lib/attendance');
const settings = require('./lib/settings');
const wa = require('./lib/whatsapp');
const shipping = require('./lib/shipping');
const crypto = require('crypto');
const subs = require('./lib/subscriptions');
const ranking = require('./lib/ranking');
const forecast = require('./lib/forecast');
const reports = require('./lib/reports');
const mailer = require('./lib/mailer');
const importer = require('./lib/importer');
const exporter = require('./lib/exporter');
const media = require('./lib/media');
const statements = require('./lib/statements');
const qris = require('./lib/qris');
const ticketLib = require('./lib/ticket');
const lms = require('./lib/lms');
const posOptions = require('./lib/pos-options');
const T = require('./lib/timeline');
const QRCode = require('qrcode');
const { hashPassword, verifyPassword, randomToken } = require('./lib/password');
const team = require('./lib/team');

const L = require('./views/layout');
const { dashboard } = require('./views/dashboard');
const { posPage, salesPage, productsPage } = require('./views/pos');
const { membersPage } = require('./views/members');
const { promosPage } = require('./views/promos');
const { farmPage } = require('./views/farm');
const { attendancePage, schedulePage, shiftColor } = require('./views/attendance');
const { whatsappPage } = require('./views/whatsapp');
const { shippingPage } = require('./views/shipping');
const { designPage } = require('./views/design');
const { integrationsPage } = require('./views/integrations');
const { subscriptionsPage } = require('./views/subscriptions');
const { leaderboardPage } = require('./views/leaderboard');
const { mobilePage } = require('./views/mobile');
const { reportsPage } = require('./views/reports');
const { onboardingPage, availableSteps } = require('./views/onboarding');
const { catalogPage } = require('./views/catalog');
const { profilePage } = require('./views/profile');
const { structurePage } = require('./views/structure');
const { financePage } = require('./views/finance');
const { bscPage, kpiPage, okrPage, raciPage } = require('./views/performance');
const { importPage } = require('./views/import');
const { exportPage } = require('./views/export');
const { adminPage } = require('./views/admin');
const { loginPage, forgotPage, resetPage } = require('./views/login');
const { receiptPage } = require('./views/receipt');
const { settingsPosPage } = require('./views/settings-pos');
const { posMasterPage } = require('./views/pos-master');
const { timelinePage } = require('./views/timeline');
const { teamPage, teamMemberPage } = require('./views/team');
const A = require('./views/academy');

const db = getDb();
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', true);
app.disable('x-powered-by');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function setSessionCookie(res, token, maxAgeSec) {
  res.append('Set-Cookie', `bizdash_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`);
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', 'bizdash_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

// ---------- static assets ----------
app.use('/assets', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------- PWA: manifest, service worker, halaman offline ----------
// Semua URL dihitung dari header base path platform supaya tetap benar di
// subdomain default (/<slug>/) maupun saat custom domain dipasang.
const PWA_NAME = 'Ondeway Coffee Company';
const PWA_SHORT = 'Ondeway';
const PWA_THEME = '#c1352d';
const PWA_BG = '#fdf7ee';

app.get('/manifest.webmanifest', (req, res) => {
  const base = req.headers['x-public-base-path'] || '';
  const icon = (file, size, purpose) => ({
    src: `${base}/assets/${file}`, sizes: `${size}x${size}`, type: 'image/png',
    ...(purpose ? { purpose } : {}),
  });
  res.type('application/manifest+json').set('Cache-Control', 'public, max-age=3600').send(JSON.stringify({
    id: `${base}/`,
    name: PWA_NAME,
    short_name: PWA_SHORT,
    description: 'POS, stok bahan baku, keuangan, absensi, dan performa bisnis kopi dalam satu aplikasi.',
    lang: 'id',
    dir: 'ltr',
    start_url: `${base}/?source=pwa`,
    scope: `${base}/`,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: PWA_BG,
    theme_color: PWA_THEME,
    categories: ['business', 'productivity', 'finance'],
    icons: [
      icon('icon-192.png', 192),
      icon('icon-512.png', 512),
      icon('icon-maskable-512.png', 512, 'maskable'),
    ],
    shortcuts: [
      { name: 'Kasir (POS)', short_name: 'Kasir', url: `${base}/pos`, icons: [icon('icon-192.png', 192)] },
      { name: 'Keuangan', short_name: 'Keuangan', url: `${base}/finance`, icons: [icon('icon-192.png', 192)] },
      { name: 'Absensi', short_name: 'Absensi', url: `${base}/attendance`, icons: [icon('icon-192.png', 192)] },
    ],
  }));
});

app.get('/sw.js', (req, res) => {
  const base = req.headers['x-public-base-path'] || '';
  const shellAssets = [
    `${base}/assets/app.css`,
    `${base}/assets/app.js`,
    `${base}/assets/favicon.svg`,
    `${base}/assets/icon-192.png`,
    `${base}/assets/icon-512.png`,
    `${base}/assets/logo-ondeway.svg`,
    `${base}/offline`,
  ];
  res.type('application/javascript').set('Cache-Control', 'no-cache').send(`/* Ondeway service worker */
const BASE = ${JSON.stringify(base)};
const VERSION = 'ondeway-v2';
const SHELL = ${JSON.stringify(shellAssets)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi: selalu coba jaringan dulu (data harus segar), offline → halaman offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match(BASE + '/offline').then((hit) => hit || new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><p style="font-family:system-ui;padding:24px">Tidak ada koneksi. Coba lagi setelah jaringan kembali.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )))
    );
    return;
  }

  // Aset statis: stale-while-revalidate supaya aplikasi tetap ringan & bisa dibuka offline.
  if (url.pathname.startsWith(BASE + '/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok) caches.open(VERSION).then((cache) => cache.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || network;
      })
    );
  }
});
`);
});

app.get('/offline', (req, res) => {
  const base = req.headers['x-public-base-path'] || '';
  res.type('html').set('Cache-Control', 'public, max-age=600').send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Tidak ada koneksi · ${PWA_NAME}</title>
<meta name="theme-color" content="${PWA_THEME}">
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
    font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: radial-gradient(700px 420px at 20% 0%, #fbe1da, transparent 70%), #fdf7ee; color:#2a1a15; }
  .box { max-width: 380px; text-align: center; background: rgba(255,255,255,.78); border:1px solid rgba(255,255,255,.7);
    border-radius: 22px; padding: 28px 24px; box-shadow: 0 20px 50px rgba(42,26,21,.14); backdrop-filter: blur(18px); }
  img { width: 96px; height: 96px; display: block; margin: 0 auto 14px; }
  h1 { font-size: 19px; margin: 0 0 8px; letter-spacing: -.02em; }
  p { font-size: 13px; line-height: 1.6; color:#6b5548; margin: 0 0 18px; }
  a { display:inline-block; background: linear-gradient(135deg,#c1352d,#d9822b); color:#fff; text-decoration:none;
    font-weight: 600; font-size: 13.5px; padding: 11px 20px; border-radius: 12px; }
</style></head>
<body><div class="box">
  <img src="${base}/assets/icon-192.png" alt="" width="96" height="96">
  <h1>Sedang offline</h1>
  <p>Aplikasi tidak bisa memuat data terbaru karena tidak ada koneksi internet. Data yang sudah tampil sebelumnya tetap aman di server.</p>
  <a href="${base}/">Coba lagi</a>
</div></body></html>`);
});

// ---------- session ----------
app.use((req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  const token = req.cookies.bizdash_sid;
  if (token) {
    const row = db.prepare(`SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.company_id, u.active,
        u.photo_url, u.job_title, u.onboarded
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
    if (row && row.active && row.expires_at > U.nowISO()) {
      req.user = row;
      req.sessionToken = token;
    } else if (row) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      clearSessionCookie(res);
    }
  }
  next();
});

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  if (['/login', '/forgot', '/reset', '/healthz'].includes(req.path)) return next();
  if (req.path.startsWith('/webhooks/')) return next(); // webhook pihak ketiga
  if (req.is('multipart/form-data')) return next(); // divalidasi setelah multer
  if (!req.user) return res.redirect((req.headers['x-public-base-path'] || '') + '/login');
  if (!auth.verifyCsrf(req.sessionToken, req.body._csrf)) {
    return res.status(403).send('Sesi form kedaluwarsa. Muat ulang halaman lalu coba lagi.');
  }
  next();
});

// catat kunjungan modul untuk progres onboarding
app.use((req, res, next) => {
  if (req.method === 'GET' && req.user) {
    const map = {
      '/': 'dashboard', '/pos': 'pos', '/finance': 'finance', '/leaderboard': 'leaderboard',
      '/subscriptions': 'subscriptions', '/reports': 'reports', '/whatsapp': 'whatsapp',
      '/shipping': 'shipping', '/attendance': 'attendance', '/catalog': 'catalog',
      '/settings/integrations': 'integrations', '/mobile': 'mobile',
    };
    const key = map[req.path];
    if (key) {
      try {
        const exists = db.prepare('SELECT id FROM audit_log WHERE action = ? AND user_id = ? AND detail = ? LIMIT 1')
          .get('onboarding.visit', req.user.id, key);
        if (!exists) {
          db.prepare('INSERT INTO audit_log (user_id, company_id, action, detail, created_at) VALUES (?,?,?,?,?)')
            .run(req.user.id, req.user.company_id, 'onboarding.visit', key, U.nowISO());
        }
      } catch (err) { /* pencatatan progres tidak boleh mengganggu request */ }
    }
  }
  next();
});

function requireCsrf(req, res, next) {
  if (!req.user) return res.redirect((req.headers['x-public-base-path'] || '') + '/login');
  if (!auth.verifyCsrf(req.sessionToken, req.body && req.body._csrf)) {
    return res.status(403).send('Sesi form kedaluwarsa. Muat ulang halaman lalu coba lagi.');
  }
  next();
}

function route(fn) {
  return (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') out.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function forbidden(ctx, res) {
  const html = L.shell(ctx, {
    title: 'Akses dibatasi',
    subtitle: 'Role Anda tidak memiliki izin untuk halaman ini',
    active: ctx.path,
    content: L.card({ title: 'Akses ditolak' }, `
      <p style="font-size:13px;color:var(--ink-soft)">Halaman ini memerlukan hak akses yang belum dimiliki role <strong>${U.h(auth.ROLE_LABELS[ctx.user.role] || ctx.user.role)}</strong>. Hubungi owner untuk penyesuaian role.</p>
      <div class="form-actions"><a class="btn btn-primary btn-sm" href="${ctx.base}/">Kembali ke dashboard</a></div>`),
  });
  res.status(403).send(html);
}

function guard(cap) {
  return (req, res, next) => {
    if (!req.user) return res.redirect((req.headers['x-public-base-path'] || '') + '/login');
    const ctx = makeCtx(req);
    if (!auth.can(ctx.user, cap)) return forbidden(ctx, res);
    req.ctx = ctx;
    next();
  };
}

// izinkan jika user punya salah satu kapabilitas (mis. lihat tim ATAU absen sendiri)
function guardAny(caps) {
  return (req, res, next) => {
    if (!req.user) return res.redirect((req.headers['x-public-base-path'] || '') + '/login');
    const ctx = makeCtx(req);
    if (!caps.some((c) => auth.can(ctx.user, c))) return forbidden(ctx, res);
    req.ctx = ctx;
    next();
  };
}

function backPath(req) {
  const raw = String(req.body._back || '').trim();
  const base = req.headers['x-public-base-path'] || '';
  if (!raw || !raw.startsWith('/')) return '/';
  // buang prefix publik agar tidak dobel saat redirect
  if (base && raw.startsWith(base + '/')) return raw.slice(base.length);
  return raw;
}

function logAction(ctx, action, detail) {
  try {
    ctx.db.prepare('INSERT INTO audit_log (user_id, company_id, action, detail, created_at) VALUES (?,?,?,?,?)')
      .run(ctx.user ? ctx.user.id : null, ctx.user ? ctx.user.company_id : null, action, String(detail).slice(0, 400), U.nowISO());
  } catch (err) { /* pencatatan log tidak boleh menggagalkan aksi */ }
}

function backWith(ctx, res, msg, tone = 'success', path = null) {
  const target = path || ctx.path;
  res.redirect(ctx.flashUrl(target, msg, tone));
}

// ---------- auth ----------
app.get('/login', route((req, res) => {
  const ctx = makeCtx(req);
  if (req.user) {
    const home = auth.can(req.user, 'dashboard') ? '/' : '/pos';
    return res.redirect(ctx.base + home);
  }
  res.send(loginPage(ctx, {
    error: req.query.err ? String(req.query.err) : '',
    notice: req.query.msg ? String(req.query.msg) : '',
    email: req.query.email ? String(req.query.email) : '',
  }));
}));

app.post('/login', route((req, res) => {
  const base = req.headers['x-public-base-path'] || '';
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).send(loginPage(makeCtx(req), { error: 'Email atau password salah.', email }));
  }
  const token = randomToken(32);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(token, user.id, U.nowISO(), expires);
  setSessionCookie(res, token, 60 * 60 * 24 * 7);
  const home = user.role === 'cashier' ? '/pos' : '/';
  // admin baru langsung diarahkan ke panduan fitur sekali saja
  const needsOnboarding = !user.onboarded && ['owner', 'director', 'manager', 'finance'].includes(user.role);
  res.redirect(base + (needsOnboarding ? '/onboarding?first=1' : home));
}));

app.post('/logout', route((req, res) => {
  const base = req.headers['x-public-base-path'] || '';
  if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  clearSessionCookie(res);
  res.redirect(base + '/login');
}));

// ---------- lupa password / reset password ----------
// Alur: /forgot (buat token sekali pakai 60 menit) → dikirim via email/WhatsApp bila
// integrasi aktif, kalau belum aktif owner bisa membuat tautan dari /admin.
const RESET_TTL_MIN = 60;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sqlTime(msFromNow = 0) {
  return new Date(Date.now() + msFromNow).toISOString().slice(0, 19).replace('T', ' ');
}

function publicBaseUrl(req) {
  const base = req.headers['x-public-base-path'] || '';
  return `${req.protocol}://${req.get('host')}${base}`;
}

function findResetRow(token) {
  const raw = String(token || '').trim();
  if (!/^[a-f0-9]{32,128}$/i.test(raw)) return null;
  return db.prepare(`SELECT r.*, u.email, u.name, u.phone, u.active FROM password_resets r
    JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > ? LIMIT 1`).get(sha256Hex(raw), sqlTime());
}

function issueResetToken(userId, meta = {}) {
  const token = randomToken(32);
  db.prepare(`INSERT INTO password_resets (user_id, token_hash, created_at, expires_at, request_ip, delivered)
    VALUES (?,?,?,?,?,?)`).run(userId, sha256Hex(token), sqlTime(), sqlTime(RESET_TTL_MIN * 60000),
    String(meta.ip || '').slice(0, 60), String(meta.delivered || 'none'));
  return token;
}

function resetMessage(user, link) {
  return `Halo ${user.name}, kami menerima permintaan reset password untuk akun ${user.email}. `
    + `Buka tautan berikut untuk membuat password baru (berlaku ${RESET_TTL_MIN} menit, sekali pakai): ${link} `
    + 'Jika Anda tidak meminta reset, abaikan pesan ini.';
}

async function deliverResetLink(user, link) {
  const text = resetMessage(user, link);
  const html = `<p>Halo ${U.h(user.name)},</p>
    <p>Kami menerima permintaan <b>reset password</b> untuk akun <b>${U.h(user.email)}</b>.</p>
    <p><a href="${U.h(link)}">Buat password baru</a> — berlaku ${RESET_TTL_MIN} menit dan hanya bisa dipakai sekali.</p>
    <p style="color:#7c6657;font-size:12px">Jika Anda tidak meminta reset, abaikan pesan ini.</p>`;
  if (mailer.mode(db).live) {
    try {
      const out = await mailer.send(db, { to: user.email, subject: 'Reset password Ondeway', html, text });
      if (out && out.ok && !out.simulated) return 'email';
    } catch (err) { /* lanjut ke WhatsApp */ }
  }
  if (wa.mode(db).live && user.phone) {
    try {
      const out = await wa.send(db, { to: user.phone, body: text, name: user.name });
      if (out && out.ok && !out.simulated) return 'whatsapp';
    } catch (err) { /* dibiarkan: owner masih bisa membuat tautan manual */ }
  }
  return 'none';
}

app.get('/forgot', route((req, res) => {
  const ctx = makeCtx(req);
  if (req.user) return res.redirect(ctx.base + '/');
  res.send(forgotPage(ctx));
}));

app.post('/forgot', route(async (req, res) => {
  const ctx = makeCtx(req);
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).send(forgotPage(ctx, { error: 'Email wajib diisi.', email }));
  const user = db.prepare('SELECT id, name, email, phone, active FROM users WHERE lower(email) = ?').get(email);
  if (user && user.active) {
    const recent = db.prepare('SELECT COUNT(*) c FROM password_resets WHERE user_id = ? AND created_at >= ?')
      .get(user.id, sqlTime(-60 * 60 * 1000)).c;
    if (recent < 5) {
      db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(sqlTime(), user.id);
      const token = issueResetToken(user.id, { ip: req.ip });
      const link = `${publicBaseUrl(req)}/reset?token=${token}`;
      const delivered = await deliverResetLink(user, link);
      db.prepare('UPDATE password_resets SET delivered = ? WHERE token_hash = ?').run(delivered, sha256Hex(token));
      logAction(ctx, 'auth.forgot', `${user.email} · ${delivered}`);
    } else {
      logAction(ctx, 'auth.forgot', `${user.email} · dibatasi (terlalu sering)`);
    }
  } else {
    logAction(ctx, 'auth.forgot', `${email} · email tidak terdaftar`);
  }
  // Respons netral: tidak membocorkan apakah email terdaftar atau tidak.
  res.send(forgotPage(ctx, { sent: true, email }));
}));

app.get('/reset', route((req, res) => {
  const ctx = makeCtx(req);
  if (req.user) return res.redirect(ctx.base + '/');
  const token = String(req.query.token || '').trim();
  const row = findResetRow(token);
  if (!row || !row.active) {
    return res.status(400).send(resetPage(ctx, {
      error: 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman lupa password.',
    }));
  }
  res.send(resetPage(ctx, { token, email: row.email }));
}));

app.post('/reset', route((req, res) => {
  const ctx = makeCtx(req);
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');
  const row = findResetRow(token);
  if (!row || !row.active) {
    return res.status(400).send(resetPage(ctx, {
      error: 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman lupa password.',
    }));
  }
  if (password.length < 6) return res.status(400).send(resetPage(ctx, { token, email: row.email, error: 'Password baru minimal 6 karakter.' }));
  if (password !== confirm) return res.status(400).send(resetPage(ctx, { token, email: row.email, error: 'Konfirmasi password tidak sama.' }));

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(sqlTime(), row.id);
  db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(sqlTime(), row.user_id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  logAction(ctx, 'auth.reset', row.email);
  const base = req.headers['x-public-base-path'] || '';
  res.redirect(`${base}/login?msg=${encodeURIComponent('Password berhasil diganti. Silakan masuk dengan password baru.')}`);
}));

// ---------- dashboard ----------
app.get('/', guard('dashboard'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const month = ctx.month;
  const prevMonth = U.addMonths(month, -1);

  const fin = { ...Q.financeFor(db, ids, month), month };
  const prev = Q.financeFor(db, ids, prevMonth);
  const target = Q.targetFor(db, ids, month);
  const kpis = Q.kpiRows(db, ids, month);
  const objectives = Q.objectivesFor(db, ids);
  const bsc = Q.bscSummary(kpis, objectives);
  const okrs = Q.okrRows(db, ids, U.quarterOf(month));
  const raci = Q.raciRows(db, ids);
  const perCompanyAll = Q.revenueByCompany(db, ids, month)
    .filter((r) => {
      const c = ctx.byId.get(r.company_id);
      return c && c.level !== 'holding';
    });

  const html = dashboard(ctx, {
    fin,
    prev,
    target,
    series: Q.seriesFor(db, ids, U.monthRange(month, 12)),
    expenseRows: Q.expenseBreakdown(db, ids, month),
    topProducts: Q.topMenus(db, ids, month, 8),
    perCompany: perCompanyAll,
    companyMap: ctx.byId,
    kpis,
    objectives,
    bsc,
    okrs,
    raci,
    recent: Q.recentSales(db, ids, 6),
    channel: Q.channelMix(db, ids, month),
    members: Q.memberStats(db, ids, month),
    promo: Q.promoImpact(db, ids, month),
    materials: inventory.summary(db, ids),
    attendanceToday: attendance.dailySeries(db, ids, month).slice(0, 1),
    labor: attendance.laborCost(db, ids, month),
    attendanceRecap: attendance.recap(db, ids, month),
    waStats: auth.can(ctx.user, 'wa_read') ? wa.stats(db, ids) : null,
    waThreads: auth.can(ctx.user, 'wa_read') ? wa.threads(db, ids).slice(0, 3) : [],
    shipStats: auth.can(ctx.user, 'shipping_read') ? shipping.stats(db, ids) : null,
    shipActive: auth.can(ctx.user, 'shipping_read')
      ? shipping.list(db, ids, { status: 'all', limit: 4 }).filter((sh) => ['pending', 'picked_up', 'in_transit', 'out_for_delivery'].includes(sh.status))
      : [],
    alerts: buildAlerts({
      fin, prev, target, bsc, kpis, okrs, raci, month,
      materials: inventory.summary(db, ids),
      promo: Q.promoImpact(db, ids, month),
      shippingActive: auth.can(ctx.user, 'shipping_read')
        ? shipping.list(db, ids, { status: 'all', limit: 30 }).filter((sh) => ['pending', 'picked_up', 'in_transit', 'out_for_delivery'].includes(sh.status))
        : [],
    }),
  });
  res.send(html);
}));

// ---------- POS ----------
function saleOutlets(ctx) {
  const outlets = ctx.allowedCompanies.filter((c) => c.level === 'outlet');
  if (outlets.length) return outlets;
  const units = ctx.allowedCompanies.filter((c) => c.level === 'unit');
  return units.length ? units : ctx.allowedCompanies;
}

function saleOutlet(ctx, requested) {
  const list = saleOutlets(ctx);
  const id = Number(requested) || (ctx.scopeCompany ? ctx.scopeCompany.id : (list[0] || {}).id);
  if (!ctx.allowedIds.has(id)) return list[0] || null;
  const target = ctx.byId.get(id);
  if (!target) return list[0] || null;
  if (target.level === 'holding' || target.level === 'unit') {
    const child = list.find((c) => c.parent_id === target.id);
    return child || target;
  }
  return target;
}

function productsForOutlet(ctx, outletId) {
  const companyIds = auth.ancestors(ctx.companies, outletId);
  const ph = companyIds.map(() => '?').join(',');
  return {
    companyIds,
    products: db.prepare(`SELECT * FROM products WHERE active = 1 AND company_id IN (${ph}) ORDER BY category, name`).all(...companyIds),
  };
}

function customersForScope(ctx) {
  // memakai seluruh cakupan user (bukan filter ?company=) supaya kasir di outlet
  // tetap bisa memilih member unit maupun pelanggan B2B roastery
  const ids = [...ctx.allowedIds];
  const ph = ids.map(() => '?').join(',') || 'NULL';
  return db.prepare(`SELECT id, name, type, price_tier, points, company_name, phone
    FROM customers WHERE active = 1 AND company_id IN (${ph}) ORDER BY type, name`).all(...ids);
}

/**
 * Ubah payload keranjang (dari POS) menjadi quote terverifikasi server.
 * Dipakai oleh /pos/quote, /pos/qris, dan /pos/checkout supaya harga tidak pernah
 * dipercaya dari klien dan ketiganya memakai aturan yang sama.
 */
function resolveCart(ctx, outlet, body) {
  let items = [];
  try { items = JSON.parse(body.items || '[]'); } catch (err) { items = []; }
  if (!Array.isArray(items) || !items.length) return { ok: false, error: 'Keranjang masih kosong.' };

  const allowed = new Set(auth.ancestors(ctx.companies, outlet.id));
  const safeItems = [];
  for (const item of items) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(Number(item.id));
    if (!p || !allowed.has(p.company_id)) {
      return { ok: false, error: 'Ada produk yang tidak tersedia untuk outlet ini.' };
    }
    safeItems.push({ id: p.id, qty: Math.max(1, Math.min(999, Number(item.qty) || 1)) });
  }

  const customerId = Number(body.customer_id) || null;
  let customer = null;
  if (customerId) {
    customer = db.prepare('SELECT * FROM customers WHERE id = ? AND active = 1').get(customerId);
    if (!customer || !ctx.allowedIds.has(customer.company_id)) {
      return { ok: false, error: 'Pelanggan tidak ditemukan dalam cakupan Anda.' };
    }
  }

  const q = engine.quote(db, {
    companyId: outlet.id,
    items: safeItems,
    customerId: customer ? customer.id : null,
    code: body.promo_code || '',
    points: body.points || 0,
    atDate: U.todayISO(),
  });
  if (!q.lines.length) return { ok: false, error: 'Tidak ada item valid di keranjang.' };
  return { ok: true, quote: q, customer };
}

/** Transaksi dalam cakupan user (untuk token/struk). */
function scopedSale(ctx, id) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(Number(id));
  if (!sale || !ctx.allowedIds.has(sale.company_id)) return null;
  return sale;
}

function qrisView(row, ctx) {
  if (!row) return null;
  const hasPayload = !!row.payload;
  return {
    reference: row.reference,
    amount: row.amount,
    status: row.status,
    statusLabel: qris.STATUS[row.status] || row.status,
    provider: row.provider,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    invoiceNo: row.invoice_no || '',
    payload: hasPayload ? row.payload : '',
    imageUrl: hasPayload ? `${ctx.base}/pos/qris/${encodeURIComponent(row.reference)}/qr.svg`
      : (row.qr_url || ''),
    manualConfirm: row.provider === 'static',
  };
}

app.get('/pos', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const outlet = saleOutlet(ctx, req.query.company || ctx.selectedCompanyId);
  if (!outlet) return forbidden(ctx, res);
  const { products } = productsForOutlet(ctx, outlet.id);
  const productHpp = new Map(products.map((p) => [p.id, engine.recipeCost(db, p).total]));
  const customers = customersForScope(ctx);
  const cityPromos = engine.activePromos(db, outlet.id, U.todayISO());
  // Kasir perlu tahu detail promo yang berlaku (syarat, masa berlaku, sisa kuota, cakupan).
  const promos = engine.describePromos(db, cityPromos, {
    outletId: outlet.id,
    products,
    atDate: U.todayISO(),
  });

  // member baru yang langsung dibuat dari POS
  const newCustomerId = Number(req.query.customer) || null;
  const selected = newCustomerId && customers.some((c) => c.id === newCustomerId) ? newCustomerId : null;

  // struk transaksi terakhir (setelah checkout) — dipakai kartu struk & cetak otomatis
  const lastId = Number(req.query.last) || 0;
  const lastSale = lastId ? scopedSale(ctx, lastId) : null;
  const paper = ticketLib.paperWidth(db);
  const lastTicket = lastSale ? ticketLib.build(db, lastSale.id, { reprint: false }) : null;
  const qrisMode = qris.mode(db);

  res.send(posPage(ctx, {
    products: products.map((p) => ({ ...p, cost: productHpp.get(p.id) || p.cost })),
    customers,
    saleCompanyId: outlet.id,
    outlets: saleOutlets(ctx),
    promos,
    today: U.todayISO(),
    productHpp,
    selectedCustomerId: selected,
    qrisMode: { live: qrisMode.live, enforced: qris.enforced(db), provider: qrisMode.provider, merchant: qrisMode.merchant, label: qrisMode.label },
    receipt: {
      width: paper.mm,
      auto: settings.get(db, 'receipt_auto_print', '0') === '1',
      printQris: settings.get(db, 'receipt_show_qris', '1') === '1',
      last: lastSale ? lastSale.id : null,
      lastTicket,
      lastLines: lastTicket ? ticketLib.textLines(lastTicket) : [],
    },
  }));
}));

// ---------- QRIS: buat sesi pembayaran untuk keranjang ----------
app.post('/pos/qris', guard('pos_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const outlet = saleOutlet(ctx, req.body.company_id);
  if (!outlet || outlet.level === 'holding') {
    return res.status(400).json({ ok: false, error: 'Outlet penjualan tidak valid.' });
  }
  const cart = resolveCart(ctx, outlet, req.body);
  if (!cart.ok) return res.status(400).json({ ok: false, error: cart.error });

  const out = await qris.create(db, {
    companyId: outlet.id,
    amount: cart.quote.total,
    userId: ctx.user.id,
    terminal: String(ctx.user.name || 'KASIR').slice(0, 20),
    note: String(req.body.note || '').slice(0, 200),
    cart: {
      items: cart.quote.lines.map((l) => ({ id: l.productId, name: l.name, qty: l.qty, price: l.price })),
      subtotal: cart.quote.subtotal,
      discount: cart.quote.promoDiscount + cart.quote.pointsValue,
      total: cart.quote.total,
      customerId: cart.customer ? cart.customer.id : null,
      promo: cart.quote.promo ? cart.quote.promo.label : '',
    },
  });
  if (!out.ok) return res.status(400).json({ ok: false, error: out.error });
  logAction(ctx, 'pos.qris.create', `${out.payment.reference} · ${U.idr(cart.quote.total)} · ${out.mode}`);
  res.json({ ok: true, qris: qrisView(out.payment, ctx), total: cart.quote.total, mode: out.mode });
}));

app.get('/pos/qris/:ref', guard('pos_read'), route(async (req, res) => {
  const ctx = req.ctx;
  const row = qris.find(db, req.params.ref);
  if (!row || !ctx.allowedIds.has(row.company_id)) return res.status(404).json({ ok: false, error: 'Referensi QRIS tidak ditemukan.' });
  const synced = await qris.sync(db, row);
  if (synced.status === 'paid' && row.status !== 'paid') {
    logAction(ctx, 'pos.qris.paid', `${synced.reference} · ${U.idr(synced.amount)} · ${synced.provider}`);
  }
  res.json({ ok: true, qris: qrisView(synced, ctx) });
}));

app.get('/pos/qris/:ref/qr.svg', guard('pos_read'), route(async (req, res) => {
  const ctx = req.ctx;
  const row = qris.find(db, req.params.ref);
  if (!row || !ctx.allowedIds.has(row.company_id) || !row.payload) return res.status(404).send('QR tidak tersedia.');
  const svg = await QRCode.toString(row.payload, {
    type: 'svg', margin: 1, width: 360, errorCorrectionLevel: 'M',
    color: { dark: '#2a1a15', light: '#ffffff' },
  });
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
}));

app.post('/pos/qris/:ref/paid', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const row = qris.find(db, req.params.ref);
  if (!row || !ctx.allowedIds.has(row.company_id)) {
    return res.status(404).json({ ok: false, error: 'Referensi QRIS tidak ditemukan.' });
  }
  if (row.sale_id) return res.status(400).json({ ok: false, error: 'QRIS ini sudah dipakai transaksi lain.' });
  if (row.status === 'paid') return res.json({ ok: true, qris: qrisView(row, ctx) });
  if (row.status !== 'pending') return res.status(400).json({ ok: false, error: `QRIS berstatus ${qris.STATUS[row.status] || row.status}.` });
  const updated = qris.markPaid(db, row, `kasir ${ctx.user.name}`);
  logAction(ctx, 'pos.qris.manual_paid', `${updated.reference} · ${U.idr(updated.amount)}`);
  res.json({ ok: true, qris: qrisView(updated, ctx) });
}));

app.post('/pos/qris/:ref/cancel', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const row = qris.find(db, req.params.ref);
  if (!row || !ctx.allowedIds.has(row.company_id)) return res.status(404).json({ ok: false, error: 'Referensi tidak ditemukan.' });
  if (row.status === 'paid' && !row.sale_id) return res.status(400).json({ ok: false, error: 'Pembayaran sudah lunas.' });
  const updated = qris.cancel(db, row, `kasir ${ctx.user.name}`);
  logAction(ctx, 'pos.qris.cancel', `${updated.reference}`);
  res.json({ ok: true, qris: qrisView(updated, ctx) });
}));

// Webhook gateway (publik, tanpa CSRF/login) — signature diverifikasi di lib/qris.
app.post('/webhooks/qris', route((req, res) => {
  const body = req.body || {};
  if (!qris.verifySignature(db, body, req.headers)) {
    return res.status(401).json({ ok: false, error: 'Signature tidak valid.' });
  }
  const out = qris.applyNotification(db, body);
  if (!out.ok) return res.status(404).json(out);
  try {
    db.prepare('INSERT INTO audit_log (user_id, company_id, action, detail, created_at) VALUES (?,?,?,?,?)')
      .run(null, null, 'qris.webhook', `${out.reference} · ${out.status}`, U.nowISO());
  } catch (err) { /* log tidak boleh menggagalkan webhook */ }
  res.json({ ok: true });
}));

// ---------- Struk (ticket JSON + halaman cetak) ----------
app.get('/pos/sales/:id/ticket', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const sale = scopedSale(ctx, req.params.id);
  if (!sale) return res.status(404).json({ ok: false, error: 'Transaksi tidak ditemukan.' });
  const model = ticketLib.build(db, sale.id, { reprint: req.query.reprint === '1' });
  if (!model) return res.status(404).json({ ok: false, error: 'Transaksi tidak ditemukan.' });
  res.set('Cache-Control', 'no-store').json({ ok: true, ticket: model, text: ticketLib.textLines(model).join('\n') });
}));

app.get('/pos/sales/:id/struk', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const sale = scopedSale(ctx, req.params.id);
  if (!sale) return res.status(404).send(L.shell(ctx, {
    title: 'Struk tidak ditemukan', active: '/pos/sales',
    content: L.card({ title: '404' }, '<p class="hint-text">Transaksi tidak ditemukan dalam cakupan Anda.</p>'),
  }));
  const model = ticketLib.build(db, sale.id, { reprint: true, copyLabel: 'SALINAN' });
  res.send(receiptPage(ctx, {
    ticket: model,
    lines: ticketLib.textLines(model),
    paper: { mm: model.paper.mm, cols: model.paper.cols },
    qrisMode: qris.mode(db),
    isReprint: true,
  }));
}));

app.post('/pos/quote', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const outlet = saleOutlet(ctx, req.body.company_id || ctx.selectedCompanyId);
  if (!outlet) return res.status(400).json({ ok: false, error: 'Outlet tidak valid.' });
  let items = [];
  try { items = JSON.parse(req.body.items || '[]'); } catch (err) { items = []; }
  if (!Array.isArray(items)) items = [];

  const allowed = new Set(auth.ancestors(ctx.companies, outlet.id));
  const safeItems = [];
  for (const item of items) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(Number(item.id));
    if (!p || !allowed.has(p.company_id)) continue;
    safeItems.push({ id: p.id, qty: Math.max(1, Math.min(999, Number(item.qty) || 1)) });
  }
  const customerId = Number(req.body.customer_id) || null;
  const customer = customerId ? db.prepare('SELECT id, company_id FROM customers WHERE id = ?').get(customerId) : null;
  if (customer && !ctx.allowedIds.has(customer.company_id)) {
    return res.status(400).json({ ok: false, error: 'Pelanggan di luar cakupan Anda.' });
  }

  const q = engine.quote(db, {
    companyId: outlet.id,
    items: safeItems,
    customerId: customer ? customer.id : null,
    code: req.body.promo_code || '',
    points: req.body.points || 0,
    atDate: U.todayISO(),
  });
  res.json({ ok: true, quote: q });
}));

app.post('/pos/checkout', guard('pos_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const outlet = saleOutlet(ctx, req.body.company_id);
  if (!outlet || outlet.level === 'holding') {
    return backWith(ctx, res, 'Outlet penjualan tidak valid untuk akun Anda.', 'error');
  }

  const cart = resolveCart(ctx, outlet, req.body);
  if (!cart.ok) return backWith(ctx, res, cart.error, 'error');
  const q = cart.quote;

  const payCodes = posOptions.activeCodes(db, 'payment_method');
  const payment = payCodes.has(String(req.body.payment_method || ''))
    ? String(req.body.payment_method)
    : (payCodes.has('cash') ? 'cash' : [...payCodes][0] || 'cash');

  // Verifikasi QRIS: bila referensi diberikan, nominal & status harus cocok dengan quote server.
  const qrisRef = String(req.body.qris_ref || '').trim();
  let qrisPayment = null;
  if (qrisRef) {
    qrisPayment = qris.find(db, qrisRef);
    if (!qrisPayment || !ctx.allowedIds.has(qrisPayment.company_id)) {
      return backWith(ctx, res, 'Referensi QRIS tidak ditemukan dalam cakupan Anda.', 'error');
    }
    if (qrisPayment.sale_id) return backWith(ctx, res, 'QRIS ini sudah dipakai transaksi lain.', 'error');
    if (payment !== 'qris') return backWith(ctx, res, 'Referensi QRIS hanya berlaku untuk metode bayar QRIS.', 'error');
    const fresh = await qris.sync(db, qrisPayment);
    qrisPayment = fresh;
    if (fresh.status !== 'paid') {
      return backWith(ctx, res, `Pembayaran QRIS belum lunas (${qris.STATUS[fresh.status] || fresh.status}).`, 'error');
    }
    if (Math.abs(Number(fresh.amount) - Number(q.total)) > 1) {
      return backWith(ctx, res, `Nominal QRIS ${U.idr(fresh.amount)} tidak sama dengan total ${U.idr(q.total)}.`, 'error');
    }
  } else if (payment === 'qris' && qris.enforced(db)) {
    return backWith(ctx, res, 'Pembayaran QRIS harus dibuat lewat tombol Bayar agar terverifikasi.', 'error');
  }

  const sale = createSale(db, q, {
    companyId: outlet.id,
    userId: ctx.user.id,
    soldAt: U.localNow(),
    paymentMethod: payment,
    source: 'pos',
    note: String(req.body.note || '').slice(0, 200) || null,
  });
  if (qrisPayment) {
    qris.bindSale(db, qrisPayment, { id: sale.id, invoiceNo: sale.invoiceNo, companyId: outlet.id });
    logAction(ctx, 'pos.qris.bind', `${qrisPayment.reference} → ${sale.invoiceNo}`);
  }
  logAction(ctx, 'pos.checkout', `${sale.invoiceNo} · ${U.idr(sale.total)} · ${outlet.name}${q.promo ? ' · ' + q.promo.label : ''}`);
  // notifikasi WhatsApp (async, tidak menahan transaksi bila provider lambat)
  if (q.customer) {
    wa.notifyReceipt(db, sale.id)
      .then((r) => { if (!r.skipped) logAction(ctx, 'wa.notify.receipt', `${sale.invoiceNo} · ${r.status || 'simulated'}`); })
      .catch((err) => console.error('[wa] notifyReceipt', err.message));
  }
  const extra = [q.promo ? `promo ${q.promo.code || q.promo.name}` : '', q.pointsUsed ? `${q.pointsUsed} poin ditukar` : '', q.pointsEarned ? `+${q.pointsEarned} poin` : '']
    .filter(Boolean).join(' · ');
  backWith(ctx, res, `Transaksi ${sale.invoiceNo} tersimpan — ${U.idr(sale.total)}${extra ? ' (' + extra + ')' : ''}.`, 'success', `/pos?last=${sale.id}`);
}));

app.get('/pos/sales', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const sales = db.prepare(`SELECT s.*, c.name company, u.name cashier_name, cu.name customer_name,
      (SELECT COALESCE(SUM(qty),0) FROM sale_items i WHERE i.sale_id = s.id) item_count
    FROM sales s LEFT JOIN companies c ON c.id = s.company_id LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN customers cu ON cu.id = s.customer_id
    WHERE s.company_id IN (${ph}) AND substr(s.sold_at,1,7) = ?
    ORDER BY s.sold_at DESC, s.id DESC LIMIT 150`).all(...ids, ctx.month);
  const paid = sales.filter((s) => s.status === 'paid');
  const summary = {
    count: paid.length,
    revenue: paid.reduce((a, s) => a + s.total, 0),
    imported: sales.filter((s) => s.source === 'import').length,
    void: sales.filter((s) => s.status === 'void').reduce((a, s) => a + s.total, 0),
    voidCount: sales.filter((s) => s.status === 'void').length,
    memberCount: paid.filter((s) => s.customer_id).length,
    promo: paid.reduce((a, s) => a + s.promo_discount, 0),
    promoCount: paid.filter((s) => s.promo_discount > 0).length,
  };
  summary.avg = summary.count ? summary.revenue / summary.count : 0;
  const memberValue = paid.filter((s) => s.customer_id).reduce((a, s) => a + s.total, 0);
  summary.share = summary.revenue ? U.pct((memberValue / summary.revenue) * 100, 0) : '0%';
  res.send(salesPage(ctx, { sales, summary, canVoid: auth.can(ctx.user, 'pos_write') }));
}));

app.post('/pos/sales/:id/void', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(Number(req.params.id));
  if (!sale || !ctx.allowedIds.has(sale.company_id)) return backWith(ctx, res, 'Transaksi tidak ditemukan.', 'error');
  voidSale(db, sale.id, ctx.user.id);
  qris.refundForSale(db, sale.id); // pembayaran QRIS yang terhubung ikut ditandai dikembalikan
  logAction(ctx, 'pos.void', `${sale.invoice_no} · ${U.idr(sale.total)}`);
  backWith(ctx, res, `Transaksi ${sale.invoice_no} dibatalkan dan stok dikembalikan.`);
}));

app.get('/pos/products', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const products = db.prepare(`SELECT p.*, c.name company_name FROM products p LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.company_id IN (${ph}) ORDER BY c.name, p.category, p.name`).all(...ids);
  const materials = db.prepare(`SELECT * FROM materials WHERE company_id IN (${ph}) AND active = 1 ORDER BY name`).all(...ids);
  res.send(productsPage(ctx, { products, materials }));
}));

function recipeFromBody(body) {
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const name = body[`recipe_material_${i}`];
    const qty = Number(body[`recipe_qty_${i}`]);
    if (name && qty > 0) rows.push({ material_name: String(name), qty });
  }
  return rows;
}

app.post('/pos/products/save', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const name = String(req.body.name || '').trim();
  const sku = String(req.body.sku || '').trim();
  const price = Number(req.body.price) || 0;
  const priceGrosir = Number(req.body.price_grosir) || 0;
  const priceDistributor = Number(req.body.price_distributor) || 0;
  const stock = Number(req.body.stock) || 0;
  const category = String(req.body.category || '').trim().slice(0, 60);
  // jenis menu mengikuti Master Data POS (Settings → Master Data POS)
  const kindCodes = posOptions.activeCodes(db, 'menu_type');
  const kind = kindCodes.has(String(req.body.kind || '')) ? String(req.body.kind) : (kindCodes.has('menu') ? 'menu' : [...kindCodes][0]);
  if (!name || !sku) return backWith(ctx, res, 'Nama dan SKU wajib diisi.', 'error');

  const id = Number(req.body.id) || null;
  let productId = id;
  if (id) {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing || !ctx.allowedIds.has(existing.company_id)) return backWith(ctx, res, 'Produk tidak ditemukan.', 'error');
    db.prepare(`UPDATE products SET company_id = ?, sku = ?, name = ?, category = ?, kind = ?, price = ?,
        price_grosir = ?, price_distributor = ?, stock = ? WHERE id = ?`)
      .run(companyId, sku, name, category, kind, price, priceGrosir, priceDistributor, stock, id);
    logAction(ctx, 'product.update', `${sku} · ${name}`);
  } else {
    productId = db.prepare(`INSERT INTO products (company_id, sku, name, category, kind, price, price_grosir, price_distributor, cost, stock, active, created_at)
      VALUES (?,?,?,?,?,?,?,?,0,?,1,?)`)
      .run(companyId, sku, name, category, kind, price, priceGrosir, priceDistributor, stock, U.nowISO()).lastInsertRowid;
    logAction(ctx, 'product.create', `${sku} · ${name}`);
  }

  const recipe = recipeFromBody(req.body);
  if (recipe.length || id) {
    const saved = inventory.saveRecipe(db, productId, recipe);
    if (saved) logAction(ctx, 'product.recipe', `${sku} · HPP ${U.idr(saved.cost)} · ${recipe.length} bahan`);
  }
  backWith(ctx, res, `Produk ${name} disimpan${id ? '' : ' (baru)'}.`);
}));

app.post('/pos/products/:id/image', upload.single('image'), requireCsrf, guard('pos_write'),
  entityImageHandler({
    table: 'products', label: 'Produk', back: '/pos/products',
    scopeCheck: (ctx, row) => ctx.allowedIds.has(row.company_id),
  }));

app.post('/pos/products/:id/delete', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!product || !ctx.allowedIds.has(product.company_id)) return backWith(ctx, res, 'Produk tidak ditemukan.', 'error');
  const used = db.prepare('SELECT COUNT(*) c FROM sale_items WHERE product_id = ?').get(product.id).c;
  if (used) {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(product.id);
    logAction(ctx, 'product.archive', product.sku);
    return backWith(ctx, res, `Produk ${product.name} dinonaktifkan karena sudah punya riwayat penjualan.`);
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
  logAction(ctx, 'product.delete', product.sku);
  backWith(ctx, res, `Produk ${product.name} dihapus.`);
}));

// ---------- Member & pelanggan ----------
app.get('/members', guard('customer_read'), route((req, res) => {
  const ctx = req.ctx;
  const filter = {
    type: ['b2c', 'b2b'].includes(req.query.type) ? req.query.type : 'all',
    q: String(req.query.q || '').slice(0, 60),
  };
  const customers = Q.customerList(db, ctx.scopeIds, filter);
  const stats = Q.memberStats(db, ctx.scopeIds, ctx.month);
  const detailId = Number(req.query.customer) || null;
  let detail = null;
  let detailSales = [];
  let detailPrices = [];
  if (detailId) {
    const row = Q.customerById(db, detailId);
    if (row && ctx.allowedIds.has(row.company_id)) {
      const extra = db.prepare(`SELECT
          (SELECT COUNT(*) FROM sales s WHERE s.customer_id = ? AND s.status='paid') trx,
          (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id = ? AND s.status='paid') spend`).get(detailId, detailId);
      detail = { ...row, ...extra };
      detailSales = Q.customerSales(db, detailId, 12);
      detailPrices = Q.customerPrices(db, detailId);
    }
  }
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const products = db.prepare(`SELECT * FROM products WHERE active = 1 AND company_id IN (${ph}) ORDER BY name`).all(...ctx.scopeIds);
  res.send(membersPage(ctx, { customers, stats, detail, detailSales, detailPrices, products, filter }));
}));

app.post('/members/save', guard('customer_write'), route((req, res) => {
  const ctx = req.ctx;
  const id = Number(req.body.id) || null;
  const name = String(req.body.name || '').trim();
  const type = req.body.type === 'b2b' ? 'b2b' : 'b2c';
  const tier = ['retail', 'grosir', 'distributor'].includes(req.body.price_tier) ? req.body.price_tier : 'retail';
  if (!name) return backWith(ctx, res, 'Nama pelanggan wajib diisi.', 'error');

  if (id) {
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing || !ctx.allowedIds.has(existing.company_id)) return backWith(ctx, res, 'Pelanggan tidak ditemukan.', 'error');
    db.prepare(`UPDATE customers SET name = ?, type = ?, phone = ?, email = ?, company_name = ?, npwp = ?,
        price_tier = ?, active = ? WHERE id = ?`)
      .run(name, type, String(req.body.phone || '').slice(0, 30), String(req.body.email || '').slice(0, 80),
        String(req.body.company_name || '').slice(0, 80) || null, String(req.body.npwp || '').slice(0, 40) || null,
        type === 'b2b' ? tier : 'retail', req.body.active === '0' ? 0 : 1, id);
    logAction(ctx, 'customer.update', `${name} · ${type}`);
    return backWith(ctx, res, `Data ${name} diperbarui.`, 'success', `/members?customer=${id}`);
  }

  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const points = Math.max(0, Number(req.body.points) || 0);
  const newId = db.prepare(`INSERT INTO customers (company_id, name, type, phone, email, company_name, npwp, price_tier, points, active, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`)
    .run(companyId, name, type, String(req.body.phone || '').slice(0, 30) || null, String(req.body.email || '').slice(0, 80) || null,
      String(req.body.company_name || '').slice(0, 80) || null, String(req.body.npwp || '').slice(0, 40) || null,
      type === 'b2b' ? tier : 'retail', points, null, U.nowISO()).lastInsertRowid;
  if (points) {
    db.prepare('INSERT INTO points_ledger (customer_id, sale_id, type, points, note, created_at) VALUES (?,?,?,?,?,?)')
      .run(newId, null, 'adjust', points, 'Poin awal pendaftaran', U.nowISO());
  }
  logAction(ctx, 'customer.create', `${name} · ${type}${type === 'b2b' ? ' · ' + tier : ''}`);
  wa.notifyMemberWelcome(db, newId)
    .then((r) => { if (!r.skipped) logAction(ctx, 'wa.notify.member', `${name} · ${r.status || 'simulated'}`); })
    .catch((err) => console.error('[wa] welcome', err.message));
  const back = backPath(req);
  const target = back.startsWith('/pos') ? `/pos?customer=${newId}` : `/members?customer=${newId}`;
  backWith(ctx, res, `${name} terdaftar sebagai ${type === 'b2b' ? 'pelanggan B2B' : 'member B2C'}.`, 'success', target);
}));

app.post('/members/:id/points', guard('customer_write'), route((req, res) => {
  const ctx = req.ctx;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
  if (!customer || !ctx.allowedIds.has(customer.company_id)) return backWith(ctx, res, 'Pelanggan tidak ditemukan.', 'error');
  const delta = Math.round(Number(req.body.delta) || 0);
  if (!delta) return backWith(ctx, res, 'Jumlah poin tidak valid.', 'error');
  const next = Math.max(0, customer.points + delta);
  db.prepare('UPDATE customers SET points = ? WHERE id = ?').run(next, customer.id);
  db.prepare('INSERT INTO points_ledger (customer_id, sale_id, type, points, note, created_at) VALUES (?,?,?,?,?,?)')
    .run(customer.id, null, 'adjust', delta, String(req.body.note || 'Penyesuaian manual').slice(0, 120), U.nowISO());
  logAction(ctx, 'customer.points', `${customer.name} · ${delta > 0 ? '+' : ''}${delta} poin`);
  backWith(ctx, res, `Poin ${customer.name} kini ${U.num(next)}.`, 'success', `/members?customer=${customer.id}`);
}));

app.post('/members/:id/prices', guard('customer_write'), route((req, res) => {
  const ctx = req.ctx;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
  if (!customer || !ctx.allowedIds.has(customer.company_id)) return backWith(ctx, res, 'Pelanggan tidak ditemukan.', 'error');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.body.product_id));
  if (!product) return backWith(ctx, res, 'Produk tidak ditemukan.', 'error');
  const price = Number(req.body.price) || 0;
  if (price <= 0) return backWith(ctx, res, 'Harga khusus harus lebih dari 0.', 'error');
  db.prepare('INSERT OR REPLACE INTO customer_prices (customer_id, product_id, price) VALUES (?,?,?)')
    .run(customer.id, product.id, price);
  logAction(ctx, 'customer.price', `${customer.name} · ${product.name} · ${U.idr(price)}`);
  backWith(ctx, res, `Harga khusus ${product.name} untuk ${customer.name} disimpan.`, 'success', `/members?customer=${customer.id}`);
}));

app.post('/members/:id/prices/:pid/delete', guard('customer_write'), route((req, res) => {
  const ctx = req.ctx;
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
  if (!customer || !ctx.allowedIds.has(customer.company_id)) return backWith(ctx, res, 'Pelanggan tidak ditemukan.', 'error');
  db.prepare('DELETE FROM customer_prices WHERE id = ? AND customer_id = ?').run(Number(req.params.pid), customer.id);
  backWith(ctx, res, 'Harga khusus dihapus.', 'success', `/members?customer=${customer.id}`);
}));

// ---------- Promo & voucher ----------
app.get('/promos', guard('promo_read'), route((req, res) => {
  const ctx = req.ctx;
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const promos = Q.activePromoList(db, ctx.scopeIds);
  const products = db.prepare(`SELECT * FROM products WHERE active = 1 AND company_id IN (${ph}) ORDER BY name`).all(...ctx.scopeIds);
  res.send(promosPage(ctx, { promos, products, impact: Q.promoImpact(db, ctx.scopeIds, ctx.month, 10) }));
}));

app.post('/promos/save', guard('promo_write'), route((req, res) => {
  const ctx = req.ctx;
  const editId = Number(req.body.id) || null;
  let existing = null;
  if (editId) {
    existing = db.prepare('SELECT * FROM promos WHERE id = ?').get(editId);
    if (!existing || !ctx.allowedIds.has(existing.company_id)) {
      return backWith(ctx, res, 'Promo tidak ditemukan dalam cakupan Anda.', 'error', '/promos');
    }
  }
  const companyId = Number(req.body.company_id) || (existing ? existing.company_id : (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]));
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error', '/promos');
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama promo wajib diisi.', 'error', '/promos');
  const kind = ['percent', 'amount', 'bogo', 'bundle'].includes(req.body.kind) ? req.body.kind : 'percent';
  const code = String(req.body.code || '').trim().toUpperCase().slice(0, 24) || null;
  if (code) {
    const dup = db.prepare(`SELECT p.id FROM promos p WHERE upper(p.code) = ? AND p.active = 1 AND p.id != ?
      AND p.company_id IN (${ctx.scopeIds.map(() => '?').join(',') || 'NULL'})`)
      .get(code, editId || 0, ...ctx.scopeIds);
    if (dup) return backWith(ctx, res, `Kode ${code} sudah dipakai promo lain.`, 'error', '/promos');
  }

  let bundleItems = null;
  let bundlePrice = 0;
  let buyProduct = null;
  let getProduct = null;
  let buyQty = 1;
  let getQty = 1;
  if (kind === 'bundle') {
    const raw = req.body.bundle_product;
    const list = Array.isArray(raw) ? raw : (raw ? String(raw).split(',') : []);
    const items = list.map((pid) => ({ product_id: Number(pid), qty: Math.max(1, Number(req.body['bundle_qty_' + pid]) || 1) }));
    if (items.length < 2) return backWith(ctx, res, 'Paket butuh minimal 2 produk.', 'error', '/promos');
    bundleItems = JSON.stringify(items);
    bundlePrice = Number(req.body.bundle_price) || 0;
    if (bundlePrice <= 0) return backWith(ctx, res, 'Harga paket wajib diisi.', 'error', '/promos');
  }
  if (kind === 'bogo') {
    buyProduct = Number(req.body.buy_product_id) || null;
    getProduct = Number(req.body.get_product_id) || buyProduct;
    buyQty = Math.max(1, Number(req.body.buy_qty) || 1);
    getQty = Math.max(1, Number(req.body.get_qty) || 1);
    if (!buyProduct) return backWith(ctx, res, 'Pilih produk untuk promo beli X gratis Y.', 'error', '/promos');
  }

  const values = [
    companyId, code, name, kind, Number(req.body.value) || 0, Number(req.body.min_spend) || 0,
    Number(req.body.max_discount) || 0, req.body.member_only === '1' ? 1 : 0,
    ['all', 'b2c', 'b2b'].includes(req.body.customer_type) ? req.body.customer_type : 'all',
    buyProduct, getProduct, buyQty, getQty, bundleItems, bundlePrice,
    req.body.start_date || null, req.body.end_date || null, Number(req.body.usage_limit) || 0,
  ];

  if (editId) {
    db.prepare(`UPDATE promos SET company_id = ?, code = ?, name = ?, kind = ?, value = ?, min_spend = ?,
        max_discount = ?, member_only = ?, customer_type = ?, buy_product_id = ?, get_product_id = ?,
        buy_qty = ?, get_qty = ?, bundle_items = ?, bundle_price = ?, start_date = ?, end_date = ?, usage_limit = ?
      WHERE id = ?`).run(...values, editId);
    logAction(ctx, 'promo.update', `#${editId} · ${name} · ${kind}`);
    return backWith(ctx, res, `Promo "${name}" diperbarui.`, 'success', '/promos');
  }

  const id = db.prepare(`INSERT INTO promos (company_id, code, name, kind, value, min_spend, max_discount, member_only,
      customer_type, buy_product_id, get_product_id, buy_qty, get_qty, bundle_items, bundle_price,
      start_date, end_date, usage_limit, used_count, active, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?)`)
    .run(...values, U.nowISO()).lastInsertRowid;
  logAction(ctx, 'promo.create', `#${id} · ${name} · ${kind}`);
  backWith(ctx, res, `Promo "${name}" dibuat${code ? ' dengan kode ' + code : ''}.`, 'success', '/promos');
}));

// Gambar promo / paket bundling: diteruskan ke penyimpanan media platform.
function entityImageHandler(opts) {
  const { table, label, back, scopeCheck } = opts;
  return route(async (req, res) => {
    const ctx = req.ctx;
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(req.params.id));
    if (!row || !scopeCheck(ctx, row)) return backWith(ctx, res, `${label} tidak ditemukan.`, 'error', back);
    if (req.body.remove === '1') {
      db.prepare(`UPDATE ${table} SET image_url = NULL WHERE id = ?`).run(row.id);
      logAction(ctx, `${table}.image`, `#${row.id} dihapus`);
      return backWith(ctx, res, `Gambar ${label.toLowerCase()} dihapus.`, 'success', back);
    }
    const direct = media.safeUrl(req.body.image_url);
    if (direct) {
      db.prepare(`UPDATE ${table} SET image_url = ? WHERE id = ?`).run(direct.slice(0, 400), row.id);
      logAction(ctx, `${table}.image`, `#${row.id} via URL`);
      return backWith(ctx, res, `Gambar ${label.toLowerCase()} disimpan.`, 'success', back);
    }
    if (!req.file) return backWith(ctx, res, 'Pilih gambar terlebih dahulu.', 'error', back);
    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const result = await media.upload(req.file, { filename: `${table}-${row.id}.${ext}` });
    if (!result.ok) return backWith(ctx, res, result.error, 'error', back);
    db.prepare(`UPDATE ${table} SET image_url = ? WHERE id = ?`).run(result.url, row.id);
    logAction(ctx, `${table}.image`, `#${row.id} diunggah`);
    backWith(ctx, res, `Gambar ${label.toLowerCase()} diperbarui.`, 'success', back);
  });
}

app.post('/promos/:id/image', upload.single('image'), requireCsrf, guard('promo_write'),
  entityImageHandler({
    table: 'promos', label: 'Promo', back: '/promos',
    scopeCheck: (ctx, row) => ctx.allowedIds.has(row.company_id),
  }));

app.post('/promos/:id/toggle', guard('promo_write'), route((req, res) => {
  const ctx = req.ctx;
  const promo = db.prepare('SELECT * FROM promos WHERE id = ?').get(Number(req.params.id));
  if (!promo || !ctx.allowedIds.has(promo.company_id)) return backWith(ctx, res, 'Promo tidak ditemukan.', 'error');
  db.prepare('UPDATE promos SET active = ? WHERE id = ?').run(promo.active ? 0 : 1, promo.id);
  logAction(ctx, 'promo.toggle', `${promo.name} → ${promo.active ? 'nonaktif' : 'aktif'}`);
  backWith(ctx, res, `Promo ${promo.name} ${promo.active ? 'dinonaktifkan' : 'diaktifkan'}.`, 'success', '/promos');
}));

app.post('/promos/:id/delete', guard('promo_write'), route((req, res) => {
  const ctx = req.ctx;
  const promo = db.prepare('SELECT * FROM promos WHERE id = ?').get(Number(req.params.id));
  if (!promo || !ctx.allowedIds.has(promo.company_id)) return backWith(ctx, res, 'Promo tidak ditemukan.', 'error');
  db.prepare('DELETE FROM promos WHERE id = ?').run(promo.id);
  logAction(ctx, 'promo.delete', promo.name);
  backWith(ctx, res, `Promo ${promo.name} dihapus.`, 'success', '/promos');
}));

// ---------- Bahan baku ----------
app.get('/farm', guard('inventory_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const materials = inventory.list(db, ids);
  const summary = inventory.summary(db, ids);
  const usageRow = db.prepare(`SELECT COALESCE(SUM(mv.qty * mv.unit_cost),0) value, COUNT(*) count,
      COALESCE(SUM(CASE WHEN lower(m.name) LIKE '%roasted%' THEN mv.qty ELSE 0 END),0) bean_kg
    FROM material_moves mv JOIN materials m ON m.id = mv.material_id
    WHERE mv.type='out' AND mv.company_id IN (${ph}) AND substr(mv.occurred_at,1,7) = ?`).get(...ids, ctx.month);
  const products = db.prepare(`SELECT p.*, c.name company_name FROM products p LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.company_id IN (${ph}) AND p.active = 1 ORDER BY p.name`).all(...ids);
  const recipes = products.map((p) => {
    const r = engine.recipeCost(db, p);
    const items = r.rows.map((x) => `${U.num(x.qty, 3)} ${x.unit} ${x.material_name}`).join(' + ');
    const price = p.price || 0;
    return {
      name: p.name,
      company_name: p.company_name,
      cost: r.total,
      items,
      foodCost: price ? (r.total / price) * 100 : 0,
      margin: price ? ((price - r.total) / price) * 100 : 0,
    };
  });
  res.send(farmPage(ctx, {
    materials,
    summary,
    moves: inventory.moves(db, ids, 40),
    recipes,
    usage: { value: usageRow.value, count: usageRow.count, beanKg: usageRow.bean_kg },
  }));
}));

app.post('/farm/materials', guard('inventory_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama bahan wajib diisi.', 'error');
  inventory.createMaterial(db, {
    companyId,
    name,
    category: req.body.category,
    unit: req.body.unit,
    cost: req.body.cost,
    stock: req.body.stock,
    minStock: req.body.min_stock,
  });
  logAction(ctx, 'material.create', `${name} · ${ctx.companyName(companyId)}`);
  backWith(ctx, res, `Bahan ${name} ditambahkan.`, 'success', '/farm');
}));

app.post('/farm/:id/stock-in', guard('inventory_write'), route((req, res) => {
  const ctx = req.ctx;
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(req.params.id));
  if (!material || !ctx.allowedIds.has(material.company_id)) return backWith(ctx, res, 'Bahan tidak ditemukan.', 'error');
  const qty = Number(req.body.qty) || 0;
  if (qty <= 0) return backWith(ctx, res, 'Jumlah stok masuk harus lebih dari 0.', 'error');
  const result = inventory.stockIn(db, {
    companyId: material.company_id,
    materialId: material.id,
    qty,
    unitCost: req.body.unit_cost,
    note: req.body.note,
    userId: ctx.user.id,
  });
  logAction(ctx, 'material.stock_in', `${material.name} · +${qty} ${material.unit}`);
  backWith(ctx, res, `Stok ${material.name} bertambah ${U.num(qty, 2)} ${material.unit} (harga ${U.idr(result.cost)}/${material.unit}).`, 'success', '/farm');
}));

app.post('/farm/:id/adjust', guard('inventory_write'), route((req, res) => {
  const ctx = req.ctx;
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(req.params.id));
  if (!material || !ctx.allowedIds.has(material.company_id)) return backWith(ctx, res, 'Bahan tidak ditemukan.', 'error');
  inventory.adjustStock(db, {
    companyId: material.company_id,
    materialId: material.id,
    stock: req.body.stock,
    minStock: req.body.min_stock,
    cost: req.body.cost,
    note: 'Penyesuaian dari halaman stok',
    userId: ctx.user.id,
  });
  logAction(ctx, 'material.adjust', `${material.name} · stok ${req.body.stock}`);
  backWith(ctx, res, `Penyesuaian stok ${material.name} disimpan.`, 'success', '/farm');
}));

// ---------- Import ----------
app.get('/import', guard('import'), route((req, res) => {
  const ctx = req.ctx;
  const logs = db.prepare('SELECT * FROM audit_log WHERE action LIKE ? ORDER BY id DESC LIMIT 12').all('import.%');
  res.send(importPage(ctx, { templates: importer.TEMPLATES, logs }));
}));

app.get('/import/template', guard('import'), route((req, res) => {
  const type = req.query.type === 'products' ? 'products' : 'sales';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="template-${type}.csv"`);
  res.send(importer.templateCsv(type));
}));

app.post('/import/sales', guard('import'), upload.single('file'), requireCsrf, route((req, res) => {
  const ctx = req.ctx;
  if (!req.file) return backWith(ctx, res, 'File belum dipilih.', 'error');
  let rows = [];
  try {
    rows = importer.readRows(req.file.buffer, req.file.originalname);
  } catch (err) {
    return backWith(ctx, res, 'File tidak dapat dibaca. Pastikan format CSV/Excel valid.', 'error');
  }
  if (!rows.length) return backWith(ctx, res, 'File tidak berisi data pada sheet pertama.', 'error');
  const mode = req.body.mode === 'summary' ? 'summary' : 'items';
  const result = importer.importSales(ctx, rows, mode);
  logAction(ctx, 'import.sales', `${req.file.originalname} · ${result.created} transaksi · ${result.skipped} dilewati${result.errors.length ? ' · ' + result.errors.slice(0, 3).join('; ') : ''}`);
  const msg = `Import selesai: ${result.created} transaksi dibuat dari ${result.rowCount} baris, ${result.skipped} dilewati.`
    + (result.errors.length ? ' Catatan: ' + result.errors.slice(0, 3).join(' | ') : '');
  backWith(ctx, res, msg, result.created ? 'success' : 'error', '/import');
}));

app.post('/import/products', guard('import'), upload.single('file'), requireCsrf, route((req, res) => {
  const ctx = req.ctx;
  if (!req.file) return backWith(ctx, res, 'File belum dipilih.', 'error');
  const companyId = Number(req.body.company_id) || ctx.selectedCompanyId || ctx.user.company_id;
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  let rows = [];
  try {
    rows = importer.readRows(req.file.buffer, req.file.originalname);
  } catch (err) {
    return backWith(ctx, res, 'File tidak dapat dibaca. Pastikan format CSV/Excel valid.', 'error');
  }
  if (!rows.length) return backWith(ctx, res, 'File tidak berisi data pada sheet pertama.', 'error');
  const result = importer.importProducts(ctx, rows, companyId);
  logAction(ctx, 'import.products', `${req.file.originalname} · ${result.created} baru · ${result.updated} diperbarui`);
  const msg = `Import produk: ${result.created} dibuat, ${result.updated} diperbarui, ${result.skipped} dilewati.`
    + (result.errors.length ? ' Catatan: ' + result.errors.slice(0, 3).join(' | ') : '');
  backWith(ctx, res, msg, result.created || result.updated ? 'success' : 'error', '/pos/products');
}));

// ---------- Keuangan ----------
app.get('/finance', guard('finance_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const month = ctx.month;
  const fin = { ...Q.financeFor(db, ids, month), month };
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const txs = db.prepare(`SELECT t.*, c.name company FROM transactions t LEFT JOIN companies c ON c.id = t.company_id
    WHERE t.type IN ('expense','income') AND t.company_id IN (${ph}) AND substr(t.occurred_at,1,7) = ?
    ORDER BY t.occurred_at DESC, t.id DESC LIMIT 250`).all(...ids, month);
  const targetRows = db.prepare(`SELECT * FROM targets WHERE period = ? AND company_id IN (${ph})`).all(month, ...ids);
  const targets = new Map(targetRows.map((t) => [t.company_id, t]));
  const revMap = new Map(Q.revenueByCompany(db, ids, month).map((r) => [r.company_id, r]));
  const perCompany = ctx.companies
    .filter((c) => ids.includes(c.id) && c.level !== 'holding')
    .map((c) => ({ company_id: c.id, revenue: (revMap.get(c.id) || {}).revenue || 0 }));
  res.send(financePage(ctx, {
    fin,
    series: Q.seriesFor(db, ids, U.monthRange(month, 12)),
    expenseRows: Q.expenseBreakdown(db, ids, month),
    txs,
    targets,
    perCompany,
    target: Q.targetFor(db, ids, month),
    channel: Q.channelMix(db, ids, month),
    promo: Q.promoImpact(db, ids, month),
    labor: attendance.laborCost(db, ids, month),
    laborRows: attendance.recap(db, ids, month).rows,
    cash: forecast.cashFlow(db, ids, month),
    projection: forecast.project(Q.seriesFor(db, ids, U.monthRange(month, 6)), { horizon: 3 }),
    st: {
      pl: statements.profitLoss(db, ids, month),
      cf: statements.cashFlow(db, ids, month),
      bs: statements.balanceSheet(db, ids, month),
    },
    tab: String(req.query.tab || 'ringkasan'),
  }));
}));

// ---------- Akun neraca & asumsi pajak ----------
app.post('/finance/accounts', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || ctx.user.company_id;
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error', '/finance?tab=neraca');
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama akun wajib diisi.', 'error', '/finance?tab=neraca');
  const type = statements.TYPE_LABEL[req.body.type] ? req.body.type : 'equity';
  const balance = Number(req.body.balance) || 0;
  const depreciation = Math.max(0, Number(req.body.monthly_depreciation) || 0);
  db.prepare(`INSERT INTO fin_accounts (company_id, code, name, type, balance, monthly_depreciation, note, active, sort_order, created_at)
    VALUES (?,?,?,?,?,?,?,1,?,?)`)
    .run(companyId, String(req.body.code || '').trim().slice(0, 20) || null, name.slice(0, 80), type, balance,
      depreciation, String(req.body.note || '').slice(0, 160) || null, Number(req.body.sort_order) || 0, U.nowISO());
  logAction(ctx, 'finance.account.create', `${name} · ${statements.TYPE_LABEL[type]} · ${U.idr(balance)}`);
  backWith(ctx, res, `Akun "${name}" ditambahkan ke neraca.`, 'success', '/finance?tab=neraca');
}));

app.post('/finance/accounts/:id', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const acc = db.prepare('SELECT * FROM fin_accounts WHERE id = ?').get(Number(req.params.id));
  if (!acc || !ctx.allowedIds.has(acc.company_id)) return backWith(ctx, res, 'Akun tidak ditemukan.', 'error', '/finance?tab=neraca');
  const name = String(req.body.name || acc.name).trim().slice(0, 80);
  const balance = req.body.balance === undefined ? acc.balance : (Number(req.body.balance) || 0);
  const type = statements.TYPE_LABEL[req.body.type] ? req.body.type : acc.type;
  const depreciation = req.body.monthly_depreciation === undefined
    ? acc.monthly_depreciation : Math.max(0, Number(req.body.monthly_depreciation) || 0);
  db.prepare('UPDATE fin_accounts SET name = ?, type = ?, balance = ?, monthly_depreciation = ? WHERE id = ?')
    .run(name, type, balance, depreciation, acc.id);
  logAction(ctx, 'finance.account.update', `${name} · ${U.idr(balance)}`);
  backWith(ctx, res, `Akun "${name}" diperbarui.`, 'success', '/finance?tab=neraca');
}));

app.post('/finance/accounts/:id/delete', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const acc = db.prepare('SELECT * FROM fin_accounts WHERE id = ?').get(Number(req.params.id));
  if (!acc || !ctx.allowedIds.has(acc.company_id)) return backWith(ctx, res, 'Akun tidak ditemukan.', 'error', '/finance?tab=neraca');
  db.prepare('DELETE FROM fin_accounts WHERE id = ?').run(acc.id);
  logAction(ctx, 'finance.account.delete', acc.name);
  backWith(ctx, res, `Akun "${acc.name}" dihapus.`, 'success', '/finance?tab=neraca');
}));

app.post('/finance/settings', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const rate = Math.max(0, Math.min(50, Number(req.body.tax_rate) || 0));
  settings.set(db, 'tax_rate', String(rate));
  logAction(ctx, 'finance.tax_rate', `${rate}%`);
  backWith(ctx, res, `Tarif pajak diset ${U.num(rate, 2)}%.`, 'success', '/finance?tab=labarugi');
}));

app.post('/finance/transactions', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const type = req.body.type === 'income' ? 'income' : 'expense';
  const amount = Number(req.body.amount) || 0;
  const category = String(req.body.category || '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.occurred_at) ? req.body.occurred_at : U.todayISO();
  const cashGroup = ['operating', 'investing', 'financing'].includes(req.body.cash_group) ? req.body.cash_group : 'operating';
  if (!amount || !category) return backWith(ctx, res, 'Kategori dan jumlah wajib diisi.', 'error');
  db.prepare(`INSERT INTO transactions (company_id, type, category, description, amount, occurred_at, source, cash_group, user_id, created_at)
    VALUES (?,?,?,?,?,?,'manual',?,?,?)`)
    .run(companyId, type, category, String(req.body.description || '').slice(0, 200), amount, date, cashGroup, ctx.user.id, U.nowISO());
  logAction(ctx, 'finance.create', `${type} · ${category} · ${U.idr(amount)}`);
  backWith(ctx, res, `${type === 'expense' ? 'Beban' : 'Pendapatan'} ${category} ${U.idr(amount)} tersimpan.`);
}));

app.post('/finance/transactions/:id/delete', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(req.params.id));
  if (!tx || !ctx.allowedIds.has(tx.company_id)) return backWith(ctx, res, 'Transaksi tidak ditemukan.', 'error');
  db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  logAction(ctx, 'finance.delete', `${tx.type} · ${tx.category} · ${U.idr(tx.amount)}`);
  backWith(ctx, res, 'Transaksi keuangan dihapus.');
}));

app.post('/finance/targets', guard('finance_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id);
  const period = /^\d{4}-\d{2}$/.test(req.body.period) ? req.body.period : ctx.month;
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const revenue = Number(req.body.revenue_target) || 0;
  const current = db.prepare('SELECT * FROM targets WHERE company_id = ? AND period = ?').get(companyId, period);
  if (current) {
    db.prepare('UPDATE targets SET revenue_target = ?, profit_target = ? WHERE id = ?')
      .run(revenue, Number(req.body.profit_target) || current.profit_target, current.id);
  } else {
    db.prepare('INSERT INTO targets (company_id, period, revenue_target, profit_target) VALUES (?,?,?,?)')
      .run(companyId, period, revenue, Number(req.body.profit_target) || Math.round(revenue * 0.16));
  }
  logAction(ctx, 'finance.target', `${ctx.companyName(companyId)} · ${period} · ${U.idr(revenue)}`);
  backWith(ctx, res, `Target pendapatan ${ctx.companyName(companyId)} untuk ${U.monthLabel(period)} disimpan.`);
}));

// ---------- Performance ----------
function perfData(ctx) {
  const ids = ctx.scopeIds;
  const kpis = Q.kpiRows(db, ids, ctx.month);
  const objectives = Q.objectivesFor(db, ids);
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const users = db.prepare(`SELECT u.* FROM users u WHERE u.active = 1 AND u.company_id IN (
      SELECT id FROM companies WHERE id IN (${ph})
    ) ORDER BY u.name`).all(...ids);
  return { kpis, objectives, users };
}

function allUsersInScope(ctx) {
  const ids = new Set();
  for (const cid of ctx.scopeIds) ids.add(cid);
  const users = db.prepare('SELECT id, name, role, company_id FROM users WHERE active = 1 ORDER BY name').all();
  return users.filter((u) => ids.has(u.company_id));
}

app.get('/performance/bsc', guard('perf_read'), route((req, res) => {
  const ctx = req.ctx;
  const { kpis, objectives } = perfData(ctx);
  const bsc = Q.bscSummary(kpis, objectives);
  res.send(bscPage(ctx, { bsc, kpis, objectives, users: allUsersInScope(ctx) }));
}));

app.get('/performance/kpi', guard('perf_read'), route((req, res) => {
  const ctx = req.ctx;
  const { kpis, objectives } = perfData(ctx);
  res.send(kpiPage(ctx, { kpis, objectives, users: allUsersInScope(ctx) }));
}));

app.get('/performance/okr', guard('perf_read'), route((req, res) => {
  const ctx = req.ctx;
  const okrs = Q.okrRows(db, ctx.scopeIds, U.quarterOf(ctx.month));
  res.send(okrPage(ctx, { okrs, users: allUsersInScope(ctx) }));
}));

app.get('/performance/raci', guard('perf_read'), route((req, res) => {
  const ctx = req.ctx;
  res.send(raciPage(ctx, { raci: Q.raciRows(db, ctx.scopeIds), users: allUsersInScope(ctx) }));
}));

app.post('/performance/bsc/objectives', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const title = String(req.body.title || '').trim();
  const perspective = ['financial', 'customer', 'process', 'growth'].includes(req.body.perspective) ? req.body.perspective : 'financial';
  if (!title) return backWith(ctx, res, 'Judul objective wajib diisi.', 'error');
  const objId = db.prepare('INSERT INTO objectives (company_id, perspective, title, description, weight, owner_id, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(companyId, perspective, title, String(req.body.description || '').slice(0, 400), Number(req.body.weight) || 25, Number(req.body.owner_id) || ctx.user.id, U.nowISO()).lastInsertRowid;
  logAction(ctx, 'bsc.objective.create', `#${objId} · ${title}`);
  backWith(ctx, res, `Objective "${title}" ditambahkan.`, 'success', '/performance/bsc');
}));

app.post('/performance/bsc/objectives/:id/delete', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const obj = db.prepare('SELECT * FROM objectives WHERE id = ?').get(Number(req.params.id));
  if (!obj || !ctx.allowedIds.has(obj.company_id)) return backWith(ctx, res, 'Objective tidak ditemukan.', 'error');
  db.prepare('UPDATE kpis SET objective_id = NULL WHERE objective_id = ?').run(obj.id);
  db.prepare('DELETE FROM objectives WHERE id = ?').run(obj.id);
  logAction(ctx, 'bsc.objective.delete', obj.title);
  backWith(ctx, res, 'Objective dihapus. KPI terkait tetap tersimpan tanpa objective.', 'success', '/performance/bsc');
}));

app.post('/performance/kpi', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama KPI wajib diisi.', 'error');
  const metric = String(req.body.metric || 'manual');
  const allowedMetrics = ['manual', 'revenue', 'net_profit', 'gross_profit', 'margin', 'gross_margin',
    'expense_ratio', 'transactions', 'avg_ticket', 'hpp_ratio', 'b2b_share', 'member_share', 'labor_cost_ratio'];
  const unit = ['currency', 'number', 'percent', 'ratio'].includes(req.body.unit) ? req.body.unit : 'number';
  const perspective = ['financial', 'customer', 'process', 'growth'].includes(req.body.perspective) ? req.body.perspective : 'financial';
  const polarity = req.body.polarity === 'lower' ? 'lower' : 'higher';
  const objectiveId = Number(req.body.objective_id) || null;
  const id = db.prepare(`INSERT INTO kpis (company_id, objective_id, name, perspective, unit, metric, target_value, polarity, weight, owner_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(companyId, objectiveId, name, perspective, unit, allowedMetrics.includes(metric) ? metric : 'manual',
      Number(req.body.target_value) || 0, polarity, Number(req.body.weight) || 10, Number(req.body.owner_id) || ctx.user.id, U.nowISO()).lastInsertRowid;
  logAction(ctx, 'kpi.create', `#${id} · ${name}`);
  backWith(ctx, res, `KPI "${name}" ditambahkan.`, 'success', '/performance/kpi');
}));

app.post('/performance/kpi/:id/value', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const kpi = db.prepare('SELECT * FROM kpis WHERE id = ?').get(Number(req.params.id));
  if (!kpi || !ctx.allowedIds.has(kpi.company_id)) return backWith(ctx, res, 'KPI tidak ditemukan.', 'error');
  const period = /^\d{4}-\d{2}$/.test(req.body.period || '') ? req.body.period : ctx.month;
  const value = Number(req.body.value);
  if (!Number.isFinite(value)) return backWith(ctx, res, 'Nilai KPI tidak valid.', 'error');
  db.prepare('INSERT OR REPLACE INTO kpi_entries (kpi_id, period, value, updated_at) VALUES (?,?,?,?)')
    .run(kpi.id, period, value, U.nowISO());
  logAction(ctx, 'kpi.update', `${kpi.name} · ${period} · ${value}`);
  backWith(ctx, res, `Nilai KPI ${kpi.name} diperbarui untuk ${U.monthLabel(period)}.`, 'success', '/performance/kpi');
}));

app.post('/performance/kpi/:id/update', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const kpi = db.prepare('SELECT * FROM kpis WHERE id = ?').get(Number(req.params.id));
  if (!kpi || !ctx.allowedIds.has(kpi.company_id)) return backWith(ctx, res, 'KPI tidak ditemukan.', 'error');
  const name = String(req.body.name || kpi.name).trim();
  if (!name) return backWith(ctx, res, 'Nama KPI wajib diisi.', 'error');
  const unit = ['currency', 'number', 'percent', 'ratio'].includes(req.body.unit) ? req.body.unit : kpi.unit;
  const perspective = ['financial', 'customer', 'process', 'growth'].includes(req.body.perspective) ? req.body.perspective : kpi.perspective;
  const polarity = req.body.polarity === 'lower' ? 'lower' : 'higher';
  const objectiveId = Number(req.body.objective_id) || null;
  db.prepare(`UPDATE kpis SET name = ?, unit = ?, perspective = ?, target_value = ?, polarity = ?, weight = ?, owner_id = ?, objective_id = ? WHERE id = ?`)
    .run(name, unit, perspective, Number(req.body.target_value) || 0, polarity, Number(req.body.weight) || kpi.weight,
      Number(req.body.owner_id) || kpi.owner_id, objectiveId, kpi.id);
  logAction(ctx, 'kpi.update.definition', `${kpi.name} → ${name}`);
  backWith(ctx, res, `KPI "${name}" diperbarui.`, 'success', '/performance/kpi');
}));

app.post('/performance/kpi/:id/delete', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const kpi = db.prepare('SELECT * FROM kpis WHERE id = ?').get(Number(req.params.id));
  if (!kpi || !ctx.allowedIds.has(kpi.company_id)) return backWith(ctx, res, 'KPI tidak ditemukan.', 'error');
  db.prepare('DELETE FROM kpi_entries WHERE kpi_id = ?').run(kpi.id);
  db.prepare('DELETE FROM kpis WHERE id = ?').run(kpi.id);
  logAction(ctx, 'kpi.delete', kpi.name);
  backWith(ctx, res, `KPI ${kpi.name} dihapus.`, 'success', '/performance/kpi');
}));

app.post('/performance/okr', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const title = String(req.body.title || '').trim();
  if (!title) return backWith(ctx, res, 'Judul objective wajib diisi.', 'error');
  const period = /^\d{4}-Q[1-4]$/.test(req.body.period || '') ? req.body.period : U.quarterOf(ctx.month);
  const id = db.prepare('INSERT INTO okrs (company_id, period, title, description, owner_id, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(companyId, period, title, String(req.body.description || '').slice(0, 400), Number(req.body.owner_id) || ctx.user.id, 'on_track', U.nowISO()).lastInsertRowid;
  logAction(ctx, 'okr.create', `#${id} · ${title}`);
  backWith(ctx, res, `Objective "${title}" ditambahkan untuk ${U.quarterLabel(period)}.`, 'success', '/performance/okr');
}));

app.post('/performance/okr/:id/kr', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const okr = db.prepare('SELECT * FROM okrs WHERE id = ?').get(Number(req.params.id));
  if (!okr || !ctx.allowedIds.has(okr.company_id)) return backWith(ctx, res, 'OKR tidak ditemukan.', 'error');
  const title = String(req.body.title || '').trim();
  if (!title) return backWith(ctx, res, 'Judul key result wajib diisi.', 'error');
  const unit = ['currency', 'number', 'percent', 'ratio'].includes(req.body.unit) ? req.body.unit : 'number';
  db.prepare(`INSERT INTO key_results (okr_id, title, unit, start_value, target_value, current_value, weight, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(okr.id, title, unit, Number(req.body.start_value) || 0, Number(req.body.target_value) || 0,
      Number(req.body.current_value) || 0, Number(req.body.weight) || 1, U.nowISO());
  logAction(ctx, 'okr.kr.create', `${okr.title} · ${title}`);
  backWith(ctx, res, `Key result "${title}" ditambahkan.`, 'success', '/performance/okr');
}));

app.post('/performance/okr/kr/:id/value', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const kr = db.prepare('SELECT kr.*, o.company_id FROM key_results kr JOIN okrs o ON o.id = kr.okr_id WHERE kr.id = ?').get(Number(req.params.id));
  if (!kr || !ctx.allowedIds.has(kr.company_id)) return backWith(ctx, res, 'Key result tidak ditemukan.', 'error');
  const value = Number(req.body.current_value);
  if (!Number.isFinite(value)) return backWith(ctx, res, 'Nilai key result tidak valid.', 'error');
  db.prepare('UPDATE key_results SET current_value = ?, updated_at = ? WHERE id = ?').run(value, U.nowISO(), kr.id);
  logAction(ctx, 'okr.kr.update', `${kr.title} · ${value}`);
  backWith(ctx, res, `Progres "${kr.title}" diperbarui.`, 'success', '/performance/okr');
}));

app.post('/performance/okr/:id/status', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const okr = db.prepare('SELECT * FROM okrs WHERE id = ?').get(Number(req.params.id));
  if (!okr || !ctx.allowedIds.has(okr.company_id)) return backWith(ctx, res, 'OKR tidak ditemukan.', 'error');
  const status = ['on_track', 'at_risk', 'off_track', 'done'].includes(req.body.status) ? req.body.status : okr.status;
  db.prepare('UPDATE okrs SET status = ? WHERE id = ?').run(status, okr.id);
  logAction(ctx, 'okr.status', `${okr.title} · ${status}`);
  backWith(ctx, res, 'Status OKR diperbarui.', 'success', '/performance/okr');
}));

app.post('/performance/okr/:id/delete', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const okr = db.prepare('SELECT * FROM okrs WHERE id = ?').get(Number(req.params.id));
  if (!okr || !ctx.allowedIds.has(okr.company_id)) return backWith(ctx, res, 'OKR tidak ditemukan.', 'error');
  db.prepare('DELETE FROM key_results WHERE okr_id = ?').run(okr.id);
  db.prepare('DELETE FROM okrs WHERE id = ?').run(okr.id);
  logAction(ctx, 'okr.delete', okr.title);
  backWith(ctx, res, 'OKR dihapus.', 'success', '/performance/okr');
}));

function idList(value) {
  if (value === undefined || value === null) return '';
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => Number(v)).filter(Boolean).join(',');
}

app.post('/performance/raci', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const activity = String(req.body.activity || '').trim();
  if (!activity) return backWith(ctx, res, 'Nama aktivitas wajib diisi.', 'error');
  const status = ['not_started', 'in_progress', 'blocked', 'done'].includes(req.body.status) ? req.body.status : 'not_started';
  db.prepare(`INSERT INTO raci (company_id, activity, description, responsible_id, accountable_id, consulted_ids, informed_ids, status, progress, due_date, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(companyId, activity, String(req.body.description || '').slice(0, 300), Number(req.body.responsible_id) || null,
      Number(req.body.accountable_id) || null, idList(req.body.consulted_ids), idList(req.body.informed_ids),
      status, Math.min(100, Math.max(0, Number(req.body.progress) || 0)), req.body.due_date || null, U.nowISO());
  logAction(ctx, 'raci.create', `${activity}`);
  backWith(ctx, res, `Aktivitas "${activity}" ditambahkan.`, 'success', '/performance/raci');
}));

app.post('/performance/raci/:id/update', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const row = db.prepare('SELECT * FROM raci WHERE id = ?').get(Number(req.params.id));
  if (!row || !ctx.allowedIds.has(row.company_id)) return backWith(ctx, res, 'Aktivitas RACI tidak ditemukan.', 'error');
  const status = ['not_started', 'in_progress', 'blocked', 'done'].includes(req.body.status) ? req.body.status : row.status;
  let progress = Math.min(100, Math.max(0, Number(req.body.progress)));
  if (!Number.isFinite(progress)) progress = row.progress;
  if (status === 'done') progress = 100;
  db.prepare('UPDATE raci SET status = ?, progress = ? WHERE id = ?').run(status, progress, row.id);
  logAction(ctx, 'raci.update', `${row.activity} · ${status} · ${progress}%`);
  backWith(ctx, res, `Aktivitas "${row.activity}" diperbarui.`, 'success', '/performance/raci');
}));

app.post('/performance/raci/:id/delete', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const row = db.prepare('SELECT * FROM raci WHERE id = ?').get(Number(req.params.id));
  if (!row || !ctx.allowedIds.has(row.company_id)) return backWith(ctx, res, 'Aktivitas RACI tidak ditemukan.', 'error');
  db.prepare('DELETE FROM raci WHERE id = ?').run(row.id);
  logAction(ctx, 'raci.delete', row.activity);
  backWith(ctx, res, `Aktivitas "${row.activity}" dihapus.`, 'success', '/performance/raci');
}));

// ---------- Absensi & jadwal shift ----------
function attendanceScopeIds(ctx) {
  // barista/kasir hanya melihat dirinya sendiri
  if (!auth.can(ctx.user, 'attendance_read')) return [ctx.user.id];
  return ctx.scopeIds;
}

function scopedUsers(ctx) {
  const ids = attendanceScopeIds(ctx);
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const rows = db.prepare(`SELECT u.id, u.name, u.role, u.company_id, u.hourly_rate, c.name company_name
    FROM users u LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.active = 1 AND (u.company_id IN (${ph}) OR u.id = ?) ORDER BY c.name, u.name`)
    .all(...ids, ctx.user.id);
  return rows;
}

function scopeUserIds(ctx) {
  return scopedUsers(ctx).map((u) => u.id);
}

function attendanceBase(req, res, render) {
  const ctx = req.ctx;
  const ids = attendanceScopeIds(ctx);
  const scopeIds = ctx.scopeIds;
  const myIds = scopeUserIds(ctx);
  const month = ctx.month;
  const selectedUserId = Number(req.query.user) || null;

  const recap = attendance.recap(db, scopeIds, month);
  const rows = attendance.attendanceRows(db, scopeIds, month, {
    userId: selectedUserId || null,
    status: req.query.status || 'all',
  }).filter((r) => r.user_id === ctx.user.id || myIds.includes(r.user_id) || auth.can(ctx.user, 'attendance_read'));
  const labor = attendance.laborCost(db, scopeIds, month);
  const series = attendance.dailySeries(db, scopeIds, month);
  const shifts = attendance.shiftsOf(db, scopeIds, false);
  const today = attendance.todayState(db, ctx.user);

  res.send(render({
    today,
    user: ctx.user,
    recap,
    rows,
    series,
    labor,
    shifts,
    users: scopedUsers(ctx),
    filters: { status: req.query.status || 'all' },
    selectedUserId,
  }));
}

app.get('/attendance', guardAny(['attendance_read', 'attendance_self']), route((req, res) => {
  const ctx = req.ctx;
  // kasir & staff: langsung tampilkan kartu absen tanpa rekap tim
  if (!auth.can(ctx.user, 'attendance_read')) {
    const today = attendance.todayState(db, ctx.user);
    const own = attendance.recap(db, [ctx.user.company_id], ctx.month).rows.filter((r) => r.user_id === ctx.user.id);
    const ownRows = attendance.attendanceRows(db, [ctx.user.company_id], ctx.month, { userId: ctx.user.id });
    return res.send(attendancePage(ctx, {
      today,
      user: ctx.user,
      recap: { rows: own, totals: {
        people: own.length,
        days: own.reduce((a, r) => a + r.present_days + r.late_days, 0),
        lateDays: own.reduce((a, r) => a + r.late_days, 0),
        absentDays: own.reduce((a, r) => a + r.absent_days, 0),
        lateMinutes: own.reduce((a, r) => a + r.late_minutes, 0),
        hours: own.reduce((a, r) => a + r.hours, 0),
        cost: own.reduce((a, r) => a + r.cost, 0),
      } },
      rows: ownRows,
      series: attendance.dailySeries(db, [ctx.user.company_id], ctx.month).filter((s) => true),
      labor: { cost: own.reduce((a, r) => a + r.cost, 0), hours: own.reduce((a, r) => a + r.hours, 0), recorded: 0, variance: 0 },
      shifts: attendance.shiftsOf(db, [ctx.user.company_id], false),
      users: scopedUsers(ctx),
      filters: { status: 'all' },
      selectedUserId: null,
    }));
  }
  attendanceBase(req, res, (data) => attendancePage(ctx, data));
}));

app.post('/attendance/clock-in', guardAny(['attendance_self', 'attendance_read']), route((req, res) => {
  const ctx = req.ctx;
  const result = attendance.clockIn(db, ctx.user, { note: req.body.note });
  if (result.error) return backWith(ctx, res, result.error, 'error', backPath(req));
  logAction(ctx, 'attendance.clock_in', result.lateMinutes ? `terlambat ${result.lateMinutes} menit` : 'tepat waktu');
  const msg = result.lateMinutes
    ? `Absen masuk tercatat (terlambat ${result.lateMinutes} menit). Selamat bekerja!`
    : 'Absen masuk tercatat tepat waktu. Selamat bekerja!';
  backWith(ctx, res, msg, 'success', backPath(req));
}));

app.post('/attendance/clock-out', guardAny(['attendance_self', 'attendance_read']), route((req, res) => {
  const ctx = req.ctx;
  const result = attendance.clockOut(db, ctx.user);
  if (result.error) return backWith(ctx, res, result.error, 'error', backPath(req));
  logAction(ctx, 'attendance.clock_out', `${result.workMinutes} menit kerja`);
  backWith(ctx, res, `Absen pulang tercatat. Jam kerja hari ini ${Math.floor(result.workMinutes / 60)} jam ${result.workMinutes % 60} menit.`, 'success', backPath(req));
}));

app.post('/attendance/manual', guard('attendance_write'), route((req, res) => {
  const ctx = req.ctx;
  const userId = Number(req.body.user_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || !ctx.allowedIds.has(user.company_id)) return backWith(ctx, res, 'Barista tidak ditemukan dalam cakupan Anda.', 'error');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : U.todayISO();
  const status = ['present', 'late', 'absent', 'leave'].includes(req.body.status) ? req.body.status : 'present';
  const shiftId = Number(req.body.shift_id) || null;
  const shift = shiftId ? db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) : attendance.scheduleForDate(db, user.id, date);
  const clockIn = req.body.clock_in ? `${date} ${req.body.clock_in}:00` : null;
  const clockOut = req.body.clock_out ? `${date} ${req.body.clock_out}:00` : null;
  let workMinutes = 0;
  let lateMinutes = 0;
  if (clockIn && clockOut) {
    const total = Math.max(0, attendance.timeToMin(req.body.clock_out) - attendance.timeToMin(req.body.clock_in));
    workMinutes = Math.max(0, total - (shift && shift.break_minutes ? shift.break_minutes : 0));
    if (shift && shift.start_time) lateMinutes = Math.max(0, attendance.timeToMin(req.body.clock_in) - attendance.timeToMin(shift.start_time));
  }
  const finalStatus = status === 'present' && lateMinutes > 0 ? 'late' : status;

  db.prepare(`INSERT INTO attendance (company_id, user_id, shift_id, date, clock_in, clock_out, status, late_minutes, work_minutes, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id, date) DO UPDATE SET shift_id = excluded.shift_id, clock_in = excluded.clock_in,
      clock_out = excluded.clock_out, status = excluded.status, late_minutes = excluded.late_minutes,
      work_minutes = excluded.work_minutes, note = excluded.note`)
    .run(user.company_id, user.id, shift ? shift.id : null, date, clockIn, clockOut, finalStatus, lateMinutes, workMinutes,
      String(req.body.note || '').slice(0, 160) || null, U.nowISO());
  logAction(ctx, 'attendance.manual', `${user.name} · ${date} · ${finalStatus}`);
  const back = backPath(req);
  backWith(ctx, res, `Absensi ${user.name} (${date}) disimpan sebagai ${attendance.STATUS_LABEL[finalStatus] || finalStatus}.`, 'success',
    back.startsWith('/attendance') ? back : '/attendance');
}));

app.get('/attendance/schedule', guard('attendance_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const users = scopedUsers(ctx).filter((u) => ['cashier', 'staff', 'manager'].includes(u.role));
  const shifts = attendance.shiftsOf(db, ids, false);
  const today = U.todayISO();
  let weekStart = /^\d{4}-\d{2}-\d{2}$/.test(req.query.week || '') ? req.query.week : today;
  const dow = new Date(weekStart + 'T00:00:00Z').getUTCDay(); // 0 = Minggu
  const offset = dow === 0 ? -6 : 1 - dow;
  weekStart = attendance.addDays(weekStart, offset);
  const days = Array.from({ length: 7 }, (_, i) => attendance.addDays(weekStart, i));
  const entries = attendance.scheduleRange(db, ids, weekStart, 7);
  const grid = new Map();
  for (const e of entries) {
    grid.set(e.user_id + '|' + e.date, {
      ...e,
      color: shiftColor(e.shift_id),
      shift_name: e.shift_name || 'Shift',
    });
  }
  res.send(schedulePage(ctx, {
    weekStart,
    days,
    grid,
    shifts,
    users,
    prevWeek: attendance.addDays(weekStart, -7),
    nextWeek: attendance.addDays(weekStart, 7),
    selectedOutlet: ctx.selectedCompanyId,
    selectedShift: null,
  }));
}));

app.post('/attendance/schedule', guard('schedule_write'), route((req, res) => {
  const ctx = req.ctx;
  const userId = Number(req.body.user_id);
  const shiftId = Number(req.body.shift_id);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : U.todayISO();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
  if (!user || !ctx.allowedIds.has(user.company_id)) return backWith(ctx, res, 'Barista tidak ditemukan.', 'error');
  if (!shift || !ctx.allowedIds.has(shift.company_id)) return backWith(ctx, res, 'Shift tidak ditemukan.', 'error');
  db.prepare(`INSERT INTO shift_schedules (company_id, user_id, shift_id, date, note, created_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id, date) DO UPDATE SET shift_id = excluded.shift_id, company_id = excluded.company_id, note = excluded.note`)
    .run(shift.company_id, user.id, shift.id, date, String(req.body.note || '').slice(0, 140) || null, U.nowISO());
  logAction(ctx, 'attendance.schedule', `${user.name} · ${date} · ${shift.name}`);
  backWith(ctx, res, `Jadwal ${user.name} pada ${U.dateLabel(date)} diset ke ${shift.name}.`, 'success', '/attendance/schedule');
}));

app.post('/attendance/schedule/:id/delete', guard('schedule_write'), route((req, res) => {
  const ctx = req.ctx;
  const row = db.prepare('SELECT * FROM shift_schedules WHERE id = ?').get(Number(req.params.id));
  if (!row || !ctx.allowedIds.has(row.company_id)) return backWith(ctx, res, 'Jadwal tidak ditemukan.', 'error');
  db.prepare('DELETE FROM shift_schedules WHERE id = ?').run(row.id);
  logAction(ctx, 'attendance.schedule.delete', `#${row.id}`);
  backWith(ctx, res, 'Jadwal shift dihapus.', 'success', '/attendance/schedule');
}));

app.post('/attendance/shifts', guard('schedule_write'), route((req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  const name = String(req.body.name || '').trim();
  const start = String(req.body.start_time || '');
  const end = String(req.body.end_time || '');
  if (!name) return backWith(ctx, res, 'Nama shift wajib diisi.', 'error');
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return backWith(ctx, res, 'Jam shift tidak valid.', 'error');
  db.prepare('INSERT INTO shifts (company_id, name, start_time, end_time, break_minutes, active, created_at) VALUES (?,?,?,?,?,1,?)')
    .run(companyId, name, start, end, Math.max(0, Math.min(120, Number(req.body.break_minutes) || 0)), U.nowISO());
  logAction(ctx, 'attendance.shift.create', `${name} · ${start}-${end}`);
  backWith(ctx, res, `Shift ${name} (${start}–${end}) ditambahkan.`, 'success', '/attendance/schedule');
}));

app.post('/attendance/shifts/:id/delete', guard('schedule_write'), route((req, res) => {
  const ctx = req.ctx;
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(Number(req.params.id));
  if (!shift || !ctx.allowedIds.has(shift.company_id)) return backWith(ctx, res, 'Shift tidak ditemukan.', 'error');
  const used = db.prepare('SELECT COUNT(*) c FROM shift_schedules WHERE shift_id = ?').get(shift.id).c;
  if (used) {
    db.prepare('UPDATE shifts SET active = 0 WHERE id = ?').run(shift.id);
    logAction(ctx, 'attendance.shift.archive', shift.name);
    return backWith(ctx, res, `Shift ${shift.name} dinonaktifkan karena masih dipakai di ${used} jadwal.`, 'success', '/attendance/schedule');
  }
  db.prepare('DELETE FROM shifts WHERE id = ?').run(shift.id);
  backWith(ctx, res, `Shift ${shift.name} dihapus.`, 'success', '/attendance/schedule');
}));

// ---------- WhatsApp: webhook publik ----------
function webhookUrl(req) {
  const base = req.headers['x-public-base-path'] || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${proto}://${host}${base}/webhooks/whatsapp`;
}

function shippingWebhookUrl(req) {
  const base = req.headers['x-public-base-path'] || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${proto}://${host}${base}/webhooks/shipping`;
}

function verifyMetaSignature(req, rawBody) {
  const secret = settings.get(db, 'wa_app_secret');
  if (!secret) return true; // verifikasi opsional
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch (err) {
    return false;
  }
}

app.get('/webhooks/whatsapp', route((req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = settings.get(db, 'wa_verify_token', '');
  if (mode === 'subscribe' && token && expected && token === expected) {
    return res.status(200).send(String(challenge || ''));
  }
  if (mode === 'subscribe' && !expected) {
    return res.status(200).send(String(challenge || ''));
  }
  res.status(403).json({ ok: false, error: 'verify_token tidak cocok' });
}));

app.post('/webhooks/whatsapp', route(async (req, res) => {
  try {
    const raw = JSON.stringify(req.body || {});
    if (!verifyMetaSignature(req, raw)) {
      return res.status(401).json({ ok: false, error: 'signature tidak valid' });
    }
    const result = await wa.handleInbound(db, req.body);
    logAction({ db, user: null }, 'wa.inbound', `${result.processed} pesan`);
    res.json({ ok: true, processed: result.processed });
  } catch (err) {
    console.error('[wa] inbound', err);
    res.status(500).json({ ok: false, error: 'gagal memproses pesan' });
  }
}));

app.post('/webhooks/shipping', route((req, res) => {
  try {
    const body = req.body || {};
    const awb = body.awb || body.waybill_id || body.courier_waybill_id || body.resi;
    if (!awb) return res.status(400).json({ ok: false, error: 'awb wajib' });
    const shipment = db.prepare('SELECT * FROM shipments WHERE awb = ?').get(String(awb));
    if (!shipment) return res.status(404).json({ ok: false, error: 'pengiriman tidak ditemukan' });
    const status = shipping.STATUS[body.status] ? body.status : 'in_transit';
    shipping.setStatus(db, shipment.id, status, String(body.note || body.description || 'Update dari kurir').slice(0, 200), 'webhook');
    res.json({ ok: true });
  } catch (err) {
    console.error('[shipping] webhook', err);
    res.status(500).json({ ok: false });
  }
}));

// ---------- WhatsApp: halaman ----------
app.get('/whatsapp', guard('wa_read'), route((req, res) => {
  const ctx = req.ctx;
  const chat = String(req.query.chat || '').replace(/[^0-9]/g, '') || null;
  const threads = wa.threads(db, ctx.scopeIds);
  const activeThread = chat ? (threads.find((t) => t.wa_id === chat) || { wa_id: chat, displayName: wa.prettyPhone(chat), customer: null }) : null;
  const messages = chat ? wa.conversation(db, chat, 80) : [];
  const rules = db.prepare('SELECT * FROM wa_autoreplies ORDER BY active DESC, hits DESC, id').all();
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const customersToBroadcast = db.prepare(`SELECT COUNT(*) c FROM customers
    WHERE active = 1 AND wa_opt_in = 1 AND phone IS NOT NULL AND phone <> '' AND company_id IN (${ph})`).get(...ctx.scopeIds).c;

  res.send(whatsappPage(ctx, {
    mode: wa.mode(db),
    stats: wa.stats(db, ctx.scopeIds),
    threads,
    activeThread,
    messages,
    rules,
    outbox: wa.recentOutbox(db, ctx.scopeIds, 25),
    customersToBroadcast,
    preset: req.query.preset || '',
    webhookUrl: webhookUrl(req),
  }));
}));

app.post('/whatsapp/send', guard('wa_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const to = String(req.body.to || '').trim();
  const body = String(req.body.body || '').trim();
  if (!to || !body) return backWith(ctx, res, 'Nomor dan pesan wajib diisi.', 'error', '/whatsapp');
  const customerId = Number(req.body.customer_id) || null;
  const result = await wa.send(db, {
    to, body, name: req.body.name ? String(req.body.name).slice(0, 80) : null,
    customerId, companyId: ctx.user.company_id, isBot: false,
  });
  if (!result.ok) return backWith(ctx, res, `Gagal mengirim: ${result.error}`, 'error', '/whatsapp');
  logAction(ctx, 'wa.send', `${wa.normalizePhone(to)} · ${result.status}`);
  const phone = wa.normalizePhone(to);
  backWith(ctx, res,
    result.simulated
      ? 'Pesan tersimpan di kotak keluar (mode simulasi — isi kredensial provider untuk pengiriman nyata).'
      : 'Pesan terkirim lewat WhatsApp.',
    'success', `/whatsapp?chat=${phone}`);
}));

app.post('/whatsapp/messages/:id/retry', guard('wa_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const result = await wa.retry(db, Number(req.params.id));
  if (!result.ok) return backWith(ctx, res, `Kirim ulang gagal: ${result.error}`, 'error', '/whatsapp');
  backWith(ctx, res, result.simulated ? 'Masih mode simulasi — pesan tetap tersimpan.' : 'Pesan berhasil dikirim ulang.', 'success', '/whatsapp');
}));

app.post('/whatsapp/broadcast', guard('wa_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const message = String(req.body.message || '').trim();
  if (!message) return backWith(ctx, res, 'Isi broadcast tidak boleh kosong.', 'error', '/whatsapp');
  const result = await wa.runBroadcast(db, {
    companyId: ctx.selectedCompanyId || (ctx.scopeCompany ? ctx.scopeCompany.id : null),
    message,
    type: ['all', 'b2c', 'b2b'].includes(req.body.type) ? req.body.type : 'all',
    minPoints: Math.max(0, Number(req.body.min_points) || 0),
    limit: 200,
  });
  logAction(ctx, 'wa.broadcast', `${result.total} penerima · ${result.sent} terkirim · ${result.simulated} simulasi`);
  backWith(ctx, res,
    `Broadcast diproses: ${result.total} penerima, ${result.sent} terkirim, ${result.simulated} tersimpan (simulasi), ${result.failed} gagal.`,
    result.failed ? 'error' : 'success', '/whatsapp');
}));

app.post('/whatsapp/rules', guard('wa_write'), route((req, res) => {
  const ctx = req.ctx;
  const keyword = String(req.body.keyword || '').toLowerCase().trim();
  const reply = String(req.body.reply || '').trim();
  if (!keyword || !reply) return backWith(ctx, res, 'Kata kunci dan balasan wajib diisi.', 'error', '/whatsapp');
  db.prepare('INSERT INTO wa_autoreplies (company_id, keyword, reply, active, hits, created_at) VALUES (?,?,?,1,0,?)')
    .run(ctx.user.company_id, keyword.slice(0, 120), reply.slice(0, 1000), U.nowISO());
  logAction(ctx, 'wa.rule.create', keyword);
  backWith(ctx, res, `Aturan balasan "${keyword}" ditambahkan.`, 'success', '/whatsapp');
}));

app.post('/whatsapp/rules/:id/toggle', guard('wa_write'), route((req, res) => {
  const ctx = req.ctx;
  const rule = db.prepare('SELECT * FROM wa_autoreplies WHERE id = ?').get(Number(req.params.id));
  if (!rule) return backWith(ctx, res, 'Aturan tidak ditemukan.', 'error', '/whatsapp');
  db.prepare('UPDATE wa_autoreplies SET active = ? WHERE id = ?').run(rule.active ? 0 : 1, rule.id);
  backWith(ctx, res, `Aturan "${rule.keyword}" ${rule.active ? 'dinonaktifkan' : 'diaktifkan'}.`, 'success', '/whatsapp');
}));

app.post('/whatsapp/rules/:id/delete', guard('wa_write'), route((req, res) => {
  const ctx = req.ctx;
  db.prepare('DELETE FROM wa_autoreplies WHERE id = ?').run(Number(req.params.id));
  backWith(ctx, res, 'Aturan balasan dihapus.', 'success', '/whatsapp');
}));

app.post('/whatsapp/settings', guard('wa_write'), route((req, res) => {
  const ctx = req.ctx;
  const provider = WA_PROVIDERS.includes(req.body.wa_provider) ? req.body.wa_provider : 'none';
  const patch = {
    wa_provider: provider,
    wa_phone_id: String(req.body.wa_phone_id || '').slice(0, 60),
    wa_api_url: String(req.body.wa_api_url || '').slice(0, 200),
    wa_verify_token: String(req.body.wa_verify_token || '').slice(0, 120),
    wa_notify_receipt: req.body.wa_notify_receipt === '0' ? '0' : '1',
    wa_notify_member: req.body.wa_notify_member === '0' ? '0' : '1',
    wa_auto_reply: req.body.wa_auto_reply === '0' ? '0' : '1',
  };
  if (req.body.brand_name !== undefined) patch.brand_name = String(req.body.brand_name).trim().slice(0, 60);
  if (req.body.wa_token) patch.wa_token = String(req.body.wa_token).trim().slice(0, 500);
  if (req.body.wa_app_secret) patch.wa_app_secret = String(req.body.wa_app_secret).trim().slice(0, 200);
  settings.setMany(db, patch);
  logAction(ctx, 'wa.settings', `provider ${provider}`);
  backWith(ctx, res, 'Pengaturan WhatsApp disimpan.', 'success', '/whatsapp');
}));

const WA_PROVIDERS = Object.keys(wa.PROVIDERS);

// ---------- Pengiriman ----------
app.get('/shipping', guard('shipping_read'), route(async (req, res) => {
  const ctx = req.ctx;
  const companyId = ctx.selectedCompanyId || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  const originCompanies = ctx.companies.filter((c) => ctx.allowedIds.has(c.id) && (c.level === 'outlet' || c.level === 'unit'));
  const rateQuery = {
    area: String(req.query.area || '').slice(0, 80),
    weight: Number(req.query.weight) || 1000,
    value: Number(req.query.value) || 100000,
    companyId: Number(req.query.company_id) || companyId,
    name: String(req.query.name || '').slice(0, 80),
    phone: String(req.query.phone || '').slice(0, 30),
    address: String(req.query.address || '').slice(0, 200),
    saleId: Number(req.query.sale_id) || null,
  };
  let rateResult = null;
  if (rateQuery.area) {
    const origin = shipping.originOf(db, rateQuery.companyId);
    rateResult = await shipping.rates(db, {
      destinationArea: rateQuery.area,
      weight: rateQuery.weight,
      value: rateQuery.value,
      originZip: origin ? origin.origin_zip : null,
    });
  }
  const shipmentId = Number(req.query.shipment) || null;
  const detail = shipmentId ? shipping.detail(db, shipmentId) : null;
  if (detail && !ctx.allowedIds.has(detail.company_id)) {
    return forbidden(ctx, res);
  }
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const sales = db.prepare(`SELECT s.id, s.invoice_no, s.total, s.sold_at, c.name customer_name, c.phone, c.id customer_id
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.status='paid' AND s.company_id IN (${ph}) ORDER BY s.id DESC LIMIT 25`).all(...ctx.scopeIds);

  res.send(shippingPage(ctx, {
    mode: shipping.mode(db),
    stats: shipping.stats(db, ctx.scopeIds),
    shipments: shipping.list(db, ctx.scopeIds, { status: req.query.status || 'all', q: req.query.q || '' }),
    detail,
    rateResult,
    rateQuery,
    courierOptions: shipping.courierList(db),
    originCompanies,
    sales,
    selectedSale: rateQuery.saleId,
    manualRates: db.prepare('SELECT * FROM shipping_rates ORDER BY dest_area, courier').all(),
    webhookUrl: shippingWebhookUrl(req),
  }));
}));

app.post('/shipping/create', guard('shipping_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const companyId = Number(req.body.company_id) || (ctx.scopeCompany ? ctx.scopeCompany.id : ctx.scopeIds[0]);
  if (!ctx.allowedIds.has(companyId)) {
    return backWith(ctx, res, 'Entitas pengiriman tidak valid.', 'error', '/shipping');
  }
  const courier = String(req.body.courier || '').trim();
  if (!courier) return backWith(ctx, res, 'Pilih kurir terlebih dahulu.', 'error', '/shipping');
  const saleId = Number(req.body.sale_id) || null;
  const result = shipping.createShipment(db, {
    companyId,
    saleId,
    courier,
    service: String(req.body.service || 'REG').slice(0, 40),
    cost: Number(req.body.cost) || 0,
    weight: Number(req.body.weight) || 1000,
    destName: String(req.body.dest_name || '').slice(0, 80) || null,
    destPhone: String(req.body.dest_phone || '').slice(0, 30) || null,
    destArea: String(req.body.dest_area || '').slice(0, 80) || null,
    destAddress: String(req.body.dest_address || '').slice(0, 240) || null,
    note: 'Dibuat dari halaman pengiriman',
    userId: ctx.user.id,
  });
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(result.id);
  const push = await shipping.pushToProvider(db, shipment);
  logAction(ctx, 'shipping.create', `${result.awb} · ${courier} · ${U.idr(Number(req.body.cost) || 0)}`);

  // notifikasi resi ke pelanggan lewat WhatsApp (bila ada nomor & opt-in)
  let waNote = '';
  const cust = shipment.sale_id
    ? db.prepare(`SELECT c.phone, c.name, c.wa_opt_in, s.invoice_no FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`).get(shipment.sale_id)
    : null;
  if (cust && cust.phone) {
    const body = `Halo ${String(cust.name).split(' ')[0]}! Pesanan ${cust.invoice_no || ''} sudah kami serahkan ke ${shipping.COURIERS[courier] || courier} ${shipment.service || ''}.\nNo. resi: ${result.awb}\nLacak: kirim kata TRACK ${result.awb} ke nomor ini.`;
    const sent = await wa.send(db, {
      to: cust.phone, body, name: cust.name, companyId,
      isBot: true, relatedType: 'shipment', relatedId: result.id,
    });
    waNote = sent.ok ? ' Notifikasi resi dikirim ke pelanggan.' : ` Notifikasi resi gagal: ${sent.error}`;
  }

  backWith(ctx, res,
    `Pengiriman ${result.awb} dibuat${push.simulated ? ' (tracking simulasi)' : ' dan diteruskan ke kurir'}.${waNote}`,
    push.error ? 'error' : 'success', `/shipping?shipment=${result.id}`);
}));

app.post('/shipping/:id/sync', guard('shipping_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(Number(req.params.id));
  if (!shipment || !ctx.allowedIds.has(shipment.company_id)) return backWith(ctx, res, 'Pengiriman tidak ditemukan.', 'error', '/shipping');
  const result = await shipping.syncTracking(db, shipment.id);
  if (result.error) return backWith(ctx, res, `Tracking gagal: ${result.error}`, 'error', `/shipping?shipment=${shipment.id}`);
  logAction(ctx, 'shipping.sync', `${shipment.awb} · ${result.live ? 'live' : 'simulasi'} · ${result.added} event`);
  backWith(ctx, res,
    result.live
      ? `Tracking diperbarui dari kurir (${result.added} event baru).`
      : (result.added ? `Tracking disimulasikan: ${result.added} event baru.` : 'Belum ada perubahan status baru.'),
    'success', `/shipping?shipment=${shipment.id}`);
}));

app.post('/shipping/:id/status', guard('shipping_write'), route((req, res) => {
  const ctx = req.ctx;
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(Number(req.params.id));
  if (!shipment || !ctx.allowedIds.has(shipment.company_id)) return backWith(ctx, res, 'Pengiriman tidak ditemukan.', 'error', '/shipping');
  const result = shipping.setStatus(db, shipment.id, String(req.body.status || ''), 'Diubah manual oleh ' + ctx.user.name);
  if (result.error) return backWith(ctx, res, result.error, 'error', `/shipping?shipment=${shipment.id}`);
  logAction(ctx, 'shipping.status', `${shipment.awb} · ${req.body.status}`);
  backWith(ctx, res, `Status pengiriman diperbarui menjadi ${shipping.STATUS[req.body.status].label}.`, 'success', `/shipping?shipment=${shipment.id}`);
}));

app.post('/shipping/settings', guard('shipping_write'), route((req, res) => {
  const ctx = req.ctx;
  const provider = Object.keys(shipping.PROVIDERS).includes(req.body.ship_provider) ? req.body.ship_provider : 'manual';
  const patch = {
    ship_provider: provider,
    ship_base_url: String(req.body.ship_base_url || '').slice(0, 200),
    ship_couriers: String(req.body.ship_couriers || 'jne,jnt,sicepat').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 12).join(','),
  };
  if (req.body.ship_api_key) patch.ship_api_key = String(req.body.ship_api_key).trim().slice(0, 300);
  settings.setMany(db, patch);
  logAction(ctx, 'shipping.settings', `provider ${provider}`);
  backWith(ctx, res, `Pengaturan pengiriman disimpan (provider: ${shipping.PROVIDERS[provider].label}).`, 'success', '/shipping');
}));

app.post('/shipping/rates', guard('shipping_write'), route((req, res) => {
  const ctx = req.ctx;
  const area = String(req.body.dest_area || '').trim();
  const courier = String(req.body.courier || '').trim();
  if (!area || !courier) return backWith(ctx, res, 'Kota dan kurir wajib diisi.', 'error', '/shipping');
  db.prepare(`INSERT INTO shipping_rates (company_id, dest_area, courier, service, base_price, price_per_kg, eta_text, active)
    VALUES (?,?,?,?,?,?,?,1)`)
    .run(ctx.selectedCompanyId || null, area.slice(0, 80), courier, String(req.body.service || 'REG').slice(0, 40),
      Number(req.body.base_price) || 0, Number(req.body.price_per_kg) || 0, String(req.body.eta_text || '').slice(0, 40) || null);
  logAction(ctx, 'shipping.rate.create', `${area} · ${courier}`);
  backWith(ctx, res, `Tarif ${area} (${courier}) disimpan.`, 'success', '/shipping');
}));

app.post('/shipping/rates/:id/delete', guard('shipping_write'), route((req, res) => {
  const ctx = req.ctx;
  db.prepare('DELETE FROM shipping_rates WHERE id = ?').run(Number(req.params.id));
  backWith(ctx, res, 'Tarif dihapus.', 'success', '/shipping');
}));

// ---------- Pengaturan integrasi terpusat ----------
function webhookList(req) {
  const base = req.headers['x-public-base-path'] || '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const root = `${proto}://${host}${base}`;
  return [
    { name: 'WhatsApp (inbound)', description: 'Pesan masuk, verifikasi Meta, balasan otomatis', url: `${root}/webhooks/whatsapp`, auth: 'Token / signature' },
    { name: 'Status kurir', description: 'Update tracking dari provider pengiriman', url: `${root}/webhooks/shipping`, auth: 'Publik' },
    { name: 'Email laporan (outbound)', description: 'Bila memakai provider "webhook email"', url: settings.get(db, 'mail_webhook_url') || '—', auth: 'URL rahasia' },
  ];
}

app.get('/settings/integrations', guard('integration_read'), route((req, res) => {
  const ctx = req.ctx;
  const testResult = req.query.test
    ? { ok: req.query.test === 'ok', msg: String(req.query.msg || (req.query.test === 'ok' ? 'Uji berhasil.' : 'Uji gagal.')) }
    : null;
  res.send(integrationsPage(ctx, {
    waMode: wa.mode(db),
    mailMode: mailer.mode(db),
    shipMode: shipping.mode(db),
    webhooks: webhookList(req),
    lastUpdated: db.prepare("SELECT MAX(updated_at) v FROM settings WHERE key LIKE 'wa_%' OR key LIKE 'mail_%' OR key LIKE 'ship_%'").get().v,
    testResult,
    origins: db.prepare('SELECT name, origin_area, origin_zip FROM companies WHERE origin_area IS NOT NULL ORDER BY name').all(),
  }));
}));

app.post('/integrations/wa', guard('integration_write'), route((req, res) => {
  const ctx = req.ctx;
  const provider = Object.keys(wa.PROVIDERS).includes(req.body.wa_provider) ? req.body.wa_provider : 'none';
  const patch = {
    wa_provider: provider,
    wa_phone_id: String(req.body.wa_phone_id || '').slice(0, 60),
    wa_api_url: String(req.body.wa_api_url || '').slice(0, 200),
    wa_verify_token: String(req.body.wa_verify_token || '').slice(0, 120),
    wa_notify_receipt: req.body.wa_notify_receipt === '0' ? '0' : '1',
    wa_auto_reply: req.body.wa_auto_reply === '0' ? '0' : '1',
  };
  if (req.body.brand_name !== undefined) patch.brand_name = String(req.body.brand_name).trim().slice(0, 60);
  if (req.body.wa_token) patch.wa_token = String(req.body.wa_token).trim().slice(0, 500);
  if (req.body.wa_app_secret) patch.wa_app_secret = String(req.body.wa_app_secret).trim().slice(0, 200);
  settings.setMany(db, patch);
  logAction(ctx, 'integration.wa', `provider ${provider}`);
  backWith(ctx, res, `Pengaturan WhatsApp disimpan (${wa.PROVIDERS[provider].label}).`, 'success', '/settings/integrations');
}));

app.post('/integrations/mail', guard('integration_write'), route((req, res) => {
  const ctx = req.ctx;
  const provider = Object.keys(mailer.PROVIDERS).includes(req.body.mail_provider) ? req.body.mail_provider : 'none';
  const patch = {
    mail_provider: provider,
    mail_from: String(req.body.mail_from || '').slice(0, 120),
    mail_reply_to: String(req.body.mail_reply_to || '').slice(0, 120),
    mail_domain: String(req.body.mail_domain || '').slice(0, 120),
    mail_webhook_url: String(req.body.mail_webhook_url || '').slice(0, 300),
  };
  if (req.body.mail_api_key) patch.mail_api_key = String(req.body.mail_api_key).trim().slice(0, 400);
  settings.setMany(db, patch);
  logAction(ctx, 'integration.mail', `provider ${provider}`);
  backWith(ctx, res, `Pengaturan email disimpan (${mailer.PROVIDERS[provider].label}).`, 'success', '/settings/integrations');
}));

app.post('/integrations/shipping', guard('integration_write'), route((req, res) => {
  const ctx = req.ctx;
  const provider = Object.keys(shipping.PROVIDERS).includes(req.body.ship_provider) ? req.body.ship_provider : 'manual';
  const patch = {
    ship_provider: provider,
    ship_base_url: String(req.body.ship_base_url || '').slice(0, 200),
    ship_couriers: String(req.body.ship_couriers || 'jne,jnt,sicepat').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 12).join(','),
  };
  if (req.body.ship_api_key) patch.ship_api_key = String(req.body.ship_api_key).trim().slice(0, 300);
  settings.setMany(db, patch);
  logAction(ctx, 'integration.shipping', `provider ${provider}`);
  backWith(ctx, res, `Pengaturan pengiriman disimpan (${shipping.PROVIDERS[provider].label}).`, 'success', '/settings/integrations');
}));

// ---------- Pengaturan kasir: QRIS + struk thermal ----------
app.get('/settings/pos', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const mode = qris.mode(db);
  const paper = ticketLib.paperWidth(db);
  const ids = ctx.scopeIds;
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const lastPayments = db.prepare(`SELECT * FROM payments WHERE company_id IN (${ph}) ORDER BY id DESC LIMIT 12`).all(...ids);
  const stats = db.prepare(`SELECT status, COUNT(*) c, COALESCE(SUM(amount),0) total FROM payments
    WHERE company_id IN (${ph}) GROUP BY status`).all(...ids);
  const qrisStats = {
    paid: (stats.find((r) => r.status === 'paid') || {}).c || 0,
    pending: (stats.find((r) => r.status === 'pending') || {}).c || 0,
    failed: stats.filter((r) => ['failed', 'expired', 'cancelled'].includes(r.status)).reduce((a, r) => a + r.c, 0),
    value: (stats.find((r) => r.status === 'paid') || {}).total || 0,
  };
  res.send(settingsPosPage(ctx, {
    mode,
    paper,
    lastPayments,
    qrisStats,
    webhookUrl: `${publicBaseUrl(req)}/webhooks/qris`,
  }));
}));

// ---------- Settings → Master Data POS (jenis menu, kategori, metode bayar, tier, kanal) ----------
app.get('/settings/pos/master', guard('pos_read'), route((req, res) => {
  const ctx = req.ctx;
  const groups = {};
  for (const kind of Object.keys(posOptions.KINDS)) groups[kind] = posOptions.summary(db, kind);

  const ids = ctx.scopeIds;
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const productCount = db.prepare(`SELECT COUNT(*) c FROM products WHERE active = 1 AND company_id IN (${ph})`).get(...ids).c;
  const categoryTop = db.prepare(`SELECT COUNT(DISTINCT category) c FROM products
    WHERE active = 1 AND category IS NOT NULL AND category != '' AND company_id IN (${ph})`).get(...ids).c;
  const perCompany = db.prepare(`SELECT company_id, COUNT(*) c FROM products WHERE active = 1
    AND company_id IN (${ph}) GROUP BY company_id`).all(...ids);
  const productKinds = {};
  for (const row of perCompany) productKinds[row.company_id] = row.c;

  const outlets = ctx.allowedCompanies.filter((c) => c.level === 'outlet' || c.level === 'unit');
  res.send(posMasterPage(ctx, { groups, outlets, productCount, productKinds, categoryTop }));
}));

app.post('/settings/pos/master/save', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const kind = String(req.body.kind || '');
  if (!posOptions.KINDS[kind]) return backWith(ctx, res, 'Jenis master data tidak dikenal.', 'error', '/settings/pos/master');
  const out = posOptions.save(db, kind, {
    id: Number(req.body.id) || 0,
    code: req.body.code,
    label: req.body.label,
    icon: req.body.icon,
    sort_order: req.body.sort_order === '' || req.body.sort_order === undefined ? undefined : Number(req.body.sort_order),
    tracks_stock: req.body.tracks_stock === '1' ? 1 : 0,
    active: req.body.active === undefined ? (req.body.id ? 1 : 1) : Number(req.body.active),
  });
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/settings/pos/master');
  const label = posOptions.KINDS[kind].label;
  logAction(ctx, 'pos.master.save', `${kind} · ${String(req.body.label || '').slice(0, 40)}`);
  const extra = out.renamed ? ` ${U.num(out.renamed)} produk ikut diperbarui.` : '';
  backWith(ctx, res, `${label} disimpan.${extra}`, 'success', '/settings/pos/master');
}));

app.post('/settings/pos/master/:id/toggle', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const row = db.prepare('SELECT * FROM pos_options WHERE id = ?').get(Number(req.params.id));
  if (!row) return backWith(ctx, res, 'Data tidak ditemukan.', 'error', '/settings/pos/master');
  const out = posOptions.setActive(db, row.id, !row.active);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/settings/pos/master');
  logAction(ctx, 'pos.master.toggle', `${row.kind} · ${row.code} → ${row.active ? 'nonaktif' : 'aktif'}`);
  backWith(ctx, res, `${row.label} ${row.active ? 'dinonaktifkan' : 'diaktifkan'}.`, 'success', '/settings/pos/master');
}));

app.post('/settings/pos/master/:id/delete', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  const out = posOptions.remove(db, Number(req.params.id));
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/settings/pos/master');
  logAction(ctx, 'pos.master.delete', `${out.row.kind} · ${out.row.code}`);
  backWith(ctx, res, `${out.row.label} dihapus.`, 'success', '/settings/pos/master');
}));

app.post('/settings/pos/qris', guard('integration_write'), route((req, res) => {
  const ctx = req.ctx;
  const provider = qris.PROVIDERS[req.body.qris_provider] ? req.body.qris_provider : 'static';
  const minutes = Math.max(1, Math.min(120, Number(req.body.qris_expiry_minutes) || 15));
  const patch = {
    qris_provider: provider,
    qris_static_payload: String(req.body.qris_static_payload || '').replace(/\s+/g, ' ').trim().slice(0, 800),
    qris_expiry_minutes: String(minutes),
    qris_midtrans_acquirer: String(req.body.qris_midtrans_acquirer || 'gopay').trim().slice(0, 30) || 'gopay',
    qris_midtrans_production: req.body.qris_midtrans_production === '1' ? '1' : '0',
    qris_xendit_callback_token: String(req.body.qris_xendit_callback_token || '').trim().slice(0, 200),
  };
  if (req.body.qris_midtrans_server_key) patch.qris_midtrans_server_key = String(req.body.qris_midtrans_server_key).trim().slice(0, 400);
  if (req.body.qris_xendit_secret_key) patch.qris_xendit_secret_key = String(req.body.qris_xendit_secret_key).trim().slice(0, 400);
  if (req.body.clear_keys === '1') {
    patch.qris_midtrans_server_key = '';
    patch.qris_xendit_secret_key = '';
  }
  settings.setMany(db, patch);

  // beri umpan balik langsung: payload statis divalidasi (CRC + tag wajib)
  let note = '';
  const payload = patch.qris_static_payload;
  if (payload) {
    const check = qris.validate(payload);
    note = check.ok ? ` QRIS merchant "${check.merchant}" valid.` : ` Payload QRIS belum valid: ${check.error}`;
  }
  logAction(ctx, 'settings.pos.qris', `${provider}${note ? ' · ' + note.trim() : ''}`.slice(0, 380));
  const ok = !payload || qris.validate(payload).ok;
  backWith(ctx, res, `Pengaturan QRIS disimpan (${qris.PROVIDERS[provider].label}).${note}`, ok ? 'success' : 'error', '/settings/pos');
}));

app.post('/settings/pos/receipt', guard('pos_write'), route((req, res) => {
  const ctx = req.ctx;
  settings.setMany(db, {
    receipt_width: String(req.body.receipt_width) === '80' ? '80' : '58',
    receipt_auto_print: req.body.receipt_auto_print === '1' ? '1' : '0',
    receipt_show_qris: req.body.receipt_show_qris === '1' ? '1' : '0',
    receipt_header: String(req.body.receipt_header || '').trim().slice(0, 120),
    receipt_footer: String(req.body.receipt_footer || '').trim().slice(0, 200),
  });
  logAction(ctx, 'settings.pos.receipt', `${settings.get(db, 'receipt_width')}mm · auto ${settings.get(db, 'receipt_auto_print')}`);
  backWith(ctx, res, 'Pengaturan struk disimpan.', 'success', '/settings/pos');
}));

app.post('/integrations/report', guard('integration_write'), route((req, res) => {
  const ctx = req.ctx;
  const time = /^\d{2}:\d{2}$/.test(req.body.report_time || '') ? req.body.report_time : '07:00';
  settings.setMany(db, {
    report_enabled: req.body.report_enabled === '0' ? '0' : '1',
    report_time: time,
    report_channel: ['whatsapp', 'email', 'both'].includes(req.body.report_channel) ? req.body.report_channel : 'whatsapp',
    report_phones: String(req.body.report_phones || '').slice(0, 400),
    report_emails: String(req.body.report_emails || '').slice(0, 400),
  });
  logAction(ctx, 'integration.report', `${time} · ${req.body.report_channel}`);
  backWith(ctx, res, `Jadwal laporan disimpan: setiap hari ${time} WIB.`, 'success', '/settings/integrations');
}));

app.post('/integrations/test', guard('integration_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const kind = String(req.body.kind || 'whatsapp');
  const base = ctx.base;
  const back = (ok, msg) => res.redirect(`${base}/settings/integrations?test=${ok ? 'ok' : 'fail'}&msg=${encodeURIComponent(msg)}`);

  if (kind === 'whatsapp') {
    const to = settings.get(db, 'report_phones', '').split(',')[0] || '081200000000';
    const result = await wa.send(db, { to, body: 'Uji koneksi BizDash: integrasi WhatsApp berfungsi.', isBot: true, relatedType: 'test' });
    logAction(ctx, 'integration.test.wa', result.ok ? (result.simulated ? 'simulasi' : 'terkirim') : result.error);
    if (!result.ok) return back(false, `WhatsApp gagal: ${result.error}`);
    return back(true, result.simulated
      ? 'WhatsApp tersimpan sebagai simulasi (kredensial belum diisi). Pesan tetap tercatat di kotak keluar.'
      : 'Pesan uji WhatsApp berhasil dikirim.');
  }
  if (kind === 'email') {
    const to = settings.get(db, 'report_emails', '') || settings.get(db, 'mail_from', '');
    const result = await mailer.send(db, { to, subject: 'Uji koneksi BizDash', text: 'Integrasi email berfungsi.', html: '<p>Integrasi email berfungsi.</p>' });
    logAction(ctx, 'integration.test.mail', result.ok ? (result.simulated ? 'simulasi' : 'terkirim') : result.error);
    if (!result.ok) return back(false, `Email gagal: ${result.error}`);
    return back(true, result.simulated ? 'Email tersimpan sebagai simulasi (provider belum diisi).' : `Email uji terkirim ke ${to}.`);
  }
  if (kind === 'shipping') {
    const test = await shipping.rates(db, { destinationArea: 'Bandung', weight: 1000 });
    logAction(ctx, 'integration.test.ship', `${test.live ? 'live' : 'manual'} · ${test.rates.length} layanan`);
    return back(true, test.live
      ? `Tarif live aktif (${test.rates.length} layanan dari ${test.source}).`
      : `Menggunakan tarif manual (${test.rates.length} layanan). Isi API key untuk tarif real-time.`);
  }
  return back(false, 'Jenis uji tidak dikenal.');
}));

// ---------- Struktur organisasi (entitas + jabatan) ----------
function structureData(ctx, query = {}) {
  const companies = ctx.allowedCompanies.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  const allowed = new Set(companies.map((c) => c.id));
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const childrenOf = new Map();
  for (const c of companies) {
    if (!childrenOf.has(c.parent_id)) childrenOf.set(c.parent_id, []);
    childrenOf.get(c.parent_id).push(c);
  }
  const descendantsOf = (id) => {
    const out = new Set([id]);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const child of childrenOf.get(cur) || []) {
        if (!out.has(child.id)) { out.add(child.id); stack.push(child.id); }
      }
    }
    return out;
  };

  const positions = db.prepare(`SELECT * FROM positions WHERE company_id IN (${[...allowed].map(() => '?').join(',') || 'NULL'})
    ORDER BY sort_order, id`).all(...allowed);
  const positionMap = new Map(positions.map((p) => [p.id, p]));
  const byCompany = new Map();
  for (const p of positions) {
    if (!byCompany.has(p.company_id)) byCompany.set(p.company_id, []);
    byCompany.get(p.company_id).push(p);
  }

  const users = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.company_id, u.position_id, u.manager_id,
      u.hourly_rate, u.job_title, u.photo_url, c.name company_name
    FROM users u LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.company_id IN (${[...allowed].map(() => '?').join(',') || 'NULL'})
    ORDER BY u.name`).all(...allowed);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const usersByPosition = new Map();
  for (const u of users) {
    if (!u.position_id) continue;
    if (!usersByPosition.has(u.position_id)) usersByPosition.set(u.position_id, []);
    usersByPosition.get(u.position_id).push(u);
  }
  const people = users.map((u) => ({
    ...u,
    position_name: u.position_id && positionMap.get(u.position_id) ? positionMap.get(u.position_id).name : '',
    manager_name: u.manager_id && userMap.get(u.manager_id) ? userMap.get(u.manager_id).name : '',
  }));

  const ph = [...allowed].map(() => '?').join(',') || 'NULL';
  const revenue = new Map(db.prepare(`SELECT company_id, COALESCE(SUM(total),0) v FROM sales
    WHERE status = 'paid' AND substr(sold_at,1,7) = ? AND company_id IN (${ph}) GROUP BY company_id`)
    .all(ctx.month, ...allowed).map((r) => [r.company_id, r.v]));

  const tree = [];
  const pushRow = (c, depth) => tree.push({
    company: c,
    depth,
    outlets: (childrenOf.get(c.id) || []).filter((x) => x.level === 'outlet').length,
    users: users.filter((u) => u.company_id === c.id).length,
    positions: (byCompany.get(c.id) || []).length,
    revenue: revenue.get(c.id) || 0,
  });
  const walk = (company, depth) => {
    pushRow(company, depth);
    for (const child of childrenOf.get(company.id) || []) walk(child, depth + 1);
  };
  // Akar = entitas yang induknya tidak terlihat (mis. manajer hanya melihat subtree-nya).
  const roots = companies.filter((c) => !c.parent_id || !companyMap.has(c.parent_id));
  for (const root of roots) walk(root, 0);
  if (!tree.length && companies.length) {
    const only = companies[0];
    tree.push({
      company: only,
      depth: 0,
      outlets: (childrenOf.get(only.id) || []).filter((x) => x.level === 'outlet').length,
      users: users.filter((u) => u.company_id === only.id).length,
      positions: (byCompany.get(only.id) || []).length,
      revenue: revenue.get(only.id) || 0,
    });
  }

  // Mode peta pohon: 'company' (entitas) atau 'position' (jabatan per entitas).
  const chartMode = query.tree === 'position' ? 'position' : 'company';
  const requestedChart = Number(query.company) || 0;
  const chartCompanyId = allowed.has(requestedChart) ? requestedChart
    : (ctx.selectedCompanyId && allowed.has(ctx.selectedCompanyId) ? ctx.selectedCompanyId
      : (allowed.has(ctx.user.company_id) ? ctx.user.company_id
        : (companies[0] || { id: 0 }).id));

  return {
    companies,
    companyMap,
    tree,
    chartMode,
    chartCompanyId,
    descendantIdsOf: descendantsOf,
    positions,
    positionMap,
    byCompany,
    users,
    people,
    usersByPosition,
    canWrite: auth.can(ctx.user, 'structure_write'),
    canMove: ctx.user.role === 'owner',
    stats: {
      companies: companies.length,
      positions: positions.length,
      positionsUnassigned: positions.filter((p) => !(usersByPosition.get(p.id) || []).length).length,
      users: users.length,
      outlets: companies.filter((c) => c.level === 'outlet').length,
    },
  };
}

app.get('/structure', guard('structure_read'), route((req, res) => {
  const ctx = req.ctx;
  res.send(structurePage(ctx, structureData(ctx, req.query)));
}));

// Simpan entitas: buat baru atau perbarui (nama, tingkat, induk, kontak).
app.post('/structure/company/save', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const id = Number(req.body.id) || null;
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama entitas wajib diisi.', 'error', '/structure');
  const level = ['holding', 'unit', 'outlet'].includes(req.body.level) ? req.body.level : 'outlet';
  const kind = ['outlet', 'roastery', 'kitchen', 'office', 'warehouse'].includes(req.body.kind) ? req.body.kind : 'outlet';
  const code = String(req.body.code || '').trim().toUpperCase().slice(0, 12) || null;
  const phone = String(req.body.phone || '').trim().slice(0, 30) || null;
  const address = String(req.body.address || '').trim().slice(0, 160) || null;
  const sortOrder = Number(req.body.sort_order) || 0;
  // Asal pengiriman (dipakai cek ongkir & label resi) — sebelumnya hanya diisi seed demo.
  const originArea = String(req.body.origin_area || '').trim().slice(0, 60) || null;
  const originCity = String(req.body.origin_city || '').trim().slice(0, 60) || null;
  const originZip = String(req.body.origin_zip || '').trim().slice(0, 12) || null;
  const originPhone = String(req.body.origin_phone || '').trim().slice(0, 30) || null;
  let parentId = Number(req.body.parent_id) || null;
  if (parentId && !ctx.allowedIds.has(parentId)) return backWith(ctx, res, 'Entitas induk di luar cakupan Anda.', 'error', '/structure');
  if (code && db.prepare('SELECT id FROM companies WHERE upper(code) = ? AND id != ?').get(code, id || 0)) {
    return backWith(ctx, res, `Kode ${code} sudah dipakai entitas lain.`, 'error', '/structure');
  }

  if (id) {
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!existing || !ctx.allowedIds.has(id)) return backWith(ctx, res, 'Entitas tidak ditemukan dalam cakupan Anda.', 'error', '/structure');
    const canMove = ctx.user.role === 'owner';
    if (!canMove && parentId !== existing.parent_id) {
      return backWith(ctx, res, 'Hanya owner yang dapat memindahkan entitas ke induk lain.', 'error', '/structure');
    }
    // Cegah siklus: induk tidak boleh dirinya sendiri atau turunannya.
    if (parentId) {
      const data = structureData(ctx);
      if (data.descendantIdsOf(id).has(parentId)) {
        return backWith(ctx, res, 'Induk tidak boleh entitas itu sendiri atau turunannya.', 'error', '/structure');
      }
    }
    db.prepare(`UPDATE companies SET name = ?, code = ?, level = ?, kind = ?, parent_id = ?, phone = ?, address = ?, sort_order = ?,
        origin_area = ?, origin_city = ?, origin_zip = ?, origin_phone = ?
      WHERE id = ?`).run(name, code, level, kind, parentId, phone, address, sortOrder,
      originArea, originCity, originZip, originPhone, id);
    logAction(ctx, 'structure.company.update', `${name} · ${level}${parentId ? ' · induk #' + parentId : ''}`);
    return backWith(ctx, res, `Entitas "${name}" diperbarui.`, 'success', '/structure');
  }

  if (parentId && !ctx.allowedIds.has(parentId)) return backWith(ctx, res, 'Entitas induk tidak valid.', 'error', '/structure');
  const newId = db.prepare(`INSERT INTO companies (name, code, parent_id, level, kind, phone, address, sort_order,
      origin_area, origin_city, origin_zip, origin_phone, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(name, code, parentId, level, kind, phone, address, sortOrder,
      originArea, originCity, originZip, originPhone, U.nowISO()).lastInsertRowid;
  logAction(ctx, 'structure.company.create', `${name} · ${level}`);
  backWith(ctx, res, `Entitas "${name}" ditambahkan. Lengkapi jabatannya di bawah.`, 'success', '/structure');
}));

app.post('/structure/company/:id/delete', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(Number(req.params.id));
  if (!company || !ctx.allowedIds.has(company.id)) return backWith(ctx, res, 'Entitas tidak ditemukan.', 'error', '/structure');
  if (!company.parent_id) return backWith(ctx, res, 'Entitas induk utama tidak dapat dihapus.', 'error', '/structure');
  const children = db.prepare('SELECT COUNT(*) c FROM companies WHERE parent_id = ?').get(company.id).c;
  if (children) return backWith(ctx, res, 'Pindahkan atau hapus entitas turunan terlebih dahulu.', 'error', '/structure');
  const sales = db.prepare('SELECT COUNT(*) c FROM sales WHERE company_id = ?').get(company.id).c;
  const users = db.prepare('SELECT COUNT(*) c FROM users WHERE company_id = ?').get(company.id).c;
  if (sales || users) return backWith(ctx, res, 'Entitas masih memiliki pengguna atau data penjualan sehingga tidak dapat dihapus.', 'error', '/structure');
  db.prepare('DELETE FROM positions WHERE company_id = ?').run(company.id);
  db.prepare('DELETE FROM companies WHERE id = ?').run(company.id);
  logAction(ctx, 'structure.company.delete', company.name);
  backWith(ctx, res, `Entitas "${company.name}" dihapus.`, 'success', '/structure');
}));

app.post('/structure/position/save', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const id = Number(req.body.id) || null;
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama jabatan wajib diisi.', 'error', '/structure');
  const level = ['owner', 'director', 'manager', 'supervisor', 'staff'].includes(req.body.level) ? req.body.level : 'staff';
  const companyId = Number(req.body.company_id) || ctx.user.company_id;
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas jabatan di luar cakupan Anda.', 'error', '/structure');
  const parentId = Number(req.body.parent_id) || null;
  if (parentId) {
    const parent = db.prepare('SELECT * FROM positions WHERE id = ?').get(parentId);
    if (!parent || !ctx.allowedIds.has(parent.company_id)) return backWith(ctx, res, 'Atasan jabatan tidak valid.', 'error', '/structure');
    if (id && parentId === id) return backWith(ctx, res, 'Jabatan tidak boleh menjadi atasannya sendiri.', 'error', '/structure');
    // tolak siklus jabatan
    if (id) {
      let cur = parent;
      let guard = 0;
      while (cur && cur.parent_id && guard++ < 30) {
        if (cur.parent_id === id) return backWith(ctx, res, 'Atasan jabatan membentuk siklus.', 'error', '/structure');
        cur = db.prepare('SELECT * FROM positions WHERE id = ?').get(cur.parent_id);
      }
    }
  }
  const sortOrder = Number(req.body.sort_order) || 0;
  if (id) {
    const existing = db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
    if (!existing || !ctx.allowedIds.has(existing.company_id)) return backWith(ctx, res, 'Jabatan tidak ditemukan.', 'error', '/structure');
    db.prepare('UPDATE positions SET name = ?, level = ?, company_id = ?, parent_id = ?, sort_order = ? WHERE id = ?')
      .run(name, level, companyId, parentId, sortOrder, id);
    logAction(ctx, 'structure.position.update', `${name} · ${level}`);
    return backWith(ctx, res, `Jabatan "${name}" diperbarui.`, 'success', '/structure');
  }
  db.prepare('INSERT INTO positions (company_id, name, level, parent_id, sort_order, active, created_at) VALUES (?,?,?,?,?,1,?)')
    .run(companyId, name, level, parentId, sortOrder, U.nowISO());
  logAction(ctx, 'structure.position.create', `${name} · ${level}`);
  backWith(ctx, res, `Jabatan "${name}" ditambahkan.`, 'success', '/structure');
}));

app.post('/structure/position/:id/delete', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(Number(req.params.id));
  if (!position || !ctx.allowedIds.has(position.company_id)) return backWith(ctx, res, 'Jabatan tidak ditemukan.', 'error', '/structure');
  const holders = db.prepare('SELECT COUNT(*) c FROM users WHERE position_id = ?').get(position.id).c;
  if (holders) return backWith(ctx, res, 'Pindahkan pemegang jabatan terlebih dahulu sebelum menghapus.', 'error', '/structure');
  db.prepare('UPDATE positions SET parent_id = NULL WHERE parent_id = ?').run(position.id);
  db.prepare('DELETE FROM positions WHERE id = ?').run(position.id);
  logAction(ctx, 'structure.position.delete', position.name);
  backWith(ctx, res, `Jabatan "${position.name}" dihapus.`, 'success', '/structure');
}));

app.post('/structure/assign', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const userId = Number(req.body.user_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || !ctx.allowedIds.has(user.company_id)) return backWith(ctx, res, 'Pengguna tidak ditemukan dalam cakupan Anda.', 'error', '/structure');
  const positionId = Number(req.body.position_id) || null;
  const companyId = Number(req.body.company_id) || user.company_id;
  if (!ctx.allowedIds.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error', '/structure');
  let position = null;
  if (positionId) {
    position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position || !ctx.allowedIds.has(position.company_id)) return backWith(ctx, res, 'Jabatan tidak valid.', 'error', '/structure');
    if (position.company_id !== companyId) return backWith(ctx, res, 'Jabatan harus berada di entitas yang sama dengan pengguna.', 'error', '/structure');
  }
  const managerId = Number(req.body.manager_id) || null;
  if (managerId) {
    const manager = db.prepare('SELECT * FROM users WHERE id = ?').get(managerId);
    if (!manager || !ctx.allowedIds.has(manager.company_id)) return backWith(ctx, res, 'Atasan tidak valid.', 'error', '/structure');
    if (managerId === userId) return backWith(ctx, res, 'Pengguna tidak dapat menjadi atasannya sendiri.', 'error', '/structure');
    // cegah rantai atasan melingkar
    let cur = manager;
    let guard = 0;
    while (cur && cur.manager_id && guard++ < 30) {
      if (cur.manager_id === userId) return backWith(ctx, res, 'Rantai atasan membentuk siklus.', 'error', '/structure');
      cur = db.prepare('SELECT * FROM users WHERE id = ?').get(cur.manager_id);
    }
  }
  const rate = Math.max(0, Number(req.body.hourly_rate) || 0);
  db.prepare(`UPDATE users SET company_id = ?, position_id = ?, manager_id = ?, hourly_rate = ?,
      job_title = COALESCE(?, job_title) WHERE id = ?`)
    .run(companyId, position ? position.id : null, managerId, rate, position ? position.name : null, userId);
  logAction(ctx, 'structure.assign', `${user.name} · ${position ? position.name : 'tanpa jabatan'}`);
  backWith(ctx, res, `Penempatan ${user.name} disimpan.`, 'success', '/structure');
}));

// ---------- Peta pohon organisasi: pindah induk & geser urutan ----------
// Dipakai dua arah: form biasa (redirect + flash) dan tarik-lepas di chart (JSON).
function treeJson(req, res, out) {
  if (req.is('application/json')) return res.status(out.ok ? 200 : (out.status || 400)).json(out);
  return null;
}

function treeBack(ctx, res, req, out, fallback = '/structure') {
  const target = out.redirect || req.body._back || fallback;
  return backWith(ctx, res, out.error || out.message || 'Selesai.', out.ok ? 'success' : 'error', target);
}

/** Daftar saudara (entitas: satu induk; jabatan: satu induk di entitas yang sama). */
function siblingsOf(kind, row) {
  if (kind === 'company') {
    const rows = db.prepare('SELECT id, sort_order, parent_id FROM companies WHERE parent_id IS ?')
      .all(row.parent_id || null);
    return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
  }
  const rows = db.prepare('SELECT id, sort_order, parent_id FROM positions WHERE company_id = ? AND parent_id IS ?')
    .all(row.company_id, row.parent_id || null);
  return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id);
}

app.post('/structure/tree/move', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const kind = req.body.kind === 'position' ? 'position' : 'company';
  const id = Number(req.body.id) || 0;
  const parentId = Number(req.body.parent_id) || null;
  const reply = (out) => {
    if (treeJson(req, res, out)) return;
    logAction(ctx, out.ok ? `structure.tree.move.${kind}` : 'structure.tree.move.reject', out.detail || '');
    treeBack(ctx, res, req, out);
  };

  if (kind === 'company') {
    const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!row || !ctx.allowedIds.has(id)) return reply({ ok: false, error: 'Entitas tidak ditemukan dalam cakupan Anda.' });
    // Aturan lama dipertahankan: memindahkan entitas ke induk lain hanya oleh owner.
    if (ctx.user.role !== 'owner') return reply({ ok: false, error: 'Hanya owner yang dapat memindahkan entitas ke induk lain.' });
    if (parentId && !ctx.allowedIds.has(parentId)) return reply({ ok: false, error: 'Entitas induk di luar cakupan Anda.' });
    if (parentId === id) return reply({ ok: false, error: 'Entitas tidak boleh menjadi induk dirinya sendiri.' });
    if (parentId) {
      const data = structureData(ctx);
      if (data.descendantIdsOf(id).has(parentId)) {
        return reply({ ok: false, error: 'Induk tidak boleh turunan dari entitas itu (akan membentuk siklus).' });
      }
    }
    const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 n FROM companies WHERE parent_id IS ?')
      .get(parentId || null).n;
    db.prepare('UPDATE companies SET parent_id = ?, sort_order = ? WHERE id = ?').run(parentId || null, order, id);
    const parent = parentId ? db.prepare('SELECT name FROM companies WHERE id = ?').get(parentId) : null;
    return reply({
      ok: true,
      message: parent ? `"${row.name}" dipindahkan di bawah ${parent.name}.` : `"${row.name}" dijadikan entitas akar.`,
      detail: `${row.name} → ${parent ? parent.name : 'akar'}`,
      redirect: `/structure?tree=company`,
      id, parent_id: parentId,
    });
  }

  const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
  if (!row || !ctx.allowedIds.has(row.company_id)) return reply({ ok: false, error: 'Jabatan tidak ditemukan dalam cakupan Anda.' });
  if (parentId) {
    const parent = db.prepare('SELECT * FROM positions WHERE id = ?').get(parentId);
    if (!parent || !ctx.allowedIds.has(parent.company_id)) return reply({ ok: false, error: 'Atasan jabatan tidak valid.' });
    if (parent.company_id !== row.company_id) return reply({ ok: false, error: 'Atasan jabatan harus berada di entitas yang sama.' });
    if (parentId === id) return reply({ ok: false, error: 'Jabatan tidak boleh menjadi atasannya sendiri.' });
    let cur = parent;
    let guardCount = 0;
    while (cur && cur.parent_id && guardCount++ < 60) {
      if (cur.parent_id === id) return reply({ ok: false, error: 'Atasan jabatan membentuk siklus.' });
      cur = db.prepare('SELECT * FROM positions WHERE id = ?').get(cur.parent_id);
    }
  }
  const order = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 n FROM positions WHERE company_id = ? AND parent_id IS ?')
    .get(row.company_id, parentId || null).n;
  db.prepare('UPDATE positions SET parent_id = ?, sort_order = ? WHERE id = ?').run(parentId || null, order, id);
  const parent = parentId ? db.prepare('SELECT name FROM positions WHERE id = ?').get(parentId) : null;
  return reply({
    ok: true,
    message: parent ? `Jabatan "${row.name}" kini melapor ke ${parent.name}.` : `Jabatan "${row.name}" dijadikan puncak struktur.`,
    detail: `${row.name} → ${parent ? parent.name : 'puncak'}`,
    redirect: `/structure?tree=position&company=${row.company_id}`,
    id, parent_id: parentId,
  });
}));

app.post('/structure/tree/order', guard('structure_write'), route((req, res) => {
  const ctx = req.ctx;
  const kind = req.body.kind === 'position' ? 'position' : 'company';
  const id = Number(req.body.id) || 0;
  const up = req.body.direction !== 'down';
  const reply = (out) => {
    if (treeJson(req, res, out)) return;
    logAction(ctx, out.ok ? `structure.tree.order.${kind}` : 'structure.tree.order.reject', out.detail || '');
    treeBack(ctx, res, req, out);
  };
  const row = kind === 'company'
    ? db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM positions WHERE id = ?').get(id);
  if (!row || !ctx.allowedIds.has(kind === 'company' ? row.id : row.company_id)) {
    return reply({ ok: false, error: 'Data tidak ditemukan dalam cakupan Anda.' });
  }
  const list = siblingsOf(kind, row);
  const index = list.findIndex((r) => r.id === id);
  const target = up ? index - 1 : index + 1;
  const redirect = kind === 'company' ? '/structure?tree=company' : `/structure?tree=position&company=${row.company_id}`;
  if (index < 0 || target < 0 || target >= list.length) {
    return reply({
      ok: false,
      error: `Sudah berada di urutan paling ${up ? 'atas' : 'bawah'}.`,
      redirect,
    });
  }
  // Tukar posisi lalu nomori ulang semua saudara supaya urutan tetap deterministik.
  const swapped = list.slice();
  const tmp = swapped[index];
  swapped[index] = swapped[target];
  swapped[target] = tmp;
  const table = kind === 'company' ? 'companies' : 'positions';
  db.transaction(() => {
    swapped.forEach((r, i) => db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`).run(i, r.id));
  })();
  return reply({
    ok: true,
    message: kind === 'company' ? 'Urutan entitas diperbarui.' : 'Urutan jabatan diperbarui.',
    detail: `${row.name} → ${up ? 'naik' : 'turun'}`,
    redirect,
    id,
  });
}));

// ---------- Profil pengguna ----------
function profileData(ctx, userId, sessionToken) {
  const profile = db.prepare(`SELECT u.*, c.name company_name FROM users u LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.id = ?`).get(userId);
  if (!profile) return null;
  const position = profile.position_id
    ? db.prepare('SELECT * FROM positions WHERE id = ?').get(profile.position_id)
    : null;
  const manager = profile.manager_id
    ? db.prepare('SELECT id, name, job_title, role, photo_url FROM users WHERE id = ?').get(profile.manager_id)
    : null;
  const reports = db.prepare(`SELECT id, name, job_title, role, photo_url FROM users
    WHERE manager_id = ? AND active = 1 ORDER BY name`).all(profile.id);
  const month = ctx.month;
  const monthSales = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) v FROM sales
    WHERE user_id = ? AND status = 'paid' AND substr(sold_at,1,7) = ?`).get(profile.id, month);
  const allSales = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(total),0) v FROM sales
    WHERE user_id = ? AND status = 'paid'`).get(profile.id);
  const att = db.prepare(`SELECT COUNT(*) days, COALESCE(SUM(work_minutes),0) minutes,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) late FROM attendance
    WHERE user_id = ? AND substr(date,1,7) = ?`).get(profile.id, month);
  const activityTotal = db.prepare("SELECT COUNT(*) c FROM audit_log WHERE user_id = ? AND action NOT LIKE 'onboarding.visit'").get(profile.id).c;
  const lastSession = db.prepare('SELECT MAX(created_at) v FROM sessions WHERE user_id = ?').get(profile.id).v;
  const scopedIds = ctx.allowedIds;

  return {
    profile,
    position,
    manager,
    reports,
    companyPath: auth.companyPath(ctx.companies, profile.company_id),
    isSelf: profile.id === ctx.user.id,
    coverReady: media.available(),
    scope: auth.can(ctx.user, 'structure_read'),
    positions: db.prepare(`SELECT p.id, p.name, c.name company_name FROM positions p
      LEFT JOIN companies c ON c.id = p.company_id
      WHERE p.active = 1 AND p.company_id IN (${ctx.allowedCompanies.map(() => '?').join(',') || 'NULL'})
      ORDER BY c.name, p.sort_order, p.name`).all(...ctx.allowedCompanies.map((c) => c.id)),
    stats: {
      month,
      salesMonth: monthSales.n,
      revenueMonth: monthSales.v,
      salesAll: allSales.n,
      revenueAll: allSales.v,
      presentDays: att.days,
      workHours: att.minutes / 60,
      lateDays: att.late || 0,
      activityTotal,
      lastLogin: lastSession,
    },
    activity: db.prepare(`SELECT * FROM audit_log WHERE user_id = ? AND action NOT LIKE 'onboarding.visit'
      ORDER BY id DESC LIMIT 20`).all(profile.id),
    sales: db.prepare(`SELECT s.invoice_no, s.sold_at, s.total, s.customer_id, cu.name customer_name, c.name company_name
      FROM sales s LEFT JOIN customers cu ON cu.id = s.customer_id LEFT JOIN companies c ON c.id = s.company_id
      WHERE s.user_id = ? AND s.status = 'paid' ORDER BY s.sold_at DESC, s.id DESC LIMIT 8`).all(profile.id),
    attendanceRows: db.prepare(`SELECT a.*, sh.name shift_name FROM attendance a
      LEFT JOIN shifts sh ON sh.id = a.shift_id WHERE a.user_id = ? ORDER BY a.date DESC LIMIT 10`).all(profile.id),
    sessions: db.prepare('SELECT token, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
      .all(profile.id).map((row) => ({ ...row, active: row.token === sessionToken && row.expires_at > U.nowISO() })),
    scopedIds,
  };
}

// ---------- Master data karyawan (profil + kredensial) ----------
function teamPositions(db, ctx) {
  const ids = [...ctx.allowedIds];
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT p.id, p.name, p.level, p.company_id, c.name company_name
    FROM positions p LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.company_id IN (${ph}) AND p.active = 1 ORDER BY c.sort_order, p.sort_order, p.id`).all(...ids);
}

function teamBack(ctx, res, req, msg, tone, fallback = '/team') {
  return backWith(ctx, res, msg, tone, req.body._back || fallback);
}

app.get('/team', guardAny(['team_read']), route((req, res) => {
  const ctx = req.ctx;
  const filter = {
    q: String(req.query.q || '').trim().slice(0, 80),
    role: auth.ROLE_LABELS[req.query.role] ? req.query.role : '',
    company: Number(req.query.company) || 0,
    status: ['active', 'inactive'].includes(req.query.status) ? req.query.status : '',
    position: ['none', 'filled'].includes(req.query.position) ? req.query.position : '',
  };
  if (filter.company && !ctx.allowedIds.has(filter.company)) filter.company = 0;
  const rows = team.list(db, ctx, filter);
  const all = team.list(db, ctx, {});
  res.send(teamPage(ctx, {
    rows,
    filter,
    stats: team.stats(db, all),
    companies: ctx.allowedCompanies,
    positions: teamPositions(db, ctx),
    canWrite: auth.can(ctx.user, 'team_write'),
    canCredential: auth.can(ctx.user, 'team_credential'),
    canCreate: auth.can(ctx.user, 'team_credential'),
  }));
}));

app.get('/team/:id', guardAny(['team_read']), route((req, res) => {
  const ctx = req.ctx;
  const member = team.rowById(db, req.params.id);
  if (!member || !ctx.allowedIds.has(member.company_id)) return forbidden(ctx, res);
  res.send(teamMemberPage(ctx, {
    member,
    positions: team.positionOptions(db, member.company_id),
    managers: team.managerOptions(db, ctx, member).filter((m) => m.company_id === member.company_id
      || ctx.allowedIds.has(m.company_id)),
    companies: ctx.allowedCompanies,
    activity: team.activity(db, member),
    canWrite: auth.can(ctx.user, 'team_write'),
    canCredential: auth.can(ctx.user, 'team_credential'),
    isSelf: member.id === ctx.user.id,
  }));
}));

// Profil kepegawaian: owner & manajer (dalam cakupan).
app.post('/team/:id/profile', guardAny(['team_write']), route((req, res) => {
  const ctx = req.ctx;
  const out = team.saveProfile(db, ctx, req.params.id, req.body);
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', `/team/${req.params.id}`);
  logAction(ctx, 'team.profile', `${out.user.name} · ${out.user.position_name || 'tanpa jabatan'}${out.moved ? ' · entitas dipindah' : ''}`);
  teamBack(ctx, res, req, `Profil ${out.user.name} diperbarui.`, 'success', `/team/${out.user.id}`);
}));

// Kredensial: owner saja.
app.post('/team/:id/credential', guardAny(['team_credential']), route((req, res) => {
  const ctx = req.ctx;
  const out = team.saveCredential(db, ctx, req.params.id, req.body);
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', `/team/${req.params.id}`);
  logAction(ctx, 'team.credential', `${out.user.email} · ${out.changes.join(', ')}`);
  teamBack(ctx, res, req, `Kredensial ${out.user.name} disimpan (${out.changes.join(', ')}).`, 'success', `/team/${out.user.id}`);
}));

app.post('/team/:id/password', guardAny(['team_credential']), route((req, res) => {
  const ctx = req.ctx;
  const out = team.saveCredential(db, ctx, req.params.id, {
    password: req.body.password,
    password_confirm: req.body.password_confirm,
  });
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', `/team/${req.params.id}`);
  logAction(ctx, 'team.password', out.user.email);
  teamBack(ctx, res, req, `Password ${out.user.name} diperbarui. Sesi lain miliknya sudah dikeluarkan.`, 'success', `/team/${out.user.id}`);
}));

app.post('/team/:id/sessions', guardAny(['team_credential']), route((req, res) => {
  const ctx = req.ctx;
  const out = team.revokeSessions(db, req.params.id, ctx.sessionToken);
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', `/team/${req.params.id}`);
  logAction(ctx, 'team.sessions', `${out.user.email} · ${out.removed} sesi`);
  teamBack(ctx, res, req, `${out.removed} sesi ${out.user.name} dikeluarkan.`, 'success', `/team/${out.user.id}`);
}));

app.post('/team/:id/toggle', guardAny(['team_write']), route((req, res) => {
  const ctx = req.ctx;
  const active = String(req.body.active) === '1' ? 1 : 0;
  const out = team.saveCredential(db, ctx, req.params.id, { active: String(active) });
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', '/team');
  logAction(ctx, 'team.toggle', `${out.user.email} → ${active ? 'aktif' : 'nonaktif'}`);
  teamBack(ctx, res, req, `${out.user.name} kini ${active ? 'aktif' : 'nonaktif'}.`, 'success', '/team');
}));

app.post('/team', guardAny(['team_credential']), route((req, res) => {
  const ctx = req.ctx;
  const out = team.create(db, ctx, req.body);
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', '/team');
  logAction(ctx, 'team.create', `${out.user.name} · ${out.user.email} · ${out.user.role}`);
  teamBack(ctx, res, req, `Karyawan ${out.user.name} dibuat. Minta ia mengganti password di Profil.`,
    'success', `/team/${out.user.id}`);
}));

app.post('/team/:id/delete', guardAny(['team_credential']), route((req, res) => {
  const ctx = req.ctx;
  const out = team.remove(db, ctx, req.params.id);
  if (!out.ok) return teamBack(ctx, res, req, out.error, 'error', `/team/${req.params.id}`);
  logAction(ctx, 'team.delete', `${out.user.email}`);
  backWith(ctx, res, `Akun ${out.user.name} dihapus.${out.sales ? ` ${out.sales} transaksi lamanya tetap tersimpan.` : ''}`,
    'success', '/team');
}));

app.get('/profile', guard('profile'), route((req, res) => {
  const ctx = req.ctx;
  let userId = ctx.user.id;
  const requested = Number(req.query.user) || null;
  if (requested && requested !== ctx.user.id) {
    const target = db.prepare('SELECT id, company_id FROM users WHERE id = ?').get(requested);
    // Hanya owner/atasan dalam cakupan yang boleh melihat profil orang lain.
    const mayView = target && (ctx.user.role === 'owner'
      || (auth.can(ctx.user, 'attendance_read') && ctx.allowedIds.has(target.company_id))
      || auth.can(ctx.user, 'structure_read'));
    if (!mayView) return backWith(ctx, res, 'Anda tidak dapat melihat profil pengguna tersebut.', 'error', '/profile');
    userId = target.id;
  }
  const data = profileData(ctx, userId, req.sessionToken);
  if (!data) return backWith(ctx, res, 'Pengguna tidak ditemukan.', 'error', '/');
  res.send(profilePage(ctx, { ...data, tab: String(req.query.tab || 'info') }));
}));

app.post('/profile/save', guard('profile'), route((req, res) => {
  const ctx = req.ctx;
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama tidak boleh kosong.', 'error', '/profile?tab=pengaturan');
  const positionId = Number(req.body.position_id) || null;
  let position = null;
  if (positionId) {
    position = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position || !ctx.allowedIds.has(position.company_id)) {
      return backWith(ctx, res, 'Jabatan tidak valid untuk entitas Anda.', 'error', '/profile?tab=pengaturan');
    }
  }
  const joined = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.joined_at || '')) ? String(req.body.joined_at) : null;
  db.prepare(`UPDATE users SET name = ?, phone = ?, location = ?, job_title = ?, position_id = ?,
      joined_at = COALESCE(?, joined_at), bio = ? WHERE id = ?`)
    .run(name, String(req.body.phone || '').slice(0, 30) || null, String(req.body.location || '').slice(0, 60) || null,
      (position ? position.name : String(req.body.job_title || '').slice(0, 60)) || null,
      position ? position.id : null, joined, String(req.body.bio || '').slice(0, 400) || null, ctx.user.id);
  logAction(ctx, 'profile.update', `${name} · ${position ? position.name : req.body.job_title || ''}`);
  backWith(ctx, res, 'Profil diperbarui.', 'success', '/profile?tab=pengaturan');
}));

app.post('/profile/password', guard('profile'), route((req, res) => {
  const ctx = req.ctx;
  const current = String(req.body.current || '');
  const next = String(req.body.next || '');
  const confirm = String(req.body.confirm || '');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
  if (!verifyPassword(current, user.password_hash)) {
    return backWith(ctx, res, 'Password saat ini tidak sesuai.', 'error', '/profile?tab=pengaturan');
  }
  if (next.length < 6) return backWith(ctx, res, 'Password baru minimal 6 karakter.', 'error', '/profile?tab=pengaturan');
  if (next !== confirm) return backWith(ctx, res, 'Konfirmasi password tidak sama.', 'error', '/profile?tab=pengaturan');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), ctx.user.id);
  // Akhiri sesi lain, pertahankan sesi ini.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(ctx.user.id, req.sessionToken);
  logAction(ctx, 'profile.password', ctx.user.email);
  backWith(ctx, res, 'Password diperbarui. Sesi lain di perangkat lain telah diakhiri.', 'success', '/profile?tab=pengaturan');
}));

// Unggah foto profil / sampul: diteruskan ke penyimpanan media platform (server-side).
function profileImageHandler(field, label) {
  return route(async (req, res) => {
    const ctx = req.ctx;
    const back = `/profile?tab=pengaturan`;
    if (req.body.remove === '1') {
      db.prepare(`UPDATE users SET ${field} = NULL WHERE id = ?`).run(ctx.user.id);
      logAction(ctx, 'profile.image', `${label} dihapus`);
      return backWith(ctx, res, `${label} dihapus.`, 'success', back);
    }
    const direct = media.safeUrl(req.body.image_url);
    if (direct) {
      db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(direct.slice(0, 400), ctx.user.id);
      logAction(ctx, 'profile.image', `${label} via URL`);
      return backWith(ctx, res, `${label} diperbarui.`, 'success', back);
    }
    if (!req.file) return backWith(ctx, res, 'Pilih gambar terlebih dahulu.', 'error', back);
    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const result = await media.upload(req.file, { filename: `${slug}-${ctx.user.id}.${ext || 'jpg'}` });
    if (!result.ok) return backWith(ctx, res, result.error, 'error', back);
    db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(result.url, ctx.user.id);
    logAction(ctx, 'profile.image', `${label} diunggah`);
    backWith(ctx, res, `${label} diperbarui.`, 'success', back);
  });
}

app.post('/profile/photo', upload.single('image'), requireCsrf, guard('profile'), profileImageHandler('photo_url', 'Foto profil'));
app.post('/profile/cover', upload.single('image'), requireCsrf, guard('profile'), profileImageHandler('cover_url', 'Gambar sampul'));

// ---------- Ekspor data (Excel/CSV) ----------
app.get('/export', guard('export_read'), route((req, res) => {
  const ctx = req.ctx;
  const available = Object.entries(exporter.KINDS)
    .filter(([, def]) => auth.can(ctx.user, def.cap))
    .map(([kind, def]) => ({
      kind,
      label: def.label,
      desc: def.desc,
      icon: def.icon,
      sheets: (exporter.SHEETS[kind] || []),
    }));
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const lastLog = db.prepare(`SELECT a.*, u.name user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.action LIKE 'export.%' ${ctx.scopeIds.length ? `AND (a.company_id IN (${ph}) OR a.company_id IS NULL)` : ''}
    ORDER BY a.id DESC LIMIT 10`).all(...ctx.scopeIds);
  res.send(exportPage(ctx, {
    available,
    monthLabel: U.monthLabel(ctx.month),
    scopeLabel: ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi semua unit',
    lastLog,
  }));
}));

app.get('/export/:kind', guard('export_read'), route((req, res) => {
  const ctx = req.ctx;
  const kind = String(req.params.kind);
  const def = exporter.KINDS[kind];
  if (!def) return backWith(ctx, res, 'Jenis ekspor tidak dikenal.', 'error', '/export');
  if (!auth.can(ctx.user, def.cap)) return backWith(ctx, res, 'Role Anda tidak berhak mengekspor data ini.', 'error', '/export');

  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  const result = exporter.build(db, kind, {
    ids: ctx.scopeIds,
    month: ctx.month,
    companyName: ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi semua unit',
    format,
  });
  if (result.error) return backWith(ctx, res, result.error, 'error', '/export');

  const counts = Object.entries(result.counts || {}).map(([k, v]) => `${k}=${v}`).join(' ');
  logAction(ctx, `export.${kind}`, `${format.toUpperCase()} · ${U.monthLabel(ctx.month)} · ${counts}`);

  res.setHeader('Content-Type', result.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Content-Length', String(result.buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.send(result.buffer);
}));

// ---------- Langganan pelanggan ----------
app.get('/subscriptions', guard('subscription_read'), route((req, res) => {
  const ctx = req.ctx;
  const filter = {
    status: String(req.query.status || 'all'),
    q: String(req.query.q || '').slice(0, 60),
  };
  const stats = subs.stats(db, ctx.scopeIds);
  const rows = filter.q || filter.status !== 'all'
    ? subs.list(db, ctx.scopeIds, filter)
    : stats.rows;
  const detailId = Number(req.query.sub) || null;
  let detail = null;
  if (detailId) {
    const d = subs.detail(db, detailId);
    if (d && ctx.allowedIds.has(d.company_id)) detail = d;
  }
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const customers = db.prepare(`SELECT id, name, company_name, type FROM customers WHERE active = 1 AND company_id IN (${ph}) ORDER BY name LIMIT 300`).all(...ctx.scopeIds);
  res.send(subscriptionsPage(ctx, {
    stats,
    rows,
    plans: subs.plans(db),
    series: subs.series(db, ctx.scopeIds, U.monthRange(ctx.month, 6)),
    detail,
    customers,
    filter,
  }));
}));

app.post('/subscriptions/create', guard('subscription_write'), route((req, res) => {
  const ctx = req.ctx;
  const customerId = Number(req.body.customer_id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer || !ctx.allowedIds.has(customer.company_id)) return backWith(ctx, res, 'Pelanggan tidak ditemukan dalam cakupan Anda.', 'error', '/subscriptions');
  const result = subs.create(db, {
    customerId,
    planId: req.body.plan_id,
    startedAt: /^\d{4}-\d{2}-\d{2}$/.test(req.body.started_at || '') ? req.body.started_at : U.todayISO(),
    amount: req.body.amount,
    channel: req.body.channel,
    note: req.body.note,
  });
  if (result.error) return backWith(ctx, res, result.error, 'error', '/subscriptions');
  logAction(ctx, 'subscription.create', `${customer.name} · ${result.plan.name} · ${U.idr(result.amount)}`);
  backWith(ctx, res, `Langganan ${result.plan.name} untuk ${customer.name} dibuat. Jatuh tempo ${U.dateLabel(result.nextDue)}.`, 'success', `/subscriptions?sub=${result.id}`);
}));

app.post('/subscriptions/:id/pay', guard('subscription_write'), route((req, res) => {
  const ctx = req.ctx;
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(Number(req.params.id));
  if (!sub || !ctx.allowedIds.has(sub.company_id)) return backWith(ctx, res, 'Langganan tidak ditemukan.', 'error', '/subscriptions');
  const result = subs.pay(db, sub.id, Number(req.body.payment_id) || null, { method: req.body.method });
  if (result.error) return backWith(ctx, res, result.error, 'error', `/subscriptions?sub=${sub.id}`);
  logAction(ctx, 'subscription.pay', `#${sub.id} · ${U.idr(result.paidAmount)} · jatuh tempo berikutnya ${result.nextDue}`);
  backWith(ctx, res, `Pembayaran ${U.idr(result.paidAmount)} dicatat. Tagihan berikutnya jatuh tempo ${U.dateLabel(result.nextDue)}.`, 'success', `/subscriptions?sub=${sub.id}`);
}));

app.post('/subscriptions/:id/extend', guard('subscription_write'), route((req, res) => {
  const ctx = req.ctx;
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(Number(req.params.id));
  if (!sub || !ctx.allowedIds.has(sub.company_id)) return backWith(ctx, res, 'Langganan tidak ditemukan.', 'error', '/subscriptions');
  const result = subs.extend(db, sub.id, Number(req.body.days) || 30);
  logAction(ctx, 'subscription.extend', `#${sub.id} → ${result.nextDue}`);
  backWith(ctx, res, `Jatuh tempo diperpanjang ke ${U.dateLabel(result.nextDue)}.`, 'success', `/subscriptions?sub=${sub.id}`);
}));

app.post('/subscriptions/:id/status', guard('subscription_write'), route((req, res) => {
  const ctx = req.ctx;
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(Number(req.params.id));
  if (!sub || !ctx.allowedIds.has(sub.company_id)) return backWith(ctx, res, 'Langganan tidak ditemukan.', 'error', '/subscriptions');
  const result = subs.setStatus(db, sub.id, String(req.body.status || ''), { nextDue: req.body.next_due });
  if (result.error) return backWith(ctx, res, result.error, 'error', `/subscriptions?sub=${sub.id}`);
  logAction(ctx, 'subscription.status', `#${sub.id} → ${result.status}`);
  backWith(ctx, res, `Status langganan diubah menjadi ${subs.STATUS_LABEL[result.status]}.`, 'success', `/subscriptions?sub=${sub.id}`);
}));

// ---------- Leaderboard ----------
app.get('/leaderboard', guard('leaderboard_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const branchRows = ranking.branches(db, ids, ctx.month, ctx.companies);
  const teamRows = ranking.teams(db, ids, ctx.month);
  res.send(leaderboardPage(ctx, {
    branches: branchRows,
    teams: teamRows,
    summary: ranking.summary(branchRows, teamRows),
    month: ctx.month,
  }));
}));

// ---------- Dashboard mobile ----------
app.get('/mobile', guard('mobile_view'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const month = ctx.month;
  const fin = { ...Q.financeFor(db, ids, month), month };
  const prev = Q.financeFor(db, ids, U.addMonths(month, -1));
  const todayISO = U.todayISO();
  const yesterday = forecastAddDays(todayISO, -1);
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const daySales = db.prepare(`SELECT COALESCE(SUM(total),0) v, COUNT(*) n FROM sales
    WHERE status='paid' AND company_id IN (${ph}) AND substr(sold_at,1,10) = ?`).get(...ids, todayISO);
  const dayPrev = db.prepare(`SELECT COALESCE(SUM(total),0) v FROM sales
    WHERE status='paid' AND company_id IN (${ph}) AND substr(sold_at,1,10) = ?`).get(...ids, yesterday);
  const series7 = Q.dailySeries(db, ids, month).slice(-7).map((d) => ({ revenue: d.revenue }));

  const branchRows = ranking.branches(db, ids, month, ctx.companies);
  const branchesWithTarget = Q.revenueByCompany(db, ids, month)
    .map((r) => ({ ...r, ach: r.target ? (r.revenue / r.target) * 100 : null }))
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const topCompany = branchesWithTarget[0];
  const topBranch = topCompany
    ? { name: (ctx.byId.get(topCompany.company_id) || {}).name || '', ach: topCompany.ach }
    : null;

  const shipStats = shipping.stats(db, ids);
  const subStats = subs.stats(db, ids);
  const att = attendance.recap(db, ids, month);
  const kpis = Q.kpiRows(db, ids, month);
  const okrs = Q.okrRows(db, ids, U.quarterOf(month));
  const raci = Q.raciRows(db, ids);
  const alerts = buildAlerts({
    fin, prev, target: Q.targetFor(db, ids, month),
    bsc: Q.bscSummary(kpis, Q.objectivesFor(db, ids)), kpis, okrs, raci, month,
    materials: inventory.summary(db, ids), promo: Q.promoImpact(db, ids, month),
    shippingActive: shipping.list(db, ids, { status: 'all', limit: 20 }),
  });

  const todaySchedule = attendance.todayState(db, ctx.user);
  const tasks = [];
  if (todaySchedule.schedule) {
    tasks.push({
      title: 'Shift hari ini: ' + (todaySchedule.schedule.shift_name || 'Shift'),
      sub: `${todaySchedule.schedule.start_time}–${todaySchedule.schedule.end_time} · ${todaySchedule.schedule.company_name || ''}`,
      color: '#4f46e5', href: '/attendance',
    });
  }
  if (!todaySchedule.attendance) {
    tasks.push({ title: 'Belum absen masuk', sub: 'Ketuk untuk absen sekarang', color: '#f59e0b', href: '/attendance' });
  }
  for (const d of subs.upcoming(db, ids, 3).slice(0, 2)) {
    tasks.push({ title: 'Tagihan ' + d.customer_name, sub: `${d.plan_name} · jatuh tempo ${U.dateLabel(d.next_due)}`, color: '#dc2626', href: `/subscriptions?sub=${d.id}` });
  }

  res.send(mobilePage(ctx, {
    fin, prev, daySales, dayTrend: dayPrev.v ? U.deltaPct(daySales.v, dayPrev.v) : 0,
    series7, topBranch, alerts,
    cash: forecast.cashFlow(db, ids, month),
    projection: forecast.project(Q.seriesFor(db, ids, U.monthRange(month, 6)), { horizon: 3 }),
    attendance: att.totals, subs: subStats,
    activeShipments: shipStats.active, tasks,
  }));
}));

function forecastAddDays(dateStr, delta) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

// ---------- Scheduled report ----------
app.get('/reports', guard('report_read'), route((req, res) => {
  const ctx = req.ctx;
  const summary = reports.buildSummary(db, ctx.scopeIds, { month: ctx.month });
  const showPreview = req.query.preview === '1' || true; // pratinjau selalu tersedia
  res.send(reportsPage(ctx, {
    history: reports.history(db, 15),
    lastRun: settings.get(db, 'report_last_run', ''),
    enabled: settings.get(db, 'report_enabled', '1') === '1',
    time: settings.get(db, 'report_time', '07:00'),
    channel: settings.get(db, 'report_channel', 'whatsapp'),
    phones: reports.recipients(db, 'whatsapp'),
    emails: reports.recipients(db, 'email'),
    waMode: wa.mode(db),
    mailMode: mailer.mode(db),
    canWrite: auth.can(ctx.user, 'report_write'),
    preview: showPreview ? { date: summary.date, text: reports.summaryText(summary), html: reports.summaryHtml(summary) } : null,
  }));
}));

app.post('/reports/run', guard('report_write'), route(async (req, res) => {
  const ctx = req.ctx;
  const phones = String(req.body.phones || '').split(',').map((s) => s.trim()).filter(Boolean);
  const emails = String(req.body.emails || '').split(',').map((s) => s.trim()).filter(Boolean);
  const result = await reports.run(db, {
    channel: req.body.channel,
    phones,
    emails,
    scopeIds: ctx.scopeIds,
    month: ctx.month,
  });
  const sent = result.results.filter((r) => r.ok && !r.simulated).length;
  const sim = result.results.filter((r) => r.ok && r.simulated).length;
  const fail = result.results.filter((r) => !r.ok).length;
  logAction(ctx, 'report.run', `${result.channel} · ${sent} terkirim · ${sim} simulasi · ${fail} gagal`);
  const tone = fail && !sent && !sim ? 'error' : 'success';
  const reasons = [...new Set(result.results.filter((r) => !r.ok).map((r) => r.error).filter(Boolean))].slice(0, 2);
  backWith(ctx, res,
    `Laporan ${result.subject} diproses: ${sent} terkirim, ${sim} tersimpan (simulasi), ${fail} gagal.`
    + (reasons.length ? ` Penyebab: ${reasons.join(' · ')}. Atur penerima di Pengaturan Integrasi.` : ' Lihat riwayat di bawah.'),
    tone, '/reports');
}));

// ---------- Onboarding ----------
app.get('/onboarding', guard('dashboard'), route((req, res) => {
  const ctx = req.ctx;
  const steps = availableSteps(ctx.user);
  const doneKeys = db.prepare('SELECT detail FROM audit_log WHERE action = ? AND user_id = ?').all('onboarding.visit', ctx.user.id)
    .map((r) => String(r.detail || ''));
  const doneSet = new Set(doneKeys);
  const enriched = steps.map((s) => ({ ...s, done: doneSet.has(s.key) }));
  const done = enriched.filter((s) => s.done).length;
  const today = U.todayISO();
  const ph = ctx.scopeIds.map(() => '?').join(',') || 'NULL';
  const branchCount = db.prepare(`SELECT COUNT(*) c FROM companies WHERE id IN (${ph}) AND level = 'outlet'`).get(...ctx.scopeIds).c;
  res.send(onboardingPage(ctx, {
    steps: enriched,
    done,
    progress: enriched.length ? (done / enriched.length) * 100 : 0,
    isFirstTime: !ctx.user.onboarded,
    fin: Q.financeFor(db, ctx.scopeIds, ctx.month),
    branchCount,
    subsActive: subs.stats(db, ctx.scopeIds).active,
    help: ['Owner: owner@demo.com', 'WhatsApp tim: 0812-0001-0001', 'Jam operasional bantuan: 08.00–22.00 WIB'],
  }));
}));

app.post('/onboarding/complete', guard('dashboard'), route((req, res) => {
  const ctx = req.ctx;
  db.prepare('UPDATE users SET onboarded = 1, onboarded_at = ? WHERE id = ?').run(U.nowISO(), ctx.user.id);
  logAction(ctx, 'onboarding.complete', ctx.user.email);
  backWith(ctx, res, 'Panduan selesai. Selamat bekerja — dashboard siap dipakai.', 'success', '/');
}));

app.post('/onboarding/reset', guard('dashboard'), route((req, res) => {
  const ctx = req.ctx;
  db.prepare('UPDATE users SET onboarded = 0 WHERE id = ?').run(ctx.user.id);
  db.prepare('DELETE FROM audit_log WHERE action = ? AND user_id = ?').run('onboarding.visit', ctx.user.id);
  logAction(ctx, 'onboarding.reset', ctx.user.email);
  backWith(ctx, res, 'Panduan akan ditampilkan lagi saat Anda login berikutnya.', 'success', '/onboarding');
}));

// ---------- Katalog produk ----------
app.get('/catalog', guard('catalog_read'), route((req, res) => {
  const ctx = req.ctx;
  const ids = ctx.scopeIds;
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const filter = {
    q: String(req.query.q || '').slice(0, 60),
    category: String(req.query.category || '').slice(0, 60),
    min: Number(req.query.min) || null,
    max: Number(req.query.max) || null,
    rating: Number(req.query.rating) || null,
    sort: ['popular', 'rating', 'price_asc', 'price_desc', 'newest'].includes(req.query.sort) ? req.query.sort : 'popular',
  };

  const base = db.prepare(`SELECT p.*, c.name company_name,
      (SELECT ROUND(AVG(rating),2) FROM product_reviews r WHERE r.product_id = p.id) rating,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id) review_count,
      (SELECT COUNT(*) FROM product_recipes pr WHERE pr.product_id = p.id) recipe_count,
      (SELECT comment FROM product_reviews r WHERE r.product_id = p.id ORDER BY r.rating DESC, r.id DESC LIMIT 1) review_snippet,
      (SELECT COALESCE(SUM(si.qty),0) FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE si.product_id = p.id AND s.status='paid') sold
    FROM products p LEFT JOIN companies c ON c.id = p.company_id
    WHERE p.active = 1 AND p.company_id IN (${ph})`).all(...ids);

  let rows = base.map((p) => ({
    ...p,
    rating: p.rating || 0,
    reviewCount: p.review_count || 0,
    recipeCount: p.recipe_count || 0,
    reviewSnippet: p.review_snippet,
    sold: p.sold || 0,
  }));

  if (filter.q) {
    const q = filter.q.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || String(p.sku).toLowerCase().includes(q));
  }
  if (filter.category) rows = rows.filter((p) => (p.category || '') === filter.category);
  if (filter.min !== null) rows = rows.filter((p) => p.price >= filter.min);
  if (filter.max !== null) rows = rows.filter((p) => p.price <= filter.max);
  if (filter.rating) rows = rows.filter((p) => p.rating >= filter.rating);

  if (filter.sort === 'rating') rows.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  else if (filter.sort === 'price_asc') rows.sort((a, b) => a.price - b.price);
  else if (filter.sort === 'price_desc') rows.sort((a, b) => b.price - a.price);
  else if (filter.sort === 'newest') rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  else rows.sort((a, b) => b.sold - a.sold);

  const all = base.map((p) => ({ rating: p.rating || 0, reviewCount: p.review_count || 0, price: p.price, kind: p.kind }));
  const reviewTotal = all.reduce((a, p) => a + p.reviewCount, 0);
  const rated = all.filter((p) => p.rating > 0);
  const summary = {
    total: all.length,
    menu: all.filter((p) => p.kind === 'menu').length,
    bean: all.filter((p) => p.kind === 'bean').length,
    avgRating: rated.length ? rated.reduce((a, p) => a + p.rating, 0) / rated.length : 0,
    reviews: reviewTotal,
    minPrice: all.length ? Math.min(...all.map((p) => p.price)) : 0,
    maxPrice: all.length ? Math.max(...all.map((p) => p.price)) : 0,
  };

  res.send(catalogPage(ctx, {
    products: rows,
    categories: [...new Set(base.map((p) => p.category).filter(Boolean))].sort(),
    filter,
    summary,
    canSeeCost: auth.can(ctx.user, 'finance_read') || auth.can(ctx.user, 'pos_write'),
  }));
}));

// ---------- Design system ----------
app.get('/design', guard('design'), route((req, res) => {
  res.send(designPage(req.ctx));
}));

// ---------- Admin ----------
app.get('/admin', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const users = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.active, u.company_id, u.hourly_rate, c.name company_name
    FROM users u LEFT JOIN companies c ON c.id = u.company_id ORDER BY u.company_id, u.name`).all();
  const companies = db.prepare('SELECT * FROM companies ORDER BY id').all();
  const userCounts = db.prepare('SELECT company_id, COUNT(*) c FROM users GROUP BY company_id').all();
  const outletCounts = db.prepare("SELECT parent_id, COUNT(*) c FROM companies WHERE level = 'outlet' GROUP BY parent_id").all();
  const counts = {
    users: new Map(userCounts.map((r) => [r.company_id, r.c])),
    outlets: new Map(outletCounts.map((r) => [r.parent_id, r.c])),
  };
  const resets = db.prepare(`SELECT r.id, r.created_at, r.delivered, u.id user_id, u.name, u.email
    FROM password_resets r JOIN users u ON u.id = r.user_id
    WHERE r.used_at IS NULL AND r.expires_at > ? ORDER BY r.created_at DESC LIMIT 8`).all(sqlTime());
  res.send(adminPage(ctx, { companies, users, counts, resets }));
}));

app.post('/admin/resets/link', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const user = db.prepare('SELECT id, name, email, active FROM users WHERE id = ?').get(Number(req.body.user_id));
  if (!user) return backWith(ctx, res, 'Pengguna tidak ditemukan.', 'error', '/admin');
  if (!user.active) return backWith(ctx, res, 'Akun nonaktif tidak bisa diberi tautan reset.', 'error', '/admin');
  db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(sqlTime(), user.id);
  const token = issueResetToken(user.id, { ip: req.ip, delivered: 'manual' });
  const link = `${publicBaseUrl(req)}/reset?token=${token}`;
  logAction(ctx, 'admin.reset_link', user.email);
  res.send(L.shell(ctx, {
    title: 'Tautan reset password',
    subtitle: `${user.name} · ${user.email}`,
    active: '/admin',
    content: L.card({ title: 'Bagikan tautan ini ke pengguna', subtitle: `Berlaku ${RESET_TTL_MIN} menit, sekali pakai` }, `
      <p style="font-size:var(--fs-sm);color:var(--text-soft);line-height:var(--lh-base)">
        Kirim tautan di bawah lewat WhatsApp/email internal. Pengguna akan diminta membuat password baru,
        dan semua sesi lamanya otomatis keluar. Tautan tidak bisa dilihat lagi setelah halaman ini ditutup.
      </p>
      <div class="form-grid" style="margin-top:var(--sp-4)">
        <label class="field" style="grid-column:1 / -1"><span>Tautan reset</span>
          <input type="text" value="${U.h(link)}" readonly data-copy-input autofocus onclick="this.select()">
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-sm" data-copy-from="[data-copy-input]">${L.icon('check', 15)} <span data-copy-label>Salin tautan</span></button>
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/admin">Kembali ke Admin</a>
      </div>`),
  }));
}));

app.post('/admin/companies', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const name = String(req.body.name || '').trim();
  if (!name) return backWith(ctx, res, 'Nama entitas wajib diisi.', 'error');
  const parentId = Number(req.body.parent_id) || null;
  const level = ['holding', 'unit', 'outlet'].includes(req.body.level) ? req.body.level : 'outlet';
  if (parentId && !ctx.byId.has(parentId)) return backWith(ctx, res, 'Entitas induk tidak ditemukan.', 'error');
  db.prepare('INSERT INTO companies (name, code, parent_id, level, created_at) VALUES (?,?,?,?,?)')
    .run(name, String(req.body.code || '').trim().toUpperCase() || null, parentId, level, U.nowISO());
  logAction(ctx, 'company.create', `${name} (${level})`);
  backWith(ctx, res, `Entitas "${name}" ditambahkan.`, 'success', '/admin');
}));

app.post('/admin/companies/:id/delete', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(Number(req.params.id));
  if (!company) return backWith(ctx, res, 'Entitas tidak ditemukan.', 'error');
  if (!company.parent_id) return backWith(ctx, res, 'Entitas utama tidak dapat dihapus.', 'error');
  const children = db.prepare('SELECT COUNT(*) c FROM companies WHERE parent_id = ?').get(company.id).c;
  if (children) return backWith(ctx, res, 'Hapus atau pindahkan entitas turunan terlebih dahulu.', 'error');
  const sales = db.prepare('SELECT COUNT(*) c FROM sales WHERE company_id = ?').get(company.id).c;
  const users = db.prepare('SELECT COUNT(*) c FROM users WHERE company_id = ?').get(company.id).c;
  if (sales || users) return backWith(ctx, res, 'Entitas masih memiliki data penjualan atau pengguna, sehingga tidak dapat dihapus.', 'error');
  db.prepare('DELETE FROM companies WHERE id = ?').run(company.id);
  logAction(ctx, 'company.delete', company.name);
  backWith(ctx, res, `Entitas "${company.name}" dihapus.`, 'success', '/admin');
}));

app.post('/admin/users', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const companyId = Number(req.body.company_id);
  const role = auth.ROLE_LABELS[req.body.role] ? req.body.role : 'staff';
  if (!name || !email || password.length < 6) return backWith(ctx, res, 'Nama, email, dan password minimal 6 karakter wajib diisi.', 'error');
  if (!ctx.byId.has(companyId)) return backWith(ctx, res, 'Entitas tidak valid.', 'error');
  if (db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email)) return backWith(ctx, res, 'Email sudah terdaftar.', 'error');
  db.prepare('INSERT INTO users (company_id, name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,?,1,?)')
    .run(companyId, name, email, hashPassword(password), role, U.nowISO());
  logAction(ctx, 'user.create', `${name} · ${email} · ${role}`);
  backWith(ctx, res, `Pengguna ${name} ditambahkan dengan role ${auth.ROLE_LABELS[role]}.`, 'success', '/admin');
}));

app.post('/admin/users/:id/rate', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return backWith(ctx, res, 'Pengguna tidak ditemukan.', 'error');
  const rate = Math.max(0, Number(req.body.hourly_rate) || 0);
  db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(rate, user.id);
  logAction(ctx, 'user.rate', `${user.email} · ${U.idr(rate)}/jam`);
  backWith(ctx, res, `Tarif ${user.name} diset ${U.idr(rate)}/jam untuk estimasi biaya tenaga kerja.`, 'success', '/admin');
}));

app.post('/admin/users/:id/toggle', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return backWith(ctx, res, 'Pengguna tidak ditemukan.', 'error');
  if (user.role === 'owner') return backWith(ctx, res, 'Akun owner tidak dapat dinonaktifkan.', 'error');
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(user.active ? 0 : 1, user.id);
  if (user.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  logAction(ctx, 'user.toggle', `${user.email} → ${user.active ? 'nonaktif' : 'aktif'}`);
  backWith(ctx, res, `Status ${user.name} diubah menjadi ${user.active ? 'nonaktif' : 'aktif'}.`, 'success', '/admin');
}));

app.post('/admin/users/:id/delete', guard('admin'), route((req, res) => {
  const ctx = req.ctx;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return backWith(ctx, res, 'Pengguna tidak ditemukan.', 'error');
  if (user.role === 'owner') return backWith(ctx, res, 'Akun owner tidak dapat dihapus.', 'error');
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  logAction(ctx, 'user.delete', user.email);
  backWith(ctx, res, `Pengguna ${user.name} dihapus.`, 'success', '/admin');
}));

// ---------- Timeline proyek (Gantt chart) ----------
function timelineOwners(ctx) {
  const ids = [...ctx.allowedIds];
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT id, name, role, job_title FROM users
    WHERE active = 1 AND company_id IN (${ph}) ORDER BY name`).all(...ids);
}

app.get('/timeline', guardAny(['perf_read']), route((req, res) => {
  const ctx = req.ctx;
  const ids = [...ctx.allowedIds];
  const zoom = T.ZOOMS[req.query.zoom] ? req.query.zoom : T.DEFAULT_ZOOM;
  const win = T.windowFor({ from: req.query.from, zoom, today: U.todayISO() });
  const filter = {
    company: String(req.query.company || ''),
    status: T.STATUS[req.query.status] ? req.query.status : '',
    source: ['task', 'raci'].includes(req.query.source) ? req.query.source : '',
  };
  const { items, undated } = T.collect(db, ids, win, {
    companyId: Number(filter.company) || null,
    status: filter.status,
    source: filter.source,
  });
  const rows = items.map((it) => T.place(it, win));
  res.send(timelinePage(ctx, {
    win,
    rows,
    undated,
    summary: T.stats(items),
    canWrite: auth.can(ctx.user, 'perf_write'),
    companies: ctx.allowedCompanies,
    owners: timelineOwners(ctx),
    filter,
  }));
}));

app.get('/timeline/data', guardAny(['perf_read']), route((req, res) => {
  const ctx = req.ctx;
  const zoom = T.ZOOMS[req.query.zoom] ? req.query.zoom : T.DEFAULT_ZOOM;
  const win = T.windowFor({ from: req.query.from, zoom, today: U.todayISO() });
  const { items } = T.collect(db, [...ctx.allowedIds], win, {
    companyId: Number(req.query.company) || null,
    status: T.STATUS[req.query.status] ? req.query.status : '',
    source: ['task', 'raci'].includes(req.query.source) ? req.query.source : '',
  });
  res.set('Cache-Control', 'no-store').json({
    ok: true,
    window: win,
    summary: T.stats(items),
    items: items.map((it) => T.place(it, win)),
  });
}));

app.post('/timeline/task', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const out = T.createTask(db, [...ctx.allowedIds], req.body);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/timeline');
  logAction(ctx, 'timeline.task.create', `${out.task.title} · ${out.task.start_date}→${out.task.end_date}`);
  backWith(ctx, res, `Tugas "${out.task.title}" ditambahkan ke timeline.`, 'success', `/timeline?from=${String(req.body.from_hint || out.task.start_date).slice(0, 10)}`);
}));

app.post('/timeline/task/:id', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const body = { ...req.body, end_date: req.body.end_date || req.body.due_date };
  const out = T.updateTask(db, [...ctx.allowedIds], req.params.id, body);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/timeline');
  logAction(ctx, 'timeline.task.update', `${out.task.title} · ${out.task.start_date}→${out.task.end_date}`);
  backWith(ctx, res, 'Tugas diperbarui.', 'success', '/timeline');
}));

app.post('/timeline/task/:id/delete', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const out = T.deleteTask(db, [...ctx.allowedIds], req.params.id);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/timeline');
  logAction(ctx, 'timeline.task.delete', out.title);
  backWith(ctx, res, `Tugas "${out.title}" dihapus.`, 'success', '/timeline');
}));

// Drag & drop (JSON): hanya mengubah tanggal, validasi tetap di server.
function dragHandler(source) {
  return route((req, res) => {
    const ctx = req.ctx;
    const out = T.moveDates(db, [...ctx.allowedIds], source, req.params.id, req.body || {});
    if (!out.ok) return res.status(400).json({ ok: false, error: out.error });
    logAction(ctx, `timeline.${source}.drag`, `#${req.params.id} → ${out.start}…${out.end}`);
    res.json({ ok: true, start: out.start, end: out.end });
  });
}

app.post('/timeline/task/:id/dates', guard('perf_write'), dragHandler('task'));
app.post('/timeline/raci/:id/dates', guard('perf_write'), dragHandler('raci'));

app.post('/timeline/raci/:id/update', guard('perf_write'), route((req, res) => {
  const ctx = req.ctx;
  const out = T.updateRaciRow(db, [...ctx.allowedIds], req.params.id, req.body);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/timeline');
  logAction(ctx, 'timeline.raci.update', `#${req.params.id} · ${req.body.status || ''}`);
  backWith(ctx, res, 'Aktivitas RACI diperbarui dari timeline.', 'success', '/timeline');
}));

// ---------- Ondeway Coffee Academy (LMS) ----------
function lmsLearners(ctx) {
  const ids = lms.scopeUserIds(ctx);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  return db.prepare(`SELECT u.id, u.name, u.role, u.job_title, c.name company
    FROM users u LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.active = 1 AND u.id IN (${ph}) ORDER BY u.name`).all(...ids);
}

function lmsActivity(ctx, limit = 12) {
  const ids = lms.scopeUserIds(ctx);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const quizzes = db.prepare(`SELECT a.created_at, a.score, a.passed, u.name user_name, c.code, 'quiz' kind
    FROM lms_attempts a JOIN users u ON u.id = a.user_id JOIN lms_courses c ON c.id = a.course_id
    WHERE a.user_id IN (${ph}) ORDER BY a.id DESC LIMIT ?`).all(...ids, limit);
  const practicals = db.prepare(`SELECT p.created_at, p.total score, p.passed, u.name user_name, c.code, 'practical' kind
    FROM lms_practicals p JOIN users u ON u.id = p.user_id JOIN lms_courses c ON c.id = p.course_id
    WHERE p.user_id IN (${ph}) ORDER BY p.id DESC LIMIT ?`).all(...ids, limit);
  return quizzes.concat(practicals)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

app.get('/academy', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const canAssess = auth.can(ctx.user, 'lms_assess');
  const canManage = auth.can(ctx.user, 'lms_manage');
  const learners = canAssess ? lmsLearners(ctx) : [];
  const ids = learners.map((u) => u.id);
  const mine = lms.learnerDashboard(db, ctx.user.id);
  res.send(A.academyPage(ctx, {
    mine,
    kpi: canAssess ? lms.kpis(db, ids) : lms.kpis(db, [ctx.user.id]),
    users: learners,
    paths: lms.pathRows(db),
    activity: canAssess ? lmsActivity(ctx) : [],
    canAssess, canManage,
    selectedUser: Number(req.query.user) || null,
  }));
}));

app.get('/academy/course/:code', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const course = lms.courseWithMaterials(db, req.params.code);
  if (!course) {
    return res.status(404).send(L.shell(ctx, {
      title: 'Modul tidak ditemukan', active: '/academy',
      content: L.card({ title: '404' }, `<p class="hint-text">Modul <code>${U.h(req.params.code)}</code> tidak ada dalam katalog kurikulum.</p>`),
    }));
  }
  const canAssess = auth.can(ctx.user, 'lms_assess');
  let learner = ctx.user;
  const requested = Number(req.query.user) || null;
  if (requested && canAssess) {
    const candidate = lmsLearners(ctx).find((u) => u.id === requested);
    if (candidate) learner = candidate;
  } else if (requested && !canAssess) {
    return backWith(ctx, res, 'Hanya trainer yang dapat membuka progres karyawan lain.', 'error', '/academy');
  }
  const isMine = learner.id === ctx.user.id;
  const enr = isMine ? lms.ensureEnrollment(db, learner.id, course.id) : lms.enrollment(db, learner.id, course.id);
  const attempts = lms.attemptsOf(db, learner.id, course.id);
  let lastResult = null;
  if (req.query.quiz === '1' && attempts.length) {
    const last = attempts[0];
    lastResult = { score: last.score, passed: !!last.passed, detail: lms.safeJson(last.answers, []) };
    lastResult.total = lastResult.detail.length || lms.questionsOf(db, course.id).length;
  }
  res.send(A.coursePage(ctx, {
    course,
    enrollment: enr,
    sectionsDone: lms.sectionsDone(db, learner.id, course.id),
    questions: lms.questionsOf(db, course.id),
    attempts,
    practicals: lms.practicalsOf(db, learner.id, course.id),
    docs: lms.libraryDocs(db, {}).filter((d) => d.course_code === course.code),
    lastResult,
    canAssess,
    isMine,
    learner,
  }));
}));

app.post('/academy/course/:code/section/:index', guardAny(['lms_view']), route((req, res) => {  const ctx = req.ctx;
  const course = lms.courseRow(db, req.params.code);
  if (!course) return backWith(ctx, res, 'Modul tidak ditemukan.', 'error', '/academy');
  const target = Number(req.body.user_id || ctx.user.id);
  if (target !== ctx.user.id && !auth.can(ctx.user, 'lms_assess')) {
    return backWith(ctx, res, 'Anda hanya dapat menandai materi milik sendiri.', 'error', '/academy');
  }
  if (!lms.completeSection(db, target, course.id, Number(req.params.index) || 0)) {
    return backWith(ctx, res, 'Bagian materi itu tidak ada pada modul ini.', 'error', `/academy/course/${course.code}`);
  }
  backWith(ctx, res, `Bagian ${Number(req.params.index) + 1} ditandai selesai.`, 'success', `/academy/course/${course.code}`);
}));

// ---- Materi modul: trainer menambah video embed / PDF / teks tanpa membebani server ----
app.post('/academy/course/:code/material', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const back = `/academy/course/${String(req.params.code || '').toUpperCase()}`;
  const out = lms.addMaterial(db, {
    code: req.params.code,
    kind: req.body.kind,
    title: req.body.title,
    url: req.body.url,
    body: req.body.body,
    duration_min: req.body.duration_min,
  });
  if (!out.ok) return backWith(ctx, res, out.error, 'error', back);
  logAction(ctx, 'lms.material.add', `${req.params.code} · ${out.kind} · ${String(req.body.title || '').slice(0, 60)}`);
  backWith(ctx, res, `Materi "${String(req.body.title || '').trim()}" ditambahkan.`, 'success', back);
}));

app.post('/academy/material/:id/save', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.updateMaterial(db, req.params.id, {
    kind: req.body.kind,
    title: req.body.title,
    url: req.body.url,
    body: req.body.body,
    duration_min: req.body.duration_min,
  });
  const back = out.course_id ? `/academy/course/${(lms.courseById(db, out.course_id) || {}).code || ''}` : '/academy';
  if (!out.ok) return backWith(ctx, res, out.error, 'error', back);
  logAction(ctx, 'lms.material.update', `material ${req.params.id}`);
  backWith(ctx, res, 'Materi diperbarui.', 'success', back);
}));

app.post('/academy/material/:id/move', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.moveMaterial(db, req.params.id, req.body.direction === 'up' ? 'up' : 'down');
  const back = out.course_id ? `/academy/course/${(lms.courseById(db, out.course_id) || {}).code || ''}` : '/academy';
  if (!out.ok) return backWith(ctx, res, out.error, 'error', back);
  backWith(ctx, res, 'Urutan materi diubah.', 'success', back);
}));

app.post('/academy/material/:id/delete', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const row = lms.materialById(db, req.params.id);
  const out = lms.deleteMaterial(db, req.params.id);
  const back = out.course_id ? `/academy/course/${(lms.courseById(db, out.course_id) || {}).code || ''}` : '/academy';
  if (!out.ok) return backWith(ctx, res, out.error, 'error', back);
  logAction(ctx, 'lms.material.delete', String(row ? row.title : req.params.id).slice(0, 60));
  backWith(ctx, res, 'Materi dihapus.', 'success', back);
}));

app.post('/academy/course/:code/quiz', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const course = lms.courseRow(db, req.params.code);
  if (!course) return backWith(ctx, res, 'Modul tidak ditemukan.', 'error', '/academy');
  const questions = lms.questionsOf(db, course.id);
  const answers = {};
  for (const q of questions) {
    const raw = req.body[`q_${q.id}`];
    if (raw !== undefined) answers[q.id] = Number(raw);
  }
  if (!Object.keys(answers).length) return backWith(ctx, res, 'Jawab minimal satu soal sebelum mengirim.', 'error', `/academy/course/${course.code}`);
  const out = lms.gradeQuiz(db, { code: course.code, userId: ctx.user.id, answers });
  if (!out.ok) return backWith(ctx, res, out.error, 'error', `/academy/course/${course.code}`);
  if (out.passed) {
    lms.awardBadges(db, ctx.user.id);
    lms.maybeIssueCertificates(db, ctx.user.id, null);
  }
  logAction(ctx, 'lms.quiz', `${course.code} · ${out.score} · ${out.passed ? 'lulus' : 'belum'}`);
  backWith(ctx, res, `Kuis ${course.code}: skor ${out.score} (${out.correct}/${out.total} benar) — ${out.passed ? 'lulus teori' : `belum lulus, minimal ${course.pass_theory}`}.`,
    out.passed ? 'success' : 'error', `/academy/course/${course.code}?quiz=1`);
}));

app.get('/academy/paths', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const canAssess = auth.can(ctx.user, 'lms_assess');
  res.send(A.pathsPage(ctx, { paths: lms.pathRows(db), users: canAssess ? lmsLearners(ctx) : [], canAssess }));
}));

app.post('/academy/paths/:code/enroll', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const canAssess = auth.can(ctx.user, 'lms_assess');
  const wantsOther = Number(req.body.user_id) || 0;
  if (wantsOther && wantsOther !== ctx.user.id && !canAssess) {
    return backWith(ctx, res, 'Hanya trainer yang dapat menugaskan modul ke karyawan lain.', 'error', '/academy/paths');
  }
  if (wantsOther && canAssess && !lmsLearners(ctx).some((u) => u.id === wantsOther)) {
    return backWith(ctx, res, 'Karyawan berada di luar cakupan Anda.', 'error', '/academy/paths');
  }
  const userId = wantsOther || ctx.user.id;
  const dueDays = Math.max(1, Math.min(365, Number(req.body.due_days) || 45));
  const added = lms.enrollPath(db, { userId, pathCode: req.params.code, assignedBy: ctx.user.id, dueDays });
  logAction(ctx, 'lms.enroll', `${req.params.code} → user ${userId} · ${added} modul baru`);
  const target = lmsLearners(ctx).find((u) => u.id === userId);
  backWith(ctx, res, added
    ? `${added} modul dari ${req.params.code} ditugaskan${target && userId !== ctx.user.id ? ' ke ' + target.name : ''} (tenggat ${dueDays} hari).`
    : 'Semua modul pada jalur itu sudah pernah ditugaskan.', added ? 'success' : 'error', '/academy');
}));

app.get('/academy/assess', guardAny(['lms_assess']), route((req, res) => {
  const ctx = req.ctx;
  const learners = lmsLearners(ctx);
  if (!learners.length) {
    return res.send(A.assessPage(ctx, { users: [], selectedUser: null, course: null, rubric: [], learners: [] }));
  }
  const selectedUser = Number(req.query.user) || learners[0].id;
  if (!learners.some((u) => u.id === selectedUser)) {
    return backWith(ctx, res, 'Karyawan berada di luar cakupan Anda.', 'error', '/academy');
  }
  const course = req.query.course ? lms.hydrate(lms.courseRow(db, req.query.course)) : null;
  const ids = learners.map((u) => u.id);
  const ph = ids.map(() => '?').join(',');
  const recent = db.prepare(`SELECT p.total, p.passed, p.created_at, u.name user_name, c.code
    FROM lms_practicals p JOIN users u ON u.id = p.user_id JOIN lms_courses c ON c.id = p.course_id
    WHERE p.user_id IN (${ph}) ORDER BY p.id DESC LIMIT 10`).all(...ids);
  res.send(A.assessPage(ctx, {
    users: learners, selectedUser, course, rubric: course ? course.rubric : [], learners: recent,
  }));
}));

app.post('/academy/assess', guardAny(['lms_assess']), route((req, res) => {
  const ctx = req.ctx;
  const learners = lmsLearners(ctx);
  const userId = Number(req.body.user_id) || 0;
  if (!learners.some((u) => u.id === userId)) {
    return backWith(ctx, res, 'Karyawan berada di luar cakupan Anda.', 'error', '/academy/assess');
  }
  const course = lms.courseRow(db, req.body.course_code);
  if (!course) return backWith(ctx, res, 'Modul tidak ditemukan.', 'error', '/academy/assess');
  const rubric = lms.safeJson(course.rubric, []);
  const scores = {};
  for (const aspect of rubric) scores[aspect.aspect] = Number(req.body[aspect.aspect]) || 0;
  const out = lms.recordPractical(db, {
    code: course.code, userId, assessorId: ctx.user.id, scores, note: req.body.note,
  });
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/academy/assess');
  const target = learners.find((u) => u.id === userId);
  logAction(ctx, 'lms.practical', `${course.code} → ${target.name} · ${out.total} · ${out.passed ? 'lulus' : 'belum'}`);
  const extra = out.complete
    ? ` Peserta dinyatakan LULUS modul${out.badges.length ? ` dan mendapat badge ${out.badges.join(', ')}` : ''}.`
    : out.passed && !out.theoryOk ? ' Nilai praktik lulus, tetapi kuis teori belum memenuhi ambang.' : '';
  backWith(ctx, res, `Asesmen ${course.code} untuk ${target.name}: nilai ${out.total} — ${out.passed ? 'lulus praktik' : 'belum lulus'}${out.criticalFail ? ' (ada aspek kritis bernilai 0)' : ''}.${extra}`,
    out.complete ? 'success' : 'error', `/academy/assess?user=${userId}&course=${course.code}`);
}));

app.get('/academy/matrix', guardAny(['lms_assess']), route((req, res) => {
  const ctx = req.ctx;
  const ids = lms.scopeUserIds(ctx);
  const ph = ids.map(() => '?').join(',') || 'NULL';
  const certificates = ids.length ? db.prepare(`SELECT c.*, u.name user_name FROM lms_certificates c
    JOIN users u ON u.id = c.user_id WHERE c.user_id IN (${ph}) ORDER BY c.id DESC`).all(...ids) : [];
  res.send(A.matrixPage(ctx, {
    rows: lms.matrix(db, ids),
    levels: lms.LEVELS,
    certificates,
    kpi: lms.kpis(db, ids),
  }));
}));

app.get('/academy/library', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const filter = {
    q: String(req.query.q || ''),
    kind: lms.DOC_KINDS[req.query.kind] ? req.query.kind : '',
    status: lms.DOC_STATUS.includes(req.query.status) ? req.query.status : '',
  };
  res.send(A.libraryPage(ctx, {
    docs: lms.libraryDocs(db, filter),
    filter,
    courses: lms.listCourses(db, {}),
    canManage: auth.can(ctx.user, 'lms_manage'),
    docKinds: lms.DOC_KINDS,
    docStatus: lms.DOC_STATUS,
  }));
}));

// ---- Detail dokumen pustaka: isi, lampiran video/PDF, dan formulir penyesuaian ----
app.get('/academy/library/:id', guardAny(['lms_view']), route((req, res) => {
  const ctx = req.ctx;
  const doc = lms.docRow(db, req.params.id);
  if (!doc) {
    return res.status(404).send(L.shell(ctx, {
      title: 'Dokumen tidak ditemukan', active: '/academy',
      content: L.card({ title: '404' }, `<p class="hint-text">Dokumen pustaka itu tidak ada.</p>
        <div class="form-actions"><a class="btn btn-ghost btn-sm" href="${ctx.base}/academy/library">Kembali ke pustaka</a></div>`),
    }));
  }
  res.send(A.docPage(ctx, {
    doc,
    attachments: lms.attachmentsOf(db, doc.id),
    course: doc.course_code ? lms.courseRow(db, doc.course_code) : null,
    canManage: auth.can(ctx.user, 'lms_manage'),
    docKinds: lms.DOC_KINDS,
    docStatus: lms.DOC_STATUS,
    courses: lms.listCourses(db, {}),
  }));
}));

/** Simpan dokumen baru (SOP / job aid / recipe) dari pustaka. */
app.post('/academy/library', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.saveDoc(db, { ...req.body });
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/academy/library');
  logAction(ctx, 'lms.doc.create', `${out.doc.code} · ${out.doc.title}`);
  backWith(ctx, res, `Dokumen ${out.doc.code} dibuat. Sekarang Anda bisa melampirkan video atau PDF.`,
    'success', `/academy/library/${out.doc.id}`);
}));

app.post('/academy/library/:id', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.saveDoc(db, { ...req.body, id: req.params.id });
  if (!out.ok) return backWith(ctx, res, out.error, 'error', `/academy/library/${req.params.id}`);
  logAction(ctx, 'lms.doc.update', `${out.doc.code} · v${out.doc.version}`);
  backWith(ctx, res, `Dokumen ${out.doc.code} diperbarui.`, 'success', `/academy/library/${out.doc.id}`);
}));

app.post('/academy/library/:id/delete', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.deleteDoc(db, req.params.id);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', `/academy/library/${req.params.id}`);
  logAction(ctx, 'lms.doc.delete', `${out.code} · ${out.title}`);
  backWith(ctx, res, `Dokumen ${out.code} dihapus.`, 'success', '/academy/library');
}));

app.post('/academy/library/:id/attachment', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.addDocAttachment(db, req.params.id, req.body);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', `/academy/library/${req.params.id}`);
  logAction(ctx, 'lms.doc.attachment.create', `${out.doc.code} · ${req.body.kind} · ${req.body.url}`);
  backWith(ctx, res, `Lampiran ${req.body.kind === 'video' ? 'video' : 'PDF'} ditambahkan ke ${out.doc.code}.`,
    'success', `/academy/library/${out.doc.id}`);
}));

app.post('/academy/library/attachment/:id', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.updateDocAttachment(db, req.params.id, req.body);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', `/academy/library/${req.body.doc_id || ''}`);
  backWith(ctx, res, 'Lampiran diperbarui.', 'success', `/academy/library/${out.doc_id}`);
}));

app.post('/academy/library/attachment/:id/move', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.moveDocAttachment(db, req.params.id, req.body.direction === 'up' ? 'up' : 'down');
  if (!out.ok) return backWith(ctx, res, out.error, 'error', `/academy/library/${out.doc_id || ''}`);
  backWith(ctx, res, 'Urutan lampiran diperbarui.', 'success', `/academy/library/${out.doc_id}`);
}));

app.post('/academy/library/attachment/:id/delete', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const out = lms.deleteDocAttachment(db, req.params.id);
  if (!out.ok) return backWith(ctx, res, out.error, 'error', '/academy/library');
  logAction(ctx, 'lms.doc.attachment.delete', `${out.title}`);
  backWith(ctx, res, `Lampiran "${out.title}" dihapus.`, 'success', `/academy/library/${out.doc_id}`);
}));

app.post('/academy/library/:id/status', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const status = String(req.body.status || '');
  const ok = lms.setDocStatus(db, req.params.id, status);
  const label = { draft: 'Draft', review: 'Review', published: 'Terbit', archived: 'Arsip' }[status] || status;
  logAction(ctx, 'lms.doc.status', `doc ${req.params.id} → ${status}`);
  backWith(ctx, res, ok ? `Status dokumen diubah menjadi ${label}.` : 'Status tidak valid.', ok ? 'success' : 'error',
    req.body._back || '/academy/library');
}));

app.get('/academy/manage', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const courses = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM lms_questions q WHERE q.course_id = c.id) quiz_count
    FROM lms_courses c ORDER BY c.sort_order, c.code`).all();
  const stats = {
    total: courses.length,
    published: courses.filter((c) => c.status === 'published').length,
    review: courses.filter((c) => c.status === 'review').length,
    questions: db.prepare('SELECT COUNT(*) c FROM lms_questions').get().c,
    docs: db.prepare('SELECT COUNT(*) c FROM lms_docs').get().c,
    avgDuration: courses.length ? Math.round(courses.reduce((a, c) => a + (c.duration_min || 0), 0) / courses.length) : 0,
  };
  const docsPending = db.prepare("SELECT COUNT(*) c FROM lms_docs WHERE status != 'published'").get().c;
  res.send(A.managePage(ctx, { courses, stats, docsPending }));
}));

app.post('/academy/manage/course/:id', guardAny(['lms_manage']), route((req, res) => {
  const ctx = req.ctx;
  const id = Number(req.params.id);
  const course = db.prepare('SELECT * FROM lms_courses WHERE id = ?').get(id);
  if (!course) return backWith(ctx, res, 'Modul tidak ditemukan.', 'error', '/academy/manage');
  const patch = {
    pass_theory: Math.max(0, Math.min(100, Number(req.body.pass_theory) || 0)),
    pass_practical: Math.max(0, Math.min(100, Number(req.body.pass_practical) || 0)),
    version: String(req.body.version || course.version).slice(0, 20),
    status: ['published', 'review', 'draft', 'archived'].includes(req.body.status) ? req.body.status : course.status,
  };
  lms.updateCourseMeta(db, id, patch);
  logAction(ctx, 'lms.course.update', `${course.code} · ambang ${patch.pass_theory}/${patch.pass_practical} · ${patch.status}`);
  backWith(ctx, res, `Modul ${course.code} diperbarui (teori ${patch.pass_theory}, praktik ${patch.pass_practical}, status ${patch.status}).`, 'success', '/academy/manage');
}));

// ---------- fallback ----------
app.use((req, res) => {
  const base = req.headers['x-public-base-path'] || '';
  if (req.user) {
    const ctx = makeCtx(req);
    return res.status(404).send(L.shell(ctx, {
      title: 'Halaman tidak ditemukan',
      active: req.path,
      content: L.card({ title: '404' }, `<p style="font-size:13px;color:var(--ink-soft)">Halaman <code>${U.h(req.path)}</code> tidak tersedia.</p><div class="form-actions"><a class="btn btn-primary btn-sm" href="${ctx.base}/">Kembali ke dashboard</a></div>`),
    }));
  }
  res.redirect(base + '/login');
});

app.use((err, req, res, next) => {
  console.error('[bizdash]', err && err.stack ? err.stack : err);
  const base = req.headers['x-public-base-path'] || '';
  const ctx = (() => { try { return makeCtx(req); } catch (e) { return null; } })();
  if (ctx && ctx.user) {
    return res.status(500).send(L.shell(ctx, {
      title: 'Terjadi kesalahan',
      active: req.path,
      content: L.card({ title: 'Kesalahan server' }, `<p style="font-size:13px;color:var(--ink-soft)">Permintaan tidak dapat diproses. Silakan coba lagi.</p><div class="form-actions"><a class="btn btn-primary btn-sm" href="${ctx.base}/">Kembali ke dashboard</a></div>`),
    }));
  }
  res.status(500).send('Terjadi kesalahan pada server.');
});

process.on('SIGTERM', () => process.exit(0));

app.listen(PORT, () => {
  console.log(`BizDash berjalan di port ${PORT} (db: ${DB_PATH})`);
  reports.startScheduler(db, (msg) => console.log(msg));
});
