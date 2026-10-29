'use strict';

const U = require('../lib/util');
const L = require('./layout');

/**
 * Halaman rujukan Design System (living style guide).
 * Setiap token di sini benar-benar dipakai halaman lain — kalau sebuah token dihapus
 * dari public/app.css, halaman ini akan menampilkan nilai kosong dan tes
 * `_tests/design.js` gagal.
 */

// [grup, [[token, deskripsi]]]
const COLOR_GROUPS = [
  ['Brand & aksi', [
    ['--brand', 'Tombol primer, link, ikon aktif'],
    ['--brand-hover', 'Hover / state aktif'],
    ['--brand-soft', 'Latar lembut chip, nav aktif'],
    ['--brand-gradient', 'Gradien tombol & hero'],
    ['--brand-gradient-strong', 'Gradien hero gelap'],
    ['--brand-gradient-warm', 'Gradien promo / sampul'],
    ['--brand-rgb', 'Kanal RGB untuk alpha'],
  ]],
  ['Teks', [
    ['--text', 'Teks utama (ink)'],
    ['--text-soft', 'Teks sekunder'],
    ['--text-muted', 'Caption, label, metadata'],
    ['--text-nav', 'Teks menu sidebar'],
    ['--text-prose', 'Paragraf panjang'],
    ['--text-on-brand', 'Teks di atas warna brand'],
    ['--text-logo', 'Warna wordmark logo'],
  ]],
  ['Permukaan', [
    ['--app-bg', 'Latar aplikasi'],
    ['--app-bg-image', 'Radial gradient latar'],
    ['--surface', 'Kartu glass'],
    ['--surface-weak', 'Kartu sekunder'],
    ['--surface-strong', 'Panel pekat'],
    ['--surface-solid', 'Input, tombol, modal'],
    ['--surface-inset', 'Area tertekan / kode'],
    ['--surface-hover', 'Hover baris & menu'],
    ['--surface-onbrand', 'Permukaan di atas brand'],
    ['--overlay', 'Scrim modal / drawer'],
  ]],
  ['Garis & tint', [
    ['--border', 'Garis pemisah standar'],
    ['--border-strong', 'Garis penekanan'],
    ['--border-glass', 'Hairline kartu kaca'],
    ['--border-onbrand', 'Garis di atas brand'],
    ['--tint-1', 'Tint 6%'],
    ['--tint-2', 'Tint 8%'],
    ['--tint-3', 'Tint 14%'],
  ]],
  ['Status', [
    ['--good', 'Sukses / tercapai'],
    ['--good-soft', 'Latar sukses'],
    ['--good-gradient', 'Bar & legenda sukses'],
    ['--warn', 'Perhatian / berisiko'],
    ['--warn-soft', 'Latar perhatian'],
    ['--warn-gradient', 'Bar & legenda perhatian'],
    ['--bad', 'Gagal / kritis'],
    ['--bad-soft', 'Latar kritis'],
    ['--bad-gradient', 'Bar & legenda kritis'],
    ['--info', 'Informasi'],
    ['--info-soft', 'Latar informasi'],
  ]],
  ['Aksen & tone', [
    ['--accent-pink', 'Aksen promo / level'],
    ['--tone-0', 'Tile produk 0'],
    ['--tone-1', 'Tile produk 1'],
    ['--tone-2', 'Tile produk 2'],
    ['--tone-3', 'Tile produk 3'],
    ['--tone-4', 'Tile produk 4'],
    ['--tone-promo', 'Kartu promo'],
    ['--logo-red', 'Merah logo Ondeway'],
    ['--logo-bg', 'Lubang gear logo'],
    ['--logo-plate', 'Alas krem logo (login)'],
    ['--brand-500', 'Merah logo #c1352d'],
    ['--cream-100', 'Krem logo #fbf1de'],
    ['--coffee-900', 'Tinta kopi (teks)'],
  ]],
  ['Grafik', [
    ['--chart-1', 'Seri 1 (pendapatan)'],
    ['--chart-2', 'Seri 2'],
    ['--chart-3', 'Seri 3'],
    ['--chart-4', 'Seri 4'],
    ['--chart-5', 'Seri 5'],
    ['--chart-6', 'Seri 6'],
    ['--chart-7', 'Seri 7 (beban)'],
    ['--chart-8', 'Seri 8'],
    ['--chart-grid', 'Garis grid'],
    ['--chart-axis', 'Label sumbu'],
    ['--chart-muted', 'Seri redup'],
  ]],
];

