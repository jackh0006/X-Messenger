const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('web bundle has no remote network calls (same-origin /api/info only)', () => {
  for (const file of ['app.js', 'core.js', 'index.html', 'service-worker.js']) {
    const src = read(file);
    assert.ok(!/XMLHttpRequest/.test(src), `${file} must not use XHR`);
    assert.ok(!/WebSocket/.test(src), `${file} must not use WebSocket`);
    assert.ok(!/sendBeacon/.test(src), `${file} must not use sendBeacon`);
    assert.ok(!/google-analytics|googletag|facebook\.net|doubleclick/.test(src), `${file} must not contain trackers`);
    for (const m of src.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
      assert.ok(m[1].startsWith('/api/') || m[1].startsWith('/'), `${file} must only fetch same-origin: ${m[1]}`);
    }
  }
  const html = read('index.html');
  for (const m of html.matchAll(/src="([^"]+)"|href="([^"]+)"/g)) {
    const url = m[1] || m[2];
    assert.ok(!/^https?:\/\//.test(url), `index.html must not load remote URL: ${url}`);
  }
});

test('android requests camera/nfc/ble only and stays offline', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.ok(manifest.includes('android.permission.CAMERA'), 'camera permission required for QR scan');
  assert.ok(manifest.includes('android.permission.NFC'), 'NFC permission required for tag handoff');
  assert.ok(manifest.includes('android.permission.BLUETOOTH_ADVERTISE'), 'BLE advertise required for peripheral');
  assert.ok(!manifest.includes('android.permission.INTERNET'), 'internet permission must be absent');
  assert.ok(!manifest.includes('android.permission.ACCESS_NETWORK_STATE'), 'network-state permission must be absent');
  assert.ok(!manifest.includes('ACCESS_FINE_LOCATION') && !manifest.includes('ACCESS_COARSE_LOCATION'), 'location must be absent (neverForLocation scan)');
  assert.ok(manifest.includes('android:allowBackup="false"'), 'backups must stay disabled');
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), 'cleartext must stay disabled');
});

