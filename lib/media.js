'use strict';

/**
 * Unggah gambar lewat proxy media platform (server-side).
 *
 * Aturan:
 * - Token HANYA dibaca di server (process.env.APP_MEDIA_TOKEN) dan tidak pernah dikirim ke klien.
 * - Byte file diteruskan apa adanya (Content-Type: application/octet-stream), bukan multipart.
 * - Yang disimpan di database hanya URL CDN yang dikembalikan proxy; tidak ada file yang
 *   ditaruh di disk lokal VPS (disk lokal bukan penyimpanan durable untuk unggahan pengguna).
 * - APP_MEDIA_URL hanya untuk pengujian lokal (stub proxy), default ke endpoint platform.
 */

const MEDIA_URL = process.env.APP_MEDIA_URL || 'http://127.0.0.1:4310';
const ENDPOINT = '/api/app-media/upload';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
const MAX_BYTES = 15 * 1024 * 1024;

function token() {
  return process.env.APP_MEDIA_TOKEN || '';
}

function available() {
  return !!token();
}

function extOf(filename) {
  const m = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function validate(file) {
  if (!file || !file.buffer || !file.buffer.length) return 'File gambar belum dipilih.';
  const ext = extOf(file.originalname);
  if (!IMAGE_EXT.includes(ext)) return 'Format gambar harus JPG, PNG, WEBP, GIF, atau SVG.';
  if (file.buffer.length > MAX_BYTES) return 'Ukuran gambar maksimal 15 MB.';
  return null;
}

/**
 * Kirim buffer gambar ke proxy media.
 * @returns {Promise<{ok:boolean, url?:string, error?:string}>}
 */
async function upload(file, opts = {}) {
  const invalid = validate(file);
  if (invalid) return { ok: false, error: invalid };
  if (!available()) {
    return {
      ok: false,
      error: 'Penyimpanan gambar belum aktif di server ini. Hubungi admin platform (token media belum tersedia).',
    };
  }
  const name = String((opts.filename || file.originalname || 'gambar').slice(0, 120));
  const url = `${MEDIA_URL}${ENDPOINT}?filename=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-App-Media-Token': token(),
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.buffer.length),
      },
      body: file.buffer,
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (err) { /* balasan bukan JSON */ }
    if (!res.ok || !json.ok || !json.url) {
      if (res.status === 403) {
        // Pesan kuota dari proxy sudah jelas — teruskan apa adanya ke pengguna.
        return { ok: false, error: json.error || 'Kuota penyimpanan gambar sudah penuh.' };
      }
      return { ok: false, error: json.error || `Gagal mengunggah gambar (HTTP ${res.status}).` };
    }
    return { ok: true, url: String(json.url) };
  } catch (err) {
    return { ok: false, error: `Tidak dapat menghubungi penyimpanan gambar: ${err.message}` };
  }
}

/** URL aman untuk dipakai di atribut src (hanya http/https). */
function safeUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

module.exports = { upload, available, validate, safeUrl, MAX_BYTES, IMAGE_EXT };
