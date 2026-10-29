'use strict';

/**
 * Timeline proyek (Gantt chart) — mobile-first: satu baris per tugas, bar bisa digeser
 * (ubah tanggal) dan ujung kanannya ditarik (ubah durasi). Logika drag ada di
 * `public/app.js#initGantt`; tanpa JS halaman tetap terbaca & tanggal bisa diubah
 * lewat form "Ubah" pada setiap baris.
 */

const U = require('../lib/util');
const L = require('./layout');
const T = require('../lib/timeline');

function dayCells(win) {
  const cells = [];
  for (let i = 0; i < win.days; i++) {
    const iso = T.addDays(win.from, i);
    const dow = new Date(iso + 'T00:00:00').getDay();
    const weekend = dow === 0 || dow === 6;
    const today = iso === U.todayISO();
    const isMonday = dow === 1;
    cells.push(`<span class="gantt-day ${weekend ? 'is-weekend' : ''} ${today ? 'is-today' : ''} ${isMonday ? 'is-week' : ''}">
      ${isMonday ? `<b>${U.dateLabel(iso).split(' ').slice(0, 2).join(' ')}</b>` : ''}
      <i>${Number(iso.slice(8, 10))}</i></span>`);
  }
  return cells.join('');
}

function editForm(ctx, row, data, canWrite) {
  const owners = data.owners.map((u) => `<option value="${u.id}" ${row.owner_id === u.id ? 'selected' : ''}>${U.h(u.name)} · ${U.h(u.job_title || u.role)}</option>`).join('');
  const companies = data.companies.map((c) => `<option value="${c.id}" ${row.company_id === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('');
  const statuses = Object.entries(T.STATUS).map(([k, v]) => `<option value="${k}" ${row.status === k ? 'selected' : ''}>${U.h(v)}</option>`).join('');
  const action = row.source === 'raci' ? `${ctx.base}/timeline/raci/${row.id}/update` : `${ctx.base}/timeline/task/${row.id}`;
  const extra = row.source === 'raci'
    ? `<p class="hint-text">Aktivitas RACI — kolom R/A/C/I dan deskripsi dikelola di
        <a href="${ctx.base}/performance/raci">halaman RACI</a>.</p>`
    : `<label class="field"><span>Deskripsi</span><textarea name="description" rows="2">${U.h(row.description)}</textarea></label>`;
  return `<form method="post" action="${action}" class="stack-form">
    ${ctx.csrfField}${ctx.backField}
    <div class="form-grid" style="gap:10px">
      <label class="field"><span>Nama</span><input name="title" value="${U.h(row.title)}" maxlength="160" required ${row.source === 'raci' ? 'readonly' : ''}></label>
      <label class="field"><span>Mulai</span><input type="date" name="start_date" value="${U.h(row.start)}" required></label>
      <label class="field"><span>Selesai</span><input type="date" name="end_date" value="${U.h(row.end)}" required></label>
      <label class="field"><span>Status</span><select name="status">${statuses}</select></label>
      <label class="field"><span>Progres (%)</span><input type="number" name="progress" min="0" max="100" step="5" value="${Math.round(row.progress)}"></label>
      ${row.source === 'raci' ? '' : `<label class="field"><span>Entitas</span><select name="company_id">${companies}</select></label>
      <label class="field"><span>PIC</span><select name="owner_id"><option value="">— belum ditentukan —</option>${owners}</select></label>
      <label class="field"><span>Kelompok / fase</span><input name="track" value="${U.h(row.track === 'RACI' ? '' : row.track)}" maxlength="60" placeholder="mis. Peluncuran Q4"></label>`}
    </div>
    ${row.source === 'raci' ? `<input type="hidden" name="due_date" value="${U.h(row.end)}">` : extra}
    <div class="form-actions">
      <button class="btn btn-primary btn-sm" type="submit" ${canWrite ? '' : 'disabled'}>Simpan</button>
      ${row.source === 'task' && canWrite ? `<button class="btn btn-danger btn-sm" type="submit" formaction="${ctx.base}/timeline/task/${row.id}/delete"
        formnovalidate data-confirm="Hapus tugas ${U.h(row.title)}?">Hapus</button>` : ''}
    </div>
  </form>`;
}

function row(ctx, row, win, data) {
  const tone = T.statusTone(row.status);
  const barCls = `gantt-bar tone-${tone} ${row.status === 'done' ? 'is-done' : ''} ${row.late ? 'is-late' : ''} ${row.source === 'raci' ? 'is-raci' : ''}`;
  return `<div class="gantt-row" data-task data-source="${row.source}" data-id="${row.id}"
      data-start="${U.h(row.start)}" data-end="${U.h(row.end)}" data-title="${U.h(row.title)}"
      data-progress="${Math.round(row.progress)}">
    <div class="gantt-info">
      <span class="gantt-name">
        ${row.source === 'raci' ? L.icon('users', 13) : L.icon('flag', 13)}
        <b>${U.h(row.title)}</b>
      </span>
      <span class="gantt-meta">
        ${U.h(row.company || '—')}${row.owner ? ` · ${U.h(row.owner)}` : ''} · ${L.badge(T.statusLabel(row.status), tone)}
        ${row.late ? L.badge('Terlambat', 'bad') : ''}
      </span>
      <span class="gantt-range">${U.h(row.startLabel)} → ${U.h(row.endLabel)} · ${U.num(row.spanDays)} hari · ${U.pct(row.progress, 0)}</span>
      ${data.canWrite ? `<details class="disclosure gantt-edit">
        <summary>${L.icon('settings', 13)} Ubah</summary>
        <div class="disc-body">${editForm(ctx, row, data, data.canWrite)}</div>
      </details>` : ''}
    </div>
    <div class="gantt-track" data-gantt-track>
      <span class="${barCls}" data-gantt-bar tabindex="0" role="button"
        aria-label="${U.h(row.title)}: ${U.h(row.startLabel)} sampai ${U.h(row.endLabel)}, ${U.num(row.progress)} persen"
        style="left:${row.leftPct.toFixed(3)}%;width:${row.widthPct.toFixed(3)}%">
        <span class="gantt-fill" style="width:${Math.round(row.progress)}%"></span>
        <span class="gantt-label">${U.num(row.spanDays)}h</span>
        ${data.canWrite ? `<span class="gantt-handle" data-gantt-resize title="Tarik untuk ubah durasi"></span>` : ''}
      </span>
    </div>
  </div>`;
}

function timelinePage(ctx, data) {
  const { win, rows, undated, summary, canWrite, companies, owners, filter, moveUrl } = data;
  const prev = T.shiftWindow(win, -1);
  const next = T.shiftWindow(win, 1);
  const link = (w, patch = {}) => ctx.link('/timeline', Object.assign({ from: w.from, zoom: w.zoom }, filter, patch));

  const stats = [
    ['Total pekerjaan', U.num(summary.total), 'tugas & aktivitas RACI'],
    ['Berjalan', U.num(summary.running), `${U.num(summary.blocked)} terhambat`],
    ['Terlambat', U.num(summary.late), 'melewati tenggat'],
    ['Rata-rata progres', U.pct(summary.avg, 0), `${U.num(summary.done)} selesai`],
  ].map(([label, value, sub]) => `<article class="stat">
    <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
    <div class="stat-value">${value}</div>
    <div class="stat-sub">${U.h(sub)}</div>
  </article>`).join('');

  const zoomChips = Object.keys(T.ZOOMS).map((z) => `<a class="chip ${win.zoom === z ? 'is-active' : ''}"
      href="${link({ ...win, zoom: z })}">${z === '2w' ? '2 minggu' : z === '4w' ? '4 minggu' : '6 minggu'}</a>`).join('');

  const companyOptions = [`<option value="">Semua entitas</option>`]
    .concat(companies.map((c) => `<option value="${c.id}" ${Number(filter.company) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`)).join('');
  const statusOptions = [`<option value="">Semua status</option>`]
    .concat(Object.entries(T.STATUS).map(([k, v]) => `<option value="${k}" ${filter.status === k ? 'selected' : ''}>${U.h(v)}</option>`)).join('');
  const sourceOptions = [
    ['', 'Tugas + RACI'], ['task', 'Tugas proyek saja'], ['raci', 'Aktivitas RACI saja'],
  ].map(([v, l]) => `<option value="${v}" ${filter.source === v ? 'selected' : ''}>${l}</option>`).join('');

  const body = `
    <div class="grid grid-4">${stats}</div>

    ${L.card({
      title: 'Timeline proyek',
      subtitle: `${U.dateLabel(win.from)} – ${U.dateLabel(win.to)} · ${U.num(win.days)} hari`,
      action: `<div class="chip-row gantt-nav">
        <a class="btn btn-ghost btn-sm" href="${link(prev)}" aria-label="Periode sebelumnya">${L.icon('chevronLeft', 15)}</a>
        <a class="btn btn-ghost btn-sm" href="${link(T.windowFor({ zoom: win.zoom }))}">Hari ini</a>
        <a class="btn btn-ghost btn-sm" href="${link(next)}" aria-label="Periode berikutnya">${L.icon('chevronRight', 15)}</a>
      </div>`,
    }, `
      <div class="gantt-toolbar">
        <div class="chip-row">${zoomChips}</div>
        <form class="gantt-filters" method="get" action="${ctx.base}/timeline">
          <input type="hidden" name="from" value="${U.h(win.from)}">
          <input type="hidden" name="zoom" value="${U.h(win.zoom)}">
          <label class="filter-field"><span>Entitas</span><select name="company" data-autosubmit>${companyOptions}</select></label>
          <label class="filter-field"><span>Status</span><select name="status" data-autosubmit>${statusOptions}</select></label>
          <label class="filter-field"><span>Tampilkan</span><select name="source" data-autosubmit>${sourceOptions}</select></label>
          <noscript><button class="btn btn-ghost btn-sm" type="submit">Terapkan</button></noscript>
        </form>
      </div>

      ${rows.length ? `
      <div class="gantt" data-gantt data-days="${win.days}" data-from="${U.h(win.from)}"
        style="--gantt-days:${win.days}"
        data-move-task="${ctx.base}/timeline/task/__ID__/dates"
        data-move-raci="${ctx.base}/timeline/raci/__ID__/dates"
        data-csrf="${U.h(ctx.csrf)}" data-can-write="${canWrite ? '1' : '0'}">
        <div class="gantt-axis" aria-hidden="true">
          <span class="gantt-axis-label">Tugas</span>
          <div class="gantt-days" style="--gantt-days:${win.days}">${dayCells(win)}</div>
        </div>
        ${rows.map((r) => row(ctx, r, win, data)).join('')}
      </div>
      <p class="hint-text gantt-help">${canWrite
        ? 'Geser bar untuk memindahkan tanggal, tarik ujung kanan untuk mengubah durasi. Perubahan langsung tersimpan.'
        : 'Hanya peran dengan hak tulis performa yang dapat mengubah tanggal.'}</p>` : L.empty('Tidak ada pekerjaan pada periode & filter ini')}

      ${undated.length ? `<div class="gantt-undated">
        <b>${L.icon('alert', 14)} ${U.num(undated.length)} aktivitas RACI belum punya tanggal</b>
        <p class="hint-text">Lengkapi tanggalnya dari <a href="${ctx.base}/performance/raci">halaman RACI</a> agar muncul di timeline.</p>
      </div>` : ''}`)}

    ${canWrite ? L.card({ title: 'Tambah tugas proyek', subtitle: 'Tugas baru langsung muncul di timeline' }, `
      <form method="post" action="${ctx.base}/timeline/task" class="stack-form">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama tugas</span><input name="title" required maxlength="160" placeholder="mis. Peluncuran menu manual brew"></label>
          <label class="field"><span>Entitas</span>
            <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.selectedCompanyId === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>PIC</span>
            <select name="owner_id"><option value="">— belum ditentukan —</option>
              ${owners.map((u) => `<option value="${u.id}">${U.h(u.name)} · ${U.h(u.job_title || u.role)}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>Mulai</span><input type="date" name="start_date" value="${U.h(U.todayISO())}" required></label>
          <label class="field"><span>Selesai</span><input type="date" name="end_date" value="${U.h(T.addDays(U.todayISO(), 6))}" required></label>
          <label class="field"><span>Status</span>
            <select name="status">${Object.entries(T.STATUS).map(([k, v]) => `<option value="${k}">${U.h(v)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Progres (%)</span><input type="number" name="progress" min="0" max="100" step="5" value="0"></label>
          <label class="field"><span>Kelompok / fase</span><input name="track" maxlength="60" placeholder="mis. Peluncuran Q4"></label>
        </div>
        <label class="field"><span>Deskripsi</span><textarea name="description" rows="2" placeholder="Ruang lingkup singkat, hasil yang diharapkan"></textarea></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan tugas</button></div>
      </form>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'Timeline Proyek',
    subtitle: 'Gantt chart tugas tim & aktivitas RACI — geser untuk mengubah tanggal',
    active: '/timeline',
    content: body,
    toolbar: `<a class="btn btn-ghost btn-sm" href="${ctx.link('/performance/raci')}">${L.icon('users', 15)} RACI</a>
      <a class="btn btn-ghost btn-sm" href="${ctx.link('/performance/kpi')}">${L.icon('gauge', 15)} KPI</a>`,
  });
}

module.exports = { timelinePage };
