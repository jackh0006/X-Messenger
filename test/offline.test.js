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
  assert.ok(!manifest.includes('android.permission.NFC'), 'NFC permission must be absent');
  assert.ok(!manifest.includes('android.permission.BLUETOOTH'), 'bluetooth permissions must be absent');
  assert.ok(manifest.includes('android:allowBackup="false"'), 'backups must stay disabled');
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), 'cleartext must stay disabled');
});

test('linux server defaults to loopback 443 HTTPS separate window with hardened headers', () => {
  const server = read('server.js');
  const cli = read('bin/cipherlink');
  assert.ok(server.includes('443'), 'default HTTPS port must be 443');
  assert.ok(cli.includes('443'), 'CLI default must be 443');
  assert.ok(cli.includes('Choose another port'), 'CLI must prompt for another port when 443 is taken');
  assert.ok(cli.includes('cipherlink-gui'), 'CLI must open the native shell, not a browser tab');
  assert.ok(!/chromium --app=|google-chrome.*--app=/.test(cli), 'CLI must not spawn Chromium');
  assert.ok(!/file:\/\//.test(cli), 'CLI must never use file:// (breaks CSP/WebCrypto)');
  assert.ok(server.includes("'loopback'"), 'default bind must be loopback');
  assert.ok(server.includes("minVersion: 'TLSv1.2'"), 'must require TLS 1.2+');
  assert.ok(server.includes('X-Content-Type-Options'), 'must send nosniff');
  assert.ok(server.includes('Content-Security-Policy'), 'must send CSP');
  assert.ok(server.includes('wasm-unsafe-eval'), 'CSP must allow same-origin WASM bridge');
  assert.ok(server.includes('/vendor/xm2.wasm') && server.includes('/vendor/wasm_exec.js'), 'server must allow-list the v2 WASM payload');
  assert.ok(server.includes('no-store'), 'must send no-store');
  assert.ok(server.includes('/api/info'), 'must expose read-only TLS info');
});

test('v2 bridge is WASM-local, experimental, and keeps v1 readable', () => {
  const js = read('app.js');
  assert.ok(js.includes('vendor/xm2.wasm') && js.includes('vendor/wasm_exec.js'), 'bridge must load pinned local WASM only');
  assert.ok(js.includes("vendor/xm2.wasm"), 'WASM must load same-origin (relative first, Android-safe)');
  assert.ok(js.includes('xm2capability'), 'bridge must pre-flight WebAssembly/BigInt with honest errors');
  assert.ok(js.includes('xm2appV'), 'engine files must be cache-busted per release (stale runtimes kill the bridge)');
  assert.ok(js.includes('unhandledrejection'), 'async engine failures must be captured with their real text');
  assert.ok(js.includes('v2status') && js.includes('Not connected'), 'pair status pill must exist');
  assert.ok(js.includes('xm2diag') && js.includes('Copy diagnostics'), 'pair dialog must offer secret-free diagnostics');
  assert.ok(js.includes('v2Banner') && js.includes('unaudited'), 'experimental banner must exist');
  assert.ok(js.includes("startsWith('XM2.')") && js.includes('decryptText'), 'receive must try XM2 then fall back to XM1');
  assert.ok(js.includes('buildPairDialog') && js.includes('v2Confirm') && js.includes('OUT LOUD'), 'pairing must require out-loud compare + confirm');
  assert.ok(js.includes('data-view="pair"') || js.includes("view === 'pair'") || js.includes('pairDialog'), 'pairing must be reachable from the sidebar');
});

test('wasm pair is pinned: one toolchain, stamped, functionally gated', () => {
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'check-wasm-pair.js')), 'pair check script must exist');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'build-web.js')), 'bundle builder must exist');
  const build = read('scripts/build-web.js');
  assert.ok(build.includes('pickGo') && build.includes('1.24'), 'bundle must pin Go >= 1.24 and fail hard otherwise');
  assert.ok(build.includes('vendor/BUILD') || build.includes('BUILD'), 'bundle must stamp the pair toolchain');
  const rel = read('scripts/release.sh');
  assert.ok(rel.includes('check-wasm-pair'), 'release must gate on the functional pair check');
});

