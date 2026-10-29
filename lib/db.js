'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { hashPassword } = require('./password');
const U = require('./util');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  parent_id INTEGER,
  level TEXT NOT NULL DEFAULT 'outlet',
  kind TEXT NOT NULL DEFAULT 'outlet',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Permintaan reset password (tautan sekali pakai, 60 menit)
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  request_ip TEXT,
  delivered TEXT NOT NULL DEFAULT 'none'
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

-- Bahan baku (green bean, roasted bean, susu, cup, dst) per entitas
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'kg',
  cost REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_materials_company ON materials(company_id, name);

CREATE TABLE IF NOT EXISTS material_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  note TEXT,
  ref_type TEXT,
  ref_id INTEGER,
  occurred_at TEXT NOT NULL,
  user_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moves_company_date ON material_moves(company_id, occurred_at);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  kind TEXT NOT NULL DEFAULT 'menu',
  price REAL NOT NULL DEFAULT 0,
  price_grosir REAL NOT NULL DEFAULT 0,
  price_distributor REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);

-- Master data POS yang bisa diatur pemilik (jenis menu, kategori, metode bayar, tier, kanal).
-- company_id = 0 berarti berlaku untuk semua entitas.
CREATE TABLE IF NOT EXISTS pos_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  tracks_stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(company_id, kind, code)
);
CREATE INDEX IF NOT EXISTS idx_pos_options_kind ON pos_options(kind, active);

-- Resep: kebutuhan bahan per 1 porsi produk
CREATE TABLE IF NOT EXISTS product_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  material_name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg'
);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON product_recipes(product_id);

-- Pelanggan: B2C (member) & B2B (kafe, kantor, reseller)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'b2c',
  phone TEXT,
  email TEXT,
  company_name TEXT,
  npwp TEXT,
  price_tier TEXT NOT NULL DEFAULT 'retail',
  points INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id, type);

CREATE TABLE IF NOT EXISTS customer_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS promos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'percent',
  value REAL NOT NULL DEFAULT 0,
  min_spend REAL NOT NULL DEFAULT 0,
  max_discount REAL NOT NULL DEFAULT 0,
  member_only INTEGER NOT NULL DEFAULT 0,
  customer_type TEXT NOT NULL DEFAULT 'all',
  buy_product_id INTEGER,
  get_product_id INTEGER,
  buy_qty REAL NOT NULL DEFAULT 1,
  get_qty REAL NOT NULL DEFAULT 1,
  bundle_items TEXT,
  bundle_price REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  usage_limit INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promos_company ON promos(company_id);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  user_id INTEGER,
  customer_id INTEGER,
  channel TEXT NOT NULL DEFAULT 'walkin',
  price_tier TEXT NOT NULL DEFAULT 'retail',
  invoice_no TEXT NOT NULL,
  sold_at TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  promo_id INTEGER,
  promo_label TEXT,
  promo_discount REAL NOT NULL DEFAULT 0,
  points_used INTEGER NOT NULL DEFAULT 0,
  points_value REAL NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  cogs REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'paid',
  source TEXT NOT NULL DEFAULT 'pos',
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_company_date ON sales(company_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  sale_id INTEGER,
  type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_points_customer ON points_ledger(customer_id);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  user_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_company_date ON transactions(company_id, occurred_at);

CREATE TABLE IF NOT EXISTS targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  revenue_target REAL NOT NULL DEFAULT 0,
  profit_target REAL NOT NULL DEFAULT 0,
  UNIQUE(company_id, period)
);

CREATE TABLE IF NOT EXISTS objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  perspective TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  weight REAL NOT NULL DEFAULT 25,
  owner_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  objective_id INTEGER,
  name TEXT NOT NULL,
  perspective TEXT NOT NULL DEFAULT 'financial',
  unit TEXT NOT NULL DEFAULT 'number',
  metric TEXT NOT NULL DEFAULT 'manual',
  target_value REAL NOT NULL DEFAULT 0,
  polarity TEXT NOT NULL DEFAULT 'higher',
  weight REAL NOT NULL DEFAULT 10,
  owner_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kpi_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kpi_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(kpi_id, period)
);

CREATE TABLE IF NOT EXISTS okrs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER,
  status TEXT NOT NULL DEFAULT 'on_track',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS key_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  okr_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'number',
  start_value REAL NOT NULL DEFAULT 0,
  target_value REAL NOT NULL DEFAULT 0,
  current_value REAL NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raci (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  activity TEXT NOT NULL,
  description TEXT,
  responsible_id INTEGER,
  accountable_id INTEGER,
  consulted_ids TEXT,
  informed_ids TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  progress REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 30,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shift_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  shift_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON shift_schedules(date);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  shift_id INTEGER,
  date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  status TEXT NOT NULL DEFAULT 'present',
  late_minutes INTEGER NOT NULL DEFAULT 0,
  work_minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS wa_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  customer_id INTEGER,
  direction TEXT NOT NULL,
  wa_id TEXT NOT NULL,
  name TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT,
  error TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  related_type TEXT,
  related_id INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wa_waid ON wa_messages(wa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_status ON wa_messages(status);

CREATE TABLE IF NOT EXISTS wa_autoreplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  keyword TEXT NOT NULL,
  reply TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  sale_id INTEGER,
  provider TEXT NOT NULL DEFAULT 'manual',
  courier TEXT NOT NULL,
  service TEXT,
  awb TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  cost REAL NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 1000,
  dest_name TEXT,
  dest_phone TEXT,
  dest_area TEXT,
  dest_address TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

CREATE TABLE IF NOT EXISTS shipment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system'
);
CREATE INDEX IF NOT EXISTS idx_ship_events ON shipment_events(shipment_id);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  dest_area TEXT NOT NULL,
  courier TEXT NOT NULL,
  service TEXT NOT NULL,
  base_price REAL NOT NULL DEFAULT 0,
  price_per_kg REAL NOT NULL DEFAULT 0,
  eta_text TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'monthly',
  perks TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  next_due TEXT,
  amount REAL NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status, next_due);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  paid_at TEXT,
  amount REAL NOT NULL DEFAULT 0,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subpay_sub ON subscription_payments(subscription_id, due_date);

CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  customer_id INTEGER,
  customer_name TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);

CREATE TABLE IF NOT EXISTS report_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  recipients TEXT,
  subject TEXT,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fin_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'equity',
  balance REAL NOT NULL DEFAULT 0,
  monthly_depreciation REAL NOT NULL DEFAULT 0,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_company ON fin_accounts(company_id);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'staff',
  parent_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_positions_company ON positions(company_id);

-- Ondeway Coffee Academy (LMS): katalog modul, kuis, asesmen praktik, sertifikasi
CREATE TABLE IF NOT EXISTS lms_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'foundation',
  level TEXT NOT NULL DEFAULT 'FND',
  summary TEXT,
  objectives TEXT,
  relevance TEXT,
  prerequisites TEXT,
  materials TEXT,
  sop TEXT,
  rubric TEXT,
  pass_theory INTEGER NOT NULL DEFAULT 80,
  pass_practical INTEGER NOT NULL DEFAULT 85,
  gate TEXT,
  badge TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  owner TEXT,
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  duration_min INTEGER NOT NULL DEFAULT 30,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lms_courses_track ON lms_courses(track, level);

CREATE TABLE IF NOT EXISTS lms_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL,
  why TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lms_questions_course ON lms_questions(course_id);

CREATE TABLE IF NOT EXISTS lms_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role_target TEXT,
  description TEXT,
  courses TEXT,
  track TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lms_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  assigned_by INTEGER,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'assigned',
  theory_score INTEGER,
  practical_score INTEGER,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_enroll_user ON lms_enrollments(user_id, status);

CREATE TABLE IF NOT EXISTS lms_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  section INTEGER NOT NULL,
  completed_at TEXT,
  UNIQUE(user_id, course_id, section)
);

CREATE TABLE IF NOT EXISTS lms_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  answers TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lms_attempt_user ON lms_attempts(user_id, course_id);

CREATE TABLE IF NOT EXISTS lms_practicals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  assessor_id INTEGER,
  scores TEXT,
  total INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  critical_fail INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lms_practical_user ON lms_practicals(user_id, course_id);

CREATE TABLE IF NOT EXISTS lms_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  track TEXT NOT NULL,
  level TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  issued_by INTEGER,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_lms_cert_user ON lms_certificates(user_id, status);

CREATE TABLE IF NOT EXISTS lms_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  UNIQUE(user_id, badge)
);

CREATE TABLE IF NOT EXISTS lms_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'sop',
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'published',
  owner TEXT,
  effective_date TEXT,
  summary TEXT,
  body TEXT,
  course_code TEXT,
  created_at TEXT NOT NULL
);

-- Lampiran dokumen pustaka (SOP / job aid): video embed atau PDF.
-- Sama seperti materi modul: hanya URL yang disimpan, tidak ada file di server aplikasi.
CREATE TABLE IF NOT EXISTS lms_doc_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'pdf',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  provider TEXT,
  duration_min INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lms_doc_attachments ON lms_doc_attachments(doc_id, sort_order);

-- Materi modul Academy yang bisa ditambah/diubah trainer.
-- kind: text | video | pdf. Video & PDF hanya menyimpan URL embed (tidak ada file di server).
CREATE TABLE IF NOT EXISTS lms_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'text',
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  provider TEXT,
  duration_min INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lms_materials_course ON lms_materials(course_id, sort_order);

-- Tugas proyek untuk Gantt chart (bisa berdampingan dengan aktivitas RACI)
CREATE TABLE IF NOT EXISTS project_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started',
  track TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_range ON project_tasks(start_date, end_date);

-- Pembayaran QRIS (dinamis dari QRIS statis merchant atau via gateway)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  sale_id INTEGER,
  invoice_no TEXT,
  reference TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'qris',
  provider TEXT NOT NULL DEFAULT 'static',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT,
  qr_url TEXT,
  external_id TEXT,
  cart TEXT,
  note TEXT,
  expires_at TEXT,
  paid_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  company_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
