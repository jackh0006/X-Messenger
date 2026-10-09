# VPS private mode — bedtime-story guide

Imagine your VPS is a toy box at a friend's house (the provider). You keep
secret notes inside. The friend promises not to peek, but they *could* open
the box, and the mailman *does* see envelopes going in and out. Your words
inside the envelopes stay locked if you follow these rules.

## The 3 boxes (pick one like picking shoes)

1. **This device (loopback)** — the notes never leave your pocket.
 Address: `https://127.0.0.1:8443`. Internet used: ZERO. Safest. Default.
2. **LAN** — notes walk to the next room with a locked box. Neighbors can
 see someone walking with a box (IP/port/sizes) but cannot open it.
3. **My VPS domain** — notes fly to your far-away house with normal mail
 (`https://msg.example.com`, port 443). The mailman sees the address and
 how many letters, but NOT your words (they are XM1-locked end-to-end).

## Who can see what (honest picture)

| Who | Sees in VPS mode | Sees your WORDS? |
| --- | --- | --- |
| VPS provider (house owner) | VM on/off, disk/RAM snapshots, network sizes/times | NO, if phrase never on server and disk has only ciphertext |
| DNS / Cloudflare (phone book) | `msg.example.com → 1.2.3.4` lookups | NO words, only address |
| Network / DPI / ISP (road cameras) | domain (SNI), IP, port 443, timing, sizes | NO words (TLS + XM1 double lock) |
| Cloudflare orange cloud (if you turn it on) | EVERYTHING (it opens TLS) | YES — avoid for secrets! Use grey cloud DNS-only |
| Thief with your phrase | Everything | YES — keep phrase off the server, tell it in person |

## Rules to stay safe (like brushing teeth every day)

1. **Phrase never lives on the VPS.** Type it only on your phone/laptop.
 Never paste it into VPS terminal history, tickets, or emails.
2. **Grey cloud only.** Cloudflare Proxy OFF (DNS-only). Orange = they read mail.
3. **Lock the doors:** SSH keys only (no passwords), `ufw allow 22/80/443`
 from your IP if possible, automatic updates ON:
 ```bash
 sudo apt install -y unattended-upgrades
 sudo dpkg-reconfigure -plow unattended-upgrades
 ```
4. **One key per house:** upload key (`~/secure/`) backed up offline on USB,
 VPS keys (`tls/vps-*`, `0600`) never emailed. Renew Let's Encrypt auto.
5. **Small peeks:** `lastlog`, `ufw status`, `certbot certificates`,
 Settings → TLS fingerprint compare with friends in person every month.
6. **Backups are locked boxes only:** export `x-messenger-*.json` (labels,
 never phrases) to encrypted USB. Provider backups may include disk —
 that is OK because words are XM1 ciphertext, but rotate phrases anyway.
7. **If VPS is stolen/hacked:** make a new phrase, new cert
 (`x-messenger gui --regen-cert` for local; re-run certbot for VPS),
 tell friends the new fingerprint in person, throw old phrase away.

## Offline still means offline (pinkie promise)

- Default `loopback` touches NO internet: no DNS, no fetch except
 same-device `/api/info`. Android APK has NO internet permission at all.
- Test it like this: turn on airplane mode → seal → QR → scan with other
 phone → decrypt. It works with zero bars. That is the proof.
- VPS/LAN modes only start when YOU type `--lan` / `--vps`. The app never
 switches by itself.

## What "most encrypted" really means here

- Every message: `AES-256-GCM` lock + `PBKDF2 600k` key stretch + new
 random salt + nonce + `XM1.` version tag. Wrong phrase or one changed
 letter = door stays shut.
- Road lock (TLS 1.2+): normal HTTPS on 443 with a real Let's Encrypt
 sticker, so traffic looks like any website (not sneaky, just normal).
- Two locks total: road lock (TLS) + letter lock (XM1). Even the VPS owner
 with the road key cannot read the letter without your phrase.

## If you are scared, do this (emergency cuddle plan)

1. Go back to safest: `x-messenger gui --loopback --port 8443`.
2. Delete VPS copy: stop server, `shred` `tls/vps-*`, remove DNS `msg` record.
3. Make a brand-new phrase with 4 secret words (like
 `purple horse dances quietly`) and tell friends face-to-face.
4. Compare fingerprints again, like matching puzzle pieces.

No software is magic armor. These steps make you as safe as an offline
courier with an optional normal-looking online house can honestly be.
