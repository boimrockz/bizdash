'use strict';

/**
 * Master Data Karyawan — halaman daftar (`/team`) dan detail per orang (`/team/:id`).
 *
 * Prinsip tampilan: satu orang = satu kartu ringkas di daftar, dan semua penyesuaian
 * (profil kepegawaian + kredensial) ada di halaman detail yang bisa dibuka dari baris mana pun.
 * Tidak ada data yang bisa diubah tanpa tombol simpan eksplisit.
 */

const U = require('../lib/util');
const L = require('./layout');
const { ROLE_LABELS, ROLE_DESC, can } = require('../lib/auth');

const POS_LEVEL_LABEL = { owner: 'Owner', director: 'Direktur', manager: 'Manajer', supervisor: 'Supervisor', staff: 'Staff' };

function avatar(user, size = 36) {
  const url = String(user.photo_url || '');
  if (/^https?:\/\//i.test(url)) {
    return `<span class="avatar sm" style="width:${size}px;height:${size}px"><img src="${U.h(url)}" alt="" loading="lazy"></span>`;
  }
  return `<span class="avatar sm" style="width:${size}px;height:${size}px">${U.h(U.initials(user.name))}</span>`;
}

function roleBadge(role) {
  const tone = { owner: 'indigo', director: 'indigo', manager: 'good', finance: 'warn', cashier: 'muted', staff: 'muted' }[role] || 'muted';
  return L.badge(ROLE_LABELS[role] || role, tone);
}

function statusBadge(active) {
  return active ? L.badge('Aktif', 'good') : L.badge('Nonaktif', 'bad');
}

function optionList(list, selected, emptyLabel) {
  return `${emptyLabel ? `<option value="">${U.h(emptyLabel)}</option>` : ''}`
    + list.map((o) => `<option value="${o.id}" ${Number(selected) === Number(o.id) ? 'selected' : ''}>${U.h(o.label)}</option>`).join('');
}

// ---------------------------------------------------------------- daftar karyawan

