'use strict';

/**
 * Embed video & dokumen pihak ketiga TANPA membebani server sendiri.
 *
 * Prinsip:
 * - Yang disimpan di database hanya **URL** (dan provider hasil deteksi). Byte video/PDF
 *   tidak pernah melewati server aplikasi dan tidak menempati kuota penyimpanan app.
 * - Video: YouTube (termasuk Shorts/Live/unlisted) & Vimeo dinormalisasi ke URL `embed`,
 *   selain itu diperlakukan sebagai iframe bebas (apa pun https yang bisa di-embed).
 * - PDF: link Google Drive otomatis diubah ke `/preview` supaya bisa tampil di iframe;
 *   link lain dipakai apa adanya dengan tombol "Buka dokumen" sebagai fallback.
 * - Hanya `http(s)` yang diterima (menolak `javascript:`, `data:`), dan semua URL selalu
 *   di-escape di view sebelum masuk atribut HTML.
 */

const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

function isHttp(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function parseUrl(value) {
  const raw = String(value || '').trim();
  if (!isHttp(raw)) return null;
  try {
    return new URL(raw);
  } catch (err) {
    return null;
  }
}

function cleanId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{6,32}$/.test(id) ? id : '';
}

function youtubeStart(url) {
  const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
  const m = String(t).match(/^(\d+)/);
  return m ? Number(m[1]) : 0;
}

function youtubeId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') return cleanId(url.pathname.replace(/^\//, '').split('/')[0]);
  const v = cleanId(url.searchParams.get('v') || '');
  if (v) return v;
  const m = url.pathname.match(/\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{6,32})/i);
  return m ? cleanId(m[2]) : '';
}

/** Video → { ok, provider, id, embedUrl, thumb, label }. */
function resolveVideo(input) {
  const url = parseUrl(input);
  if (!url) return { ok: false, error: 'URL video harus dimulai dengan http:// atau https://' };
  const host = url.hostname.toLowerCase();

  if (YT_HOSTS.has(host)) {
    const id = youtubeId(url);
    if (!id) return { ok: false, error: 'ID video YouTube tidak ditemukan di URL itu.' };
    const start = youtubeStart(url);
    return {
      ok: true,
      provider: 'youtube',
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ''}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      label: 'YouTube',
      url: url.toString(),
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    const m = url.pathname.match(/(\d{6,12})/);
    if (!m) return { ok: false, error: 'ID video Vimeo tidak ditemukan di URL itu.' };
    return {
      ok: true,
      provider: 'vimeo',
      id: m[1],
      embedUrl: `https://player.vimeo.com/video/${m[1]}`,
      thumb: '',
      label: 'Vimeo',
      url: url.toString(),
    };
  }

  // Iframe bebas: apa pun yang https (mis. pemutar video kampus, Loom, Wistia, dsb.)
  return {
    ok: true,
    provider: 'iframe',
    id: '',
    embedUrl: url.toString(),
    thumb: '',
    label: 'Embed eksternal',
    url: url.toString(),
  };
}

/** Link Google Drive → URL preview yang bisa dipasang di iframe. */
function drivePreview(url) {
  const m = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  const id = url.searchParams.get('id');
  if (/\/open|\/uc/.test(url.pathname) && id) return `https://drive.google.com/file/d/${id}/preview`;
  if (/docs\.google\.com$/.test(url.hostname) && /\/document|\/presentation|\/spreadsheets/.test(url.pathname)) {
    return url.toString().replace(/\/(edit|view)(\?|$)/, '/preview$2');
  }
  return '';
}

/** Dokumen PDF → { ok, provider, embedUrl, openUrl, inline } */
function resolvePdf(input) {
  const url = parseUrl(input);
  if (!url) return { ok: false, error: 'URL dokumen harus dimulai dengan http:// atau https://' };
  const host = url.hostname.toLowerCase();
  if (/(^|\.)drive\.google\.com$/.test(host) || /(^|\.)docs\.google\.com$/.test(host)) {
    const preview = drivePreview(url);
    if (preview) {
      return { ok: true, provider: 'drive', embedUrl: preview, openUrl: url.toString(), inline: true, label: 'Google Drive' };
    }
  }
  const direct = /\.pdf(\?|#|$)/i.test(url.pathname + url.search);
  return {
    ok: true,
    provider: 'link',
    embedUrl: url.toString(),
    openUrl: url.toString(),
    inline: direct, // PDF langsung biasanya bisa tampil di iframe; host lain belum tentu
    label: direct ? 'PDF' : 'Tautan dokumen',
  };
}

/** Validasi + normalisasi satu materi sesuai jenisnya. */
function prepare(kind, url) {
  if (kind === 'video') {
    const out = resolveVideo(url);
    if (!out.ok) return out;
    return { ok: true, provider: out.provider, embedUrl: out.embedUrl, label: out.label, thumb: out.thumb, openUrl: out.url };
  }
  if (kind === 'pdf') {
    const out = resolvePdf(url);
    if (!out.ok) return out;
    return { ok: true, provider: out.provider, embedUrl: out.embedUrl, label: out.label, openUrl: out.openUrl, inline: out.inline };
  }
  return { ok: true, provider: '', embedUrl: '', label: 'Teks', openUrl: '' };
}

const KINDS = {
  text: { label: 'Teks', icon: 'receipt' },
  video: { label: 'Video', icon: 'phone' },
  pdf: { label: 'Dokumen PDF', icon: 'box' },
};

module.exports = { resolveVideo, resolvePdf, prepare, isHttp, KINDS };
