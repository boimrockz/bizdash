'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { ROLE_LABELS, can } = require('../lib/auth');
const media = require('../lib/media');

const TABS = [
  { key: 'info', label: 'Info', icon: 'idcard' },
  { key: 'aktivitas', label: 'Aktivitas', icon: 'clock' },
  { key: 'pengaturan', label: 'Pengaturan', icon: 'settings' },
];

const ACTION_LABEL = {
  'customer.create': 'Menambah pelanggan',
  'customer.update': 'Memperbarui pelanggan',
  'customer.points': 'Menyesuaikan poin',
  'customer.price': 'Mengatur harga khusus',
  'promo.create': 'Membuat promo',
  'promo.update': 'Mengubah promo',
  'promo.toggle': 'Mengaktifkan/menonaktifkan promo',
  'import.sales': 'Import penjualan',
  'import.products': 'Import produk',
  'material.adjust': 'Penyesuaian stok',
  'material.stock_in': 'Stok masuk',
  'expense.create': 'Mencatat beban',
  'export.sales': 'Ekspor penjualan',
  'export.finance': 'Ekspor keuangan',
  'attendance.clock_in': 'Absen masuk',
  'attendance.clock_out': 'Absen pulang',
  'onboarding.complete': 'Menyelesaikan panduan',
  'onboarding.reset': 'Mengulang panduan',
};

// `size = 0` berarti ukuran diatur CSS (dipakai avatar besar di hero profil,
// supaya media query HP bisa mengecilkannya — inline style akan mengalahkan CSS).
function avatar(user, size, extraClass = '') {
  const url = media.safeUrl(user.photo_url);
  const cls = `avatar ${extraClass}`.trim();
  const dim = size > 0 ? `width:${size}px;height:${size}px;` : '';
  const font = size > 0 ? `font-size:${Math.round(size * 0.36)}px` : '';
  if (url) {
    return `<span class="${cls}" style="${dim}"><img src="${U.h(url)}" alt="Foto ${U.h(user.name)}" loading="lazy"></span>`;
  }
  return `<span class="${cls}" style="${dim}${font}">${U.h(U.initials(user.name))}</span>`;
}

function coverStyle(user) {
  const url = media.safeUrl(user.cover_url);
  return url ? ` style="background-image:url('${U.h(url)}')"` : '';
}

function statCard(label, value, sub) {
  return `<article class="stat">
    <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
    <div class="stat-value">${value}</div>
    <div class="stat-sub">${U.h(sub)}</div>
  </article>`;
}

function infoPanel(ctx, d) {
  const { profile, companyPath, manager, position, reports, stats } = d;
  const rows = [
    ['Email', profile.email],
    ['Telepon', profile.phone || '—'],
    ['Jabatan', profile.job_title || (position ? position.name : '—')],
    ['Entitas', companyPath || '—'],
    ['Atasan langsung', manager ? manager.name : '—'],
    ['Bergabung', profile.joined_at ? U.dateLabel(profile.joined_at) : '—'],
    ['Lokasi kerja', profile.location || '—'],
    ['Peran sistem', ROLE_LABELS[profile.role] || profile.role],
  ];

  return `
    <div class="grid grid-side">
      ${L.card({ title: 'Data pribadi', subtitle: 'Terlihat oleh atasan dan tim terkait' }, `
        <dl class="prof-list">
          ${rows.map(([k, v]) => `<div class="prof-row"><dt>${U.h(k)}</dt><dd>${U.h(String(v))}</dd></div>`).join('')}
        </dl>
        ${profile.bio ? `<div class="prof-bio"><p class="prof-bio-label">Tentang</p><p>${U.h(profile.bio)}</p></div>` : ''}
        <div class="form-actions"><a class="btn btn-ghost btn-sm" href="${ctx.base}/profile?tab=pengaturan">${L.icon('settings', 15)} Ubah data</a></div>`)}

      <div class="grid" style="gap:20px">
        ${L.card({ title: 'Kinerja saya', subtitle: `${U.monthLabel(stats.month)}` }, `
          <div class="prof-kpis">
            <div><span>Nota dilayani</span><b>${U.num(stats.salesMonth)}</b></div>
            <div><span>Omzet dilayani</span><b>${U.idrShort(stats.revenueMonth)}</b></div>
            <div><span>Rata-rata / nota</span><b>${stats.salesMonth ? U.idrShort(stats.revenueMonth / stats.salesMonth) : '—'}</b></div>
            <div><span>Hadir bulan ini</span><b>${U.num(stats.presentDays)} hari</b></div>
            <div><span>Terlambat</span><b>${U.num(stats.lateDays)} kali</b></div>
            <div><span>Jam kerja</span><b>${U.num(stats.workHours, 1)} jam</b></div>
          </div>`)}

        ${L.card({ title: 'Tim & garis pelaporan', subtitle: reports.length ? `${reports.length} anggota tim langsung` : 'Tidak ada bawahan langsung' }, `
          <div class="prof-chain">
            ${manager ? `<a class="prof-person" href="${ctx.base}/profile?user=${manager.id}">
              ${avatar(manager, 34, 'sm')}<span><b>${U.h(manager.name)}</b><em>${U.h(manager.job_title || 'Atasan')}</em></span></a>` : '<p class="muted">Tidak ada atasan tercatat.</p>'}
            <span class="prof-chain-arrow">↓</span>
            <div class="prof-self">
              ${avatar(profile, 34, 'sm')}<span><b>${U.h(profile.name)}</b><em>${U.h(profile.job_title || '—')}</em></span>
            </div>
            ${reports.length ? `<div class="prof-reports">
              ${reports.map((r) => `<a class="prof-person" href="${ctx.base}/profile?user=${r.id}">
                ${avatar(r, 30, 'sm')}<span><b>${U.h(r.name)}</b><em>${U.h(r.job_title || ROLE_LABELS[r.role] || '')}</em></span></a>`).join('')}
            </div>` : ''}
          </div>`)}
      </div>
    </div>`;
}