test('linux server defaults to loopback 443 HTTPS separate window with hardened headers', () => {
  const server = read('server.js');
  const cli = read('bin/cipherlink');
  assert.ok(server.includes('443'), 'default HTTPS port must be 443');
  assert.ok(cli.includes('443'), 'CLI default must be 443');
  assert.ok(cli.includes('Choose another port'), 'CLI must prompt for another port when 443 is taken');
  assert.ok(cli.includes('--app='), 'CLI must open a separate --app window, not a browser tab');
  assert.ok(!/file:\/\//.test(cli), 'CLI must never use file:// (breaks CSP/WebCrypto)');
  assert.ok(server.includes("'loopback'"), 'default bind must be loopback');
  assert.ok(server.includes("minVersion: 'TLSv1.2'"), 'must require TLS 1.2+');
  assert.ok(server.includes('X-Content-Type-Options'), 'must send nosniff');
  assert.ok(server.includes('Content-Security-Policy'), 'must send CSP');
  assert.ok(server.includes('no-store'), 'must send no-store');
  assert.ok(server.includes('/api/info'), 'must expose read-only TLS info');
});

test('lan mode is opt-in and honestly warned', () => {
  const cli = read('bin/cipherlink');
  const srv = read('server.js');
  const js = read('app.js');
  assert.ok(cli.includes('--lan'), 'CLI must offer --lan');
  assert.ok(cli.includes('--loopback'), 'CLI must offer --loopback');
  assert.ok(cli.includes('1024'), 'CLI must validate port range');
  assert.ok(srv.includes("bindMode === 'lan'"), 'server must gate LAN bind');
  assert.ok(srv.includes('observable'), 'server must warn LAN is observable');
  assert.ok(js.includes('lanConsent'), 'GUI must require LAN consent');
  assert.ok(js.includes('observable'), 'GUI must warn LAN is observable');
  assert.ok(!/invisible to DPI|impossible to hack|CIA-grade/i.test(cli + srv + js), 'must not claim invisibility');
});

test('offline is the default; gateway needs explicit opt-in', () => {
  const cli = read('bin/cipherlink');
  const srv = read('server.js');
  assert.ok(srv.includes("prefs.bind || 'loopback'") || srv.includes("|| 'loopback'"), 'server default bind must be loopback');
  assert.ok(srv.includes("127.0.0.1"), 'loopback address must be 127.0.0.1');
  assert.ok(cli.includes('--loopback'), 'CLI must offer explicit loopback');
  assert.ok(!/--lan|--vps/.test(cli.match(/Starting with safe defaults[^`]*/)?.[0] || ''), 'safe defaults must not include lan/vps');
});
test('local CA fixes browser warning without insecure flags', () => {
  const cli = read('bin/cipherlink');
  assert.ok(cli.includes('local-ca-cert.pem'), 'CLI must manage a device-local CA');
  assert.ok(cli.includes('--trust-ca'), 'CLI must offer one-time CA trust');
  assert.ok(cli.includes('--untrust-ca'), 'CLI must offer CA removal');
  assert.ok(cli.includes('--cert-info'), 'CLI must show fingerprints for comparison');
  assert.ok(!/ignore-certificate|allow-insecure/i.test(cli), 'CLI must not bypass cert validation');
  assert.ok(cli.includes('0600') || cli.includes('0o600'), 'CA key material must be 0600');
});
test('service worker never caches remote content', () => {
  const sw = read('service-worker.js');
  assert.ok(!/fetch\(['"]https?:/.test(sw), 'service worker must not fetch remote');
});

test('NFC/Bluetooth transports keep XM1 as the only security', () => {
  const js = read('app.js');
  const core = read('core.js');
  assert.ok(js.includes('Radio is hostile'), 'UI must state radio is hostile');
  assert.ok(js.includes('proximity is never authentication') || js.includes('never authentication'), 'UI must deny proximity trust');
  assert.ok(core.includes('bleEncode') && core.includes('bleDecode'), 'core must carry BLE frame codec');
  assert.ok(core.includes('nfcWrap') && core.includes('NFC_MAX'), 'core must gate NFC size');
  assert.ok(!/createBond|BLUETOOTH_ADMIN|setPin|insecure/i.test(js), 'no classic-BT pairing bypasses');
});

test('session messages support delete, backup v2 carries sealed envelopes only', () => {
  const js = read('app.js');
  assert.ok(js.includes('deleteMessage') && js.includes('clearChat') && js.includes('wipeSession'), 'store must delete/clear/wipe');
  assert.ok(js.includes('x-messenger-local-backup-v2'), 'backup must be v2 with envelopes');
  assert.ok(js.includes('x-messenger-why-seen-v1') && js.includes('removeItem'), 'delete-all must include first-run flag');
  assert.ok(js.includes('chatSearch') && js.includes('toggleSelect'), 'search + select UI must exist');
});

test('native NFC/BLE plugins stay offline and registered', () => {
  const main = read('android/app/src/main/java/com/jackh0006/xmessenger/MainActivity.java');
  const nfc = read('android/app/src/main/java/com/jackh0006/xmessenger/NfcPlugin.java');
  const ble = read('android/app/src/main/java/com/jackh0006/xmessenger/BlePlugin.java');
  const js = read('app.js');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.ok(main.includes('registerPlugin(NfcPlugin.class)') && main.includes('registerPlugin(BlePlugin.class)'), 'plugins must be registered');
  assert.ok(!/INTERNET|HttpURLConnection|OkHttp|Socket/.test(nfc + ble), 'native radio code must not open sockets');
  assert.ok(nfc.includes('XM1.') && nfc.includes('800'), 'NFC plugin must gate sealed size');
  assert.ok(ble.includes('9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6c'), 'BLE service UUID must match web central');
  assert.ok(ble.includes('9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6d') && ble.includes('9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6e'), 'BLE TX/RX UUIDs must exist natively');
  assert.ok(js.includes('9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6d') && js.includes('9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6e'), 'web TX/RX UUIDs must match native peripheral');
  // JS↔native method parity: every native-bridge call must exist natively.
  assert.ok(js.includes('queueOutgoing') && !js.includes('sendFrames'), 'web BLE send must call queueOutgoing');
  assert.ok(ble.includes('public void queueOutgoing'), 'native queueOutgoing must exist');
  assert.ok(js.includes('startAdvertising') && js.includes('bleAdvertise'), 'advertising must be user-toggled in UI');
  assert.ok(ble.includes('onStartSuccess') && ble.includes('onStartFailure'), 'advertise result must be truthful');
  assert.ok(!manifest.includes('BLUETOOTH_SCAN'), 'unused SCAN permission must stay out (least privilege)');
});
