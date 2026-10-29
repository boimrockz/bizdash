'use strict';

const U = require('./util');
const settings = require('./settings');

const COURIERS = {
  jne: 'JNE',
  jnt: 'J&T Express',
  sicepat: 'SiCepat',
  anteraja: 'AnterAja',
  ninja: 'Ninja Xpress',
  pos: 'POS Indonesia',
  tiki: 'TIKI',
  lion: 'Lion Parcel',
  gosend: 'GoSend (instant)',
  grab: 'GrabExpress (instant)',
};

const STATUS = {
  pending: { label: 'Menunggu penjemputan', tone: 'muted', step: 0 },
  picked_up: { label: 'Dijemput kurir', tone: 'indigo', step: 1 },
  in_transit: { label: 'Dalam perjalanan', tone: 'warn', step: 2 },
  out_for_delivery: { label: 'Sedang diantar', tone: 'warn', step: 3 },
  delivered: { label: 'Diterima', tone: 'good', step: 4 },
  returned: { label: 'Dikembalikan', tone: 'bad', step: 4 },
  cancelled: { label: 'Dibatalkan', tone: 'bad', step: 0 },
};

const PROVIDERS = {
  manual: { label: 'Tarif manual (tanpa API)', hint: 'Memakai tabel tarif per kota yang Anda atur sendiri. Cocok untuk mulai tanpa biaya API.' },
  rajaongkir: { label: 'RajaOngkir (Komerce)', hint: 'Butuh API key RajaOngkir. Tarif real-time dari semua kurir nasional.' },
  biteship: { label: 'Biteship', hint: 'Butuh API key Biteship. Mendukung tarif, pembuatan order, dan tracking otomatis lintas kurir.' },
};

function provider(db) {
  const p = settings.get(db, 'ship_provider', 'manual');
  return PROVIDERS[p] ? p : 'manual';
}

function mode(db) {
  const p = provider(db);
  const key = settings.get(db, 'ship_api_key');
  return { provider: p, live: p !== 'manual' && !!key, label: PROVIDERS[p].label, key: key ? settings.mask(key) : '' };
}

function courierList(db) {
  const raw = settings.get(db, 'ship_couriers', 'jne,jnt,sicepat,anteraja,ninja');
  return String(raw).split(',').map((c) => c.trim()).filter(Boolean)
    .map((code) => ({ code, label: COURIERS[code] || code.toUpperCase() }));
}

function originOf(db, companyId) {
  const c = db.prepare('SELECT id, name, origin_area, origin_city, origin_zip, origin_phone FROM companies WHERE id = ?').get(companyId);
  return c || null;
}

function weightKg(weightGram) {
  return Math.max(1, Math.ceil((Number(weightGram) || 1000) / 1000));
}

