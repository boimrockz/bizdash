'use strict';

const U = require('../lib/util');
const { ROLE_LABELS, can } = require('../lib/auth');

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.4a1 1 0 0 0 1-.8L21 7H6"/>',
  coffee: '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M6 21h11"/><path d="M8 3.5c0 1-1 1.5-1 2.5M12 3c0 1-1 1.5-1 2.5"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4zM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4z"/>',
  sprinkle: '<path d="M7 3h10l-1.2 6.2A4 4 0 0 1 14 12v7a2 2 0 0 1-2 2h-0a2 2 0 0 1-2-2v-7a4 4 0 0 1-1.8-2.8L7 3z"/><path d="M7.5 6h9"/>',
  idcard: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5 16.5c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4"/><path d="M15 10h4M15 13.5h4"/>',
  receipt: '<path d="M5 3h14v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M16 12h3"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  printer: '<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="7" rx="2"/><path d="M7 15h10v6H7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  gauge: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l4.5-4.5"/><path d="M3 12h2M12 3v2M20 12h1"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-1.5 4L16 12H5"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16 3.6a3.5 3.5 0 0 1 0 6.8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .33 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.47 1.6 1.6 0 0 0-1.76.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1 1.6 1.6 0 0 0-.33-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6h.09A1.6 1.6 0 0 0 10 3.13V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.76-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.09a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  building: '<rect x="3" y="7" width="8" height="14" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/><path d="M6 11h2M6 15h2M16 7h2M16 11h2M16 15h2"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/>',
  truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.5-5.2A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9.5" r="1.2"/><circle cx="15" cy="9.5" r="1.2"/><circle cx="9.5" cy="15" r="1.2"/><path d="M14 15.5c1.4 0 2.5-.9 2.5-2"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/>',
  send: '<path d="m4 12 16-8-6 16-3-6-7-2z"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3"/><path d="M17 6h3v2a3 3 0 0 1-3 3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  camera: '<path d="M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  sitemap: '<rect x="9" y="2.5" width="6" height="5" rx="1.4"/><rect x="2.5" y="16" width="6" height="5" rx="1.4"/><rect x="15.5" y="16" width="6" height="5" rx="1.4"/><path d="M12 7.5v4M5.5 16v-2.5h13V16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  sparkles: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z"/>',
  chevronLeft: '<path d="m14 6-6 6 6 6"/>',
  chevronRight: '<path d="m10 6 6 6-6 6"/>',
};

