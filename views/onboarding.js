'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');

const STEPS = [
  {
    key: 'dashboard', cap: 'dashboard', icon: 'grid', href: '/', title: 'Dashboard eksekutif',
    what: 'Semua angka penting dalam satu layar: pendapatan, laba, arus kas, BSC, OKR, stok, dan tim.',
    todo: 'Cek dashboard setiap pagi; ganti filter entitas/periode di atas untuk melihat per unit.',
  },
  {
    key: 'pos', cap: 'pos_write', icon: 'cart', href: '/pos', title: 'Kasir (POS)',
    what: 'Layar kasir ala tablet dengan resep, HPP otomatis, harga tier B2B, promo, dan poin member.',
    todo: 'Coba satu transaksi: pilih pelanggan, ketuk menu, terapkan voucher, lalu bayar.',
  },
  {
    key: 'finance', cap: 'finance_read', icon: 'wallet', href: '/finance', title: 'Keuangan & proyeksi',
    what: 'Pemasukan, pengeluaran, laba rugi, dan proyeksi arus kas tiga bulan ke depan.',
    todo: 'Atur target pendapatan per cabang agar capaian dan leaderboard terisi.',
  },
  {
    key: 'leaderboard', cap: 'leaderboard_read', icon: 'trendUp', href: '/leaderboard', title: 'Leaderboard cabang & tim',
    what: 'Peringkat cabang dan anggota tim dari target, pertumbuhan, margin, member, dan kedisiplinan.',
    todo: 'Bandingkan cabang terbaik vs terlemah, lalu susun tindak lanjut bersama manajer.',
  },
  {
    key: 'subscriptions', cap: 'subscription_read', icon: 'receipt', href: '/subscriptions', title: 'Langganan pelanggan',
    what: 'Status aktif, jatuh tempo, dan riwayat pembayaran pelanggan berlangganan (MRR).',
    todo: 'Tandai pembayaran yang masuk dan kirim pengingat WhatsApp untuk yang menunggak.',
  },
  {
    key: 'reports', cap: 'report_read', icon: 'send', href: '/reports', title: 'Laporan pagi otomatis',
    what: 'Ringkasan performa dikirim ke WhatsApp/email tim setiap pagi pada jam yang Anda pilih.',
    todo: 'Isi nomor/email penerima di Pengaturan Integrasi, lalu coba "Kirim laporan sekarang".',
  },
  {
    key: 'whatsapp', cap: 'wa_read', icon: 'chat', href: '/whatsapp', title: 'WhatsApp Business',
    what: 'Notifikasi struk, balasan otomatis, broadcast promo, dan inbox percakapan pelanggan.',
    todo: 'Sesuaikan aturan balasan otomatis dengan gaya bahasa brand Anda.',
  },
  {
    key: 'shipping', cap: 'shipping_read', icon: 'truck', href: '/shipping', title: 'Pengiriman & ongkir',
    what: 'Cek ongkir lintas kurir, buat pengiriman, dan pantau tracking otomatis.',
    todo: 'Buat pengiriman pertama dari hasil cek ongkir; resi otomatis dikirim ke pelanggan.',
  },
  {
    key: 'attendance', cap: 'attendance_read', icon: 'clock', href: '/attendance', title: 'Absensi & jadwal shift',
    what: 'Absen masuk/pulang, jadwal shift barista, rekap jam kerja, dan estimasi biaya tenaga kerja.',
    todo: 'Susun jadwal minggu depan dan pastikan setiap shift punya barista.',
  },
  {
    key: 'structure', cap: 'structure_read', icon: 'sitemap', href: '/structure', title: 'Struktur organisasi',
    what: 'Hierarki holding → unit usaha → cabang, plus jabatan, atasan langsung, dan penempatan orang.',
    todo: 'Tambahkan cabang baru atau sesuaikan jabatan tim; semua laporan mengikuti struktur ini.',
  },
  {
    key: 'profile', cap: 'profile', icon: 'idcard', href: '/profile', title: 'Profil & identitas',
    what: 'Sampul dan foto profil, data kepegawaian, riwayat aktivitas, serta pengaturan akun dan password.',
    todo: 'Lengkapi foto, jabatan, dan lokasi kerja Anda agar mudah dikenali tim.',
  },
  {
    key: 'catalog', cap: 'catalog_read', icon: 'box', href: '/catalog', title: 'Katalog produk',
    what: 'Semua menu dan biji kopi dengan filter kategori, rentang harga, dan rating pelanggan.',
    todo: 'Periksa produk dengan rating rendah untuk perbaikan resep/pelayanan.',
  },
  {
    key: 'integrations', cap: 'integration_read', icon: 'settings', href: '/settings/integrations', title: 'Pengaturan integrasi',
    what: 'API key WhatsApp, pengiriman, email, webhook, dan jadwal laporan — terpusat dan tersamar.',
    todo: 'Hubungkan minimal satu kanal (WhatsApp atau email) agar notifikasi berjalan nyata.',
  },
  {
    key: 'mobile', cap: 'mobile_view', icon: 'grid', href: '/mobile', title: 'Dashboard mobile',
    what: 'Versi ringkas untuk HP: angka besar, alert, dan aksi cepat ke modul utama.',
    todo: 'Simpan /mobile sebagai shortcut di layar utama HP Anda.',
  },
];

