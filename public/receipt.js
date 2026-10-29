/* Ondeway — pembentuk byte ESC/POS untuk printer thermal (58mm / 80mm).
   Murni fungsi (tanpa DOM) supaya bisa diuji di Node maupun dipakai di browser. */
(function (root) {
  'use strict';

  var ESC = 0x1b;
  var GS = 0x1d;
  var LF = 0x0a;

  var CMD = {
    init: [ESC, 0x40],
    alignLeft: [ESC, 0x61, 0x00],
    alignCenter: [ESC, 0x61, 0x01],
    alignRight: [ESC, 0x61, 0x02],
    boldOn: [ESC, 0x45, 0x01],
    boldOff: [ESC, 0x45, 0x00],
    sizeNormal: [GS, 0x21, 0x00],
    sizeDouble: [GS, 0x21, 0x11],
    sizeTall: [GS, 0x21, 0x01],
    underlineOn: [ESC, 0x2d, 0x01],
    underlineOff: [ESC, 0x2d, 0x00],
    feed: [LF],
    cut: [GS, 0x56, 0x41, 0x03],
    cutFull: [GS, 0x56, 0x00],
    drawer: [ESC, 0x70, 0x00, 0x19, 0xfa],
    beep: [ESC, 0x42, 0x03, 0x02],
  };

  // ------------------------------------------------------------ utilitas

  /** Normalisasi teks agar aman di codepage printer (buang aksen, ganti karakter khusus). */
  function plain(value) {
    var s = String(value === null || value === undefined ? '' : value);
    s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    return s
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u00a0]/g, ' ')
      .replace(/[^\x20-\x7e\n]/g, '');
  }

  function asciiBytes(text) {
    var s = plain(text);
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }

  function concat(parts) {
    var total = 0;
    parts.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total);
    var at = 0;
    parts.forEach(function (p) { out.set(p, at); at += p.length; });
    return out;
  }

  function line(text) {
    return concat([asciiBytes(text), Uint8Array.from([LF])]);
  }

  function rupiah(n) {
    return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  }

  function num(n, digits) {
    var v = Number(n) || 0;
    var d = digits === undefined ? (v % 1 === 0 ? 0 : 2) : digits;
    return v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function wrap(text, cols) {
    var words = plain(text).split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i += 1) {
      var w = words[i];
      if (!cur.length) {
        if (w.length <= cols) cur = w;
        else {
          var rest = w;
          while (rest.length > cols) { lines.push(rest.slice(0, cols)); rest = rest.slice(cols); }
          cur = rest;
        }
        continue;
      }
      if (cur.length + 1 + w.length <= cols) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    }
    if (cur.length) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function padLine(left, right, cols) {
    var l = plain(left);
    var r = plain(right);
    var space = cols - l.length - r.length;
    if (space >= 1) return l + new Array(space + 1).join(' ') + r;
    return [l, new Array(Math.max(0, cols - r.length) + 1).join(' ') + r];
  }

  function center(text, cols) {
    var t = plain(text).slice(0, cols);
    var left = Math.floor((cols - t.length) / 2);
    return new Array(Math.max(0, left) + 1).join(' ') + t;
  }

  function divider(cols) {
    return new Array(cols + 1).join('-');
  }

  /** Perintah QR code ESC/POS (model 2). */
  function qr(payload, opts) {
    var data = asciiBytes(payload || '');
    var size = Math.max(1, Math.min(16, (opts && opts.size) || 6));
    var ecc = ({ L: 48, M: 49, Q: 50, H: 51 })[(opts && opts.ecc) || 'M'] || 49;
    var len = data.length + 3;
    var pL = len & 0xff;
    var pH = (len >> 8) & 0xff;
    return concat([
      Uint8Array.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
      Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]),
      Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecc]),
      Uint8Array.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
      data,
      Uint8Array.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
    ]);
  }

  /**
   * Susun byte struk dari model struk server (lib/ticket.js).
   * @param {object} ticket
   * @param {object} [opts] { qr:boolean, qrPayload:string, drawer:boolean, feed:number, cut:boolean, preview:boolean }
   */
  function build(ticket, opts) {
    var o = opts || {};
    var cols = (ticket.paper && ticket.paper.cols) || (String((ticket.paper || {}).mm) === '80' ? 48 : 32);
    var parts = [Uint8Array.from(CMD.init)];
    var add = function (bytes) { parts.push(bytes); };
    // padLine bisa mengembalikan 2 baris bila teks tidak muat → tangani keduanya
    var addRow = function (left, right) {
      var v = padLine(left, right, cols);
      if (Array.isArray(v)) { add(line(v[0])); add(line(v[1])); } else add(line(v));
    };

    // ---------- kepala
    add(Uint8Array.from(CMD.alignCenter));
    add(Uint8Array.from(CMD.boldOn));
    add(Uint8Array.from(CMD.sizeDouble));
    add(line(center(ticket.store.name.toUpperCase(), Math.floor(cols / 2))));
    add(Uint8Array.from(CMD.sizeNormal));
    add(Uint8Array.from(CMD.boldOff));
    if (ticket.store.address) wrap(ticket.store.address, cols).forEach(function (l) { add(line(center(l, cols))); });
    if (ticket.store.phone) add(line(center('Telp ' + ticket.store.phone, cols)));
    if (ticket.store.header) wrap(ticket.store.header, cols).forEach(function (l) { add(line(center(l, cols))); });
    add(line(divider(cols)));

    // ---------- informasi transaksi
    add(Uint8Array.from(CMD.alignLeft));
    addRow('No', ticket.meta.invoice);
    addRow('Tanggal', (ticket.meta.date || '') + ' ' + (ticket.meta.time || ''));
    addRow('Kasir', ticket.meta.cashier || '-');
    if (ticket.meta.outlet) addRow('Outlet', ticket.meta.outlet);
    if (ticket.meta.customer) addRow('Pelanggan', ticket.meta.customer);
    if (ticket.meta.note) wrap('Catatan: ' + ticket.meta.note, cols).forEach(function (l) { add(line(l)); });
    add(line(divider(cols)));

    // ---------- item
    (ticket.items || []).forEach(function (item) {
      wrap(item.name, cols).forEach(function (l) { add(line(l)); });
      addRow('  ' + num(item.qty) + ' x ' + rupiah(item.price), rupiah(item.total));
    });
    add(line(divider(cols)));

    // ---------- total
    addRow('Subtotal', rupiah(ticket.totals.subtotal));
    if (ticket.totals.promoDiscount > 0) {
      addRow('Promo' + (ticket.totals.promoLabel ? ' ' + ticket.totals.promoLabel : ''), '-' + rupiah(ticket.totals.promoDiscount));
    }
    if (ticket.totals.pointsValue > 0) {
      addRow('Poin ' + num(ticket.totals.pointsUsed, 0), '-' + rupiah(ticket.totals.pointsValue));
    }
    add(Uint8Array.from(CMD.boldOn));
    add(Uint8Array.from(CMD.sizeTall));
    addRow('TOTAL', rupiah(ticket.totals.total));
    add(Uint8Array.from(CMD.sizeNormal));
    add(Uint8Array.from(CMD.boldOff));
    addRow('Bayar', ticket.payment.label);
    if (ticket.payment.reference) addRow('Ref', ticket.payment.reference);
    if (ticket.totals.pointsEarned > 0) addRow('Poin didapat', '+' + num(ticket.totals.pointsEarned, 0));
    add(line(divider(cols)));

    // ---------- kaki
    add(Uint8Array.from(CMD.alignCenter));
    if (ticket.footer) wrap(ticket.footer, cols).forEach(function (l) { add(line(center(l, cols))); });
    if (ticket.reprint) {
      add(Uint8Array.from(CMD.boldOn));
      add(line(center('*** CETAK ULANG ***', cols)));
      add(Uint8Array.from(CMD.boldOff));
    }
    if (ticket.copyLabel) add(line(center(ticket.copyLabel, cols)));
    if (ticket.store.brand) add(line(center('Powered by ' + ticket.store.brand, cols)));

    // ---------- QRIS (opsional): QR pembayaran / referensi
    var payload = o.qrPayload || (o.qr && ticket.qris ? ticket.qris.payload : '');
    if (payload) {
      add(line(''));
      add(line(center('QRIS', cols)));
      add(qr(payload, { size: o.qrSize || 6, ecc: o.qrEcc || 'M' }));
      if (ticket.qris && ticket.qris.reference) add(line(center(ticket.qris.reference, cols)));
    }

    // ---------- penutup
    var feeds = typeof o.feed === 'number' ? o.feed : 3;
    for (var i = 0; i < feeds; i += 1) add(Uint8Array.from(CMD.feed));
    if (o.drawer) add(Uint8Array.from(CMD.drawer));
    if (o.cut !== false) add(Uint8Array.from(CMD.cut));
    return concat(parts);
  }

  /** Pecah byte menjadi potongan kecil (BLE default MTU 20 byte). */
  function chunk(bytes, size) {
    var step = Math.max(20, Number(size) || 180);
    var out = [];
    for (var i = 0; i < bytes.length; i += step) out.push(bytes.subarray(i, Math.min(bytes.length, i + step)));
    return out;
  }

  /** Pratinjau teks struk di layar (memakai model yang sama seperti printer). */
  function previewLines(ticket) {
    var cols = (ticket.paper && ticket.paper.cols) || 32;
    var out = [];
    var push = function (v) { out.push.apply(out, Array.isArray(v) ? v : [v]); };
    push(center(ticket.store.name.toUpperCase(), cols));
    if (ticket.store.address) wrap(ticket.store.address, cols).forEach(function (l) { push(center(l, cols)); });
    if (ticket.store.phone) push(center('Telp ' + ticket.store.phone, cols));
    if (ticket.store.header) wrap(ticket.store.header, cols).forEach(push);
    push(divider(cols));
    push(padLine('No', ticket.meta.invoice, cols));
    push(padLine('Tanggal', (ticket.meta.date || '') + ' ' + (ticket.meta.time || ''), cols));
    push(padLine('Kasir', ticket.meta.cashier || '-', cols));
    if (ticket.meta.customer) push(padLine('Pelanggan', ticket.meta.customer, cols));
    push(divider(cols));
    (ticket.items || []).forEach(function (item) {
      wrap(item.name, cols).forEach(push);
      push(padLine('  ' + num(item.qty) + ' x ' + rupiah(item.price), rupiah(item.total), cols));
    });
    push(divider(cols));
    push(padLine('Subtotal', rupiah(ticket.totals.subtotal), cols));
    if (ticket.totals.promoDiscount > 0) push(padLine('Promo', '-' + rupiah(ticket.totals.promoDiscount), cols));
    if (ticket.totals.pointsValue > 0) push(padLine('Poin', '-' + rupiah(ticket.totals.pointsValue), cols));
    push(padLine('TOTAL', rupiah(ticket.totals.total), cols));
    push(padLine('Bayar', ticket.payment.label, cols));
    if (ticket.payment.reference) push(padLine('Ref', ticket.payment.reference, cols));
    push(divider(cols));
    if (ticket.footer) wrap(ticket.footer, cols).forEach(function (l) { push(center(l, cols)); });
    return out;
  }

  var API = {
    CMD: CMD, build: build, qr: qr, chunk: chunk, wrap: wrap, padLine: padLine, center: center,
    divider: divider, plain: plain, asciiBytes: asciiBytes, rupiah: rupiah, num: num,
    previewLines: previewLines, concat: concat,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.OndewayReceipt = API;
}(typeof window !== 'undefined' ? window : null));
