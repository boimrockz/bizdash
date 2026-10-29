'use strict';

const U = require('../lib/util');
const L = require('./layout');
const C = require('./charts');
const { can, ROLE_LABELS } = require('../lib/auth');
const { RACI_STATUS } = require('../lib/queries');

const PERSPECTIVES = [
  ['financial', 'Financial', 'Kinerja keuangan & profitabilitas'],
  ['customer', 'Customer', 'Kepuasan & loyalitas pelanggan'],
  ['process', 'Internal Process', 'Efisiensi dan kualitas operasional'],
  ['growth', 'Learning & Growth', 'Kapabilitas & budaya tim'],
];

const UNIT_LABEL = { currency: 'Rupiah (Rp)', number: 'Angka', percent: 'Persen (%)', ratio: 'Rasio (x)' };
const METRIC_LABEL = {
  manual: 'Input manual',
  revenue: 'Otomatis: pendapatan',
  net_profit: 'Otomatis: laba bersih',
  gross_profit: 'Otomatis: laba kotor',
  margin: 'Otomatis: margin bersih',
  gross_margin: 'Otomatis: margin kotor',
  expense_ratio: 'Otomatis: rasio beban',
  transactions: 'Otomatis: jumlah transaksi',
  avg_ticket: 'Otomatis: rata-rata transaksi',
  hpp_ratio: 'Otomatis: HPP / pendapatan (food cost)',
  b2b_share: 'Otomatis: porsi pendapatan B2B',
  member_share: 'Otomatis: porsi transaksi member',
  labor_cost_ratio: 'Otomatis: biaya tenaga kerja / pendapatan',
};

function userOptions(users, selected) {
  return users.map((u) => `<option value="${u.id}" ${Number(selected) === u.id ? 'selected' : ''}>${U.h(u.name)} · ${U.h(ROLE_LABELS[u.role] || u.role)}</option>`).join('');
}

