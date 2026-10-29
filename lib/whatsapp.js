'use strict';

const U = require('./util');
const settings = require('./settings');

const PROVIDERS = {
  meta: {
    label: 'WhatsApp Cloud API (Meta resmi)',
    hint: 'Butuh Phone Number ID, access token permanen, dan App Secret untuk verifikasi webhook.',
    configured: (db) => !!(settings.get(db, 'wa_token') && settings.get(db, 'wa_phone_id')),
  },
  fonnte: {
    label: 'Fonnte (gateway lokal)',
    hint: 'Token device Fonnte. Cocok untuk UKM di Indonesia.',
    configured: (db) => !!settings.get(db, 'wa_token'),
  },
  wablas: {
    label: 'Wablas (gateway lokal)',
    hint: 'Token server Wablas, bisa ditambah domain khusus.',
    configured: (db) => !!settings.get(db, 'wa_token'),
  },
  none: {
    label: 'Mode simulasi (belum terhubung)',
    hint: 'Pesan tetap disimpan di kotak keluar dan bisa dikirim ulang setelah kredensial diisi.',
    configured: () => true,
  },
};

const STATUS_LABEL = {
  queued: 'Menunggu',
  sent: 'Terkirim',
  delivered: 'Diterima',
  read: 'Dibaca',
  failed: 'Gagal',
  simulated: 'Simulasi',
  received: 'Masuk',
};

function provider(db) {
  const key = settings.get(db, 'wa_provider', 'none');
  return PROVIDERS[key] ? key : 'none';
}

function mode(db) {
  const p = provider(db);
  return { provider: p, live: p !== 'none' && PROVIDERS[p].configured(db), label: PROVIDERS[p].label };
}

