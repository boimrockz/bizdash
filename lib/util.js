'use strict';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const nf = new Intl.NumberFormat('id-ID');

function h(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function idr(n) {
  const v = Math.round(Number(n) || 0);
  return 'Rp ' + nf.format(v);
}

function idrShort(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e12) return 'Rp ' + trim(v / 1e12) + ' T';
  if (abs >= 1e9) return 'Rp ' + trim(v / 1e9) + ' M';
  if (abs >= 1e6) return 'Rp ' + trim(v / 1e6) + ' jt';
  if (abs >= 1e3) return 'Rp ' + trim(v / 1e3) + ' rb';
  return 'Rp ' + nf.format(Math.round(v));
}

function trim(n) {
  return (Math.round(n * 10) / 10).toLocaleString('id-ID');
}

function num(n, digits = 0) {
  const v = Number(n) || 0;
  return v.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function pct(n, digits = 1) {
  const v = Number(n) || 0;
  return v.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%';
}

// Waktu lokal bisnis (WIB) supaya transaksi malam tidak jatuh ke tanggal UTC.
function localNow(d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(d);
    return parts.replace('T', ' ');
  } catch (err) {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
}

function todayISO(d = new Date()) {
  return localNow(d).slice(0, 10);
}

// Timestamp WIB (YYYY-MM-DD HH:MM:SS) dari milidetik/Date.
function stampFrom(value) {
  return localNow(value instanceof Date ? value : new Date(value));
}

function hoursAgoISO(hours) {
  return stampFrom(Date.now() - hours * 3600 * 1000);
}

function nowISO(d = new Date()) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function monthKeyOf(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 7);
}

function currentMonthKey() {
  return todayISO().slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = String(key).split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11 || !y) return String(key);
  return MONTHS_ID[idx] + ' ' + y;
}

function monthShort(key) {
  const idx = Number(String(key).split('-')[1]) - 1;
  return MONTHS_ID[idx] || String(key);
}

function addMonths(key, delta) {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthRange(endKey, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addMonths(endKey, -i));
  return out;
}

function quarterOf(key) {
  const [y, m] = String(key).split('-').map(Number);
  return y + '-Q' + Math.ceil(m / 3);
}

function quarterLabel(q) {
  return String(q).replace('-Q', ' Q');
}

function quarterRange(q) {
  const [y, qn] = String(q).split('-Q').map(Number);
  const start = (qn - 1) * 3 + 1;
  const out = [];
  for (let i = 0; i < 3; i++) out.push(y + '-' + String(start + i).padStart(2, '0'));
  return out;
}

function deltaPct(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Skor pencapaian KPI. Polarity "lower" berarti semakin kecil semakin baik.
function kpiScore(actual, target, polarity) {
  const a = Number(actual) || 0;
  const t = Number(target) || 0;
  if (!t) return 0;
  let score;
  if (polarity === 'lower') {
    score = a <= 0 ? 130 : (t / a) * 100;
  } else {
    score = (a / t) * 100;
  }
  return Math.round(clamp(score, 0, 130) * 10) / 10;
}

function scoreStatus(score) {
  if (score >= 100) return { key: 'achieved', label: 'Tercapai', tone: 'good' };
  if (score >= 85) return { key: 'on_track', label: 'On track', tone: 'good' };
  if (score >= 70) return { key: 'warning', label: 'Perlu perhatian', tone: 'warn' };
  return { key: 'risk', label: 'Berisiko', tone: 'bad' };
}

function formatValue(value, unit) {
  if (unit === 'currency') return idr(value);
  if (unit === 'percent') return pct(value);
  if (unit === 'ratio') return num(value, 2) + 'x';
  return num(value, Number(value) % 1 === 0 ? 0 : 1);
}

function formatCompact(value, unit) {
  if (unit === 'currency') return idrShort(value);
  if (unit === 'percent') return pct(value);
  if (unit === 'ratio') return num(value, 2) + 'x';
  return num(value, Number(value) % 1 === 0 ? 0 : 1);
}

function sum(arr, pick) {
  return arr.reduce((acc, item) => acc + (Number(pick ? pick(item) : item) || 0), 0);
}

function avg(arr) {
  return arr.length ? sum(arr) / arr.length : 0;
}

function dateLabel(iso) {
  const raw = String(iso || '').slice(0, 10);
  const parts = raw.split('-');
  if (parts.length !== 3) return raw || '—';
  return `${Number(parts[2])} ${MONTHS_ID[Number(parts[1]) - 1] || parts[1]} ${parts[0]}`;
}

function timeLabel(iso) {
  const s = String(iso || '');
  return s.length >= 16 ? s.slice(11, 16) : '';
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function slug(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = {
  MONTHS_ID, h, idr, idrShort, num, pct, trim, todayISO, nowISO, localNow, monthKeyOf, currentMonthKey,
  monthLabel, monthShort, addMonths, monthRange, quarterOf, quarterLabel, quarterRange,
  deltaPct, clamp, kpiScore, scoreStatus, formatValue, formatCompact, sum, avg, initials, slug,
  dateLabel, timeLabel, stampFrom, hoursAgoISO,
};
