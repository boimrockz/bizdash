'use strict';

const U = require('../lib/util');
const L = require('./layout');

/** Pratinjau struk berbentuk teks (monospace) — sama dengan isi yang dicetak. */
function preview(lines) {
  return `<pre class="receipt-preview" aria-label="Pratinjau struk">${U.h(lines.join('\n'))}</pre>`;
}

/** Kartu struk terakhir di halaman POS (setelah checkout). */
function receiptCard(ctx, data) {
  const { ticket, lines } = data;
  return `<section class="receipt-card" id="receipt-card" data-ticket-id="${ticket.id || ''}">
    <header class="receipt-card-head">
      <div>
        <p class="cart-eyebrow">Transaksi tersimpan</p>
        <h3>${U.h(ticket.meta.invoice)} · ${U.idr(ticket.totals.total)}</h3>
        <p class="hint-text">${U.h(ticket.meta.date)} ${U.h(ticket.meta.time)} · ${U.h(ticket.payment.label)}${ticket.payment.reference ? ' · ' + U.h(ticket.payment.reference) : ''}</p>
      </div>
      <div class="receipt-card-actions">
        <button class="btn btn-primary btn-sm" type="button" data-print-last>
          ${L.icon('printer', 15)} Cetak struk
        </button>
        <a class="btn btn-ghost btn-sm" href="${ctx.base}/pos/sales/${ticket.saleId}/struk">
          ${L.icon('receipt', 15)} Halaman struk
        </a>
      </div>
    </header>
    ${preview(lines)}
  </section>`;
}

/** Halaman struk mandiri: bisa dicetak dari printer Bluetooth atau dialog browser. */
function receiptPage(ctx, data) {
  const { ticket, lines, paper, qrisMode, isReprint } = data;
  const body = `
    <div class="grid grid-side receipt-layout">
      <section class="card receipt-sheet-card">
        <div class="card-head">
          <div>
            <h2>${U.h(ticket.meta.invoice)}</h2>
            <p class="card-sub">${U.h(ticket.payLabel || ticket.payment.label)} · ${U.idr(ticket.totals.total)}${isReprint ? ' · cetak ulang' : ''}</p>
          </div>
          <span class="badge badge-${ticket.meta.status === 'void' ? 'bad' : 'good'}">${U.h(ticket.meta.status === 'void' ? 'Void' : 'Lunas')}</span>
        </div>
        <div class="card-body">
          ${preview(lines)}
        </div>
      </section>

      <section class="card receipt-tools" id="receipt-print"
        data-ticket-id="${ticket.saleId}"
        data-ticket-url="${ctx.base}/pos/sales/${ticket.saleId}/ticket"
        data-receipt-width="${paper.mm}">
        <div class="card-head">
          <div>
            <h2>Cetak</h2>
            <p class="card-sub">Printer thermal Bluetooth (ESC/POS) atau dialog cetak browser</p>
          </div>
        </div>
        <div class="card-body receipt-tools-body">
          <div class="printer-state" data-printer-state>
            <span class="printer-dot"></span>
            <div>
              <strong data-printer-name>Printer belum terhubung</strong>
              <small data-printer-hint>Hubungkan printer thermal 58/80 mm via Bluetooth.</small>
            </div>
          </div>
          <div class="receipt-tool-grid">
            <button class="btn btn-primary btn-sm" type="button" data-printer-connect>${L.icon('printer', 15)} Hubungkan printer</button>
            <button class="btn btn-ghost btn-sm" type="button" data-printer-disconnect>Putuskan</button>
            <button class="btn btn-ghost btn-sm" type="button" data-printer-test>Tes cetak</button>
          </div>
          <label class="field"><span>Lebar kertas</span>
            <select data-receipt-width-select>
              <option value="58" ${paper.mm === 58 ? 'selected' : ''}>58 mm (32 karakter)</option>
              <option value="80" ${paper.mm === 80 ? 'selected' : ''}>80 mm (48 karakter)</option>
            </select>
          </label>
          <label class="checkline"><input type="checkbox" data-receipt-qr checked> Cetak QR QRIS di struk (bila ada)</label>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" data-print-bluetooth>${L.icon('printer', 16)} Cetak ke printer</button>
            <button class="btn btn-ghost" type="button" data-print-browser>Cetak via browser</button>
            <a class="btn btn-ghost" href="${ctx.base}/pos/sales">Riwayat transaksi</a>
          </div>
          <p class="hint-text" data-printer-error hidden></p>
          <p class="hint-text">
            Web Bluetooth hanya tersedia di Chrome (Android/desktop). Di iPhone/Safari gunakan
            <b>Cetak via browser</b> ke printer yang mendukung AirPrint, atau kirim struk lewat WhatsApp.
          </p>
        </div>
      </section>
    </div>`;

  return L.shell(ctx, {
    title: `Struk ${ticket.meta.invoice}`,
    subtitle: `${ticket.meta.outlet} · ${ticket.meta.date} ${ticket.meta.time}`,
    active: '/pos/sales',
    content: body,
    bodyClass: 'receipt-page',
  });
}

module.exports = { receiptCard, receiptPage, preview };