function normalizePhone(raw) {
  let s = String(raw || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
}

function prettyPhone(waId) {
  const s = String(waId || '');
  if (s.startsWith('62')) return '+62 ' + s.slice(2).replace(/(\d{3})(\d{4})(\d*)/, '$1-$2-$3').trim();
  return s;
}

// ---- pengiriman ke API provider (server-side saja; token tidak pernah ke browser) ----
async function callProvider(db, to, body) {
  const p = provider(db);
  const token = settings.get(db, 'wa_token');
  const timeout = 12000;
  const withTimeout = async (url, opts) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  if (p === 'meta') {
    const phoneId = settings.get(db, 'wa_phone_id');
    const url = `${settings.get(db, 'wa_api_url') || 'https://graph.facebook.com/v20.0'}/${phoneId}/messages`;
    const res = await withTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
    return json;
  }
  if (p === 'fonnte') {
    const url = settings.get(db, 'wa_api_url') || 'https://api.fonnte.com/send';
    const res = await withTimeout(url, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ target: to, message: body, countryCode: '62' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === false) throw new Error(json.reason || `HTTP ${res.status}`);
    return json;
  }
  if (p === 'wablas') {
    const base = settings.get(db, 'wa_api_url') || 'https://console.wablas.com';
    const res = await withTimeout(`${base}/api/send-message`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ phone: to, message: body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === false || json.status === 'false') throw new Error(json.message || `HTTP ${res.status}`);
    return json;
  }
  return { simulated: true };
}

function record(db, data) {
  const id = db.prepare(`INSERT INTO wa_messages (company_id, customer_id, direction, wa_id, name, body, status, provider,
      error, is_bot, related_type, related_id, retry_count, created_at, sent_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(data.companyId || null, data.customerId || null, data.direction, data.waId, data.name || null,
      data.body, data.status, data.provider || null, data.error || null, data.isBot ? 1 : 0,
      data.relatedType || null, data.relatedId || null, 0, U.localNow(), data.sentAt || null).lastInsertRowid;
  return id;
}

/**
 * Kirim pesan keluar. Bila provider belum dikonfigurasi, pesan disimpan sebagai 'simulated'
 * (terlihat di kotak keluar, bisa dikirim ulang lewat tombol "Kirim ulang").
 */
async function send(db, opts) {
  const { to, body, name = null, customerId = null, companyId = null, isBot = false, relatedType = null, relatedId = null } = opts;
  const waId = normalizePhone(to);
  if (!waId) return { ok: false, error: 'Nomor WhatsApp tidak valid.' };
  const text = String(body || '').trim();
  if (!text) return { ok: false, error: 'Isi pesan kosong.' };

  const p = provider(db);
  const live = p !== 'none' && PROVIDERS[p].configured(db);
  const id = record(db, {
    companyId, customerId, direction: 'out', waId, name, body: text,
    status: live ? 'queued' : 'simulated', provider: p, isBot, relatedType, relatedId,
  });

  if (!live) return { ok: true, id, simulated: true, status: 'simulated' };

  try {
    await callProvider(db, waId, text);
    db.prepare("UPDATE wa_messages SET status='sent', sent_at=?, error=NULL WHERE id=?").run(U.localNow(), id);
    return { ok: true, id, simulated: false, status: 'sent' };
  } catch (err) {
    db.prepare("UPDATE wa_messages SET status='failed', error=? WHERE id=?").run(String(err.message || err).slice(0, 300), id);
    return { ok: false, id, simulated: false, error: String(err.message || err) };
  }
}

async function retry(db, messageId) {
  const msg = db.prepare('SELECT * FROM wa_messages WHERE id = ?').get(messageId);
  if (!msg) return { ok: false, error: 'Pesan tidak ditemukan.' };
  if (msg.direction !== 'out') return { ok: false, error: 'Hanya pesan keluar yang bisa dikirim ulang.' };
  const p = provider(db);
  const live = p !== 'none' && PROVIDERS[p].configured(db);
  if (!live) {
    db.prepare("UPDATE wa_messages SET status='simulated', provider=?, retry_count=retry_count+1 WHERE id=?").run(p, msg.id);
    return { ok: true, simulated: true };
  }
  try {
    await callProvider(db, msg.wa_id, msg.body);
    db.prepare("UPDATE wa_messages SET status='sent', provider=?, sent_at=?, error=NULL, retry_count=retry_count+1 WHERE id=?")
      .run(p, U.localNow(), msg.id);
    return { ok: true };
  } catch (err) {
    db.prepare("UPDATE wa_messages SET status='failed', provider=?, error=?, retry_count=retry_count+1 WHERE id=?")
      .run(p, String(err.message || err).slice(0, 300), msg.id);
    return { ok: false, error: String(err.message || err) };
  }
}

// ---------- notifikasi otomatis ----------
function receiptMessage({ customerName, invoiceNo, total, pointsEarned, pointsBalance, companyName, brand }) {
  const first = String(customerName || 'Kak').split(' ')[0];
  const lines = [
    `Halo ${first}! Terima kasih sudah ngopi di ${companyName || brand || 'toko kami'} ☕`,
    '',
    `No. pesanan: ${invoiceNo}`,
    `Total: ${U.idr(total)}`,
  ];
  if (pointsEarned) lines.push(`Poin didapat: +${pointsEarned} poin (saldo ${pointsBalance || 0} poin)`);
  lines.push('', 'Tunjukkan pesan ini di kasir untuk menukar poin Anda.');
  return lines.join('\n');
}

async function notifyReceipt(db, saleId) {
  if (!settings.flag(db, 'wa_notify_receipt')) return { skipped: 'notif struk dimatikan' };
  const sale = db.prepare(`SELECT s.*, c.name customer_name, c.phone, c.points, cu.name company_name
    FROM sales s JOIN customers c ON c.id = s.customer_id LEFT JOIN companies cu ON cu.id = s.company_id
    WHERE s.id = ?`).get(saleId);
  if (!sale || !sale.phone) return { skipped: 'pelanggan tanpa nomor WhatsApp' };
  if (!sale.wa_opt_in && sale.wa_opt_in !== undefined) return { skipped: 'pelanggan belum opt-in' };
  const body = receiptMessage({
    customerName: sale.customer_name,
    invoiceNo: sale.invoice_no,
    total: sale.total,
    pointsEarned: sale.points_earned,
    pointsBalance: sale.points,
    companyName: sale.company_name,
    brand: settings.brandName(db),
  });
  return send(db, {
    to: sale.phone, body, name: sale.customer_name, customerId: sale.customer_id,
    companyId: sale.company_id, isBot: true, relatedType: 'sale', relatedId: sale.id,
  });
}

async function notifyMemberWelcome(db, customerId) {
  if (!settings.flag(db, 'wa_notify_member')) return { skipped: 'notif member dimatikan' };
  const c = db.prepare('SELECT c.*, co.name company_name FROM customers c LEFT JOIN companies co ON co.id = c.company_id WHERE c.id = ?').get(customerId);
  if (!c || !c.phone) return { skipped: 'tanpa nomor WhatsApp' };
  const body = c.type === 'b2b'
    ? `Halo ${c.name}! Akun B2B ${c.company_name || ''} sudah terdaftar di ${c.company_name}. Tier harga Anda: ${c.price_tier.toUpperCase()}. Tim kami akan menghubungi untuk detail pengiriman & pembayaran.`
    : `Selamat datang di ${settings.brandName(db)}, ${c.name}! 🎉\nMember Anda aktif. Setiap Rp 10.000 belanja = 1 poin (1 poin = Rp 100). Tukarkan poin langsung di kasir. Sampai jumpa! ☕`;
  return send(db, {
    to: c.phone, body, name: c.name, customerId: c.id, companyId: c.company_id,
    isBot: true, relatedType: 'customer', relatedId: c.id,
  });
}

// ---------- pesan masuk + balasan otomatis ----------
function matchRule(db, text) {
  const rules = db.prepare('SELECT * FROM wa_autoreplies WHERE active = 1').all();
  const norm = String(text || '').toLowerCase();
  const hit = rules.find((r) => {
    const keywords = String(r.keyword || '').toLowerCase().split(',').map((k) => k.trim()).filter(Boolean);
    return keywords.some((k) => k && norm.includes(k));
  });
  return hit || null;
}

function fallbackReply(db) {
  const brand = db ? settings.brandName(db) : 'kami';
  return `Terima kasih atas pesannya! Tim ${brand} akan membalas secepatnya (08.00–22.00 WIB). Balas MENU untuk daftar harga, ONGKIR untuk cek pengiriman, atau POIN untuk info membership.`;
}

function findOrCreateCustomer(db, waId, name) {
  const digits = normalizePhone(waId);
  if (!digits) return null;
  const tail = digits.slice(-8);
  const existing = db.prepare("SELECT * FROM customers WHERE replace(replace(phone,'+',''),'-','') LIKE ? LIMIT 1").get('%' + tail);
  if (existing) return existing;
  const firstCompany = db.prepare("SELECT id FROM companies WHERE level = 'outlet' ORDER BY id LIMIT 1").get();
  if (!firstCompany) return null;
  const id = db.prepare(`INSERT INTO customers (company_id, name, type, phone, price_tier, points, active, note, created_at)
    VALUES (?,?,'b2c',?,'retail',0,1,'Dibuat otomatis dari pesan WhatsApp',?)`)
    .run(firstCompany.id, name || ('WhatsApp ' + tail), '+' + digits, U.nowISO()).lastInsertRowid;
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

/**
 * Tangani pesan masuk (format Meta Cloud API maupun gateway sederhana).
 * Mengembalikan daftar pesan yang diproses + balasan otomatis yang dikirim.
 */
async function handleInbound(db, payload) {
  const parsed = parseInbound(payload);
  const results = [];
  for (const item of parsed) {
    const waId = normalizePhone(item.from);
    if (!waId) continue;
    const customer = findOrCreateCustomer(db, waId, item.name);
    record(db, {
      companyId: customer ? customer.company_id : null,
      customerId: customer ? customer.id : null,
      direction: 'in', waId, name: item.name || (customer && customer.name),
      body: item.body, status: 'received', provider: provider(db),
      relatedType: 'customer', relatedId: customer ? customer.id : null,
    });

    let autoSent = null;
    if (settings.flag(db, 'wa_auto_reply')) {
      const rule = matchRule(db, item.body);
      const reply = rule ? rule.reply : fallbackReply(db);
      if (rule) db.prepare('UPDATE wa_autoreplies SET hits = hits + 1 WHERE id = ?').run(rule.id);
      const res = await send(db, {
        to: waId, body: reply, name: item.name, customerId: customer ? customer.id : null,
        companyId: customer ? customer.company_id : null, isBot: true,
        relatedType: 'auto_reply', relatedId: rule ? rule.id : null,
      });
      autoSent = { rule: rule ? rule.keyword : 'fallback', ...res };
    }
    results.push({ waId, customerId: customer ? customer.id : null, autoSent });
  }
  return { processed: results.length, results };
}

function parseInbound(payload) {
  const out = [];
  if (!payload || typeof payload !== 'object') return out;
  // Meta Cloud API
  if (Array.isArray(payload.entry)) {
    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          const contact = (value.contacts || []).find((c) => c.wa_id === msg.from) || {};
          out.push({
            from: msg.from,
            name: (contact.profile && contact.profile.name) || null,
            body: (msg.text && msg.text.body) || msg.button?.text || msg.interactive?.button_reply?.title || '[pesan non-teks]',
          });
        }
      }
    }
    return out;
  }
  // Gateway sederhana / testing: { sender|phone|from, message|text|body, name }
  const from = payload.from || payload.sender || payload.phone || payload.number;
  const body = payload.message || payload.text || payload.body || payload.pesan;
  if (from && body) out.push({ from, name: payload.name || payload.pushName || null, body: String(body) });
  // format Fonnte: { sender, message, pushname }
  return out;
}

function threads(db, companyIds) {
  const ids = companyIds && companyIds.length ? companyIds : null;
  const where = ids ? `AND (m.company_id IN (${ids.map(() => '?').join(',')}) OR m.company_id IS NULL)` : '';
  const rows = db.prepare(`SELECT m.wa_id, MAX(m.created_at) last_at, COUNT(*) total,
      SUM(CASE WHEN m.direction='in' THEN 1 ELSE 0 END) inbound,
      (SELECT body FROM wa_messages x WHERE x.wa_id = m.wa_id ORDER BY x.id DESC LIMIT 1) last_body,
      (SELECT direction FROM wa_messages x WHERE x.wa_id = m.wa_id ORDER BY x.id DESC LIMIT 1) last_dir,
      (SELECT name FROM wa_messages x WHERE x.wa_id = m.wa_id AND x.name IS NOT NULL ORDER BY x.id DESC LIMIT 1) name,
      (SELECT customer_id FROM wa_messages x WHERE x.wa_id = m.wa_id AND x.customer_id IS NOT NULL ORDER BY x.id DESC LIMIT 1) customer_id
    FROM wa_messages m WHERE 1=1 ${where}
    GROUP BY m.wa_id ORDER BY last_at DESC LIMIT 60`).all(...(ids || []));
  const customerIds = rows.map((r) => r.customer_id).filter(Boolean);
  const customers = new Map();
  if (customerIds.length) {
    const ph = customerIds.map(() => '?').join(',');
    for (const c of db.prepare(`SELECT id, name, type, phone, points, price_tier, company_name FROM customers WHERE id IN (${ph})`).all(...customerIds)) {
      customers.set(c.id, c);
    }
  }
  return rows.map((r) => ({
    ...r,
    displayName: (customers.get(r.customer_id) || {}).name || r.name || prettyPhone(r.wa_id),
    customer: customers.get(r.customer_id) || null,
  }));
}

function conversation(db, waId, limit = 80) {
  return db.prepare(`SELECT * FROM wa_messages WHERE wa_id = ? ORDER BY id DESC LIMIT ?`).all(waId, limit).reverse();
}

function stats(db, companyIds) {
  const ids = companyIds && companyIds.length ? companyIds : null;
  const ph = ids ? ids.map(() => '?').join(',') : null;
  const where = ph ? `WHERE company_id IN (${ph}) OR company_id IS NULL` : '';
  const rows = db.prepare(`SELECT direction, status, COUNT(*) c FROM wa_messages ${where} GROUP BY direction, status`).all(...(ids || []));
  const inbound = rows.filter((r) => r.direction === 'in').reduce((a, r) => a + r.c, 0);
  const out = rows.filter((r) => r.direction === 'out');
  return {
    inbound,
    total: rows.reduce((a, r) => a + r.c, 0),
    sent: out.filter((r) => r.status === 'sent' || r.status === 'delivered').reduce((a, r) => a + r.c, 0),
    simulated: out.filter((r) => r.status === 'simulated').reduce((a, r) => a + r.c, 0),
    failed: out.filter((r) => r.status === 'failed').reduce((a, r) => a + r.c, 0),
    queued: out.filter((r) => r.status === 'queued').reduce((a, r) => a + r.c, 0),
    threads: new Set(db.prepare(`SELECT wa_id FROM wa_messages ${where}`).all(...(ids || [])).map((r) => r.wa_id)).size,
  };
}

function recentOutbox(db, companyIds, limit = 25) {
  const ids = companyIds && companyIds.length ? companyIds : null;
  const ph = ids ? ids.map(() => '?').join(',') : null;
  const where = ph ? `WHERE (company_id IN (${ph}) OR company_id IS NULL)` : '';
  return db.prepare(`SELECT * FROM wa_messages ${where} ORDER BY id DESC LIMIT ?`).all(...(ids || []), limit);
}

function broadcast(db, opts) {
  const { companyId, message, type = 'all', minPoints = 0, limit = 200 } = opts;
  const params = [];
  let where = 'active = 1 AND wa_opt_in = 1 AND phone IS NOT NULL AND phone <> \'\'';
  if (companyId) { where += ' AND company_id = ?'; params.push(companyId); }
  if (type !== 'all') { where += ' AND type = ?'; params.push(type); }
  if (minPoints) { where += ' AND points >= ?'; params.push(minPoints); }
  const rows = db.prepare(`SELECT id, name, phone, company_id FROM customers WHERE ${where} ORDER BY points DESC LIMIT ?`).all(...params, limit);
  return { recipients: rows, message };
}

async function runBroadcast(db, opts) {
  const { recipients, message } = broadcast(db, opts);
  let sent = 0;
  let simulated = 0;
  let failed = 0;
  for (const c of recipients) {
    const res = await send(db, {
      to: c.phone, body: message, name: c.name, customerId: c.id, companyId: c.company_id,
      isBot: true, relatedType: 'broadcast', relatedId: null,
    });
    if (res.ok && res.simulated) simulated += 1;
    else if (res.ok) sent += 1;
    else failed += 1;
  }
  return { total: recipients.length, sent, simulated, failed };
}

module.exports = {
  PROVIDERS, STATUS_LABEL, provider, mode, normalizePhone, prettyPhone, send, retry, record,
  notifyReceipt, notifyMemberWelcome, handleInbound, parseInbound, matchRule, fallbackReply,
  threads, conversation, stats, recentOutbox, broadcast, runBroadcast, receiptMessage,
};
