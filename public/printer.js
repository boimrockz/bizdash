/* Ondeway — transport printer thermal via Web Bluetooth (BLE) + antrean cetak.
   Printer ESC/POS murah (58/80mm) umumnya memakai BLE "transparent UART":
   kita cari karakteristik yang bisa ditulis, lalu kirim byte ESC/POS per potongan kecil. */
(function (root) {
  'use strict';

  var SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb', // printer thermal umum
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / modul serial
    '0000ae30-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC/Microchip transparent UART
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // printer BLE lain
    '0000ffb0-0000-1000-8000-00805f9b34fb',
  ];

  var STORAGE_KEY = 'bizdash-printer';
  var state = {
    device: null,
    server: null,
    characteristic: null,
    name: '',
    connected: false,
    busy: false,
    lastError: '',
    lastPrintAt: 0,
    chunkSize: 100,
  };
  var listeners = [];

  function supported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function';
  }

  function notify() {
    listeners.forEach(function (cb) {
      try { cb(status()); } catch (e) { /* kode pemanggil tidak boleh merusak transport */ }
    });
  }

  function status() {
    return {
      supported: supported(),
      connected: state.connected,
      name: state.name,
      busy: state.busy,
      lastError: state.lastError,
      lastPrintAt: state.lastPrintAt,
      chunkSize: state.chunkSize,
    };
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.push(cb);
    cb(status());
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function remember(name) {
    try { localStorage.setItem(STORAGE_KEY, name || ''); } catch (e) { /* mode privat */ }
  }

  function remembered() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
  }

  function findWritable(server) {
    return server.getPrimaryServices().then(function (services) {
      var chain = Promise.resolve(null);
      services.forEach(function (service) {
        chain = chain.then(function (found) {
          if (found) return found;
          return service.getCharacteristics().then(function (chars) {
            var writable = chars.filter(function (c) {
              var p = c.properties || {};
              return p.write || p.writeWithoutResponse;
            });
            // prioritaskan karakteristik tanpa response (lebih cepat untuk ESC/POS)
            writable.sort(function (a, b) {
              return (b.properties.writeWithoutResponse ? 1 : 0) - (a.properties.writeWithoutResponse ? 1 : 0);
            });
            return writable[0] || null;
          });
        });
      });
      return chain;
    });
  }

  function connect() {
    if (!supported()) {
      state.lastError = 'Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome di Android/desktop, atau cetak lewat dialog browser.';
      notify();
      return Promise.reject(new Error(state.lastError));
    }
    state.lastError = '';
    notify();
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: SERVICES,
    }).then(function (device) {
      state.device = device;
      state.name = device.name || 'Printer thermal';
      device.addEventListener('gattserverdisconnected', function () {
        state.connected = false;
        state.characteristic = null;
        notify();
      });
      return device.gatt.connect();
    }).then(function (server) {
      state.server = server;
      return findWritable(server);
    }).then(function (characteristic) {
      if (!characteristic) throw new Error('Printer terhubung, tetapi kanal tulis ESC/POS tidak ditemukan. Coba printer lain.');
      state.characteristic = characteristic;
      state.connected = true;
      remember(state.name);
      notify();
      return status();
    }).catch(function (err) {
      state.connected = false;
      state.characteristic = null;
      state.lastError = err && err.message ? err.message : 'Gagal menghubungkan printer.';
      notify();
      throw err;
    });
  }

  function disconnect() {
    try {
      if (state.device && state.device.gatt && state.device.gatt.connected) state.device.gatt.disconnect();
    } catch (e) { /* abaikan */ }
    state.connected = false;
    state.characteristic = null;
    state.busy = false;
    notify();
    return Promise.resolve(status());
  }

  function writeBytes(bytes) {
    if (!state.characteristic) return Promise.reject(new Error('Printer belum terhubung.'));
    var receipt = root.OndewayReceipt;
    var parts = receipt ? receipt.chunk(bytes, state.chunkSize) : [bytes];
    var props = state.characteristic.properties || {};
    var useNoResponse = !!props.writeWithoutResponse;
    var chain = Promise.resolve();
    parts.forEach(function (part) {
      chain = chain.then(function () {
        return useNoResponse
          ? state.characteristic.writeValueWithoutResponse(part)
          : state.characteristic.writeValue(part);
      }).then(function () { return sleep(useNoResponse ? 18 : 40); });
    });
    return chain;
  }

  /** Kirim satu struk (byte Uint8Array atau model struk + opsi ke OndewayReceipt.build). */
  function print(input, opts) {
    if (!state.connected) return Promise.reject(new Error('Printer belum terhubung.'));
    if (state.busy) return Promise.reject(new Error('Printer sedang mencetak, tunggu sebentar.'));
    var receipt = root.OndewayReceipt;
    var bytes = input instanceof Uint8Array ? input
      : (receipt ? receipt.build(input, opts) : null);
    if (!bytes) return Promise.reject(new Error('Data struk tidak valid.'));
    state.busy = true;
    state.lastError = '';
    notify();
    return writeBytes(bytes).then(function () {
      state.busy = false;
      state.lastPrintAt = Date.now();
      notify();
      return { ok: true, bytes: bytes.length };
    }).catch(function (err) {
      state.busy = false;
      state.lastError = err && err.message ? err.message : 'Gagal mencetak.';
      notify();
      throw err;
    });
  }

  /** Coba hubungkan ulang ke perangkat yang izinnya sudah pernah diberikan (Chrome). */
  function reconnect() {
    if (!supported() || !navigator.bluetooth.getDevices) return Promise.resolve(false);
    return navigator.bluetooth.getDevices().then(function (devices) {
      var target = (devices || []).find(function (d) { return d.name === remembered(); }) || (devices || [])[0];
      if (!target) return false;
      state.device = target;
      state.name = target.name || 'Printer thermal';
      return target.gatt.connect()
        .then(function (server) { state.server = server; return findWritable(server); })
        .then(function (characteristic) {
          if (!characteristic) return false;
          state.characteristic = characteristic;
          state.connected = true;
          notify();
          return true;
        });
    }).catch(function () { return false; });
  }

  var API = {
    supported: supported, connect: connect, disconnect: disconnect, print: print,
    write: writeBytes, status: status, onChange: onChange, reconnect: reconnect,
    remembered: remembered,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.OndewayPrinter = API;
}(typeof window !== 'undefined' ? window : null));
