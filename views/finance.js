'use strict';

const U = require('../lib/util');
const L = require('./layout');
const C = require('./charts');
const { can } = require('../lib/auth');
const { TYPE_LABEL } = require('../lib/statements');

function financePage(ctx, data) {
  const { fin, series, expenseRows, txs, targets, perCompany, target, channel, promo, labor, laborRows, cash, projection, st } = data;
  const canWrite = can(ctx.user, 'finance_write');
  const pctOfRev = (v) => (fin.revenue ? U.pct((v / fin.revenue) * 100) : '—');

  const stats = [
    ['Pendapatan', fin.revenue, `target ${U.idrShort(target)}`, target ? (fin.revenue / target) * 100 : null],
    ['HPP', -fin.cogs, pctOfRev(fin.cogs) + ' dari pendapatan', null],
    ['Laba kotor', fin.gross, 'margin ' + U.pct(fin.grossMargin), null],
    ['Beban operasional', -fin.expenses, pctOfRev(fin.expenses) + ' dari pendapatan', null],
    ['Laba bersih', fin.net, 'margin ' + U.pct(fin.margin), null],
  ];

  const pnlRows = [
    ['Pendapatan penjualan (neto setelah promo)', fin.revenue, ''],
    ['Harga pokok penjualan (resep & biji)', -fin.cogs, 'muted'],
    ['Laba kotor', fin.gross, 'total'],
    ['Beban operasional', -fin.expenses, 'muted'],
    ['Pendapatan lain-lain', fin.income, 'muted'],
    ['Laba bersih', fin.net, 'total'],
  ].map(([label, val, kind]) => `<tr class="${kind === 'total' ? 'is-total' : ''}">
      <td class="${kind === 'muted' ? 'muted' : ''}">${U.h(label)}</td>
      <td class="num" style="${val < 0 ? 'color:var(--ink-soft)' : ''}">${val < 0 ? '(' + U.idr(Math.abs(val)) + ')' : U.idr(val)}</td>
      <td class="num muted">${fin.revenue ? U.pct((Math.abs(val) / fin.revenue) * 100, 1) : '—'}</td>
    </tr>`).join('');

  const expenseTotal = expenseRows.reduce((a, r) => a + r.amount, 0);
  const expenseTable = expenseRows.map((r) => `<tr>
    <td>${U.h(r.category)}</td>
    <td class="num">${U.idr(r.amount)}</td>
    <td class="num muted">${expenseTotal ? U.pct((r.amount / expenseTotal) * 100) : '—'}</td>
    <td style="width:120px">${L.pbar(expenseTotal ? (r.amount / expenseTotal) * 100 : 0, 'indigo', 6)}</td>
  </tr>`).join('');

  const txRows = txs.map((t) => `<tr>
    <td>${U.h(t.occurred_at)}</td>
    <td>${t.type === 'expense' ? L.badge('Beban', 'warn') : L.badge('Pendapatan', 'good')}</td>
    <td>${U.h(t.category || '—')}<span class="sub-cell">${U.h(t.description || '')} · ${U.h(t.company)}</span></td>
    <td class="num strong" style="color:${t.type === 'expense' ? 'var(--ink)' : 'var(--good)'}">${t.type === 'expense' ? '(' + U.idr(t.amount) + ')' : U.idr(t.amount)}</td>
    <td class="num">${canWrite ? `<form method="post" action="${ctx.base}/finance/transactions/${t.id}/delete" data-confirm="Hapus transaksi ini?">
      ${ctx.csrfField}${ctx.backField}
      <button class="btn btn-danger btn-sm" type="submit">Hapus</button></form>` : ''}</td>
  </tr>`).join('');

  const targetRows = perCompany.map((row) => {
    const comp = ctx.byId.get(row.company_id);
    const tgt = targets.get(row.company_id) || { revenue_target: 0, profit_target: 0 };
    const ach = tgt.revenue_target ? (row.revenue / tgt.revenue_target) * 100 : null;
    return `<tr>
      <td>${U.h(comp ? comp.name : '—')}</td>
      <td class="num">${U.idrShort(row.revenue)}</td>
      <td class="num">${tgt.revenue_target ? U.idrShort(tgt.revenue_target) : '—'}</td>
      <td class="num">${ach === null ? '—' : L.badge(U.pct(ach, 0), ach >= 100 ? 'good' : ach >= 85 ? 'indigo' : ach >= 70 ? 'warn' : 'bad')}</td>
      <td class="num">
        ${canWrite ? `<form method="post" action="${ctx.base}/finance/targets" style="display:flex;gap:6px;justify-content:flex-end">
          ${ctx.csrfField}${ctx.backField}
          <input type="hidden" name="company_id" value="${row.company_id}">
          <input type="hidden" name="period" value="${ctx.month}">
          <input name="revenue_target" type="number" min="0" step="1000000" value="${tgt.revenue_target}" style="width:130px;padding:5px 8px;border-radius:8px;border:1px solid var(--line-strong);font:inherit;font-size:12px;text-align:right">
          <button class="btn btn-ghost btn-sm" type="submit">Set</button>
        </form>` : U.idrShort(tgt.revenue_target)}
      </td>
    </tr>`;
  }).join('');

  const proj1 = projection && projection.months.length ? projection.months[0] : null;
  const cashCards = [
    ['Pemasukan bulan ini', U.idr(cash.inflow), `penjualan ${U.idrShort(cash.revenue)} · langganan ${U.idrShort(cash.subscription)} · lain ${U.idrShort(cash.income)}`, 'var(--good)', 'trendUp'],
    ['Pengeluaran bulan ini', U.idr(cash.outflow), `HPP ${U.idrShort(cash.cogs)} · beban ${U.idrShort(cash.expenses)}`, 'var(--bad)', 'trendDown'],
    ['Arus kas bersih', U.idr(cash.net), cash.net >= 0 ? 'positif — kas bertambah' : 'negatif — kas berkurang', cash.net >= 0 ? 'var(--good)' : 'var(--bad)', 'wallet'],
    ['Proyeksi bulan depan', proj1 ? U.idrShort(proj1.net) : '—', proj1 ? `rentang ${U.idrShort(proj1.low)} – ${U.idrShort(proj1.high)}` : 'belum cukup data', 'var(--brand)', 'target'],
  ];

  const projectionRows = projection && projection.months.length ? projection.months.map((m) => `<tr>
    <td><span class="strong">${U.h(U.monthLabel(m.month))}</span><span class="sub-cell">proyeksi</span></td>
    <td class="num">${U.idr(m.inflow)}</td>
    <td class="num">${U.idr(m.outflow)}</td>
    <td class="num strong" style="color:${m.net >= 0 ? 'var(--good)' : 'var(--bad)'}">${U.idr(m.net)}</td>
    <td class="num muted">${U.idrShort(m.low)} – ${U.idrShort(m.high)}</td>
  </tr>`).join('') : '';

  const overviewBody = `
    <div class="grid grid-4">
      ${cashCards.map(([label, value, sub, color, icon]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span><span class="stat-ico" style="color:${color}">${L.icon(icon, 17)}</span></div>
        <div class="stat-value" style="color:${color}">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Arus kas & proyeksi', subtitle: 'Batang penuh = realisasi, batang bergaris putus-putus = proyeksi 3 bulan (regresi tren 6 bulan)' }, `
      ${C.cashflowChart(series, projection)}
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--good-gradient)"></span>Pemasukan</span>
        <span class="legend-item"><span class="legend-dot" style="background:linear-gradient(135deg,var(--red-500),var(--red-500) 100%)"></span>Pengeluaran</span>
        <span class="legend-item"><span class="legend-dot net"></span>Arus kas bersih</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--brand-soft);border:1px solid var(--brand)"></span>Area proyeksi</span>
      </div>
      <div class="chip-row" style="margin-top:12px">
        ${L.badge('Tren pendapatan ' + (projection.trend.revenue >= 0 ? '+' : '') + U.pct(projection.trend.revenue), projection.trend.revenue >= 0 ? 'good' : 'bad')}
        ${L.badge('Tren beban ' + (projection.trend.expenses >= 0 ? '+' : '') + U.pct(projection.trend.expenses), projection.trend.expenses >= 0 ? 'warn' : 'good')}
        ${L.badge('Keyakinan model ' + U.pct(projection.confidence, 0), projection.confidence >= 60 ? 'indigo' : 'muted')}
      </div>`)}

    ${projectionRows ? L.card({ title: 'Rincian proyeksi 3 bulan', subtitle: 'Perkiraan arus kas dengan rentang ketidakpastian yang melebar tiap bulan' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Bulan</th><th class="num">Pemasukan</th><th class="num">Pengeluaran</th><th class="num">Arus kas bersih</th><th class="num">Rentang</th></tr></thead>
        <tbody>${projectionRows}</tbody>
      </table></div>
      <p class="hint-text" style="margin-top:10px">Metode: rata-rata berbobot 3 bulan terakhir dicampur tren regresi linear 6 bulan, dibatasi maksimal ±25% pergerakan per bulan agar proyeksi tidak melejit. Ini estimasi sederhana, bukan jaminan.</p>`) : ''}

    <div class="grid grid-4">
      ${stats.slice(0, 4).map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value" style="${value < 0 ? 'color:var(--ink)' : ''}">${value < 0 ? '(' + U.idrShort(Math.abs(value)) + ')' : U.idrShort(value)}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Tren 12 bulan', subtitle: 'Pendapatan vs beban operasional + laba bersih' }, `
      ${C.comboChart(series)}
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot rev"></span>Pendapatan</span>
        <span class="legend-item"><span class="legend-dot exp"></span>Beban</span>
        <span class="legend-item"><span class="legend-dot net"></span>Laba bersih</span>
      </div>`)}

    <div class="grid grid-side">
      ${L.card({ title: 'Laporan laba rugi', subtitle: U.monthLabel(ctx.month) }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Pos</th><th class="num">Nilai</th><th class="num">% Pendapatan</th></tr></thead>
          <tbody>${pnlRows}</tbody>
        </table></div>
        <div class="chip-row" style="margin-top:14px">
          ${L.badge('Margin kotor ' + U.pct(fin.grossMargin), 'indigo')}
          ${L.badge('Margin bersih ' + U.pct(fin.margin), fin.margin >= 10 ? 'good' : 'warn')}
          ${L.badge('Rasio beban ' + U.pct(fin.expenseRatio), 'muted')}
        </div>`)}

      ${L.card({ title: 'Beban per kategori', subtitle: U.monthLabel(ctx.month) }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">Porsi</th><th></th></tr></thead>
          <tbody>${expenseTable || `<tr><td colspan="4">${L.empty('Belum ada beban tercatat')}</td></tr>`}</tbody>
        </table></div>
        <div style="margin-top:14px">${C.expenseDonut(expenseRows, expenseTotal)}</div>`)}
    </div>

    ${labor && labor.people ? `<div class="grid grid-side">
      ${L.card({ title: 'Estimasi biaya tenaga kerja', subtitle: 'Jam kerja absensi × tarif per jam barista' }, `
        <div class="grid grid-3" style="gap:10px">
          ${[
            ['Jam kerja', U.num(labor.hours, 1) + ' jam', U.num(labor.people) + ' barista'],
            ['Estimasi biaya', U.idrShort(labor.cost), 'dari absensi'],
            ['% dari pendapatan', U.pct(fin.revenue ? (labor.cost / fin.revenue) * 100 : 0, 1), 'labor cost ratio'],
          ].map(([label, value, sub]) => `<div class="mini-stat">
            <span>${U.h(label)}</span><strong>${value}</strong><em>${U.h(sub)}</em>
          </div>`).join('')}
        </div>
        <div class="table-wrap" style="margin-top:14px"><table class="data">
          <thead><tr><th>Barista</th><th class="num">Jam</th><th class="num">Tarif/jam</th><th class="num">Est. biaya</th></tr></thead>
          <tbody>${laborRows.map((r) => `<tr>
            <td><span class="strong">${U.h(r.user_name)}</span><span class="sub-cell">${U.h(r.company_name)}</span></td>
            <td class="num">${U.num(r.hours, 1)}</td>
            <td class="num muted">${U.idrShort(r.hourly_rate || 0)}</td>
            <td class="num">${U.idrShort(r.cost)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <p class="hint-text" style="margin-top:10px">Gaji &amp; tunjangan yang sudah tercatat sebagai beban bulan ini: <b>${U.idr(labor.recorded)}</b>. Estimasi absensi mencakup ${U.num(labor.people)} barista yang memiliki jadwal shift.</p>`)}
      ${L.card({ title: 'Catatan penting biaya tenaga kerja', subtitle: 'Cara membaca angka di samping' }, `
        <ul class="labour-notes">
          <li>Estimasi dihitung dari <b>absensi aktual</b> (jam masuk–pulang dikurangi istirahat) × tarif per jam tiap barista.</li>
          <li>Tarif per jam diatur di menu <a href="${ctx.base}/admin">Perusahaan &amp; Pengguna</a>.</li>
          <li>Angka ini <b>tidak otomatis masuk laba rugi</b> agar tidak dobel dengan beban gaji yang sudah dicatat manual.</li>
          <li>Gunakan selisih estimasi vs gaji tercatat untuk melihat produktivitas dan potensi lembur berlebih.</li>
        </ul>`)}
    </div>` : ''}

    <div class="grid grid-side">
      ${L.card({ title: 'Pendapatan per kanal & outlet', subtitle: 'B2C, walk-in, dan B2B bulan ini' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Kanal</th><th class="num">Nota</th><th class="num">Pendapatan</th><th class="num">HPP</th><th class="num">Margin kotor</th></tr></thead>
          <tbody>${channel.map((c) => `<tr>
            <td class="strong">${U.h(c.channel === 'b2c' ? 'Member B2C' : c.channel === 'b2b' ? 'B2B (kafe & distributor)' : 'Walk-in')}</td>
            <td class="num">${U.num(c.n)}</td>
            <td class="num">${U.idrShort(c.revenue)}</td>
            <td class="num muted">${U.idrShort(c.cogs)}</td>
            <td class="num">${U.pct(c.revenue ? ((c.revenue - c.cogs) / c.revenue) * 100 : 0)}</td>
          </tr>`).join('') || `<tr><td colspan="5">${L.empty('Belum ada penjualan')}</td></tr>`}</tbody>
        </table></div>
        <div style="margin-top:14px">
          <p class="persp-meta" style="margin-bottom:6px">Diskon & promo bulan ini</p>
          <div class="table-wrap"><table class="data">
            <tbody>${promo.map((r) => `<tr><td>${U.h(r.label)}</td><td class="num">${U.num(r.n)} nota</td><td class="num" style="color:var(--bad)">− ${U.idr(r.discount)}</td></tr>`).join('') || `<tr><td class="muted">Tidak ada promo terpakai.</td></tr>`}</tbody>
          </table></div>
        </div>`)}

      ${L.card({ title: 'Target pendapatan per entitas', subtitle: 'Atur target bulanan sebagai dasar pencapaian' }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Entitas</th><th class="num">Realisasi</th><th class="num">Target</th><th class="num">Capaian</th><th></th></tr></thead>
          <tbody>${targetRows || `<tr><td colspan="5">${L.empty('Belum ada entitas outlet')}</td></tr>`}</tbody>
        </table></div>`)}

      ${canWrite ? L.card({ title: 'Catat beban / pendapatan lain', subtitle: 'Biaya operasional di luar transaksi POS' }, `
        <form method="post" action="${ctx.base}/finance/transactions">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Jenis</span>
              <select name="type"><option value="expense">Beban / pengeluaran</option><option value="income">Pendapatan lain</option></select>
            </label>
            <label class="field"><span>Kelompok arus kas</span>
              <select name="cash_group">
                <option value="operating">Operasional (penjualan, beban harian)</option>
                <option value="investing">Investasi (beli/jual aset tetap)</option>
                <option value="financing">Pendanaan (modal, utang, dividen)</option>
              </select>
            </label>
            <label class="field"><span>Kategori</span>
              <input name="category" list="fin-cats" placeholder="Sewa Tempat / Marketing / …" required>
              <datalist id="fin-cats">
                ${['Sewa Tempat', 'Gaji & Tunjangan Barista', 'Gaji Tim Produksi', 'Listrik, Air & Internet', 'Marketing & Promosi', 'Perlengkapan & Kebersihan', 'Perawatan Kebun & Panen', 'Sewa Roastery', 'IT & Software', 'Konsultan & Profesional', 'Pendapatan Lain'].map((c) => `<option value="${U.h(c)}">`).join('')}
              </datalist>
            </label>
            <label class="field"><span>Entitas</span>
              <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.scopeCompany && ctx.scopeCompany.id === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
            </label>
            <label class="field"><span>Jumlah (Rp)</span><input name="amount" type="number" min="0" step="1000" required></label>
            <label class="field"><span>Tanggal</span><input name="occurred_at" type="date" value="${U.todayISO()}" required></label>
            <label class="field"><span>Keterangan</span><input name="description" placeholder="mis. sewa outlet Oktober"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan transaksi</button></div>
        </form>`) : L.card({ title: 'Akses terbatas', subtitle: 'Role Anda hanya dapat melihat data keuangan' }, `<p class="hint-text">Perubahan data keuangan memerlukan role Finance, Manajer, atau Owner.</p>`)}
    </div>

    ${L.card({ title: 'Transaksi beban & pendapatan lain', subtitle: `${txs.length} transaksi pada ${U.monthLabel(ctx.month)}` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th class="num">Jumlah</th><th></th></tr></thead>
        <tbody>${txRows || `<tr><td colspan="5">${L.empty('Belum ada transaksi non-POS bulan ini')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  // ---------------- panel Laba Rugi ----------------
  const plLines = [];
  const pushLine = (label, value, kind = '') => plLines.push({ label, value, kind });
  pushLine('Pendapatan penjualan (neto setelah promo & poin)', st.pl.revenue);
  pushLine('Harga pokok penjualan (resep & biji)', -st.pl.cogs, 'muted');
  pushLine('Laba kotor', st.pl.gross, 'total');
  for (const row of st.pl.expenseRows) pushLine('Beban · ' + row.category, -row.amount, 'muted');
  pushLine('Total beban operasional', -st.pl.expenses, 'subtotal');
  pushLine('EBITDA', st.pl.ebitda, 'subtotal');
  if (st.pl.depreciation) pushLine('Penyusutan aset tetap', -st.pl.depreciation, 'muted');
  pushLine('Laba operasi', st.pl.operatingProfit, 'total');
  if (st.pl.otherIncome) pushLine('Pendapatan lain-lain', st.pl.otherIncome, 'muted');
  pushLine(`Laba sebelum pajak`, st.pl.pretax, 'subtotal');
  pushLine(`Pajak (${U.num(st.pl.taxRate, 2)}% final)`, -st.pl.tax, 'muted');
  pushLine('Laba bersih', st.pl.net, 'total');

  const plTable = (rows) => `<div class="table-wrap"><table class="data fin-table">
    <thead><tr><th>Komponen</th><th class="num">Nilai (Rp)</th><th class="num">% pendapatan</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.kind === 'total' ? 'is-total' : r.kind === 'subtotal' ? 'is-subtotal' : ''}">
      <td class="${r.kind === 'muted' ? 'muted' : ''}">${U.h(r.label)}</td>
      <td class="num" style="${r.value < 0 ? 'color:var(--text-soft)' : ''}">${r.value < 0 ? '(' + U.idr(Math.abs(r.value)) + ')' : U.idr(r.value)}</td>
      <td class="num muted">${st.pl.revenue ? U.pct((Math.abs(r.value) / st.pl.revenue) * 100, 1) : '—'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;

  const prevMonth = U.addMonths(ctx.month, -1);
  const prevSeries = series.find((s) => s.month === prevMonth);
  const PL_CMP = [
    ['Pendapatan', st.pl.revenue, prevSeries ? prevSeries.revenue : 0],
    ['Laba kotor', st.pl.gross, prevSeries ? prevSeries.revenue - prevSeries.cogs : 0],
    ['Beban operasional', st.pl.expenses, prevSeries ? prevSeries.expenses : 0],
    ['Laba bersih', st.pl.net, prevSeries ? prevSeries.net : 0],
  ];
  const plCompare = `<div class="table-wrap"><table class="data">
    <thead><tr><th>Indikator</th><th class="num">${U.h(U.monthShort(ctx.month))}</th><th class="num">${U.h(U.monthShort(prevMonth))}</th><th class="num">Perubahan</th></tr></thead>
    <tbody>${PL_CMP.map(([label, cur, prev]) => {
      const delta = prev ? ((cur - prev) / Math.abs(prev)) * 100 : null;
      return `<tr><td>${U.h(label)}</td><td class="num strong">${U.idrShort(cur)}</td><td class="num muted">${U.idrShort(prev)}</td>
        <td class="num">${delta === null ? '—' : L.badge((delta >= 0 ? '+' : '') + U.pct(delta, 1), delta >= 0 ? 'good' : 'bad')}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;

  const plBody = `
    <div class="grid grid-4">
      ${[
        ['Pendapatan', U.idrShort(st.pl.revenue), `${st.pl.transactions} nota lunas`],
        ['Laba kotor', U.idrShort(st.pl.gross), 'margin ' + U.pct(st.pl.grossMargin, 1)],
        ['Laba operasi', U.idrShort(st.pl.operatingProfit), 'margin ' + U.pct(st.pl.operatingMargin, 1)],
        ['Laba bersih', U.idrShort(st.pl.net), 'margin ' + U.pct(st.pl.margin, 1)],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Laporan Laba Rugi', subtitle: `${U.monthLabel(ctx.month)} · ${ctx.scopeCompany ? ctx.scopeCompany.name : 'konsolidasi grup'}` }, plTable(plLines))}

    <div class="grid grid-side">
      ${L.card({ title: 'Perbandingan bulan lalu', subtitle: 'Bandingkan dengan bulan sebelumnya untuk melihat arah' }, plCompare)}
      ${canWrite ? L.card({ title: 'Asumsi pajak', subtitle: 'Dipakai menghitung laba bersih setelah pajak' }, `
        <form method="post" action="${ctx.base}/finance/settings">
          ${ctx.csrfField}${ctx.backField}
          <label class="field"><span>Tarif pajak final (% dari laba sebelum pajak)</span>
            <input name="tax_rate" type="number" min="0" max="50" step="0.1" value="${U.num(st.pl.taxRate, 2)}">
          </label>
          <p class="hint-text">Untuk UMKM Indonesia umumnya PPh final 0,5%. Isi 0 bila ingin melihat laba sebelum pajak saja.</p>
          <div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan tarif</button></div>
        </form>`) : L.card({ title: 'Asumsi pajak', subtitle: 'Hanya bisa diubah role finance/owner' }, `<p class="hint-text">Tarif pajak saat ini ${U.num(st.pl.taxRate, 2)}%.</p>`)}
    </div>
  `;

  // ---------------- panel Arus Kas ----------------
  const cfGroupRows = (label, rows, total) => `
    <table class="data fin-table">
      <thead><tr><th>${U.h(label)}</th><th class="num">Jumlah (Rp)</th></tr></thead>
      <tbody>
        ${rows.map(([name, value]) => `<tr><td>${U.h(name)}</td>
          <td class="num" style="${value < 0 ? 'color:var(--text-soft)' : ''}">${value < 0 ? '(' + U.idr(Math.abs(value)) + ')' : U.idr(value)}</td></tr>`).join('')}
        <tr class="is-total"><td>Arus kas ${U.h(label.split(' ')[0].toLowerCase())}</td><td class="num">${total < 0 ? '(' + U.idr(Math.abs(total)) + ')' : U.idr(total)}</td></tr>
      </tbody>
    </table>`;

  const g = st.cf.groups;
  const cfBody = `
    <div class="grid grid-4">
      ${[
        ['Kas awal periode', U.idrShort(st.cf.beginBalance), 'saldo awal dari akun + akumulasi'],
        ['Arus kas operasi', (st.cf.operating >= 0 ? '+' : '−') + U.idrShort(Math.abs(st.cf.operating)), 'penjualan − HPP − beban'],
        ['Arus kas investasi & pendanaan', (st.cf.investing + st.cf.financing >= 0 ? '+' : '−') + U.idrShort(Math.abs(st.cf.investing + st.cf.financing)), 'aset tetap, utang, modal'],
        ['Kas akhir periode', U.idrShort(st.cf.endBalance), st.cf.netChange >= 0 ? 'kas bertambah' : 'kas berkurang'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Laporan Arus Kas', subtitle: `${U.monthLabel(ctx.month)} · metode langsung dari transaksi tercatat` }, `
      <div class="grid grid-side" style="gap:20px">
        <div>${cfGroupRows('Arus kas operasional', [
          ['Penerimaan dari penjualan', st.pl.revenue],
          ['Penerimaan lain (operasional)', g.operating.in],
          ['Pembayaran HPP / pembelian bahan', -st.pl.cogs],
          ['Pembayaran beban operasional', -g.operating.out],
        ], st.cf.operating)}</div>
        <div>
          ${cfGroupRows('Arus kas investasi', [
            ['Penerimaan penjualan aset', g.investing.in],
            ['Pembelian aset tetap', -g.investing.out],
          ], st.cf.investing)}
          <div style="height:16px"></div>
          ${cfGroupRows('Arus kas pendanaan', [
            ['Setoran modal', g.financing.in],
            ['Pembayaran utang / dividen', -g.financing.out],
          ], st.cf.financing)}
        </div>
      </div>
      <div class="table-wrap" style="margin-top:16px"><table class="data fin-table">
        <tbody>
          <tr><td>Kenaikan / penurunan kas bersih</td><td class="num strong">${st.cf.netChange < 0 ? '(' + U.idr(Math.abs(st.cf.netChange)) + ')' : U.idr(st.cf.netChange)}</td></tr>
          <tr><td>Kas di awal periode</td><td class="num">${U.idr(st.cf.beginBalance)}</td></tr>
          <tr class="is-total"><td>Kas di akhir periode</td><td class="num">${U.idr(st.cf.endBalance)}</td></tr>
        </tbody>
      </table></div>
      <p class="hint-text" style="margin-top:10px">Pembayaran HPP dihitung dari harga pokok penjualan periode ini (asumsi pembelian bahan tunai pada periode yang sama). Transaksi berlabel kelompok investasi/pendanaan ikut memindahkan angkanya ke bagian bawah.</p>`)}
  `;

  // ---------------- panel Neraca ----------------
  const bs = st.bs;
  const bsTable = (grp) => `<table class="data fin-table">
    <thead><tr><th>${U.h(grp.label)}</th><th class="num">Saldo (Rp)</th><th></th></tr></thead>
    <tbody>
      ${grp.rows.map((r) => `<tr><td>${U.h(r.label)}${r.auto ? ' <span class="badge badge-muted">otomatis</span>' : ''}</td>
        <td class="num">${r.value < 0 ? '(' + U.idr(Math.abs(r.value)) + ')' : U.idr(r.value)}</td>
        <td></td></tr>`).join('')}
      <tr class="is-total"><td>Jumlah ${U.h(grp.label)}</td><td class="num">${grp.total < 0 ? '(' + U.idr(Math.abs(grp.total)) + ')' : U.idr(grp.total)}</td><td></td></tr>
    </tbody>
  </table>`;

  const accountRows = bs.accounts.map((a) => `<tr>
    <td>${U.h(a.company_name || '')}</td>
    <td>${U.h(a.name)}<span class="sub-cell">${U.h(TYPE_LABEL[a.type] || a.type)}${a.monthly_depreciation ? ' · penyusutan ' + U.idrShort(a.monthly_depreciation) + '/bln' : ''}</span></td>
    <td class="num">${U.idr(a.balance)}</td>
    <td class="num">${canWrite ? `<form method="post" action="${ctx.base}/finance/accounts/${a.id}/delete" data-confirm="Hapus akun ${U.h(a.name)}?">
      ${ctx.csrfField}${ctx.backField}<button class="btn btn-danger btn-sm" type="submit">Hapus</button></form>` : ''}</td>
  </tr>`).join('');

  const accountForm = canWrite ? L.card({ title: 'Akun neraca', subtitle: 'Saldo yang tidak bisa dihitung otomatis: kas awal, utang, modal, aset tetap' }, `
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Entitas</th><th>Akun</th><th class="num">Saldo</th><th></th></tr></thead>
      <tbody>${accountRows || `<tr><td colspan="4">${L.empty('Belum ada akun neraca', 'Tambahkan kas awal, modal, atau utang di bawah.')}</td></tr>`}</tbody>
    </table></div>
    <form method="post" action="${ctx.base}/finance/accounts" style="margin-top:16px">
      ${ctx.csrfField}${ctx.backField}
      <div class="form-grid cols-3">
        <label class="field"><span>Entitas</span>
          <select name="company_id">${ctx.allowedCompanies.map((c) => `<option value="${c.id}" ${ctx.scopeCompany && ctx.scopeCompany.id === c.id ? 'selected' : ''}>${U.h(c.name)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Jenis akun</span>
          <select name="type">${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}">${U.h(v)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Nama akun</span><input name="name" required placeholder="mis. Kas Kasir Station 1.0"></label>
        <label class="field"><span>Saldo (Rp)</span><input name="balance" type="number" step="1000" value="0"></label>
        <label class="field"><span>Penyusutan / bulan</span><input name="monthly_depreciation" type="number" min="0" step="1000" value="0"></label>
        <label class="field"><span>Catatan</span><input name="note" placeholder="opsional"></label>
      </div>
      <p class="hint-text">Isi saldo negatif untuk akumulasi penyusutan. Akun bertipe <b>Kas & bank</b> menjadi saldo awal kas; arus kas bulan berjalan ditambahkan otomatis.</p>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Tambah akun</button></div>
    </form>`) : '';

  const bsBody = `
    <div class="grid grid-4">
      ${[
        ['Total aset', U.idrShort(bs.totalAssets), `kas ${U.idrShort(bs.auto.cash)} · persediaan ${U.idrShort(bs.auto.materialValue + bs.auto.productValue)}`],
        ['Total kewajiban', U.idrShort(bs.totalLiabilities), 'utang usaha, pajak, bank'],
        ['Total ekuitas', U.idrShort(bs.totalEquity), `modal ${U.idrShort(bs.capital)} + laba ditahan`],
        ['Status neraca', bs.balanced ? 'Seimbang' : 'Selisih', bs.balanced ? 'aset = kewajiban + ekuitas' : 'periksa akun'],
      ].map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Neraca (Balance Sheet)', subtitle: `Per ${U.dateLabel(U.todayISO())} · laba ditahan dihitung sebagai penyeimbang agar neraca selalu seimbang` }, `
      <div class="grid grid-side" style="gap:20px">
        <div>${bsTable(bs.groups[0])}<div style="height:16px"></div>${bsTable(bs.groups[1])}</div>
        <div>${bsTable(bs.groups[2])}<div style="height:16px"></div>${bsTable(bs.groups[3])}</div>
      </div>
      <div class="table-wrap" style="margin-top:16px"><table class="data fin-table">
        <tbody>
          <tr class="is-total"><td>Total Aset</td><td class="num">${U.idr(bs.totalAssets)}</td></tr>
          <tr class="is-total"><td>Total Kewajiban + Ekuitas</td><td class="num">${U.idr(bs.totalLiabilities + bs.totalEquity)}</td></tr>
          <tr><td>Selisih</td><td class="num ${bs.balanced ? '' : 'text-bad'}">${U.idr(bs.totalAssets - bs.totalLiabilities - bs.totalEquity)}</td></tr>
        </tbody>
      </table></div>`)}

    ${accountForm}
  `;

  // ---------------- tab & kerangka halaman ----------------
  const TABS = [
    ['ringkasan', 'Ringkasan', 'grid'],
    ['labarugi', 'Laba Rugi', 'trendUp'],
    ['aruskas', 'Arus Kas', 'wallet'],
    ['neraca', 'Neraca', 'layers'],
  ];
  const activeTab = TABS.some((t) => t[0] === data.tab) ? data.tab : 'ringkasan';
  const tabBar = TABS.map(([key, label, icon]) => `<a class="prof-tab ${activeTab === key ? 'is-active' : ''}"
    href="${ctx.base}/finance?tab=${key}" data-fin-tab="${key}" role="tab" aria-selected="${activeTab === key}">
    ${L.icon(icon, 16)}<span>${U.h(label)}</span></a>`).join('');

  const panels = [
    ['ringkasan', overviewBody],
    ['labarugi', plBody],
    ['aruskas', cfBody],
    ['neraca', bsBody],
  ].map(([key, content]) => `<div class="prof-panel ${activeTab === key ? 'is-active' : ''}" data-fin-panel="${key}" role="tabpanel">${content}</div>`).join('');

  const body = `
    <div class="prof-tabs fin-tabs" role="tablist">${tabBar}</div>
    <div class="fin-panels">${panels}</div>
  `;

  return L.shell(ctx, {
    title: 'Keuangan, Arus Kas & Proyeksi',
    subtitle: `${ctx.scopeCompany ? ctx.scopeCompany.name : 'Konsolidasi grup'} · ${U.monthLabel(ctx.month)}`,
    active: '/finance',
    toolbar: L.exportButton(ctx, 'finance', 'Ekspor Excel'),
    content: body,
  });
}

module.exports = { financePage };
