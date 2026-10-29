'use strict';

const U = require('../lib/util');
const L = require('./layout');
const { can } = require('../lib/auth');
const settings = require('../lib/settings');
const qris = require('../lib/qris');

/**
 * Pengaturan kasir: QRIS (statis merchant atau gateway) + struk/printer thermal.
 * Kredensial hanya disimpan server-side dan ditampilkan tersamar.
 */
function settingsPosPage(ctx, data) {
  const { mode, paper, lastPayments = [], qrisStats = {} } = data;
  const canWrite = can(ctx.user, 'integration_write');
  const canReceipt = can(ctx.user, 'pos_write');
  const cfg = (k, d = '') => settings.get(ctx.db, k, d);

  const providerOptions = Object.entries(qris.PROVIDERS)
    .map(([key, p]) => `<option value="${key}" ${mode.provider === key ? 'selected' : ''}>${U.h(p.label)}</option>`).join('');

  const paymentRows = lastPayments.map((p) => `<tr>
    <td><span class="strong">${U.h(p.reference)}</span><span class="sub-cell">${U.h(p.invoice_no || 'belum terhubung ke nota')}</span></td>
    <td>${U.h(p.provider)}</td>
    <td class="num">${U.idr(p.amount)}</td>
    <td>${L.badge(qris.STATUS[p.status] || p.status, p.status === 'paid' ? 'good' : p.status === 'pending' ? 'warn' : 'muted')}</td>
    <td>${U.h(U.dateLabel(p.created_at))} ${U.h(U.timeLabel(p.created_at))}</td>
  </tr>`).join('');

  const body = `
    ${L.card({
      title: 'Master data kasir: jenis menu, kategori & metode bayar',
      subtitle: 'Tambah atau ubah pilihan yang muncul di layar kasir',
    }, `
      <p class="hint-text">
        Jenis menu, kategori menu, metode pembayaran, nama tier harga, dan nama kanal penjualan
        diatur di satu halaman terpisah — termasuk menambah entitas/outlet penjualan.
      </p>
      <div class="chip-row" style="margin-top:12px">
        <a class="btn btn-primary btn-sm" href="${ctx.base}/settings/pos/master">${L.icon('layers', 15)} Buka Master Data POS</a>
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/structure">${L.icon('sitemap', 15)} Entitas &amp; outlet</a>
      </div>`)}

    <div class="grid grid-3">
      ${[
        ['QRIS', mode.live, mode.label, mode.live ? (mode.merchant ? `Merchant: ${mode.merchant}` : 'Siap membuat QR dinamis') : 'Belum siap dipakai'],
        ['Struk thermal', true, `${paper.label} · ${paper.cols} karakter`, 'Printer dihubungkan dari browser kasir'],
        ['Verifikasi QRIS', mode.live, mode.live ? 'Nominal dicek sebelum nota disimpan' : 'Nota bisa disimpan tanpa verifikasi', mode.live ? 'Aktif' : 'Menunggu konfigurasi'],
      ].map(([name, live, label, sub]) => `<article class="stat">
        <div class="stat-top"><span class="stat-label">${U.h(name)}</span>${L.badge(live ? 'Siap' : 'Belum', live ? 'good' : 'warn')}</div>
        <div class="stat-value" style="font-size:var(--fs-lg)">${U.h(label)}</div>
        <div class="stat-sub">${U.h(sub)}</div>
      </article>`).join('')}
    </div>

    <div class="grid grid-side">
      ${L.card({ title: 'Pembayaran QRIS', subtitle: canWrite ? 'Tempel QRIS statis merchant atau kredensial gateway' : 'Hanya owner yang dapat mengubah konfigurasi' }, `
        <form method="post" action="${ctx.base}/settings/pos/qris" class="stack-form">
          ${ctx.csrfField}${ctx.backField}
          <label class="field"><span>Sumber QR</span>
            <select name="qris_provider" ${canWrite ? '' : 'disabled'}>${providerOptions}</select>
          </label>
          <p class="hint-text">${U.h(qris.PROVIDERS[mode.provider].hint)}</p>

          <label class="field"><span>Payload QRIS statis merchant</span>
            <textarea name="qris_static_payload" rows="4" placeholder="00020101021126...6304ABCD" ${canWrite ? '' : 'disabled'}>${U.h(cfg('qris_static_payload'))}</textarea>
          </label>
          <p class="hint-text">
            Ambil dari gambar QRIS milik Anda (aplikasi bank/PJSP). Nominal disisipkan otomatis per transaksi,
            jadi pelanggan tidak perlu mengetik nominal. Status validasi:
            ${mode.payloadValid ? L.badge('Valid · ' + U.h(mode.merchant || 'merchant'), 'good') : L.badge(U.h(mode.payloadError || 'belum diisi'), 'warn')}
          </p>

          <div class="form-grid">
            <label class="field"><span>Masa berlaku QR (menit)</span>
              <input type="number" name="qris_expiry_minutes" min="1" max="120" value="${Number(cfg('qris_expiry_minutes', 15))}" ${canWrite ? '' : 'disabled'}>
            </label>
            <label class="field"><span>Acquirer Midtrans</span>
              <input name="qris_midtrans_acquirer" value="${U.h(cfg('qris_midtrans_acquirer', 'gopay'))}" placeholder="gopay" ${canWrite ? '' : 'disabled'}>
            </label>
          </div>

          <label class="field"><span>Midtrans Server Key ${mode.keyMasked && mode.provider === 'midtrans' ? `· tersimpan ${U.h(mode.keyMasked)}` : ''}</span>
            <input name="qris_midtrans_server_key" type="password" autocomplete="off" placeholder="SB-Mid-server-••••" ${canWrite ? '' : 'disabled'}>
          </label>
          <label class="checkline"><input type="checkbox" name="qris_midtrans_production" value="1" ${mode.production ? 'checked' : ''} ${canWrite ? '' : 'disabled'}> Mode produksi (tanpa centang = sandbox)</label>

          <label class="field"><span>Xendit Secret Key</span>
            <input name="qris_xendit_secret_key" type="password" autocomplete="off" placeholder="xnd_development_••••" ${canWrite ? '' : 'disabled'}>
          </label>
          <label class="field"><span>Xendit callback token</span>
            <input name="qris_xendit_callback_token" value="${U.h(cfg('qris_xendit_callback_token'))}" placeholder="token verifikasi webhook" ${canWrite ? '' : 'disabled'}>
          </label>

          <p class="hint-text">URL webhook: <code>${U.h(data.webhookUrl)}</code> (Midtrans HTTP notification / Xendit QR callback).</p>
          ${canWrite ? `<div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan QRIS</button></div>` : ''}
        </form>`)}

      ${L.card({ title: 'Struk & printer thermal', subtitle: canReceipt ? 'Format struk yang dicetak kasir' : 'Hanya role dengan akses kasir' }, `
        <form method="post" action="${ctx.base}/settings/pos/receipt" class="stack-form">
          ${ctx.csrfField}${ctx.backField}
          <div class="form-grid">
            <label class="field"><span>Lebar kertas</span>
              <select name="receipt_width" ${canReceipt ? '' : 'disabled'}>
                <option value="58" ${paper.mm === 58 ? 'selected' : ''}>58 mm (32 karakter)</option>
                <option value="80" ${paper.mm === 80 ? 'selected' : ''}>80 mm (48 karakter)</option>
              </select>
            </label>
            <label class="field"><span>Cetak otomatis</span>
              <select name="receipt_auto_print" ${canReceipt ? '' : 'disabled'}>
                <option value="1" ${cfg('receipt_auto_print', '0') === '1' ? 'selected' : ''}>Aktif setelah transaksi</option>
                <option value="0" ${cfg('receipt_auto_print', '0') === '1' ? '' : 'selected'}>Hanya saat tombol cetak ditekan</option>
              </select>
            </label>
          </div>
          <label class="field"><span>Baris tambahan di atas struk</span>
            <input name="receipt_header" value="${U.h(cfg('receipt_header'))}" placeholder="mis. Cabang Kemang · WiFi: ngopi123" ${canReceipt ? '' : 'disabled'}>
          </label>
          <label class="field"><span>Ucapan di bawah struk</span>
            <input name="receipt_footer" value="${U.h(cfg('receipt_footer', 'Terima kasih telah ngopi di tempat kami'))}" ${canReceipt ? '' : 'disabled'}>
          </label>
          <label class="checkline"><input type="checkbox" name="receipt_show_qris" value="1" ${cfg('receipt_show_qris', '1') === '1' ? 'checked' : ''} ${canReceipt ? '' : 'disabled'}> Sertakan QR QRIS pada struk</label>
          <p class="hint-text">
            Printer dihubungkan dari perangkat kasir (Web Bluetooth, Chrome Android/desktop). Preferensi
            lebar kertas & cetak otomatis juga bisa diubah langsung dari panel printer di POS.
          </p>
          ${canReceipt ? `<div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">Simpan pengaturan struk</button></div>` : ''}
        </form>`) }
    </div>

    ${L.card({ title: 'Transaksi QRIS terakhir', subtitle: `${qrisStats.paid || 0} lunas · ${qrisStats.pending || 0} menunggu · ${qrisStats.failed || 0} gagal/kedaluwarsa` }, `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Referensi</th><th>Provider</th><th class="num">Nominal</th><th>Status</th><th>Dibuat</th></tr></thead>
        <tbody>${paymentRows || `<tr><td colspan="5">${L.empty('Belum ada pembayaran QRIS')}</td></tr>`}</tbody>
      </table></div>`)}

    ${L.card({ title: 'Cara kerja singkat', subtitle: 'Supaya kasir dan pelanggan tidak bingung' }, `
      <ul class="labour-notes">
        <li><b>QRIS statis:</b> QRIS milik merchant diubah menjadi QR dinamis (nominal otomatis) saat kasir menekan Bayar. Kasir menandai lunas setelah notifikasi masuk.</li>
        <li><b>Midtrans/Xendit:</b> QR dibuat gateway dan status diperiksa otomatis, termasuk lewat webhook — kasir tidak perlu menandai manual.</li>
        <li><b>Struk:</b> setelah transaksi, struk dicetak langsung ke printer Bluetooth (ESC/POS) atau lewat dialog cetak browser bila perangkat tidak mendukung Web Bluetooth.</li>
        <li><b>Void:</b> transaksi yang dibatalkan otomatis menandai pembayaran QRIS-nya <i>dikembalikan</i> pada catatan pembayaran.</li>
      </ul>`)}
  `;

  return L.shell(ctx, {
    title: 'Kasir, QRIS & Struk',
    subtitle: 'Pembayaran QRIS dan printer thermal untuk layar kasir',
    active: '/settings/pos',
    content: body,
  });
}

module.exports = { settingsPosPage };
