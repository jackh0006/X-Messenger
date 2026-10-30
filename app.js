// SPDX-License-Identifier: MIT
let pendingText = '', currentPayload = '', currentVia = 'qr', scanning = false, scanTimer;
const $ = (s) => document.querySelector(s);
const { encryptText, decryptText, vaultSeal, vaultOpen } = XMessengerCrypto;
const donations = [
  ['Bitcoin', 'bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83'], ['DOGE', 'D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC'],
  ['Ethereum / USDT ERC20 / BNB', '0xdad428900a4359be8f76b3062df34211582e09eb'], ['TRX / USDT TRC20', 'TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf'],
  ['SOL / USDT SPL / USDC SPL', 'BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL'], ['XRP', 'rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9'],
  ['TON', 'UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX'], ['LTC', 'ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8']
];
function openModal(id) {
  const d = typeof id === 'string' ? $(id) : id;
  if (!d) return;
  closeDrawer();
  if (typeof d.showModal === 'function') { try { if (!d.open) d.showModal(); return; } catch {} }
  try { d.setAttribute('open', ''); } catch {}
}
// Telegram-style drawer (mobile): full sidebar equipment
function openDrawer() { try { document.body.classList.add('drawer-open'); $('#scrim').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); } catch {} }
function closeDrawer() { try { document.body.classList.remove('drawer-open'); $('#scrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); } catch {} }
try {
  $('#menuBtn').onclick = () => (document.body.classList.contains('drawer-open') ? closeDrawer() : openDrawer());
  $('#scrim').onclick = closeDrawer;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  document.querySelectorAll('.sidebar [data-view], .sidebar #newTransfer').forEach(b => b.addEventListener('click', closeDrawer));
} catch {}
function wipeSecrets() {
  for (const sel of ['#phraseInput', '#receivePhrase']) { const el = $(sel); if (el) el.value = ''; }
  pendingText = '';
  try { if (strength) strength.textContent = 'Strength: enter a phrase'; } catch {}
}
function closeAll() { wipeSecrets(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); stopScanner(); }
// A password field may be exposed by an app switcher, screen share, or a
// shoulder surfer.  Do not retain a phrase when this document is backgrounded.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    wipeSecrets();
    try { stopScanner(); } catch {}
    // Backgrounded = locked: persist, then wipe memory. Returning shows the
    // lock screen, never plaintext.
    try { if (vaultMode === 'open') vaultLock(); } catch {}
  }
});
let clearClipboardTimer = null;
function clearClipboardLater(label) {
  try { if (clearClipboardTimer) clearTimeout(clearClipboardTimer); } catch {}
  clearClipboardTimer = setTimeout(async () => {
    try { await navigator.clipboard.writeText(''); } catch {}
    clearClipboardTimer = null;
  }, 30000);
}
function clearClipboardNow() {
  try { if (clearClipboardTimer) clearTimeout(clearClipboardTimer); } catch {}
  clearClipboardTimer = null;
  try { const p = navigator.clipboard.writeText(''); if (p && p.catch) p.catch(() => {}); } catch {}
}
function timeNow() { return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
// Session message store (1.0.8). Plaintext lives ONLY here, in this page.
// Lock, close, background-clear, or Clear chat wipes it. Nothing persists.
const chatStore = { list: [], seq: 0 };
let chatFilter = '', selectMode = false, starFilter = false, replyTarget = null;
// Current main-pane view: 'saved' | 'receive' | 'users' | 'pair' | 'settings'.
// Receive shows incoming only; users/pair render dedicated pages.
// threadFor: null = general notes (Saved); a profile id = that user's thread.
let currentView = 'saved';
let threadFor = null;
const selectedIds = new Set();
function chatEntry(dir, text, opts = {}) {
  const entry = { id: `m${++chatStore.seq}-${Date.now().toString(36)}`, dir, text, sealed: opts.sealed || '', via: opts.via || '', to: opts.to || '', ts: Date.now(), viewOnce: !!opts.viewOnce, expiresAt: opts.viewOnce ? Date.now() + 30000 : 0, replyTo: opts.replyTo || '', starred: false, fwd: !!opts.fwd };
  chatStore.list.push(entry);
  if (entry.viewOnce) setTimeout(() => deleteMessage(entry.id, true), 30000);
  scheduleVaultSave();
  return entry;
}
function deleteMessage(id, silent) {
  const i = chatStore.list.findIndex(m => m.id === id);
  if (i === -1) return false;
  chatStore.list[i].text = ''; chatStore.list[i].sealed = '';
  chatStore.list.splice(i, 1); selectedIds.delete(id);
  renderChat();
  scheduleVaultSave();
  if (!silent) { try { $('#chatStatus').textContent = 'Message deleted from this device.'; } catch {} }
  return true;
}
function clearChat(confirmed) {
  if (!chatStore.list.length) return;
  if (!confirmed && !confirm('Delete all messages in this session from this device? This cannot be undone.')) return;
  for (const m of chatStore.list) { m.text = ''; m.sealed = ''; }
  chatStore.list.length = 0; selectedIds.clear(); chatFilter = '';
  try { $('#chatSearch').value = ''; } catch {}
  renderChat();
  scheduleVaultSave();
}
// ---- Encrypted on-device history vault (vault passphrase model).
// Same reviewed primitives as XM1 (AES-256-GCM + PBKDF2/600k, see core.js).
// The passphrase lives in memory only while unlocked and is wiped on lock;
// the stored blob is opaque ciphertext. No plaintext history ever persists.
const VAULT_KEY = 'x-messenger-vault';
const VAULT_CAP = 500;
let vaultMode = 'none'; // 'none' | 'locked' | 'open'
let vaultPhrase = '';
let vaultOffered = false;
let vaultSaveTimer = null;
function vaultSnapshot() {
  // View-once must never hit disk, even encrypted: filter before seal.
  return chatStore.list.filter(m => !m.viewOnce).slice(-VAULT_CAP).map(m => ({ id: m.id, dir: m.dir, text: m.text || '', sealed: m.sealed || '', via: m.via || '', to: m.to || '', ts: m.ts || Date.now(), viewOnce: false, expiresAt: 0, replyTo: m.replyTo || '', starred: !!m.starred, fwd: !!m.fwd }));
}
function scheduleVaultSave() {
  if (vaultMode !== 'open') return;
  try { clearTimeout(vaultSaveTimer); } catch {}
  vaultSaveTimer = setTimeout(() => { flushVaultSave(); }, 1200);
}
async function flushVaultSave() {
  if (vaultMode !== 'open' || !vaultPhrase) return false;
  try { clearTimeout(vaultSaveTimer); } catch {}
  try {
    localStorage.setItem(VAULT_KEY, await vaultSeal(vaultSnapshot(), vaultPhrase));
    return true;
  } catch { try { const el = document.getElementById('chatStatus'); if (el) el.textContent = 'History too large to lock (cap reached — delete old messages).'; } catch {} return false; }
}
function vaultRestore(items) {
  for (const m of chatStore.list) { m.text = ''; m.sealed = ''; }
  chatStore.list.length = 0; selectedIds.clear();
  let seq = 0;
  for (const e of (Array.isArray(items) ? items : []).slice(-VAULT_CAP)) {
    if (!e || typeof e !== 'object') continue;
    if (e.viewOnce) continue; // view-once never survives a lock
    const id = typeof e.id === 'string' && e.id ? e.id.slice(0, 40) : `m${++seq}-${Date.now().toString(36)}`;
    const mm = id.match(/^m(\d+)-/);
    if (mm) seq = Math.max(seq, Number(mm[1]));
    chatStore.list.push({ id, dir: e.dir === 'incoming' ? 'incoming' : 'outgoing', text: typeof e.text === 'string' ? e.text.slice(0, 8000) : '', sealed: typeof e.sealed === 'string' ? e.sealed.slice(0, 32772) : '', via: typeof e.via === 'string' ? e.via.slice(0, 8) : '', to: typeof e.to === 'string' ? e.to.slice(0, 60) : '', ts: Number(e.ts) || Date.now(), viewOnce: false, expiresAt: 0, replyTo: typeof e.replyTo === 'string' ? e.replyTo.slice(0, 40) : '', starred: !!e.starred, fwd: !!e.fwd });
  }
  chatStore.seq = Math.max(chatStore.seq, seq);
}
async function vaultUnlock(phrase) {
  const blob = localStorage.getItem(VAULT_KEY);
  if (!blob) throw new Error('No locked history on this device.');
  const items = await vaultOpen(blob, phrase);
  if (!Array.isArray(items)) throw new Error('Could not unlock: history damaged.');
  vaultPhrase = phrase; vaultMode = 'open';
  vaultRestore(items);
  renderChat();
}
async function vaultSetup(p1, p2) {
  if (!p1 || p1.length < 8) throw new Error('Use at least 8 characters — 20+ or four random words recommended.');
  if (p1 !== p2) throw new Error('Passphrases do not match.');
  if (localStorage.getItem(VAULT_KEY)) throw new Error('A vault already exists — unlock or wipe it first.');
  vaultPhrase = p1; vaultMode = 'open';
  const ok = await flushVaultSave();
  if (!ok) { vaultPhrase = ''; vaultMode = 'none'; throw new Error('Could not lock history on this device.'); }
  renderChat();
}
async function vaultChange(oldP, p1, p2) {
  if (vaultMode !== 'open') throw new Error('Unlock the vault first.');
  const blob = localStorage.getItem(VAULT_KEY);
  if (!blob) throw new Error('No locked history on this device.');
  await vaultOpen(blob, oldP); // verifies the old passphrase without touching memory
  if (!p1 || p1.length < 8) throw new Error('Use at least 8 characters for the new passphrase.');
  if (p1 !== p2) throw new Error('New passphrases do not match.');
  const prev = vaultPhrase;
  vaultPhrase = p1;
  const ok = await flushVaultSave();
  if (!ok) { vaultPhrase = prev; throw new Error('Could not re-lock history.'); }
}
async function vaultLock() {
  await flushVaultSave();
  vaultPhrase = '';
  vaultMode = localStorage.getItem(VAULT_KEY) ? 'locked' : 'none';
  try { clearTimeout(vaultSaveTimer); } catch {}
  try { clearClipboardNow(); } catch {}
  wipeSession();
  renderChat();
}
// Vault dialog: 'setup' (choose passphrase), 'unlock', or 'change'. Forgot =
// verified wipe of everything, never a bypass.
function openVaultDialog(mode) {
  let d = document.getElementById('vaultDialog');
  if (!d) {
    d = document.createElement('dialog');
    d.className = 'modal'; d.id = 'vaultDialog';
    document.body.append(d);
  }
  const setup = mode === 'setup';
  const change = mode === 'change';
  d.innerHTML = '<button class="modal-close" data-close>×</button><div class="modal-content">'
    + `<div class="modal-kicker">${setup ? 'LOCK HISTORY ON THIS DEVICE' : change ? 'CHANGE VAULT PASSPHRASE' : 'HISTORY IS LOCKED'}</div>`
    + `<h2>${setup ? 'Protect history with a passphrase' : change ? 'Change passphrase' : 'Unlock history'}</h2>`
    + `<p>${setup
      ? 'Messages will be stored on this device sealed with your passphrase (AES-256-GCM + PBKDF2/600k). Forget it and history is unrecoverable — that is the point.'
      : change
        ? 'Verify the current passphrase, then choose a new one. History is re-sealed on this device only.'
        : 'Enter your vault passphrase. Wrong entries fail closed and are never logged.'}</p>`
    + `${change ? '<label>Current passphrase<input id="vaultPassOld" type="password" autocomplete="current-password" placeholder="Current passphrase"></label>' : `<label>Vault passphrase<input id="vaultPass" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" placeholder="20+ characters or four random words"></label>`}`
    + (setup || change ? '<label>Repeat new passphrase<input id="vaultPass2" type="password" autocomplete="new-password" placeholder="Repeat it exactly"></label>' : '')
    + `<button class="primary-large" id="vaultGo">${setup ? 'Lock history <span>→</span>' : change ? 'Change it <span>→</span>' : 'Unlock <span>→</span>'}</button>`
    + (setup || change ? '' : '<button class="ghost-button" id="vaultForgot">Forgot — wipe everything</button>')
    + '<p id="vaultStatus" class="receive-status"></p></div>';
  d.querySelector('[data-close]').onclick = () => d.close();
  const say = t => { const s = d.querySelector('#vaultStatus'); if (s) s.textContent = t; };
  d.querySelector('#vaultGo').onclick = async () => {
    try {
      if (change) {
        await vaultChange(d.querySelector('#vaultPassOld').value, d.querySelector('#vaultPass').value, d.querySelector('#vaultPass2').value);
        say('Passphrase changed; history re-sealed.');
      } else {
        const p1 = d.querySelector('#vaultPass').value;
        if (setup) {
          await vaultSetup(p1, d.querySelector('#vaultPass2').value);
          say('History locked on this device.');
        } else {
          await vaultUnlock(p1);
          say('Unlocked.');
        }
      }
      d.querySelector('#vaultPass').value = '';
      try { d.querySelector('#vaultPass2').value = ''; } catch {}
      try { d.querySelector('#vaultPassOld').value = ''; } catch {}
      setTimeout(() => { try { d.close(); } catch {} }, 450);
    } catch (e) { say(e.message || 'Could not unlock.'); }
  };
  if (!setup && !change) {
    d.querySelector('#vaultForgot').onclick = async () => {
      if (!confirm('Wipe ALL X Messenger data from this device (vault history, labels, settings)? This cannot be undone.')) return;
      vaultMode = 'none'; vaultPhrase = '';
      try { clearTimeout(vaultSaveTimer); } catch {}
      pendingText = ''; try { await navigator.clipboard.writeText(''); } catch {}
      wipeSession(); currentPayload = '';
      [VAULT_KEY, PROFILE_KEY, SETTINGS_KEY, 'x-messenger-why-seen-v1'].forEach(key => { try { localStorage.removeItem(key); } catch {} });
      activeProfileId = null; threadFor = null;
      try { renderProfiles(); applySettings({}); } catch {}
      try { d.close(); } catch {}
      setView('saved');
    };
  }
  openModal('#vaultDialog');
}
// Non-modal banner offering vault setup once per session (never a popup).
function maybeVaultBanner(box) {
  try {
    if (vaultMode !== 'none' || vaultOffered || !chatStore.list.length) return;
    if (localStorage.getItem(VAULT_KEY)) return;
    const bar = document.createElement('div'); bar.className = 'view-head vault-offer';
    const t = document.createElement('strong'); t.textContent = 'Keep history on this device?';
    const s = document.createElement('span'); s.textContent = 'Lock it with a passphrase (encrypted). Otherwise it lives only until you close or lock.';
    const row = document.createElement('div'); row.className = 'view-actions';
    const go = document.createElement('button'); go.className = 'primary-large view-cta'; go.textContent = 'Lock history →';
    go.onclick = () => { vaultOffered = true; openVaultDialog('setup'); };
    const no = document.createElement('button'); no.className = 'ghost-button'; no.textContent = 'Not now';
    no.onclick = () => { vaultOffered = true; try { bar.remove(); } catch {} };
    row.append(go, no); bar.append(t, s, row); box.append(bar);
  } catch {}
}
function wipeSession() {
  for (const m of chatStore.list) { m.text = ''; m.sealed = ''; }
  chatStore.list.length = 0; selectedIds.clear(); chatFilter = ''; selectMode = false;
  try { $('#chatSearch').value = ''; updateSelectBar(); } catch {}
  renderChat();
  scheduleVaultSave();
}
function renderChat() {
  const box = $('#messages'); if (!box) return;
  box.replaceChildren();
  if (currentView === 'users') { renderUsersPane(box); updateSelectBar(); return; }
  
  if (vaultMode === 'locked') {
    const head = document.createElement('div'); head.className = 'view-head';
    const t = document.createElement('strong'); t.textContent = 'History is locked';
    const s = document.createElement('span'); s.textContent = 'Your messages are sealed on this device. Unlock to read them — nothing left this device.';
    const row = document.createElement('div'); row.className = 'view-actions';
    const un = document.createElement('button'); un.className = 'primary-large view-cta'; un.textContent = 'Unlock history →';
    un.onclick = () => openVaultDialog('unlock');
    row.append(un); head.append(t, s, row); box.append(head);
    updateSelectBar(); return;
  }
  if (currentView === 'saved' && !threadFor) maybeVaultBanner(box);
  const incomingOnly = currentView === 'receive';
  if (incomingOnly) {
    const head = document.createElement('div'); head.className = 'view-head';
    const n = chatStore.list.filter(m => m.dir === 'incoming').length;
    const t = document.createElement('strong'); t.textContent = `Recent received (${n})`;
    const s = document.createElement('span'); s.textContent = 'Decrypted here, session only. Deleting history removes all of them from this device.';
    const row = document.createElement('div'); row.className = 'view-actions';
    const scan = document.createElement('button'); scan.className = 'primary-large view-cta'; scan.textContent = '⌗ Scan / paste new';
    scan.onclick = () => openModal('#receiveDialog');
    const del = document.createElement('button'); del.className = 'ghost-button'; del.textContent = 'Delete history';
    del.onclick = () => clearChat();
    row.append(scan, del); head.append(t, s, row); box.append(head);
  }
  if (currentView === 'saved' && threadFor) {
    const who = profiles().find(p => p.id === threadFor);
    const head = document.createElement('div'); head.className = 'view-head';
    const t = document.createElement('strong'); t.textContent = who ? `Thread with ${who.name}` : 'Thread';
    const s = document.createElement('span'); s.textContent = 'Only messages sealed for this contact. Nothing leaves this device.';
    const row = document.createElement('div'); row.className = 'view-actions';
    const back = document.createElement('button'); back.className = 'ghost-button'; back.textContent = '← All notes';
    back.onclick = () => { threadFor = null; activeProfileId = null; setView('saved'); };
    row.append(back); head.append(t, s, row); box.append(head);
  }
  const q = chatFilter.trim().toLowerCase();
  let items = q ? chatStore.list.filter(m => (m.text || '').toLowerCase().includes(q)) : [...chatStore.list];
  if (incomingOnly) {
    items = items.filter(m => m.dir === 'incoming');
  } else if (currentView === 'saved') {
    // Saved Messages holds general notes only; addressed messages live in
    // their user's thread (Users → Send). Incoming unaddressed seals also
    // surface under Receive.
    items = threadFor ? items.filter(m => m.to === threadFor) : items.filter(m => !m.to);
  }
  if (starFilter) items = items.filter(m => m.starred);
  if (!items.length && !q && !starFilter) {
    const w = document.createElement('div'); w.className = 'welcome-card';
    if (incomingOnly) {
      w.innerHTML = '<div class="welcome-icon">⌗</div><h2>No received messages yet.</h2><p>Scan a QR or paste ciphertext to receive. Nothing here is uploaded anywhere.</p>';
    } else if (currentView === 'saved' && threadFor) {
      w.innerHTML = '<div class="welcome-icon">▤</div><h2>No messages with this contact yet.</h2><p>Write below — it seals addressed to them only.</p>';
    } else if (currentView === 'saved') {
      w.innerHTML = '<div class="welcome-icon">X</div><h2>No signal? No account? Send it anyway.</h2><p>General notes live here. Messages to a contact live in their thread (Users → Send). Session only: history vanishes on lock or close.</p>';
    } else {
      w.innerHTML = '<div class="welcome-icon">X</div><h2>No signal? No account? Send it anyway.</h2><p>Seal on this device → show QR → they decrypt offline. Session only: history vanishes on lock or close.</p>';
    }
    box.append(w); updateSelectBar(); return;
  }
  if (q || starFilter) {
    const n = document.createElement('div'); n.className = 'msg-count'; n.id = 'chatStatus';
    n.textContent = starFilter && !q ? `${items.length} starred` : `${items.length} of ${chatStore.list.length} match`; box.append(n);
  }
  for (const m of items) {
    const article = document.createElement('article'); article.className = `message ${m.dir === 'incoming' ? 'incoming' : 'outgoing'}`; article.dataset.mid = m.id;
    const bubble = document.createElement('div'); bubble.className = 'message-bubble';
    if (selectMode) {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'msg-select'; cb.checked = selectedIds.has(m.id);
      cb.setAttribute('aria-label', 'Select message');
      cb.onchange = () => { cb.checked ? selectedIds.add(m.id) : selectedIds.delete(m.id); updateSelectBar(); };
      bubble.append(cb);
    }
    if (m.replyTo) {
      const src = chatStore.list.find(x => x.id === m.replyTo);
      const quote = document.createElement('div'); quote.className = 'msg-quote';
      quote.textContent = src && src.text ? `↩ ${src.text.slice(0, 80)}` : '↩ original message deleted';
      bubble.append(quote);
    }
    if (m.sealedOnly) {
      const lock = document.createElement('button'); lock.className = 'sealed-open'; lock.textContent = `🔒 sealed envelope${m.via ? ` (${m.via})` : ''} — tap to open`;
      lock.onclick = () => openEnvelope(m.id);
      bubble.append(lock);
    } else {
      const span = document.createElement('span'); span.className = 'msg-text';
      span.textContent = m.text;
      bubble.append(span);
    }
    const stamp = document.createElement('time');
    stamp.textContent = `${new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date(m.ts))}${m.dir === 'outgoing' ? (m.fwd ? '  ✓✓ forwarded' : '  ✓✓') : ''}${m.viewOnce ? '  👁 once' : ''}${m.starred ? '  ★' : ''}${m.via ? `  ${m.via}` : ''}`;
    bubble.append(stamp); article.append(bubble);
    bindMsgPress(article, bubble, m.id);
    const del = document.createElement('button'); del.className = 'msg-del'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete this message');
    del.onclick = () => deleteMessage(m.id);
    article.append(del); box.append(article);
  }
  box.scrollTop = box.scrollHeight; updateSelectBar();
}
function updateSelectBar() {
  try {
    $('#selCount').textContent = selectMode ? `${selectedIds.size} selected` : '';
    $('#delSelected').style.display = selectMode ? '' : 'none';
    $('#expSelected').style.display = selectMode ? '' : 'none';
    $('#cancelSelect').style.display = selectMode ? '' : 'none';
  } catch {}
}
// Telegram-style message interactions (1.0.8): tap = full menu, hold =
// quick bar. Everything runs on the session store; nothing leaves.
let pendingForward = false, pendingRekey = null;
function msgById(id) { return chatStore.list.find(m => m.id === id); }
function copyMsgText(id) {
  const m = msgById(id); if (!m || m.sealedOnly) return 'Nothing to copy.';
  let text = m.text;
  try {
    const sel = window.getSelection();
    const bubble = document.querySelector(`article[data-mid="${id}"] .msg-text`);
    if (sel && sel.toString() && bubble && sel.anchorNode && bubble.contains(sel.anchorNode)) text = sel.toString();
  } catch {}
  navigator.clipboard.writeText(text).catch(() => {});
  clearClipboardLater();
  return 'Copied (clears in 30s).';
}
function replyToMsg(id) {
  const m = msgById(id); if (!m) return;
  replyTarget = id;
  showReplyBar(m);
  $('#messageInput').focus();
}
function showReplyBar(m) {
  hideReplyBar();
  const bar = document.createElement('div'); bar.id = 'replyBar'; bar.className = 'reply-bar';
  const q = document.createElement('span'); q.className = 'msg-quote';
  q.textContent = `↩ ${(m.text || 'sealed envelope').slice(0, 80)}`;
  const x = document.createElement('button'); x.className = 'icon-button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Cancel reply');
  x.onclick = hideReplyBar;
  bar.append(q, x);
  document.querySelector('.composer-wrap').prepend(bar);
}
function hideReplyBar() { replyTarget = null; try { $('#replyBar')?.remove(); } catch {} }
function forwardMsg(id) {
  const m = msgById(id); if (!m || m.sealedOnly) return;
  pendingForward = true;
  pendingText = m.text;
  openModal('#phraseDialog');
  $('#messageInput').value = '';
}
async function rekeyMsg(id) {
  const m = msgById(id); if (!m || !m.sealed) return 'Nothing to re-key.';
  pendingRekey = id;
  pendingText = m.text;
  openModal('#phraseDialog');
  return 'Choose a NEW phrase — the envelope becomes brand-new randomness.';
}
function toggleStar(id) {
  const m = msgById(id); if (!m) return;
  m.starred = !m.starred;
  renderChat();
}
function showDetails(id) {
  const m = msgById(id); if (!m) return;
  closeMsgMenu();
  const d = document.createElement('dialog'); d.className = 'modal'; d.id = 'msgDetailsDialog';
  const when = new Date(m.ts).toLocaleString();
  d.innerHTML = `<button class="modal-close" data-close>×</button><div class="modal-content"><div class="modal-kicker">MESSAGE DETAILS</div><h2>${m.dir === 'incoming' ? 'Received' : 'Sent'} · ${when}</h2><div class="guide-grid"><div><b>◈</b><p><strong>Transport</strong><small>${m.via || 'qr'} · sealed ${m.sealed ? m.sealed.length + ' B' : '—'}</small></p></div><div><b>★</b><p><strong>Starred</strong><small>${m.starred ? 'yes (session only)' : 'no'}</small></p></div><div><b>👁</b><p><strong>View-once</strong><small>${m.viewOnce ? 'yes — auto-deletes' : 'no'}</small></p></div><div><b>◇</b><p><strong>Message ID</strong><small>${m.id}</small></p></div></div><p class="subtle">Session-only: plaintext vanishes on lock or close. Sealed envelope re-readable only with its phrase.</p></div>`;
  document.body.append(d);
  d.querySelector('[data-close]').onclick = () => { d.close(); d.remove(); };
  d.showModal();
}
function closeMsgMenu() { try { $('#msgMenu')?.remove(); } catch {} try { $('#msgQuick')?.remove(); } catch {} }
function openMsgMenu(id, x, y) {
  closeMsgMenu();
  const m = msgById(id); if (!m) return;
  const menu = document.createElement('div'); menu.id = 'msgMenu'; menu.className = 'msg-menu'; menu.setAttribute('role', 'menu');
  const items = [
    ['↩ Reply', () => replyToMsg(id)],
    ['⧉ Copy', () => flashMenu(copyMsgText(id))],
    ['🔑 Re-key (new random envelope)', () => rekeyMsg(id).then(t => flashMenu(t))],
    ['➦ Forward', () => forwardMsg(id)],
    [m.starred ? '☆ Unstar' : '★ Add to favorites', () => { toggleStar(id); }],
    ['🗑 Delete', () => deleteMessage(id)],
    ['ⓘ Details', () => showDetails(id)],
  ];
  if (!m.sealedOnly) items.splice(2, 0, ['✂ Copy selection', () => flashMenu(copyMsgText(id))]);
  for (const [label, fn] of items) {
    const b = document.createElement('button'); b.textContent = label; b.setAttribute('role', 'menuitem');
    b.onclick = () => { closeMsgMenu(); fn(); };
    menu.append(b);
  }
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
  setTimeout(() => document.addEventListener('pointerdown', dismissMsgMenu, { once: true }), 0);
}
function flashMenu(text) {
  closeMsgMenu();
  try { $('#chatStatus').textContent = text; } catch {}
  renderChat();
}
function dismissMsgMenu(e) {
  if (e && e.target && (e.target.closest('#msgMenu') || e.target.closest('#msgQuick'))) {
    setTimeout(() => document.addEventListener('pointerdown', dismissMsgMenu, { once: true }), 0);
    return;
  }
  closeMsgMenu();
}
function openMsgQuick(id, x, y) {
  closeMsgMenu();
  if (!msgById(id)) return;
  const bar = document.createElement('div'); bar.id = 'msgQuick'; bar.className = 'msg-quick';
  const mk = (label, title, fn) => { const b = document.createElement('button'); b.textContent = label; b.title = title; b.onclick = () => { closeMsgMenu(); fn(); }; bar.append(b); return b; };
  mk('⧉', 'Copy (top right)', () => flashMenu(copyMsgText(id)));
  mk('➦', 'Forward', () => forwardMsg(id));
  mk('🗑', 'Delete', () => deleteMessage(id));
  mk('⋮', 'More — incl. Add to favorites', () => openMsgMenu(id, x, y));
  document.body.append(bar);
  const r = bar.getBoundingClientRect();
  bar.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  bar.style.top = `${Math.max(8, y - r.height - 8)}px`;
  setTimeout(() => document.addEventListener('pointerdown', dismissMsgMenu, { once: true }), 0);
}
function bindMsgPress(article, bubble, id) {
  bubble.style.cursor = 'pointer';
  bubble.addEventListener('click', e => {
    if (e.target.closest('button, a, input, .msg-select')) return;
    const r = bubble.getBoundingClientRect();
    openMsgMenu(id, r.left + 16, r.bottom + 4);
  });
  let timer = null, sx = 0, sy = 0;
  const start = e => {
    const t = e.touches ? e.touches[0] : e;
    sx = t.clientX; sy = t.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const r = bubble.getBoundingClientRect();
      openMsgQuick(id, r.left + r.width / 2, r.top);
    }, 500);
  };
  const cancel = e => {
    if (e.touches && e.touches[0]) {
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (dx * dx + dy * dy > 100) clearTimeout(timer);
    } else clearTimeout(timer);
  };
  bubble.addEventListener('touchstart', start, { passive: true });
  bubble.addEventListener('touchmove', cancel, { passive: true });
  bubble.addEventListener('touchend', () => clearTimeout(timer));
  bubble.addEventListener('mousedown', e => { if (e.button === 0) start(e); });
  bubble.addEventListener('mouseup', () => clearTimeout(timer));
  bubble.addEventListener('contextmenu', e => { e.preventDefault(); clearTimeout(timer); openMsgMenu(id, e.clientX, e.clientY); });
}
function addMessage(text, direction = 'outgoing', opts = {}) { chatEntry(direction === 'incoming' ? 'incoming' : 'outgoing', text, opts); renderChat(); }
function setView(view) { const views = { saved: ['▣', 'Saved Messages', 'Private notes — not uploaded anywhere'], receive: ['⌗', 'Receive a message', 'Recent received + scan new'], users: ['▤', 'Users', 'Local contacts on this device'], settings: ['⚙', 'Settings & privacy', 'Theme, data, and security controls'] }; if (!views[view]) return; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view)); $('#viewIcon').textContent = views[view][0]; $('#viewTitle').textContent = views[view][1]; $('#viewSubtitle').textContent = views[view][2]; currentView = view; if (view === 'saved') { threadFor = null; activeProfileId = null; try { $('#messageInput').placeholder = 'Write a private message…'; } catch {} } if (view === 'settings') openModal('#settingsDialog');  renderChat(); closeDrawer(); }
async function presentTransfer(payload) {
  currentPayload = payload;
  const bytes = new Blob([payload]).size;
  $('#payloadSize').textContent = `${bytes} B sealed`;
  if (bytes > 2000) {
    $('#payloadSize').textContent += ' — too big for reliable QR, use Copy or .xmsg file';
    try { $('#qrCanvas').getContext('2d').clearRect(0, 0, 296, 296); } catch {}
  } else {
    try { await QRCode.toCanvas($('#qrCanvas'), payload, { width: 296, margin: 2, errorCorrectionLevel: 'L', color: { dark: '#17212b', light: '#ffffff' } }); } catch { try { $('#qrCanvas').getContext('2d').clearRect(0, 0, 296, 296); } catch {} $('#payloadSize').textContent += ' — QR failed, use .xmsg file'; }
  }
  openModal('#transferDialog');
}
$('#sendMessage').onclick = () => { pendingText = $('#messageInput').value.trim(); if (pendingText) openModal('#phraseDialog'); };
try {
  const composer = document.querySelector('.composer');
  if (composer && !document.getElementById('tplBar')) {
  }
} catch {}
function startChat() { if (profiles().length) { setView('users'); } else try { profileDialog.showModal(); } catch {} }
try {
  const hv = document.createElement('label');
  hv.style.cssText = 'display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:12px';
  hv.innerHTML = '<input id="highValue" type="checkbox" style="width:auto;margin-top:2px"> <span><strong>High-value text</strong> (like keys or seeds): require 20+ characters, use once, tell in person, shield the screen, delete after.</span>';
  $('#sealTransfer').before(hv);
  const vo = document.createElement('label');
  vo.style.cssText = 'display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:8px';
  vo.innerHTML = '<input id="viewOnce" type="checkbox" style="width:auto;margin-top:2px"> <span><strong>View once</strong>: auto-delete from this session 30 seconds after sealing.</span>';
  $('#sealTransfer').before(vo);
} catch {}
$('#sealTransfer').onclick = async () => { const button = $('#sealTransfer'); button.disabled = true; button.textContent = 'Sealing locally…'; try { if (vaultMode === 'locked') { openVaultDialog('unlock'); throw new Error('History is locked — unlock first.'); } const text = pendingText; const once = !!($('#viewOnce') && $('#viewOnce').checked); const highValue = !!($('#highValue') && $('#highValue').checked); try { const hvb = $('#highValue'); if (hvb) hvb.checked = false; const vob = $('#viewOnce'); if (vob) vob.checked = false; } catch {}  let phrase = $('#phraseInput').value; if (!phrase) { $('#phraseInput').setCustomValidity('Enter a shared phrase. Any non-empty phrase is allowed.'); $('#phraseInput').reportValidity(); return; } try { if (highValue && phrase.length < 20) { $('#phraseInput').setCustomValidity('High-value mode: use 20+ characters or four random words, one time only.'); $('#phraseInput').reportValidity(); return; } } catch {} const payload = await encryptText(text, phrase); phrase = ''; $('#phraseInput').value = ''; if (pendingRekey) { const target = msgById(pendingRekey); pendingRekey = null; if (target && target.text === text) { target.sealed = payload; target.viewOnce = once; renderChat(); scheduleVaultSave(); $('#messageInput').value = ''; updateMsgCount(); hideReplyBar(); closeAll(); await presentTransfer(payload); return; } } const wasFwd = pendingForward; pendingForward = false; const rt = replyTarget; hideReplyBar(); addMessage(text, 'outgoing', { sealed: payload, via: 'qr', to: (typeof activeProfileId !== 'undefined' ? activeProfileId : null) || '', viewOnce: once, replyTo: rt || '', fwd: wasFwd }); $('#messageInput').value = ''; updateMsgCount(); closeAll(); await flushVaultSave(); await presentTransfer(payload); } catch (e) { $('#phraseInput').setCustomValidity(e.message || 'Could not seal.'); $('#phraseInput').reportValidity(); } finally { button.disabled = false; button.innerHTML = 'Seal and create QR <span>→</span>'; $('#phraseInput').value = ''; } };
$('#openReceive').onclick = () => openModal('#receiveDialog');
$('#decryptPayload').onclick = async () => { const status = $('#receiveStatus'); status.textContent = ''; let phrase = $('#receivePhrase').value; try { if (vaultMode === 'locked') { openVaultDialog('unlock'); throw new Error('History is locked — unlock first.'); } const sealed = $('#payloadInput').value.trim();   const text = await decryptText(sealed, phrase); phrase = ''; addMessage(text, 'incoming', { sealed, via: currentVia }); closeAll(); await flushVaultSave(); $('#payloadInput').value = ''; $('#receivePhrase').value = ''; } catch (e) { status.textContent = e.message || 'Could not decrypt: incorrect phrase or altered / unsupported transfer.'; } finally { phrase = ''; $('#receivePhrase').value = ''; } };
$('#copyPayload').onclick = async () => { try { await navigator.clipboard.writeText(currentPayload); clearClipboardLater(); $('#copyPayload').textContent = 'Copied (clears in 30s)'; setTimeout(() => $('#copyPayload').textContent = 'Copy encrypted text', 1300); } catch { $('#copyPayload').textContent = 'Copy unavailable'; } };
$('#downloadPayload').onclick = () => { const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([currentPayload], { type: 'text/plain' })), download: `x-messenger-${Date.now()}.xmsg` }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAll); document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#showSecurity').onclick = () => openModal('#securityDialog'); $('#learnMore').onclick = () => openModal('#whyDialog'); $('#showAbout').onclick = () => openModal('#aboutDialog'); $('#showDonate').onclick = () => openModal('#donateDialog'); $('#openDonate').onclick = () => { closeAll(); openModal('#donateDialog'); };
// Keep the in-app summary focused on properties the application can verify.
// The full threat model remains in SECURITY.md for publication and review.
$('#securityDialog').querySelector('.modal-content').innerHTML = '<div class="modal-kicker">SECURITY PROPERTIES</div><h2>Built for private offline transfer</h2><div class="guide-grid"><div><b>✈</b><p><strong>Works in airplane mode</strong><small>Android has no Internet permission. Linux accepts the GUI only on this device’s loopback address.</small></p></div><div><b>✓</b><p><strong>Authenticated encryption</strong><small>AES-256-GCM detects changed ciphertext when the correct phrase is used.</small></p></div><div><b>✓</b><p><strong>Phrase stays separate</strong><small>The shared phrase is never included in the QR code or encrypted payload.</small></p></div><div><b>✓</b><p><strong>Local recipient labels</strong><small>Names and notes stay on this device; no account or remote contact service is created.</small></p></div></div><p class="subtle">v1.5.3-self-audited · Unlike online messengers: no signal, no account, no server. Needs independent audit before high-risk use.</p>';
document.querySelector('.security-score strong').textContent = 'Works in airplane mode';
document.querySelector('.security-score p').textContent = 'No account, no number, no server';
// Launch lands straight in the messenger — no splash screens, ever. The
// guides stay one tap behind their buttons. The seen-flag is still recorded
// (and still wiped by delete-all) so returning devices stay quiet too.
try {
  if (!localStorage.getItem('x-messenger-why-seen-v1')) {
    localStorage.setItem('x-messenger-why-seen-v1', '1');
  }
} catch {};
for (const [name, address] of donations) { const row = document.createElement('button'); row.className = 'donate-row'; row.innerHTML = `<strong>${name}</strong><code>${address}</code><span>Copy</span>`; row.onclick = async () => { try { await navigator.clipboard.writeText(address); clearClipboardLater(); row.querySelector('span').textContent = 'Copied'; setTimeout(() => row.querySelector('span').textContent = 'Copy', 1200); } catch {} }; $('#donateList').append(row); }
async function scanLoop() { const video = $('#scanner'), canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true }); const tick = () => { if (!scanning) return; if (video.readyState >= 2) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0); const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' }); const data = found && found.data ? found.data : ''; if (data.startsWith('XM1.')) { $('#payloadInput').value = data; $('#receiveStatus').textContent = 'QR received. Enter the phrase to decrypt (v2 envelopes need a paired contact).'; stopScanner(); return; } if (data.trim().startsWith('{')) { try { const o = JSON.parse(data); const isCode = false; const isCt = false; if (false) {    stopScanner(); return; } } catch {} } } scanTimer = requestAnimationFrame(tick); }; tick(); }
async function startScanner() { try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); $('#scanner').style.display = ''; $('#scanner').srcObject = stream; await $('#scanner').play(); scanning = true; scanLoop(); } catch { $('#receiveStatus').textContent = 'Camera unavailable or denied. Paste encrypted text instead.'; try { $('#scanner').style.display = 'none'; } catch {} try { $('#payloadInput').focus(); } catch {} } }
function stopScanner() { scanning = false; cancelAnimationFrame(scanTimer); const stream = $('#scanner').srcObject; if (stream) stream.getTracks().forEach(t => t.stop()); $('#scanner').srcObject = null; }
$('#startCamera').onclick = startScanner;
const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => n.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g).join(' '); $('#fingerprint').textContent = id.toUpperCase(); $('#deviceId').textContent = `ID ${id.slice(0, 9).toUpperCase()}`; $('#copyFingerprint').onclick = async () => { try { await navigator.clipboard.writeText(id.toUpperCase()); clearClipboardLater(); } catch {} };
const msgCount = document.createElement('div'); msgCount.id = 'msgCount'; msgCount.className = 'msg-count'; msgCount.textContent = '0 / 900';
try { $('#messageInput').after(msgCount); } catch {}
// Chat toolbar: search this session, multi-select, clear chat (1.0.8).
try {
  const bar = document.createElement('div'); bar.id = 'chatBar'; bar.className = 'chat-bar';
  bar.innerHTML = '<input id="chatSearch" type="search" placeholder="Search this session…" autocomplete="off"><span id="selCount" class="msg-count"></span><button id="starFilterBtn" class="icon-button" title="Show starred only">★</button><button id="toggleSelect" class="icon-button" title="Select messages">☑</button><button id="delSelected" class="icon-button" title="Delete selected" style="display:none">🗑</button><button id="expSelected" class="icon-button" title="Export selected sealed envelopes" style="display:none">⤓</button><button id="cancelSelect" class="icon-button" title="Cancel selection" style="display:none">✕</button><button id="clearChat" class="icon-button" title="Delete all session messages">🧹</button>';
  $('#messages').before(bar);
  $('#chatSearch').addEventListener('input', e => { chatFilter = e.target.value; renderChat(); });
  $('#toggleSelect').onclick = () => { selectMode = !selectMode; selectedIds.clear(); renderChat(); };
  $('#cancelSelect').onclick = () => { selectMode = false; selectedIds.clear(); renderChat(); };
  $('#delSelected').onclick = () => { if (!selectedIds.size) return; if (!confirm(`Delete ${selectedIds.size} selected message(s) from this device?`)) return; [...selectedIds].forEach(id => deleteMessage(id, true)); selectedIds.clear(); renderChat(); };
  $('#expSelected').onclick = () => {
    const envs = chatStore.list.filter(m => selectedIds.has(m.id) && m.sealed).map(m => m.sealed);
    if (!envs.length) { $('#selCount').textContent = 'No sealed envelopes selected'; return; }
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify({ format: 'x-messenger-envelopes-v1', exportedAt: new Date().toISOString(), envelopes: envs }, null, 2)], { type: 'application/json' })), download: `x-messenger-envelopes-${Date.now()}.json` });
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  $('#clearChat').onclick = () => clearChat(false);
  $('#starFilterBtn').onclick = () => { starFilter = !starFilter; $('#starFilterBtn').classList.toggle('on', starFilter); renderChat(); };
  const chatCss = document.createElement('style');
  chatCss.textContent = '.chat-bar{display:flex;gap:6px;align-items:center;padding:8px 30px 0}.chat-bar input{flex:1;padding:8px 10px;border:1px solid var(--line,#e6ebf1);border-radius:9px;background:transparent;color:inherit;font:inherit}#toggleSelect.on{background:#e6f8f3}.msg-del{border:0;background:transparent;color:#9aa7b6;font-size:16px;cursor:pointer;align-self:flex-start}.msg-select{width:auto;margin-right:8px}'
  + '.message{position:relative}.message-bubble{position:relative;user-select:text;-webkit-user-select:text;transition:transform .2s ease-out,box-shadow .2s ease-out}'
  + '.msg-quote{border-left:3px solid #5488d8;padding:4px 8px;margin-bottom:6px;background:#5488d812;border-radius:0 6px 6px 0;font-size:11px;opacity:.9;white-space:pre-wrap;word-break:break-word}'
  + '.msg-text{white-space:pre-wrap;word-break:break-word}'
  + '.msg-menu{position:fixed;z-index:200;min-width:220px;background:#fff;color:#26364a;border-radius:12px;box-shadow:0 12px 40px #0e183b55;padding:6px;animation:msgpop .2s ease-out}'
  + '.msg-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:10px 12px;border-radius:8px;font:inherit;cursor:pointer}'
  + '.msg-menu button:hover{background:#f1f4f8}'
  + '.msg-quick{position:fixed;z-index:200;display:flex;gap:2px;background:#17212b;border-radius:24px;padding:6px 8px;box-shadow:0 12px 40px #0e183b66;animation:msgpop .2s ease-out}'
  + '.msg-quick button{border:0;background:transparent;color:#fff;font-size:18px;padding:6px 10px;border-radius:16px;cursor:pointer}'
  + '.msg-quick button:hover{background:#ffffff22}'
  + '.reply-bar{display:flex;gap:8px;align-items:center;padding:8px 30px 0}.reply-bar .msg-quote{flex:1;margin:0}'
  + '@keyframes msgpop{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:none}}'
  + '@media (prefers-reduced-motion:reduce){.message-bubble,.msg-menu,.msg-quick{transition:none;animation:none}}'
  + 'html[data-x-theme="dark"] .msg-menu{background:#1a2636;color:#e9eef7}html[data-x-theme="dark"] .msg-menu button:hover{background:#2a3a4f}html[data-x-theme="dark"] .msg-quote{background:#5488d822}';
  document.head.append(chatCss);
} catch {}
// QR-only equipment templates (no radio, no new crypto): location,
// contact card, and emergency short codes seal as ordinary text.
function updateMsgCount() { try { const n = $('#messageInput').value.length; msgCount.textContent = `${n} / 900`; msgCount.style.color = n > 900 ? '#c85360' : ''; } catch {} }
$('#messageInput').addEventListener('input', updateMsgCount); updateMsgCount();
$('#messageInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#sendMessage').click(); } });
// Android and the Linux package ship every asset locally. Avoid a service
// worker cache so an APK or Debian update always loads the current interface.
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(items => items.forEach(item => item.unregister())).catch(() => {});

