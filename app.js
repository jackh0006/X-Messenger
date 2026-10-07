// SPDX-License-Identifier: MIT
let pendingText = '', currentPayload = '', scanning = false, scanTimer;
const $ = (s) => document.querySelector(s);
const { encryptText, decryptText } = XMessengerCrypto;
const donations = [
  ['Bitcoin', 'bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83'], ['DOGE', 'D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC'],
  ['Ethereum / USDT ERC20 / BNB', '0xdad428900a4359be8f76b3062df34211582e09eb'], ['TRX / USDT TRC20', 'TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf'],
  ['SOL / USDT SPL / USDC SPL', 'BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL'], ['XRP', 'rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9'],
  ['TON', 'UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX'], ['LTC', 'ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8']
];
function openModal(id) { $(id).showModal(); }
function wipeSecrets() {
  for (const sel of ['#phraseInput', '#receivePhrase']) { const el = $(sel); if (el) el.value = ''; }
  pendingText = '';
  try { if (strength) strength.textContent = 'Strength: enter a phrase'; } catch {}
}
function closeAll() { wipeSecrets(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); stopScanner(); }
function clearClipboardLater(label) {
  setTimeout(async () => { try { await navigator.clipboard.writeText(''); } catch {} }, 30000);
}
function timeNow() { return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
function addMessage(text, direction = 'outgoing') { const article = document.createElement('article'); article.className = `message ${direction}`; const bubble = document.createElement('div'); bubble.className = 'message-bubble'; bubble.append(document.createTextNode(text)); const stamp = document.createElement('time'); stamp.textContent = `${timeNow()}${direction === 'outgoing' ? '  ✓' : ''}`; bubble.append(stamp); article.append(bubble); $('#messages').querySelector('.welcome-card')?.remove(); $('#messages').append(article); $('#messages').scrollTop = $('#messages').scrollHeight; }
function setView(view) { const views = { saved: ['▣', 'Saved Messages', 'Private notes — not uploaded anywhere'], receive: ['⌗', 'Receive a message', 'Scan an encrypted QR or paste ciphertext'], settings: ['⚙', 'Settings & privacy', 'Theme, data, and security controls'] }; document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view)); $('#viewIcon').textContent = views[view][0]; $('#viewTitle').textContent = views[view][1]; $('#viewSubtitle').textContent = views[view][2]; if (view === 'receive') openModal('#receiveDialog'); if (view === 'settings') openModal('#settingsDialog'); }
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
$('#newTransfer').onclick = () => { setView('saved'); $('#messageInput').focus(); };
$('#sealTransfer').onclick = async () => { let phrase = $('#phraseInput').value; if (!phrase) { $('#phraseInput').setCustomValidity('Enter a shared phrase. Any non-empty phrase is allowed.'); $('#phraseInput').reportValidity(); return; } const button = $('#sealTransfer'); button.disabled = true; button.textContent = 'Sealing locally…'; try { const text = pendingText; const payload = await encryptText(text, phrase); phrase = ''; $('#phraseInput').value = ''; addMessage(text); $('#messageInput').value = ''; updateMsgCount(); closeAll(); await presentTransfer(payload); } catch (e) { $('#phraseInput').setCustomValidity(e.message || 'Could not seal.'); $('#phraseInput').reportValidity(); } finally { button.disabled = false; button.innerHTML = 'Seal and create QR <span>→</span>'; $('#phraseInput').value = ''; } };
$('#openReceive').onclick = () => openModal('#receiveDialog');
$('#decryptPayload').onclick = async () => { const status = $('#receiveStatus'); status.textContent = ''; let phrase = $('#receivePhrase').value; try { const text = await decryptText($('#payloadInput').value.trim(), phrase); phrase = ''; addMessage(text, 'incoming'); closeAll(); $('#payloadInput').value = ''; $('#receivePhrase').value = ''; } catch (e) { status.textContent = e.message || 'Could not decrypt: incorrect phrase or altered / unsupported transfer.'; } finally { phrase = ''; $('#receivePhrase').value = ''; } };
$('#copyPayload').onclick = async () => { try { await navigator.clipboard.writeText(currentPayload); clearClipboardLater(); $('#copyPayload').textContent = 'Copied (clears in 30s)'; setTimeout(() => $('#copyPayload').textContent = 'Copy encrypted text', 1300); } catch { $('#copyPayload').textContent = 'Copy unavailable'; } };
$('#downloadPayload').onclick = () => { const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([currentPayload], { type: 'text/plain' })), download: `x-messenger-${Date.now()}.xmsg` }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAll); document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#showSecurity').onclick = () => openModal('#securityDialog'); $('#learnMore').onclick = () => openModal('#whyDialog'); $('#showAbout').onclick = () => openModal('#aboutDialog'); $('#showDonate').onclick = () => openModal('#donateDialog'); $('#openDonate').onclick = () => { closeAll(); openModal('#donateDialog'); };
// Keep the in-app summary focused on properties the application can verify.
// The full threat model remains in SECURITY.md for publication and review.
$('#securityDialog').querySelector('.modal-content').innerHTML = '<div class="modal-kicker">SECURITY PROPERTIES</div><h2>Built for private offline transfer</h2><div class="guide-grid"><div><b>✈</b><p><strong>Works in airplane mode</strong><small>Android has no Internet permission. Linux accepts the GUI only on this device’s loopback address.</small></p></div><div><b>✓</b><p><strong>Authenticated encryption</strong><small>AES-256-GCM detects changed ciphertext when the correct phrase is used.</small></p></div><div><b>✓</b><p><strong>Phrase stays separate</strong><small>The shared phrase is never included in the QR code or encrypted payload.</small></p></div><div><b>✓</b><p><strong>Local recipient labels</strong><small>Names and notes stay on this device; no account or remote contact service is created.</small></p></div></div><p class="subtle">v1.0.2 · Unlike online messengers: no signal, no account, no server. Needs independent audit before high-risk use.</p>';
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
const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => n.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g).join(' '); $('#fingerprint').textContent = id.toUpperCase(); $('#deviceId').textContent = `ID ${id.slice(0, 9).toUpperCase()}`; $('#copyFingerprint').onclick = async () => { try { await navigator.clipboard.writeText(id.toUpperCase()); clearClipboardLater(); } catch {} };
const msgCount = document.createElement('div'); msgCount.id = 'msgCount'; msgCount.className = 'msg-count'; msgCount.textContent = '0 / 900';
try { $('#messageInput').after(msgCount); } catch {}
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
$('#newTransfer').onclick = () => { if (activeProfileId) $('#messageInput').focus(); else profileDialog.showModal(); };
renderProfiles();

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
function localBackup() { const data = {}; [PROFILE_KEY, SETTINGS_KEY].forEach(key => { const value = localStorage.getItem(key); if (value !== null) data[key] = value; }); return { format: 'x-messenger-local-backup-v1', exportedAt: new Date().toISOString(), data }; }
$('#exportData').onclick = () => { const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(localBackup(), null, 2)], { type: 'application/json' })), download: `x-messenger-backup-${Date.now()}.json` }); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); $('#settingsStatus').textContent = 'Local backup downloaded. Store it securely.'; };
$('#restoreData').onclick = () => $('#restoreFile').click();
$('#restoreFile').onchange = async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 200 * 1024) throw new Error('Backup too large (max 200KB).'); const backup = JSON.parse(await file.text()); if (backup.format !== 'x-messenger-local-backup-v1' || !backup.data || typeof backup.data !== 'object') throw new Error('Invalid X Messenger backup.'); for (const key of [PROFILE_KEY, SETTINGS_KEY]) { const v = backup.data[key]; if (typeof v !== 'string' || v.length > 100 * 1024) throw new Error('Invalid backup entry.'); if (key === PROFILE_KEY) { const arr = JSON.parse(v); if (!Array.isArray(arr) || arr.length > 100) throw new Error('Invalid recipient list.'); for (const p of arr) { if (!p || typeof p.name !== 'string' || !p.name.trim()) throw new Error('Invalid recipient entry.'); } } localStorage.setItem(key, v); } renderProfiles(); applySettings(); $('#settingsStatus').textContent = 'Backup restored on this device.'; } catch (error) { $('#settingsStatus').textContent = error.message; } event.target.value = ''; };
$('#deleteData').onclick = () => { if (!confirm('Delete all local X Messenger recipient labels and preferences from this device? This cannot be undone.')) return; [PROFILE_KEY, SETTINGS_KEY].forEach(key => localStorage.removeItem(key)); activeProfileId = null; renderProfiles(); applySettings({}); $('#settingsStatus').textContent = 'Local X Messenger data deleted.'; };
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
