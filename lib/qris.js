'use strict';

/**
 * QRIS: pembayaran QR standar Indonesia (EMVCo Merchant Presented Mode).
 *
 * Dua mode, keduanya tanpa mengubah data transaksi lain:
 *  1. `static`  — merchant menempel QRIS statis miliknya (dari bank/PJSP) di pengaturan.
 *                 Server mengubahnya menjadi QRIS **dinamis** (menyisipkan nominal tag 54,
 *                 menandai tag 01 = 12) dan menghitung ulang CRC16. Bisa langsung dipakai
 *                 untuk semua transaksi tanpa kredensial gateway.
 *  2. `midtrans` / `xendit` — bila kredensial gateway diisi, QR dibuat oleh gateway dan
 *                 status pembayaran disinkronkan server-side (polling + webhook).
 *
 * Kunci API hanya dibaca di server dan tidak pernah dikirim ke browser.
 */

const settings = require('./settings');
const U = require('./util');

const PROVIDERS = {
  static: {
    label: 'QRIS statis merchant (dinamis lokal)',
    hint: 'Tempel payload QRIS statis dari bank/PJSP Anda. Nominal diisi otomatis per transaksi.',
  },
  midtrans: {
    label: 'Midtrans',
    hint: 'Butuh Server Key Midtrans. QRIS dibuat via Core API (/v2/charge, acquirer gopay).',
  },
  xendit: {
    label: 'Xendit',
    hint: 'Butuh Secret Key Xendit. QRIS dibuat via /qr_codes (DYNAMIC).',
  },
};

const STATUS = {
  pending: 'Menunggu pembayaran',
  paid: 'Lunas',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
  failed: 'Gagal',
  refunded: 'Dikembalikan (void)',
};

// ---------------------------------------------------------------- EMVCo / QRIS