function teamPage(ctx, data) {
  const { rows, filter, stats, companies, canWrite, canCredential, canCreate } = data;
  const companyOptions = companies.map((c) => ({ id: c.id, label: c.name }));

  const companyFilterOptions = `${'<option value="">Semua entitas</option>'}`
    + companies.map((c) => `<option value="${c.id}" ${Number(filter.company) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('');

  const rowHtml = rows.map((u) => `<tr data-team-row="${u.id}">
    <td>
      <div class="team-cell">
        ${avatar(u, 34)}
        <div>
          <a class="strong" href="${ctx.base}/team/${u.id}">${U.h(u.name)}</a>
          <span class="sub-cell">${U.h(u.email)}</span>
        </div>
      </div>
    </td>
    <td>
      <span class="strong">${U.h(u.position_name || u.job_title || '—')}</span>
      <span class="sub-cell">${U.h(u.position_level ? POS_LEVEL_LABEL[u.position_level] || u.position_level : 'belum ada jabatan')}</span>
    </td>
    <td>${U.h(u.company_name || '—')}</td>
    <td>${roleBadge(u.role)}</td>
    <td class="num">${u.hourly_rate ? U.idr(u.hourly_rate) : '—'}</td>
    <td class="num">${u.session_count ? L.badge(`${u.session_count} sesi`, 'good') : '<span class="hint-text">—</span>'}</td>
    <td>${statusBadge(u.active)}</td>
    <td class="num">
      <div class="team-actions">
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/team/${u.id}">${L.icon('idcard', 14)} Kelola</a>
        ${canWrite ? `<form method="post" action="${ctx.base}/team/${u.id}/toggle" data-confirm="${u.active ? 'Nonaktifkan' : 'Aktifkan'} akun ${U.h(u.name)}?">
          ${ctx.csrfField}${ctx.backField}
          <input type="hidden" name="active" value="${u.active ? '0' : '1'}">
          <button class="btn btn-ghost btn-sm" type="submit">${u.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        </form>` : ''}
      </div>
    </td>
  </tr>`).join('');

  const createCard = canCreate ? L.card({
    title: 'Tambah karyawan',
    subtitle: 'Akun langsung aktif dengan password sementara — minta karyawan menggantinya di Profil',
  }, `<details class="disclosure team-create">
      <summary>${L.icon('plus', 15)} Buat akun karyawan baru</summary>
      <div class="disc-body">
        <form method="post" action="${ctx.base}/team" class="stack-form">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Nama lengkap</span><input name="name" required maxlength="120" placeholder="mis. Nadia Putri"></label>
            <label class="field"><span>Email (untuk masuk)</span><input name="email" type="email" required maxlength="160" placeholder="nama@perusahaan.com"></label>
            <label class="field"><span>Password sementara</span><input name="password" type="text" minlength="6" required placeholder="minimal 6 karakter"></label>
            <label class="field"><span>Ulangi password</span><input name="password_confirm" type="text" minlength="6" required></label>
            <label class="field"><span>Role / hak akses</span>
              <select name="role">${Object.entries(ROLE_LABELS).map(([k, l]) => `<option value="${k}" ${k === 'staff' ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Entitas</span>
              <select name="company_id">${optionList(companyOptions, ctx.user.company_id)}</select>
            </label>
            <label class="field"><span>Jabatan (opsional)</span>
              <select name="position_id"><option value="">— pilih nanti —</option>
                ${data.positions.map((p) => `<option value="${p.id}">${U.h(p.name)} · ${U.h(p.company_name || '')}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Telepon</span><input name="phone" maxlength="30" placeholder="08xxxxxxxxxx"></label>
            <label class="field"><span>Tanggal bergabung</span><input name="joined_at" type="date" value="${U.todayISO()}"></label>
            <label class="field"><span>Tarif/jam (Rp)</span><input name="hourly_rate" type="number" min="0" step="500" value="0"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">${L.icon('plus', 14)} Simpan karyawan</button></div>
        </form>
      </div>
    </details>`) : '';

  const roleChips = Object.keys(ROLE_LABELS).map((role) => `<a class="team-chip${filter.role === role ? ' is-active' : ''}"
      href="${ctx.base}/team?role=${role}">${U.h(ROLE_LABELS[role])} <b>${U.num(stats.perRole[role] || 0)}</b></a>`).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Karyawan', U.num(stats.total), `${stats.active} aktif · ${stats.inactive} nonaktif`],
        ['Sesi aktif', U.num(stats.sessions), 'perangkat yang sedang masuk'],
        ['Tanpa jabatan', U.num(stats.noPosition), 'belum ditempatkan di struktur'],
        ['Tanpa atasan', U.num(stats.noManager), 'belum punya garis pelaporan'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${createCard}

    ${L.card({ title: 'Daftar karyawan', subtitle: `${rows.length} dari ${stats.total} karyawan · klik "Kelola" untuk mengubah profil & kredensial` }, `
      <form method="get" action="${ctx.base}/team" class="team-filter">
        <label class="field"><span>Cari</span>
          <input name="q" value="${U.h(filter.q || '')}" placeholder="nama, email, jabatan">
        </label>
        <label class="field"><span>Entitas</span>
          <select name="company">${companyFilterOptions}</select>
        </label>
        <label class="field"><span>Role</span>
          <select name="role">
            <option value="">Semua role</option>
            ${Object.entries(ROLE_LABELS).map(([k, l]) => `<option value="${k}" ${filter.role === k ? 'selected' : ''}>${U.h(l)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Status</span>
          <select name="status">
            <option value="">Semua status</option>
            <option value="active" ${filter.status === 'active' ? 'selected' : ''}>Aktif</option>
            <option value="inactive" ${filter.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </label>
        <label class="field"><span>Jabatan</span>
          <select name="position">
            <option value="">Semua</option>
            <option value="none" ${filter.position === 'none' ? 'selected' : ''}>Belum punya jabatan</option>
            <option value="filled" ${filter.position === 'filled' ? 'selected' : ''}>Sudah punya jabatan</option>
          </select>
        </label>
        <button class="btn btn-primary btn-sm" type="submit">Terapkan</button>
        ${filter.q || filter.company || filter.role || filter.status || filter.position
          ? `<a class="btn btn-ghost btn-sm" href="${ctx.base}/team">Reset</a>` : ''}
      </form>
      <div class="team-chips">${roleChips}</div>
      <div class="table-wrap"><table class="data team-table">
        <thead><tr><th>Karyawan</th><th>Jabatan</th><th>Entitas</th><th>Role</th><th class="num">Tarif/jam</th><th class="num">Sesi</th><th>Status</th><th class="num"></th></tr></thead>
        <tbody>${rowHtml || `<tr><td colspan="8">${L.empty('Tidak ada karyawan yang cocok dengan filter')}</td></tr>`}</tbody>
      </table></div>
      <p class="hint-text">Hak akses tiap role: ${Object.keys(ROLE_LABELS).map((r) => `<b>${U.h(ROLE_LABELS[r])}</b> — ${U.h(ROLE_DESC[r])}`).join(' · ')}</p>`)}

    ${canCredential ? '' : `<p class="hint-text">${L.icon('lock', 13)} Anda dapat menyesuaikan profil & penempatan. Perubahan email, role, atau password hanya dapat dilakukan owner.</p>`}
  `;

  return L.shell(ctx, {
    title: 'Master Data Karyawan',
    subtitle: 'Profil, penempatan, dan kredensial akun dalam satu tempat',
    active: '/team',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/structure">${L.icon('sitemap', 15)} Struktur organisasi</a>`,
  });
}

// ---------------------------------------------------------------- detail karyawan

function teamMemberPage(ctx, data) {
  const { member, positions, managers, companies, canWrite, canCredential, activity, isSelf } = data;
  const companyOptions = companies.map((c) => ({ id: c.id, label: c.name }));

  const profileCard = L.card({
    title: 'Profil kepegawaian',
    subtitle: canWrite ? 'Nama, jabatan, atasan, entitas, tarif, dan kontak kerja' : 'Anda hanya dapat melihat data ini',
  }, canWrite ? `<form method="post" action="${ctx.base}/team/${member.id}/profile" class="stack-form">
      ${ctx.csrfField}${ctx.backField}
      <div class="form-grid">
        <label class="field"><span>Nama lengkap</span><input name="name" value="${U.h(member.name)}" required maxlength="120"></label>
        <label class="field"><span>Jabatan (tampilan)</span><input name="job_title" value="${U.h(member.job_title || '')}" maxlength="80" placeholder="mis. Head Barista"></label>
        <label class="field"><span>Jabatan struktural</span>
          <select name="position_id">${optionList(positions.map((p) => ({ id: p.id, label: `${p.name} · ${POS_LEVEL_LABEL[p.level] || p.level}` })), member.position_id, '— tanpa jabatan —')}</select>
        </label>
        <label class="field"><span>Entitas / penempatan</span>
          <select name="company_id">${optionList(companyOptions, member.company_id)}</select>
        </label>
        <label class="field"><span>Atasan langsung</span>
          <select name="manager_id">${optionList(managers.map((m) => ({ id: m.id, label: `${m.name}${m.job_title ? ' · ' + m.job_title : ''}` })), member.manager_id, '— tanpa atasan —')}</select>
        </label>
        <label class="field"><span>Tarif/jam (Rp)</span><input name="hourly_rate" type="number" min="0" step="500" value="${Number(member.hourly_rate) || 0}"></label>
        <label class="field"><span>Telepon</span><input name="phone" value="${U.h(member.phone || '')}" maxlength="30"></label>
        <label class="field"><span>Lokasi kerja</span><input name="location" value="${U.h(member.location || '')}" maxlength="120"></label>
        <label class="field"><span>Tanggal bergabung</span>
          <input name="joined_at" type="date" value="${U.h(String(member.joined_at || '').slice(0, 10))}">
        </label>
        <label class="field" style="grid-column:1/-1"><span>Foto profil (URL)</span>
          <input name="photo_url" value="${U.h(member.photo_url || '')}" maxlength="400" placeholder="https://… (kosongkan untuk tetap)">
        </label>
        <label class="field" style="grid-column:1/-1"><span>Catatan / bio singkat</span>
          <textarea name="bio" rows="3" maxlength="600">${U.h(member.bio || '')}</textarea>
        </label>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-sm" type="submit">Simpan profil</button>
        ${member.photo_url ? `<label class="team-check"><input type="checkbox" name="remove_photo" value="1"> Hapus foto</label>` : ''}
      </div>
    </form>` : `<dl class="team-facts">
      <div><dt>Nama</dt><dd>${U.h(member.name)}</dd></div>
      <div><dt>Jabatan</dt><dd>${U.h(member.position_name || member.job_title || '—')}</dd></div>
      <div><dt>Entitas</dt><dd>${U.h(member.company_name || '—')}</dd></div>
      <div><dt>Atasan</dt><dd>${U.h(member.manager_name || '—')}</dd></div>
      <div><dt>Telepon</dt><dd>${U.h(member.phone || '—')}</dd></div>
      <div><dt>Bergabung</dt><dd>${U.h(member.joined_at || '—')}</dd></div>
    </dl>`);

  const credentialCard = canCredential ? L.card({
    title: 'Kredensial & keamanan akun',
    subtitle: 'Email masuk, role, status, dan password',
  }, `
    <form method="post" action="${ctx.base}/team/${member.id}/credential" class="stack-form">
      ${ctx.csrfField}${ctx.backField}
      <div class="form-grid">
        <label class="field"><span>Email (untuk masuk)</span><input name="email" type="email" value="${U.h(member.email)}" required maxlength="160"></label>
        <label class="field"><span>Role / hak akses</span>
          <select name="role">${Object.entries(ROLE_LABELS).map(([k, l]) => `<option value="${k}" ${member.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Status akun</span>
          <select name="active">
            <option value="1" ${member.active ? 'selected' : ''}>Aktif</option>
            <option value="0" ${member.active ? '' : 'selected'}>Nonaktif (tidak bisa masuk)</option>
          </select>
        </label>
      </div>
      <p class="hint-text">${U.h(ROLE_DESC[member.role] || '')}</p>
      <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan kredensial</button></div>
    </form>

    <form method="post" action="${ctx.base}/team/${member.id}/password" class="stack-form team-subform">
      ${ctx.csrfField}${ctx.backField}
      <p class="form-section">Atur password baru</p>
      <div class="form-grid">
        <label class="field"><span>Password baru</span><input name="password" type="text" minlength="6" required placeholder="minimal 6 karakter"></label>
        <label class="field"><span>Ulangi password</span><input name="password_confirm" type="text" minlength="6" required></label>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-sm" type="submit">${L.icon('lock', 14)} Simpan password</button>
      </div>
      <p class="hint-text">Sesi lain milik karyawan ini otomatis keluar setelah password diganti.</p>
    </form>

    <div class="form-actions team-subform">
      <form method="post" action="${ctx.base}/team/${member.id}/sessions">
        ${ctx.csrfField}${ctx.backField}
        <button class="btn btn-ghost btn-sm" type="submit">${L.icon('lock', 14)} Keluarkan dari semua sesi</button>
      </form>
      <form method="post" action="${ctx.base}/admin/resets/link">
        ${ctx.csrfField}${ctx.backField}
        <input type="hidden" name="user_id" value="${member.id}">
        <button class="btn btn-ghost btn-sm" type="submit">Buat tautan reset</button>
      </form>
      ${isSelf ? '<span class="hint-text">Akun Anda sendiri tidak bisa dinonaktifkan atau dihapus dari sini.</span>' : `<form method="post" action="${ctx.base}/team/${member.id}/delete" data-confirm="Hapus akun ${U.h(member.name)}? Tindakan ini tidak bisa dibatalkan.">
        ${ctx.csrfField}${ctx.backField}
        <button class="btn btn-danger btn-sm" type="submit">Hapus akun</button>
      </form>`}
    </div>`) : L.card({
    title: 'Kredensial & keamanan akun',
    subtitle: 'Hanya owner yang dapat mengubah email, role, dan password',
  }, `<dl class="team-facts">
      <div><dt>Email</dt><dd>${U.h(member.email)}</dd></div>
      <div><dt>Role</dt><dd>${roleBadge(member.role)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(member.active)}</dd></div>
    </dl>`);

  const activityRows = activity.logs.map((l) => `<tr>
    <td>${U.h(String(l.created_at).slice(0, 16))}</td>
    <td><span class="strong">${U.h(l.action)}</span><span class="sub-cell">${U.h(l.detail || '')}</span></td>
  </tr>`).join('');

  const summaryCard = L.card({ title: 'Ringkasan', subtitle: 'Sesi, absensi, penjualan, dan progres belajar' }, `
    <div class="team-kpis">
      ${[
        ['Sesi aktif', U.num(activity.sessions.length), 'perangkat masuk'],
        ['Absensi 30 hari', U.num(activity.attendance.days), `${Math.round(activity.attendance.minutes / 60)} jam kerja`],
        ['Terlambat', U.num(activity.attendance.late), 'menit terakumulasi'],
        ['Transaksi', U.num(activity.sales.count), U.idrShort(activity.sales.value)],
        ['Modul Academy', `${activity.lms.done}/${activity.lms.total}`, 'selesai'],
        ['Sertifikat', U.num(activity.certificates), 'aktif'],
      ].map(([label, value, sub]) => `<div class="team-kpi">
        <span>${U.h(label)}</span><strong>${value}</strong><em>${U.h(sub)}</em>
      </div>`).join('')}
    </div>
    ${activity.sessions.length ? `<div class="table-wrap" style="margin-top:var(--sp-4)"><table class="data">
      <thead><tr><th>Perangkat / sesi</th><th>Mulai</th><th>Berakhir</th></tr></thead>
      <tbody>${activity.sessions.map((s) => `<tr>
        <td><span class="strong">${U.h(String(s.token).slice(0, 10))}…</span></td>
        <td>${U.h(String(s.created_at).slice(0, 16))}</td>
        <td>${U.h(String(s.expires_at).slice(0, 16))}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="hint-text">Belum ada sesi aktif.</p>'}`);

  const body = `
    <div class="team-hero">
      ${avatar(member, 64)}
      <div class="team-hero-main">
        <h2>${U.h(member.name)}</h2>
        <p>${U.h(member.position_name || member.job_title || 'Belum ada jabatan')} · ${U.h(member.company_name || '—')}</p>
        <div class="team-hero-badges">${roleBadge(member.role)} ${statusBadge(member.active)}
          ${member.manager_name ? L.badge(`Melapor ke ${member.manager_name}`, 'muted') : ''}</div>
      </div>
      <div class="team-hero-actions">
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/team">${L.icon('users', 14)} Semua karyawan</a>
        ${member.id === ctx.user.id ? '' : `<a class="btn btn-ghost btn-sm" href="${ctx.base}/profile?user=${member.id}">${L.icon('idcard', 14)} Profil publik</a>`}
      </div>
    </div>

    <div class="grid grid-side">
      <div class="grid" style="gap:var(--gap-card)">
        ${profileCard}
        ${credentialCard}
      </div>
      <div class="grid" style="gap:var(--gap-card)">
        ${summaryCard}
        ${L.card({ title: 'Aktivitas terakhir', subtitle: 'Dari catatan audit sistem' }, activityRows ? `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Waktu</th><th>Aksi</th></tr></thead><tbody>${activityRows}</tbody>
          </table></div>` : '<p class="hint-text">Belum ada aktivitas tercatat.</p>')}
      </div>
    </div>
  `;

  return L.shell(ctx, {
    title: member.name,
    subtitle: `Master data karyawan · ${member.email}`,
    active: '/team',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.base}/team">${L.icon('users', 15)} Master karyawan</a>`,
  });
}

module.exports = { teamPage, teamMemberPage, ROLE_LABELS };