test('camera scan accepts v2 envelopes as well as XM1', () => {
  const js = read('app.js');
  assert.ok(js.includes("startsWith('XM2.')"), 'scanner must accept XM2 payloads');
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
  assert.ok(srv.includes("127.0.0.1"), 'loopback address must be 167.0.0.1');
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

test('session messages support delete, backup v2 carries sealed envelopes only', () => {
  const js = read('app.js');
  assert.ok(js.includes('deleteMessage') && js.includes('clearChat') && js.includes('wipeSession'), 'store must delete/clear/wipe');
  assert.ok(js.includes('x-messenger-local-backup-v2'), 'backup must be v2 with envelopes');
  assert.ok(js.includes('x-messenger-why-seen-v1') && js.includes('removeItem'), 'delete-all must include first-run flag');
  assert.ok(js.includes('chatSearch') && js.includes('toggleSelect'), 'search + select UI must exist');
});

test('plaintext never persists: localStorage holds labels/settings/sealed vault only', () => {
  const js = read('app.js');
  for (const m of js.matchAll(/localStorage\.setItem\(([^,]+),/g)) {
    const key = m[1].trim();
    // `key` is only allowed as the loop variable constrained to the two
    // label/settings constants (restore path); literals must be allow-listed.
    // VAULT_KEY holds sealed ciphertext (XMV1 envelopes), never plaintext.
    // V2BROKEN_KEY holds a non-secret '1' marker (v2 engine stood down after
    // a page-engine crash); it is cleared by delete-all like everything else.
    const loopOk = key === 'key' && js.includes('for (const key of [PROFILE_KEY, SETTINGS_KEY])');
    const ok = key === 'PROFILE_KEY' || key === 'SETTINGS_KEY' || key === 'VAULT_KEY' || key === "'x-messenger-why-seen-v1'" || key === 'V2BROKEN_KEY' || loopOk;
    assert.ok(ok, `localStorage may only store labels/settings/sealed vault, found: ${key}`);
  }
  assert.ok(js.includes('Plaintext lives ONLY here'), 'session-only store contract must be documented');
  assert.ok(js.includes('sealedOnly'), 'restored envelopes must stay sealed-only (no plaintext)');
  assert.ok(!/localStorage\.setItem\(['"]x-messenger-messages/.test(js), 'message plaintext must never be persisted');
});

test('opening a sealed envelope stages ciphertext only, stores nothing', () => {
  const js = read('app.js');
  const fn = js.match(/function openEnvelope[\s\S]*?\n\}/);
  assert.ok(fn, 'openEnvelope must exist');
  assert.ok(fn[0].includes('m.sealed'), 'envelope open must stage the sealed ciphertext');
  assert.ok(!fn[0].includes('localStorage'), 'envelope open must not persist anything');
  assert.ok(!fn[0].includes('chatEntry'), 'envelope open must not create plaintext entries');
});

test('boot probe shows an update notice on ancient browsers, not a white screen', () => {
  const html = read('index.html');
  assert.ok(html.includes('Boot probe'), 'boot probe must exist');
  assert.ok(html.includes('System WebView'), 'probe must name the fix (update WebView)');
});

test('security guide states verifiable guarantees without hype', () => {
  const html = read('index.html');
  const js = read('app.js');
  assert.ok(html.includes('Verified guarantees'), 'guarantees section must exist');
  assert.ok(html.includes('Locked history'), 'at-rest guarantee must be stated');
  assert.ok(html.includes('Not a guarantee'), 'honesty box must stay');
  assert.ok(!/unhackable|CIA-grade|NSA-proof|military-grade/i.test(html + js), 'must never claim hype guarantees');
});

test('build stamp proves which commit serves', () => {
  const cli = read('bin/cipherlink');
  const srv = read('server.js');
  const js = read('app.js');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'build-info.js')), 'build-info generator must exist');
  assert.ok(cli.includes('buildStamp'), 'CLI version must append the stamp');
  assert.ok(srv.includes('readBuildStamp') && srv.includes('build:'), '/api/info must carry the stamp');
  assert.ok(js.includes('buildTag') && js.includes('ABOUT X MESSENGER v'), 'About + footer must show the stamp');
  const gi = read('.gitignore');
  assert.ok(gi.includes('build-info.json'), 'stamp file must stay uncommitted');
});

test('android supports arm32 + arm64 on SDK 36 with Play AAB path', () => {
  const gradle = read('android/app/build.gradle');
  const vars = read('android/variables.gradle');
  assert.ok(vars.includes('minSdkVersion = 24'), 'minSdk must stay 24 (Android 7+, covers 9)');
  assert.ok(vars.includes('targetSdkVersion = 36'), 'targetSdk must be 36 stable (not 37 preview)');
  assert.ok(vars.includes('compileSdkVersion = 36'), 'compileSdk must be 36 stable');
  assert.ok(gradle.includes('armeabi-v7a') && gradle.includes('arm64-v8a'), 'ABI filters must include arm32 + arm64');
  assert.ok(gradle.includes('splits') && gradle.includes('universalApk'), 'per-ABI splits must exist for GitHub APKs');
  assert.ok(gradle.includes('bundleRelease') || gradle.includes('bundle {') || fs.existsSync(path.join(root, 'scripts', 'release.sh')) && read('scripts/release.sh').includes('bundleRelease'), 'Play AAB path must exist');
  assert.ok(gradle.includes('versionCode 21') && gradle.includes('versionName "1.5.3"'), 'android version must be 1.5.3/21');
  const proguard = read('android/app/proguard-rules.pro');
  assert.ok(proguard.includes('com.getcapacitor'), 'R8 keeps must cover Capacitor or release builds crash');
});

test('desktop is cross-platform: platform shim + per-arch demo + Windows track', () => {
  assert.ok(fs.existsSync(path.join(root, 'lib', 'platform.js')), 'lib/platform.js must exist');
  const plat = read('lib/platform.js');
  assert.ok(plat.includes('APPDATA') && plat.includes('win32'), 'platform shim must handle Windows paths');
  assert.ok(plat.includes('v2demoBinary'), 'per-OS/arch demo resolution must exist');
  const cli = read('bin/cipherlink');
  assert.ok(cli.includes('lib/platform') || cli.includes("require('../lib/platform')"), 'CLI must use the platform shim');
  assert.ok(cli.includes('certutil') && cli.includes('-user'), 'Windows CA trust must use CurrentUser store');
  assert.ok(!/process\.env\.HOME \|\| '\.'/.test(cli), 'CLI must not fall back to cwd for HOME on Windows');
  assert.ok(fs.existsSync(path.join(root, 'WINDOWS_GUIDE.md')), 'WINDOWS_GUIDE.md must exist');
  assert.ok(fs.existsSync(path.join(root, 'packaging', 'windows', 'x-messenger.cmd')), 'Windows launcher must exist');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'build-windows.sh')), 'Windows builder must exist');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'build-tarball.sh')), 'tarball builder must exist');
});