async function fetchRemoteRates(db, opts) {
  const p = provider(db);
  const key = settings.get(db, 'ship_api_key');
  if (!key || p === 'manual') return null;
  const timeout = 12000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    if (p === 'biteship') {
      const base = settings.get(db, 'ship_base_url') || 'https://api.biteship.com';
      const res = await fetch(`${base}/v1/rates/couriers`, {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_area_id: opts.originAreaId || undefined,
          destination_area_id: opts.destinationAreaId || undefined,
          destination_postal_code: opts.destinationZip || undefined,
          origin_postal_code: opts.originZip || undefined,
          couriers: courierList(db).map((c) => c.code).join(','),
          items: [{ name: 'Paket kopi', value: opts.value || 100000, quantity: 1, weight: Number(opts.weight) || 1000 }],
        }),
        signal: ctrl.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return (json.pricing || []).map((r) => ({
        courier: r.courier_code || r.company,
        service: r.courier_service_code || r.type || 'REG',
        price: Number(r.price) || 0,
        eta: r.duration ? `${r.duration}` : (r.shipment_duration_range ? `${r.shipment_duration_range} ${r.shipment_duration_unit || 'hari'}` : '—'),
        source: 'biteship',
      }));
    }
    if (p === 'rajaongkir') {
      const base = settings.get(db, 'ship_base_url') || 'https://rajaongkir.komerce.id/api/v1';
      const params = new URLSearchParams({
        origin: String(opts.originId || ''),
        destination: String(opts.destinationId || ''),
        weight: String(Number(opts.weight) || 1000),
        courier: courierList(db).map((c) => c.code).join(':'),
      });
      const res = await fetch(`${base}/calculate/domestic-cost?${params.toString()}`, {
        headers: { key },
        signal: ctrl.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.meta?.message || `HTTP ${res.status}`);
      const data = json.data || json.rajaongkir?.results || [];
      const flat = Array.isArray(data) ? data : Object.values(data).flat();
      return flat.map((r) => ({
        courier: r.code || r.courier,
        service: r.service || r.service_code || 'REG',
        price: Number(r.cost || r.price || (Array.isArray(r.costs) ? r.costs[0]?.cost?.[0]?.value : 0)) || 0,
        eta: r.etd || r.description || '—',
        source: 'rajaongkir',
      }));
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function manualRates(db, opts) {
  const area = String(opts.destinationArea || '').trim();
  if (!area) return [];
  const kg = weightKg(opts.weight);
  const rows = db.prepare(`SELECT * FROM shipping_rates WHERE active = 1 AND lower(dest_area) = lower(?)`).all(area);
  const rates = rows.map((r) => ({
    courier: r.courier,
    service: r.service,
    price: Math.round(r.base_price + r.price_per_kg * (kg - 1)),
    eta: r.eta_text || '—',
    source: 'manual',
  }));
  // area belum terdaftar → estimasi berbasis zona + tarif kurir termurah
  if (!rates.length) {
    const fallback = db.prepare('SELECT courier, service, base_price, price_per_kg, eta_text FROM shipping_rates WHERE active = 1 ORDER BY base_price ASC LIMIT 5').all();
    return fallback.map((r) => ({
      courier: r.courier,
      service: r.service,
      price: Math.round((r.base_price + r.price_per_kg * (kg - 1)) * 1.35),
      eta: (r.eta_text || '3-5 hari') + ' (estimasi)',
      source: 'estimate',
    }));
  }
  return rates;
}

async function rates(db, opts) {
  const remote = await fetchRemoteRates(db, opts).catch((err) => ({ error: String(err.message || err) }));
  if (Array.isArray(remote)) {
    const sorted = remote.filter((r) => r.price > 0).sort((a, b) => a.price - b.price);
    return { source: provider(db), live: true, rates: sorted, error: null };
  }
  const local = manualRates(db, opts).sort((a, b) => a.price - b.price);
  return {
    source: 'manual',
    live: false,
    rates: local,
    error: remote && remote.error ? `Gagal mengambil tarif ${PROVIDERS[provider(db)].label}: ${remote.error}. Menampilkan tarif manual.` : null,
  };
}

function generateAwb(db, courier) {
  const prefix = String(courier || 'BD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'BD';
  const seq = (db.prepare('SELECT COUNT(*) c FROM shipments').get().c + 1).toString().padStart(6, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}${seq}${rand}`;
}

function createShipment(db, opts) {
  const {
    companyId, saleId = null, courier, service = 'REG', cost = 0, weight = 1000,
    destName, destPhone, destArea, destAddress, note = null, userId = null,
  } = opts;
  const p = provider(db);
  const brand = () => settings.brandName(db);
  return db.transaction(() => {
    const now = U.localNow();
    const awb = opts.awb || generateAwb(db, courier);
    const id = db.prepare(`INSERT INTO shipments (company_id, sale_id, provider, courier, service, awb, status, cost, weight,
        dest_name, dest_phone, dest_area, dest_address, note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?,?)`)
      .run(companyId, saleId, p, courier, service, awb, Number(cost) || 0, Number(weight) || 1000,
        destName || null, destPhone || null, destArea || null, destAddress || null, note, now, now).lastInsertRowid;
    db.prepare('INSERT INTO shipment_events (shipment_id, status, description, occurred_at, source) VALUES (?,?,?,?,?)')
      .run(id, 'pending', `Pengiriman dibuat via ${COURIERS[courier] || courier} ${service}`, now, 'system');
    return { id, awb };
  })();
}

async function pushToProvider(db, shipment) {
  const p = provider(db);
  const key = settings.get(db, 'ship_api_key');
  if (p === 'manual' || !key) return { simulated: true };
  const base = settings.get(db, 'ship_base_url') || (p === 'biteship' ? 'https://api.biteship.com' : '');
  if (p !== 'biteship' || !base) return { simulated: true };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${base}/v1/orders`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipper_contact_name: brand(db),
        shipper_contact_phone: shipment.dest_phone || '081200000000',
        origin_contact_name: brand(db),
        destination_contact_name: shipment.dest_name,
        destination_contact_phone: shipment.dest_phone,
        courier_company: shipment.courier,
        courier_type: shipment.service,
        delivery_type: 'now',
        order_note: shipment.note || '',
        metadata: { shipment_id: shipment.id },
      }),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const awb = json.courier_waybill_id || json.id;
    if (awb) {
      db.prepare('UPDATE shipments SET awb = ?, updated_at = ? WHERE id = ?').run(String(awb), U.localNow(), shipment.id);
    }
    return { ok: true, awb };
  } catch (err) {
    return { error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function remoteTracking(db, shipment) {
  const p = provider(db);
  const key = settings.get(db, 'ship_api_key');
  if (p === 'manual' || !key || !shipment.awb) return null;
  const base = settings.get(db, 'ship_base_url') || (p === 'biteship' ? 'https://api.biteship.com' : '');
  if (!base) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${base}/v1/trackings/${encodeURIComponent(shipment.awb)}`, {
      headers: { Authorization: key }, signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const history = json.history || [];
    return history.map((h) => ({
      status: mapRemoteStatus(h.status || h.note || ''),
      description: h.note || h.status || 'Update kurir',
      occurred_at: U.stampFrom(h.updated_at || h.created_at || Date.now()),
    }));
  } catch (err) {
    return { error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function mapRemoteStatus(text) {
  const s = String(text).toLowerCase();
  if (/deliver|diterima|terkirim/.test(s)) return 'delivered';
  if (/transit|perjalanan|dikirim/.test(s)) return 'in_transit';
  if (/pickup|dijemput|diambil/.test(s)) return 'picked_up';
  if (/antar|delivery|courier/.test(s)) return 'out_for_delivery';
  if (/return|kembali|gagal/.test(s)) return 'returned';
  return 'in_transit';
}

/** Sinkronkan tracking: coba provider, jika tidak tersedia pakai simulasi progres berbasis waktu. */
async function syncTracking(db, shipmentId, opts = {}) {
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
  if (!shipment) return { error: 'Pengiriman tidak ditemukan.' };

  const remote = await remoteTracking(db, shipment);
  if (Array.isArray(remote) && remote.length) {
    const existing = new Set(db.prepare('SELECT status || "|" || occurred_at k FROM shipment_events WHERE shipment_id = ?')
      .all(shipment.id).map((r) => r.k));
    let added = 0;
    for (const ev of remote) {
      const key = ev.status + '|' + ev.occurred_at;
      if (existing.has(key)) continue;
      db.prepare('INSERT INTO shipment_events (shipment_id, status, description, occurred_at, source) VALUES (?,?,?,?,?)')
        .run(shipment.id, ev.status, ev.description, ev.occurred_at, 'provider');
      added += 1;
    }
    const latest = remote[remote.length - 1];
    if (latest) db.prepare('UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?').run(latest.status, U.localNow(), shipment.id);
    return { ok: true, live: true, added };
  }

  if (remote && remote.error) {
    return { ok: false, error: remote.error };
  }

  // Simulasi: majukan status bila sudah cukup lama, supaya alur tracking tetap bisa dicoba.
  if (opts.simulate === false) return { ok: true, live: false, added: 0 };
  const chain = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
  const currentIdx = Math.max(0, chain.indexOf(shipment.status));
  const elapsedHours = Math.max(0, (Date.now() - new Date(shipment.created_at.replace(' ', 'T') + '+07:00').getTime()) / 3600000);
  const targetIdx = Math.min(chain.length - 1, Math.floor(elapsedHours / 6));
  let idx = currentIdx;
  let added = 0;
  while (idx < targetIdx) {
    idx += 1;
    const status = chain[idx];
    const desc = {
      picked_up: `Paket dijemput kurir ${COURIERS[shipment.courier] || shipment.courier}`,
      in_transit: `Paket dalam perjalanan menuju ${shipment.dest_area || 'tujuan'}`,
      out_for_delivery: 'Paket sedang diantar ke alamat penerima',
      delivered: 'Paket diterima oleh penerima',
    }[status];
    db.prepare('INSERT INTO shipment_events (shipment_id, status, description, occurred_at, source) VALUES (?,?,?,?,?)')
      .run(shipment.id, status, desc, U.localNow(), 'simulation');
    added += 1;
  }
  if (idx !== currentIdx) {
    db.prepare('UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?').run(chain[idx], U.localNow(), shipment.id);
  }
  return { ok: true, live: false, added, simulated: true };
}

function setStatus(db, shipmentId, status, description, source = 'manual') {
  const allowed = Object.keys(STATUS);
  if (!allowed.includes(status)) return { error: 'Status tidak dikenal.' };
  const shipment = db.prepare('SELECT * FROM shipments WHERE id = ?').get(shipmentId);
  if (!shipment) return { error: 'Pengiriman tidak ditemukan.' };
  db.transaction(() => {
    db.prepare('UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?').run(status, U.localNow(), shipmentId);
    db.prepare('INSERT INTO shipment_events (shipment_id, status, description, occurred_at, source) VALUES (?,?,?,?,?)')
      .run(shipmentId, status, description || STATUS[status].label, U.localNow(), source);
  })();
  return { ok: true };
}

function list(db, companyIds, filters = {}) {
  const ids = companyIds && companyIds.length ? companyIds : null;
  const where = [];
  const params = [];
  if (ids) { where.push(`s.company_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
  if (filters.status && filters.status !== 'all') { where.push('s.status = ?'); params.push(filters.status); }
  if (filters.q) {
    where.push('(lower(s.awb) LIKE ? OR lower(s.dest_name) LIKE ? OR lower(COALESCE(s.dest_area,\'\')) LIKE ? OR lower(COALESCE(sale.invoice_no,\'\')) LIKE ?)');
    const q = '%' + String(filters.q).toLowerCase() + '%';
    params.push(q, q, q, q);
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT s.*, c.name company_name, sale.invoice_no, u.name created_by
    FROM shipments s LEFT JOIN companies c ON c.id = s.company_id
    LEFT JOIN sales sale ON sale.id = s.sale_id
    LEFT JOIN users u ON u.id = sale.user_id
    ${clause} ORDER BY s.created_at DESC, s.id DESC LIMIT ?`).all(...params, Number(filters.limit) || 100);
  const eventCounts = new Map();
  if (rows.length) {
    const ph = rows.map(() => '?').join(',');
    for (const r of db.prepare(`SELECT shipment_id, COUNT(*) c, MAX(occurred_at) last FROM shipment_events WHERE shipment_id IN (${ph}) GROUP BY shipment_id`).all(...rows.map((x) => x.id))) {
      eventCounts.set(r.shipment_id, r);
    }
  }
  return rows.map((r) => ({ ...r, events: (eventCounts.get(r.id) || {}).c || 0, last_event: (eventCounts.get(r.id) || {}).last || r.created_at }));
}

function detail(db, id) {
  const shipment = db.prepare(`SELECT s.*, c.name company_name, sale.invoice_no, c.origin_area, c.origin_city, c.origin_zip
    FROM shipments s LEFT JOIN companies c ON c.id = s.company_id
    LEFT JOIN sales sale ON sale.id = s.sale_id WHERE s.id = ?`).get(id);
  if (!shipment) return null;
  shipment.history = db.prepare('SELECT * FROM shipment_events WHERE shipment_id = ? ORDER BY occurred_at, id').all(id);
  return shipment;
}

function stats(db, companyIds) {
  const ids = companyIds && companyIds.length ? companyIds : null;
  const ph = ids ? ids.map(() => '?').join(',') : null;
  const where = ph ? `WHERE company_id IN (${ph})` : '';
  const rows = db.prepare(`SELECT status, COUNT(*) c, COALESCE(SUM(cost),0) cost FROM shipments ${where} GROUP BY status`).all(...(ids || []));
  const map = new Map(rows.map((r) => [r.status, r]));
  const get = (s) => (map.get(s) || { c: 0, cost: 0 });
  return {
    total: rows.reduce((a, r) => a + r.c, 0),
    active: get('pending').c + get('picked_up').c + get('in_transit').c + get('out_for_delivery').c,
    delivered: get('delivered').c,
    problem: get('returned').c + get('cancelled').c,
    cost: rows.reduce((a, r) => a + r.cost, 0),
    pending: get('pending').c,
  };
}

module.exports = {
  COURIERS, STATUS, PROVIDERS, provider, mode, courierList, originOf, rates, weightKg,
  createShipment, pushToProvider, syncTracking, setStatus, list, detail, stats, generateAwb,
};
