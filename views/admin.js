'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { ROLE_LABELS, ROLE_DESC, ROLE_CAPS } = require('../lib/auth');

function adminPage(ctx, data) {
  const { companies, users, counts, resets = [] } = data;

  const tree = (() => {
    const childrenOf = new Map();
    for (const c of companies) {
      if (!childrenOf.has(c.parent_id)) childrenOf.set(c.parent_id, []);
      childrenOf.get(c.parent_id).push(c);
    }
    const render = (parentId, depth) => (childrenOf.get(parentId) || []).map((c) => `
      ${depth === 0 ? '' : ''}<tr>
        <td style="padding-left:${14 + depth * 20}px"><span class="strong">${U.h(c.name)}</span><span class="sub-cell">${U.h(c.code || '')} · ${U.h(c.level)}</span></td>
        <td class="num">${counts.outlets.get(c.id) || 0} outlet</td>
        <td class="num">${counts.users.get(c.id) || 0} user</td>
        <td class="num">
          <form method="post" action="${ctx.base}/admin/companies/${c.id}/delete" data-confirm="Hapus entitas ${U.h(c.name)}?">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-ghost btn-sm" type="submit" ${c.parent_id === null ? 'disabled' : ''}>Hapus</button>
          </form>
        </td>
      </tr>
      ${render(c.id, depth + 1)}`).join('');
    return render(null, 0);
  })();

  const userRows = users.map((u) => `<tr>
    <td><span class="strong">${U.h(u.name)}</span><span class="sub-cell">${U.h(u.email)}</span></td>
    <td>${U.h(u.company_name)}</td>
    <td>${L.badge(ROLE_LABELS[u.role] || u.role, u.role === 'owner' ? 'indigo' : 'muted')}</td>
    <td class="num">${u.hourly_rate ? U.idrShort(u.hourly_rate) : '—'}</td>
    <td>${u.active ? L.badge('Aktif', 'good') : L.badge('Nonaktif', 'bad')}</td>
    <td class="num">
      <details class="disclosure" style="border:none;background:transparent">
        <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo);justify-content:flex-end">Ubah tarif</summary>
        <div class="disc-body" style="padding:8px 0">
          <form method="post" action="${ctx.base}/admin/users/${u.id}/rate" style="display:flex;gap:6px;justify-content:flex-end">
            ${ctx.csrfField}${ctx.backField}
            <input name="hourly_rate" type="number" min="0" step="500" value="${u.hourly_rate || 0}"
              style="width:100px;padding:5px 8px;border-radius:8px;border:1px solid var(--line-strong);font:inherit;font-size:12px;text-align:right">
            <button class="btn btn-ghost btn-sm" type="submit">Simpan</button>
          </form>
        </div>
      </details>
    </td>
    <td class="num">
      <form method="post" action="${ctx.base}/admin/users/${u.id}/toggle" style="display:inline">
        ${ctx.csrfField}${ctx.backField}
        <button class="btn btn-ghost btn-sm" type="submit">${u.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
      </form>
      <form method="post" action="${ctx.base}/admin/users/${u.id}/delete" data-confirm="Hapus user ${U.h(u.name)}?" style="display:inline">
        ${ctx.csrfField}${ctx.backField}
        <button class="btn btn-danger btn-sm" type="submit" ${u.role === 'owner' ? 'disabled title="Owner utama tidak dapat dihapus"' : ''}>Hapus</button>
      </form>
    </td>
  </tr>`).join('');

  const roleRows = Object.keys(ROLE_LABELS).map((role) => `<tr>
    <td><span class="strong">${U.h(ROLE_LABELS[role])}</span><span class="sub-cell">${U.h(ROLE_DESC[role])}</span></td>
    <td>${(ROLE_CAPS[role] || []).map((c) => L.badge(c.replace('_', ' '), 'muted')).join(' ')}</td>
  </tr>`).join('');

  const body = `
    <div class="grid grid-2" style="margin-bottom:20px">
      ${L.card({ title: 'Struktur organisasi & jabatan', subtitle: 'Kelola hierarki entitas, jabatan, atasan, dan penempatan orang' }, `
        <p style="font-size:var(--fs-sm);color:var(--text-soft);line-height:var(--lh-base)">Halaman <b>Struktur Organisasi</b> kini menjadi tempat utama untuk mengubah hierarki
        (holding → unit usaha → cabang), membuat jabatan, dan menetapkan siapa melapor ke siapa.</p>
        <div class="form-actions"><a class="btn btn-primary btn-sm" href="${ctx.base}/structure">${L.icon('sitemap', 15)} Buka struktur organisasi</a></div>`)}
      ${L.card({ title: 'Profil pengguna', subtitle: 'Foto, sampul, dan data kepegawaian' }, `
        <p style="font-size:var(--fs-sm);color:var(--text-soft);line-height:var(--lh-base)">Setiap pengguna bisa mengatur foto profil, sampul, bio, dan password sendiri.
        Sebagai owner Anda dapat membuka profil anggota tim dari tabel di bawah atau dari halaman struktur.</p>
        <div class="form-actions"><a class="btn btn-ghost btn-sm" href="${ctx.base}/profile">${L.icon('idcard', 15)} Profil saya</a></div>`)}
    </div>

    <div class="grid grid-4">
      ${[
        ['Total entitas', String(companies.length), 'holding, unit, outlet'],
        ['Pengguna', String(users.filter((u) => u.active).length), 'aktif'],
        ['Outlet', String(companies.filter((c) => c.level === 'outlet').length), 'titik penjualan'],
        ['Role tersedia', String(Object.keys(ROLE_LABELS).length), 'dengan hak berbeda'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    <div class="grid grid-side">
      ${L.card({ title: 'Struktur perusahaan', subtitle: 'Layer entitas menentukan cakupan data yang terlihat' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Entitas</th><th class="num">Outlet</th><th class="num">User</th><th></th></tr></thead>
          <tbody>${tree}</tbody>
        </table></div>
        <details class="disclosure" style="margin-top:14px">
          <summary>${L.icon('plus', 15)} Tambah entitas</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/admin/companies">
              ${ctx.csrfField}${ctx.backField}
              <div class="form-grid">
                <label class="field"><span>Nama entitas</span><input name="name" required placeholder="mis. Outlet Medan"></label>
                <label class="field"><span>Kode</span><input name="code" placeholder="mis. NRG-RET-MDN"></label>
                <label class="field"><span>Induk</span>
                  <select name="parent_id"><option value="">— tidak ada (holding) —</option>${companies.map((c) => `<option value="${c.id}">${U.h(c.name)}</option>`).join('')}</select>
                </label>
                <label class="field"><span>Level</span>
                  <select name="level"><option value="outlet">Outlet / cabang</option><option value="unit">Unit bisnis</option><option value="holding">Holding</option></select>
                </label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan entitas</button></div>
            </form>
          </div>
        </details>`)}

      ${L.card({ title: 'Pengguna & hak akses', subtitle: 'Setiap user hanya melihat data entitasnya dan turunannya' }, `
        <p style="font-size:var(--fs-sm);color:var(--text-soft);line-height:var(--lh-base);margin-bottom:var(--sp-3)">
          Untuk menyesuaikan profil, penempatan, email, role, dan password karyawan, gunakan halaman
          <b>Master Data Karyawan</b> — lebih lengkap daripada tabel ringkas di bawah.
          <a class="btn btn-primary btn-sm" style="margin-left:var(--sp-2)" href="${ctx.base}/team">${L.icon('users', 14)} Buka master karyawan</a>
        </p>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Nama</th><th>Entitas</th><th>Role</th><th class="num">Tarif/jam</th><th>Status</th><th></th></tr></thead>
          <tbody>${userRows}</tbody>
        </table></div>
        <details class="disclosure" style="margin-top:14px">
          <summary>${L.icon('plus', 15)} Tambah pengguna</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/admin/users">
              ${ctx.csrfField}${ctx.backField}
              <div class="form-grid">
                <label class="field"><span>Nama lengkap</span><input name="name" required></label>
                <label class="field"><span>Email</span><input name="email" type="email" required></label>
                <label class="field"><span>Password</span><input name="password" type="text" minlength="6" required placeholder="minimal 6 karakter"></label>
                <label class="field"><span>Entitas</span>
                  <select name="company_id">${companies.map((c) => `<option value="${c.id}">${U.h(c.name)}</option>`).join('')}</select>
                </label>
                <label class="field"><span>Role</span>
                  <select name="role">${Object.entries(ROLE_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
                </label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan pengguna</button></div>
            </form>
          </div>
        </details>`)}
    </div>

    ${L.card({ title: 'Password & keamanan akun', subtitle: 'Buat tautan reset untuk pengguna yang lupa password' }, `
      <p style="font-size:var(--fs-sm);color:var(--text-soft);line-height:var(--lh-base)">
        Pengguna bisa memakai tautan <b>Lupa password?</b> di halaman masuk. Bila pengiriman email/WhatsApp belum
        aktif, buat tautan manual di sini lalu kirim ke orangnya — berlaku ${'60'} menit dan sekali pakai.
      </p>
      <div class="table-wrap" style="margin-top:var(--sp-4)"><table class="data">
        <thead><tr><th>Permintaan</th><th>Akun</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${resets.length ? resets.map((r) => `<tr>
            <td>${U.dateLabel(r.created_at)} · ${U.timeLabel(r.created_at)}</td>
            <td><span class="strong">${U.h(r.name)}</span><span class="sub-cell">${U.h(r.email)}</span></td>
            <td>${L.badge(r.delivered === 'email' ? 'Terkirim via email' : r.delivered === 'whatsapp' ? 'Terkirim via WhatsApp' : r.delivered === 'manual' ? 'Tautan manual' : 'Belum terkirim', r.delivered === 'none' ? 'warn' : 'good')}</td>
            <td class="num">
              <form method="post" action="${ctx.base}/admin/resets/link" style="display:inline">
                ${ctx.csrfField}${ctx.backField}
                <input type="hidden" name="user_id" value="${r.user_id}">
                <button class="btn btn-ghost btn-sm" type="submit">Buat tautan</button>
              </form>
            </td>
          </tr>`).join('') : `<tr><td colspan="4"><span class="sub-cell">Belum ada permintaan reset yang menunggu.</span></td></tr>`}
        </tbody>
      </table></div>
      <details class="disclosure" style="margin-top:var(--sp-3)">
        <summary>${L.icon('lock', 15)} Buat tautan untuk pengguna lain</summary>
        <div class="disc-body">
          <form method="post" action="${ctx.base}/admin/resets/link">
            ${ctx.csrfField}${ctx.backField}
            <label class="field"><span>Pengguna</span>
              <select name="user_id">${users.filter((u) => u.active).map((u) => `<option value="${u.id}">${U.h(u.name)} · ${U.h(u.email)}</option>`).join('')}</select>
            </label>
            <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Buat tautan reset</button></div>
          </form>
        </div>
      </details>`)}

    ${L.card({ title: 'Matriks hak akses per role', subtitle: 'Ringkasan kapabilitas bawaan tiap role' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Role</th><th>Kapabilitas</th></tr></thead>
        <tbody>${roleRows}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Perusahaan & Pengguna',
    subtitle: 'Kelola struktur entitas, akun, dan hak akses',
    active: '/admin',
    content: body,
  });
}

module.exports = { adminPage };