function icon(name, size = 18) {
  const body = ICONS[name] || ICONS.grid;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// Logo Ondeway (gear + biji kopi). `mark` untuk sidebar/favicon, `lockup` untuk halaman login.
function logoMark(size = 26) {
  return `<svg class="od-mark" width="${size}" height="${size}" viewBox="0 0 88 88" aria-hidden="true" focusable="false">
    <g transform="translate(44 44)" style="fill:var(--logo-red)">
      <rect x="-5" y="-34" width="10" height="11" rx="2.6"/>
      <rect x="-5" y="23" width="10" height="11" rx="2.6"/>
      <rect x="-34" y="-5" width="11" height="10" rx="2.6"/>
      <rect x="23" y="-5" width="11" height="10" rx="2.6"/>
      <rect x="-5" y="-34" width="10" height="11" rx="2.6" transform="rotate(45)"/>
      <rect x="-5" y="23" width="10" height="11" rx="2.6" transform="rotate(45)"/>
      <rect x="-34" y="-5" width="11" height="10" rx="2.6" transform="rotate(45)"/>
      <rect x="23" y="-5" width="11" height="10" rx="2.6" transform="rotate(45)"/>
      <circle cx="0" cy="0" r="26"/>
    </g>
    <circle cx="44" cy="44" r="19.5" fill="var(--logo-bg, #fff)"/>
    <g transform="translate(44 47) scale(0.66)">
      <ellipse cx="0" cy="0" rx="11.5" ry="15" style="fill:var(--logo-red)"/>
      <path d="M0,-13.5 C5.5,-6 5.5,6 0,13.5" stroke="var(--logo-bg, #fff)" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

const NAV = [
  {
    label: 'Ikhtisar',
    items: [
      { href: '/', label: 'Dashboard', icon: 'grid', cap: 'dashboard' },
      { href: '/mobile', label: 'Dashboard Mobile', icon: 'phone', cap: 'mobile_view' },
      { href: '/onboarding', label: 'Panduan Fitur', icon: 'sparkles', cap: 'dashboard' },
    ],
  },
  {
    label: 'POS & Penjualan',
    items: [
      { href: '/pos', label: 'Kasir (POS)', icon: 'cart', cap: 'pos_write' },
      { href: '/pos/sales', label: 'Riwayat Transaksi', icon: 'receipt', cap: 'pos_read' },
      { href: '/pos/products', label: 'Menu, Resep & Harga', icon: 'coffee', cap: 'pos_read' },
      { href: '/members', label: 'Member & Pelanggan', icon: 'idcard', cap: 'customer_read' },
      { href: '/promos', label: 'Promo & Voucher', icon: 'gift', cap: 'promo_read' },
      { href: '/catalog', label: 'Katalog Produk', icon: 'box', cap: 'catalog_read' },
      { href: '/subscriptions', label: 'Langganan Pelanggan', icon: 'receipt', cap: 'subscription_read' },
    ],
  },
  {
    label: 'Kebun & Produksi',
    items: [
      { href: '/farm', label: 'Bahan Baku & Stok', icon: 'sprinkle', cap: 'inventory_read' },
      { href: '/import', label: 'Import CSV/Excel', icon: 'upload', cap: 'import' },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { href: '/finance', label: 'Arus Kas & Proyeksi', icon: 'wallet', cap: 'finance_read' },
      { href: '/leaderboard', label: 'Leaderboard', icon: 'trophy', cap: 'leaderboard_read' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/performance/bsc', label: 'Balanced Scorecard', icon: 'layers', cap: 'perf_read' },
      { href: '/performance/kpi', label: 'KPI', icon: 'gauge', cap: 'perf_read' },
      { href: '/performance/okr', label: 'OKR', icon: 'target', cap: 'perf_read' },
      { href: '/performance/raci', label: 'RACI', icon: 'users', cap: 'perf_read' },
      { href: '/timeline', label: 'Timeline Proyek', icon: 'flag', cap: 'perf_read' },
    ],
  },
  {
    label: 'Komunikasi & Kirim',
    items: [
      { href: '/whatsapp', label: 'WhatsApp', icon: 'chat', cap: 'wa_read' },
      { href: '/shipping', label: 'Pengiriman & Ongkir', icon: 'truck', cap: 'shipping_read' },
      { href: '/reports', label: 'Laporan Pagi', icon: 'mail', cap: 'report_read' },
    ],
  },
  {
    label: 'Academy',
    items: [
      { href: '/academy', label: 'Training Academy', icon: 'sparkles', cap: 'lms_view' },
      { href: '/academy/paths', label: 'Learning Path', icon: 'layers', cap: 'lms_view' },
      { href: '/academy/library', label: 'Pustaka SOP & Resep', icon: 'box', cap: 'lms_view' },
      { href: '/academy/assess', label: 'Asesmen Praktik', icon: 'check', cap: 'lms_assess' },
      { href: '/academy/matrix', label: 'Matriks Kompetensi', icon: 'users', cap: 'lms_assess' },
      { href: '/academy/manage', label: 'Kelola Kurikulum', icon: 'settings', cap: 'lms_manage' },
    ],
  },
  {
    label: 'Tim & Absensi',
    items: [
      { href: '/team', label: 'Master Data Karyawan', icon: 'users', cap: 'team_read' },
      { href: '/attendance', label: 'Absensi & Jam Kerja', icon: 'clock', cap: 'attendance_read' },
      { href: '/attendance/schedule', label: 'Jadwal Shift', icon: 'idcard', cap: 'attendance_read' },
      { href: '/attendance', label: 'Absensi Saya', icon: 'clock', cap: 'attendance_self' },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { href: '/export', label: 'Ekspor Data', icon: 'download', cap: 'export_read' },
      { href: '/settings/integrations', label: 'Integrasi & API', icon: 'settings', cap: 'integration_read' },
      { href: '/structure', label: 'Struktur Organisasi', icon: 'sitemap', cap: 'structure_read' },
      { href: '/settings/pos/master', label: 'Master Data POS', icon: 'layers', cap: 'pos_read' },
      { href: '/settings/pos', label: 'Kasir, QRIS & Struk', icon: 'printer', cap: 'pos_read' },
      { href: '/admin', label: 'Perusahaan & Pengguna', icon: 'idcard', cap: 'admin' },
      { href: '/design', label: 'Design System', icon: 'palette', cap: 'design' },
    ],
  },
];

function navIsActive(active, href) {
  if (href === '/') return active === '/';
  return active === href || (href === '/pos' && active === '/pos');
}

function badge(label, tone = 'muted') {
  return `<span class="badge badge-${tone}">${U.h(label)}</span>`;
}

function pbar(pct, tone = 'indigo', height = 8) {
  const w = U.clamp(Number(pct) || 0, 0, 100);
  return `<div class="pbar pbar-${height}" role="progressbar" aria-valuenow="${Math.round(w)}" aria-valuemin="0" aria-valuemax="100"><span class="pbar-fill tone-${tone}" style="width:${w}%"></span></div>`;
}

function scoreTone(score) {
  if (score >= 100) return 'good';
  if (score >= 85) return 'indigo';
  if (score >= 70) return 'warn';
  return 'bad';
}

// Tombol unduh Excel untuk halaman yang punya pasangan ekspor (hanya bila role berhak).
function exportButton(ctx, kind, label = 'Excel') {
  if (!can(ctx.user, 'export_read')) return '';
  return `<a class="btn btn-ghost btn-sm no-print" href="${ctx.link('/export/' + kind, { format: 'xlsx' })}" title="Unduh data ${kind} sebagai Excel">${icon('download', 15)} ${U.h(label)}</a>`;
}

function card(opts, body) {
  const { title, subtitle, action, className = '', id = '' } = opts;
  return `<section class="card ${className}" ${id ? `id="${id}"` : ''}>
    ${title ? `<header class="card-head"><div><h2>${U.h(title)}</h2>${subtitle ? `<p class="card-sub">${U.h(subtitle)}</p>` : ''}</div>${action || ''}</header>` : ''}
    <div class="card-body">${body}</div>
  </section>`;
}

function empty(msg, sub = '') {
  return `<div class="empty"><div class="empty-ico">${icon('box', 26)}</div><p>${U.h(msg)}</p>${sub ? `<span>${U.h(sub)}</span>` : ''}</div>`;
}

function flashBlock(ctx) {
  if (!ctx.flash) return '';
  const { flash } = ctx;
  return `<div class="flash flash-${flash.tone || 'info'}">${icon(flash.tone === 'error' ? 'alert' : 'check', 18)}<span>${U.h(flash.msg)}</span></div>`;
}

function monthOptions(selected) {
  const months = U.monthRange(U.currentMonthKey(), 15).reverse();
  return months.map((m) => `<option value="${m}" ${m === selected ? 'selected' : ''}>${U.monthLabel(m)}</option>`).join('');
}

function companyOptions(ctx) {
  const tree = new Map(ctx.companies.map((c) => [c.id, c]));
  const depthOf = (c, guard = 0) => {
    if (!c || !c.parent_id || guard > 10) return 0;
    return 1 + depthOf(tree.get(c.parent_id), guard + 1);
  };
  const allowed = ctx.allowedCompanies || ctx.companies;
  const opts = allowed.map((c) => {
    const depth = depthOf(c);
    const label = '— '.repeat(depth) + c.name;
    return `<option value="${c.id}" ${Number(ctx.selectedCompanyId) === c.id ? 'selected' : ''}>${U.h(label)}</option>`;
  }).join('');
  return `<option value="">Semua dalam cakupan saya</option>${opts}`;
}

function clockChip(ctx) {
  const att = ctx.todayAttendance;
  if (!att) {
    return `<form method="post" action="${ctx.base}/attendance/clock-in" class="clock-chip">
      <input type="hidden" name="_csrf" value="${ctx.csrf}">
      <input type="hidden" name="_back" value="${U.h(ctx.path)}">
      <button class="btn btn-ghost btn-sm" type="submit">${icon('clock', 15)} Absen masuk</button>
    </form>`;
  }
  if (!att.clock_out) {
    return `<form method="post" action="${ctx.base}/attendance/clock-out" class="clock-chip is-open">
      <input type="hidden" name="_csrf" value="${ctx.csrf}">
      <input type="hidden" name="_back" value="${U.h(ctx.path)}">
      <span class="clock-chip-label"><i></i>Masuk ${U.h(String(att.clock_in).slice(11, 16))}</span>
      <button class="btn btn-primary btn-sm" type="submit">Absen pulang</button>
    </form>`;
  }
  return `<span class="clock-chip is-done">${icon('check', 15)} ${U.num(Math.round(att.work_minutes / 60 * 10) / 10, 1)} jam kerja hari ini</span>`;
}

function themeSwitch(label = false) {
  return `<button type="button" class="theme-switch" data-theme-toggle
      role="switch" aria-checked="false" aria-label="Ganti mode gelap" title="Mode terang / gelap">
    <span class="theme-switch__track">
      <svg class="theme-switch__icon sun-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICONS.sun}</svg>
      <svg class="theme-switch__icon moon-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.moon}</svg>
    </span>
    <span class="theme-switch__stars"><i></i><i></i><i></i><i></i></span>
    <span class="theme-switch__knob">
      <svg class="sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${ICONS.sun}</svg>
      <svg class="moon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">${ICONS.moon}</svg>
    </span>
  </button>${label ? '<span class="hint-text" data-theme-label>Mode terang</span>' : ''}`;
}

function themeBootScript() {
  // Dijalankan sebelum paint agar tidak ada kedip tema (FOUC) dan supaya status
  // sidebar (lebar/ciut) serta loading pertama sudah benar sejak frame pertama.
  return `<script>
(function(){
  try {
    var saved = localStorage.getItem('bizdash-theme');
    var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = saved === 'dark' || saved === 'light' ? saved : system;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    if (localStorage.getItem('bizdash-sidebar') === 'collapsed') {
      document.documentElement.setAttribute('data-sidebar', 'collapsed');
    }
    if (sessionStorage.getItem('bizdash-booted') === '1') {
      document.documentElement.className += ' booted';
    }
  } catch (e) {}
})();
</script>`;
}

/** Overlay loading full-screen: logo brand berdenyut saat aplikasi pertama dimuat. */
function bootScreen() {
  return `<div class="boot" data-boot aria-hidden="true">
    <div class="boot__inner">
      <span class="boot__logo">${logoMark(46)}</span>
      <span class="boot__name">ONDEWAY<span>Coffee Company · OS</span></span>
      <span class="boot__bar"><i></i></span>
    </div>
  </div>`;
}

// Bottom navigation khusus layar kecil: maksimal 4 tujuan utama + tombol "Menu".
// Urutan kandidat menentukan prioritas per role (mis. kasir mendapat Kasir di depan).
const TAB_CANDIDATES = [
  { href: '/', label: 'Beranda', icon: 'grid', caps: ['dashboard'] },
  { href: '/pos', label: 'Kasir', icon: 'cart', caps: ['pos_write'] },
  { href: '/finance', label: 'Keuangan', icon: 'wallet', caps: ['finance_read'] },
  { href: '/members', label: 'Pelanggan', icon: 'idcard', caps: ['customer_read'] },
  { href: '/performance/bsc', label: 'Performa', icon: 'layers', caps: ['perf_read'] },
  { href: '/promos', label: 'Promo', icon: 'gift', caps: ['promo_read'] },
  { href: '/attendance', label: 'Absensi', icon: 'clock', caps: ['attendance_read', 'attendance_self'] },
  { href: '/pos/sales', label: 'Transaksi', icon: 'receipt', caps: ['pos_read'] },
  { href: '/farm', label: 'Stok', icon: 'sprinkle', caps: ['inventory_read'] },
  { href: '/catalog', label: 'Katalog', icon: 'box', caps: ['catalog_read'] },
];

function tabItems(caps) {
  const items = [];
  for (const t of TAB_CANDIDATES) {
    if (items.length >= 4) break;
    if (t.caps.some((c) => caps.has(c)) && !items.some((i) => i.href === t.href)) items.push(t);
  }
  return items;
}

function tabbar(ctx, caps, active) {
  const items = tabItems(caps).map((t) => `
    <a class="tab ${navIsActive(active, t.href) ? 'is-active' : ''}" href="${ctx.base}${t.href}"
       aria-current="${navIsActive(active, t.href) ? 'page' : 'false'}">
      <span class="tab-ico">${icon(t.icon, 21)}</span>
      <span class="tab-label">${U.h(t.label)}</span>
    </a>`).join('');
  return `<nav class="tabbar" id="tabbar" aria-label="Navigasi utama">
    ${items}
    <button class="tab tab-menu" type="button" data-sheet-open="app-sheet" aria-expanded="false" aria-controls="app-sheet">
      <span class="tab-ico">${icon('grid', 21)}</span>
      <span class="tab-label">Menu</span>
    </button>
  </nav>`;
}

function appSheet(ctx, opts) {
  const { caps, navHtml, user, installable = true } = opts;
  return `<div class="sheet-scrim" data-sheet-close hidden></div>
  <section class="sheet" id="app-sheet" role="dialog" aria-modal="true" aria-label="Menu aplikasi" hidden>
    <span class="sheet-grab" aria-hidden="true"></span>
    <header class="sheet-head">
      <a class="sheet-user" href="${ctx.base}/profile">
        ${user.photo_url && /^https?:\/\//i.test(user.photo_url)
          ? `<span class="avatar"><img src="${U.h(user.photo_url)}" alt="" loading="lazy"></span>`
          : `<span class="avatar">${U.h(U.initials(user.name))}</span>`}
        <span class="user-meta"><strong>${U.h(user.name)}</strong><small>${U.h(user.job_title || ROLE_LABELS[user.role] || user.role)}</small></span>
      </a>
      <button class="btn btn-ghost btn-icon" type="button" data-sheet-close aria-label="Tutup menu">${icon('plus', 18)}</button>
    </header>
    <div class="sheet-body">
      <div class="sheet-install">
        <button class="install-card" type="button" data-install ${installable ? '' : 'hidden'}>
          <span class="install-ico">${icon('download', 20)}</span>
          <span class="install-copy">
            <strong>Pasang di layar utama</strong>
            <small>Buka seperti aplikasi, tanpa browser</small>
          </span>
          <span class="install-go">${icon('arrowRight', 16)}</span>
        </button>
      </div>
      <nav class="sheet-nav" aria-label="Semua menu">${navHtml}</nav>
      <div class="sheet-foot">
        <a class="sheet-action" href="${ctx.base}/profile">${icon('idcard', 17)} Profil &amp; pengaturan</a>
        <button class="sheet-action" type="button" data-theme-toggle>${icon('moon', 17)} <span data-theme-label>Mode gelap</span></button>
        <form method="post" action="${ctx.base}/logout">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <button class="sheet-action is-danger" type="submit">${icon('logout', 17)} Keluar</button>
        </form>
      </div>
    </div>
  </section>`;
}

function shell(ctx, opts) {
  const { title, subtitle = '', active = '/', content, toolbar = '', bodyClass = '' } = opts;
  const user = ctx.user;
  const caps = new Set();
  const { ROLE_CAPS } = require('../lib/auth');
  for (const c of ROLE_CAPS[user.role] || []) caps.add(c);

  const navHtml = NAV.map((group) => {
    const items = group.items.filter((i) => caps.has(i.cap));
    if (!items.length) return '';
    return `<div class="nav-group"><p class="nav-label">${U.h(group.label)}</p>${items.map((i) => `
      <a class="nav-item ${navIsActive(active, i.href) ? 'is-active' : ''}" href="${ctx.base}${i.href}"
         title="${U.h(i.label)}" aria-label="${U.h(i.label)}">
        ${icon(i.icon)}<span class="nav-text">${U.h(i.label)}</span>
      </a>`).join('')}</div>`;
  }).join('');

  const scopeLabel = ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi semua unit';
  const showFilters = user.role !== 'cashier' && !String(bodyClass || '').includes('pos-mode');
  const filterBar = !showFilters ? '' : `
    <form class="filters" method="get" action="${ctx.base}${active === '/pos/sales' ? '/pos/sales' : active}">
      <label class="filter-field">
        <span>Entitas</span>
        <select name="company" data-autosubmit>${companyOptions(ctx)}</select>
      </label>
      <label class="filter-field">
        <span>Periode</span>
        <select name="month" data-autosubmit>${monthOptions(ctx.month)}</select>
      </label>
      <noscript><button class="btn btn-ghost" type="submit">Terapkan</button></noscript>
    </form>`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${U.h(title)} · Ondeway Coffee Company</title>
${themeBootScript()}
<meta name="app-base" content="${ctx.base}">
<meta name="description" content="Ondeway Coffee Company — POS, stok, keuangan, absensi, dan performa bisnis kopi.">
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
<body class="${bodyClass}">
${bootScreen()}
<div class="app-shell">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-head">
      <a class="brand" href="${ctx.base}/">
        <span class="brand-mark">${logoMark(24)}</span>
        <span class="brand-text"><strong>ONDEWAY</strong><small>Coffee Company · OS</small></span>
      </a>
      <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-controls="sidebar"
              aria-expanded="true" aria-label="Ciutkan menu" title="Ciutkan menu">${icon('chevronLeft', 16)}</button>
    </div>
    <nav class="nav">${navHtml}</nav>
    <div class="scope-card">
      <p class="nav-label">Cakupan akses</p>
      <p class="scope-name">${icon('building', 15)} ${U.h(scopeLabel)}</p>
      <p class="scope-meta">${U.h(ROLE_LABELS[user.role] || user.role)}</p>
      <a class="scope-profile" href="${ctx.base}/profile">${icon('idcard', 14)} Profil saya</a>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <button class="menu-btn" type="button" data-menu-toggle aria-label="Buka menu">${icon('grid', 20)}</button>
      <div class="topbar-title">
        <h1>${U.h(title)}</h1>
        ${subtitle ? `<p>${U.h(subtitle)}</p>` : ''}
      </div>
      <div class="topbar-actions">
        ${toolbar}
        <button class="btn btn-ghost btn-sm install-chip" type="button" data-install hidden title="Pasang aplikasi di layar utama">
          ${icon('download', 15)}<span class="install-chip-label">Pasang</span>
        </button>
        <button class="btn btn-ghost btn-icon print-btn" type="button" data-print title="Cetak / Simpan PDF" aria-label="Cetak atau simpan PDF">${icon('printer', 18)}</button>
        ${clockChip(ctx)}
        ${themeSwitch()}
        <a class="user-chip" href="${ctx.base}/profile" title="Buka profil ${U.h(user.name)}">
          ${user.photo_url && /^https?:\/\//i.test(user.photo_url)
            ? `<span class="avatar"><img src="${U.h(user.photo_url)}" alt="" loading="lazy"></span>`
            : `<span class="avatar">${U.h(U.initials(user.name))}</span>`}
          <span class="user-meta"><strong>${U.h(user.name)}</strong><small>${U.h(user.job_title || ROLE_LABELS[user.role] || user.role)}</small></span>
        </a>
        <form method="post" action="${ctx.base}/logout">
          <input type="hidden" name="_csrf" value="${ctx.csrf}">
          <button class="btn btn-ghost btn-icon" type="submit" title="Keluar">${icon('logout', 18)}</button>
        </form>
      </div>
    </header>

    ${filterBar}
    <div class="content ${bodyClass}">
      ${flashBlock(ctx)}
      ${content}
    </div>
    <footer class="foot">BizDash · data per ${U.h(U.monthLabel(ctx.month))} · hak akses: ${U.h(ROLE_LABELS[user.role] || user.role)}</footer>
  </main>
</div>
${tabbar(ctx, caps, active)}
${appSheet(ctx, { caps, navHtml, user })}
<script src="${ctx.base}/assets/receipt.js" defer></script>
<script src="${ctx.base}/assets/printer.js" defer></script>
<script src="${ctx.base}/assets/app.js" defer></script>
</body>
</html>`;
}

module.exports = { shell, card, badge, pbar, icon, empty, scoreTone, monthOptions, NAV, themeSwitch, themeBootScript, bootScreen, exportButton, logoMark, tabbar, appSheet, tabItems };