const SPACING = ['--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8', '--sp-10', '--sp-12', '--sp-16', '--sp-20'];
const RADII = [
  ['--radius-xs', 'Chip kecil'],
  ['--radius-sm', 'Badge, tombol kecil'],
  ['--radius-md', 'Input, tombol'],
  ['--radius', 'Kartu standar'],
  ['--radius-lg', 'Kartu besar, hero'],
  ['--radius-xl', 'Panel / modal'],
  ['--radius-full', 'Pill, avatar'],
];
const TYPE = [
  ['--fs-2xs', 'Caption mikro', '--fw-bold', '--tracking-caps'],
  ['--fs-xs', 'Label & meta', '--fw-semibold', '--tracking-wide'],
  ['--fs-sm', 'Teks bantu', '--fw-regular', '--tracking-normal'],
  ['--fs-md', 'Body utama', '--fw-regular', '--tracking-normal'],
  ['--fs-base', 'Body besar', '--fw-regular', '--tracking-normal'],
  ['--fs-lg', 'Judul kartu', '--fw-semibold', '--tracking-tight'],
  ['--fs-xl', 'Judul halaman', '--fw-bold', '--tracking-tight'],
  ['--fs-2xl', 'Angka metrik', '--fw-bold', '--tracking-tight'],
  ['--fs-3xl', 'Hero', '--fw-bold', '--tracking-tight'],
];
const SHADOWS = [
  ['--shadow-xs', 'Garis / tombol datar'],
  ['--shadow-sm', 'Kartu diam'],
  ['--shadow-md', 'Kartu terangkat'],
  ['--shadow-lg', 'Modal / popover'],
  ['--shadow-brand', 'Tombol brand'],
];
const MOTION = [
  ['--dur-fast', '140ms', 'Hover, fokus'],
  ['--dur', '200ms', 'Transisi umum'],
  ['--dur-slow', '320ms', 'Panel, drawer'],
  ['--ease-out', 'cubic-bezier(.22,1,.36,1)', 'Masuk halus'],
  ['--ease-spring', 'cubic-bezier(.34,1.56,.64,1)', 'Bounce kecil'],
];
const SEMANTIC_ROLES = [
  ['--gap-card', 'Jarak antar kartu (20px)'],
  ['--gap-grid', 'Jarak grid (20px)'],
  ['--pad-card', 'Padding dalam kartu'],
  ['--pad-section', 'Padding section'],
  ['--pad-page', 'Padding area konten'],
  ['--sidebar', 'Lebar sidebar'],
  ['--topbar-h', 'Tinggi topbar'],
  ['--content-max', 'Lebar maksimum konten'],
];

// Token kanal RGB (mis. --brand-rgb berisi "79 70 229") butuh dibungkus rgb() agar tampil.
const RGB_CHANNEL = new Set(['--brand-rgb', '--ink-rgb', '--glass-rgb']);
function chipStyle(token) {
  return RGB_CHANNEL.has(token) ? `background:rgb(var(${token}))` : `background:var(${token})`;
}

function swatchGroup(title, tokens) {
  const cards = tokens.map(([token, desc]) => `<div class="ds-swatch">
      <span class="ds-swatch__chip" style="${chipStyle(token)}"></span>
      <span class="ds-swatch__meta">
        <strong>${U.h(token)}</strong>
        <span class="ds-swatch__desc">${U.h(desc)}</span>
      </span>
    </div>`).join('');
  return `<div class="ds-group">
      <h3 class="ds-group__title">${U.h(title)}</h3>
      <div class="ds-swatches">${cards}</div>
    </div>`;
}

