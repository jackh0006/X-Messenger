// SPDX-License-Identifier: MIT
let pendingText = '', currentPayload = '', currentVia = 'qr', scanning = false, scanTimer;
const $ = (s) => document.querySelector(s);
const { encryptText, decryptText } = XMessengerCrypto;
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
  if (document.hidden) { wipeSecrets(); try { stopScanner(); } catch {} }
});
function clearClipboardLater(label) {
  setTimeout(async () => { try { await navigator.clipboard.writeText(''); } catch {} }, 30000);
}
function timeNow() { return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
// Session message store (1.0.8). Plaintext lives ONLY here, in this page.
// Lock, close, background-clear, or Clear chat wipes it. Nothing persists.
const chatStore = { list: [], seq: 0 };
let chatFilter = '', selectMode = false;
const selectedIds = new Set();
function chatEntry(dir, text, opts = {}) {
  const entry = { id: `m${++chatStore.seq}-${Date.now().toString(36)}`, dir, text, sealed: opts.sealed || '', via: opts.via || '', ts: Date.now(), viewOnce: !!opts.viewOnce, expiresAt: opts.viewOnce ? Date.now() + 30000 : 0 };
  chatStore.list.push(entry);
  if (entry.viewOnce) setTimeout(() => deleteMessage(entry.id, true), 30000);
  return entry;
}
function deleteMessage(id, silent) {
  const i = chatStore.list.findIndex(m => m.id === id);
  if (i === -1) return false;
  chatStore.list[i].text = ''; chatStore.list[i].sealed = '';
  chatStore.list.splice(i, 1); selectedIds.delete(id);
  renderChat();
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
}
function wipeSession() {
  for (const m of chatStore.list) { m.text = ''; m.sealed = ''; }
  chatStore.list.length = 0; selectedIds.clear(); chatFilter = ''; selectMode = false;
  try { $('#chatSearch').value = ''; updateSelectBar(); } catch {}
  renderChat();
}
function renderChat() {
  const box = $('#messages'); if (!box) return;
  box.replaceChildren();
  const q = chatFilter.trim().toLowerCase();
  const items = q ? chatStore.list.filter(m => m.text.toLowerCase().includes(q)) : chatStore.list;
  if (!chatStore.list.length) {
    const w = document.createElement('div'); w.className = 'welcome-card';
    w.innerHTML = '<div class="welcome-icon">X</div><h2>No signal? No account? Send it anyway.</h2><p>Seal on this device → show QR → they decrypt offline. Session only: history vanishes on lock or close.</p>';
    box.append(w); updateSelectBar(); return;
  }
  if (q) {
    const n = document.createElement('div'); n.className = 'msg-count'; n.id = 'chatStatus';
    n.textContent = `${items.length} of ${chatStore.list.length} match`; box.append(n);
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
    if (m.sealedOnly) {
      const lock = document.createElement('button'); lock.className = 'sealed-open'; lock.textContent = `🔒 sealed envelope${m.via ? ` (${m.via})` : ''} — tap to open`;
      lock.onclick = () => openEnvelope(m.id);
      bubble.append(lock);
    } else {
      bubble.append(document.createTextNode(m.text));
    }
    const stamp = document.createElement('time');
    stamp.textContent = `${new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date(m.ts))}${m.dir === 'outgoing' ? '  ✓' : ''}${m.viewOnce ? '  👁 once' : ''}${m.via ? `  ${m.via}` : ''}`;
    bubble.append(stamp); article.append(bubble);
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
function addMessage(text, direction = 'outgoing', opts = {}) { chatEntry(direction === 'incoming' ? 'incoming' : 'outgoing', text, opts); renderChat(); }
function setView(view) { const views = { saved: ['▣', 'Saved Messages', 'Private notes — not uploaded anywhere'], receive: ['⌗', 'Receive a message', 'Scan an encrypted QR or paste ciphertext'], settings: ['⚙', 'Settings & privacy', 'Theme, data, and security controls'] }; if (!views[view]) return; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view)); $('#viewIcon').textContent = views[view][0]; $('#viewTitle').textContent = views[view][1]; $('#viewSubtitle').textContent = views[view][2]; if (view === 'receive') openModal('#receiveDialog'); else if (view === 'settings') openModal('#settingsDialog'); else closeDrawer(); }
async function presentTransfer(payload) {
  currentPayload = payload;
  const bytes = new Blob([payload]).size;
  $('#payloadSize').textContent = `${bytes} B sealed`;
  if (bytes > 2900) {
    $('#payloadSize').textContent += ' — too big for QR, use .xmsg file';
  }
  try { await QRCode.toCanvas($('#qrCanvas'), payload, { width: 296, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#17212b', light: '#ffffff' } }); } catch { $('#qrCanvas').getContext('2d').clearRect(0, 0, 296, 296); $('#payloadSize').textContent += ' — QR failed, use .xmsg file'; }
  openModal('#transferDialog');
}
$('#sendMessage').onclick = () => { pendingText = $('#messageInput').value.trim(); if (pendingText) openModal('#phraseDialog'); };
function startChat() { if (activeProfileId || profiles().length) { setView('saved'); $('#messageInput').focus(); } else profileDialog.showModal(); }
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
$('#sealTransfer').onclick = async () => { let phrase = $('#phraseInput').value; if (!phrase) { $('#phraseInput').setCustomValidity('Enter a shared phrase. Any non-empty phrase is allowed.'); $('#phraseInput').reportValidity(); return; } try { if ($('#highValue') && $('#highValue').checked && phrase.length < 20) { $('#phraseInput').setCustomValidity('High-value mode: use 20+ characters or four random words, one time only.'); $('#phraseInput').reportValidity(); return; } } catch {} const button = $('#sealTransfer'); button.disabled = true; button.textContent = 'Sealing locally…'; try { const text = pendingText; const payload = await encryptText(text, phrase); phrase = ''; $('#phraseInput').value = ''; const once = !!($('#viewOnce') && $('#viewOnce').checked); try { const hvb = $('#highValue'); if (hvb) hvb.checked = false; const vob = $('#viewOnce'); if (vob) vob.checked = false; } catch {} addMessage(text, 'outgoing', { sealed: payload, via: 'qr', viewOnce: once }); $('#messageInput').value = ''; updateMsgCount(); closeAll(); await presentTransfer(payload); } catch (e) { $('#phraseInput').setCustomValidity(e.message || 'Could not seal.'); $('#phraseInput').reportValidity(); } finally { button.disabled = false; button.innerHTML = 'Seal and create QR <span>→</span>'; $('#phraseInput').value = ''; } };
$('#openReceive').onclick = () => openModal('#receiveDialog');
$('#decryptPayload').onclick = async () => { const status = $('#receiveStatus'); status.textContent = ''; let phrase = $('#receivePhrase').value; try { const sealed = $('#payloadInput').value.trim(); const text = await decryptText(sealed, phrase); phrase = ''; addMessage(text, 'incoming', { sealed, via: currentVia }); closeAll(); $('#payloadInput').value = ''; $('#receivePhrase').value = ''; } catch (e) { status.textContent = e.message || 'Could not decrypt: incorrect phrase or altered / unsupported transfer.'; } finally { phrase = ''; $('#receivePhrase').value = ''; } };
$('#copyPayload').onclick = async () => { try { await navigator.clipboard.writeText(currentPayload); clearClipboardLater(); $('#copyPayload').textContent = 'Copied (clears in 30s)'; setTimeout(() => $('#copyPayload').textContent = 'Copy encrypted text', 1300); } catch { $('#copyPayload').textContent = 'Copy unavailable'; } };
$('#downloadPayload').onclick = () => { const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([currentPayload], { type: 'text/plain' })), download: `x-messenger-${Date.now()}.xmsg` }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); };
// NFC / Bluetooth send buttons (1.0.8). Added only when the platform can do it.
try {
  const row = document.querySelector('#transferDialog .export-row');
  if (row) {
    const mk = (id, label, title) => { const b = document.createElement('button'); b.id = id; b.textContent = label; b.title = title; row.append(b); return b; };
    if (nfcAvailable()) {
      const b = mk('nfcSend', 'Send via NFC', 'Tap phones / write tag. Small envelopes only.');
      b.onclick = async () => {
        b.disabled = true;
        try { await nfcWrite(currentPayload); currentVia = 'nfc'; $('#payloadSize').textContent += ' — sent via NFC (phrase still required separately)'; }
        catch (e) { $('#payloadSize').textContent = `NFC failed: ${(e && e.message) || e}. Use QR or file.`; }
        finally { b.disabled = false; }
      };
    }
    if (bleAvailable()) {
      const b = mk('bleSend', 'Send via Bluetooth', 'Encrypted BLE transfer to a nearby X Messenger.');
      b.onclick = async () => {
        b.disabled = true;
        try { await bleSend(currentPayload, (i, n) => { $('#payloadSize').textContent = `Bluetooth: frame ${i}/${n}`; }); currentVia = 'ble'; $('#payloadSize').textContent += ' — sent via Bluetooth (phrase still required separately)'; }
        catch (e) { $('#payloadSize').textContent = `Bluetooth failed: ${(e && e.message) || e}. Use QR or file.`; }
        finally { b.disabled = false; }
      };
    }
    const note = document.createElement('p'); note.className = 'subtle';
    note.textContent = 'Radio is hostile: anyone nearby can record it. XM1 encryption is the only protection — never send the phrase over NFC/Bluetooth/QR.';
    row.after(note);
  }
} catch {}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAll); document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#showSecurity').onclick = () => openModal('#securityDialog'); $('#learnMore').onclick = () => openModal('#whyDialog'); $('#showAbout').onclick = () => openModal('#aboutDialog'); $('#showDonate').onclick = () => openModal('#donateDialog'); $('#openDonate').onclick = () => { closeAll(); openModal('#donateDialog'); };
// Keep the in-app summary focused on properties the application can verify.
// The full threat model remains in SECURITY.md for publication and review.
$('#securityDialog').querySelector('.modal-content').innerHTML = '<div class="modal-kicker">SECURITY PROPERTIES</div><h2>Built for private offline transfer</h2><div class="guide-grid"><div><b>✈</b><p><strong>Works in airplane mode</strong><small>Android has no Internet permission. Linux accepts the GUI only on this device’s loopback address.</small></p></div><div><b>✓</b><p><strong>Authenticated encryption</strong><small>AES-256-GCM detects changed ciphertext when the correct phrase is used.</small></p></div><div><b>✓</b><p><strong>Phrase stays separate</strong><small>The shared phrase is never included in the QR code or encrypted payload.</small></p></div><div><b>✓</b><p><strong>Local recipient labels</strong><small>Names and notes stay on this device; no account or remote contact service is created.</small></p></div></div><p class="subtle">v1.0.7 · Unlike online messengers: no signal, no account, no server. Needs independent audit before high-risk use.</p>';
document.querySelector('.security-score strong').textContent = 'Works in airplane mode';
document.querySelector('.security-score p').textContent = 'No account, no number, no server';
// First-run “why different” story. Local only, shows once per device.
try {
  if (!localStorage.getItem('x-messenger-why-seen-v1')) {
    setTimeout(() => { try { openModal('#whyDialog'); localStorage.setItem('x-messenger-why-seen-v1', '1'); } catch {} }, 600);
  }
} catch {};
for (const [name, address] of donations) { const row = document.createElement('button'); row.className = 'donate-row'; row.innerHTML = `<strong>${name}</strong><code>${address}</code><span>Copy</span>`; row.onclick = async () => { try { await navigator.clipboard.writeText(address); clearClipboardLater(); row.querySelector('span').textContent = 'Copied'; setTimeout(() => row.querySelector('span').textContent = 'Copy', 1200); } catch {} }; $('#donateList').append(row); }
async function scanLoop() { const video = $('#scanner'), canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true }); const tick = () => { if (!scanning) return; if (video.readyState >= 2) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0); const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' }); if (found?.data?.startsWith('XM1.')) { $('#payloadInput').value = found.data; $('#receiveStatus').textContent = 'QR received. Enter the phrase to decrypt.'; stopScanner(); return; } } scanTimer = requestAnimationFrame(tick); }; tick(); }
async function startScanner() { try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); $('#scanner').style.display = ''; $('#scanner').srcObject = stream; await $('#scanner').play(); scanning = true; scanLoop(); } catch { $('#receiveStatus').textContent = 'Camera unavailable or denied. Paste encrypted text instead.'; try { $('#scanner').style.display = 'none'; } catch {} try { $('#payloadInput').focus(); } catch {} } }
function stopScanner() { scanning = false; cancelAnimationFrame(scanTimer); const stream = $('#scanner').srcObject; if (stream) stream.getTracks().forEach(t => t.stop()); $('#scanner').srcObject = null; }
$('#startCamera').onclick = startScanner;
// NFC / Bluetooth receive buttons (1.0.8).
try {
  const box = document.querySelector('#receiveDialog .scan-box');
  if (box) {
    if (nfcAvailable()) {
      const b = document.createElement('button'); b.id = 'nfcReceive'; b.textContent = 'Tap NFC tag';
      b.onclick = () => { $('#receiveStatus').textContent = 'Hold phones together…'; nfcReadOnce(t => { $('#payloadInput').value = t; currentVia = 'nfc'; $('#receiveStatus').textContent = 'NFC envelope received. Enter the phrase to decrypt.'; }); };
      box.append(b);
    }
    if (bleAvailable()) {
      const b = document.createElement('button'); b.id = 'bleReceive'; b.textContent = 'Listen via Bluetooth';
      let stop = null;
      b.onclick = () => {
        if (stop) { stop(); stop = null; b.textContent = 'Listen via Bluetooth'; return; }
        b.textContent = 'Stop listening'; $('#receiveStatus').textContent = 'Waiting for a nearby X Messenger… (90s)';
        stop = bleListen(t => { $('#payloadInput').value = t; currentVia = 'ble'; $('#receiveStatus').textContent = 'Bluetooth transfer complete. Enter the phrase to decrypt.'; stop = null; b.textContent = 'Listen via Bluetooth'; }, n => { $('#receiveStatus').textContent = `Bluetooth: ${n} frames…`; });
      };
      box.append(b);
    }
    if (!nfcAvailable() && !bleAvailable()) {
      const p = document.createElement('p'); p.className = 'subtle';
      p.textContent = 'NFC/Bluetooth need the Android app (native radio). This browser has neither — use camera or paste.';
      box.append(p);
    }
  }
} catch {}
const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => n.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g).join(' '); $('#fingerprint').textContent = id.toUpperCase(); $('#deviceId').textContent = `ID ${id.slice(0, 9).toUpperCase()}`; $('#copyFingerprint').onclick = async () => { try { await navigator.clipboard.writeText(id.toUpperCase()); clearClipboardLater(); } catch {} };
const msgCount = document.createElement('div'); msgCount.id = 'msgCount'; msgCount.className = 'msg-count'; msgCount.textContent = '0 / 900';
try { $('#messageInput').after(msgCount); } catch {}
// Chat toolbar: search this session, multi-select, clear chat (1.0.8).
try {
  const bar = document.createElement('div'); bar.id = 'chatBar'; bar.className = 'chat-bar';
  bar.innerHTML = '<input id="chatSearch" type="search" placeholder="Search this session…" autocomplete="off"><span id="selCount" class="msg-count"></span><button id="toggleSelect" class="icon-button" title="Select messages">☑</button><button id="delSelected" class="icon-button" title="Delete selected" style="display:none">🗑</button><button id="expSelected" class="icon-button" title="Export selected sealed envelopes" style="display:none">⤓</button><button id="cancelSelect" class="icon-button" title="Cancel selection" style="display:none">✕</button><button id="clearChat" class="icon-button" title="Delete all session messages">🧹</button>';
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
  const chatCss = document.createElement('style');
  chatCss.textContent = '.chat-bar{display:flex;gap:6px;align-items:center;padding:8px 30px 0}.chat-bar input{flex:1;padding:8px 10px;border:1px solid var(--line,#e6ebf1);border-radius:9px;background:transparent;color:inherit;font:inherit}#toggleSelect.on{background:#e6f8f3}.msg-del{border:0;background:transparent;color:#9aa7b6;font-size:16px;cursor:pointer;align-self:flex-start}.msg-select{width:auto;margin-right:8px}';
  document.head.append(chatCss);
} catch {}
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
const recipientHeading = document.createElement('div'); recipientHeading.className = 'recipient-heading'; recipientHeading.textContent = 'LOCAL RECIPIENTS';
const recipientList = document.createElement('div'); recipientList.className = 'recipient-list'; recipientList.id = 'recipientList';
$('#newTransfer').after(recipientList); $('#newTransfer').after(recipientHeading);
const profileDialog = document.createElement('dialog'); profileDialog.className = 'modal'; profileDialog.id = 'profileDialog'; profileDialog.innerHTML = '<button class="modal-close" data-profile-close>×</button><div class="modal-content"><div class="modal-kicker">START LOCAL CHAT</div><h2>Add a recipient</h2><p>Create a private name and optional note, then start an offline chat. This label stays only on this device; it is not an account or verified identity.</p><label>Name<input id="profileName" maxlength="40" placeholder="Name or callsign"></label><label>Private note (optional)<input id="profileNote" maxlength="120" placeholder="How you know or verify this person"></label><button class="primary-large" id="saveProfile">Start chat <span>→</span></button></div>';
document.body.append(profileDialog); profileDialog.querySelector('[data-profile-close]').onclick = () => profileDialog.close();
function profiles() { try { const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)); return Array.isArray(saved) ? saved : []; } catch { return []; } }
function saveProfiles(items) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(items)); } catch {} }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '•'; }
function activateProfile(profile) { activeProfileId = profile.id; $('#viewIcon').textContent = initials(profile.name); $('#viewTitle').textContent = profile.name; $('#viewSubtitle').textContent = profile.note || 'Local offline recipient'; $('#messageInput').placeholder = `Write an encrypted message for ${profile.name}…`; document.querySelectorAll('[data-view]').forEach(button => button.classList.remove('active')); renderProfiles(); $('#messageInput').focus(); }
function renderProfiles() { recipientList.replaceChildren(); const saved = profiles(); recipientHeading.style.display = saved.length ? '' : 'none'; saved.forEach(profile => { const button = document.createElement('button'); button.className = `thread${profile.id === activeProfileId ? ' active' : ''}`; button.innerHTML = `<span class="avatar blue">${initials(profile.name)}</span><span class="thread-copy"><strong></strong><small></small></span>`; button.querySelector('strong').textContent = profile.name; button.querySelector('small').textContent = profile.note || 'Tap to start chat'; button.onclick = () => activateProfile(profile); recipientList.append(button); }); }
$('#saveProfile').onclick = () => { const name = $('#profileName').value.trim().slice(0, 40), note = $('#profileNote').value.trim().slice(0, 120); if (!name) { $('#profileName').setCustomValidity('Give this local profile a name.'); $('#profileName').reportValidity(); return; } const saved = profiles(); if (saved.length >= 100) { $('#profileName').setCustomValidity('Too many local recipients (max 100). Delete one first.'); $('#profileName').reportValidity(); return; } if (saved.some(p => p.name.toLowerCase() === name.toLowerCase())) { $('#profileName').setCustomValidity('That name already exists locally.'); $('#profileName').reportValidity(); return; } const profile = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, note }; saved.push(profile); saveProfiles(saved); renderProfiles(); profileDialog.close(); $('#profileName').value = ''; $('#profileNote').value = ''; activateProfile(profile); };
$('#newTransfer').onclick = startChat;
renderProfiles();

