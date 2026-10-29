'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const { STATUS_LABEL } = require('../lib/attendance');

const ROLE_LABEL = {
  owner: 'Owner', director: 'Direktur', manager: 'Manajer', finance: 'Finance',
  cashier: 'Barista/Kasir', staff: 'Staff',
};

function statusBadge(status) {
  const tone = status === 'present' ? 'good' : status === 'late' ? 'warn' : status === 'absent' ? 'bad' : 'muted';
  return L.badge(STATUS_LABEL[status] || status, tone);
}

function fmtTime(stamp) {
  if (!stamp) return '—';
  return String(stamp).slice(11, 16);
}

function hoursText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}j ${String(m).padStart(2, '0')}m`;
}

// Kartu absen hari ini (dipakai di halaman absensi & topbar).
function todayCard(ctx, data) {
  const { today, user } = data;
  const att = today.attendance;
  const sch = today.schedule;
  const clockedIn = att && att.clock_in && !att.clock_out;
  const done = att && att.clock_out;
  const shiftInfo = sch
    ? `${U.h(sch.shift_name || 'Shift')} · ${U.h(sch.start_time)}–${U.h(sch.end_time)}`
    : 'Belum ada jadwal shift hari ini';

  return `<section class="clock-card ${done ? 'is-done' : clockedIn ? 'is-open' : ''}">
    <div class="clock-left">
      <span class="clock-date">${U.dateLabel(today.date)}</span>
      <h2>${done ? 'Absensi hari ini selesai' : clockedIn ? 'Anda sedang bekerja' : 'Belum absen masuk'}</h2>
      <p class="clock-sub">${shiftInfo}</p>
      <div class="clock-times">
        <div><span>Masuk</span><strong>${fmtTime(att && att.clock_in)}</strong></div>
        <div><span>Pulang</span><strong>${fmtTime(att && att.clock_out)}</strong></div>
        <div><span>Keterlambatan</span><strong>${att && att.late_minutes ? att.late_minutes + ' menit' : '—'}</strong></div>
        <div><span>Jam kerja</span><strong>${att && att.work_minutes ? hoursText(att.work_minutes) : '—'}</strong></div>
      </div>
    </div>
    <div class="clock-actions">
      ${done
    ? `${L.badge('Selesai', 'good')}<p class="hint-text">Terima kasih, ${U.h(user.name.split(' ')[0])}!</p>`
    : clockedIn
      ? `<form method="post" action="${ctx.base}/attendance/clock-out">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-primary btn-clock" type="submit">${L.icon('clock', 18)} Absen Pulang</button>
          </form>
          <p class="hint-text">Masuk ${fmtTime(att.clock_in)}${att.late_minutes ? ` · terlambat ${att.late_minutes} menit` : ''}</p>`
      : `<form method="post" action="${ctx.base}/attendance/clock-in">
            ${ctx.csrfField}${ctx.backField}
            <button class="btn btn-primary btn-clock" type="submit">${L.icon('clock', 18)} Absen Masuk</button>
          </form>
          <p class="hint-text">Tombol pulang muncul setelah Anda absen masuk.</p>`}
    </div>
  </section>`;
}

function attendancePage(ctx, data) {
  const { today, recap, rows, series, filters, users, labor, selectedUserId } = data;
  const canManage = can(ctx.user, 'attendance_write');

  const rekapRows = recap.rows.map((r) => `<tr>
    <td><span class="strong">${U.h(r.user_name)}</span><span class="sub-cell">${U.h(ROLE_LABEL[r.role] || r.role)} · ${U.h(r.company_name)}</span></td>
    <td class="num">${U.num(r.present_days + r.late_days)}</td>
    <td class="num">${r.late_days ? L.badge(U.num(r.late_days) + '×', 'warn') : '—'}</td>
    <td class="num">${r.absent_days ? L.badge(U.num(r.absent_days) + '×', 'bad') : '—'}</td>
    <td class="num">${U.num(r.late_minutes)} mnt</td>
    <td class="num strong">${U.num(r.hours, 1)} jam</td>
    <td class="num">${U.pct(r.punctuality, 0)}</td>
    <td class="num">${U.idrShort(r.cost)}</td>
  </tr>`).join('');

  const detailRows = rows.map((r) => `<tr>
    <td>${U.h(r.date)}<span class="sub-cell">${U.h(r.shift_name || '—')}</span></td>
    <td>${U.h(r.user_name)}<span class="sub-cell">${U.h(r.company_name)}</span></td>
    <td class="num">${fmtTime(r.clock_in)}</td>
    <td class="num">${fmtTime(r.clock_out)}</td>
    <td class="num">${r.work_minutes ? hoursText(r.work_minutes) : '—'}</td>
    <td class="num">${r.late_minutes ? r.late_minutes + ' mnt' : '—'}</td>
    <td>${statusBadge(r.status)}</td>
  </tr>`).join('');

  const seriesRows = series.map((s) => `<tr>
    <td>${U.h(s.date)}</td>
    <td class="num">${U.num(s.people)}</td>
    <td class="num">${s.late ? L.badge(U.num(s.late), 'warn') : '—'}</td>
    <td class="num">${s.absent ? L.badge(U.num(s.absent), 'bad') : '—'}</td>
    <td class="num">${U.num(s.work_minutes / 60, 1)} jam</td>
  </tr>`).join('');

  const body = `
    ${todayCard(ctx, data)}

    <div class="grid grid-4">
      ${[
        ['Jam kerja bulan ini', U.num(recap.totals.hours, 1) + ' jam', `${recap.totals.days} hari hadir`],
        ['Keterlambatan', U.num(recap.totals.lateDays) + ' hari', `${U.num(recap.totals.lateMinutes)} menit total`],
        ['Tidak hadir', U.num(recap.totals.absentDays) + ' hari', 'tanpa keterangan'],
        ['Estimasi biaya tenaga kerja', U.idrShort(labor.cost), `${U.num(labor.hours, 1)} jam × tarif per jam`],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Rekap jam kerja per barista', subtitle: `${U.monthLabel(ctx.month)} · waktu lokal WIB` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Nama</th><th class="num">Hari hadir</th><th class="num">Terlambat</th><th class="num">Absen</th><th class="num">Total telat</th><th class="num">Jam kerja</th><th class="num">Ketepatan</th><th class="num">Est. biaya</th></tr></thead>
        <tbody>${rekapRows || `<tr><td colspan="8">${L.empty('Belum ada data absensi bulan ini')}</td></tr>`}</tbody>
        ${recap.rows.length ? `<tr class="is-total">
          <td>Total (${recap.totals.people} orang)</td>
          <td class="num">${U.num(recap.totals.days)}</td>
          <td class="num">${U.num(recap.totals.lateDays)}</td>
          <td class="num">${U.num(recap.totals.absentDays)}</td>
          <td class="num">${U.num(recap.totals.lateMinutes)} mnt</td>
          <td class="num">${U.num(recap.totals.hours, 1)} jam</td>
          <td class="num">—</td>
          <td class="num">${U.idrShort(recap.totals.cost)}</td>
        </tr>` : ''}</tbody>
      </table></div>
      ${canManage ? `<div class="chip-row" style="margin-top:14px">
        ${L.badge('Gaji tercatat ' + U.idrShort(labor.recorded), 'muted')}
        ${L.badge(labor.variance >= 0 ? 'Estimasi di bawah catatan ' + U.idrShort(Math.abs(labor.variance)) : 'Estimasi di atas catatan ' + U.idrShort(Math.abs(labor.variance)), labor.variance >= 0 ? 'good' : 'warn')}
      </div>` : ''}`)}

    <div class="grid grid-side">
      ${L.card({ title: 'Aktivitas harian terakhir', subtitle: 'Jumlah barista hadir, terlambat, dan tidak hadir' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Tanggal</th><th class="num">Hadir</th><th class="num">Telat</th><th class="num">Absen</th><th class="num">Jam kerja</th></tr></thead>
          <tbody>${seriesRows || `<tr><td colspan="5">${L.empty('Belum ada aktivitas')}</td></tr>`}</tbody>
        </table></div>`)}

      ${canManage ? L.card({ title: 'Catatan absensi', subtitle: 'Ubah status manual bila ada kendala (mis. lupa absen)' }, `
        <form method="post" action="${ctx.base}/attendance/manual">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Barista / staff</span>
              <select name="user_id">${users.map((u) => `<option value="${u.id}" ${Number(selectedUserId) === u.id ? 'selected' : ''}>${U.h(u.name)} · ${U.h(ROLE_LABEL[u.role] || u.role)}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Tanggal</span><input name="date" type="date" value="${U.todayISO()}" required></label>
            <label class="field"><span>Status</span>
              <select name="status">
                <option value="present">Hadir</option>
                <option value="late">Terlambat</option>
                <option value="absent">Tidak hadir</option>
                <option value="leave">Izin / cuti</option>
              </select>
            </label>
            <label class="field"><span>Shift</span>
              <select name="shift_id"><option value="">— ikuti jadwal —</option>
                ${data.shifts.map((s) => `<option value="${s.id}">${U.h(s.name)} · ${U.h(s.start_time)}–${U.h(s.end_time)} · ${U.h(s.company_name)}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Jam masuk</span><input name="clock_in" type="time" value="08:00"></label>
            <label class="field"><span>Jam pulang</span><input name="clock_out" type="time" value="16:00"></label>
            <label class="field field-full"><span>Catatan</span><input name="note" placeholder="mis. lupa absen pulang"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('check', 15)} Simpan absensi</button></div>
        </form>`) : L.card({ title: 'Peran Anda', subtitle: 'Absensi mandiri' }, `
          <p class="hint-text">Anda dapat melakukan absen masuk/pulang sendiri. Rekap seluruh tim hanya terlihat oleh manajer, finance, direktur, dan owner.</p>`)}
    </div>

    ${L.card({ title: 'Riwayat absensi', subtitle: `${rows.length} baris terbaru · filter berdasarkan barista di form catatan` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Tanggal</th><th>Nama</th><th class="num">Masuk</th><th class="num">Pulang</th><th class="num">Jam kerja</th><th class="num">Telat</th><th>Status</th></tr></thead>
        <tbody>${detailRows || `<tr><td colspan="7">${L.empty('Belum ada riwayat absensi')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Absensi & Jam Kerja',
    subtitle: `${ctx.scopeCompany ? ctx.scopeCompany.name : 'Semua outlet'} · ${U.monthLabel(ctx.month)}`,
    active: '/attendance',
    content: body,
    toolbar: `${L.exportButton(ctx, 'attendance')}<a class="btn btn-ghost btn-sm" href="${ctx.link('/attendance/schedule')}">${L.icon('clock', 15)} Jadwal shift</a>`,
  });
}

function schedulePage(ctx, data) {
  const { weekStart, days, grid, shifts, users, selectedOutlet, selectedShift } = data;
  const canWrite = can(ctx.user, 'schedule_write');
  const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const header = days.map((d, i) => `<th class="sched-day ${d === U.todayISO() ? 'is-today' : ''}">
    <span>${dayLabels[i]}</span><strong>${Number(d.slice(8, 10))}</strong><em>${U.h(U.MONTHS_ID[Number(d.slice(5, 7)) - 1])}</em>
  </th>`).join('');

  const rows = users.map((u) => {
    const cells = days.map((d) => {
      const entry = grid.get(u.id + '|' + d);
      if (!entry) {
        return `<td class="sched-cell empty">${canWrite ? `<button class="sched-add" type="button"
          data-sched-user="${u.id}" data-sched-date="${d}" data-sched-name="${U.h(u.name)}"
          data-sched-company="${u.company_id}" title="Tambah shift">+</button>` : '<span class="muted">—</span>'}</td>`;
      }
      const late = entry.late_minutes ? `<em class="sched-late">telat ${entry.late_minutes}m</em>` : '';
      const attMark = entry.att_status === 'absent' ? '<em class="sched-absent">absen</em>'
        : entry.att_status ? '<em class="sched-ok">✓</em>' : '';
      return `<td class="sched-cell">
        <div class="sched-chip" style="--chip:${entry.color}">
          <strong>${U.h(entry.shift_name)}</strong>
          <span>${U.h(entry.start_time)}–${U.h(entry.end_time)}</span>
          ${late}${attMark}
          ${canWrite ? `<form method="post" action="${ctx.base}/attendance/schedule/${entry.id}/delete" data-confirm="Hapus shift ${U.h(u.name)} pada ${U.h(d)}?">
            ${ctx.csrfField}${ctx.backField}<button class="sched-del" type="submit" title="Hapus">×</button></form>` : ''}
        </div>
      </td>`;
    }).join('');
    return `<tr>
      <td class="sched-person">
        <span class="mini-avatar">${U.h(U.initials(u.name))}</span>
        <span><strong>${U.h(u.name)}</strong><em>${U.h(ROLE_LABEL[u.role] || u.role)} · ${U.h(u.company_name)}</em></span>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  const shiftLegend = shifts.map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${shiftColor(s.id)}"></span>${U.h(s.name)} ${U.h(s.start_time)}–${U.h(s.end_time)}</span>`).join('');

  const body = `
    <div class="sched-toolbar">
      <div class="sched-nav">
        <a class="btn btn-ghost btn-sm" href="${ctx.link('/attendance/schedule', { week: data.prevWeek })}">← Minggu sebelumnya</a>
        <strong>${U.dateLabel(days[0])} – ${U.dateLabel(days[6])}</strong>
        <a class="btn btn-ghost btn-sm" href="${ctx.link('/attendance/schedule', { week: data.nextWeek })}">Minggu berikutnya →</a>
        <a class="btn btn-ghost btn-sm" href="${ctx.link('/attendance/schedule')}">Minggu ini</a>
      </div>
      <div class="chart-legend">${shiftLegend}</div>
    </div>

    ${L.card({ title: 'Jadwal shift barista', subtitle: canWrite ? 'Klik “+” untuk menambah shift, “×” untuk menghapus' : 'Hanya manajer yang dapat mengubah jadwal' }, `
      <div class="table-wrap"><table class="data sched-table">
        <thead><tr><th>Barista</th>${header}</tr></thead>
        <tbody>${rows || `<tr><td colspan="8">${L.empty('Belum ada staf dalam cakupan ini')}</td></tr>`}</tbody>
      </table></div>`)}

    ${canWrite ? L.card({ title: 'Tambah shift ke jadwal', subtitle: 'Pilih barista, tanggal, dan shift yang berlaku' }, `
      <form method="post" action="${ctx.base}/attendance/schedule" id="sched-form">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Barista / staff</span>
            <select name="user_id" id="sched-user">${users.map((u) => `<option value="${u.id}" data-company="${u.company_id}">${U.h(u.name)} · ${U.h(u.company_name)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Tanggal</span><input name="date" id="sched-date" type="date" value="${days[0]}" required></label>
          <label class="field"><span>Shift</span>
            <select name="shift_id" id="sched-shift">${shifts.map((s) => `<option value="${s.id}" data-company="${s.company_id}">${U.h(s.name)} · ${U.h(s.start_time)}–${U.h(s.end_time)} · ${U.h(s.company_name)}</option>`).join('')}</select>
          </label>
          <label class="field field-full"><span>Catatan (opsional)</span><input name="note" placeholder="mis. tukar shift dengan Agung"></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan jadwal</button></div>
      </form>`) : ''}

    ${L.card({ title: 'Master shift', subtitle: 'Shift berlaku per outlet; absensi otomatis menghitung keterlambatan dari jam mulai shift' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Shift</th><th>Outlet</th><th class="num">Mulai</th><th class="num">Selesai</th><th class="num">Istirahat</th><th>Status</th>${canWrite ? '<th></th>' : ''}</tr></thead>
        <tbody>${shifts.map((s) => `<tr>
          <td class="strong">${U.h(s.name)}</td>
          <td>${U.h(s.company_name)}</td>
          <td class="num">${U.h(s.start_time)}</td>
          <td class="num">${U.h(s.end_time)}</td>
          <td class="num">${U.num(s.break_minutes)} mnt</td>
          <td>${s.active ? L.badge('Aktif', 'good') : L.badge('Nonaktif', 'muted')}</td>
          ${canWrite ? `<td class="num"><form method="post" action="${ctx.base}/attendance/shifts/${s.id}/delete" data-confirm="Hapus shift ${U.h(s.name)}?">
            ${ctx.csrfField}${ctx.backField}<button class="btn btn-ghost btn-sm" type="submit">Hapus</button></form></td>` : ''}
        </tr>`).join('') || `<tr><td colspan="7">${L.empty('Belum ada shift')}</td></tr>`}</tbody>
      </table></div>
      ${canWrite ? `<form method="post" action="${ctx.base}/attendance/shifts" style="margin-top:16px">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama shift</span><input name="name" required placeholder="mis. Shift Malam"></label>
          <label class="field"><span>Outlet</span>
            <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${Number(selectedOutlet) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Jam mulai</span><input name="start_time" type="time" value="08:00" required></label>
          <label class="field"><span>Jam selesai</span><input name="end_time" type="time" value="16:00" required></label>
          <label class="field"><span>Istirahat (menit)</span><input name="break_minutes" type="number" min="0" max="120" value="30"></label>
          <label class="field"><span>&nbsp;</span><span class="hint-text">Shift diterapkan ke seluruh barista di outlet tersebut.</span></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan shift</button></div>
      </form>` : ''}`)}
  `;

  return L.shell(ctx, {
    title: 'Jadwal Shift',
    subtitle: 'Atur shift barista per outlet dan pantau kehadirannya',
    active: '/attendance/schedule',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.link('/attendance')}">${L.icon('users', 15)} Rekap absensi</a>`,
  });
}

const SHIFT_COLORS = ['#c1352d', '#2f8f8a', '#dd9a16', '#2b8a66', '#b03a52', '#b25a2a'];
function shiftColor(id) {
  return SHIFT_COLORS[Math.abs(Number(id) || 0) % SHIFT_COLORS.length];
}

module.exports = { attendancePage, schedulePage, todayCard, statusBadge, shiftColor, ROLE_LABEL, hoursText };