function designPage(ctx) {
  const colorBlocks = COLOR_GROUPS.map(([title, tokens]) => swatchGroup(title, tokens)).join('');

  const spacingRows = SPACING.map((t) => `<div class="ds-scale__item">
      <code>${U.h(t)}</code>
      <span class="ds-scale__bar" style="width:var(${t})"></span>
      <span class="hint-text">${U.h(String(Number(t.replace('--sp-', '')) * 4))}px</span>
    </div>`).join('');

  const radiiCards = RADII.map(([t, desc]) => `<div class="ds-tile">
      <span class="ds-tile__demo" style="border-radius:var(${t})"></span>
      <code>${U.h(t)}</code>
      <span class="hint-text">${U.h(desc)}</span>
    </div>`).join('');

  const typeRows = TYPE.map(([size, desc, weight, tracking]) => `<div class="ds-type-row">
      <code>${U.h(size)}</code>
      <span class="ds-type-sample" style="font-size:var(${size});font-weight:var(${weight});letter-spacing:var(${tracking})">Ondeway Coffee Company</span>
      <span class="hint-text">${U.h(desc)} · ${U.h(weight)}</span>
    </div>`).join('');

  const shadowCards = SHADOWS.map(([t, desc]) => `<div class="ds-tile ds-tile--shadow" style="box-shadow:var(${t})">
      <code>${U.h(t)}</code>
      <span class="hint-text">${U.h(desc)}</span>
    </div>`).join('');

  const motionRows = MOTION.map(([t, val, desc]) => `<div class="ds-scale__item">
      <code>${U.h(t)}</code>
      <span class="ds-motion-dot" style="transition-duration:var(${t})"></span>
      <span class="hint-text">${U.h(desc)}</span>
    </div>`).join('');

  const roleRows = SEMANTIC_ROLES.map(([t, desc]) => `<div class="ds-role">
      <code>${U.h(t)}</code><span>${U.h(desc)}</span><b>var(${U.h(t)})</b>
    </div>`).join('');

  const body = `
    <div class="ds-hero">
      <div>
        <p class="ds-eyebrow">Design System · v2</p>
        <h2>Satu sistem untuk semua halaman</h2>
        <p class="ds-hero__text">Warna, jarak, radius, tipografi, elevasi, dan gerak didefinisikan sebagai token di
          <code>public/app.css</code>. Halaman hanya memakai nilai token (mis. <code>var(--brand)</code>), sehingga tema terang &amp; gelap
          serta perubahan brand cukup dilakukan di satu tempat.</p>
        <div class="ds-hero__actions">
          <span class="badge badge-indigo">${U.num(COLOR_GROUPS.reduce((a, g) => a + g[1].length, 0))} token warna</span>
          <span class="badge badge-indigo">${SPACING.length} langkah spacing</span>
          <span class="badge badge-indigo">${RADII.length} radius</span>
          <span class="badge badge-indigo">${TYPE.length} ukuran teks</span>
          <span class="badge badge-indigo">${SHADOWS.length} elevasi</span>
        </div>
      </div>
      <div class="ds-hero__switch">
        <p class="ds-hero__label">Coba tema</p>
        ${L.themeSwitch(true)}
        <p class="hint-text">Token yang sama, nilai berbeda.</p>
      </div>
    </div>

    <div class="grid grid-2">
      ${L.card({ title: 'Prinsip', subtitle: 'Empat aturan yang menjaga konsistensi' }, `
        <ol class="ds-rules">
          <li><b>Pakai token, bukan nilai mentah.</b> Tidak ada <code>#hex</code>, <code>rgba()</code>, atau
            <code>padding: 13px</code> di view/CSS komponen baru.</li>
          <li><b>Skala 4px.</b> Semua jarak kelipatan 4 — <code>--sp-*</code> — agar ritme halaman seragam.</li>
          <li><b>Satu sumber tema.</b> Tema gelap hanya menimpa token; komponen tidak ditulis dua kali.</li>
          <li><b>Jarak antar kartu lewat gap.</b> Selalu <code>gap: var(--gap-card)</code> pada grid, bukan margin.</li>
        </ol>`)}

      ${L.card({ title: 'Peran layout', subtitle: 'Token siap pakai untuk kerangka halaman' }, `
        <div class="ds-roles">${roleRows}</div>`)}
    </div>

    ${L.card({ title: 'Warna', subtitle: 'Klik tema di atas — semua swatch mengikuti token, bukan nilai tetap' }, `
      <div class="ds-colors">${colorBlocks}</div>`)}

    ${L.card({ title: 'Spacing', subtitle: 'Basis 4px, dipakai untuk padding, gap, dan tinggi kontrol' }, `
      <div class="ds-scale">${spacingRows}</div>`)}

    <div class="grid grid-2">
      ${L.card({ title: 'Radius', subtitle: 'Semakin besar elemen, semakin besar radius' }, `
        <div class="ds-tiles">${radiiCards}</div>`)}

      ${L.card({ title: 'Elevasi', subtitle: 'Bayangan lembut bernuansa brand, bukan hitam pekat' }, `
        <div class="ds-tiles">${shadowCards}</div>`)}
    </div>

    ${L.card({ title: 'Tipografi', subtitle: 'Inter / system-ui · pasangan ukuran + bobot + tracking' }, `
      <div class="ds-type">${typeRows}</div>`)}

    ${L.card({ title: 'Motion', subtitle: 'Durasi singkat, easing keluar — hormati prefers-reduced-motion' }, `
      <div class="ds-scale">${motionRows}</div>`)}

    ${L.card({ title: 'Komponen', subtitle: 'Contoh hidup — salin kelasnya, jangan buat varian baru' }, `
      <div class="ds-comp">
        <div class="ds-comp__row">
          <span class="ds-comp__label">Tombol</span>
          <button class="btn btn-primary" type="button">Primer</button>
          <button class="btn btn-ghost" type="button">Sekunder</button>
          <button class="btn btn-danger" type="button">Destruktif</button>
          <button class="btn btn-primary btn-sm" type="button">Kecil</button>
          <button class="btn btn-ghost btn-icon" type="button" title="Ikon">${L.icon('settings', 16)}</button>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Badge</span>
          <span class="badge badge-good">Tercapai</span>
          <span class="badge badge-warn">Perhatian</span>
          <span class="badge badge-bad">Berisiko</span>
          <span class="badge badge-indigo">Info</span>
          <span class="badge badge-muted">Netral</span>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Form</span>
          <label class="field ds-comp__field"><span>Input teks</span><input placeholder="Nama pelanggan"></label>
          <label class="field ds-comp__field"><span>Select</span><select><option>Kopi Susu Ondeway</option><option>Americano</option></select></label>
          <label class="field ds-comp__field"><span>Tanggal</span><input type="date" value="2026-10-26"></label>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Statistik</span>
          <article class="stat ds-comp__stat">
            <div class="stat-top"><span class="stat-label">Pendapatan</span><span class="stat-ico" style="color:var(--good)">${L.icon('trendUp', 16)}</span></div>
            <div class="stat-value">Rp 178,4 jt</div>
            <div class="stat-sub">1.660 nota lunas</div>
          </article>
          <article class="stat ds-comp__stat">
            <div class="stat-top"><span class="stat-label">Margin kotor</span></div>
            <div class="stat-value">72%</div>
            <div class="stat-sub">target 70%</div>
          </article>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Progres</span>
          <div class="ds-comp__bar">
            <div class="meter-row"><span class="meter-label">Okupansi kelas</span><span class="meter-value">72%</span></div>
            ${L.pbar(72, 'indigo', 8)}
          </div>
          <div class="ds-comp__bar">
            <div class="meter-row"><span class="meter-label">Stok roasted bean</span><span class="meter-value">34%</span></div>
            ${L.pbar(34, 'warn', 8)}
          </div>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Peringatan</span>
          <div class="alert-row ds-comp__alert">
            <div class="alert-ico good">${L.icon('check', 16)}</div>
            <div class="alert-text"><strong>Integrasi siap</strong><span>WhatsApp &amp; kurir dapat dihubungkan.</span></div>
          </div>
          <div class="alert-row ds-comp__alert">
            <div class="alert-ico warn">${L.icon('alert', 16)}</div>
            <div class="alert-text"><strong>Mode simulasi</strong><span>Isi kredensial untuk kirim nyata.</span></div>
          </div>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Tabel</span>
          <div class="table-wrap ds-comp__table"><table class="data">
            <thead><tr><th>Produk</th><th class="num">Terjual</th><th class="num">Omzet</th></tr></thead>
            <tbody>
              <tr><td>Es Kopi Susu Ondeway</td><td class="num">412</td><td class="num">Rp 10,7 jt</td></tr>
              <tr><td>Americano</td><td class="num">318</td><td class="num">Rp 7,6 jt</td></tr>
            </tbody>
          </table></div>
        </div>
        <div class="ds-comp__row">
          <span class="ds-comp__label">Tab & avatar</span>
          <div class="prof-tabs" style="margin:0">
            <a class="prof-tab is-active" href="${ctx.base}/design">${L.icon('idcard', 15)}<span>Aktif</span></a>
            <a class="prof-tab" href="${ctx.base}/design">${L.icon('clock', 15)}<span>Tab lain</span></a>
          </div>
          <span class="avatar">ON</span>
          <span class="chip">${L.icon('coffee', 13)} Kopi Susu</span>
          <span class="chip">${L.icon('pin', 13)} Kemang</span>
        </div>
      </div>`)}

    ${L.card({ title: 'Cara pakai', subtitle: 'Pola siap salin untuk halaman baru' }, `
      <pre class="ds-code">/* 1. Kerangka halaman */
&lt;div class="grid grid-side"&gt;          /* −&gt; 2 kolom: konten + panel */
  &lt;section class="card"&gt;
    &lt;header class="card-head"&gt;&lt;h3&gt;Judul&lt;/h3&gt;&lt;/header&gt;
    &lt;div class="card-body"&gt;…&lt;/div&gt;
  &lt;/section&gt;
&lt;/div&gt;

/* 2. Jarak — selalu lewat gap/token */
.grid { gap: var(--gap-card); }        /* 20px antar kartu */
.card { padding: var(--pad-card); }
section + section { margin-top: var(--sp-6); }

/* 3. Warna — tidak pernah hardcode */
color: var(--text);
background: var(--surface-solid);
border: 1px solid var(--border);
box-shadow: var(--shadow-sm);

/* 4. Tipografi */
font-size: var(--fs-md);
font-weight: var(--fw-semibold);
letter-spacing: var(--tracking-tight);

/* 5. Gerak */
transition: background-color var(--dur) var(--ease-out);</pre>
      <div class="ds-note">
        ${L.icon('alert', 16)}
        <span>Kalau butuh nilai baru, <b>tambahkan token</b> di blok <code>:root</code> dan
        <code>[data-theme='dark']</code> — jangan menulis warna mentah di komponen.</span>
      </div>`)}

    ${L.card({ title: 'Daftar token lengkap', subtitle: 'Nama token yang tersedia di public/app.css' }, `
      <div class="ds-tokenlist">
        ${COLOR_GROUPS.map(([title, tokens]) => `<p class="ds-tokenlist__group">${U.h(title)}</p>
          <div class="chip-row">${tokens.map(([t]) => `<code class="ds-token">${U.h(t)}</code>`).join('')}</div>`).join('')}
        <p class="ds-tokenlist__group">Spacing & layout</p>
        <div class="chip-row">${[...SPACING, ...SEMANTIC_ROLES.map((r) => r[0])].map((t) => `<code class="ds-token">${U.h(t)}</code>`).join('')}</div>
        <p class="ds-tokenlist__group">Radius · tipografi · elevasi · motion</p>
        <div class="chip-row">${[...RADII.map((r) => r[0]), ...TYPE.map((r) => r[0]), ...SHADOWS.map((r) => r[0]), ...MOTION.map((r) => r[0])]
          .map((t) => `<code class="ds-token">${U.h(t)}</code>`).join('')}</div>
      </div>`)}
  `;

  return L.shell(ctx, {
    title: 'Design System',
    subtitle: 'Token warna, spacing, tipografi, elevasi, dan komponen untuk semua halaman',
    active: '/design',
    content: body,
    bodyClass: 'ds-page',
  });
}

module.exports = { designPage, COLOR_GROUPS, SPACING, RADII, TYPE, SHADOWS, MOTION, SEMANTIC_ROLES };