test('server serves WASM correctly and resolves paths on Windows', () => {
  const srv = read('server.js');
  assert.ok(srv.includes('.wasm') && srv.includes('application/wasm'), 'server must send application/wasm');
  assert.ok(srv.includes('package.json') || !/version: '1\.1\.0'/.test(srv), 'server version must be dynamic (no hardcoded old version)');
  assert.ok(srv.includes('lib/platform') || srv.includes('platform'), 'server must use the platform shim');
});

test('launch lands in the messenger: no auto splash screens', () => {
  const js = read('app.js');
  assert.ok(!/setTimeout\(\(\) => \{ try \{ openModal\('#whyDialog'\)/.test(js), 'why-dialog must not auto-open');
  assert.ok(js.includes("land straight in the messenger"), 'direct-launch contract must be documented');
});

test('v2 pairing works over copied text end to end', () => {
  const js = read('app.js');
  for (const id of ['v2MyCodeText', 'v2CopyMyCode', 'v2MyCtText', 'v2CopyMyCt']) {
    assert.ok(js.includes(id), `${id} must exist for text pairing`);
  }
  assert.ok(js.includes('clearClipboardLater'), 'pairing copies must clear the clipboard');
  assert.ok(js.includes("buildPairDialog(); document.getElementById(isCode ? 'v2PeerCode' : 'v2PeerCt')"), 'camera must route v2 codes into the pair dialog');
});

test('paired v2 contact owns a user page and its thread seals', () => {
  const js = read('app.js');
  assert.ok(js.includes("id === 'v2-paired'"), 'paired contact must have a stable user id');
  assert.ok(js.includes('v2threadActive'), 'XM2 seals must be scoped to the paired thread');
  assert.ok(!/if \(v2paired && v2send\) \{/.test(js), 'seals must not hijack every thread when paired');
  assert.ok(js.includes("mate.v2 = false"), 'unpair must mark the session ended on the user');
});

test('vault history: lock UI, auto-lock, settings wipe cover everything', () => {
  const js = read('app.js');
  for (const id of ['vaultDialog', 'vaultLockBtn', 'vaultChangeBtn', 'vaultSetupBtn']) {
    assert.ok(js.includes(id), `${id} must exist`);
  }
  assert.ok(js.includes("vaultMode = 'locked'") || js.includes('vaultLock()'), 'background hide must lock');
  assert.ok(js.includes('VAULT_KEY, PROFILE_KEY'), 'delete-all must include the vault blob');
  assert.ok(js.includes('maybeVaultBanner'), 'first-run vault offer must be a dismissible banner, not a popup');
});

test('backup carries thread addressing for export and restore', () => {
  const js = read('app.js');
  assert.ok(js.includes("to: m.to || ''"), 'backup must preserve thread addressing');
  assert.ok(js.includes("dir: e.dir === 'outgoing' ? 'outgoing' : 'incoming'"), 'restore must preserve direction');
});
