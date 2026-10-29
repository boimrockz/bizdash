'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROLE_LABELS = {
  owner: 'Owner / Pemilik',
  director: 'Direktur',
  manager: 'Manajer Unit',
  finance: 'Finance',
  cashier: 'Kasir',
  staff: 'Staff',
};

const ROLE_DESC = {
  owner: 'Akses penuh semua entitas, pengguna, promo, member, dan stok bahan',
  director: 'Lihat konsolidasi semua modul (read-only), kelola performa BSC/KPI/OKR/RACI dan leaderboard',
  manager: 'Kelola POS, keuangan, member, promo, stok, WhatsApp, pengiriman, dan langganan pada unitnya',
  finance: 'Kelola keuangan, POS, import, dan penyesuaian stok bahan',
  cashier: 'Transaksi POS, kelola member, cek ongkir & buat pengiriman, katalog, absen masuk/pulang, training & asesmen rekan',
  staff: 'Lihat dashboard performa, perbarui progres OKR/KPI/RACI, absen masuk/pulang, dan ikuti Academy',
};

const ROLE_CAPS = {
  owner: ['profile', 'dashboard', 'finance_read', 'finance_write', 'pos_read', 'pos_write', 'perf_read', 'perf_write',
    'import', 'admin', 'customer_read', 'customer_write', 'promo_read', 'promo_write', 'inventory_read', 'inventory_write',
    'attendance_read', 'attendance_write', 'schedule_write',
    'wa_read', 'wa_write', 'shipping_read', 'shipping_write', 'design',
    'integration_read', 'integration_write', 'report_read', 'report_write',
    'subscription_read', 'subscription_write', 'catalog_read', 'leaderboard_read', 'mobile_view',
    'export_read', 'structure_read', 'structure_write', 'lms_view', 'lms_assess', 'lms_manage',
    'team_read', 'team_write', 'team_credential'],
  director: ['profile', 'dashboard', 'finance_read', 'pos_read', 'perf_read', 'perf_write', 'import',
    'customer_read', 'promo_read', 'inventory_read', 'attendance_read', 'wa_read', 'shipping_read', 'design',
    'integration_read', 'report_read', 'subscription_read', 'catalog_read', 'leaderboard_read', 'mobile_view',
    'export_read', 'structure_read', 'lms_view', 'lms_assess', 'team_read'],
  manager: ['profile', 'dashboard', 'finance_read', 'finance_write', 'pos_read', 'pos_write', 'perf_read', 'perf_write',
    'import', 'customer_read', 'customer_write', 'promo_read', 'promo_write', 'inventory_read', 'inventory_write',
    'attendance_read', 'attendance_write', 'schedule_write',
    'wa_read', 'wa_write', 'shipping_read', 'shipping_write', 'design',
    'integration_read', 'report_read', 'report_write',
    'subscription_read', 'subscription_write', 'catalog_read', 'leaderboard_read', 'mobile_view',
    'export_read', 'structure_read', 'structure_write', 'lms_view', 'lms_assess', 'lms_manage',
    'team_read', 'team_write'],
  finance: ['profile', 'dashboard', 'finance_read', 'finance_write', 'pos_read', 'pos_write', 'import', 'perf_read',
    'customer_read', 'promo_read', 'inventory_read', 'inventory_write', 'attendance_read',
    'wa_read', 'shipping_read', 'shipping_write', 'design', 'integration_read', 'report_read',
    'subscription_read', 'subscription_write', 'catalog_read', 'leaderboard_read', 'mobile_view',
    'export_read', 'lms_view', 'lms_assess', 'team_read'],
  cashier: ['profile', 'pos_read', 'pos_write', 'customer_read', 'customer_write', 'promo_read', 'inventory_read',
    'attendance_self', 'shipping_read', 'shipping_write', 'catalog_read', 'subscription_read', 'lms_view'],
  staff: ['profile', 'dashboard', 'perf_read', 'perf_write', 'pos_read', 'inventory_read', 'attendance_self', 'catalog_read', 'lms_view'],
};

const SECRET_FILE = path.join(__dirname, '..', '.session-secret');

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const v = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (v) return v;
    }
  } catch (err) { /* ignore */ }
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  } catch (err) { /* ignore */ }
  return secret;
}

const SECRET = getSecret();

function can(user, cap) {
  if (!user) return false;
  const caps = ROLE_CAPS[user.role] || [];
  return caps.includes(cap);
}

function csrfFor(sessionToken) {
  return crypto.createHmac('sha256', SECRET).update(String(sessionToken)).digest('hex').slice(0, 32);
}

function verifyCsrf(sessionToken, token) {
  if (!sessionToken || !token) return false;
  const expected = csrfFor(sessionToken);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildTree(companies) {
  const byId = new Map();
  const childrenOf = new Map();
  for (const c of companies) {
    byId.set(c.id, c);
    if (!childrenOf.has(c.parent_id)) childrenOf.set(c.parent_id, []);
    childrenOf.get(c.parent_id).push(c);
  }
  return { byId, childrenOf };
}

function descendants(companies, rootId) {
  const { childrenOf } = buildTree(companies);
  const out = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    out.push(id);
    for (const child of childrenOf.get(id) || []) stack.push(child.id);
  }
  return out;
}

function ancestors(companies, id) {
  const { byId } = buildTree(companies);
  const out = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 12) {
    out.push(cur.id);
    cur = byId.get(cur.parent_id);
  }
  return out;
}

function scopeIds(companies, user, selectedCompanyId) {
  if (!user) return [];
  if (user.role === 'owner') {
    if (selectedCompanyId) return descendants(companies, selectedCompanyId);
    return companies.map((c) => c.id);
  }
  const ownScope = descendants(companies, user.company_id);
  if (selectedCompanyId && ownScope.includes(selectedCompanyId)) {
    return descendants(companies, selectedCompanyId);
  }
  return ownScope;
}

function companyPath(companies, id) {
  const { byId } = buildTree(companies);
  const parts = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 10) {
    parts.unshift(cur.name);
    cur = byId.get(cur.parent_id);
  }
  return parts.join(' › ');
}

module.exports = {
  ROLE_LABELS, ROLE_DESC, ROLE_CAPS, can, csrfFor, verifyCsrf, buildTree, descendants,
  scopeIds, companyPath, ancestors,
};