function onboardingPage(ctx, data) {
  const { done, steps, progress, isFirstTime } = data;
  const total = steps.length;
  const pct = total ? (done / total) * 100 : 0;

  const stepCards = steps.map((s, i) => `<article class="ob-step ${s.done ? 'is-done' : ''}">
    <div class="ob-step-head">
      <span class="ob-num">${s.done ? L.icon('check', 14) : i + 1}</span>
      <span class="ob-ico">${L.icon(s.icon, 18)}</span>
      <div>
        <h3>${U.h(s.title)}</h3>
        <span class="ob-tag">${s.done ? 'Sudah dibuka' : 'Belum dijelajahi'}</span>
      </div>
    </div>
    <p>${U.h(s.what)}</p>
    <p class="ob-todo"><b>Coba ini:</b> ${U.h(s.todo)}</p>
    <div class="ob-actions">
      <a class="btn ${s.done ? 'btn-ghost' : 'btn-primary'} btn-sm" href="${ctx.base}${s.href}">${s.done ? 'Buka lagi' : 'Mulai jelajahi'}</a>
    </div>
  </article>`).join('');

  const body = `
    <section class="ob-hero">
      <div class="ob-hero-text">
        <span class="ob-eyebrow">${isFirstTime ? 'Selamat datang' : 'Panduan fitur'} · ${U.dateLabel(U.todayISO())}</span>
        <h2>Halo ${U.h(ctx.user.name.split(' ')[0])}, ini 12 modul yang paling sering dipakai owner</h2>
        <p>Ikuti urutan di bawah (sekitar 5 menit). Semua data demo sudah terisi supaya Anda bisa langsung mencoba tanpa input apa pun.</p>
        <div class="ob-progress">
          <div class="meter-row"><span class="meter-label">Progres penjelajahan</span><span class="meter-value">${done}/${total}</span></div>
          ${L.pbar(pct, pct >= 100 ? 'good' : 'indigo', 8)}
        </div>
        <div class="form-actions">
          ${isFirstTime ? `<form method="post" action="${ctx.base}/onboarding/complete">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-primary" type="submit">${L.icon('check', 15)} Selesai, mulai pakai</button>
          </form>` : `<a class="btn btn-primary" href="${ctx.base}/">${L.icon('grid', 15)} Ke dashboard</a>
          <form method="post" action="${ctx.base}/onboarding/reset">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-ghost" type="submit">Tampilkan ulang saat login</button>
          </form>`}
          <a class="btn btn-ghost" href="${ctx.base}/design">Lihat design system</a>
        </div>
      </div>
      <div class="ob-hero-art">
        ${[
          ['Pendapatan', U.idrShort(data.fin.revenue)],
          ['Laba bersih', U.idrShort(data.fin.net)],
          ['Cabang', String(data.branchCount)],
          ['Langganan aktif', String(data.subsActive)],
        ].map(([label, value]) => `<div class="ob-stat"><span>${U.h(label)}</span><strong>${value}</strong></div>`).join('')}
      </div>
    </section>

    <div class="ob-grid">${stepCards}</div>

    ${L.card({ title: 'Alur kerja yang disarankan', subtitle: 'Rutinitas harian, mingguan, dan bulanan' }, `
      <div class="grid grid-3">
        ${[
          ['Setiap pagi', ['Baca laporan pagi (WhatsApp/email)', 'Cek dashboard & alert', 'Pantau stok bahan menipis']],
          ['Setiap minggu', ['Review leaderboard cabang', 'Susun jadwal shift barista', 'Cek langganan jatuh tempo']],
          ['Setiap bulan', ['Tutup buku & set target bulan baru', 'Evaluasi KPI/OKR di BSC', 'Tinjau promo & harga']],
        ].map(([title, items]) => `<div class="ob-routine">
          <p class="persp-meta">${U.h(title)}</p>
          <ul class="labour-notes">${items.map((i) => `<li>${U.h(i)}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>`)}

    ${data.help.length ? L.card({ title: 'Akun bantuan', subtitle: 'Bila ingin dibantu langsung' }, `
      <div class="chip-row">${data.help.map((h) => L.badge(h, 'indigo')).join('')}</div>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'Panduan Admin Baru',
    subtitle: 'Kenali fitur penting dalam 5 menit',
    active: '/onboarding',
    content: body,
  });
}

function availableSteps(user) {
  return STEPS.filter((s) => can(user, s.cap));
}

module.exports = { onboardingPage, availableSteps, STEPS };