function companyOptions(ctx, selected) {
  return ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${Number(selected) === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('');
}

function statusBadge(row) {
  const tone = row.status.tone === 'good' ? 'good' : row.status.tone === 'warn' ? 'warn' : row.status.tone === 'bad' ? 'bad' : 'muted';
  return L.badge(row.status.label, tone);
}

// ---------------- Balanced Scorecard ----------------
function bscPage(ctx, data) {
  const { bsc, kpis, objectives, users } = data;
  const canWrite = can(ctx.user, 'perf_write');

  const perspBlocks = bsc.perspectives.map((p) => {
    const meta = PERSPECTIVES.find((x) => x[0] === p.key);
    const objs = objectives.filter((o) => o.perspective === p.key);
    const objItems = objs.map((o) => {
      const linked = kpis.filter((k) => k.objective_id === o.id);
      const score = p.objectives.find((x) => x.id === o.id) ? p.objectives.find((x) => x.id === o.id).score : 0;
      return `<div class="list-item">
        ${C.scoreRing(score)}
        <div class="list-main">
          <div class="list-title">${U.h(o.title)}</div>
          <div class="list-sub">Bobot ${U.num(o.weight, 0)}% · PIC ${U.h(o.owner_name || '—')} · ${linked.length} KPI</div>
          <div class="chip-row" style="margin-top:6px">${linked.map((k) => L.badge(`${k.name} · ${U.pct(k.score, 0)}`, k.hasActual ? (k.score >= 85 ? 'good' : k.score >= 70 ? 'warn' : 'bad') : 'muted')).join('') || '<span class="hint-text">Belum ada KPI terhubung</span>'}</div>
        </div>
        ${canWrite ? `<form method="post" action="${ctx.base}/performance/bsc/objectives/${o.id}/delete" data-confirm="Hapus objective ini? KPI terkait tidak dihapus.">
          ${ctx.csrfField}${ctx.backField}<button class="btn btn-ghost btn-sm" type="submit">Hapus</button></form>` : ''}
      </div>`;
    }).join('');

    return `<section class="card">
      <header class="card-head">
        <div><h2>${U.h(meta[1])}</h2><p class="card-sub">${U.h(meta[2])}</p></div>
        <div style="text-align:right">
          <div class="persp-score" style="color:${p.score >= 85 ? 'var(--good)' : p.score >= 70 ? 'var(--warn)' : 'var(--bad)'}">${U.pct(p.score, 0)}</div>
          <div class="persp-meta">${p.kpiCount} KPI</div>
        </div>
      </header>
      <div class="card-body">
        ${L.pbar(p.score, L.scoreTone(p.score), 8)}
        <div class="list" style="margin-top:10px">${objItems || L.empty('Belum ada objective', 'Tambahkan objective untuk perspektif ini.')}</div>
        ${canWrite ? `<details class="disclosure" style="margin-top:12px">
          <summary>${L.icon('plus', 15)} Tambah objective</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/performance/bsc/objectives">
              ${ctx.csrfField}${ctx.backField}
              <input type="hidden" name="perspective" value="${p.key}">
              <div class="form-grid">
                <label class="field field-full"><span>Judul objective</span><input name="title" required placeholder="mis. Meningkatkan margin unit 3%"></label>
                <label class="field"><span>Entitas</span><select name="company_id">${companyOptions(ctx, ctx.selectedCompanyId)}</select></label>
                <label class="field"><span>Bobot (%)</span><input name="weight" type="number" min="1" max="100" value="25" required></label>
                <label class="field"><span>PIC</span><select name="owner_id">${userOptions(users)}</select></label>
                <label class="field field-full"><span>Deskripsi</span><textarea name="description" placeholder="Penjelasan singkat objective"></textarea></label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan objective</button></div>
            </form>
          </div>
        </details>` : ''}
      </div>
    </section>`;
  }).join('');

  const body = `
    <div class="grid grid-2" style="align-items:stretch">
      <article class="stat" style="flex-direction:row;align-items:center;gap:20px">
        ${C.scoreRing(bsc.overall)}
        <div>
          <div class="stat-label">Skor Balanced Scorecard</div>
          <div class="stat-value">${U.pct(bsc.overall, 1)}</div>
          <div class="stat-sub">Rata-rata tertimbang 4 perspektif · ${kpis.filter((k) => k.hasActual).length}/${kpis.length} KPI terukur</div>
        </div>
      </article>
      <article class="stat">
        <div class="stat-top"><span class="stat-label">Sebaran pencapaian KPI</span></div>
        <div class="grid grid-4" style="gap:8px">
          ${[
            ['Tercapai', kpis.filter((k) => k.hasActual && k.score >= 100).length, 'good'],
            ['On track', kpis.filter((k) => k.hasActual && k.score >= 85 && k.score < 100).length, 'indigo'],
            ['Perlu perhatian', kpis.filter((k) => k.hasActual && k.score >= 70 && k.score < 85).length, 'warn'],
            ['Berisiko', kpis.filter((k) => k.hasActual && k.score < 70).length, 'bad'],
          ].map(([label, n, tone]) => `<div style="display:flex;flex-direction:column;gap:3px">
            <span class="persp-meta">${U.h(label)}</span>
            <strong style="font-size:18px">${n}</strong>
            ${L.pbar(kpis.filter((k) => k.hasActual).length ? (n / kpis.filter((k) => k.hasActual).length) * 100 : 0, tone, 6)}
          </div>`).join('')}
        </div>
      </article>
    </div>
    <div class="grid grid-2">${perspBlocks}</div>
  `;

  return L.shell(ctx, {
    title: 'Balanced Scorecard',
    subtitle: `${ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi grup'} · ${U.monthLabel(ctx.month)}`,
    active: '/performance/bsc',
    content: body,
  });
}

// ---------------- KPI ----------------
function kpiPage(ctx, data) {
  const { kpis, objectives, users } = data;
  const canWrite = can(ctx.user, 'perf_write');
  const groups = PERSPECTIVES.map(([key, label]) => ({
    key, label, rows: kpis.filter((k) => k.perspective === key),
  }));

  const kpiTable = (rows) => `<div class="table-wrap"><table class="data">
    <thead><tr><th>KPI</th><th>PIC</th><th class="num">Aktual</th><th class="num">Target</th><th class="num">Skor</th><th>Status</th><th>Sumber</th><th></th></tr></thead>
    <tbody>${rows.map((k) => `<tr>
      <td><span class="strong">${U.h(k.name)}</span><span class="sub-cell">${U.h(k.company_name)} · bobot ${U.num(k.weight, 0)}%</span></td>
      <td>${U.h(k.owner_name || '—')}</td>
      <td class="num strong">${k.hasActual ? U.formatValue(k.actual, k.unit) : '—'}</td>
      <td class="num">${U.formatValue(k.target_value, k.unit)}</td>
      <td class="num">${k.hasActual ? U.pct(k.score, 0) : '—'}</td>
      <td>${statusBadge(k)}</td>
      <td>${L.badge(k.isAuto ? 'Otomatis' : 'Manual', k.isAuto ? 'indigo' : 'muted')}</td>
      <td class="num">
        ${!k.isAuto && canWrite ? `<form method="post" action="${ctx.base}/performance/kpi/${k.id}/value" style="display:flex;gap:6px;justify-content:flex-end;margin-bottom:4px">
          ${ctx.csrfField}${ctx.backField}
          <input name="value" type="number" step="any" value="${k.actual === null ? '' : k.actual}" placeholder="aktual" style="width:96px;padding:5px 8px;border-radius:8px;border:1px solid var(--line-strong);font:inherit;font-size:12px">
          <button class="btn btn-ghost btn-sm" type="submit">Simpan</button>
        </form>` : ''}
        ${canWrite ? `<details class="disclosure" style="border:none;background:transparent">
          <summary style="padding:0;font-size:11.5px;font-weight:600;color:var(--indigo);justify-content:flex-end">Ubah</summary>
          <div class="disc-body" style="padding:10px 0">
            <form method="post" action="${ctx.base}/performance/kpi/${k.id}/update" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:340px;text-align:left">
              ${ctx.csrfField}${ctx.backField}
              <label class="field field-full"><span>Nama KPI</span><input name="name" value="${U.h(k.name)}" required></label>
              <label class="field"><span>Target</span><input name="target_value" type="number" step="any" value="${k.target_value}"></label>
              <label class="field"><span>Bobot (%)</span><input name="weight" type="number" min="1" max="100" value="${k.weight}"></label>
              <label class="field"><span>Satuan</span><select name="unit">${Object.entries(UNIT_LABEL).map(([v, l]) => `<option value="${v}" ${k.unit === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="field"><span>Arah</span><select name="polarity"><option value="higher" ${k.polarity === 'higher' ? 'selected' : ''}>Tinggi lebih baik</option><option value="lower" ${k.polarity === 'lower' ? 'selected' : ''}>Rendah lebih baik</option></select></label>
              <label class="field"><span>Perspektif</span><select name="perspective">${PERSPECTIVES.map(([v, l]) => `<option value="${v}" ${k.perspective === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="field"><span>PIC</span><select name="owner_id">${userOptions(users, k.owner_id)}</select></label>
              <label class="field field-full"><span>Objective</span>
                <select name="objective_id"><option value="">— tanpa objective —</option>
                  ${objectives.filter((o) => o.perspective === k.perspective || o.id === k.objective_id).map((o) => `<option value="${o.id}" ${k.objective_id === o.id ? 'selected' : ''}>${U.h(o.title)}</option>`).join('')}
                </select>
              </label>
              <div class="field field-full" style="flex-direction:row;gap:8px"><button class="btn btn-primary btn-sm" type="submit">Simpan perubahan</button></div>
            </form>
            <form method="post" action="${ctx.base}/performance/kpi/${k.id}/delete" data-confirm="Hapus KPI ${U.h(k.name)}?" style="margin-top:8px">
              ${ctx.csrfField}${ctx.backField}<button class="btn btn-danger btn-sm" type="submit">Hapus KPI</button></form>
          </div>
        </details>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="8">${L.empty('Belum ada KPI pada perspektif ini')}</td></tr>`}</tbody>
  </table></div>`;

  const body = `
    <div class="grid grid-4">
      ${[
        ['KPI terukur', `${kpis.filter((k) => k.hasActual).length}/${kpis.length}`, 'indikator aktif'],
        ['Rata-rata skor', U.pct(kpis.filter((k) => k.hasActual).reduce((a, k) => a + k.score, 0) / Math.max(1, kpis.filter((k) => k.hasActual).length), 0), 'tertimbang per KPI'],
        ['Berisiko', String(kpis.filter((k) => k.hasActual && k.score < 70).length), 'skor di bawah 70%'],
        ['Otomatis dari POS', String(kpis.filter((k) => k.isAuto).length), 'terhitung real-time'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${groups.map((g) => L.card({ title: g.label, subtitle: `${g.rows.length} KPI · periode ${U.monthLabel(ctx.month)}` }, kpiTable(g.rows))).join('')}

    ${canWrite ? L.card({ title: 'Tambah KPI', subtitle: 'KPI otomatis mengambil angka langsung dari data POS & keuangan' }, `
      <form method="post" action="${ctx.base}/performance/kpi">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Nama KPI</span><input name="name" required placeholder="mis. Margin kotor outlet"></label>
          <label class="field"><span>Entitas</span><select name="company_id">${companyOptions(ctx, ctx.selectedCompanyId)}</select></label>
          <label class="field"><span>Perspektif</span>
            <select name="perspective">${PERSPECTIVES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Objective terkait</span>
            <select name="objective_id"><option value="">— tanpa objective —</option>
              ${objectives.map((o) => `<option value="${o.id}">${U.h(o.title)}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>Sumber data</span>
            <select name="metric">${Object.entries(METRIC_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Satuan</span>
            <select name="unit">${Object.entries(UNIT_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Target</span><input name="target_value" type="number" step="any" required value="0"></label>
          <label class="field"><span>Arah pencapaian</span>
            <select name="polarity"><option value="higher">Semakin tinggi semakin baik</option><option value="lower">Semakin rendah semakin baik</option></select>
          </label>
          <label class="field"><span>Bobot (%)</span><input name="weight" type="number" min="1" max="100" value="10"></label>
          <label class="field"><span>PIC</span><select name="owner_id">${userOptions(users)}</select></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan KPI</button></div>
      </form>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'KPI',
    subtitle: `Indikator kinerja utama · ${U.monthLabel(ctx.month)}`,
    active: '/performance/kpi',
    content: body,
  });
}

// ---------------- OKR ----------------
function okrPage(ctx, data) {
  const { okrs, users } = data;
  const canWrite = can(ctx.user, 'perf_write');
  const quarter = U.quarterOf(ctx.month);

  const cards = okrs.map((o) => {
    const tone = o.status === 'off_track' ? 'Off track' : o.status === 'at_risk' ? 'Berisiko' : o.status === 'done' ? 'Selesai' : 'On track';
    const toneClass = o.status === 'off_track' ? 'bad' : o.status === 'at_risk' ? 'warn' : 'good';
    const krRows = o.krs.map((kr) => `<div class="kr" style="margin-top:8px">
      <span class="kr-name">${U.h(kr.title)}</span>
      <span class="kr-val">${U.formatCompact(kr.current_value, kr.unit)} / ${U.formatCompact(kr.target_value, kr.unit)}</span>
      ${L.pbar(kr.progress.pct, kr.progress.pct >= 70 ? 'good' : kr.progress.pct >= 40 ? 'indigo' : 'warn', 6)}
      ${canWrite ? `<form method="post" action="${ctx.base}/performance/okr/kr/${kr.id}/value" style="display:flex;gap:6px;grid-column:1/-1;justify-content:flex-end">
        ${ctx.csrfField}${ctx.backField}
        <input name="current_value" type="number" step="any" value="${kr.current_value}" style="width:100px;padding:4px 8px;border-radius:8px;border:1px solid var(--line-strong);font:inherit;font-size:11.5px">
        <button class="btn btn-ghost btn-sm" type="submit">Update</button>
      </form>` : ''}
    </div>`).join('');

    return `<section class="card">
      <header class="card-head">
        <div><h2>${U.h(o.title)}</h2><p class="card-sub">${U.h(o.company_name)} · ${U.h(o.owner_name || '—')}</p></div>
        ${L.badge(tone, toneClass)}
      </header>
      <div class="card-body">
        <div class="meter-row" style="margin-bottom:4px"><span class="meter-label">Progres keseluruhan</span><span class="meter-value">${U.pct(o.progress, 0)}</span></div>
        ${L.pbar(o.progress, 'indigo', 10)}
        <div style="margin-top:12px">${krRows || `<p class="hint-text">Belum ada key result.</p>`}</div>
        ${canWrite ? `<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <form method="post" action="${ctx.base}/performance/okr/${o.id}/status" style="display:flex;gap:6px;align-items:center">
            ${ctx.csrfField}${ctx.backField}
            <select name="status" style="padding:6px 9px;border-radius:9px;border:1px solid var(--line-strong);font:inherit;font-size:12px">
              ${[['on_track', 'On track'], ['at_risk', 'Berisiko'], ['off_track', 'Off track'], ['done', 'Selesai']].map(([v, l]) => `<option value="${v}" ${o.status === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" type="submit">Set status</button>
          </form>
          <form method="post" action="${ctx.base}/performance/okr/${o.id}/delete" data-confirm="Hapus OKR ini beserta key result-nya?">
            ${ctx.csrfField}${ctx.backField}<button class="btn btn-ghost btn-sm" type="submit">Hapus OKR</button>
          </form>
        </div>
        <details class="disclosure" style="margin-top:12px">
          <summary>${L.icon('plus', 15)} Tambah key result</summary>
          <div class="disc-body">
            <form method="post" action="${ctx.base}/performance/okr/${o.id}/kr">
              ${ctx.csrfField}${ctx.backField}
              <div class="form-grid">
                <label class="field field-full"><span>Key result</span><input name="title" required placeholder="mis. Pendapatan Q4 mencapai Rp 2,9 M"></label>
                <label class="field"><span>Satuan</span><select name="unit">${Object.entries(UNIT_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
                <label class="field"><span>Bobot</span><input name="weight" type="number" min="1" value="1"></label>
                <label class="field"><span>Nilai awal</span><input name="start_value" type="number" step="any" value="0"></label>
                <label class="field"><span>Target</span><input name="target_value" type="number" step="any" value="0" required></label>
                <label class="field"><span>Nilai saat ini</span><input name="current_value" type="number" step="any" value="0"></label>
              </div>
              <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan key result</button></div>
            </form>
          </div>
        </details>` : ''}
      </div>
    </section>`;
  }).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Objective aktif', String(okrs.length), U.quarterLabel(quarter)],
        ['Rata-rata progres', U.pct(okrs.length ? okrs.reduce((a, o) => a + o.progress, 0) / okrs.length : 0, 0), 'bobot key result'],
        ['On track', String(okrs.filter((o) => o.status === 'on_track' || o.status === 'done').length), 'objective'],
        ['Berisiko', String(okrs.filter((o) => o.status === 'at_risk' || o.status === 'off_track').length), 'butuh intervensi'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    <div class="grid grid-2">${cards || L.card({}, L.empty('Belum ada OKR pada kuartal ini', 'Tambahkan objective kuartalan di bawah.'))}</div>

    ${canWrite ? L.card({ title: 'Tambah objective (OKR)', subtitle: `Periode ${U.quarterLabel(quarter)}` }, `
      <form method="post" action="${ctx.base}/performance/okr">
        ${ctx.csrfField}${ctx.backField}
        <input type="hidden" name="period" value="${quarter}">
        <div class="form-grid">
          <label class="field field-full"><span>Objective</span><input name="title" required placeholder="mis. Menjadi pilihan utama pelanggan retail premium"></label>
          <label class="field"><span>Entitas</span><select name="company_id">${companyOptions(ctx, ctx.selectedCompanyId)}</select></label>
          <label class="field"><span>PIC</span><select name="owner_id">${userOptions(users)}</select></label>
          <label class="field field-full"><span>Deskripsi</span><textarea name="description" placeholder="Konteks dan alasan objective ini penting"></textarea></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan objective</button></div>
      </form>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'OKR',
    subtitle: `${U.quarterLabel(quarter)} · ${ctx.scopeCompany ? ctx.scopeCompany.name : 'konsolidasi grup'}`,
    active: '/performance/okr',
    content: body,
  });
}

// ---------------- RACI ----------------
function raciPage(ctx, data) {
  const { raci, users } = data;
  const canWrite = can(ctx.user, 'perf_write');
  const userById = new Map(users.map((u) => [u.id, u]));
  const today = U.todayISO();
  const initialsOf = (ids) => (ids || '').split(',').map((x) => Number(x)).filter(Boolean)
    .map((id) => {
      const u = userById.get(id);
      return u ? `<span class="raci-person"><span class="mini-avatar">${U.h(U.initials(u.name))}</span>${U.h(u.name.split(' ')[0])}</span>` : '';
    }).join('');

  const rows = raci.map((r) => {
    const overdue = r.status !== 'done' && r.due_date && r.due_date < today;
    return `<tr>
      <td><span class="strong">${U.h(r.activity)}</span><span class="sub-cell">${U.h(r.description || '')} · ${U.h(r.company_name)}</span></td>
      <td><span class="raci-person"><span class="mini-avatar">${U.h(U.initials(r.responsible_name || '?'))}</span>${U.h(r.responsible_name || '—')}</span></td>
      <td><span class="raci-person"><span class="mini-avatar" style="background:var(--good-gradient)">${U.h(U.initials(r.accountable_name || '?'))}</span>${U.h(r.accountable_name || '—')}</span></td>
      <td><div class="chip-row">${initialsOf(r.consulted_ids) || '<span class="hint-text">—</span>'}</div></td>
      <td><div class="chip-row">${initialsOf(r.informed_ids) || '<span class="hint-text">—</span>'}</div></td>
      <td>${L.badge(RACI_STATUS[r.status] || r.status, r.status === 'done' ? 'good' : r.status === 'blocked' ? 'bad' : r.status === 'in_progress' ? 'indigo' : 'muted')}</td>
      <td style="min-width:120px">
        <div class="meter-row"><span class="meter-label" style="font-size:11px">${U.pct(r.progress, 0)}</span></div>
        ${L.pbar(r.progress, r.status === 'blocked' ? 'bad' : r.progress >= 100 ? 'good' : 'indigo', 6)}
      </td>
      <td class="num ${overdue ? '' : 'muted'}">${U.h(r.due_date || '—')}${overdue ? '<span class="sub-cell" style="color:var(--bad)">terlambat</span>' : ''}</td>
      <td class="num">
        ${canWrite ? `<form method="post" action="${ctx.base}/performance/raci/${r.id}/update" style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap">
          ${ctx.csrfField}${ctx.backField}
          <select name="status" style="padding:4px 7px;border-radius:8px;border:1px solid var(--line-strong);font:inherit;font-size:11.5px">
            ${Object.entries(RACI_STATUS).map(([v, l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <input name="progress" type="number" min="0" max="100" step="5" value="${r.progress}" style="width:66px;padding:4px 7px;border-radius:8px;border:1px solid var(--line-strong);font:inherit;font-size:11.5px">
          <button class="btn btn-ghost btn-sm" type="submit">Update</button>
        </form>
        <form method="post" action="${ctx.base}/performance/raci/${r.id}/delete" data-confirm="Hapus aktivitas ${U.h(r.activity)}?" style="margin-top:4px">
          ${ctx.csrfField}${ctx.backField}<button class="btn btn-ghost btn-sm" type="submit">Hapus</button>
        </form>` : ''}
      </td>
    </tr>`;
  }).join('');

  const body = `
    <div class="grid grid-4">
      ${[
        ['Total aktivitas', String(raci.length), 'dalam cakupan'],
        ['Berjalan', String(raci.filter((r) => r.status === 'in_progress').length), 'sedang dikerjakan'],
        ['Terhambat', String(raci.filter((r) => r.status === 'blocked').length), 'butuh eskalasi'],
        ['Terlambat', String(raci.filter((r) => r.status !== 'done' && r.due_date && r.due_date < today).length), 'melewati tenggat'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Matriks RACI', subtitle: 'R = Responsible · A = Accountable · C = Consulted · I = Informed' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Aktivitas</th><th>R</th><th>A</th><th>C</th><th>I</th><th>Status</th><th>Progres</th><th class="num">Tenggat</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9">${L.empty('Belum ada aktivitas RACI')}</td></tr>`}</tbody>
      </table></div>`)}

    ${canWrite ? L.card({ title: 'Tambah aktivitas RACI', subtitle: 'Tentukan penanggung jawab dan pihak yang perlu dilibatkan' }, `
      <form method="post" action="${ctx.base}/performance/raci">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Aktivitas</span><input name="activity" required placeholder="mis. Peluncuran campaign Q4"></label>
          <label class="field"><span>Entitas</span><select name="company_id">${companyOptions(ctx, ctx.selectedCompanyId)}</select></label>
          <label class="field"><span>Tenggat</span><input name="due_date" type="date" value="${U.todayISO()}"></label>
          <label class="field"><span>Responsible (R)</span><select name="responsible_id">${userOptions(users)}</select></label>
          <label class="field"><span>Accountable (A)</span><select name="accountable_id">${userOptions(users)}</select></label>
          <label class="field"><span>Consulted (C)</span>
            <select name="consulted_ids" multiple size="3" style="height:auto">${userOptions(users)}</select>
          </label>
          <label class="field"><span>Informed (I)</span>
            <select name="informed_ids" multiple size="3" style="height:auto">${userOptions(users)}</select>
          </label>
          <label class="field"><span>Status awal</span>
            <select name="status">${Object.entries(RACI_STATUS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Progres (%)</span><input name="progress" type="number" min="0" max="100" value="0"></label>
          <label class="field field-full"><span>Deskripsi</span><input name="description" placeholder="Lingkup pekerjaan singkat"></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan aktivitas</button></div>
      </form>`) : ''}
  `;

  return L.shell(ctx, {
    title: 'RACI',
    subtitle: 'Pembagian peran & akuntabilitas lintas fungsi',
    active: '/performance/raci',
    content: body,
  });
}

module.exports = { bscPage, kpiPage, okrPage, raciPage, PERSPECTIVES, UNIT_LABEL, METRIC_LABEL };
