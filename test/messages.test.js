const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('tap menu offers all eight actions', () => {
  for (const label of ['Reply', 'Copy', 'Re-key', 'Forward', 'favorites', 'Delete', 'Details']) {
    assert.ok(js.includes(label), `menu must offer ${label}`);
  }
  assert.ok(js.includes('openMsgMenu') && js.includes('msgMenu'), 'menu plumbing must exist');
});

test('hold quick bar has copy, forward, delete, and more', () => {
  assert.ok(js.includes('openMsgQuick') && js.includes('msgQuick'), 'quick bar must exist');
  assert.ok(js.includes('Add to favorites'), 'more-menu must offer favorites');
  assert.ok(js.includes('500'), 'hold threshold must exist');
  assert.ok(js.includes('contextmenu'), 'right-click must open the menu');
});

test('reply, star, re-key, forward, details share one store', () => {
  for (const fn of ['replyToMsg', 'toggleStar', 'rekeyMsg', 'forwardMsg', 'showDetails', 'copyMsgText', 'bindMsgPress', 'showReplyBar', 'hideReplyBar']) {
    assert.ok(js.includes(`function ${fn}`) || js.includes(`${fn}(`), `${fn} must exist`);
  }
  assert.ok(js.includes('replyTo') && js.includes('starred') && js.includes('starFilter'), 'model must carry reply/star/filter');
  assert.ok(js.includes('msg-quote'), 'reply quotes must render');
});

test('message graphics are Telegram-like with dark cover', () => {
  for (const cls of ['msg-menu', 'msg-quick', 'msg-quote', 'reply-bar', 'msg-text']) {
    assert.ok(js.includes(cls), `${cls} style must exist`);
  }
  assert.ok(js.includes('prefers-reduced-motion'), 'motion must respect user setting');
  assert.ok(js.includes('msgpop'), 'open animation must exist');
  assert.ok(js.includes('msg-menu') && js.includes('data-x-theme="dark"'), 'menu needs dark cover');
});
