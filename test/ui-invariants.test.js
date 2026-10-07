const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('every #id referenced in app.js exists in index.html or is created dynamically', () => {
  const html = read('index.html');
  const js = read('app.js');
  const created = new Set(['profileDialog', 'settingsDialog', 'recipientList', 'profileName', 'profileNote', 'saveProfile', 'themeSetting', 'fontSetting', 'fontValue', 'exportData', 'restoreData', 'deleteData', 'restoreFile', 'settingsStatus', 'openSecurityGuide', 'phraseStrength', 'msgCount', 'mobileTabs', 'newTransferM', 'highValue', 'connStatus', 'portSetting', 'domainSetting', 'lanConsent', 'applyPort', 'enableLan', 'enableVps', 'backLoopback', 'tlsStatus', 'copyTlsFp', 'regenCertInfo']);
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

test("mobile tabs mirror desktop views with one shared handler", () => {
  const html = read("index.html");
  const js = read("app.js");
  assert.ok(html.includes('id="mobileTabs"'), "mobile bar missing");
  for (const v of ["saved", "receive", "settings"]) {
    const count = (html.match(new RegExp('data-view="' + v + '"', "g")) || []).length;
    assert.ok(count >= 1, v + " missing");
  }
  assert.ok(js.includes("function startChat"), "unified startChat missing");
  assert.equal((js.match(/\.onclick = startChat/g) || []).length, 2, "exactly two chat triggers");
  assert.ok(js.includes("highValue"), "high-value toggle missing");
});
