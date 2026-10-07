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

test('android requests camera only and stays offline', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.ok(manifest.includes('android.permission.CAMERA'), 'camera permission required for QR scan');
  assert.ok(!manifest.includes('android.permission.INTERNET'), 'internet permission must be absent');
  assert.ok(!manifest.includes('android.permission.ACCESS_NETWORK_STATE'), 'network-state permission must be absent');
  assert.ok(manifest.includes('android:allowBackup="false"'), 'backups must stay disabled');
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), 'cleartext must stay disabled');
});

test('linux server defaults to loopback 8443 with hardened headers', () => {
  const server = read('server.js');
  assert.ok(server.includes('8443'), 'default best port must include 8443');
  assert.ok(server.includes('443'), 'VPS normal port 443 must be supported');
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

test('service worker never caches remote content', () => {
  const sw = read('service-worker.js');
  assert.ok(!/fetch\(['"]https?:/.test(sw), 'service worker must not fetch remote');
});