// Phrases are never blocked for being short; this indicator is advice only.
const strength = document.createElement('strong'); strength.id = 'phraseStrength'; strength.textContent = 'Strength: enter a phrase';
document.querySelector('.phrase-tips').prepend(strength);
$('#phraseInput').addEventListener('input', () => { const n = $('#phraseInput').value.length; strength.textContent = `Strength: ${n === 0 ? 'enter a phrase' : n < 8 ? 'weak — easy to guess' : n < 16 ? 'fair — use more unique words' : n < 28 ? 'strong' : 'very strong'}`; $('#phraseInput').setCustomValidity(''); });

// Recipient profiles are local labels only. They are intentionally not presented
// as accounts, keys, or verified identities.
const PROFILE_KEY = 'x-messenger-recipients';
let activeProfileId = null;
const profileStyles = document.createElement('style');
profileStyles.textContent = '.recipient-heading{margin:10px 9px 2px;color:#8fa3ba;font:9px monospace;letter-spacing:.7px}.recipient-list{display:grid;gap:4px}.recipient-list .thread{padding:8px}.recipient-list .avatar{width:32px;height:32px;font-size:11px}'; document.head.append(profileStyles);
$('#newTransfer').innerHTML = '<span>＋</span> New local chat';
// Contacts live ONLY in the Users page (never duplicated in the sidebar).
// renderProfiles() is kept as a no-op refresh hook for all call sites.
const profileDialog = document.createElement('dialog'); profileDialog.className = 'modal'; profileDialog.id = 'profileDialog'; profileDialog.innerHTML = '<button class="modal-close" data-profile-close>×</button><div class="modal-content"><div class="modal-kicker">START LOCAL CHAT</div><h2>Add a recipient</h2><p>Create a private name and optional note, then start an offline chat. This label stays only on this device; it is not an account or verified identity.</p><label>Name<input id="profileName" maxlength="40" placeholder="Name or callsign"></label><label>Private note (optional)<input id="profileNote" maxlength="120" placeholder="How you know or verify this person"></label><button class="primary-large" id="saveProfile">Start chat <span>→</span></button></div>';
document.body.append(profileDialog); profileDialog.querySelector('[data-profile-close]').onclick = () => profileDialog.close();
$('#saveProfile').onclick = () => { try { const name = $('#profileName').value.trim(); if (!name) { $('#profileName').focus(); return; } const note = $('#profileNote').value.trim(); const items = profiles(); if (items.find(p => p.name === name)) { alert('A contact with that name already exists on this device.'); return; } const item = { id: 'recipient-' + Date.now(), name, note, created: Date.now() }; items.push(item); saveProfiles(items); renderProfiles(); renderChat(); $('#profileName').value = ''; $('#profileNote').value = ''; profileDialog.close(); setView('users'); } catch (e) { alert('Could not save contact: ' + (e.message || e)); } };
function profiles() { try { const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)); return Array.isArray(saved) ? saved : []; } catch { return []; } }
function saveProfiles(items) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(items)); } catch {} }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '•'; }
function activateProfile(profile) { activeProfileId = profile.id; threadFor = profile.id; $('#viewIcon').textContent = initials(profile.name); $('#viewTitle').textContent = profile.name; $('#viewSubtitle').textContent = (profile.note || 'Local offline recipient') + ' — thread (only messages for this contact)'; $('#messageInput').placeholder = `Write an encrypted message for ${profile.name}…`; document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'saved')); currentView = 'saved'; renderProfiles(); renderChat(); try { $('#messageInput').focus(); } catch {} }
function deleteProfile(id) {
  const items = profiles().filter(p => p.id !== id);
  saveProfiles(items);
  if (activeProfileId === id) { activeProfileId = null; threadFor = null; try { $('#messageInput').placeholder = 'Write a private message…'; } catch {} }
  renderProfiles(); renderChat();
}
// Users page: every local contact with Send text + Delete. Labels only —
// no accounts, nothing uploaded.
function renderUsersPane(box) {
  const head = document.createElement('div'); head.className = 'view-head';
  const t = document.createElement('strong'); t.textContent = `Users (${profiles().length}/100)`;
  const s = document.createElement('span'); s.textContent = 'Local contacts on this device. Deleting the app data removes all of them.';
  const add = document.createElement('button'); add.className = 'primary-large view-cta'; add.textContent = '＋ Add user';
  add.onclick = () => { try { profileDialog.showModal(); } catch {} };
  head.append(t, s, add); box.append(head);
  const list = profiles();
  if (!list.length) {
    const w = document.createElement('div'); w.className = 'welcome-card';
    w.innerHTML = '<div class="welcome-icon">▤</div><h2>No users yet.</h2><p>Add a local contact to address sealed messages. Names never leave this device.</p>';
    box.append(w); return;
  }
  const wrap = document.createElement('div'); wrap.className = 'user-list';
  for (const p of list) {
    const card = document.createElement('div'); card.className = 'user-card';
    const av = document.createElement('span'); av.className = 'avatar amber'; av.textContent = initials(p.name);
    const copy = document.createElement('div'); copy.className = 'user-copy';
    const nm = document.createElement('strong'); nm.textContent = p.name;
    const nt = document.createElement('small'); nt.textContent = p.note || 'Tap Send to write an encrypted message';
    copy.append(nm, nt);
    const btns = document.createElement('div'); btns.className = 'user-actions';
    const send = document.createElement('button'); send.className = 'primary-large view-cta'; send.textContent = 'Send text →';
    send.onclick = () => { setView('saved'); activateProfile(p); };
    const del = document.createElement('button'); del.className = 'ghost-button'; del.textContent = 'Delete';
    del.onclick = () => { if (confirm(`Delete local contact "${p.name}" from this device?`)) deleteProfile(p.id); };
    btns.append(send, del); card.append(av, copy, btns); wrap.append(card);
  }
  box.append(wrap);
}

// Launch: land straight in the messenger. A locked vault opens its lock
// screen; otherwise history starts empty and seals itself once set up.
try {
  if (localStorage.getItem(VAULT_KEY)) {
    vaultMode = 'locked';
    renderChat();
    setTimeout(() => { try { openVaultDialog('unlock'); } catch {} }, 350);
  } else {
    renderChat();
  }
} catch {}
