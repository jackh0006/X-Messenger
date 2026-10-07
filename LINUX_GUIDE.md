# Use X Messenger on Linux

The GUI opens in a separate Chrome app window at a local HTTPS address on
`127.0.0.1`. It has no remote proxy or Internet route; the server accepts
connections only from this device and selects the first free port.

## Install the GUI app once

```bash
cd /home/mhh06/cipherlink
npm run linux:install
```

Open **X Messenger** from the Linux application menu. It opens in its own window.

## Use the terminal command

Open the GUI:

```bash
cipherlink gui
```

Encrypt text for a QR or copied transfer:

```bash
cipherlink encrypt "Meet at 09:00"
```

Decrypt a received transfer:

```bash
cipherlink decrypt "XM1.…"
```

Keep the GUI terminal running while the GUI is open. The desktop launcher handles this automatically.
