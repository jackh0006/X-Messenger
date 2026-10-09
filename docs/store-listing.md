# Play Store listing — X Messenger (copy/paste ready)

## Short description (≤80 chars)
Offline encrypted QR courier — no account, no server

## Full description
No signal? No account? Send it anyway.

X Messenger seals messages ON your device and hands them over as a QR code, copied text, or .xmsg file. The receiver scans and decrypts offline. Nothing uploaded, ever.

WHY IT'S DIFFERENT TO ANY MESSENGER
• No signal needed — airplane mode, outages, travel, censored Wi-Fi. If WhatsApp needs the internet, X needs only eyesight.
• No account needed — no SIM, phone number, email, or signup. Names are local labels only.
• No server to leak — nothing to hack, subpoena, or sell. Android has zero Internet permission. Linux runs on 127.0.0.1 only.

HOW IT WORKS IN 20 SECONDS
1. Write a message, choose a one-time shared phrase (four uncommon words).
2. Show the QR. Tell the phrase in person — it never goes inside the QR.
3. They scan, enter the phrase, tap Decrypt on this device.

BUILT FOR OFFLINE TRUST
• AES-256-GCM authenticated encryption, PBKDF2-SHA256 600,000 iterations, fresh salt+nonce per message, versioned XM1 payload.
• Camera only for QR scan. Backups disabled. Cleartext disabled. Local delete included.
• Free, open-source (MIT), no ads, no premium, no analytics.

HONEST LIMITS
No app is unhackable. Weak/reused phrases, compromised phones, or shoulder-surfing can expose a message. No forward secrecy or identity verification. Needs independent audit before high-risk use. See in-app Security properties.

Support: jackh109867@gmail.com

## Data safety (enter exactly)
- Collects data? No. Shares data? No. Ads? No. Analytics? No.
- Camera: App functionality → QR scanning, ephemeral, never uploaded, user can deny and paste text instead.
- No account, no login, no purchases.

## Content / access
- Category: Communication. Rating: Everyone. No ads, no IAP.
- App access: no login. Reviewer path: New local chat → type → Seal with phrase “test four words demo” → show QR → Receive → paste → Decrypt.

## Graphics checklist
- 512x512 icon, 1024x500 feature, 4–8 phone screenshots (EN): 1) welcome “No signal…” 2) seal QR 3) receive scan 4) settings + local users.
- Target SDK 37, current versionCode/versionName (see Releases page), package com.jackh0006.xmessenger.
- Upload signed .aab only (debug APK never to Play).
