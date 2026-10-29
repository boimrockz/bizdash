'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const S = require('../lib/subscriptions');
const C = require('./charts');

function statusBadge(row) {
  return L.badge(S.STATUS_LABEL[row.effective] || row.effective, row.tone);
}

function dueText(row) {
  if (row.days_left === null || row.days_left === undefined) return '—';
  if (row.days_left < 0) return `lewat ${Math.abs(row.days_left)} hari`;
  if (row.days_left === 0) return 'hari ini';
  return `${row.days_left} hari lagi`;
}

function subscriptionsPage(ctx, data) {
  const { stats, rows, plans, series, detail, customers, filter } = data;
  const canWrite = can(ctx.user, 'subscription_write');

  const statsCards = [
    ['Langganan aktif', U.num(stats.active), `${U.num(stats.total)} total pelanggan`],
    ['MRR', U.idrShort(stats.mrr), 'pendapatan berulang / bulan'],
    ['Jatuh tempo ≤7 hari', U.num(stats.expiring), 'perlu diingatkan'],
    ['Menunggak', U.num(stats.overdue), `nilai ${U.idrShort(stats.atRisk)}`],
  ];

  const rowsHtml = rows.map((r) => `<tr>
    <td>
      <span class="strong">${U.h(r.customer_name)}</span>
      <span class="sub-cell">${U.h(r.company_name || '')}${r.company_name ? ' · ' : ''}${U.h(r.customer_type === 'b2b' ? 'B2B' : 'Member')}</span>
    </td>
    <td>${U.h(r.plan_name)}<span class="sub-cell">${U.h(r.plan_interval === 'quarterly' ? 'per 3 bulan' : r.plan_interval === 'weekly' ? 'per minggu' : 'per bulan')}</span></td>
    <td class="num">${U.idr(r.amount)}</td>
    <td>${statusBadge(r)}</td>
    <td class="num">${U.h(r.next_due || '—')}<span class="sub-cell">${U.h(dueText(r))}</span></td>
    <td class="num">${r.paid_count ? `${r.paid_count}× · ${U.idrShort(r.paid_total)}` : '—'}</td>
    <td class="num">
      <a class="btn btn-ghost btn-sm" href="${ctx.link('/subscriptions', { sub: r.id })}">Detail</a>
      ${canWrite && (r.effective === 'overdue' || r.effective === 'past_due') ? `<form method="post" action="${ctx.base}/subscriptions/${r.id}/pay" style="margin-top:4px">
        ${ctx.csrfField}${ctx.backField}
        <input type="hidden" name="method" value="qris">
        <button class="btn btn-primary btn-sm" type="submit">Tandai lunas</button>
      </form>` : ''}
    </td>
  </tr>`).join('');

  const detailHtml = detail ? `
    <div class="grid grid-side" style="margin-top:20px">
      ${L.card({ title: detail.customer_name, subtitle: `${detail.plan_name} · ${detail.company_name || ''}` }, `
        <div class="table-wrap"><table class="data">
          <tbody>
            <tr><td class="muted">Status</td><td>${L.badge(S.STATUS_LABEL[detail.effective], detail.tone)} <span class="hint-text">${U.h(dueText(detail))}</span></td></tr>
            <tr><td class="muted">Nilai / periode</td><td>${U.idr(detail.amount)} · ${U.h(detail.plan_interval)}</td></tr>
            <tr><td class="muted">Mulai</td><td>${U.h(detail.started_at)}</td></tr>
            <tr><td class="muted">Jatuh tempo berikutnya</td><td>${U.h(detail.next_due || '—')}</td></tr>
            <tr><td class="muted">Total dibayar</td><td>${U.idr(detail.paid_total)}</td></tr>
            <tr><td class="muted">Kontak</td><td>${U.h(detail.phone || '—')}${detail.email ? ' · ' + U.h(detail.email) : ''}</td></tr>
            <tr><td class="muted">Benefit paket</td><td class="muted">${U.h(detail.perks || '—').replace(/\|/g, ' · ')}</td></tr>
          </tbody>
        </table></div>
        ${canWrite ? `<div class="form-actions" style="flex-wrap:wrap">
          <form method="post" action="${ctx.base}/subscriptions/${detail.id}/pay" style="display:flex;gap:6px;align-items:center">
            ${ctx.csrfField}${ctx.backField}
            <select name="method" style="padding:7px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface-solid);color:var(--text);font:inherit;font-size:var(--fs-sm)">
              <option value="qris">QRIS</option><option value="transfer">Transfer</option><option value="cash">Tunai</option><option value="invoice">Invoice B2B</option>
            </select>
            <button class="btn btn-primary btn-sm" type="submit">Catat pembayaran</button>
          </form>
          <form method="post" action="${ctx.base}/subscriptions/${detail.id}/extend">
            ${ctx.csrfField}${ctx.backField}
            <input type="hidden" name="days" value="30">
            <button class="btn btn-ghost btn-sm" type="submit">Perpanjang 30 hari</button>
          </form>
          <form method="post" action="${ctx.base}/subscriptions/${detail.id}/status" style="display:flex;gap:6px;align-items:center">
            ${ctx.csrfField}${ctx.backField}
            <select name="status" style="padding:7px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface-solid);color:var(--text);font:inherit;font-size:var(--fs-sm)">
              ${[['active', 'Aktifkan'], ['paused', 'Tangguhkan'], ['cancelled', 'Berhenti']].map(([v, l]) => `<option value="${v}" ${detail.status === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" type="submit">Ubah status</button>
          </form>
          <a class="btn btn-ghost btn-sm" href="${ctx.link('/whatsapp', { chat: String(detail.phone || '').replace(/[^0-9]/g, ''), preset: `Halo ${detail.customer_name}, langganan ${detail.plan_name} Anda jatuh tempo ${detail.next_due}.` })}">Ingatkan via WhatsApp</a>
        </div>` : ''}`)}

      ${L.card({ title: 'Riwayat pembayaran', subtitle: `${detail.payments.length} tagihan tercatat` }, `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Jatuh tempo</th><th class="num">Nominal</th><th>Status</th><th>Dibayar</th><th>Metode</th></tr></thead>
          <tbody>${detail.payments.map((p) => `<tr>
            <td>${U.h(p.due_date)}</td>
            <td class="num">${U.idr(p.amount)}</td>
            <td>${p.status === 'paid' ? L.badge('Lunas', 'good') : p.status === 'overdue' ? L.badge('Menunggak', 'bad') : L.badge('Menunggu', 'warn')}</td>
            <td class="muted">${U.h(p.paid_at ? String(p.paid_at).slice(0, 16) : '—')}</td>
            <td class="muted">${U.h(p.method || '—')}</td>
          </tr>`).join('') || `<tr><td colspan="5">${L.empty('Belum ada tagihan')}</td></tr>`}</tbody>
        </table></div>`) }
    </div>` : '';

  const planCards = plans.map((p) => `<div class="rate-card">
    <span class="rate-courier">${U.h(p.name)}</span>
    <span class="rate-price">${U.idr(p.price)}<span class="hint-text" style="font-weight:400"> / ${U.h(p.interval === 'quarterly' ? '3 bulan' : p.interval)}</span></span>
    <span class="rate-service">${U.h(p.description || '')}</span>
    <span class="rate-eta">${U.num(p.subscribers)} pelanggan aktif</span>
    ${canWrite ? `<button class="btn btn-ghost btn-sm" type="button" data-plan="${p.id}" data-plan-name="${U.h(p.name)}">Pakai paket ini</button>` : ''}
  </div>`).join('');

  const body = `
    <div class="grid grid-4">
      ${statsCards.map(([label, value, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(label)}</span></div>
        <div class="stat-value">${value}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    ${L.card({ title: 'Pendapatan langganan 6 bulan', subtitle: 'Tagihan vs pembayaran diterima' }, `
      ${C.comboChart(series.map((s) => ({ month: s.month, revenue: s.due, expenses: s.collected, net: s.collected })))}
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot rev"></span>Tagihan diterbitkan</span>
        <span class="legend-item"><span class="legend-dot exp"></span>Berhasil ditagih</span>
        <span class="legend-item"><span class="legend-dot net"></span>Realisasi</span>
      </div>`)}

    ${L.card({ title: 'Daftar langganan', subtitle: `${rows.length} pelanggan berlangganan` }, `
      <form method="get" action="${ctx.base}/subscriptions" class="inline-filters">
        ${ctx.selectedCompanyId ? `<input type="hidden" name="company" value="${ctx.selectedCompanyId}">` : ''}
        <input type="search" name="q" value="${U.h(filter.q || '')}" placeholder="Cari nama, perusahaan, atau nomor HP…">
        <select name="status" data-autosubmit>
          <option value="all" ${filter.status === 'all' ? 'selected' : ''}>Semua status</option>
          <option value="active" ${filter.status === 'active' ? 'selected' : ''}>Aktif</option>
          <option value="expiring" ${filter.status === 'expiring' ? 'selected' : ''}>Jatuh tempo / menunggak</option>
          <option value="paused" ${filter.status === 'paused' ? 'selected' : ''}>Ditangguhkan</option>
          <option value="cancelled" ${filter.status === 'cancelled' ? 'selected' : ''}>Berhenti</option>
        </select>
        <button class="btn btn-ghost btn-sm" type="submit">Terapkan</button>
      </form>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Pelanggan</th><th>Paket</th><th class="num">Nilai</th><th>Status</th><th class="num">Jatuh tempo</th><th class="num">Pembayaran</th><th></th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="7">${L.empty('Belum ada langganan', 'Tambahkan pelanggan berlangganan pertama Anda di bawah.')}</td></tr>`}</tbody>
      </table></div>`)}

    ${canWrite ? L.card({ title: 'Tambah langganan', subtitle: 'Pilih pelanggan dan paket; tagihan pertama dibuat otomatis' }, `
      <form method="post" action="${ctx.base}/subscriptions/create" id="sub-form">
        ${ctx.csrfField}${ctx.backField}
        <div class="form-grid cols-3">
          <label class="field"><span>Pelanggan</span>
            <select name="customer_id" required>${customers.map((c) => `<option value="${c.id}">${U.h(c.name)}${c.company_name ? ' · ' + U.h(c.company_name) : ''} (${U.h(c.type.toUpperCase())})</option>`).join('')}</select>
          </label>
          <label class="field"><span>Paket</span>
            <select name="plan_id" id="plan-select" required>${plans.filter((p) => p.active).map((p) => `<option value="${p.id}">${U.h(p.name)} · ${U.idr(p.price)}/${U.h(p.interval)}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Mulai</span><input name="started_at" type="date" value="${U.todayISO()}"></label>
          <label class="field"><span>Nilai khusus (opsional)</span><input name="amount" type="number" min="0" step="10000" placeholder="kosongkan = harga paket"></label>
          <label class="field"><span>Metode penagihan</span>
            <select name="channel"><option value="whatsapp">WhatsApp</option><option value="qris">QRIS</option><option value="transfer">Transfer</option><option value="invoice">Invoice B2B</option></select>
          </label>
          <label class="field"><span>Catatan</span><input name="note" placeholder="mis. dikirim tiap Senin"></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">${L.icon('plus', 15)} Simpan langganan</button></div>
      </form>`) : ''}

    ${detailHtml}

    ${L.card({ title: 'Paket langganan', subtitle: 'Harga dan benefit yang ditawarkan' }, `<div class="rate-grid">${planCards}</div>`)}
  `;

  return L.shell(ctx, {
    title: 'Langganan Pelanggan',
    subtitle: 'Status aktif, jatuh tempo, dan riwayat pembayaran',
    active: '/subscriptions',
    content: body,
  });
}

module.exports = { subscriptionsPage, statusBadge, dueText };
