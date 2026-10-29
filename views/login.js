'use strict';

const U = require('../lib/util');
const L = require('./layout');

/**
 * Kerangka halaman auth (login, lupa password, reset password).
 * Logo brand selalu ditampilkan apa adanya: lebar dibatasi lewat CSS,
 * tinggi mengikuti rasio asli SVG (tidak pernah dipaksa / dipotong).
 */
function authShell(ctx, { title, hero = true, error = '', notice = '', content }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${U.h(title)} · Ondeway Coffee Company</title>
${L.themeBootScript()}
<meta name="app-base" content="${ctx.base}">
<meta name="theme-color" content="#c1352d">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#140f0c">
<meta name="color-scheme" content="light dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Ondeway">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="${ctx.base}/manifest.webmanifest">
<link rel="apple-touch-icon" href="${ctx.base}/assets/apple-touch-icon.png">
<link rel="icon" type="image/svg+xml" href="${ctx.base}/assets/favicon.svg">
<link rel="icon" type="image/png" sizes="192x192" href="${ctx.base}/assets/icon-192.png">
<link rel="stylesheet" href="${ctx.base}/assets/app.css">
</head>
<body>
${L.bootScreen()}
<div class="login-page">
  <div class="login-theme">${L.themeSwitch(true)}</div>
  <div class="login-wrap">
    ${hero ? `<div class="login-hero">
      <a class="login-brand" href="${ctx.base}/login" aria-label="Ondeway Coffee Company">
        <img src="${ctx.base}/assets/logo-ondeway.svg" alt="Ondeway Coffee Company" width="340" height="88">
      </a>
      <h1>Kelola bisnis kopi Anda dari kebun sampai cangkir</h1>
      <p>POS dengan resep &amp; HPP otomatis, harga tier B2B, membership poin, promo, stok green bean sampai cup, plus laporan keuangan dan performa (BSC, KPI, OKR, RACI) dalam satu dashboard.</p>
      <div class="login-badges">
        <span>POS resep &amp; HPP</span>
        <span>B2C poin · B2B tier harga</span>
        <span>Promo &amp; voucher</span>
        <span>Stok kebun → cup</span>
        <span>BSC · KPI · OKR · RACI</span>
      </div>
    </div>` : ''}
    <div class="login-panel">
      ${error ? `<div class="flash flash-error">${L.icon('alert', 16)}<span>${U.h(error)}</span></div>` : ''}
      ${notice ? `<div class="flash flash-success">${L.icon('check', 16)}<span>${U.h(notice)}</span></div>` : ''}
      ${content}
    </div>
  </div>
</div>
<script src="${ctx.base}/assets/app.js" defer></script>
</body>
</html>`;
}

function loginPage(ctx, opts = {}) {
  const { error = '', notice = '', email = '' } = opts;
  return authShell(ctx, {
    title: 'Masuk',
    error,
    notice,
    content: `<div>
        <h2>Masuk ke dashboard Ondeway</h2>
        <p class="sub">Gunakan email dan password akun perusahaan Anda.</p>
      </div>
      <form id="login-form" method="post" action="${ctx.base}/login" style="display:flex;flex-direction:column;gap:13px">
        <label class="field"><span>Email</span>
          <input type="email" name="email" value="${U.h(email)}" placeholder="nama@perusahaan.com" autocomplete="username" required>
        </label>
        <label class="field"><span>Password</span>
          <input type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
        </label>
        <div class="login-help">
          <a class="login-link" href="${ctx.base}/forgot">Lupa password?</a>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Masuk</button>
      </form>
      <p class="login-note">Belum punya akun? Akun karyawan dibuat oleh owner lewat menu <b>Admin</b>.</p>`,
  });
}

function forgotPage(ctx, opts = {}) {
  const { error = '', notice = '', email = '', sent = false } = opts;
  return authShell(ctx, {
    title: 'Lupa password',
    error,
    notice,
    content: sent
      ? `<div>
          <h2>Cek email atau WhatsApp Anda</h2>
          <p class="sub">Permintaan reset password sudah kami catat.</p>
        </div>
        <p class="login-note" style="font-size:12.5px;line-height:1.65">
          Jika <b>${U.h(email)}</b> terdaftar, tautan reset (berlaku 60 menit) dikirim ke email atau WhatsApp yang
          terhubung. Bila pengiriman email/WhatsApp belum aktif, owner dapat membuat tautan reset dari menu
          <b>Admin</b> → <b>Permintaan reset password</b>.
        </p>
        <div class="form-actions">
          <a class="btn btn-primary btn-block" href="${ctx.base}/login">Kembali ke halaman masuk</a>
        </div>
        <p class="login-note">Salah tulis email? <a class="login-link" href="${ctx.base}/forgot">Kirim ulang</a></p>`
      : `<div>
          <h2>Lupa password</h2>
          <p class="sub">Masukkan email akun Anda — kami kirim tautan untuk membuat password baru.</p>
        </div>
        <form method="post" action="${ctx.base}/forgot" style="display:flex;flex-direction:column;gap:13px">
          <label class="field"><span>Email</span>
            <input type="email" name="email" value="${U.h(email)}" placeholder="nama@perusahaan.com" autocomplete="username" required autofocus>
          </label>
          <button class="btn btn-primary btn-block" type="submit">Kirim tautan reset</button>
        </form>
        <p class="login-note">Tautan berlaku 60 menit dan hanya bisa dipakai sekali.</p>
        <p class="login-note"><a class="login-link" href="${ctx.base}/login">← Kembali ke halaman masuk</a></p>`,
  });
}

function resetPage(ctx, opts = {}) {
  const { token = '', error = '', email = '' } = opts;
  return authShell(ctx, {
    title: 'Password baru',
    error,
    content: `<div>
        <h2>Buat password baru</h2>
        <p class="sub">${email ? `Akun ${U.h(email)}. ` : ''}Minimal 6 karakter, gunakan kombinasi yang mudah Anda ingat namun sulit ditebak.</p>
      </div>
      <form method="post" action="${ctx.base}/reset" style="display:flex;flex-direction:column;gap:13px">
        <input type="hidden" name="token" value="${U.h(token)}">
        <label class="field"><span>Password baru</span>
          <input type="password" name="password" placeholder="••••••••" autocomplete="new-password" minlength="6" required autofocus>
        </label>
        <label class="field"><span>Ulangi password baru</span>
          <input type="password" name="confirm" placeholder="••••••••" autocomplete="new-password" minlength="6" required>
        </label>
        <button class="btn btn-primary btn-block" type="submit">Simpan password baru</button>
      </form>
      <p class="login-note">Semua sesi lain pada akun ini akan keluar otomatis setelah password diganti.</p>`,
  });
}

module.exports = { loginPage, forgotPage, resetPage };
