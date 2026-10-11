const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('every #id referenced in app.js exists in index.html or is created dynamically', () => {
  const html = read('index.html');
  const js = read('app.js');
  const created = new Set(['profileDialog', 'settingsDialog', 'pairDialog', 'recipientList', 'profileName', 'profileNote', 'saveProfile', 'themeSetting', 'fontSetting', 'fontValue', 'exportData', 'restoreData', 'deleteData', 'restoreFile', 'settingsStatus', 'openSecurityGuide', 'phraseStrength', 'msgCount', 'highValue', 'viewOnce', 'menuBtn', 'scrim', 'connStatus', 'portSetting', 'domainSetting', 'lanConsent', 'applyPort', 'enableLan', 'enableVps', 'backLoopback', 'tlsStatus', 'copyTlsFp', 'regenCertInfo', 'chatBar', 'chatSearch', 'selCount', 'starFilterBtn', 'toggleSelect', 'delSelected', 'expSelected', 'cancelSelect', 'clearChat', 'chatStatus', 'replyBar', 'msgMenu', 'msgQuick', 'msgDetailsDialog', 'v2MyQr', 'v2PeerCode', 'v2MyCtQr', 'v2PeerCt', 'v2Fingerprint', 'v2Confirm', 'v2PairStatus', 'v2Banner']);
  const ids = new Set([...js.matchAll(/\$\('#([A-Za-z]+)'\)/g)].map((m) => m[1]));
  for (const id of ids) {
    if (created.has(id)) continue;
    assert.ok(html.includes(`id="${id}"`), `missing #${id} in index.html`);
  }
});

test('dark theme covers fonts and key surfaces', () => {
  const js = read('app.js');
  assert.ok(js.includes('html[data-x-theme="dark"] .message-bubble'), 'dark bubble missing');
  assert.ok(js.includes('html[data-x-theme="dark"] .modal-content'), 'dark modal missing');
  assert.ok(js.includes('html[data-x-theme="dark"] .composer'), 'dark composer missing');
  assert.ok(js.includes('--x-font-size'), 'font scaling var missing');
  assert.ok(js.includes('Math.min(20, Math.max(14,'), 'font clamp missing');
});

test('message caps are consistent', () => {
  const html = read('index.html');
  assert.ok(html.includes('maxlength="900"'), 'composer maxlength must stay 900 for QR');
  const { MAX_TEXT_CHARS } = require('../core.js');
  assert.ok(MAX_TEXT_CHARS >= 900, 'core cap must cover UI cap');
});

test("hamburger-only mobile nav with one shared handler (no bottom bar)", () => {
  const html = read("index.html");
  const js = read("app.js");
  const css = read("style.css");
  assert.ok(!html.includes("mobileTabs"), "bottom bar must be gone");
  assert.ok(!css.includes("#mobileTabs"), "bottom bar css must be gone");
  assert.ok(html.includes('id="menuBtn"'), "hamburger missing");
  for (const v of ["saved", "receive", "users", "pair", "settings"]) {
    assert.ok(html.includes(`data-view="${v}"`), v + " missing");
  }
  assert.ok(js.includes("function startChat"), "unified startChat missing");
  assert.equal((js.match(/\.onclick = startChat/g) || []).length, 1, "exactly one chat trigger");
  assert.ok(js.includes("highValue"), "high-value toggle missing");
});

test("telegram drawer exists with full sidebar equipment", () => {
  const html = read("index.html");
  const js = read("app.js");
  const css = read("style.css");
  assert.ok(html.includes('id="menuBtn"'), "hamburger missing");
  assert.ok(html.includes('id="scrim"'), "scrim missing");
  assert.ok(js.includes("drawer-open"), "drawer logic missing");
  assert.ok(css.includes("body.drawer-open .sidebar"), "drawer css missing");
});

test("views render dedicated pages: receive list, users, pair status", () => {
  const js = read("app.js");
  const html = read("index.html");
  const css = read("style.css");
  assert.ok(js.includes("currentView"), "view state missing");
  assert.ok(js.includes("renderUsersPane") && js.includes("deleteProfile"), "users page missing");
  assert.ok(js.includes("renderPairPane") && js.includes("v2ConnPillPane"), "pair status page missing");
  assert.ok(js.includes("Recent received"), "receive list header missing");
  assert.ok(js.includes("v2Unpair") || js.includes("v2unpair"), "unpair action missing");
  assert.ok(html.includes('data-view="users"'), "users nav missing");
  assert.ok(css.includes(".conn-pill") && css.includes(".user-card"), "view styles missing");
});

test("small screens never overflow horizontally (360px class)", () => {
  const css = read("style.css");
  assert.ok(css.includes("overflow-x:clip") || css.includes("overflow-x: clip"), "page x-clip missing");
  assert.ok(css.includes("68vw"), "QR canvas must scale to viewport width");
  assert.ok(css.includes("text-overflow:ellipsis"), "title ellipsis missing");
});