function crc16(payload) {
  let crc = 0xffff;
  const str = String(payload);
  for (let i = 0; i < str.length; i += 1) {
    crc ^= str.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseTlv(payload) {
  // HANYA buang spasi di ujung & baris baru hasil copy-paste.
  // Spasi di dalam nilai (mis. nama merchant "ONDEWAY COFFEE") bagian dari panjang tag.
  const str = String(payload || '').replace(/[\r\n\t]/g, '').trim();
  const out = [];
  let i = 0;
  while (i < str.length) {
    if (i + 4 > str.length) throw new Error('Struktur QRIS terpotong.');
    const id = str.slice(i, i + 2);
    const len = Number(str.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isFinite(len)) throw new Error('Tag QRIS tidak valid.');
    const value = str.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error('Panjang nilai QRIS tidak sesuai.');
    out.push({ id, value });
    i += 4 + len;
  }
  return out;
}

function serializeTlv(entries) {
  return entries.map(({ id, value }) => `${id}${String(value.length).padStart(2, '0')}${value}`).join('');
}

function field(entries, id) {
  const row = entries.find((e) => e.id === id);
  return row ? row.value : '';
}

/** Validasi payload QRIS statis (struktur, negara, mata uang, CRC). */
function validate(payload) {
  const raw = String(payload || '').trim();
  if (!raw) return { ok: false, error: 'Payload QRIS kosong.' };
  let entries;
  try {
    entries = parseTlv(raw);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  const ids = new Set(entries.map((e) => e.id));
  if (!ids.has('00')) return { ok: false, error: 'Tag 00 (payload format) tidak ditemukan.' };
  if (!ids.has('59') || !field(entries, '59')) return { ok: false, error: 'Nama merchant (tag 59) tidak ditemukan.' };
  if (!ids.has('63')) return { ok: false, error: 'CRC (tag 63) tidak ditemukan.' };
  if (!/6304[0-9A-Fa-f]{4}$/.test(raw)) return { ok: false, error: 'CRC (tag 63) harus berada di akhir payload.' };
  const body = raw.slice(0, raw.length - 4);
  const expected = crc16(body);
  const actual = field(entries, '63').toUpperCase();
  if (expected !== actual) return { ok: false, error: `CRC QRIS tidak cocok (harus ${expected}).` };
  const currency = field(entries, '53') || '360';
  const country = field(entries, '58') || 'ID';
  if (currency !== '360') return { ok: false, error: 'Mata uang QRIS harus IDR (360).' };
  if (country.toUpperCase() !== 'ID') return { ok: false, error: 'Negara QRIS harus ID (Indonesia).' };
  return {
    ok: true,
    entries,
    merchant: field(entries, '59'),
    city: field(entries, '60'),
    mcc: field(entries, '52'),
    nominal: field(entries, '54'),
    dynamic: field(entries, '01') === '12',
    crc: actual,
    length: raw.length,
  };
}

function formatAmount(value) {
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) throw new Error('Nominal QRIS tidak valid.');
  // QRIS menerima desimal; tulis tanpa desimal bila bulat (lebih aman di banyak aplikasi bank).
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Ubah QRIS statis → QRIS dinamis dengan nominal.
 * Tag 54 (amount) disisipkan sebelum tag 58; tag 01 diubah menjadi 12 (dynamic);
 * tag 63 (CRC) dihitung ulang.
 */
function buildDynamic(staticPayload, amount, opts = {}) {
  const check = validate(staticPayload);
  if (!check.ok) throw new Error(check.error);
  const entries = check.entries.filter((e) => e.id !== '63');
  const set = (id, value) => {
    const row = entries.find((e) => e.id === id);
    if (row) row.value = value;
    else entries.push({ id, value });
  };

  set('01', '12');
  set('54', formatAmount(amount));
  // nominal tetap: hapus tip indicator kalau merchant statis memakainya
  ['55', '56', '57'].forEach((id) => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx >= 0) entries.splice(idx, 1);
  });
  if (opts.reference) {
    // tag 62 (additional data) → sub-tag 05 = reference label, 07 = terminal label
    const sub = [];
    const ref = String(opts.reference).slice(0, 25);
    sub.push({ id: '05', value: ref });
    sub.push({ id: '07', value: String(opts.terminal || 'KASIR').slice(0, 25) });
    set('62', serializeTlv(sub));
  }

  // urutkan berdasarkan nomor tag supaya struktur tetap standar
  entries.sort((a, b) => Number(a.id) - Number(b.id));
  const body = serializeTlv(entries) + '6304';
  return body + crc16(body);
}

// ---------------------------------------------------------------- konfigurasi

function provider(db) {
  const p = settings.get(db, 'qris_provider', 'static');
  return PROVIDERS[p] ? p : 'static';
}

function staticPayload(db) {
  return String(settings.get(db, 'qris_static_payload', '') || '').trim();
}

function expiryMinutes(db) {
  const n = Number(settings.get(db, 'qris_expiry_minutes', 15));
  return Number.isFinite(n) && n >= 1 && n <= 120 ? Math.round(n) : 15;
}

function mode(db) {
  const p = provider(db);
  const payload = staticPayload(db);
  const check = payload ? validate(payload) : { ok: false };
  const key = p === 'midtrans' ? settings.get(db, 'qris_midtrans_server_key')
    : p === 'xendit' ? settings.get(db, 'qris_xendit_secret_key') : '';
  const live = p === 'static' ? check.ok : !!key;
  return {
    provider: p,
    label: PROVIDERS[p].label,
    hint: PROVIDERS[p].hint,
    live,
    merchant: check.ok ? check.merchant : '',
    city: check.ok ? check.city : '',
    payloadValid: check.ok,
    payloadError: check.ok ? '' : (payload ? check.error : 'Belum ada payload QRIS statis.'),
    keyMasked: key ? settings.mask(key) : '',
    production: String(settings.get(db, 'qris_midtrans_production', '0')) === '1',
    expiry: expiryMinutes(db),
    merchantConfigured: !!payload,
  };
}

/** QRIS wajib diverifikasi sebelum transaksi tersimpan bila merchant/gateway sudah siap. */
function enforced(db) {
  const m = mode(db);
  return m.live;
}

function expiresAt(db) {
  // HARUS waktu lokal WIB — dibandingkan dengan nowStamp() (U.localNow), bukan UTC.
  return U.localNow(new Date(Date.now() + expiryMinutes(db) * 60000));
}

function nowStamp() {
  return U.localNow();
}

// ---------------------------------------------------------------- provider HTTP

async function postJson(url, body, headers = {}, auth = '') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers, ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, headers = {}, auth = '') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers, ...(auth ? { Authorization: auth } : {}) },
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function midtransBase(db) {
  return String(settings.get(db, 'qris_midtrans_production', '0')) === '1'
    ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

async function createGateway(db, p, payment) {
  if (p === 'midtrans') {
    const key = settings.get(db, 'qris_midtrans_server_key');
    if (!key) return { ok: false, error: 'Server Key Midtrans belum diisi.' };
    const res = await postJson(`${midtransBase(db)}/v2/charge`, {
      payment_type: 'qris',
      transaction_details: { order_id: payment.reference, gross_amount: Math.round(payment.amount) },
      qris: { acquirer: String(settings.get(db, 'qris_midtrans_acquirer', 'gopay')) },
      custom_expiry: { expiry_duration: expiryMinutes(db), unit: 'minute' },
    }, {}, `Basic ${Buffer.from(`${key}:`).toString('base64')}`);
    if (!res.ok) {
      const msg = (res.json && (res.json.status_message || res.json.error_messages)) || `HTTP ${res.status}`;
      return { ok: false, error: String(Array.isArray(msg) ? msg.join(', ') : msg).slice(0, 200) };
    }
    const actions = Array.isArray(res.json.actions) ? res.json.actions : [];
    const qrAction = actions.find((a) => /generate-qr-code/i.test(a.name || '')) || actions[0] || {};
    return {
      ok: true,
      externalId: String(res.json.transaction_id || payment.reference),
      qrUrl: qrAction.url || '',
      status: mapMidtrans(res.json.transaction_status),
      raw: res.json,
    };
  }
  if (p === 'xendit') {
    const key = settings.get(db, 'qris_xendit_secret_key');
    if (!key) return { ok: false, error: 'Secret Key Xendit belum diisi.' };
    const res = await postJson('https://api.xendit.co/qr_codes', {
      reference_id: payment.reference,
      type: 'DYNAMIC',
      currency: 'IDR',
      amount: Math.round(payment.amount),
    }, {}, `Basic ${Buffer.from(`${key}:`).toString('base64')}`);
    if (!res.ok) {
      const msg = (res.json && (res.json.message || res.json.error_code)) || `HTTP ${res.status}`;
      return { ok: false, error: String(msg).slice(0, 200) };
    }
    return {
      ok: true,
      externalId: String(res.json.id || payment.reference),
      payload: res.json.qr_string || '',
      status: mapXendit(res.json.status),
      raw: res.json,
    };
  }
  return { ok: true, status: 'pending' };
}

function mapMidtrans(status) {
  const s = String(status || '').toLowerCase();
  if (['settlement', 'capture', 'paid'].includes(s)) return 'paid';
  if (['expire', 'expired'].includes(s)) return 'expired';
  if (['cancel', 'cancelled'].includes(s)) return 'cancelled';
  if (['deny', 'failure', 'failed'].includes(s)) return 'failed';
  return 'pending';
}

function mapXendit(status) {
  const s = String(status || '').toUpperCase();
  if (['COMPLETED', 'SUCCEEDED', 'PAID'].includes(s)) return 'paid';
  if (s === 'EXPIRED') return 'expired';
  if (['CANCELLED', 'CANCELED'].includes(s)) return 'cancelled';
  if (s === 'FAILED') return 'failed';
  return 'pending';
}

// ---------------------------------------------------------------- data akses

function find(db, reference) {
  return db.prepare('SELECT * FROM payments WHERE reference = ?').get(String(reference || '').trim());
}

function byId(db, id) {
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(Number(id));
}

function activeForSale(db, saleId) {
  return db.prepare("SELECT * FROM payments WHERE sale_id = ? AND status = 'paid' ORDER BY id DESC LIMIT 1").get(Number(saleId));
}

function newReference(db) {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  for (let i = 0; i < 20; i += 1) {
    const ref = `QR${stamp}${String(Math.floor(Math.random() * 90000) + 10000)}`;
    if (!find(db, ref)) return ref;
  }
  return `QR${stamp}${Date.now().toString().slice(-6)}`;
}

/**
 * Buat sesi pembayaran QRIS.
 * @param {object} db
 * @param {object} opts { companyId, amount, userId, cart, note }
 */
async function create(db, opts) {
  const amount = Math.round(Number(opts.amount) || 0);
  if (amount <= 0) return { ok: false, error: 'Nominal pembayaran tidak valid.' };
  const m = mode(db);
  if (!m.live) {
    return {
      ok: false,
      error: m.provider === 'static'
        ? 'QRIS merchant belum diatur. Buka Pengaturan → Kasir, QRIS & Struk untuk menempel QRIS statis Anda.'
        : `${m.label} belum siap: kredensial belum diisi.`,
    };
  }
  const reference = newReference(db);
  const expires = expiresAt(db);
  const payment = {
    company_id: Number(opts.companyId), reference, provider: m.provider, amount,
    status: 'pending', expires_at: expires,
  };
  db.prepare(`INSERT INTO payments (company_id, reference, method, provider, amount, status, cart, note, expires_at, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    payment.company_id, reference, 'qris', m.provider, amount, 'pending',
    opts.cart ? JSON.stringify(opts.cart).slice(0, 4000) : null,
    String(opts.note || '').slice(0, 200) || null,
    expires, Number(opts.userId) || null, nowStamp(),
  );

  if (m.provider === 'static') {
    let payload;
    try {
      payload = buildDynamic(staticPayload(db), amount, { reference, terminal: String(opts.terminal || 'KASIR').slice(0, 20) });
    } catch (err) {
      db.prepare("UPDATE payments SET status = 'failed' WHERE reference = ?").run(reference);
      return { ok: false, error: err.message };
    }
    db.prepare('UPDATE payments SET payload = ? WHERE reference = ?').run(payload, reference);
    const row = find(db, reference);
    return { ok: true, payment: row, payload, mode: 'static' };
  }

  const gw = await createGateway(db, m.provider, { reference, amount });
  if (!gw.ok) {
    db.prepare("UPDATE payments SET status = 'failed' WHERE reference = ?").run(reference);
    return { ok: false, error: `${m.label}: ${gw.error}` };
  }
  db.prepare('UPDATE payments SET external_id = ?, qr_url = ?, payload = ?, status = ? WHERE reference = ?')
    .run(gw.externalId || null, gw.qrUrl || null, gw.payload || null, gw.status === 'paid' ? 'paid' : 'pending', reference);
  if (gw.status === 'paid') db.prepare('UPDATE payments SET paid_at = ? WHERE reference = ?').run(nowStamp(), reference);
  return { ok: true, payment: find(db, reference), payload: gw.payload || '', qrUrl: gw.qrUrl || '', mode: m.provider };
}

async function sync(db, row) {
  if (!row || row.status !== 'pending') return row;
  if (row.expires_at && row.expires_at < nowStamp()) {
    db.prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending'").run(row.id);
    return byId(db, row.id);
  }
  const m = mode(db);
  if (m.provider === 'static' || m.provider !== row.provider) return row;

  let status = 'pending';
  if (m.provider === 'midtrans') {
    const key = settings.get(db, 'qris_midtrans_server_key');
    if (!key) return row;
    const res = await getJson(`${midtransBase(db)}/v2/${encodeURIComponent(row.reference)}/status`, {},
      `Basic ${Buffer.from(`${key}:`).toString('base64')}`);
    if (!res.ok) return row;
    status = mapMidtrans(res.json.transaction_status);
  } else if (m.provider === 'xendit') {
    const key = settings.get(db, 'qris_xendit_secret_key');
    if (!key || !row.external_id) return row;
    const res = await getJson(`https://api.xendit.co/qr_codes/${encodeURIComponent(row.external_id)}`, {},
      `Basic ${Buffer.from(`${key}:`).toString('base64')}`);
    if (!res.ok) return row;
    status = mapXendit(res.json.status);
  }
  if (status !== 'pending') {
    db.prepare('UPDATE payments SET status = ?, paid_at = ? WHERE id = ? AND status = ?')
      .run(status, status === 'paid' ? nowStamp() : null, row.id, 'pending');
  }
  return byId(db, row.id);
}