// NFC + Bluetooth transports (1.0.8). The radio is hostile: anyone nearby
// can sniff or relay it. XM1 authenticated encryption is the ONLY security —
// proximity is never authentication, and the phrase still travels separately.
const { bleEncode, bleDecode, nfcWrap, NFC_MAX } = XMessengerCrypto;
const XMSG_SVC = '9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6c';
const XMSG_TX = '9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6d';
const XMSG_RX = '9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6e';
const nfcPlugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NfcPlugin) || null;
const blePlugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BlePlugin) || null;
function nfcAvailable() { return !!nfcPlugin() || ('NDEFReader' in window); }
function bleAvailable() { return !!blePlugin() || ('bluetooth' in navigator); }
async function nfcWrite(payload) {
  const sealed = nfcWrap(payload);
  const p = nfcPlugin();
  if (p) { await p.writeTag({ payload: sealed }); return; }
  const r = new NDEFReader();
  await r.write({ records: [{ recordType: 'mime', mediaType: 'application/x-xmessenger', data: new TextEncoder().encode(sealed) }] });
}
function nfcReadOnce(onPayload) {
  const p = nfcPlugin();
  if (p) { p.readTag().then(r => onPayload(r.payload)).catch(e => { $('#receiveStatus').textContent = (e && e.message) || 'NFC read failed.'; }); return; }
  const r = new NDEFReader();
  r.onreading = event => {
    for (const rec of event.message.records) {
      try {
        let bytes = new Uint8Array(rec.data);
        // Tolerate well-known Text records (status + language prefix).
        if (rec.recordType === 'text' && bytes.length > 1) {
          const langLen = bytes[0] & 0x3F;
          bytes = bytes.slice(1 + langLen);
        }
        const t = new TextDecoder().decode(bytes);
        if (t.startsWith('XM1.')) { onPayload(t); return; }
      } catch {}
    }
    $('#receiveStatus').textContent = 'No X Messenger envelope on that tag.';
  };
  r.scan().catch(() => { $('#receiveStatus').textContent = 'NFC unavailable or denied. Use QR or paste instead.'; });
}
async function bleConnect() {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [XMSG_SVC] }], optionalServices: [XMSG_SVC] });
  const server = await device.gatt.connect();
  return { device, server, svc: await server.getPrimaryService(XMSG_SVC) };
}
async function bleSend(payload, onProgress) {
  const frames = bleEncode(payload);
  const p = blePlugin();
  if (p) { await p.sendFrames({ frames }); return; }
  const { device, svc } = await bleConnect();
  try {
    const rx = await svc.getCharacteristic(XMSG_RX);
    const enc = new TextEncoder();
    for (let i = 0; i < frames.length; i++) {
      await rx.writeValueWithResponse(enc.encode(frames[i]));
      onProgress(i + 1, frames.length);
    }
  } finally { try { device.gatt.disconnect(); } catch {} }
}
function bleListen(onPayload, onProgress) {
  const p = blePlugin();
  if (p) {
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      try {
        const r = await p.pollIncoming();
        if (r && r.payload) { onPayload(r.payload); return; }
      } catch {}
      setTimeout(poll, 1200);
    };
    poll();
    return () => { alive = false; };
  }
  let stopped = false, got = [];
  navigator.bluetooth.requestDevice({ filters: [{ services: [XMSG_SVC] }], optionalServices: [XMSG_SVC] })
    .then(d => d.gatt.connect().then(async server => {
      const svc = await server.getPrimaryService(XMSG_SVC);
      const tx = await svc.getCharacteristic(XMSG_TX);
      await tx.startNotifications();
      const timer = setTimeout(() => { stopped = true; try { server.disconnect(); } catch {} }, 90000);
      tx.addEventListener('characteristicvaluechanged', ev => {
        if (stopped) return;
        got.push(new TextDecoder().decode(ev.target.value));
        onProgress(got.length, 0);
        try {
          const payload = bleDecode(got);
          clearTimeout(timer); stopped = true;
          try { server.disconnect(); } catch {}
          onPayload(payload);
        } catch (e) { if (!/Incomplete/.test(e.message || '')) { clearTimeout(timer); stopped = true; } }
      });
    })).catch(() => { if (!stopped) $('#receiveStatus').textContent = 'Bluetooth unavailable, denied, or no X Messenger nearby.'; });
  return () => { stopped = true; };
}

