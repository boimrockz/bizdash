'use strict';

const U = require('../lib/util');
const L = require('./layout');
function chipList(items) {
  return items.map((s) => `<span class="exp-sheet">${U.h(s)}</span>`).join('');
}

function exportPage(ctx, data) {
  const { available, monthLabel, scopeLabel, lastLog } = data;

  const cards = available.map((k) => `<article class="card exp-card" data-export-kind="${U.h(k.kind)}">
    <div class="exp-head">
      <span class="exp-ico">${L.icon(k.icon, 20)}</span>
      <div>
        <h3>${U.h(k.label)}</h3>
        <p class="muted">${U.h(k.desc)}</p>
      </div>
    </div>
    <div class="exp-sheets"><span class="exp-sheet-label">Sheet</span>${chipList(k.sheets)}</div>
    <div class="exp-actions">
      <a class="btn btn-primary" href="${ctx.base}/export/${k.kind}?format=xlsx" data-export-link>${L.icon('download', 15)} Excel (.xlsx)</a>
      <a class="btn btn-ghost" href="${ctx.base}/export/${k.kind}?format=csv" data-export-link>${L.icon('download', 15)} CSV</a>
    </div>
  </article>`).join('');

  const logRows = lastLog.map((l) => `<tr>
    <td class="nowrap">${U.h(String(l.detail || '').split(' · ')[0])}</td>
    <td>${U.h(l.user_name || '—')}</td>
    <td class="muted">${U.h(String(l.detail || '').split(' · ').slice(1).join(' · '))}</td>
    <td class="nowrap muted">${U.h(U.timeLabel(l.created_at))} · ${U.h(String(l.created_at || '').slice(0, 10))}</td>
  </tr>`).join('');

  const body = `
    ${L.card({ title: 'Data siap diserahkan ke akuntan atau diolah di Excel', subtitle: `${monthLabel} · ${scopeLabel}` }, `
      <div class="exp-intro">
        ${L.icon('download', 22)}
        <p>File mengikuti filter <b>periode</b> dan <b>cakupan entitas</b> yang sedang aktif. Angka dikirim sebagai
        angka (bukan teks) sehingga bisa langsung di-SUM atau di-pivot, dan setiap file memiliki sheet
        <b>Ringkasan</b> agar mudah diperiksa sebelum dikirim.</p>
      </div>`)}

    <div class="grid grid-3 exp-grid">${cards || L.empty('Tidak ada jenis ekspor untuk peran Anda')}</div>

    ${L.card({ title: 'Cetak sebagai PDF', subtitle: 'Untuk rapat atau lampiran email tanpa perlu aplikasi tambahan' }, `
      <div class="exp-print">
        <div>
          <p>Buka halaman yang ingin dicetak (mis. <a href="${ctx.base}/finance">Keuangan</a>,
          <a href="${ctx.base}/pos/sales">Riwayat Transaksi</a>, <a href="${ctx.base}/leaderboard">Leaderboard</a>),
          lalu tekan tombol <b>Cetak / PDF</b> di kanan atas. Tampilan cetak otomatis menyembunyikan menu,
          filter, dan tombol sehingga hasilnya bersih — pilih "Simpan sebagai PDF" pada dialog cetak.</p>
          <p class="hint-text">Tips: atur ukuran kertas <b>A4 landscape</b> untuk tabel lebar agar tidak terpotong.</p>
        </div>
        <button class="btn btn-ghost" type="button" data-print>${L.icon('receipt', 15)} Cetak halaman ini</button>
      </div>`)}

    ${L.card({ title: 'Riwayat unduhan', subtitle: 'Jejak audit 10 unduhan terakhir' }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Jenis</th><th>Pengguna</th><th>Rincian</th><th>Waktu</th></tr></thead>
        <tbody>${logRows || `<tr><td colspan="4">${L.empty('Belum ada unduhan', 'Unduhan pertama akan tercatat di sini.')}</td></tr>`}</tbody>
      </table></div>`)}
  `;

  return L.shell(ctx, {
    title: 'Ekspor Data',
    subtitle: `${monthLabel} · ${scopeLabel}`,
    active: '/export',
    content: body,
  });
}

module.exports = { exportPage };