function markPaid(db, row, source = 'manual') {
  if (!row || row.status === 'paid') return row;
  if (row.status !== 'pending') return row;
  db.prepare("UPDATE payments SET status = 'paid', paid_at = ?, note = COALESCE(note, ?) WHERE id = ?")
    .run(nowStamp(), `dikonfirmasi: ${source}`.slice(0, 200), row.id);
  return byId(db, row.id);
}

function cancel(db, row, reason = 'dibatalkan kasir') {
  if (!row || row.status !== 'pending') return row;
  db.prepare("UPDATE payments SET status = 'cancelled', note = COALESCE(note, ?) WHERE id = ?")
    .run(String(reason).slice(0, 200), row.id);
  return byId(db, row.id);
}

function bindSale(db, row, sale) {
  db.prepare('UPDATE payments SET sale_id = ?, invoice_no = ?, company_id = COALESCE(company_id, ?) WHERE id = ?')
    .run(sale.id, sale.invoiceNo, sale.companyId || row.company_id, row.id);
}

function refundForSale(db, saleId) {
  db.prepare("UPDATE payments SET status = 'refunded' WHERE sale_id = ? AND status = 'paid'").run(Number(saleId));
}

/**
 * Validasi notifikasi webhook gateway.
 * Midtrans: signature_key = sha512(order_id + status_code + gross_amount + serverKey)
 * Xendit : header x-callback-token harus sama dengan callback token yang disimpan.
 */