// Settings and backups are intentionally local. Export is explicit and restore
// accepts only the small versioned X Messenger backup format.
const SETTINGS_KEY = 'x-messenger-settings';
const settingDialog = document.createElement('dialog');
settingDialog.className = 'modal settings-modal'; settingDialog.id = 'settingsDialog';
settingDialog.innerHTML = '<button class="modal-close" data-settings-close>×</button><div class="modal-content"><div class="modal-kicker">SETTINGS & PRIVACY</div><h2>Make X Messenger yours</h2><label>Theme<select id="themeSetting"><option value="system">System default</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Text size <input id="fontSetting" type="range" min="14" max="20" step="1"><span id="fontValue"></span></label><h3 style="margin:18px 0 4px;font-size:13px">Connection (Linux GUI)</h3><p class="subtle" id="connStatus">Loading connection…</p><label>Custom port (1–65535; 8443 local/LAN, 443 VPS normal HTTPS)<input id="portSetting" type="number" min="1" max="65535" step="1" placeholder="8443"></label><label>Custom domain — VPS only, e.g. msg.example.com (what it is for: your private address instead of an IP; needs DNS + Let’s Encrypt)<input id="domainSetting" placeholder="msg.example.com"></label><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input id="lanConsent" type="checkbox" style="width:auto"> I understand LAN/VPS sharing is observable as encrypted TLS (IP/domain/port/sizes) on the network</label><div class="settings-actions"><button id="applyPort">Apply port (restarts GUI)</button><button id="enableLan">Share on LAN (needs consent)</button><button id="enableVps">Use my VPS domain (needs consent)</button><button id="backLoopback">Back to loopback only</button></div><h3 style="margin:14px 0 4px;font-size:13px">TLS certificate</h3><p class="subtle" id="tlsStatus">Loading certificate…</p><div class="settings-actions"><button id="copyTlsFp">Copy cert fingerprint</button><button id="regenCertInfo">How to regenerate cert</button></div><div class="settings-actions"><button id="exportData">Export local backup</button><button id="restoreData">Restore local backup</button><button class="danger-button" id="deleteData">Delete all local data</button></div><input id="restoreFile" type="file" accept="application/json,.json" hidden><p class="subtle" id="settingsStatus">Backups contain local recipient labels and preferences only. Shared phrases are never saved.</p><button class="security-button" id="openSecurityGuide">Security properties <span>→</span></button></div>';
document.body.append(settingDialog); settingDialog.querySelector('[data-settings-close]').onclick = () => settingDialog.close();
const settingStyles = document.createElement('style');
settingStyles.textContent = 'html{font-size:var(--x-font-size,16px)}'
+ 'html[data-x-theme="dark"]{--navy:#101823;--ink:#e9eef7;--muted:#aebbcd;--line:#2f4359;--bg:#0c131d}'
+ 'html[data-x-theme="dark"] body{background:#0c131d;color:#e9eef7}'
+ 'html[data-x-theme="dark"] .app-shell{background:#141e2c;box-shadow:0 24px 70px #00000088}'
+ 'html[data-x-theme="dark"] .conversation,html[data-x-theme="dark"] .security-panel{background:#141e2c}'
+ 'html[data-x-theme="dark"] .topbar{border-color:#2f4359}'
+ 'html[data-x-theme="dark"] .contact h1{color:#eef2fa}html[data-x-theme="dark"] .contact p{color:#aebbcd}'
+ 'html[data-x-theme="dark"] .icon-button{background:#1a2636;border-color:#33475e;color:#c6d3e6}'
+ 'html[data-x-theme="dark"] .security-ribbon{background:#122b28;color:#8fd9c6}'
+ 'html[data-x-theme="dark"] .message-area{background:#0f1722}'
+ 'html[data-x-theme="dark"] .welcome-card{color:#b9c5d8}html[data-x-theme="dark"] .welcome-card h2{color:#f0f4fb}'
+ 'html[data-x-theme="dark"] .welcome-card button,html[data-x-theme="dark"] .security-button{background:#1a2636;border-color:#33475e;color:#9db8f5}'
+ 'html[data-x-theme="dark"] .message-bubble{background:#1e2c40;color:#e9eef7}html[data-x-theme="dark"] .outgoing .message-bubble{background:#14332c;color:#d9f5ec}html[data-x-theme="dark"] .message time{color:#8ea0b5}'
+ 'html[data-x-theme="dark"] .composer-wrap{border-color:#2f4359}html[data-x-theme="dark"] .composer{background:#101b29;border-color:#33475e}html[data-x-theme="dark"] .composer textarea{color:#e9eef7}html[data-x-theme="dark"] .composer textarea::placeholder{color:#7d8fa6}html[data-x-theme="dark"] .composer-wrap>p{color:#7d8fa6}html[data-x-theme="dark"] .barcode-button{color:#9db8f5}'
+ 'html[data-x-theme="dark"] .panel-heading h2{color:#eef2fa}html[data-x-theme="dark"] .panel-heading p,html[data-x-theme="dark"] .security-score p{color:#9fb0c4}html[data-x-theme="dark"] .security-score strong{color:#eef2fa}'
+ 'html[data-x-theme="dark"] .score-ring{background:radial-gradient(closest-side,#141e2c 76%,transparent 78%),conic-gradient(#6bd0ba 100%,#2a3a4f 0)}html[data-x-theme="dark"] .score-ring span{color:#7fe0c9}html[data-x-theme="dark"] .score-ring small{color:#7fa3a0}'
+ 'html[data-x-theme="dark"] .protocol-stack>div{border-color:#2f4359}html[data-x-theme="dark"] .protocol-stack strong{color:#e6ebf5}html[data-x-theme="dark"] .protocol-stack small{color:#9fb0c4}'
+ 'html[data-x-theme="dark"] .fingerprint code{background:#101b29;color:#c6d3e6}html[data-x-theme="dark"] .fingerprint p,html[data-x-theme="dark"] .label-row{color:#9fb0c4}html[data-x-theme="dark"] .label-row button{color:#9db8f5}'
+ 'html[data-x-theme="dark"] .modal-content{background:#182435;color:#e9eef7}html[data-x-theme="dark"] .modal h2{color:#f0f4fb}html[data-x-theme="dark"] .modal p{color:#aebdce}html[data-x-theme="dark"] .modal label{color:#c9d4e4}'
+ 'html[data-x-theme="dark"] .modal input,html[data-x-theme="dark"] .modal textarea,html[data-x-theme="dark"] .settings-modal select{background:#0f1a28;color:#e9eef7;border-color:#3a5069}html[data-x-theme="dark"] .modal input::placeholder,html[data-x-theme="dark"] .modal textarea::placeholder{color:#7d8fa6}'
+ 'html[data-x-theme="dark"] .guide-grid>div{border-color:#2f4359;background:#141f30}html[data-x-theme="dark"] .guide-grid strong{color:#e6ebf5}html[data-x-theme="dark"] .guide-grid small{color:#a3b3c7}html[data-x-theme="dark"] .guide-grid b{color:#6fd5bd}'
+ 'html[data-x-theme="dark"] .qr-wrap{background:#0f1a28}html[data-x-theme="dark"] .transfer-meta{color:#9fb0c4}html[data-x-theme="dark"] .export-row button{background:#1a2636;border-color:#33475e;color:#c6d3e6}'
+ 'html[data-x-theme="dark"] .donate-row{background:#141f30;border-color:#2f4359;color:#dbe3f0}html[data-x-theme="dark"] .donate-row code{color:#9fb0c4}html[data-x-theme="dark"] .donate-row span{color:#9db8f5}'
+ 'html[data-x-theme="dark"] .about-modal ol{color:#aebdce}html[data-x-theme="dark"] .about-modal a{color:#9db8f5}'
+ 'html[data-x-theme="dark"] .phrase-tips{color:#9fb0c4}html[data-x-theme="dark"] #phraseStrength{color:#8fd9c6}'
+ 'html[data-x-theme="dark"] .recipient-heading{color:#8ea0b5}html[data-x-theme="dark"] .msg-count{color:#8ea0b5}'
+ '.settings-actions{display:grid;gap:9px;margin:18px 0}.settings-actions button,.settings-modal select{border:1px solid var(--line);border-radius:10px;padding:11px;background:#f5f8fc;color:var(--ink);font:inherit;font-weight:700}html[data-x-theme="dark"] .settings-actions button,html[data-x-theme="dark"] .settings-modal select{background:#1a2636;border-color:#33475e;color:#e9eef7}.settings-modal input[type="range"]{width:100%}.danger-button{color:#b42318!important;border-color:#efb4ae!important}html[data-x-theme="dark"] .danger-button{color:#ff9d94!important;border-color:#7a3a36!important;background:#2a1a19!important}.settings-modal label{display:grid;gap:7px;margin-top:13px;font-weight:700}'
+ '.msg-count{font:9px monospace;color:#9aa7b6;text-align:right;margin-top:4px}'
+ '.message-bubble,.welcome-card p,.modal p,.composer textarea{font-size:calc(var(--x-font-size,16px)*0.75)}'
+ '.welcome-card h2,.modal h2{font-size:calc(var(--x-font-size,16px)*1.25)}'
+ '.contact h1,.protocol-stack strong{font-size:calc(var(--x-font-size,16px)*0.875)}'; document.head.append(settingStyles);
function readSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } }
function applySettings(settings = readSettings()) { const theme = ['system', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'system'; const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; document.documentElement.dataset.xTheme = resolved; try { document.querySelector('meta[name="theme-color"]').content = resolved === 'dark' ? '#0c131d' : '#17212b'; } catch {} const size = Math.min(20, Math.max(14, Number(settings.fontSize) || 16)); document.documentElement.style.setProperty('--x-font-size', `${size}px`); $('#themeSetting').value = theme; $('#fontSetting').value = size; $('#fontValue').textContent = `${size}px`; }
function saveSettings(next) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); applySettings(next); }
applySettings();
$('#themeSetting').onchange = event => saveSettings({ ...readSettings(), theme: event.target.value });
$('#fontSetting').oninput = event => saveSettings({ ...readSettings(), fontSize: Number(event.target.value) });
function localBackup() { const data = {}; [PROFILE_KEY, SETTINGS_KEY].forEach(key => { const value = localStorage.getItem(key); if (value !== null) data[key] = value; }); const envelopes = chatStore.list.filter(m => m.sealed).map(m => ({ sealed: m.sealed, via: m.via, ts: m.ts })); return { format: 'x-messenger-local-backup-v2', exportedAt: new Date().toISOString(), data, envelopes }; }
function openEnvelope(id) {
  const m = chatStore.list.find(x => x.id === id);
  if (!m || !m.sealed) return;
  currentVia = m.via || 'qr';
  $('#payloadInput').value = m.sealed;
  openModal('#receiveDialog');
  $('#receiveStatus').textContent = 'Sealed envelope loaded. Enter the phrase to decrypt.';
}
$('#exportData').onclick = () => { const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(localBackup(), null, 2)], { type: 'application/json' })), download: `x-messenger-backup-${Date.now()}.json` }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); $('#settingsStatus').textContent = 'Local backup downloaded (labels, settings, sealed envelopes — never plaintext or phrases). Store it securely.'; };
$('#restoreData').onclick = () => $('#restoreFile').click();
$('#restoreFile').onchange = async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 512 * 1024) throw new Error('Backup too large (max 512KB).'); const backup = JSON.parse(await file.text()); if ((backup.format !== 'x-messenger-local-backup-v2' && backup.format !== 'x-messenger-local-backup-v1') || !backup.data || typeof backup.data !== 'object') throw new Error('Invalid X Messenger backup.'); for (const key of [PROFILE_KEY, SETTINGS_KEY]) { const v = backup.data[key]; if (v === undefined) continue; if (typeof v !== 'string' || v.length > 100 * 1024) throw new Error('Invalid backup entry.'); if (key === PROFILE_KEY) { const arr = JSON.parse(v); if (!Array.isArray(arr) || arr.length > 100) throw new Error('Invalid recipient list.'); for (const p of arr) { if (!p || typeof p.name !== 'string' || !p.name.trim()) throw new Error('Invalid recipient entry.'); } } localStorage.setItem(key, v); } let n = 0; if (Array.isArray(backup.envelopes)) { if (backup.envelopes.length > 500) throw new Error('Too many envelopes (max 500).'); for (const e of backup.envelopes) { if (!e || typeof e.sealed !== 'string' || !e.sealed.startsWith('XM1.') || e.sealed.length > 32772) throw new Error('Invalid sealed envelope.'); chatStore.list.push({ id: `m${++chatStore.seq}-${Date.now().toString(36)}`, dir: 'incoming', text: '', sealed: e.sealed, via: typeof e.via === 'string' ? e.via.slice(0, 8) : '', ts: Number(e.ts) || Date.now(), viewOnce: false, expiresAt: 0, sealedOnly: true }); n++; } } renderProfiles(); applySettings(); renderChat(); $('#settingsStatus').textContent = n ? `Backup restored on this device (+${n} sealed envelopes — tap 🔒 to open).` : 'Backup restored on this device.'; } catch (error) { $('#settingsStatus').textContent = error.message; } event.target.value = ''; };
$('#deleteData').onclick = () => { if (!confirm('Delete ALL X Messenger data from this device (labels, settings, session messages, sealed envelopes)? This cannot be undone.')) return; const labels = profiles().length; const msgs = chatStore.list.length; wipeSession(); currentPayload = ''; [PROFILE_KEY, SETTINGS_KEY, 'x-messenger-why-seen-v1'].forEach(key => { try { localStorage.removeItem(key); } catch {} }); activeProfileId = null; renderProfiles(); applySettings({}); $('#settingsStatus').textContent = `Verified wipe: ${labels} label(s), settings, ${msgs} session message(s) removed. Reload for a clean slate.`; };
$('#openSecurityGuide').onclick = () => { settingDialog.close(); openModal('#securityDialog'); };
function validDomainUi(d) { return typeof d === 'string' && /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i.test(d.trim()); }
async function refreshConn() {
  try {
    const r = await fetch('/api/info', { cache: 'no-store' });
    if (!r.ok) throw new Error('no api');
    const info = await r.json();
    const where = info.bind === 'vps' ? `on VPS ${info.domain || info.host} (normal HTTPS; provider/DNS see domain+IP+sizes)` : info.bind === 'lan' ? 'on LAN (observable encrypted TLS)' : 'on loopback only (this device, zero egress)';
    $('#connStatus').textContent = `Running ${where} at https://${info.host}${info.port === 443 ? '' : `:${info.port}`} · v${info.version}`;
    if (!$('#portSetting').value) $('#portSetting').placeholder = `${info.port} (current)`;
    if (info.domain && !$('#domainSetting').value) $('#domainSetting').placeholder = `${info.domain} (current)`;
    const t = info.tls || {};
    $('#tlsStatus').textContent = `SHA256 ${t.fingerprint256 || '—'} · ${t.validFrom || ''} → ${t.validTo || ''} · SAN ${t.san || ''} · issuer ${t.issuer || ''}`;
    $('#tlsStatus').dataset.fp = t.fingerprint256 || '';
  } catch {
    try {
      $('#connStatus').textContent = 'Connection info unavailable (Android serves assets directly and stays offline; port/domain/TLS apply to Linux GUI: x-messenger setup).';
      $('#tlsStatus').textContent = 'TLS info unavailable here. On Linux run: x-messenger gui --cert-info';
    } catch {}
  }
}
const _openSettings = openModal;
$('#copyTlsFp').onclick = async () => { try { await navigator.clipboard.writeText($('#tlsStatus').dataset.fp || ''); clearClipboardLater(); $('#tlsStatus').textContent += ' — copied (clears in 30s)'; } catch {} };
$('#regenCertInfo').onclick = () => { $('#settingsStatus').textContent = 'Loopback/LAN self-signed: quit GUI, run: x-messenger gui --regen-cert [--lan]. VPS Let’s Encrypt: see docs/vps-domain-cloudflare.md, then compare the new SHA256 fingerprint in person.'; };
$('#applyPort').onclick = () => { const p = Number($('#portSetting').value); if (!Number.isInteger(p) || p < 1 || p > 65535) { $('#settingsStatus').textContent = 'Port must be 1–65535 (1024+ recommended; 443 needs capability).'; return; } $('#settingsStatus').textContent = `Port staged: ${p}. Quit GUI and run: x-messenger gui --port ${p}. Defaults: 8443 local/LAN, 443 VPS.`; };
$('#enableLan').onclick = () => { if (!$('#lanConsent').checked) { $('#settingsStatus').textContent = 'Tick consent first: LAN TLS is encrypted but observable (IP/port/sizes).'; return; } const p = Number($('#portSetting').value) || 8443; $('#settingsStatus').textContent = `To share on LAN: quit GUI and run: x-messenger gui --lan --port ${p}. Others on your network will see encrypted connections — compare cert fingerprint in person.`; };
$('#enableVps').onclick = () => { const d = ($('#domainSetting').value || '').trim().toLowerCase(); if (!$('#lanConsent').checked) { $('#settingsStatus').textContent = 'Tick consent first: VPS TLS is normal HTTPS but provider/DNS see domain+IP+sizes.'; return; } if (!validDomainUi(d)) { $('#settingsStatus').textContent = 'Enter your public domain first, e.g. msg.example.com (needs DNS + Let’s Encrypt; see docs/vps-domain-cloudflare.md).'; return; } const p = Number($('#portSetting').value) || 443; $('#settingsStatus').textContent = `To serve your domain: quit GUI and run: x-messenger gui --vps --domain ${d} --port ${p}. Keep Cloudflare grey-cloud (DNS-only) for end-to-end (content stays XM1).`; };
$('#backLoopback').onclick = () => { $('#settingsStatus').textContent = 'To return to safest offline mode: quit GUI and run: x-messenger gui --loopback --port 8443.'; };
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'settings') setTimeout(refreshConn, 50); }));
