/* BizDash client behaviours: nav, filters, POS cart */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    const toggle = e.target.closest('[data-menu-toggle]');
    if (toggle) {
      document.getElementById('sidebar').classList.toggle('is-open');
      return;
    }
    if (!e.target.closest('.sidebar')) {
      const sb = document.getElementById('sidebar');
      if (sb && sb.classList.contains('is-open') && !e.target.closest('[data-menu-toggle]')) {
        sb.classList.remove('is-open');
      }
    }
  });

  initTheme();

  function initTheme() {
    var root = document.documentElement;
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    function current() {
      return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    function sync() {
      var theme = current();
      toggles.forEach(function (btn) {
        btn.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
        btn.title = theme === 'dark' ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';
      });
      document.querySelectorAll('[data-theme-label]').forEach(function (el) {
        el.textContent = theme === 'dark' ? 'Mode gelap' : 'Mode terang';
      });
    }
    function apply(theme, persist) {
      root.classList.add('theme-anim');
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
      if (persist) {
        try { localStorage.setItem('bizdash-theme', theme); } catch (e) {}
      }
      sync();
      window.setTimeout(function () { root.classList.remove('theme-anim'); }, 360);
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    }
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(current() === 'dark' ? 'light' : 'dark', true);
        btn.blur();
      });
    });
    sync();
    // ikuti perubahan tema sistem bila pengguna belum memilih manual
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (e) {
        var saved = null;
        try { saved = localStorage.getItem('bizdash-theme'); } catch (err) {}
        if (!saved) apply(e.matches ? 'dark' : 'light', false);
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    // sinkron antar tab
    window.addEventListener('storage', function (e) {
      if (e.key === 'bizdash-theme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        apply(e.newValue, false);
      }
    });
  }

  document.querySelectorAll('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () {
      const form = el.closest('form');
      if (form) form.submit();
    });
  });

  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  initPos();
  initPrint();
  initCopy();
  initSheets();
  initPWA();
  initPosPrinting();
  initProfileTabs();
  initFinanceTabs();
  initPromoForms();
  initBoot();
  initSidebarCollapse();
  initParallax();
  initGantt();
  initMaterialForms();
  initOrgChart();

  // ---------- Loading transition (logo brand berdenyut) ----------
  // Tampil sekali per sesi: skrip di <head> sudah menandai html.booted untuk kunjungan
  // berikutnya, jadi tidak ada kedipan overlay saat berpindah halaman.
  function initBoot() {
    var boot = document.querySelector('[data-boot]');
    if (!boot) return;
    if (document.documentElement.classList.contains('booted')) return;
    var MIN_MS = 520;
    var MAX_MS = 1800;
    var started = (window.performance && performance.now) ? performance.now() : Date.now();
    var done = false;
    try { sessionStorage.setItem('bizdash-booted', '1'); } catch (e) {}

    function finish() {
      if (done) return;
      done = true;
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var wait = Math.max(0, MIN_MS - (now - started));
      window.setTimeout(function () {
        boot.classList.add('is-done');
        window.setTimeout(function () {
          if (boot.parentNode) boot.parentNode.removeChild(boot);
        }, 400);
      }, wait);
    }

    window.setTimeout(finish, MAX_MS);
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
  }

  // ---------- Sidebar: ciutkan / bentangkan (desktop) ----------
  // Status disimpan di localStorage dan dipulihkan skrip <head> agar tidak berkedip.
  function initSidebarCollapse() {
    var btn = document.querySelector('[data-sidebar-toggle]');
    if (!btn) return;
    var root = document.documentElement;

    function sync() {
      var collapsed = root.getAttribute('data-sidebar') === 'collapsed';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-label', collapsed ? 'Bentangkan menu' : 'Ciutkan menu');
      btn.title = collapsed ? 'Bentangkan menu' : 'Ciutkan menu';
    }

    btn.addEventListener('click', function () {
      var collapsed = root.getAttribute('data-sidebar') === 'collapsed';
      if (collapsed) root.removeAttribute('data-sidebar');
      else root.setAttribute('data-sidebar', 'collapsed');
      try { localStorage.setItem('bizdash-sidebar', collapsed ? 'open' : 'collapsed'); } catch (e) {}
      sync();
      btn.blur();
    });

    sync();
  }

  // ---------- Parallax ringan pada hero halaman utama ----------
  // Hanya menggeser layer dekoratif; konten hero tidak ikut bergerak agar tetap terbaca.
  function initParallax() {
    var hero = document.querySelector('[data-parallax]');
    if (!hero || !window.requestAnimationFrame) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce && reduce.matches) return;

    var queued = false;
    function paint() {
      queued = false;
      var rect = hero.getBoundingClientRect();
      var offset = Math.max(0, Math.min(260, -rect.top));
      hero.style.setProperty('--par-y', offset.toFixed(1) + 'px');
    }
    function queue() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    paint();
  }


  // ---------- Timeline proyek: geser bar (ubah tanggal) & tarik ujung (ubah durasi) ----------
  // Semua perubahan dikirim ke server dan divalidasi ulang di sana; UI hanya pratinjau.
  function initGantt() {
    var root = document.querySelector('[data-gantt]');
    if (!root) return;
    var DASH = Number(root.getAttribute('data-days')) || 28;
    var FROM = root.getAttribute('data-from') || '';
    var CSRF = root.getAttribute('data-csrf') || '';
    var CAN_WRITE = root.getAttribute('data-can-write') === '1';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var MOVE_TASK = root.getAttribute('data-move-task') || '';
    var MOVE_RACI = root.getAttribute('data-move-raci') || '';

    function parse(iso) {
      var p = String(iso).split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    function toIso(d) {
      var m = String(d.getMonth() + 1); var day = String(d.getDate());
      return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
    }
    function addDays(iso, n) {
      var d = parse(iso); d.setDate(d.getDate() + n); return toIso(d);
    }
    function diffDays(a, b) {
      return Math.round((parse(b) - parse(a)) / 86400000);
    }
    function label(iso) {
      var d = parse(iso);
      return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }

    var note = document.createElement('p');
    note.className = 'hint-text gantt-note';
    note.hidden = true;
    root.parentNode.insertBefore(note, root.nextSibling);
    function say(msg, isError) {
      note.textContent = msg || '';
      note.hidden = !msg;
      note.classList.toggle('is-error', !!isError);
    }

    function place(bar, start, end) {
      var s = Math.max(0, Math.min(DASH, diffDays(FROM, start)));
      var e = Math.max(s, Math.min(DASH - 1, diffDays(FROM, end)));
      bar.style.left = (s / DASH * 100).toFixed(3) + '%';
      bar.style.width = (Math.max(1, e - s + 1) / DASH * 100).toFixed(3) + '%';
    }

    function paint(row, start, end) {
      var bar = row.querySelector('[data-gantt-bar]');
      if (!bar) return;
      place(bar, start, end);
      var span = diffDays(start, end) + 1;
      var labelEl = bar.querySelector('.gantt-label');
      if (labelEl) labelEl.textContent = span + 'h';
      var rangeEl = row.querySelector('.gantt-range');
      if (rangeEl) {
        rangeEl.textContent = label(start) + ' → ' + label(end) + ' · ' + span + ' hari · ' +
          Math.round(Number(row.getAttribute('data-progress')) || 0) + '%';
      }
    }

    var rows = Array.prototype.slice.call(root.querySelectorAll('[data-task]'));
    rows.forEach(function (row) {
      var bar = row.querySelector('[data-gantt-bar]');
      var track = row.querySelector('[data-gantt-track]');
      if (!bar || !track) return;

      function dayWidth() {
        var w = track.getBoundingClientRect().width || 0;
        return w / DASH;
      }

      function persist(source, start, end) {
        var tpl = source === 'raci' ? MOVE_RACI : MOVE_TASK;
        if (!tpl) return Promise.resolve({ ok: false, error: 'Endpoint tidak tersedia.' });
        var url = tpl.replace('__ID__', row.getAttribute('data-id'));
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ _csrf: CSRF, start: start, end: end }),
        }).then(function (res) {
          return res.json().catch(function () { return { ok: false, error: 'Balasan server tidak valid.' }; });
        }).catch(function (err) {
          return { ok: false, error: 'Tidak dapat menyimpan: ' + err.message };
        });
      }

      function commit(start, end, previousStart, previousEnd) {
        say('Menyimpan…');
        persist(row.getAttribute('data-source'), start, end).then(function (out) {
          if (!out.ok) {
            row.setAttribute('data-start', previousStart);
            row.setAttribute('data-end', previousEnd);
            paint(row, previousStart, previousEnd);
            say(out.error || 'Gagal menyimpan tanggal.', true);
            return;
          }
          row.setAttribute('data-start', out.start);
          row.setAttribute('data-end', out.end);
          paint(row, out.start, out.end);
          say('Tanggal tersimpan: ' + label(out.start) + ' → ' + label(out.end) + '.');
        });
      }

      if (CAN_WRITE) {
        bar.addEventListener('pointerdown', function (e) {
          if (e.button !== 0 || e.target.closest('[data-gantt-resize]')) return;
          e.preventDefault();
          startDrag(e, 'move');
        });
        var handle = bar.querySelector('[data-gantt-resize]');
        if (handle) {
          handle.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            startDrag(e, 'resize');
          });
        }

        // Tanpa mouse: fokus bar lalu ArrowLeft/Right untuk menggeser, Shift+Arrow ubah durasi.
        bar.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          var step = e.key === 'ArrowRight' ? 1 : -1;
          var start = row.getAttribute('data-start');
          var end = row.getAttribute('data-end');
          if (e.shiftKey) {
            var newEnd = addDays(end, step);
            if (newEnd < start) return;
            commit(start, newEnd, start, end);
          } else {
            commit(addDays(start, step), addDays(end, step), start, end);
          }
        });
      }

      function startDrag(e, mode) {
        var x0 = e.clientX;
        var start0 = row.getAttribute('data-start');
        var end0 = row.getAttribute('data-end');
        var delta = 0;
        bar.classList.add('is-dragging');
        row.classList.add('is-dragging');
        try { bar.setPointerCapture(e.pointerId); } catch (err) { /* bukan pointer event */ }

        function onMove(ev) {
          var dw = dayWidth();
          delta = dw > 0 ? Math.round((ev.clientX - x0) / dw) : 0;
          if (mode === 'move') {
            place(bar, addDays(start0, delta), addDays(end0, delta));
          } else {
            var newEnd = addDays(end0, delta);
            place(bar, start0, newEnd < start0 ? start0 : newEnd);
          }
        }
        function onUp() {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          bar.classList.remove('is-dragging');
          row.classList.remove('is-dragging');
          if (!delta) { paint(row, start0, end0); return; }
          if (mode === 'move') {
            commit(addDays(start0, delta), addDays(end0, delta), start0, end0);
          } else {
            var newEnd = addDays(end0, delta);
            commit(start0, newEnd < start0 ? start0 : newEnd, start0, end0);
          }
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      }
    });
  }

  // Form materi LMS: field URL hanya relevan untuk video / PDF.
  function initMaterialForms() {
    document.querySelectorAll('[data-material-form]').forEach(function (form) {
      var select = form.querySelector('[data-mat-kind]');
      if (!select) return;
      function sync() {
        var kind = select.value;
        form.querySelectorAll('[data-mat-field]').forEach(function (el) {
          el.hidden = el.getAttribute('data-mat-field') === 'url' && kind === 'text';
        });
        form.querySelectorAll('[data-mat-hint]').forEach(function (el) {
          el.hidden = kind === 'text';
        });
        var url = form.querySelector('input[name="url"]');
        if (url) url.required = kind !== 'text';
      }
      select.addEventListener('change', sync);
      sync();
    });
  }

  function rupiah(n) {
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  // Tombol "salin" (mis. tautan reset password di /admin)
  // ---------- Printer thermal (Web Bluetooth) + struk ----------
  function initPosPrinting() {
    var receipt = window.OndewayReceipt;
    var printer = window.OndewayPrinter;
    var host = document.getElementById('pos') || document.getElementById('receipt-print');
    if (!host || !receipt || !printer) return;

    var KEY = 'bizdash-receipt';
    var serverWidth = Number(host.dataset.receiptWidth) || 58;
    var defaults = {
      width: serverWidth,
      auto: host.dataset.receiptAuto === '1',
      qr: true,
      chunk: 100,
    };
    var prefs = (function () {
      try {
        var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
        return Object.assign({}, defaults, raw);
      } catch (e) { return defaults; }
    })();
    function savePrefs() {
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* mode privat */ }
    }

    function el(sel) { return document.querySelector(sel); }
    function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

    function setBusyUI(msg) {
      all('[data-printer-error]').forEach(function (node) {
        if (msg) { node.textContent = msg; node.hidden = false; }
        else { node.textContent = ''; node.hidden = true; }
      });
    }

    function paint(state) {
      var wrapper = el('[data-printer-state]');
      if (wrapper) {
        wrapper.classList.toggle('is-on', !!state.connected);
        wrapper.classList.toggle('is-busy', !!state.busy);
        wrapper.classList.toggle('is-error', !!state.lastError && !state.connected);
      }
      all('[data-printer-name]').forEach(function (node) {
        node.textContent = state.connected ? (state.name || 'Printer thermal') : (state.busy ? 'Mengirim struk…' : 'Printer belum terhubung');
      });
      all('[data-printer-hint]').forEach(function (node) {
        node.textContent = state.connected
          ? (state.busy ? 'Mencetak struk…' : 'Siap mencetak struk ' + prefs.width + ' mm')
          : (state.supported ? 'Hubungkan printer thermal 58/80 mm via Bluetooth.' : 'Browser ini tanpa Web Bluetooth — pakai cetak via browser.');
      });
      var chip = el('[data-printer-open]');
      var chipLabel = el('[data-printer-chip-label]');
      if (chip) {
        chip.classList.toggle('is-on', !!state.connected);
        chip.classList.toggle('is-busy', !!state.busy);
        chip.classList.toggle('is-error', !!state.lastError && !state.connected);
      }
      if (chipLabel) chipLabel.textContent = state.connected ? 'Printer siap' : (state.busy ? 'Mencetak…' : 'Printer');
      if (state.lastError) setBusyUI(state.lastError);
    }

    printer.onChange(paint);

    function modal(open) {
      var box = document.getElementById('printer-modal');
      var scrim = document.querySelector('.pos-modal-scrim');
      if (!box) return;
      box.hidden = !open;
      if (scrim) scrim.hidden = !open;
    }

    all('[data-printer-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { modal(true); });
    });
    all('[data-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { modal(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') modal(false);
    });

    function connect() {
      setBusyUI('');
      printer.connect().then(function () {
        setBusyUI('');
      }).catch(function (err) {
        if (printer.supported()) setBusyUI(err && err.message ? err.message : 'Gagal menghubungkan printer.');
        else setBusyUI('Web Bluetooth tidak tersedia di browser ini. Gunakan Chrome di Android/desktop, atau cetak lewat dialog browser.');
      });
    }

    all('[data-printer-connect]').forEach(function (btn) { btn.addEventListener('click', connect); });
    all('[data-printer-disconnect]').forEach(function (btn) {
      btn.addEventListener('click', function () { printer.disconnect(); });
    });

    function printModel(ticket, extra) {
      var opts = Object.assign({
        width: prefs.width,
        qr: prefs.qr && !!(ticket.qris && ticket.qris.payload),
        qrPayload: prefs.qr && ticket.qris ? ticket.qris.payload : '',
        drawer: ticket.payment && ticket.payment.method === 'cash',
      }, extra || {});
      // lebar kertas mengikuti preferensi kasir
      ticket.paper = Object.assign({}, ticket.paper, { mm: prefs.width, cols: prefs.width === 80 ? 48 : 32 });
      return printer.print(ticket, opts).then(function () {
        setBusyUI('');
        if (opts.silent !== true) {
          var hint = el('[data-printer-hint]');
          if (hint) hint.textContent = 'Struk terkirim ke printer.';
        }
        return true;
      });
    }

    function fetchTicket(id) {
      var tpl = host.dataset.ticketUrl || '';
      var url = tpl ? tpl.replace('__ID__', String(id)) : '';
      if (!url) return Promise.reject(new Error('URL struk tidak tersedia.'));
      return fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) throw new Error(data.error || 'Struk tidak ditemukan.');
          return data.ticket;
        });
    }

    function ensureConnected() {
      if (printer.status().connected) return Promise.resolve(true);
      return printer.reconnect().then(function (ok) { return !!ok; });
    }

    function printById(id, opts) {
      setBusyUI('');
      return ensureConnected().then(function (connected) {
        if (!connected) {
          setBusyUI('Printer belum terhubung. Klik “Hubungkan printer” lalu pilih perangkat thermal Anda.');
          return false;
        }
        return fetchTicket(id).then(function (ticket) { return printModel(ticket, opts); });
      }).catch(function (err) {
        setBusyUI(err && err.message ? err.message : 'Gagal mencetak struk.');
        return false;
      });
    }

    all('[data-print-last]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = host.dataset.lastSale || '';
        if (!id) return;
        if (!printer.supported()) {
          setBusyUI('Web Bluetooth tidak tersedia. Buka halaman struk untuk mencetak lewat dialog browser.');
          modal(true);
          return;
        }
        printById(id, { reprint: true });
      });
    });

    all('[data-print-bluetooth]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = host.dataset.ticketId;
        if (!id) return;
        printById(id, { reprint: true });
      });
    });
    all('[data-print-browser]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.print(); });
    });
    all('[data-printer-test]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sample = {
          paper: { cols: prefs.width === 80 ? 48 : 32, mm: prefs.width },
          store: { name: 'TES PRINTER', address: '', phone: '', header: '', brand: 'Ondeway' },
          meta: { invoice: 'TEST-001', date: 'Hari ini', time: new Date().toTimeString().slice(0, 5), cashier: 'Kasir', outlet: '', customer: '', note: '' },
          items: [{ name: 'Contoh item', qty: 1, price: 10000, total: 10000 }],
          totals: { subtotal: 10000, promoDiscount: 0, pointsUsed: 0, pointsValue: 0, pointsEarned: 0, total: 10000 },
          payment: { label: 'Tunai', reference: '', method: 'cash' },
          footer: 'Tes cetak berhasil',
          qris: null,
        };
        ensureConnected().then(function (ok) {
          if (!ok) { setBusyUI('Hubungkan printer terlebih dahulu.'); return; }
          printModel(sample, { qr: false, drawer: false });
        }).catch(function (err) { setBusyUI(err && err.message ? err.message : 'Gagal tes cetak.'); });
      });
    });

    // preferensi lebar kertas / cetak otomatis
    all('[data-receipt-width-select]').forEach(function (sel) {
      sel.value = String(prefs.width);
      sel.addEventListener('change', function () {
        prefs.width = Number(sel.value) === 80 ? 80 : 58;
        savePrefs();
        all('[data-receipt-width-select]').forEach(function (other) { other.value = String(prefs.width); });
        paint(printer.status());
      });
    });
    all('[data-receipt-auto]').forEach(function (box) {
      box.checked = !!prefs.auto;
      box.addEventListener('change', function () { prefs.auto = !!box.checked; savePrefs(); });
    });
    all('[data-receipt-qr]').forEach(function (box) {
      box.checked = prefs.qr !== false;
      box.addEventListener('change', function () {
        prefs.qr = !!box.checked;
        savePrefs();
        all('[data-receipt-qr]').forEach(function (other) { other.checked = prefs.qr; });
      });
    });
    all('[data-printer-chunk]').forEach(function (sel) {
      sel.value = String(prefs.chunk || 100);
      sel.addEventListener('change', function () { prefs.chunk = Number(sel.value) || 100; savePrefs(); });
    });

    // cetak otomatis setelah transaksi (hanya bila printer tersambung/izin tersimpan)
    var lastId = host.dataset.lastSale;
    if (lastId && prefs.auto && printer.supported()) {
      setTimeout(function () { printById(lastId, { reprint: false, silent: false }); }, 900);
    }
  }

  // ---------- Bottom sheet "Menu" (navigasi mobile) ----------
  function initSheets() {
    var openSheet = null;
    var lastFocus = null;

    function close() {
      if (!openSheet) return;
      var sheet = document.getElementById(openSheet);
      var scrim = document.querySelector('.sheet-scrim');
      if (sheet) sheet.hidden = true;
      if (scrim) scrim.hidden = true;
      document.body.classList.remove('sheet-open');
      document.querySelectorAll('[data-sheet-open]').forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      openSheet = null;
    }

    function open(id, trigger) {
      var sheet = document.getElementById(id);
      if (!sheet) return;
      lastFocus = trigger || document.activeElement;
      sheet.hidden = false;
      var scrim = document.querySelector('.sheet-scrim');
      if (scrim) scrim.hidden = false;
      document.body.classList.add('sheet-open');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
      openSheet = id;
      var first = sheet.querySelector('a, button, [tabindex]');
      if (first && first.focus) setTimeout(function () { first.focus(); }, 60);
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-sheet-open]');
      if (trigger) {
        e.preventDefault();
        var id = trigger.getAttribute('data-sheet-open');
        if (openSheet === id) close(); else { close(); open(id, trigger); }
        return;
      }
      if (e.target.closest('[data-sheet-close]')) { close(); return; }
      // klik tautan di dalam sheet → tutup supaya transisi halaman bersih
      if (openSheet && e.target.closest('.sheet a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openSheet) close();
    });

    // geser ke bawah untuk menutup
    var sheetEls = document.querySelectorAll('.sheet');
    sheetEls.forEach(function (sheet) {
      var startY = null;
      sheet.addEventListener('touchstart', function (e) {
        if (!e.touches.length) return;
        startY = e.touches[0].clientY;
      }, { passive: true });
      sheet.addEventListener('touchmove', function (e) {
        if (startY === null || !e.touches.length) return;
        var dy = e.touches[0].clientY - startY;
        sheet.style.transform = dy > 0 ? 'translateY(' + dy + 'px)' : '';
      }, { passive: true });
      sheet.addEventListener('touchend', function () {
        var shifted = parseFloat((sheet.style.transform.match(/translateY\(([-0-9.]+)px\)/) || [])[1] || 0);
        sheet.style.transform = '';
        startY = null;
        if (shifted > 90) close();
      });
    });
  }

  // ---------- PWA: service worker + tombol "Pasang aplikasi" ----------
  function initPWA() {
    var baseMeta = document.querySelector('meta[name="app-base"]');
    var base = baseMeta ? baseMeta.getAttribute('content') : '';
    var standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (standalone) document.documentElement.classList.add('is-standalone');

    var secure = location.protocol === 'https:'
      || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && secure) {
      var register = function () {
        navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' }).catch(function () { /* diabaikan */ });
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register);
    }

    var deferred = null;
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    function showButtons(show) {
      document.querySelectorAll('[data-install]').forEach(function (btn) {
        if (show) btn.removeAttribute('hidden'); else btn.setAttribute('hidden', '');
      });
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      showButtons(true);
    });

    window.addEventListener('appinstalled', function () {
      deferred = null;
      showButtons(false);
      document.documentElement.classList.add('is-installed');
      var card = document.querySelector('.install-card small');
      if (card) card.textContent = 'Aplikasi sudah terpasang di perangkat ini';
    });

    function openSheetIfNeeded() {
      var sheet = document.getElementById('app-sheet');
      if (sheet && sheet.hidden) {
        var trigger = document.querySelector('[data-sheet-open="app-sheet"]');
        if (trigger) trigger.click();
      }
    }

    // Panduan manual untuk iOS/Safari (tidak ada beforeinstallprompt)
    function iosHint() {
      var sheet = document.getElementById('app-sheet');
      if (!sheet) return;
      var box = sheet.querySelector('.sheet-install');
      if (!box) return;
      var note = box.querySelector('.install-hint');
      if (!note) {
        note = document.createElement('p');
        note.className = 'install-hint';
        box.appendChild(note);
      }
      note.innerHTML = isIOS
        ? 'Di iPhone/iPad: ketuk <b>Bagikan</b> di Safari, lalu pilih <b>Tambah ke Layar Utama</b>.'
        : 'Di browser ini: buka menu <b>⋮</b> lalu pilih <b>Pasang aplikasi</b> / <b>Tambahkan ke Layar Utama</b>.';
      box.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-install]');
      if (!btn) return;
      e.preventDefault();
      if (deferred && deferred.prompt) {
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; }).catch(function () {});
        return;
      }
      if (standalone) return;
      if (isIOS) { openSheetIfNeeded(); iosHint(); return; }
      var small = btn.querySelector('small');
      if (small) {
        openSheetIfNeeded();
        small.textContent = 'Buka menu browser (⋮) → “Pasang aplikasi / Tambah ke Layar Utama”.';
      } else {
        openSheetIfNeeded();
        iosHint();
      }
    });

    if (isIOS && !standalone) showButtons(true);
  }

  function initCopy() {
    document.querySelectorAll('[data-copy-from]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.querySelector(btn.getAttribute('data-copy-from'));
        if (!input) return;
        input.select();
        var labelEl = btn.querySelector('[data-copy-label]') || btn;
        var original = labelEl.textContent;
        var done = function () {
          labelEl.textContent = 'Tautan disalin';
          setTimeout(function () { labelEl.textContent = original; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(input.value).then(done, done);
        } else {
          try { document.execCommand('copy'); } catch (err) { /* abaikan */ }
          done();
        }
      });
    });
  }

  function initPos() {
    const root = document.getElementById('pos');
    if (!root) return;

    const pointValue = Number(root.dataset.pointValue) || 100;
    const pointEarn = Number(root.dataset.pointEarn) || 10000;
    const quoteUrl = root.dataset.quoteUrl;
    const csrf = (document.querySelector('#pos-form input[name="_csrf"]') || {}).value || '';
    const state = { items: [], quote: null, code: '' };

    const linesEl = document.getElementById('cart-lines');
    const emptyEl = document.getElementById('cart-empty');
    const subEl = document.getElementById('cart-subtotal');
    const promoEl = document.getElementById('cart-promo');
    const pointsEl = document.getElementById('cart-points');
    const totalEl = document.getElementById('cart-total');
    const earnRow = document.getElementById('earn-row');
    const earnEl = document.getElementById('cart-earn');
    const hidden = document.getElementById('cart-payload');
    const countEl = document.getElementById('cart-count');
    const barCount = document.getElementById('pos-cartbar-count');
    const barTotal = document.getElementById('pos-cartbar-total');
    const barJump = document.querySelector('[data-cart-jump]');
    if (barJump) {
      barJump.addEventListener('click', function () {
        var cart = document.getElementById('pos-cart');
        if (cart) cart.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    const customerSelect = document.getElementById('pos-customer');
    const badge = document.getElementById('customer-badge');
    const pointsInput = document.getElementById('points-input');
    const pointsMax = document.getElementById('points-max');
    const promoInput = document.getElementById('promo-code');
    const promoClear = document.getElementById('promo-clear');
    const noteEl = document.getElementById('quote-note');
    const checkoutBtn = document.getElementById('checkout-btn');
    const companySelect = document.querySelector('select[name="company_id"]');

    function rupiah(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
    function angka(n) { return Number(n || 0).toLocaleString('id-ID'); }

    function selectedCustomer() {
      const opt = customerSelect.options[customerSelect.selectedIndex];
      if (!opt || !opt.value) return null;
      return { id: Number(opt.value), type: opt.dataset.type, tier: opt.dataset.tier, points: Number(opt.dataset.points) || 0 };
    }

    function tierLabel(tier) {
      return { retail: 'Retail', grosir: 'Grosir', distributor: 'Distributor' }[tier] || tier;
    }

    function priceFor(btn, customer) {
      if (!customer) return Number(btn.dataset.price);
      if (customer.type === 'b2b') {
        if (customer.tier === 'distributor' && Number(btn.dataset.distributor)) return Number(btn.dataset.distributor);
        if (customer.tier === 'grosir' && Number(btn.dataset.grosir)) return Number(btn.dataset.grosir);
      }
      return Number(btn.dataset.price);
    }

    function refreshPrices() {
      const customer = selectedCustomer();
      document.querySelectorAll('[data-add-product]').forEach(function (btn) {
        const label = btn.querySelector('[data-price-label]');
        if (label) label.textContent = rupiah(priceFor(btn, customer));
      });
      if (!customer) {
        badge.hidden = true;
        pointsInput.disabled = true;
        pointsMax.disabled = true;
        pointsInput.value = 0;
      } else {
        badge.hidden = false;
        badge.innerHTML = customer.type === 'b2b'
          ? '<b>B2B</b> · harga ' + tierLabel(customer.tier) + ' otomatis'
          : '<b>Member B2C</b> · saldo ' + angka(customer.points) + ' poin (≈ ' + rupiah(customer.points * pointValue) + ')';
        pointsInput.disabled = customer.points <= 0;
        pointsMax.disabled = customer.points <= 0;
        pointsInput.max = customer.points;
      }
    }

    function syncBarCount() {
      if (!barCount) return;
      barCount.textContent = String((state.items || []).reduce(function (n, i) { return n + i.qty; }, 0));
    }

    function renderLines() {
      syncBarCount();
      linesEl.innerHTML = '';
      state.items.forEach(function (it, idx) {
        const row = document.createElement('div');
        row.className = 'cart-line';
        row.innerHTML =
          '<div><div class="cl-name"></div><div class="cl-price">' + rupiah(it.price) + ' × ' + it.qty + '</div></div>' +
          '<div class="qty-ctrl"><button type="button" data-act="dec" data-i="' + idx + '">−</button>' +
          '<span>' + it.qty + '</span>' +
          '<button type="button" data-act="inc" data-i="' + idx + '">+</button></div>' +
          '<div class="num" style="font-weight:600;font-size:12.5px">' + rupiah(it.price * it.qty) + '</div>';
        row.querySelector('.cl-name').textContent = it.name;
        linesEl.appendChild(row);
      });
      emptyEl.style.display = state.items.length ? 'none' : 'block';
      countEl.textContent = state.items.reduce(function (a, b) { return a + b.qty; }, 0);
      hidden.value = JSON.stringify(state.items.map(function (i) { return { id: i.id, qty: i.qty }; }));
      checkoutBtn.disabled = state.items.length === 0;
    }

    function renderQuote(q, error) {
      subEl.textContent = rupiah(q ? q.subtotal : 0);
      promoEl.textContent = '− ' + rupiah(q ? q.promoDiscount : 0);
      pointsEl.textContent = '− ' + rupiah(q ? q.pointsValue : 0);
      totalEl.textContent = rupiah(q ? q.total : 0);
      if (barTotal) barTotal.textContent = rupiah(q ? q.total : 0);
      if (barCount) barCount.textContent = String((state.items || []).reduce(function (n, i) { return n + i.qty; }, 0));
      if (q && q.pointsEarned > 0) {
        earnRow.hidden = false;
        earnEl.textContent = '+' + angka(q.pointsEarned) + ' poin';
      } else {
        earnRow.hidden = true;
      }
      const messages = [];
      if (q && q.promo) {
        messages.push('<span class="note-ok">Promo aktif: <b>' + q.promo.label + '</b> (− ' + rupiah(q.promo.discount) + ')</span>');
      } else if (q && q.available && q.available.length) {
        const best = q.available[0];
        messages.push('<span class="note-hint">' + (best.code ? 'Voucher tersedia: <b>' + best.code + '</b> (hemat ' + rupiah(best.discount) + ')' : 'Promo otomatis: <b>' + best.name + '</b> (hemat ' + rupiah(best.discount) + ')') + '</span>');
      }
      if (q && q.pointsUsed) messages.push('<span class="note-ok">' + angka(q.pointsUsed) + ' poin ditukar = ' + rupiah(q.pointsValue) + '</span>');
      if (error || (q && q.promoError)) messages.push('<span class="note-bad">' + (error || q.promoError) + '</span>');
      if (messages.length) {
        noteEl.hidden = false;
        noteEl.innerHTML = messages.join('<br>');
      } else {
        noteEl.hidden = true;
      }
      if (q) {
        if (pointsInput !== document.activeElement) pointsInput.value = q.pointsUsed || 0;
        pointsInput.max = q.maxPoints || 0;
        pointsInput.disabled = !q.customer || q.maxPoints <= 0;
        pointsMax.disabled = pointsInput.disabled;
      }
    }

    let quoteSeq = 0;
    function requestQuote() {
      const seq = ++quoteSeq;
      const payload = {
        _csrf: csrf,
        items: JSON.stringify(state.items.map(function (i) { return { id: i.id, qty: i.qty }; })),
        customer_id: customerSelect.value || '',
        promo_code: promoInput.value || '',
        points: pointsInput.value || 0,
        company_id: companySelect ? companySelect.value : '',
      };
      fetch(quoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (seq !== quoteSeq) return;
        if (!data.ok) {
          renderQuote(state.quote, data.error || 'Gagal menghitung keranjang.');
          return;
        }
        state.quote = data.quote;
        const byId = new Map(data.quote.lines.map(function (l) { return [l.productId, l]; }));
        state.items.forEach(function (it) {
          const line = byId.get(it.id);
          if (line) it.price = line.price;
        });
        renderLines();
        renderQuote(data.quote);
      }).catch(function () {
        renderQuote(state.quote, 'Tidak dapat menghubungi server.');
      });
    }

    document.querySelectorAll('[data-add-product]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = Number(btn.getAttribute('data-add-product'));
        const name = btn.getAttribute('data-name');
        const found = state.items.find(function (i) { return i.id === id; });
        if (found) found.qty += 1;
        else state.items.push({ id: id, name: name, price: priceFor(btn, selectedCustomer()), qty: 1 });
        renderLines();
        requestQuote();
      });
    });

    // Kartu paket bundling: tambahkan semua komponennya + isi kode promo paket (bila ada).
    document.querySelectorAll('[data-bundle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        let items = [];
        try { items = JSON.parse(btn.getAttribute('data-bundle') || '[]'); } catch (err) { items = []; }
        items.forEach(function (entry) {
          const tileBtn = document.querySelector('[data-add-product="' + entry.id + '"]');
          if (!tileBtn) return;
          const qty = Math.max(1, Number(entry.qty) || 1);
          const found = state.items.find(function (i) { return i.id === entry.id; });
          if (found) found.qty += qty;
          else state.items.push({ id: entry.id, name: tileBtn.getAttribute('data-name'), price: priceFor(tileBtn, selectedCustomer()), qty: qty });
        });
        const code = btn.getAttribute('data-bundle-code');
        if (code && promoInput) promoInput.value = code;
        renderLines();
        requestQuote();
      });
    });

    linesEl.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const idx = Number(btn.getAttribute('data-i'));
      const item = state.items[idx];
      if (!item) return;
      if (btn.getAttribute('data-act') === 'inc') item.qty += 1;
      else item.qty -= 1;
      if (item.qty <= 0) state.items.splice(idx, 1);
      renderLines();
      requestQuote();
    });

    customerSelect.addEventListener('change', function () {
      refreshPrices();
      pointsInput.value = 0;
      renderLines();
      requestQuote();
    });

    [pointsInput].forEach(function (el) {
      el.addEventListener('change', requestQuote);
    });
    pointsMax.addEventListener('click', function () {
      if (state.quote) {
        pointsInput.value = state.quote.maxPoints || 0;
        requestQuote();
      }
    });

    promoInput.addEventListener('change', requestQuote);
    promoInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); requestQuote(); }
    });
    promoClear.addEventListener('click', function () {
      promoInput.value = '';
      requestQuote();
    });
    if (companySelect) {
      companySelect.addEventListener('change', function () {
        state.items = [];
        renderLines();
        requestQuote();
      });
    }

    const search = document.getElementById('pos-search');
    const categorySelect = document.getElementById('pos-category');
    const railItems = document.querySelectorAll('[data-rail]');
    function applyFilter() {
      const q = (search.value || '').toLowerCase().trim();
      const cat = categorySelect.value;
      let visible = 0;
      document.querySelectorAll('[data-add-product]').forEach(function (btn) {
        const hay = (btn.getAttribute('data-name') + ' ' + (btn.getAttribute('data-sku') || '')).toLowerCase();
        const okSearch = !q || hay.indexOf(q) !== -1;
        const okCat = !cat || (btn.getAttribute('data-cat') || '') === cat;
        const show = okSearch && okCat;
        btn.style.display = show ? '' : 'none';
        if (show) visible += 1;
      });
      return visible;
    }
    if (search) search.addEventListener('input', applyFilter);
    if (categorySelect) {
      categorySelect.addEventListener('change', function () {
        railItems.forEach(function (r) { r.classList.toggle('is-active', (r.getAttribute('data-rail') || '') === categorySelect.value); });
        applyFilter();
      });
    }
    railItems.forEach(function (item) {
      item.addEventListener('click', function () {
        const cat = item.getAttribute('data-rail') || '';
        if (categorySelect) categorySelect.value = cat;
        railItems.forEach(function (r) { r.classList.toggle('is-active', r === item); });
        applyFilter();
      });
    });

    // ---------- QRIS: buat QR, pantau status, lalu simpan transaksi ----------
    const qrisReady = root.dataset.qrisReady === '1';
    const qrisCreateUrl = root.dataset.qrisCreate;
    const qrisStatusTpl = root.dataset.qrisStatus || '';
    const qrisProvider = root.dataset.qrisProvider || 'static';
    const form = document.getElementById('pos-form');
    const refInput = document.getElementById('qris-ref-input');
    const modal = document.getElementById('qris-modal');
    const qrisAmount = document.getElementById('qris-amount');
    const qrisImage = document.getElementById('qris-image');
    const qrisLoading = document.getElementById('qris-loading');
    const qrisRefLabel = document.getElementById('qris-modal-ref');
    const qrisStatusLabel = document.getElementById('qris-status-label');
    const qrisCountdown = document.getElementById('qris-countdown');
    const qrisError = document.getElementById('qris-error');
    const qrisMarkPaid = document.getElementById('qris-mark-paid');
    const qrisHint = document.getElementById('qris-hint');
    let qris = { ref: '', amount: 0, timer: null, poll: null, deadline: 0, submitting: false };

    function setQrisError(msg) {
      if (!qrisError) return;
      if (msg) { qrisError.textContent = msg; qrisError.hidden = false; }
      else { qrisError.textContent = ''; qrisError.hidden = true; }
    }

    function stopQrisTimers() {
      if (qris.timer) { clearInterval(qris.timer); qris.timer = null; }
      if (qris.poll) { clearInterval(qris.poll); qris.poll = null; }
    }

    function paintQris(data) {
      if (!data) return;
      qris.ref = data.reference;
      qris.amount = Number(data.amount) || 0;
      if (qrisAmount) qrisAmount.textContent = rupiah(qris.amount);
      if (qrisRefLabel) qrisRefLabel.textContent = data.reference;
      if (qrisStatusLabel) {
        qrisStatusLabel.textContent = data.statusLabel || data.status;
        qrisStatusLabel.className = data.status === 'paid' ? 'is-paid' : (data.status === 'pending' ? '' : 'is-failed');
      }
      if (qrisImage && data.imageUrl) {
        qrisImage.src = data.imageUrl;
        qrisImage.hidden = false;
        if (qrisLoading) qrisLoading.hidden = true;
      }
      if (qrisMarkPaid) qrisMarkPaid.hidden = !(data.manualConfirm && data.status === 'pending');
      if (qrisHint) qrisHint.dataset.ref = data.reference;
    }

    function closeQris() {
      stopQrisTimers();
      if (modal) modal.hidden = true;
      var scrim = document.querySelector('.pos-modal-scrim');
      if (scrim) scrim.hidden = true;
      if (checkoutBtn) checkoutBtn.disabled = !state.items.length;
    }

    function countdown() {
      if (!qris.deadline || !qrisCountdown) return;
      var left = Math.max(0, Math.round((qris.deadline - Date.now()) / 1000));
      var m = Math.floor(left / 60);
      var sec = left % 60;
      qrisCountdown.textContent = 'berlaku ' + m + ':' + String(sec).padStart(2, '0');
      if (left === 0) {
        qrisCountdown.textContent = 'kedaluwarsa';
        stopQrisTimers();
      }
    }

    function resetQris(silent) {
      var ref = qris.ref;
      stopQrisTimers();
      qris = { ref: '', amount: 0, timer: null, poll: null, deadline: 0, submitting: false };
      if (refInput) refInput.value = '';
      if (qrisImage) { qrisImage.hidden = true; qrisImage.removeAttribute('src'); }
      setQrisError('');
      if (ref && !silent) {
        fetch(qrisStatusTpl.replace('__REF__', encodeURIComponent(ref)) + '/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _csrf: csrf }),
        }).catch(function () {});
      }
    }

    function pollQris() {
      if (!qris.ref) return;
      fetch(qrisStatusTpl.replace('__REF__', encodeURIComponent(qris.ref)), { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok || !data.qris) return;
          paintQris(data.qris);
          if (data.qris.status === 'paid') {
            stopQrisTimers();
            if (refInput) refInput.value = data.qris.reference;
            qris.submitting = true;
            closeQris();
            if (form) form.submit();
          } else if (['expired', 'cancelled', 'failed'].includes(data.qris.status)) {
            stopQrisTimers();
            setQrisError('Pembayaran ' + (data.qris.statusLabel || data.qris.status) + '. Tutup lalu buat QR baru.');
          }
        })
        .catch(function () { /* jaringan putus: coba lagi pada interval berikutnya */ });
    }

    function startQris() {
      setQrisError('');
      if (modal) modal.hidden = false;
      var scrim = document.querySelector('.pos-modal-scrim');
      if (scrim) scrim.hidden = false;
      if (qrisLoading) qrisLoading.hidden = false;
      if (qrisImage) qrisImage.hidden = true;
      if (qrisMarkPaid) qrisMarkPaid.hidden = true;
      if (qrisAmount && state.quote) qrisAmount.textContent = rupiah(state.quote.total);
      if (qrisRefLabel) qrisRefLabel.textContent = '—';
      if (qrisStatusLabel) { qrisStatusLabel.textContent = 'Menyiapkan QR…'; qrisStatusLabel.className = ''; }
      if (qrisCountdown) qrisCountdown.textContent = '';
      if (checkoutBtn) checkoutBtn.disabled = true;

      var payload = {
        _csrf: csrf,
        items: JSON.stringify(state.items.map(function (i) { return { id: i.id, qty: i.qty }; })),
        customer_id: customerSelect.value || '',
        promo_code: promoInput.value || '',
        points: pointsInput.value || 0,
        company_id: companySelect ? companySelect.value : '',
      };
      fetch(qrisCreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data.ok) {
          if (qrisLoading) qrisLoading.hidden = true;
          setQrisError(data.error || 'Gagal membuat QRIS.');
          if (qrisStatusLabel) qrisStatusLabel.textContent = 'Gagal';
          if (checkoutBtn) checkoutBtn.disabled = false;
          return;
        }
        paintQris(data.qris);
        qris.deadline = data.qris.expiresAt ? new Date(String(data.qris.expiresAt).replace(' ', 'T') + '+07:00').getTime() : Date.now() + 15 * 60000;
        countdown();
        qris.timer = setInterval(countdown, 1000);
        qris.poll = setInterval(pollQris, 3000);
      }).catch(function (err) {
        if (qrisLoading) qrisLoading.hidden = true;
        setQrisError('Tidak bisa menghubungi server: ' + err.message);
        if (checkoutBtn) checkoutBtn.disabled = false;
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        if (qris.submitting) return;
        var method = (document.querySelector('input[name="payment_method"]:checked') || {}).value || 'cash';
        if (method !== 'qris' || !qrisReady || (refInput && refInput.value)) return;
        if (!state.items.length) return; // biarkan validasi bawaan
        e.preventDefault();
        startQris();
      });
    }

    document.querySelectorAll('input[name="payment_method"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.value !== 'qris' && qris.ref) resetQris(true);
      });
    });

    function cancelQrisModal() {
      if (!modal || modal.hidden || qris.submitting) return;
      resetQris(false);
      closeQris();
    }

    if (modal) {
      modal.querySelectorAll('[data-qris-cancel]').forEach(function (btn) {
        btn.addEventListener('click', cancelQrisModal);
      });
    }
    // scrim & tombol Escape juga membatalkan QR yang belum dibayar
    document.addEventListener('click', function (e) {
      if (e.target.classList && e.target.classList.contains('pos-modal-scrim')) cancelQrisModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') cancelQrisModal();
    });

    if (qrisMarkPaid) {
      qrisMarkPaid.addEventListener('click', function () {
        if (!qris.ref) return;
        qrisMarkPaid.disabled = true;
        fetch(qrisStatusTpl.replace('__REF__', encodeURIComponent(qris.ref)) + '/paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _csrf: csrf }),
        }).then(function (r) { return r.json(); }).then(function (data) {
          qrisMarkPaid.disabled = false;
          if (!data.ok) { setQrisError(data.error || 'Gagal menandai lunas.'); return; }
          paintQris(data.qris);
          pollQris();
        }).catch(function () { qrisMarkPaid.disabled = false; });
      });
    }

    // nominal berubah setelah QR lunas → batalkan agar tidak salah nota
    var origRenderQuote = renderQuote;
    renderQuote = function (q, error) {
      origRenderQuote(q, error);
      if (qris.ref && q && Math.abs(Number(q.total) - qris.amount) > 0.5) {
        resetQris(false);
        closeQris();
        if (noteEl) {
          noteEl.hidden = false;
          noteEl.innerHTML = '<span class="note-bad">Keranjang berubah — QRIS sebelumnya dibatalkan. Tekan Bayar untuk membuat QR baru.</span>';
        }
      }
    };

    refreshPrices();
    renderLines();
    renderQuote(null);
  }

  // Tab profil: pindah panel tanpa reload, URL tetap bisa dibagikan (?tab=).
  function initProfileTabs() {
    const tabs = document.querySelectorAll('[data-prof-tab]');
    if (!tabs.length) return;
    function activate(key, push) {
      tabs.forEach(function (t) { t.classList.toggle('is-active', t.dataset.profTab === key); t.setAttribute('aria-selected', String(t.dataset.profTab === key)); });
      document.querySelectorAll('[data-prof-panel]').forEach(function (p) { p.classList.toggle('is-active', p.dataset.profPanel === key); });
      if (push && window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', key);
        window.history.replaceState({}, '', url);
      }
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        activate(t.dataset.profTab, true);
      });
    });
    // dukung tombol back/forward
    window.addEventListener('popstate', function () {
      const key = new URL(window.location.href).searchParams.get('tab') || 'info';
      activate(key, false);
    });
  }

  // Form promo: tampilkan bagian BOGO / paket sesuai jenis yang dipilih.
  function initPromoForms() {
    document.querySelectorAll('[data-promo-kind]').forEach(function (select) {
      const form = select.closest('form');
      if (!form) return;
      function sync() {
        const kind = select.value;
        form.querySelectorAll('.promo-extra').forEach(function (block) {
          block.hidden = block.getAttribute('data-kind') !== kind;
        });
        const bundlePrice = form.querySelector('input[name="bundle_price"]');
        if (bundlePrice) bundlePrice.required = kind === 'bundle';
      }
      select.addEventListener('change', sync);
      sync();
    });
  }

  // Tab laporan keuangan (Ringkasan / Laba Rugi / Arus Kas / Neraca).
  function initFinanceTabs() {
    const tabs = document.querySelectorAll('[data-fin-tab]');
    if (!tabs.length) return;
    function activate(key, push) {
      tabs.forEach(function (t) {
        t.classList.toggle('is-active', t.dataset.finTab === key);
        t.setAttribute('aria-selected', String(t.dataset.finTab === key));
      });
      document.querySelectorAll('[data-fin-panel]').forEach(function (p) {
        p.classList.toggle('is-active', p.dataset.finPanel === key);
      });
      if (push && window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', key);
        window.history.replaceState({}, '', url);
      }
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function (e) { e.preventDefault(); activate(t.dataset.finTab, true); });
    });
    window.addEventListener('popstate', function () {
      activate(new URL(window.location.href).searchParams.get('tab') || 'ringkasan', false);
    });
  }

  // Peta pohon organisasi: ukuran kartu, arah, buka-tutup cabang, dan tarik-lepas induk.
  // Semua preferensi tampilan disimpan di localStorage; perubahan struktur tetap ke server.
  function initOrgChart() {
    const wrap = document.querySelector('[data-org-tree]');
    if (!wrap) return;
    const baseMeta = document.querySelector('meta[name="app-base"]');
    const base = baseMeta ? baseMeta.getAttribute('content') : '';
    const scroll = document.querySelector('[data-org-scroll]');
    const statusEl = document.querySelector('[data-org-status]');
    const zoomLabel = document.querySelector('[data-org-zoom-label]');
    const orientBtn = document.querySelector('[data-org-orient]');
    const orientLabel = document.querySelector('[data-org-orient-label]');
    const ZOOMS = ['sm', 'md', 'lg'];
    const ZOOM_TEXT = { sm: 'Ringkas', md: 'Nyaman', lg: 'Besar' };
    const STORE = 'bizdash-orgchart';
    const COLLAPSE_KEY = 'bizdash-org-collapsed-' + wrap.getAttribute('data-org-mode');
    let prefs = { zoom: 'md', orient: 'v' };
    try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
    let collapsed = [];
    try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]') || []; } catch (e) {}

    function savePrefs() {
      try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch (e) {}
    }
    function saveCollapsed() {
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); } catch (e) {}
    }

    function applyZoom() {
      wrap.setAttribute('data-zoom', prefs.zoom);
      if (zoomLabel) zoomLabel.textContent = ZOOM_TEXT[prefs.zoom] || prefs.zoom;
    }
    function applyOrient() {
      wrap.setAttribute('data-orient', prefs.orient);
      if (orientLabel) orientLabel.textContent = prefs.orient === 'h' ? 'Horizontal' : 'Vertikal';
      if (orientBtn) {
        orientBtn.setAttribute('aria-pressed', prefs.orient === 'h' ? 'true' : 'false');
        orientBtn.title = prefs.orient === 'h' ? 'Ubah ke pohon vertikal' : 'Ubah ke pohon horizontal';
      }
    }

    function setCollapsed(li, value) {
      const id = li.getAttribute('data-org-kind') + '-' + li.getAttribute('data-org-id');
      li.classList.toggle('is-collapsed', value);
      const btn = li.querySelector(':scope > .org-card [data-org-toggle]');
      if (btn) {
        btn.setAttribute('aria-expanded', String(!value));
        const name = li.getAttribute('data-org-name') || '';
        btn.setAttribute('aria-label', (value ? 'Buka cabang ' : 'Tutup cabang ') + name);
      }
      const next = collapsed.filter((x) => x !== id);
      if (value) next.push(id);
      collapsed = next;
    }

    applyZoom();
    applyOrient();
    // pulihkan keadaan tutup (hanya node yang masih ada)
    collapsed.slice().forEach(function (id) {
      const li = wrap.querySelector('[data-org-id="' + String(id).split('-').pop() + '"]');
      if (li) setCollapsed(li, true);
    });

    document.querySelectorAll('[data-org-zoom]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const dir = btn.getAttribute('data-org-zoom');
        const i = ZOOMS.indexOf(prefs.zoom);
        prefs.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + (dir === 'in' ? 1 : -1)))];
        applyZoom();
        savePrefs();
      });
    });
    if (orientBtn) {
      orientBtn.addEventListener('click', function () {
        prefs.orient = prefs.orient === 'h' ? 'v' : 'h';
        applyOrient();
        savePrefs();
        if (scroll) scroll.scrollLeft = 0;
      });
    }
    document.querySelectorAll('[data-org-expand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const open = btn.getAttribute('data-org-expand') === 'all';
        wrap.querySelectorAll('.org-node').forEach(function (li) { setCollapsed(li, !open); });
        saveCollapsed();
      });
    });
    wrap.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-org-toggle]');
      if (!btn) return;
      const li = btn.closest('.org-node');
      if (!li) return;
      setCollapsed(li, !li.classList.contains('is-collapsed'));
      saveCollapsed();
    });

    // ---- tarik-lepas untuk memindahkan induk (pointer events, tanpa library) ----
    function describe(kind) {
      return kind === 'position' ? 'jabatan' : 'entitas';
    }
    function isDescendant(source, targetId) {
      const kids = source.querySelectorAll('.org-node');
      for (const k of kids) if (k.getAttribute('data-org-id') === String(targetId)) return true;
      return false;
    }
    function say(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle('is-error', !!isError);
    }
    async function moveNode(source, target) {
      const kind = source.getAttribute('data-org-kind');
      const body = {
        _csrf: (document.querySelector('input[name="_csrf"]') || {}).value || '',
        kind: kind,
        id: Number(source.getAttribute('data-org-id')),
        parent_id: target ? Number(target.getAttribute('data-org-id')) : '',
      };
      say('Memindahkan…');
      try {
        const res = await fetch(base + '/structure/tree/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(function () { return {}; });
        if (!res.ok || !json.ok) {
          say(json.error || 'Gagal memindahkan. Coba muat ulang halaman.', true);
          return;
        }
        say(json.message || 'Dipindahkan.');
        const url = new URL(window.location.href);
        url.searchParams.set('msg', json.message || 'Struktur diperbarui.');
        url.searchParams.set('tone', 'success');
        window.setTimeout(function () { window.location.href = url.toString(); }, 420);
      } catch (err) {
        say('Koneksi gagal. Periksa jaringan lalu coba lagi.', true);
      }
    }

    wrap.querySelectorAll('[data-org-drag]').forEach(function (handle) {
      handle.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const source = handle.closest('.org-node');
        if (!source) return;
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        let dragging = false;
        let target = null;

        function cleanup() {
          document.body.classList.remove('org-dragging');
          source.classList.remove('is-dragging');
          if (target) target.classList.remove('is-drop-target');
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onUp);
        }
        function onMove(ev) {
          if (!dragging) {
            if (Math.abs(ev.clientX - startX) < 6 && Math.abs(ev.clientY - startY) < 6) return;
            dragging = true;
            document.body.classList.add('org-dragging');
            source.classList.add('is-dragging');
          }
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const hit = el ? el.closest('.org-node') : null;
          const valid = hit && hit !== source && !isDescendant(source, hit.getAttribute('data-org-id'))
            && hit.getAttribute('data-org-kind') === source.getAttribute('data-org-kind');
          if (target && target !== hit) target.classList.remove('is-drop-target');
          target = valid ? hit : null;
          if (target) target.classList.add('is-drop-target');
        }
        function onUp() {
          cleanup();
          if (!dragging) return;
          if (target) {
            moveNode(source, target);
          } else {
            say('Lepaskan di atas kartu lain untuk memindahkan ' + describe(source.getAttribute('data-org-kind')) + '.', true);
          }
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      });
    });
  }

  function initPrint() {
    // Tombol cetak generik: [data-print] (topbar & kartu ekspor) + #print-report lama.
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-print], #print-report');
      if (!btn) return;
      e.preventDefault();
      window.print();
    });
  }
})();