`;

// Tambahan kolom untuk database lama (idempotent, dijalankan dalam satu transaksi).
const MIGRATIONS = [
  ['companies', 'kind', "TEXT NOT NULL DEFAULT 'outlet'"],
  ['products', 'kind', "TEXT NOT NULL DEFAULT 'menu'"],
  ['products', 'price_grosir', 'REAL NOT NULL DEFAULT 0'],
  ['products', 'price_distributor', 'REAL NOT NULL DEFAULT 0'],
  ['sales', 'customer_id', 'INTEGER'],
  ['sales', 'channel', "TEXT NOT NULL DEFAULT 'walkin'"],
  ['sales', 'price_tier', "TEXT NOT NULL DEFAULT 'retail'"],
  ['sales', 'promo_id', 'INTEGER'],
  ['sales', 'promo_label', 'TEXT'],
  ['sales', 'promo_discount', 'REAL NOT NULL DEFAULT 0'],
  ['sales', 'points_used', 'INTEGER NOT NULL DEFAULT 0'],
  ['sales', 'points_value', 'REAL NOT NULL DEFAULT 0'],
  ['sales', 'points_earned', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'hourly_rate', 'REAL NOT NULL DEFAULT 0'],
  ['customers', 'wa_opt_in', 'INTEGER NOT NULL DEFAULT 1'],
  ['companies', 'origin_area', 'TEXT'],
  ['companies', 'origin_city', 'TEXT'],
  ['companies', 'origin_zip', 'TEXT'],
  ['companies', 'origin_phone', 'TEXT'],
  ['users', 'onboarded', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'onboarded_at', 'TEXT'],
  // v10: profil pengguna, struktur organisasi, dan gambar
  ['users', 'job_title', 'TEXT'],
  ['users', 'bio', 'TEXT'],
  ['users', 'phone', 'TEXT'],
  ['users', 'location', 'TEXT'],
  ['users', 'photo_url', 'TEXT'],
  ['users', 'cover_url', 'TEXT'],
  ['users', 'position_id', 'INTEGER'],
  ['users', 'manager_id', 'INTEGER'],
  ['users', 'joined_at', 'TEXT'],
  ['companies', 'address', 'TEXT'],
  ['companies', 'phone', 'TEXT'],
  ['companies', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
  ['products', 'image_url', 'TEXT'],
  ['promos', 'image_url', 'TEXT'],
  // v12: laporan keuangan (arus kas, laba rugi, neraca)
  ['transactions', 'cash_group', "TEXT NOT NULL DEFAULT 'operating'"],
  ['fin_accounts', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
  // v19: timeline proyek — aktivitas RACI dapat tanggal mulai sendiri
  ['raci', 'start_date', 'TEXT'],
  // v21: pustaka SOP/job aid bisa disesuaikan sendiri (bukan hanya hasil seed kurikulum)
  ['lms_docs', 'source', "TEXT NOT NULL DEFAULT 'seed'"],
  ['lms_docs', 'updated_at', 'TEXT'],
  ['lms_docs', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
];

function open() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function migrate(db) {
  for (const [table, column, def] of MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
  normaliseRaciStatus(db);
}

/**
 * RACI memakai kosakata status pekerjaan (not_started/in_progress/blocked/done) — sama
 * dengan timeline. Data contoh lama sempat menulis kosakata OKR (on_track/at_risk/off_track),
 * yang membuat badge & filter menampilkan teks mentah. Samakan di sini; idempotent dan
 * hanya menyentuh baris yang masih memakai kosakata lama (OKR sendiri TIDAK diubah).
 */
const RACI_STATUS_ALIASES = { on_track: 'in_progress', at_risk: 'blocked', off_track: 'blocked' };
function normaliseRaciStatus(db) {
  const upd = db.prepare('UPDATE raci SET status = ? WHERE status = ?');
  for (const [from, to] of Object.entries(RACI_STATUS_ALIASES)) upd.run(to, from);
}

// PRNG deterministik supaya data demo selalu sama.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MATERIAL_PROFILES = {
  roastery: [
    ['Green Bean Gayo', 'green_bean', 'kg', 120000, 480, 150],
    ['Green Bean Arabika Toraja', 'green_bean', 'kg', 135000, 260, 100],
    ['Roasted Bean House Blend', 'roasted_bean', 'kg', 190000, 180, 60],
    ['Roasted Bean Gayo', 'roasted_bean', 'kg', 210000, 120, 40],
    ['Kemasan 250g', 'packaging', 'pcs', 2500, 900, 300],
    ['Karton 1kg', 'packaging', 'pcs', 3500, 500, 150],
    ['Label Stiker', 'packaging', 'pcs', 300, 2000, 500],
  ],
  coffeeshop: [
    ['Roasted Bean House Blend', 'roasted_bean', 'kg', 190000, 32, 10],
    ['Susu Fresh Milk', 'dairy', 'liter', 22000, 96, 30],
    ['Gula Aren Cair', 'syrup', 'liter', 38000, 26, 8],
    ['Cup 12oz', 'packaging', 'pcs', 1200, 1400, 400],
    ['Cup 16oz', 'packaging', 'pcs', 1400, 900, 300],
    ['Es Batu', 'other', 'kg', 1000, 120, 40],
    ['Air Filter', 'other', 'liter', 500, 300, 100],
    ['Kemasan 250g', 'packaging', 'pcs', 2500, 260, 80],
  ],
};

function seedDemo(db) {
  const rand = mulberry32(20260817);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + rand() * (b - a);
  const round = (n, step = 1) => Math.round(n / step) * step;
  const now = '2026-01-01 07:00:00';

  // ---------- Struktur perusahaan (kebun → roastery → kafe) ----------
  const insCompany = db.prepare('INSERT INTO companies (name, code, parent_id, level, kind, created_at) VALUES (?,?,?,?,?,?)');
  const holding = insCompany.run('PT Kopi Rimba Nusantara', 'KRN', null, 'holding', 'holding', now).lastInsertRowid;
  const farmUnit = insCompany.run('Kebun & Produksi', 'KRN-FARM', holding, 'unit', 'production', now).lastInsertRowid;
  const shopUnit = insCompany.run('Coffee Shop & Retail', 'KRN-SHOP', holding, 'unit', 'retail', now).lastInsertRowid;
  const roastery = insCompany.run('Roastery & Distribusi Bandung', 'KRN-ROA', farmUnit, 'outlet', 'roastery', now).lastInsertRowid;
  const outlets = {};
  outlets.kmg = insCompany.run('Kopi Rimba Kemang', 'KRN-KMG', shopUnit, 'outlet', 'cafe', now).lastInsertRowid;
  outlets.dgo = insCompany.run('Kopi Rimba Dago', 'KRN-DGO', shopUnit, 'outlet', 'cafe', now).lastInsertRowid;
  outlets.snp = insCompany.run('Kopi Rimba Senopati', 'KRN-SNP', shopUnit, 'outlet', 'cafe', now).lastInsertRowid;
  outlets.sby = insCompany.run('Kopi Rimba Surabaya', 'KRN-SBY', shopUnit, 'outlet', 'cafe', now).lastInsertRowid;

  // ---------- Pengguna ----------
  const insUser = db.prepare('INSERT INTO users (company_id, name, email, password_hash, role, active, created_at) VALUES (?,?,?,?,?,1,?)');
  const users = {};
  users.owner = insUser.run(holding, 'Raka Aditama', 'owner@demo.com', hashPassword('owner123'), 'owner', now).lastInsertRowid;
  users.director = insUser.run(holding, 'Sinta Maharani', 'director@demo.com', hashPassword('director123'), 'director', now).lastInsertRowid;
  users.finance = insUser.run(holding, 'Yuni Pratiwi', 'finance@demo.com', hashPassword('finance123'), 'finance', now).lastInsertRowid;
  users.managerShop = insUser.run(shopUnit, 'Bagas Nugraha', 'manager@demo.com', hashPassword('manager123'), 'manager', now).lastInsertRowid;
  users.managerFarm = insUser.run(farmUnit, 'Pak Hendra', 'roastery@demo.com', hashPassword('roastery123'), 'manager', now).lastInsertRowid;
  users.barista = insUser.run(outlets.kmg, 'Dewi Lestari', 'kasir@demo.com', hashPassword('kasir123'), 'cashier', now).lastInsertRowid;
  users.staff = insUser.run(shopUnit, 'Rio Saputra', 'staff@demo.com', hashPassword('staff123'), 'staff', now).lastInsertRowid;
  users.baristaDago = insUser.run(outlets.dgo, 'Agung Wibowo', 'barista.dago@demo.com', hashPassword('barista123'), 'cashier', now).lastInsertRowid;
  users.baristaSenopati = insUser.run(outlets.snp, 'Salsabila Rahma', 'barista.senopati@demo.com', hashPassword('barista123'), 'cashier', now).lastInsertRowid;
  users.baristaSurabaya = insUser.run(outlets.sby, 'Tono Hartono', 'barista.surabaya@demo.com', hashPassword('barista123'), 'cashier', now).lastInsertRowid;
  users.operator = insUser.run(roastery, 'Yusuf Maulana', 'operator@demo.com', hashPassword('operator123'), 'staff', now).lastInsertRowid;

  // ---------- Bahan baku ----------
  const insMaterial = db.prepare('INSERT INTO materials (company_id, name, category, unit, cost, stock, min_stock, active, created_at) VALUES (?,?,?,?,?,?,?,1,?)');
  const materialFor = (profile, companyId, stockFactor = 1) => {
    for (const [name, cat, unit, cost, stock, min] of MATERIAL_PROFILES[profile]) {
      insMaterial.run(companyId, name, cat, unit, cost, Math.round(stock * stockFactor), min, now);
    }
  };
  materialFor('roastery', farmUnit, 1.2);
  materialFor('roastery', roastery, 0.8);
  materialFor('coffeeshop', shopUnit, 1);
  for (const id of Object.values(outlets)) materialFor('coffeeshop', id, 0.55 + rand() * 0.5);
  // beberapa bahan sengaja di bawah minimum supaya panel restock dashboard terisi
  const setLowStock = db.prepare('UPDATE materials SET stock = ROUND(min_stock * ?, 2) WHERE company_id = ? AND name = ?');
  setLowStock.run(0.35, outlets.kmg, 'Cup 16oz');
  setLowStock.run(0.45, outlets.sby, 'Roasted Bean House Blend');
  setLowStock.run(0.4, roastery, 'Green Bean Gayo');
  setLowStock.run(0.6, outlets.dgo, 'Susu Fresh Milk');

  // ---------- Produk + resep ----------
  const insProduct = db.prepare(`INSERT INTO products (company_id, sku, name, category, kind, price, price_grosir, price_distributor, cost, stock, active, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`);
  const insRecipe = db.prepare('INSERT INTO product_recipes (product_id, material_name, qty, unit) VALUES (?,?,?,?)');
  const costOf = (companyId, materialName) => {
    const row = db.prepare('SELECT cost FROM materials WHERE company_id = ? AND name = ?').get(companyId, materialName);
    return row ? row.cost : 0;
  };
  const addProduct = (opts) => {
    const { companyId, sku, name, category, kind, price, grosir = 0, distributor = 0, stock = 0, recipe = [] } = opts;
    const cost = recipe.reduce((a, r) => a + r.qty * costOf(companyId, r.name), 0);
    const id = insProduct.run(companyId, sku, name, category, kind, price, grosir, distributor, Math.round(cost), stock, now).lastInsertRowid;
    for (const r of recipe) insRecipe.run(id, r.name, r.qty, r.unit || 'kg');
    return { id, name, price, grosir, distributor, cost: Math.round(cost), sku, category, kind, company_id: companyId };
  };

  const menus = [
    ['MN-01', 'Espresso', 'Kopi', 28000, [['Roasted Bean House Blend', 0.018, 'kg'], ['Cup 12oz', 1, 'pcs']]],
    ['MN-02', 'Americano', 'Kopi', 30000, [['Roasted Bean House Blend', 0.018, 'kg'], ['Cup 12oz', 1, 'pcs'], ['Air Filter', 0.2, 'liter']]],
    ['MN-03', 'Kopi Susu Gula Aren', 'Signature', 32000, [['Roasted Bean House Blend', 0.018, 'kg'], ['Susu Fresh Milk', 0.12, 'liter'], ['Gula Aren Cair', 0.02, 'liter'], ['Cup 16oz', 1, 'pcs'], ['Es Batu', 0.15, 'kg']]],
    ['MN-04', 'Cappuccino', 'Kopi', 35000, [['Roasted Bean House Blend', 0.018, 'kg'], ['Susu Fresh Milk', 0.15, 'liter'], ['Cup 12oz', 1, 'pcs']]],
    ['MN-05', 'Caffe Latte', 'Kopi', 36000, [['Roasted Bean House Blend', 0.018, 'kg'], ['Susu Fresh Milk', 0.18, 'liter'], ['Cup 16oz', 1, 'pcs']]],
    ['MN-06', 'Cold Brew', 'Kopi', 38000, [['Roasted Bean House Blend', 0.03, 'kg'], ['Cup 16oz', 1, 'pcs'], ['Es Batu', 0.2, 'kg']]],
    ['MN-07', 'V60 Single Origin Gayo', 'Manual Brew', 45000, [['Roasted Bean Gayo', 0.02, 'kg'], ['Cup 12oz', 1, 'pcs'], ['Air Filter', 0.25, 'liter']]],
    ['MN-08', 'Kopi Tubruk Rimba', 'Kopi', 26000, [['Roasted Bean House Blend', 0.02, 'kg'], ['Cup 12oz', 1, 'pcs']]],
    ['MN-09', 'Es Kopi Rimba 1 Liter', 'Signature', 95000, [['Roasted Bean House Blend', 0.05, 'kg'], ['Susu Fresh Milk', 0.4, 'liter'], ['Gula Aren Cair', 0.05, 'liter'], ['Cup 16oz', 2, 'pcs'], ['Es Batu', 0.4, 'kg']]],
    ['MN-10', 'Gayo Beans 250g (Retail)', 'Biji Kopi', 165000, [['Roasted Bean Gayo', 0.25, 'kg'], ['Kemasan 250g', 1, 'pcs'], ['Label Stiker', 1, 'pcs']]],
    ['MN-11', 'House Blend Beans 250g', 'Biji Kopi', 135000, [['Roasted Bean House Blend', 0.25, 'kg'], ['Kemasan 250g', 1, 'pcs'], ['Label Stiker', 1, 'pcs']]],
  ];
  const shopProducts = menus.map(([sku, name, cat, price, recipe]) => addProduct({
    companyId: shopUnit, sku, name, category: cat, kind: name.includes('Beans') ? 'bean' : 'menu',
    price, stock: 0, recipe: recipe.map(([n, q, u]) => ({ name: n, qty: q, unit: u })),
  }));

  const roastedHouseCost = costOf(farmUnit, 'Roasted Bean House Blend');
  const roastedGayoCost = costOf(farmUnit, 'Roasted Bean Gayo');
  const wholesale = [
    ['BG-01', 'House Blend Roasted 1kg', 'Biji Kopi', 285000, 262000, 248000, [['Roasted Bean House Blend', 1, 'kg'], ['Karton 1kg', 1, 'pcs'], ['Label Stiker', 2, 'pcs']]],
    ['BG-02', 'Gayo Single Origin 1kg', 'Biji Kopi', 330000, 305000, 288000, [['Roasted Bean Gayo', 1, 'kg'], ['Karton 1kg', 1, 'pcs'], ['Label Stiker', 2, 'pcs']]],
    ['BG-03', 'Green Bean Gayo 1kg (Roaster)', 'Green Bean', 175000, 158000, 148000, [['Green Bean Gayo', 1, 'kg']]],
    ['BG-04', 'Green Bean Toraja 1kg (Roaster)', 'Green Bean', 195000, 178000, 168000, [['Green Bean Arabika Toraja', 1, 'kg']]],
    ['BG-05', 'House Blend Roasted 5kg', 'Biji Kopi', 1320000, 1210000, 1150000, [['Roasted Bean House Blend', 5, 'kg'], ['Karton 1kg', 5, 'pcs']]],
  ];
  const roasteryProducts = wholesale.map(([sku, name, cat, retail, grosir, dist, recipe]) => addProduct({
    companyId: farmUnit, sku, name, category: cat, kind: 'bean', price: retail, grosir, distributor: dist,
    stock: Math.round(between(40, 90)), recipe: recipe.map(([n, q, u]) => ({ name: n, qty: q, unit: u })),
  }));

  // ---------- Pelanggan/member ----------
  const insCustomer = db.prepare(`INSERT INTO customers (company_id, name, type, phone, email, company_name, npwp, price_tier, points, active, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`);
  const firstNames = ['Andi', 'Nadia', 'Dimas', 'Kirana', 'Fajar', 'Melati', 'Yoga', 'Rani', 'Bimo', 'Ayu',
    'Hendra', 'Citra', 'Reza', 'Putri', 'Gilang', 'Sari', 'Teguh', 'Intan', 'Bagus', 'Dian',
    'Arif', 'Lestari', 'Wahyu', 'Siska', 'Rizal', 'Mega', 'Aldi', 'Nabila', 'Fikri', 'Vina'];
  const lastNames = ['Pratama', 'Salsabila', 'Prakoso', 'Ayu', 'Ramadhan', 'Putri', 'Kusuma', 'Setiawan',
    'Larasati', 'Wijaya', 'Dewi', 'Fahlevi', 'Maharani', 'Wulandari', 'Santoso', 'Permata', 'Hermawan',
    'Puspasari', 'Budiman', 'Ningsih', 'Utama', 'Amelia', 'Fauzi', 'Safitri', 'Kurniawan', 'Rahma',
    'Maulana', 'Oktaviani', 'Anggara', 'Permana', 'Widiastuti', 'Saputra', 'Anjani', 'Purnomo', 'Hidayat'];
  const b2cNames = [];
  for (let i = 0; i < 240; i++) {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    b2cNames.push(`${first} ${last}`);
  }
  const b2cCustomers = b2cNames.map((name, i) => ({
    id: insCustomer.run(shopUnit, name, 'b2c', `0812${String(30000000 + i * 137).slice(0, 8)}`,
      `${name.toLowerCase().replace(/[^a-z]/g, '.')}@mail.com`, null, null, 'retail',
      Math.round(between(0, 780)), now, `Member sejak ${2024 + (i % 2)}`).lastInsertRowid,
    name, type: 'b2c', tier: 'retail', points: 0,
  }));

  const b2bSeed = [
    ['Kopi Senja Jakarta', 'Daniel Surya', 'PT Kopi Senja', '01.234.567.8-011.000', 'grosir', 1],
    ['Kedai Bumi Bandung', 'Wulan Sari', 'CV Bumi Rasa', '02.345.678.9-012.000', 'grosir', 1],
    ['Ruang Temu Coffee', 'Adit Nugroho', 'PT Ruang Temu', '03.456.789.0-013.000', 'distributor', 1],
    ['Hotel Arunika', 'Sinta Dewi', 'PT Arunika Hospitality', '04.567.890.1-014.000', 'distributor', 1],
    ['Nusa Roastery Medan', 'Bram Sitorus', 'PT Nusa Roastery', '05.678.901.2-015.000', 'distributor', 1],
    ['Kantor Startup Loop', 'Fira Ananda', 'PT Loop Digital', '06.789.012.3-016.000', 'grosir', 1],
    ['Warung Kopi Pak Slamet', 'Slamet Riyadi', 'CV Slamet Jaya', null, 'grosir', 1],
    ['Bakery 88', 'Cindy Halim', 'PT Bakery Delapan', '07.890.123.4-017.000', 'grosir', 1],
    ['Gym Fitmore', 'Rangga Wijaya', 'PT Fitmore Indonesia', null, 'grosir', 1],
    ['Kopi Kampus UI', 'Dr. Hariyanto', 'Koperasi Kampus UI', null, 'distributor', 1],
    ['Resto Sambal Ijo', 'Ibu Ratna', 'CV Sambal Ijo', null, 'grosir', 1],
    ['Co-working Nexus', 'Kevin Tanoto', 'PT Nexus Space', '08.901.234.5-018.000', 'distributor', 1],
  ];
  const b2bCustomers = b2bSeed.map(([companyName, contact, legal, npwp, tier], i) => {
    const points = 0;
    const id = insCustomer.run(farmUnit, contact, 'b2b', `0813${String(50000000 + i * 913).slice(0, 8)}`,
      `order@${companyName.toLowerCase().replace(/[^a-z]/g, '')}.co.id`, legal, npwp, tier, points, now,
      `Langganan sejak ${2023 + (i % 3)}`).lastInsertRowid;
    return { id, name: contact, company: companyName, type: 'b2b', tier, points: 0 };
  });

  // Harga khusus per pelanggan B2B (override tier)
  const insCustPrice = db.prepare('INSERT OR REPLACE INTO customer_prices (customer_id, product_id, price) VALUES (?,?,?)');
  const specialPriceMap = [
    [b2bCustomers[0], roasteryProducts[0], 252000],
    [b2bCustomers[0], roasteryProducts[1], 292000],
    [b2bCustomers[2], roasteryProducts[0], 242000],
    [b2bCustomers[2], roasteryProducts[4], 1120000],
    [b2bCustomers[3], roasteryProducts[1], 285000],
    [b2bCustomers[4], roasteryProducts[2], 145000],
    [b2bCustomers[9], roasteryProducts[4], 1110000],
    [b2bCustomers[11], roasteryProducts[1], 282000],
  ];
  for (const [cust, prod, price] of specialPriceMap) insCustPrice.run(cust.id, prod.id, price);

  // ---------- Promo ----------
  const insPromo = db.prepare(`INSERT INTO promos (company_id, code, name, kind, value, min_spend, max_discount, member_only, customer_type,
      buy_product_id, get_product_id, buy_qty, get_qty, bundle_items, bundle_price, start_date, end_date, usage_limit, used_count, active, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?)`);
  const promoRows = [
    [shopUnit, 'NGOPI10', 'Diskon 10% semua menu', 'percent', 10, 50000, 25000, 0, 'all', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
    [shopUnit, 'HEMAT5K', 'Potongan Rp 5.000', 'amount', 5000, 40000, 0, 0, 'all', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
    [shopUnit, 'GAJIAN15', 'Promo gajian member 15%', 'percent', 15, 75000, 40000, 1, 'all', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
    [shopUnit, null, 'Beli 1 Espresso gratis 1', 'bogo', 0, 0, 0, 0, 'all', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
    [shopUnit, 'PAKETDUA', 'Paket Berdua: Kopi Susu + Americano', 'bundle', 0, 0, 0, 0, 'b2c', null, null, 1, 1,
      JSON.stringify([{ product_id: null, sku: 'MN-03', qty: 1 }, { product_id: null, sku: 'MN-02', qty: 1 }]), 54000, '2026-01-01', '2026-12-31', 0],
    [shopUnit, null, 'Member diskon 5% harian', 'percent', 5, 0, 15000, 1, 'b2c', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
    [farmUnit, 'B2BGROSIR', 'Diskon 3% pembelian biji B2B', 'percent', 3, 800000, 60000, 0, 'b2b', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
    [farmUnit, null, 'Potongan Rp 25.000 pembelian > Rp 1,2 jt', 'amount', 25000, 1200000, 0, 0, 'b2b', null, null, 1, 1, null, 0, '2026-01-01', '2026-12-31', 0],
  ];
  // BOGO: beli Espresso gratis Espresso
  const espresso = shopProducts.find((p) => p.sku === 'MN-01');
  promoRows[3][9] = espresso.id;
  promoRows[3][10] = espresso.id;
  // Bundle: isi product_id berdasarkan SKU
  const bundleDef = JSON.parse(promoRows[4][13]).map((item) => {
    const prod = shopProducts.find((p) => p.sku === item.sku);
    return { product_id: prod ? prod.id : null, qty: item.qty };
  });
  promoRows[4][13] = JSON.stringify(bundleDef);
  const promoIds = promoRows.map((r) => insPromo.run(
    r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[14], r[15], r[16], r[17],
    now,
  ).lastInsertRowid);
  const percentPromos = promoRows
    .map((r, i) => ({ id: promoIds[i], code: r[1], name: r[2], kind: r[3], value: r[4], min: r[5], max: r[6], memberOnly: r[7], company: r[0] }))
    .filter((p) => p.kind === 'percent');

  // ---------- Penjualan historis (Jan - Okt 2026) ----------
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const todayMonth = U.todayISO().slice(0, 7);
  const dayMax = (month) => (month === todayMonth ? Math.max(1, Number(U.todayISO().slice(8, 10)) - 1) : 28);
  const insSale = db.prepare(`INSERT INTO sales (company_id, user_id, customer_id, channel, price_tier, invoice_no, sold_at, subtotal, discount,
      promo_id, promo_label, promo_discount, points_used, points_value, points_earned, total, cogs, payment_method, status, source, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'paid',?,?,?)`);
  const insItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost, line_total) VALUES (?,?,?,?,?,?,?)');
  const pointsOf = new Map();
  for (const c of [...b2cCustomers, ...b2bCustomers]) pointsOf.set(c.id, c.points);
  const monthlyRevenue = {};
  let invoiceSeq = 0;
  const payMethods = ['qris', 'qris', 'qris', 'cash', 'cash', 'debit', 'transfer'];
  const tierPrice = (prod, tier) => {
    if (tier === 'distributor' && prod.distributor) return prod.distributor;
    if (tier === 'grosir' && prod.grosir) return prod.grosir;
    return prod.price;
  };
  const specialPrices = new Map();
  for (const row of db.prepare('SELECT customer_id, product_id, price FROM customer_prices').all()) {
    specialPrices.set(row.customer_id + ':' + row.product_id, row.price);
  }

  const cafeOutlets = [
    { id: outlets.kmg, weight: 1.2, products: shopProducts },
    { id: outlets.dgo, weight: 0.95, products: shopProducts },
    { id: outlets.snp, weight: 1.1, products: shopProducts },
    { id: outlets.sby, weight: 0.85, products: shopProducts },
  ];

  months.forEach((month, mIdx) => {
    const growth = 0.9 + mIdx * 0.028;
    // --- kafe: transaksi B2C & walk-in ---
    for (const outlet of cafeOutlets) {
      const count = Math.round(between(2150, 2600) * outlet.weight * growth);
      let rev = 0;
      for (let i = 0; i < count; i++) {
        const day = String(1 + Math.floor(rand() * dayMax(month))).padStart(2, '0');
        const hour = String(8 + Math.floor(rand() * 14)).padStart(2, '0');
        const minute = String(Math.floor(rand() * 60)).padStart(2, '0');
        const soldAt = `${month}-${day} ${hour}:${minute}:00`;
        const isMember = rand() < 0.58;
        const customer = isMember ? pick(b2cCustomers) : null;
        const tier = 'retail';
        const lineCount = rand() < 0.62 ? 1 : 2;
        const menusOnly = outlet.products.filter((p) => p.kind === 'menu');
        const beansOnly = outlet.products.filter((p) => p.kind === 'bean');
        const chosen = [];
        while (chosen.length < lineCount) {
          const pool = beansOnly.length && rand() < 0.05 ? beansOnly : menusOnly;
          const p = pool[Math.floor(rand() * pool.length)];
          if (!chosen.find((c) => c.id === p.id)) chosen.push(p);
        }
        let subtotal = 0;
        let cogs = 0;
        const lines = chosen.map((p) => {
          const qty = p.kind === 'bean' ? 1 : (rand() < 0.16 ? 2 : 1);
          const price = specialPrices.get((customer ? customer.id : 0) + ':' + p.id) || tierPrice(p, tier);
          subtotal += price * qty;
          cogs += p.cost * qty;
          return { p, qty, price, lineTotal: price * qty };
        });
        // promo: sebagian transaksi memakai promo persen (member/umum)
        let promoDiscount = 0;
        let promoLabel = null;
        let promoId = null;
        if (rand() < 0.14) {
          const candidates = percentPromos.filter((p) => p.company === shopUnit && subtotal >= p.min && (!p.memberOnly || customer));
          if (candidates.length) {
            const pr = pick(candidates);
            promoDiscount = Math.min(pr.max ? pr.max : Infinity, Math.round((subtotal * pr.value) / 100));
            promoLabel = pr.code ? `${pr.name} (${pr.code})` : pr.name;
            promoId = pr.id;
          }
        }
        // poin: tukar sebagian poin untuk member
        let pointsUsed = 0;
        if (customer && rand() < 0.06) {
          const balance = pointsOf.get(customer.id) || 0;
          if (balance >= 100) {
            const maxPoints = Math.min(balance, Math.floor((subtotal - promoDiscount) / 100));
            pointsUsed = Math.floor(maxPoints * between(0.3, 0.9) / 10) * 10;
          }
        }
        const pointsValue = pointsUsed * 100;
        const total = Math.max(0, subtotal - promoDiscount - pointsValue);
        const pointsEarned = customer ? Math.floor(total / 10000) : 0;
        if (customer) pointsOf.set(customer.id, Math.max(0, (pointsOf.get(customer.id) || 0) - pointsUsed + pointsEarned));
        invoiceSeq++;
        const invoiceNo = `INV-${month.replace('-', '')}-${String(invoiceSeq).padStart(5, '0')}`;
        const saleId = insSale.run(
          outlet.id, users.barista, customer ? customer.id : null, customer ? 'b2c' : 'walkin', tier,
          invoiceNo, soldAt, subtotal, promoDiscount + pointsValue, promoId, promoLabel, promoDiscount,
          pointsUsed, pointsValue, pointsEarned, total, cogs, pick(payMethods), 'pos', null, soldAt,
        ).lastInsertRowid;
        for (const line of lines) {
          insItem.run(saleId, line.p.id, line.p.name, line.qty, line.price, line.p.cost, line.lineTotal);
        }
        rev += total;
      }
      monthlyRevenue[outlet.id + ':' + month] = rev;
    }

    // --- roastery: penjualan B2B (biji kopi/karton) & sesekali B2C ---
    const b2bCount = Math.round(between(120, 165) * growth);
    let roaRev = 0;
    for (let i = 0; i < b2bCount; i++) {
      const day = String(1 + Math.floor(rand() * dayMax(month))).padStart(2, '0');
      const soldAt = `${month}-${day} ${10 + Math.floor(rand() * 8)}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00`;
      const customer = rand() < 0.88 ? pick(b2bCustomers) : null;
      const tier = customer ? customer.tier : 'grosir';
      const lineCount = 1 + Math.floor(rand() * 2);
      const chosen = [];
      while (chosen.length < lineCount) {
        const p = roasteryProducts[Math.floor(rand() * roasteryProducts.length)];
        if (!chosen.find((c) => c.id === p.id)) chosen.push(p);
      }
      let subtotal = 0;
      let cogs = 0;
      const lines = chosen.map((p) => {
        const qty = 1 + Math.floor(rand() * 4);
        const price = specialPrices.get((customer ? customer.id : 0) + ':' + p.id) || tierPrice(p, tier);
        subtotal += price * qty;
        cogs += p.cost * qty;
        return { p, qty, price, lineTotal: price * qty };
      });
      let promoDiscount = 0;
      let promoLabel = null;
      let promoId = null;
      if (rand() < 0.2) {
        const pr = percentPromos.find((p) => p.company === farmUnit);
        if (pr && subtotal >= pr.min) {
          promoDiscount = Math.min(pr.max, Math.round((subtotal * pr.value) / 100));
          promoLabel = `${pr.name} (${pr.code})`;
          promoId = pr.id;
        }
      }
      const total = subtotal - promoDiscount;
      invoiceSeq++;
      const invoiceNo = `INV-${month.replace('-', '')}-${String(invoiceSeq).padStart(5, '0')}`;
      const saleId = insSale.run(
        roastery, users.managerFarm, customer ? customer.id : null, customer ? 'b2b' : 'walkin', tier,
        invoiceNo, soldAt, subtotal, promoDiscount, promoId, promoLabel, promoDiscount,
        0, 0, 0, total, cogs, rand() < 0.6 ? 'transfer' : 'debit', 'pos', null, soldAt,
      ).lastInsertRowid;
      for (const line of lines) {
        insItem.run(saleId, line.p.id, line.p.name, line.qty, line.price, line.p.cost, line.lineTotal);
      }
      roaRev += total;
    }
    monthlyRevenue[roastery + ':' + month] = roaRev;
  });

  // sinkronkan poin akhir ke tabel pelanggan + ledger ringkas
  const insLedger = db.prepare('INSERT INTO points_ledger (customer_id, sale_id, type, points, note, created_at) VALUES (?,?,?,?,?,?)');
  const updPoints = db.prepare('UPDATE customers SET points = ? WHERE id = ?');
  for (const [custId, pts] of pointsOf.entries()) {
    updPoints.run(pts, custId);
    if (pts) insLedger.run(custId, null, 'adjust', pts, 'Saldo awal data demo', now);
  }

  // ---------- Beban operasional & pendapatan lain ----------
  const insTx = db.prepare('INSERT INTO transactions (company_id, type, category, description, amount, occurred_at, source, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  const cafeExpenses = [
    ['Sewa Tempat', 45000000, 0.02],
    ['Gaji & Tunjangan Barista', 58000000, 0.06],
    ['Listrik, Air & Internet', 11000000, 0.15],
    ['Marketing & Promosi', 8000000, 0.3],
    ['Perlengkapan & Kebersihan', 9000000, 0.2],
  ];
  const roasteryExpenses = [
    ['Sewa Roastery', 8000000, 0.02],
    ['Gaji Tim Produksi', 8000000, 0.06],
    ['Listrik & Gas Roasting', 2000000, 0.15],
    ['Marketing & Distribusi', 2000000, 0.3],
  ];
  months.forEach((month, mIdx) => {
    for (const outlet of cafeOutlets) {
      for (const [cat, base, variance] of cafeExpenses) {
        const amount = round(base * (1 + between(-variance, variance)) * (1 + mIdx * 0.01), 100000);
        insTx.run(outlet.id, 'expense', cat, `${cat} ${outlet.id === outlets.kmg ? 'Kemang' : ''}`.trim(), amount, `${month}-05`, 'seed', users.finance, now);
      }
    }
    for (const [cat, base, variance] of roasteryExpenses) {
      insTx.run(roastery, 'expense', cat, cat, round(base * (1 + between(-variance, variance)), 100000), `${month}-06`, 'seed', users.finance, now);
    }
    insTx.run(farmUnit, 'expense', 'Perawatan Kebun & Panen', 'Biaya kebun, petik, dan processing', round(between(8000000, 11000000), 100000), `${month}-08`, 'seed', users.finance, now);
    const overhead = [
      ['Gaji Manajemen', 6000000, 0.05],
      ['IT & Software', 2000000, 0.1],
      ['Konsultan & Profesional', 1500000, 0.3],
    ];
    for (const [cat, base, variance] of overhead) {
      insTx.run(holding, 'expense', cat, `${cat} holding`, round(base * (1 + between(-variance, variance)), 100000), `${month}-10`, 'seed', users.finance, now);
    }
    insTx.run(holding, 'income', 'Pendapatan Lain', 'Penjualan ampas kopi & pendapatan bunga', round(between(1200000, 2800000), 100000), `${month}-20`, 'seed', users.finance, now);
  });

  // ---------- Target bulanan per outlet ----------
  const insTarget = db.prepare('INSERT OR REPLACE INTO targets (company_id, period, revenue_target, profit_target) VALUES (?,?,?,?)');
  for (const companyId of [...Object.values(outlets), roastery]) {
    for (const month of months) {
      const rev = monthlyRevenue[companyId + ':' + month] || 0;
      const revTarget = round(rev * between(0.94, 1.1), 1000000) || 30000000;
      insTarget.run(companyId, month, revTarget, round(revTarget * 0.12, 1000000));
    }
  }

  // ---------- Balanced Scorecard ----------
  const insObj = db.prepare('INSERT INTO objectives (company_id, perspective, title, description, weight, owner_id, created_at) VALUES (?,?,?,?,?,?,?)');
  const objectiveSets = [
    {
      company: holding, owner: users.director, items: [
        ['financial', 'Menumbuhkan profit dari kebun sampai cangkir', 'Naikkan margin konsolidasi lewat integrasi kebun, roastery, dan kafe.', 30],
        ['customer', 'Membangun basis member & pelanggan B2B yang loyal', 'Pertumbuhan member aktif dan kontrak B2B berulang.', 25],
        ['process', 'Standar seduh & konsistensi rasa di semua outlet', 'SOP barista, kalibrasi resep, dan kontrol food cost.', 25],
        ['growth', 'Kapabilitas tim kopi & budaya kualitas', 'Sertifikasi barista dan pengembangan tim roasting.', 20],
      ],
    },
    {
      company: shopUnit, owner: users.managerShop, items: [
        ['financial', 'Menaikkan pendapatan kafe 18%', 'Dorong menu signature dan bundling berdua.', 35],
        ['customer', 'Menaikkan repeat order member', 'Program poin dan promo member rutin.', 25],
        ['process', 'Konsistensi resep & food cost 32%', 'Kalibrasi resep dan kontrol waste susu/bahan.', 25],
        ['growth', 'Barista tersertifikasi di setiap shift', 'Program pelatihan dan sertifikasi internal.', 15],
      ],
    },
    {
      company: farmUnit, owner: users.managerFarm, items: [
        ['financial', 'Margin biji kopi B2B 25%', 'Harga tier grosir/distributor yang sehat.', 35],
        ['customer', 'Menambah 12 klien B2B aktif', 'Akuisisi kafe, kantor, dan roastery lain.', 25],
        ['process', 'Konsistensi profil roasting', 'Kontrol batch roasting dan cek kualitas green bean.', 25],
        ['growth', 'Kualitas panen kebun sendiri', 'Perbaikan processing dan sortir green bean.', 15],
      ],
    },
  ];
  const objId = {};
  for (const set of objectiveSets) {
    for (const [persp, title, desc, weight] of set.items) {
      objId[set.company + ':' + persp] = insObj.run(set.company, persp, title, desc, weight, set.owner, now).lastInsertRowid;
    }
  }

  // ---------- KPI ----------
  const insKpi = db.prepare(`INSERT INTO kpis (company_id, objective_id, name, perspective, unit, metric, target_value, polarity, weight, owner_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insEntry = db.prepare('INSERT OR REPLACE INTO kpi_entries (kpi_id, period, value, updated_at) VALUES (?,?,?,?)');
  const kpiSets = [
    [holding, [
      ['Pendapatan konsolidasi', 'financial', 'currency', 'revenue', 1050000000, 'higher', 20, users.director, 0.99],
      ['Margin laba bersih', 'financial', 'percent', 'margin', 8, 'higher', 15, users.director, 0.98],
      ['Rasio HPP terhadap pendapatan', 'financial', 'percent', 'hpp_ratio', 35, 'lower', 10, users.finance, 0.97],
      ['Porsi pendapatan B2B', 'customer', 'percent', 'b2b_share', 22, 'higher', 10, users.managerFarm, 1.01],
      ['Porsi transaksi member', 'customer', 'percent', 'member_share', 62, 'higher', 15, users.managerShop, 0.99],
      ['Rata-rata nilai transaksi', 'process', 'currency', 'avg_ticket', 95000, 'higher', 10, users.managerShop, 0.96],
      ['Skor kepuasan pelanggan (manual)', 'customer', 'number', 'manual', 92, 'higher', 10, users.director, 0.94],
      ['Barista tersertifikasi', 'growth', 'number', 'manual', 16, 'higher', 10, users.staff, 0.81],
    ]],
    [shopUnit, [
      ['Pendapatan kafe bulanan', 'financial', 'currency', 'revenue', 800000000, 'higher', 25, users.managerShop, 1.01],
      ['Margin kotor kafe', 'financial', 'percent', 'gross_margin', 78, 'higher', 15, users.managerShop, 1.0],
      ['Jumlah nota kafe', 'financial', 'number', 'transactions', 11200, 'higher', 10, users.managerShop, 0.97],
      ['Porsi transaksi member', 'customer', 'percent', 'member_share', 62, 'higher', 15, users.managerShop, 0.99],
      ['Food cost ratio (HPP/pendapatan)', 'process', 'percent', 'hpp_ratio', 22, 'lower', 15, users.finance, 0.93],
      ['Member baru per bulan', 'growth', 'number', 'manual', 40, 'higher', 10, users.staff, 0.86],
      ['Rating pelanggan (manual)', 'customer', 'ratio', 'manual', 4.7, 'higher', 10, users.managerShop, 0.98],
    ]],
    [farmUnit, [
      ['Pendapatan biji kopi', 'financial', 'currency', 'revenue', 255000000, 'higher', 25, users.managerFarm, 1.01],
      ['Margin kotor biji kopi', 'financial', 'percent', 'gross_margin', 22, 'higher', 15, users.managerFarm, 0.94],
      ['Porsi pendapatan B2B', 'customer', 'percent', 'b2b_share', 85, 'higher', 15, users.managerFarm, 1.0],
      ['Klien B2B aktif', 'growth', 'number', 'manual', 15, 'higher', 15, users.managerFarm, 0.87],
      ['Susut roasting (manual %)', 'process', 'percent', 'manual', 15, 'lower', 15, users.staff, 0.93],
      ['Kapasitas panen terserap (%)', 'process', 'percent', 'manual', 85, 'higher', 15, users.staff, 0.9],
    ]],
  ];
  for (const [company, rows] of kpiSets) {
    for (const [name, persp, unit, metric, target, polarity, weight, owner, ratio] of rows) {
      const id = insKpi.run(company, objId[company + ':' + persp], name, persp, unit, metric, target, polarity, weight, owner, now).lastInsertRowid;
      if (metric === 'manual') {
        for (const [period, factor] of [['2026-08', 0.94], ['2026-09', 0.99], ['2026-10', 1.0]]) {
          insEntry.run(id, period, Math.round(target * ratio * factor * 100) / 100, now);
        }
      }
    }
  }

  // ---------- OKR ----------
  const insOkr = db.prepare('INSERT INTO okrs (company_id, period, title, description, owner_id, status, created_at) VALUES (?,?,?,?,?,?,?)');
  const insKr = db.prepare('INSERT INTO key_results (okr_id, title, unit, start_value, target_value, current_value, weight, updated_at) VALUES (?,?,?,?,?,?,?,?)');
  const okrSets = [
    [holding, '2026-Q4', 'Jadi brand kopi specialty #1 di Jabodetabek', 'Integrasi kebun–roastery–kafe sebagai pembeda utama.', users.director, 'on_track', [
      ['Pendapatan konsolidasi Q4', 'currency', 0, 3300000000, 1074000000, 2],
      ['Member aktif bertransaksi', 'number', 0, 300, 168, 2],
      ['Klien B2B aktif', 'number', 12, 20, 12, 1],
      ['Margin laba bersih Q4', 'percent', 6, 10, 8.2, 1],
    ]],
    [shopUnit, '2026-Q4', 'Kopi Rimba jadi ritual harian pelanggan', 'Naikkan frekuensi kunjungan member dan penjualan beans retail.', users.managerShop, 'at_risk', [
      ['Pendapatan kafe Q4', 'currency', 0, 2500000000, 813000000, 3],
      ['Member baru Q4', 'number', 0, 300, 96, 2],
      ['Porsi transaksi member', 'percent', 58, 65, 66, 2],
      ['Food cost ratio', 'percent', 22, 20, 19.8, 1],
    ]],
    [farmUnit, '2026-Q4', 'Roastery jadi pemasok utama kafe premium', 'Kontrak pasokan rutin untuk kafe dan hotel.', users.managerFarm, 'on_track', [
      ['Volume biji terjual (kg)', 'number', 0, 1200, 410, 3],
      ['Klien B2B baru', 'number', 0, 8, 3, 2],
      ['Margin biji B2B', 'percent', 19, 24, 20.9, 2],
      ['Susut roasting', 'percent', 16, 14, 14.8, 1],
    ]],
  ];
  for (const [company, period, title, desc, owner, status, krs] of okrSets) {
    const okrId = insOkr.run(company, period, title, desc, owner, status, now).lastInsertRowid;
    for (const [krTitle, unit, start, target, current, weight] of krs) {
      insKr.run(okrId, krTitle, unit, start, target, current, weight, now);
    }
  }

  // ---------- Shift, jadwal, dan absensi ----------
  const insShift = db.prepare('INSERT INTO shifts (company_id, name, start_time, end_time, break_minutes, active, created_at) VALUES (?,?,?,?,?,1,?)');
  const shiftTemplates = [
    ['Shift Pagi', '08:00', '16:00', 30],
    ['Shift Siang', '11:00', '19:00', 30],
    ['Shift Sore', '14:00', '22:00', 30],
  ];
  const shiftIds = {};
  const shiftRows = [];
  for (const outletId of [...Object.values(outlets), roastery]) {
    shiftIds[outletId] = [];
    for (const [name, start, end, brk] of shiftTemplates) {
      const id = insShift.run(outletId, name, start, end, brk, now).lastInsertRowid;
      shiftIds[outletId].push(id);
      shiftRows.push({ id, outletId, start, end, brk });
    }
  }

  const insSchedule = db.prepare('INSERT OR IGNORE INTO shift_schedules (company_id, user_id, shift_id, date, note, created_at) VALUES (?,?,?,?,?,?)');
  const insAttendance = db.prepare(`INSERT OR REPLACE INTO attendance
    (company_id, user_id, shift_id, date, clock_in, clock_out, status, late_minutes, work_minutes, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

  // barista + kasir per outlet (staff unit ikut jadwal di Kemang)
  const crew = [
    { user: users.barista, outlet: outlets.kmg, rate: 24000 },
    { user: users.staff, outlet: outlets.kmg, rate: 22000 },
    { user: users.baristaDago, outlet: outlets.dgo, rate: 23000 },
    { user: users.baristaSenopati, outlet: outlets.snp, rate: 23500 },
    { user: users.baristaSurabaya, outlet: outlets.sby, rate: 21500 },
    { user: users.operator, outlet: roastery, rate: 20000 },
  ];
  for (const c of crew) db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(c.rate, c.user);
  db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(30000, users.managerShop);
  db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(32000, users.managerFarm);
  db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(45000, users.finance);
  db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(60000, users.director);
  db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?').run(85000, users.owner);

  const todayIso = U.todayISO();
  const todayDay = Number(todayIso.slice(8, 10));
  const monthPrefix = todayIso.slice(0, 7);
  const prevPrefix = U.addMonths(monthPrefix, -1);
  const timeToMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + m;
  };

  const buildMonth = (prefix, days, skipToday) => {
    for (let d = 1; d <= days; d++) {
      const date = `${prefix}-${String(d).padStart(2, '0')}`;
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();
      crew.forEach((member, idx) => {
        if (dow === 2 && idx === 1) return; // satu hari libur per minggu untuk staff
        const options = shiftIds[member.outlet] || [];
        if (!options.length) return;
        const shiftId = options[(d + idx) % options.length];
        insSchedule.run(member.outlet, member.user, shiftId, date, dow === 0 ? 'Weekend ramai' : null, now);
        if (skipToday && date === todayIso) return;
        const shift = shiftRows.find((s) => s.id === shiftId);
        const late = rand() < 0.16 ? Math.round(between(4, 28)) : 0;
        const absent = rand() < 0.04;
        if (absent) {
          insAttendance.run(member.outlet, member.user, shiftId, date, null, null, 'absent', 0, 0, 'Tanpa keterangan', now);
          return;
        }
        const startMin = timeToMin(shift.start) + late;
        const worked = Math.round(between(430, 520));
        const clockIn = `${date} ${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}:00`;
        const endMin = startMin + worked;
        const clockOut = `${date} ${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`;
        insAttendance.run(member.outlet, member.user, shiftId, date, clockIn, clockOut,
          late > 0 ? 'late' : 'present', late, worked - shift.brk, late > 0 ? 'Terjabat macet' : null, now);
      });
    }
  };
  buildMonth(prevPrefix, 28, false);
  buildMonth(monthPrefix, Math.max(1, todayDay - 1), false);
  // hari ini: barista Kemang tercatat masuk hanya jika jam sekarang sudah lewat jam shift
  const todayShift = shiftIds[outlets.kmg][0];
  const todayShiftRow = shiftRows.find((s) => s.id === todayShift);
  const inMin = timeToMin(todayShiftRow.start) + 6;
  const nowMin = timeToMin(U.localNow().slice(11, 16));
  insSchedule.run(outlets.kmg, users.barista, todayShift, todayIso, null, now);
  if (nowMin > inMin) {
    insAttendance.run(outlets.kmg, users.barista, todayShift, todayIso,
      `${todayIso} ${String(Math.floor(inMin / 60)).padStart(2, '0')}:${String(inMin % 60).padStart(2, '0')}:00`,
      null, 'late', 6, 0, null, now);
  }

  // ---------- RACI ----------
  const insRaci = db.prepare(`INSERT INTO raci (company_id, activity, description, responsible_id, accountable_id, consulted_ids, informed_ids, status, progress, due_date, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const raciRows = [
    [holding, 'Peluncuran single origin Gayo edisi terbatas', 'Dari panen kebun sendiri sampai menu V60 di semua outlet.', users.managerFarm, users.owner, [users.managerShop, users.director], [users.finance], 'in_progress', 55, '2026-11-25'],
    [holding, 'Integrasi sistem POS + membership baru', 'Rollout POS resep, poin member, dan promo ke 4 kafe.', users.finance, users.owner, [users.managerShop], [users.director], 'in_progress', 70, '2026-12-05'],
    [holding, 'Kontrak pasokan dengan 3 hotel Jabodetabek', 'Negosiasi harga distributor dan volume bulanan.', users.managerFarm, users.director, [users.finance], [users.owner], 'in_progress', 40, '2026-12-20'],
    [shopUnit, 'Kampanye "Ngopi Setiap Hari" untuk member', 'Program poin ganda dan bundling berdua.', users.staff, users.managerShop, [users.finance], [users.owner], 'in_progress', 35, '2026-11-15'],
    [shopUnit, 'Sertifikasi barista batch 4', 'Pelatihan resep baru dan uji seduh.', users.staff, users.managerShop, [users.managerFarm], [users.director], 'not_started', 0, '2026-12-10'],
    [farmUnit, 'Audit kualitas green bean panen Oktober', 'Cupping test dan sortir defect.', users.managerFarm, users.director, [users.finance], [users.owner, users.staff], 'done', 100, '2026-10-18'],
    [farmUnit, 'Perbaikan profil roasting House Blend', 'Uji batch 5 profil lalu tetapkan standar.', users.staff, users.managerFarm, [users.managerShop], [users.director], 'blocked', 25, '2026-11-30'],
  ];
  for (const [company, activity, desc, r, a, c, i, status, progress, due] of raciRows) {
    insRaci.run(company, activity, desc, r, a, c.join(','), i.join(','), status, progress, due, now);
  }
}

// Rate default per role (Rp/jam) untuk estimasi biaya tenaga kerja.
const DEFAULT_RATES = { owner: 85000, director: 60000, manager: 30000, finance: 45000, cashier: 23000, staff: 22000 };

// Melengkapi DB lama (atau DB tanpa seed absensi) dengan shift, tarif, jadwal, dan riwayat absensi.
// Idempotent: berhenti bila sudah ada shift.
function seedAttendance(db) {
  const shiftCount = db.prepare('SELECT COUNT(*) c FROM shifts').get().c;
  if (shiftCount > 0) return;

  const rand = mulberry32(913571);
  const between = (a, b) => a + rand() * (b - a);
  const now = U.nowISO();
  const companies = db.prepare("SELECT id, name, level FROM companies WHERE level IN ('outlet','unit')").all();
  if (!companies.length) return;

  const insShift = db.prepare('INSERT INTO shifts (company_id, name, start_time, end_time, break_minutes, active, created_at) VALUES (?,?,?,?,?,1,?)');
  const shiftRows = [];
  const byCompany = new Map();
  for (const co of companies) {
    const list = [];
    for (const [name, start, end] of [['Shift Pagi', '08:00', '16:00'], ['Shift Siang', '11:00', '19:00'], ['Shift Sore', '14:00', '22:00']]) {
      const id = insShift.run(co.id, name, start, end, 30, now).lastInsertRowid;
      list.push({ id, start, end, companyId: co.id });
      shiftRows.push({ id, start, end, companyId: co.id });
    }
    byCompany.set(co.id, list);
  }

  // tarif default untuk pengguna yang belum punya tarif
  const users = db.prepare('SELECT id, role, company_id, hourly_rate FROM users WHERE active = 1').all();
  const setRate = db.prepare('UPDATE users SET hourly_rate = ? WHERE id = ?');
  for (const u of users) {
    if (!u.hourly_rate) setRate.run(DEFAULT_RATES[u.role] || 22000, u.id);
  }

  // DB demo lama (belum punya barista per outlet): lengkapi akun barista demo agar jadwal terisi.
  const isDemoDb = !!db.prepare("SELECT id FROM users WHERE email = 'owner@demo.com'").get();

  // Pada database milik user (tanpa akun demo) cukup siapkan shift & tarif default:
  // riwayat jadwal/absensi TIDAK dikarang, karena itu data kepegawaian nyata.
  if (!isDemoDb) return;
  let crew = users.filter((u) => ['cashier', 'staff'].includes(u.role) && byCompany.has(u.company_id));
  if (isDemoDb && crew.length < 4) {
    const extra = [
      ['Agung Wibowo', 'barista.dago@demo.com', 'barista123', 'KRN-DGO'],
      ['Salsabila Rahma', 'barista.senopati@demo.com', 'barista123', 'KRN-SNP'],
      ['Tono Hartono', 'barista.surabaya@demo.com', 'barista123', 'KRN-SBY'],
      ['Yusuf Maulana', 'operator@demo.com', 'operator123', 'KRN-ROA'],
    ];
    const insUser = db.prepare('INSERT OR IGNORE INTO users (company_id, name, email, password_hash, role, active, hourly_rate, created_at) VALUES (?,?,?,?,?,1,?,?)');
    for (const [name, email, pass, code] of extra) {
      const co = db.prepare('SELECT id FROM companies WHERE code = ?').get(code);
      if (!co) continue;
      const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (exists) continue;
      const role = email === 'operator@demo.com' ? 'staff' : 'cashier';
      insUser.run(co.id, name, email, hashPassword(pass), role, DEFAULT_RATES[role], now);
    }
    const refreshed = db.prepare('SELECT id, role, company_id, hourly_rate FROM users WHERE active = 1').all();
    crew = refreshed.filter((u) => ['cashier', 'staff'].includes(u.role) && byCompany.has(u.company_id));
  }
  if (!crew.length) {
    // tidak ada barista per outlet: pakai staf unit terdekat agar jadwal tetap bisa dibuat
    const fallback = users.filter((u) => ['cashier', 'staff', 'manager'].includes(u.role));
    for (const u of fallback) {
      const co = companies.find((c) => c.id === u.company_id) || companies[0];
      if (!byCompany.has(co.id)) continue;
      crew.push({ ...u, company_id: co.id });
    }
  }

  const insSchedule = db.prepare('INSERT OR IGNORE INTO shift_schedules (company_id, user_id, shift_id, date, note, created_at) VALUES (?,?,?,?,?,?)');
  const insAttendance = db.prepare(`INSERT OR REPLACE INTO attendance
    (company_id, user_id, shift_id, date, clock_in, clock_out, status, late_minutes, work_minutes, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const timeToMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + m;
  };

  const today = U.todayISO();
  const days = [];
  for (let i = 45; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) - i));
    days.push(d.toISOString().slice(0, 10));
  }
  const nowMin = timeToMin(U.localNow().slice(11, 16));

  days.forEach((date, di) => {
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    crew.forEach((member, ci) => {
      if (dow === 2 && ci % 3 === 1) return; // satu hari libur per minggu
      const options = byCompany.get(member.company_id) || [];
      if (!options.length) return;
      const shift = options[(di + ci) % options.length];
      insSchedule.run(member.company_id, member.id, shift.id, date, null, now);
      const isToday = date === today;
      const startMin = timeToMin(shift.start);
      if (isToday && nowMin <= startMin) return;
      const late = rand() < 0.16 ? Math.round(between(4, 28)) : 0;
      if (!isToday && rand() < 0.04) {
        insAttendance.run(member.company_id, member.id, shift.id, date, null, null, 'absent', 0, 0, 'Tanpa keterangan', now);
        return;
      }
      const inMin = startMin + late;
      const worked = Math.round(between(430, 520));
      const clockIn = `${date} ${String(Math.floor(inMin / 60)).padStart(2, '0')}:${String(inMin % 60).padStart(2, '0')}:00`;
      if (isToday) {
        insAttendance.run(member.company_id, member.id, shift.id, date, clockIn, null, late ? 'late' : 'present', late, 0, null, now);
        return;
      }
      const outMin = Math.min(inMin + worked, 23 * 60 + 50);
      const clockOut = `${date} ${String(Math.floor(outMin / 60)).padStart(2, '0')}:${String(outMin % 60).padStart(2, '0')}:00`;
      insAttendance.run(member.company_id, member.id, shift.id, date, clockIn, clockOut,
        late ? 'late' : 'present', late, Math.max(0, outMin - inMin - 30), late ? 'Terlambat' : null, now);
    });
  });
}

const nowIso = () => require('./util').nowISO();

const DEFAULT_SETTINGS = {
  brand_name: '',
  tax_rate: '0.5',
  wa_provider: 'none',
  wa_token: '',
  wa_phone_id: '',
  wa_api_url: '',
  wa_verify_token: 'bizdash-verify',
  wa_app_secret: '',
  wa_notify_receipt: '1',
  wa_notify_member: '1',
  wa_auto_reply: '1',
  ship_provider: 'manual',
  ship_api_key: '',
  ship_base_url: '',
  ship_couriers: 'jne,jnt,sicepat,anteraja,ninja',
  mail_provider: 'none',
  mail_api_key: '',
  mail_from: 'laporan@kopirimba.id',
  mail_reply_to: '',
  report_enabled: '1',
  report_time: '07:00',
  report_channel: 'whatsapp',
  report_phones: '',
  report_emails: '',
  report_last_run: '',
};

// Kurir & tarif manual (dipakai saat belum ada API key provider).
const MANUAL_RATES = [
  ['Jakarta Selatan', 'jne', 'REG', 9000, 4500, '1-2 hari'],
  ['Jakarta Selatan', 'jnt', 'EZ', 8500, 4200, '1-2 hari'],
  ['Jakarta Selatan', 'sicepat', 'BEST', 10000, 4800, '1 hari'],
  ['Jakarta Selatan', 'anteraja', 'Reguler', 8000, 4000, '1-2 hari'],
  ['Jakarta Selatan', 'ninja', 'Standard', 9500, 4400, '1-2 hari'],
  ['Bandung', 'jne', 'REG', 15000, 7000, '2-3 hari'],
  ['Bandung', 'jnt', 'EZ', 14000, 6500, '2-3 hari'],
  ['Bandung', 'sicepat', 'BEST', 17000, 7500, '1-2 hari'],
  ['Bandung', 'anteraja', 'Reguler', 13000, 6000, '2-3 hari'],
  ['Bandung', 'ninja', 'Standard', 15500, 6800, '2-3 hari'],
  ['Surabaya', 'jne', 'REG', 22000, 9000, '3-4 hari'],
  ['Surabaya', 'jnt', 'EZ', 21000, 8800, '3-4 hari'],
  ['Surabaya', 'sicepat', 'BEST', 24000, 9500, '2-3 hari'],
  ['Surabaya', 'anteraja', 'Reguler', 20000, 8500, '3-4 hari'],
  ['Surabaya', 'ninja', 'Standard', 23000, 9200, '3-4 hari'],
  ['Depok', 'jne', 'REG', 10000, 4800, '1-2 hari'],
  ['Depok', 'jnt', 'EZ', 9500, 4500, '1-2 hari'],
  ['Tangerang', 'jne', 'REG', 11000, 5000, '1-2 hari'],
  ['Tangerang', 'sicepat', 'BEST', 12000, 5200, '1 hari'],
  ['Bekasi', 'jne', 'REG', 10500, 4900, '1-2 hari'],
  ['Bekasi', 'anteraja', 'Reguler', 9500, 4600, '1-2 hari'],
  ['Medan', 'jne', 'REG', 32000, 12000, '4-5 hari'],
  ['Medan', 'sicepat', 'BEST', 34000, 12500, '3-4 hari'],
];

const AUTO_REPLIES = [
  ['menu', 'Halo! Menu favorit kami: Kopi Susu Gula Aren (Rp 32.000), Americano (Rp 30.000), V60 Gayo (Rp 45.000). Biji kopi 250g mulai Rp 135.000. Mau saya bantu pesan? ☕'],
  ['harga', 'Daftar harga terbaru: Espresso 28rb, Americano 30rb, Kopi Susu 32rb, Latte 36rb, Cold Brew 38rb, V60 45rb, Beans 250g 135rb–165rb. Harga B2B (grosir/distributor) tersedia untuk pembelian biji kopi.'],
  ['jam', 'Kami buka setiap hari 08.00–22.00 WIB. Untuk weekend biasanya lebih ramai setelah jam 15.00.'],
  ['buka', 'Kami buka setiap hari 08.00–22.00 WIB. Balas LOKASI untuk info cabang terdekat.'],
  ['lokasi', 'Kami punya beberapa cabang. Balas dengan kota Anda, tim kami kirimkan alamat outlet terdekat beserta jam bukanya.'],
  ['alamat', 'Silakan balas dengan kota/kecamatan Anda — kami kirimkan alamat lengkap outlet terdekat.'],
  ['ongkir', 'Kami melayani pengiriman JNE, JNT, SiCepat, AnterAja, dan Ninja. Kirim kota/tujuan Anda, nanti saya hitung ongkirnya.'],
  ['kirim', 'Pengiriman biji kopi tersedia ke seluruh Indonesia. Untuk pesanan kafe (B2B) silakan tanyakan minimal order dan ongkirnya.'],
  ['poin', 'Setiap Rp 10.000 belanja = 1 poin (1 poin = Rp 100). Tukarkan poin langsung di kasir saat pembayaran berikutnya.'],
  ['member', 'Gratis jadi member! Cukup daftar dengan nama + nomor WhatsApp di kasir, langsung dapat poin dari transaksi pertama.'],
  ['promo', 'Promo terbaru diumumkan lewat WhatsApp dan di kasir. Sebutkan kota Anda, kami kirimkan promo yang berlaku di outlet terdekat.'],
  ['halo', 'Halo! Terima kasih sudah menghubungi kami. Ada yang bisa kami bantu — pesan menu, tanya stok biji kopi, atau cek pengiriman?'],
];


function seedOps(db) {
  const hasSettings = db.prepare('SELECT COUNT(*) c FROM settings').get().c;
  if (!hasSettings) {
    const ins = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)');
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) ins.run(k, v, U.nowISO());
  }

  const rateCount = db.prepare('SELECT COUNT(*) c FROM shipping_rates').get().c;
  if (!rateCount) {
    const ins = db.prepare('INSERT INTO shipping_rates (company_id, dest_area, courier, service, base_price, price_per_kg, eta_text, active) VALUES (?,?,?,?,?,?,?,1)');
    for (const [area, courier, service, base, perKg, eta] of MANUAL_RATES) ins.run(null, area, courier, service, base, perKg, eta);
  }

  const replyCount = db.prepare('SELECT COUNT(*) c FROM wa_autoreplies').get().c;
  if (!replyCount) {
    const ins = db.prepare('INSERT INTO wa_autoreplies (company_id, keyword, reply, active, hits, created_at) VALUES (?,?,?,1,?,?)');
    for (const [kw, reply] of AUTO_REPLIES) ins.run(null, kw, reply, Math.round(Math.random() * 12), U.nowISO());
  }

  // origin pengiriman per outlet (dipakai cek ongkir & label)
  db.prepare("UPDATE companies SET origin_area = COALESCE(origin_area, ?), origin_city = COALESCE(origin_city, ?), origin_zip = COALESCE(origin_zip, ?), origin_phone = COALESCE(origin_phone, ?) WHERE code LIKE 'KRN-KMG%'")
    .run('Jakarta Selatan', 'Jakarta', '12730', '081200010001');
  db.prepare("UPDATE companies SET origin_area = COALESCE(origin_area, ?), origin_city = COALESCE(origin_city, ?), origin_zip = COALESCE(origin_zip, ?), origin_phone = COALESCE(origin_phone, ?) WHERE code LIKE 'KRN-DGO%'")
    .run('Bandung', 'Bandung', '40135', '081200010002');
  db.prepare("UPDATE companies SET origin_area = COALESCE(origin_area, ?), origin_city = COALESCE(origin_city, ?), origin_zip = COALESCE(origin_zip, ?), origin_phone = COALESCE(origin_phone, ?) WHERE code LIKE 'KRN-SNP%'")
    .run('Jakarta Selatan', 'Jakarta', '12190', '081200010003');
  db.prepare("UPDATE companies SET origin_area = COALESCE(origin_area, ?), origin_city = COALESCE(origin_city, ?), origin_zip = COALESCE(origin_zip, ?), origin_phone = COALESCE(origin_phone, ?) WHERE code LIKE 'KRN-SBY%'")
    .run('Surabaya', 'Surabaya', '60271', '081200010004');
  db.prepare("UPDATE companies SET origin_area = COALESCE(origin_area, ?), origin_city = COALESCE(origin_city, ?), origin_zip = COALESCE(origin_zip, ?), origin_phone = COALESCE(origin_phone, ?) WHERE code LIKE 'KRN-ROA%'")
    .run('Bandung', 'Bandung', '40115', '081200010005');

  // ---------- contoh percakapan WhatsApp ----------
  const msgCount = db.prepare('SELECT COUNT(*) c FROM wa_messages').get().c;
  if (!msgCount) {
    const customers = db.prepare(`SELECT id, name, phone, type, company_id FROM customers
      WHERE phone IS NOT NULL AND active = 1 ORDER BY CASE WHEN type='b2b' THEN 0 ELSE 1 END, id LIMIT 6`).all();
    const rules = db.prepare('SELECT keyword, reply FROM wa_autoreplies WHERE active = 1').all();
    const insMsg = db.prepare(`INSERT INTO wa_messages (company_id, customer_id, direction, wa_id, name, body, status, provider, error, is_bot, related_type, related_id, retry_count, created_at, sent_at)
      VALUES (?,?,?,?,?,?,?,?,NULL,?,NULL,NULL,0,?,?)`);
    const nowMs = Date.now();
    const threads = [
      { cust: customers[0], script: [['in', 'Halo, biji kopi Gayo 1kg stoknya ada?'], ['bot', 'menu'], ['in', 'Boleh kirim ke Bandung? berapa ongkirnya?'], ['bot', 'ongkir']] },
      { cust: customers[1], script: [['in', 'kak, jam buka weekend sampai jam berapa?'], ['bot', 'jam']] },
      { cust: customers[2], script: [['in', 'saya mau order 10kg house blend untuk kafe, harga grosirnya berapa?']] },
      { cust: customers[3], script: [['in', 'poin saya kemarin sudah masuk belum ya?'], ['bot', 'poin']] },
      { cust: customers[4], script: [['in', 'ada promo bulan ini?'], ['bot', 'promo'], ['in', 'oke mau pesan paket berdua besok ya']] },
      { cust: customers[5], script: [['in', 'lokasi outlet yang paling dekat stasiun mana?'], ['bot', 'lokasi']] },
    ];
    let offset = 0;
    for (const t of threads) {
      if (!t.cust) continue;
      let clock = nowMs - (threads.length - offset) * 3600 * 1000;
      offset += 1;
      for (const [dir, payload] of t.script) {
        if (dir === 'in') {
          insMsg.run(t.cust.company_id, t.cust.id, 'in', String(t.cust.phone).replace(/[^0-9]/g, ''), t.cust.name,
            payload, 'received', 'manual', 0, U.stampFrom(clock), U.stampFrom(clock));
          clock += 45 * 1000;
        } else {
          const rule = rules.find((r) => r.keyword === payload);
          if (!rule) continue;
          insMsg.run(t.cust.company_id, t.cust.id, 'out', String(t.cust.phone).replace(/[^0-9]/g, ''), t.cust.name,
            rule.reply, 'simulated', 'none', 1, U.stampFrom(clock), U.stampFrom(clock));
          clock += 20 * 1000;
        }
      }
    }

    // notifikasi struk untuk beberapa transaksi member terakhir
    const sales = db.prepare(`SELECT s.id, s.invoice_no, s.total, s.sold_at, s.customer_id, s.company_id, c.name customer_name, c.phone
      FROM sales s JOIN customers c ON c.id = s.customer_id
      WHERE s.status='paid' AND s.customer_id IS NOT NULL AND c.phone IS NOT NULL
      ORDER BY s.id DESC LIMIT 6`).all();
    for (const sale of sales) {
      const body = `Terima kasih ${sale.customer_name.split(' ')[0]}! Pesanan ${sale.invoice_no} sebesar Rp ${Number(sale.total).toLocaleString('id-ID')} sudah kami terima. Sampai jumpa di Kopi Rimba ☕`;
      insMsg.run(sale.company_id, sale.customer_id, 'out', String(sale.phone).replace(/[^0-9]/g, ''), sale.customer_name,
        body, 'simulated', 'none', 1, sale.sold_at, sale.sold_at);
    }
  }

  // ---------- contoh pengiriman + timeline ----------
  const shipCount = db.prepare('SELECT COUNT(*) c FROM shipments').get().c;
  if (!shipCount) {
    const candidates = db.prepare(`SELECT s.id, s.invoice_no, s.total, s.sold_at, s.company_id, s.customer_id,
        c.name customer_name, c.phone, c.company_name
      FROM sales s JOIN customers c ON c.id = s.customer_id
      WHERE s.status='paid' AND s.customer_id IS NOT NULL
      ORDER BY s.id DESC LIMIT 12`).all();
    const insShip = db.prepare(`INSERT INTO shipments (company_id, sale_id, provider, courier, service, awb, status, cost, weight,
      dest_name, dest_phone, dest_area, dest_address, note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insEvent = db.prepare('INSERT INTO shipment_events (shipment_id, status, description, occurred_at, source) VALUES (?,?,?,?,?)');
    const plans = [
      { courier: 'jne', service: 'REG', status: 'delivered', cost: 45000, weight: 3000, area: 'Bandung' },
      { courier: 'sicepat', service: 'BEST', status: 'in_transit', cost: 38000, weight: 2000, area: 'Surabaya' },
      { courier: 'jnt', service: 'EZ', status: 'in_transit', cost: 27000, weight: 1500, area: 'Depok' },
      { courier: 'anteraja', service: 'Reguler', status: 'picked_up', cost: 32000, weight: 5000, area: 'Medan' },
      { courier: 'ninja', service: 'Standard', status: 'pending', cost: 21000, weight: 1000, area: 'Bekasi' },
      { courier: 'jne', service: 'REG', status: 'delivered', cost: 19000, weight: 1000, area: 'Tangerang' },
    ];
    const nowMs = Date.now();
    plans.forEach((plan, idx) => {
      const sale = candidates[idx];
      if (!sale) return;
      const createdMs = nowMs - (idx + 1) * 20 * 3600 * 1000;
      const awb = `${plan.courier.toUpperCase()}${String(10000000 + idx * 137).slice(0, 9)}`;
      const shipId = insShip.run(sale.company_id, sale.id, 'manual', plan.courier, plan.service, awb, plan.status,
        plan.cost, plan.weight, sale.customer_name, sale.phone ? String(sale.phone) : null, plan.area,
        `${plan.area} · alamat pelanggan`, 'Dibuat dari halaman pengiriman',
        U.stampFrom(createdMs), U.stampFrom(nowMs)).lastInsertRowid;

      const steps = [
        ['pending', 'Pesanan diterima, menunggu penjemputan kurir', 0],
        ['picked_up', `Paket dijemput kurir ${plan.courier.toUpperCase()}`, 3],
        ['in_transit', `Paket dalam perjalanan ke ${plan.area}`, 9],
        ['delivered', 'Paket diterima oleh penerima', 26],
      ];
      for (const [status, desc, hours] of steps) {
        const rank = ['pending', 'picked_up', 'in_transit', 'delivered'];
        if (rank.indexOf(status) > rank.indexOf(plan.status)) break;
        insEvent.run(shipId, status, desc, U.stampFrom(createdMs + hours * 3600 * 1000), 'seed');
      }
    });
  }

  // customer.wa_opt_in default aktif (semua pelanggan demo setuju dihubungi)
  db.prepare('UPDATE customers SET wa_opt_in = 1 WHERE wa_opt_in IS NULL').run();
}

// Langganan pelanggan + ulasan produk (idempotent, jalan untuk DB baru maupun lama).
function seedCommercial(db) {
  // Paket langganan menempel ke holding pertama yang ada (bukan id 1 hardcode: DB tanpa
  // data demo tidak punya entitas id 1, dan paket akan jadi yatim).
  const holding = db.prepare(`SELECT id FROM companies
    ORDER BY CASE WHEN level = 'holding' THEN 0 ELSE 1 END, id LIMIT 1`).get();
  const planCount = db.prepare('SELECT COUNT(*) c FROM subscription_plans').get().c;
  if (!planCount && holding) {
    const insPlan = db.prepare(`INSERT INTO subscription_plans (company_id, name, description, price, interval, perks, active, created_at)
      VALUES (?,?,?,?,?,?,1,?)`);
    const plans = [
      ['Kopi Harian Bulanan', '1 cup manual brew / kopi susu setiap hari kerja, bisa diambil di outlet mana pun.', 450000, 'monthly', 'Gratis upgrade size|Prioritas antrean|10% diskon biji kopi'],
      ['Biji Kopi Mingguan', '250g house blend / single origin dikirim tiap minggu, hemat 15%.', 520000, 'monthly', 'Gratis ongkir Jabodetabek|Bisa ganti origin tiap minggu|Akses menu terbatas'],
      ['Paket Kantor (B2B)', '20 cup/hari untuk kebutuhan kantor + biji kopi 2kg per bulan.', 4500000, 'monthly', 'Invoice bulanan|Dedicated account manager|Gratis pinjam alat seduh'],
      ['Langganan Roastery 6 Bulan', 'Pasokan 5kg biji kopi per bulan untuk kafe, harga distributor.', 6600000, 'quarterly', 'Harga distributor terkunci|Sertifikat cupping|Prioritas batch baru'],
    ];
    for (const [name, desc, price, interval, perks] of plans) {
      insPlan.run(holding.id, name, desc, price, interval, perks, nowIso());
    }
  }

  // Langganan & ulasan contoh hanya untuk DB demo. Pada DB milik user, data pelanggan
  // adalah data nyata — jangan dibuatkan langganan/ulasan karangan.
  const isDemoDb = !!db.prepare("SELECT id FROM users WHERE email = 'owner@demo.com'").get();
  const subCount = db.prepare('SELECT COUNT(*) c FROM subscriptions').get().c;
  if (!subCount && isDemoDb) {
    const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY id').all();
    const customers = db.prepare(`SELECT id, name, type, company_id, phone FROM customers
      WHERE active = 1 AND phone IS NOT NULL ORDER BY type DESC, id LIMIT 40`).all();
    const insSub = db.prepare(`INSERT INTO subscriptions (company_id, customer_id, plan_id, status, started_at, next_due, amount, channel, note, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const insPay = db.prepare(`INSERT INTO subscription_payments (subscription_id, due_date, paid_at, amount, method, status, note, created_at)
      VALUES (?,?,?,?,?,?,?,?)`);
    const rand = mulberry32(77123);
    const between = (a, b) => a + rand() * (b - a);
    const today = new Date(U.todayISO() + 'T00:00:00Z');
    const shift = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);

    const picks = customers.slice(0, 22);
    picks.forEach((cust, idx) => {
      const plan = plans[idx % plans.length];
      // sebar status: aktif normal, akan jatuh tempo, menunggak, ditangguhkan
      const bucket = idx % 7;
      let nextDue;
      let status = 'active';
      if (bucket === 1) nextDue = shift(3);
      else if (bucket === 2) nextDue = shift(6);
      else if (bucket === 3) { nextDue = shift(-2); status = 'active'; } // overdue tapi belum ditangguhkan
      else if (bucket === 4) { nextDue = shift(-9); status = 'past_due'; }
      else if (bucket === 5) { nextDue = shift(18); status = 'paused'; }
      else nextDue = shift(Math.round(between(9, 27)));
      const started = shift(-Math.round(between(90, 300)));
      const amount = plan.price;
      const subId = insSub.run(cust.company_id, cust.id, plan.id, status, started, nextDue, amount,
        cust.type === 'b2b' ? 'transfer' : 'qris', null, nowIso()).lastInsertRowid;

      // riwayat pembayaran: beberapa bulan ke belakang, semua lunas kecuali tagihan terakhir yang menunggak
      const historyCount = 2 + (idx % 4);
      for (let h = historyCount; h >= 1; h--) {
        // pembayaran terakhir dibuat baru (10–20 hari lalu) supaya kas bulan berjalan terisi
        const due = shift(-(h * 30 - 18));
        insPay.run(subId, due, due, amount, idx % 3 === 0 ? 'transfer' : 'qris', 'paid', null, nowIso());
      }
      if (status === 'past_due' || (status === 'active' && nextDue < U.todayISO())) {
        insPay.run(subId, nextDue, null, amount, null, 'overdue', 'Menunggu pembayaran', nowIso());
      } else if (bucket === 1 || bucket === 2) {
        insPay.run(subId, nextDue, null, amount, null, 'pending', 'Jatuh tempo dekat', nowIso());
      }
    });
  }

  const reviewCount = db.prepare('SELECT COUNT(*) c FROM product_reviews').get().c;
  if (!reviewCount && isDemoDb) {
    const products = db.prepare("SELECT id, name FROM products WHERE kind = 'menu' AND active = 1").all();
    const customers = db.prepare('SELECT id, name FROM customers WHERE active = 1 ORDER BY id LIMIT 30').all();
    const comments = [
      'Kopi susunya pas, gula arennya kental. Wajib coba.',
      'Aroma biji kopinya kuat, saya suka Americano-nya.',
      'Penyajian cepat, baristanya ramah.',
      'Enak tapi porsi esnya kebanyakan buat saya.',
      'Harga masih masuk akal untuk kualitas seperti ini.',
      'Manual brew-nya bersih, notes buahnya keluar.',
      'Jadi langganan tiap pagi sebelum kerja.',
      'Kemasan biji kopinya rapi, cocok buat hadiah.',
      'Rasa konsisten dari bulan lalu, mantap.',
    ];
    const rand = mulberry32(4242);
    const ins = db.prepare(`INSERT INTO product_reviews (product_id, customer_id, customer_name, rating, comment, created_at)
      VALUES (?,?,?,?,?,?)`);
    for (const prod of products) {
      const n = 3 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        const cust = customers[Math.floor(rand() * customers.length)];
        const rating = rand() < 0.55 ? 5 : rand() < 0.75 ? 4 : 3;
        const comment = comments[Math.floor(rand() * comments.length)];
        const daysAgo = Math.floor(rand() * 60);
        ins.run(prod.id, cust.id, cust.name, rating, comment,
          new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace('T', ' '));
      }
    }
  }
}

/**
 * Struktur jabatan + profil kepegawaian (idempotent).
 * Aman dijalankan pada DB lama: hanya mengisi kolom yang masih kosong dan
 * membuat jabatan yang belum ada, tanpa menyentuh data transaksi.
 */
function seedStructure(db) {
  const companies = db.prepare('SELECT * FROM companies ORDER BY id').all();
  if (!companies.length) return;
  const now = U.nowISO();
  const LEVEL_OF_ROLE = {
    owner: 'owner', director: 'director', manager: 'manager', finance: 'manager', cashier: 'staff', staff: 'staff',
  };
  const TITLES = {
    owner: 'Owner / Pendiri',
    director: 'Direktur',
    manager: 'Manajer',
    finance: 'Finance & Accounting',
    cashier: 'Barista / Kasir',
    staff: 'Staff',
  };
  const TEMPLATE = {
    holding: [['Owner / Pendiri', 'owner'], ['Direktur Utama', 'director'], ['Direktur Operasional', 'director'],
      ['Manajer Keuangan', 'manager'], ['Staff Holding', 'staff']],
    unit: [['Kepala Unit', 'manager'], ['Supervisor Produksi', 'supervisor'], ['Finance & Admin', 'manager'],
      ['Staff Operasional', 'staff']],
    outlet: [['Manajer Outlet', 'manager'], ['Head Barista', 'supervisor'], ['Barista', 'staff'], ['Kasir', 'staff']],
  };

  const insPosition = db.prepare(`INSERT INTO positions (company_id, name, level, parent_id, sort_order, active, created_at)
    VALUES (?,?,?,?,?,1,?)`);

  // Setiap entitas yang belum punya jabatan dilengkapi template-nya (idempotent per entitas),
  // jadi hirarki dengan lebih dari satu holding (mis. setelah data demo dihapus) tetap lengkap.
  {
    const hasPositions = new Set(db.prepare('SELECT DISTINCT company_id FROM positions').all().map((r) => r.company_id));
    const order = [
      ...companies.filter((c) => !c.parent_id),
      ...companies.filter((c) => c.parent_id && c.level === 'unit'),
      ...companies.filter((c) => c.level === 'outlet'),
      ...companies,
    ];
    const created = new Map();
    for (const company of order) {
      if (!company || hasPositions.has(company.id)) continue;
      const kindOf = company.level === 'outlet' ? 'outlet' : (company.parent_id ? 'unit' : 'holding');
      const tpl = TEMPLATE[kindOf] || TEMPLATE.unit;
      let sort = 0;
      let firstId = null;
      for (const [name, level] of tpl) {
        const parent = kindOf === 'holding' ? null : (firstId || (created.get(company.parent_id) || [])[0] || null);
        const id = insPosition.run(company.id, name, level, parent, sort++, now).lastInsertRowid;
        if (!firstId) firstId = id;
      }
      created.set(company.id, [firstId]);
      hasPositions.add(company.id);
    }
  }

  // Lengkapi profil kepegawaian pengguna yang belum punya jabatan.
  const users = db.prepare(`SELECT u.*, c.level company_level, c.parent_id company_parent
    FROM users u LEFT JOIN companies c ON c.id = u.company_id ORDER BY u.id`).all();
  // Urutan pencarian: level yang sesuai → staff → jabatan apa pun di entitas itu.
  const findPosition = (companyId, levelHint) => {
    for (const level of [levelHint, 'staff', null]) {
      const row = level
        ? db.prepare(`SELECT id, name FROM positions WHERE company_id = ? AND level = ? AND active = 1 ORDER BY sort_order, id LIMIT 1`).get(companyId, level)
        : db.prepare('SELECT id, name FROM positions WHERE company_id = ? AND active = 1 ORDER BY sort_order, id LIMIT 1').get(companyId);
      if (row) return row;
    }
    return null;
  };
  const PARENT_OF = new Map(companies.map((c) => [c.id, c.parent_id]));

  for (const user of users) {
    const patch = {};
    if (!user.job_title) {
      const pos = findPosition(user.company_id, LEVEL_OF_ROLE[user.role] || 'staff');
      if (pos) {
        patch.job_title = pos.name;
        patch.position_id = pos.id;
      } else {
        patch.job_title = TITLES[user.role] || 'Staff';
      }
    }
    if (!user.position_id) {
      const pos = findPosition(user.company_id, LEVEL_OF_ROLE[user.role] || 'staff');
      if (pos) patch.position_id = pos.id;
    }
    if (user.role === 'owner' && !patch.job_title && user.job_title !== 'Owner / Pendiri') {
      patch.job_title = 'Owner / Pendiri';
      const ownerPos = db.prepare("SELECT id FROM positions WHERE level = 'owner' AND active = 1 ORDER BY id LIMIT 1").get();
      if (ownerPos) patch.position_id = ownerPos.id;
    }
    if (!user.joined_at) {
      // tanggal bergabung deterministik: 6-26 bulan lalu
      const monthsAgo = 6 + ((user.id * 7) % 21);
      const d = new Date(Date.now() - monthsAgo * 30 * 86400000);
      patch.joined_at = d.toISOString().slice(0, 10);
    }
    if (!user.phone) patch.phone = `08${String(1200000000 + user.id * 7654321).slice(0, 10)}`;
    if (!user.location) {
      const company = companies.find((c) => c.id === user.company_id);
      patch.location = company ? company.name.replace(/^PT\.?\s+/i, '').replace(/^Kopi Rimba\s*/i, '') : null;
    }
    if (!user.manager_id && user.role !== 'owner') {
      // Atasan = pengguna berperan lebih tinggi di entitas yang sama, atau di entitas induknya.
      const chain = [user.company_id];
      let parent = PARENT_OF.get(user.company_id);
      let depth = 0;
      while (parent && depth++ < 6) { chain.push(parent); parent = PARENT_OF.get(parent); }
      // Prioritas: atasan di entitas sendiri, baru naik ke induk (bukan langsung owner).
      const rank = { owner: 0, director: 1, manager: 2, finance: 3, cashier: 4, staff: 5 };
      let boss = null;
      for (const companyId of chain) {
        const candidates = db.prepare(`SELECT id, role FROM users WHERE id != ? AND active = 1 AND company_id = ?
          AND role IN ('owner','director','manager') ORDER BY id`).all(user.id, companyId)
          .filter((c) => rank[c.role] < (rank[user.role] ?? 9));
        if (candidates.length) {
          candidates.sort((a, b) => rank[a.role] - rank[b.role]);
          boss = candidates[0];
          break;
        }
      }
      if (boss) patch.manager_id = boss.id;
    }
    const keys = Object.keys(patch);
    if (keys.length) {
      db.prepare(`UPDATE users SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
        .run(...keys.map((k) => patch[k]), user.id);
    }
  }
}

let instance = null;

function bootstrap(db) {
  db.exec(SCHEMA);
  db.transaction(() => migrate(db))();
  const count = db.prepare('SELECT COUNT(*) AS c FROM companies').get().c;
  if (count === 0) db.transaction(() => seedDemo(db))();
  // pelengkap untuk DB baru maupun lama (idempotent, tidak menghapus data)
  db.transaction(() => {
    seedAttendance(db);
    seedOps(db);
    seedCommercial(db);
    seedStructure(db);
  })();
  // Ondeway Coffee Academy — katalog kurikulum + penugasan awal (idempotent)
  const lms = require('./lms');
  db.transaction(() => lms.seedLms(db))();
  // Master data POS (jenis menu, kategori, metode bayar, tier, kanal) — idempotent
  const posOptions = require('./pos-options');
  db.transaction(() => posOptions.ensureSeed(db))();
}

function getDb() {
  if (!instance) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    instance = open();
    bootstrap(instance);
  }
  return instance;
}

module.exports = { getDb, DB_PATH, MATERIAL_PROFILES };