function verifySignature(db, body, headers = {}) {
  const p = provider(db);
  if (p === 'midtrans') {
    const key = settings.get(db, 'qris_midtrans_server_key');
    if (!key) return false;
    const crypto = require('crypto');
    const expected = crypto.createHash('sha512')
      .update(`${body.order_id || ''}${body.status_code || ''}${body.gross_amount || ''}${key}`).digest('hex');
    return String(body.signature_key || '') === expected;
  }
  if (p === 'xendit') {
    const token = settings.get(db, 'qris_xendit_callback_token');
    if (!token) return false;
    return String(headers['x-callback-token'] || '') === token;
  }
  return false;
}

function applyNotification(db, body) {
  const p = provider(db);
  const ref = p === 'midtrans' ? String(body.order_id || '') : String(body.reference_id || body.qr_code?.reference_id || '');
  const row = find(db, ref);
  if (!row) return { ok: false, error: 'Referensi tidak dikenal.' };
  const status = p === 'midtrans'
    ? mapMidtrans(body.transaction_status)
    : mapXendit(body.status);
  if (status === 'paid') {
    db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending'").run(nowStamp(), row.id);
  } else if (status !== 'pending') {
    db.prepare('UPDATE payments SET status = ? WHERE id = ? AND status = ?').run(status, row.id, 'pending');
  }
  return { ok: true, reference: ref, status };
}

module.exports = {
  PROVIDERS, STATUS, crc16, parseTlv, serializeTlv, validate, buildDynamic, formatAmount,
  provider, staticPayload, mode, enforced, expiryMinutes, find, byId, activeForSale,
  create, sync, markPaid, cancel, bindSale, refundForSale, verifySignature, applyNotification,
  mapMidtrans, mapXendit, newReference,
};