function activityPanel(ctx, d) {
  const { activity, sales, attendanceRows, sessions, stats } = d;
  const actRows = activity.map((a) => `<li class="act-row">
    <span class="act-dot tone-${a.action.split('.')[0] === 'export' ? 'indigo' : 'good'}">${L.icon('check', 12)}</span>
    <span class="act-body"><b>${U.h(ACTION_LABEL[a.action] || a.action)}</b>
      ${a.detail ? `<em>${U.h(a.detail)}</em>` : ''}</span>
    <span class="act-time">${U.h(U.timeLabel(a.created_at))}<em>${U.h(String(a.created_at || '').slice(0, 10))}</em></span>
  </li>`).join('');

  const saleRows = sales.map((s) => `<tr>
    <td class="nowrap">${U.h(s.invoice_no)}</td>
    <td class="nowrap muted">${U.h(s.sold_at.slice(0, 16))}</td>
    <td>${U.h(s.customer_name || 'Walk-in')}</td>
    <td>${U.h(s.company_name || '')}</td>
    <td class="num strong">${U.idr(s.total)}</td>
  </tr>`).join('');

  const attRows = attendanceRows.map((a) => `<tr>
    <td class="nowrap">${U.h(a.date)}</td>
    <td>${U.h(a.shift_name || '—')}</td>
    <td class="nowrap">${a.clock_in ? U.h(a.clock_in.slice(11, 16)) : '—'} – ${a.clock_out ? U.h(a.clock_out.slice(11, 16)) : '—'}</td>
    <td>${a.status === 'late' ? L.badge('Terlambat', 'warn') : L.badge('Hadir', 'good')}</td>
    <td class="num">${U.num((a.work_minutes || 0) / 60, 1)} jam</td>
  </tr>`).join('');

  const sessionRows = sessions.map((s) => `<tr>
    <td class="nowrap muted">${U.h(String(s.created_at).slice(0, 16))}</td>
    <td class="nowrap muted">${U.h(String(s.expires_at).slice(0, 16))}</td>
    <td>${s.active ? L.badge('Aktif', 'good') : L.badge('Berakhir', 'muted')}</td>
  </tr>`).join('');

  return `
    <div class="prof-act-top">
      ${statCard('Aktivitas tercatat', U.num(stats.activityTotal), 'total sepanjang akun')}
      ${statCard('Nota dilayani', U.num(stats.salesAll), 'sejak bergabung')}
      ${statCard('Omzet dilayani', U.idrShort(stats.revenueAll), 'total nilai transaksi')}
      ${statCard('Login terakhir', stats.lastLogin ? U.timeLabel(stats.lastLogin) : '—', stats.lastLogin ? String(stats.lastLogin).slice(0, 10) : 'belum ada sesi')}
    </div>

    <div class="grid grid-side">
      ${L.card({ title: 'Jejak aktivitas', subtitle: '20 aktivitas terakhir yang tercatat di sistem' }, `
        <ul class="act-list">${actRows || `<li>${L.empty('Belum ada aktivitas')}</li>`}</ul>`)}

      ${L.card({ title: 'Transaksi terakhir', subtitle: 'Nota yang Anda layani' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Invoice</th><th>Waktu</th><th>Pelanggan</th><th>Outlet</th><th class="num">Total</th></tr></thead>
          <tbody>${saleRows || `<tr><td colspan="5">${L.empty('Belum ada transaksi')}</td></tr>`}</tbody>
        </table></div>`)}
    </div>

    <div class="grid grid-2">
      ${L.card({ title: 'Riwayat absensi', subtitle: '10 hari terakhir' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Tanggal</th><th>Shift</th><th>Masuk – Pulang</th><th>Status</th><th class="num">Jam kerja</th></tr></thead>
          <tbody>${attRows || `<tr><td colspan="5">${L.empty('Belum ada absensi')}</td></tr>`}</tbody>
        </table></div>`)}

      ${L.card({ title: 'Sesi & perangkat', subtitle: 'Sesi login terakhir untuk akun ini' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Mulai</th><th>Berakhir</th><th>Status</th></tr></thead>
          <tbody>${sessionRows || `<tr><td colspan="3">${L.empty('Belum ada sesi')}</td></tr>`}</tbody>
        </table></div>`)}
    </div>`;
}

function settingsPanel(ctx, d) {
  const { profile, coverReady, positions } = d;
  const imageNote = coverReady
    ? 'Unggah JPG, PNG, WEBP, atau GIF (maks. 15 MB).'
    : 'Penyimpanan gambar belum aktif di server ini — sementara isi URL gambar di kolom teks.';
  const positionOptions = positions.map((p) => `<option value="${p.id}" ${Number(profile.position_id) === p.id ? 'selected' : ''}>${U.h(p.name)} · ${U.h(p.company_name)}</option>`).join('');

  return `
    <div class="grid grid-side">
      ${L.card({ title: 'Foto & sampul profil', subtitle: imageNote }, `
        <div class="prof-media-forms">
          <form method="post" action="${ctx.base}/profile/photo" enctype="multipart/form-data" class="prof-media-form">
            ${ctx.csrfField}${ctx.backField}
            <div class="prof-media-preview">${avatar(profile, 64)}</div>
            <div class="prof-media-field">
              <label class="field"><span>Ganti foto profil</span><input type="file" name="image" accept="image/*"></label>
              <label class="field"><span>atau tempel URL gambar</span><input name="image_url" placeholder="https://…" value="${U.h(media.safeUrl(profile.photo_url))}"></label>
              <div class="form-actions">
                <button class="btn btn-primary btn-sm" type="submit">Simpan foto</button>
                ${profile.photo_url ? `<button class="btn btn-ghost btn-sm" type="submit" name="remove" value="1">Hapus foto</button>` : ''}
              </div>
            </div>
          </form>

          <form method="post" action="${ctx.base}/profile/cover" enctype="multipart/form-data" class="prof-media-form">
            ${ctx.csrfField}${ctx.backField}
            <div class="prof-media-preview">
              <span class="prof-cover-preview"${coverStyle(profile)}>${L.icon('palette', 18)}</span>
            </div>
            <div class="prof-media-field">
              <label class="field"><span>Ganti gambar sampul</span><input type="file" name="image" accept="image/*"></label>
              <label class="field"><span>atau tempel URL gambar</span><input name="image_url" placeholder="https://…" value="${U.h(media.safeUrl(profile.cover_url))}"></label>
              <div class="form-actions">
                <button class="btn btn-primary btn-sm" type="submit">Simpan sampul</button>
                ${profile.cover_url ? `<button class="btn btn-ghost btn-sm" type="submit" name="remove" value="1">Hapus sampul</button>` : ''}
              </div>
            </div>
          </form>
        </div>`)}

      ${L.card({ title: 'Ganti password', subtitle: 'Minimal 6 karakter, gunakan kombinasi huruf & angka' }, `
        <form method="post" action="${ctx.base}/profile/password">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Password saat ini</span><input type="password" name="current" autocomplete="current-password" required></label>
            <label class="field"><span>Password baru</span><input type="password" name="next" autocomplete="new-password" minlength="6" required></label>
            <label class="field"><span>Ulangi password baru</span><input type="password" name="confirm" autocomplete="new-password" minlength="6" required></label>
          </div>
          <p class="hint-text">Setelah password diubah, sesi lain tetap aktif sampai Anda keluar sendiri.</p>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('idcard', 15)} Perbarui password</button></div>
        </form>`)}
    </div>

    ${L.card({ title: 'Data kepegawaian', subtitle: 'Dapat diubah sendiri; jabatan resmi diatur owner di Struktur Organisasi' }, `
      <form method="post" action="${ctx.base}/profile/save">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama lengkap</span><input name="name" value="${U.h(profile.name)}" required></label>
          <label class="field"><span>Telepon</span><input name="phone" value="${U.h(profile.phone || '')}" placeholder="08xxxxxxxxxx"></label>
          <label class="field"><span>Lokasi kerja</span><input name="location" value="${U.h(profile.location || '')}" placeholder="Kemang / Bandung"></label>
          <label class="field"><span>Jabatan (tampilan)</span><input name="job_title" value="${U.h(profile.job_title || '')}" placeholder="mis. Head Barista"></label>
          <label class="field"><span>Jabatan resmi</span>
            <select name="position_id">
              <option value="">— belum ditetapkan —</option>
              ${positionOptions}
            </select>
          </label>
          <label class="field"><span>Tanggal bergabung</span><input type="date" name="joined_at" value="${U.h(profile.joined_at ? String(profile.joined_at).slice(0, 10) : '')}"></label>
        </div>
        <label class="field" style="margin-top:12px"><span>Tentang saya</span>
          <textarea name="bio" rows="3" maxlength="400" placeholder="Ceritakan singkat peran Anda di tim">${U.h(profile.bio || '')}</textarea>
        </label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('check', 15)} Simpan profil</button></div>
      </form>`)}`;
}

function profilePage(ctx, data) {
  const { profile, tab, isSelf, coverReady, scope } = data;
  const activeTab = TABS.some((t) => t.key === tab) ? tab : 'info';
  const panels = { info: infoPanel, aktivitas: activityPanel, pengaturan: settingsPanel };
  const tabBar = TABS.map((t) => `<a class="prof-tab ${activeTab === t.key ? 'is-active' : ''}"
    href="${ctx.base}/profile?${isSelf ? '' : 'user=' + profile.id + '&'}tab=${t.key}"
    data-prof-tab="${t.key}" role="tab" aria-selected="${activeTab === t.key}">
    ${L.icon(t.icon, 16)}<span>${U.h(t.label)}</span></a>`).join('');

  const body = `
    <section class="prof-hero">
      <div class="prof-cover${media.safeUrl(profile.cover_url) ? ' has-image' : ''}"${coverStyle(profile)}>
        <span class="prof-cover-glow"></span>
      </div>
      <div class="prof-head">
        <div class="prof-avatar-wrap">
          ${avatar(profile, 0, 'xl')}
          <span class="prof-status ${profile.active ? 'is-online' : ''}" title="${profile.active ? 'Aktif' : 'Nonaktif'}"></span>
        </div>
        <div class="prof-ident">
          <h2>${U.h(profile.name)}</h2>
          <p class="prof-role">${U.h(profile.job_title || 'Anggota tim')}</p>
          <div class="prof-chips">
            <span class="prof-chip">${L.icon('idcard', 13)} ${U.h(ROLE_LABELS[profile.role] || profile.role)}</span>
            <span class="prof-chip">${L.icon('building', 13)} ${U.h(data.companyPath || '—')}</span>
            ${profile.location ? `<span class="prof-chip">${L.icon('pin', 13)} ${U.h(profile.location)}</span>` : ''}
            ${profile.joined_at ? `<span class="prof-chip">${L.icon('clock', 13)} sejak ${U.h(U.monthLabel(String(profile.joined_at).slice(0, 7)))}</span>` : ''}
          </div>
        </div>
        <div class="prof-actions">
          ${isSelf
            ? `<a class="btn btn-primary btn-sm" href="${ctx.base}/profile?tab=pengaturan">${L.icon('settings', 15)} Edit profil</a>`
            : `<a class="btn btn-ghost btn-sm" href="${ctx.base}/profile">${L.icon('idcard', 15)} Profil saya</a>`}
          ${scope ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/structure">${L.icon('users', 15)} Struktur organisasi</a>` : ''}
        </div>
      </div>
    </section>

    <div class="prof-tabs" role="tablist">${tabBar}</div>

    <div class="prof-panels">
      ${TABS.map((t) => `<div class="prof-panel ${activeTab === t.key ? 'is-active' : ''}" data-prof-panel="${t.key}" role="tabpanel">
        ${panels[t.key](ctx, data)}
      </div>`).join('')}
    </div>
  `;

  return L.shell(ctx, {
    title: isSelf ? 'Profil Saya' : `Profil ${profile.name}`,
    subtitle: `${ROLE_LABELS[profile.role] || profile.role} · ${data.companyPath || ''}`,
    active: '/profile',
    content: body,
    bodyClass: 'profile-page',
  });
}

module.exports = { profilePage, avatar, TABS };
