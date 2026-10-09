// SPDX-License-Identifier: MIT
package com.jackh0006.xmessenger;

import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * NFC tag reader/writer for sealed XM1 envelopes (v1.0.8).
 * Reader-mode only: no Beam, no HCE, no background dispatch.
 * Accepts MIME records (preferred) and well-known Text records.
 * Plaintext phrases never touch this code — only sealed envelopes.
 */
@CapacitorPlugin(name = "NfcPlugin")
public class NfcPlugin extends Plugin {
    private static final String MIME = "application/x-xmessenger";
    private static final long TIMEOUT_MS = 30000;
    private NfcAdapter nfc;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PluginCall pending;
    private boolean writing;

    @Override
    public void load() {
        try {
            nfc = NfcAdapter.getDefaultAdapter(getContext());
        } catch (Exception e) {
            nfc = null;
        }
    }

    @PluginMethod
    public void readTag(PluginCall call) {
        if (!ready(call)) return;
        writing = false;
        pending = call;
        startReader();
        armTimeout(call);
    }

    @PluginMethod
    public void writeTag(PluginCall call) {
        String payload = call.getString("payload", "");
        if (payload == null || !payload.startsWith("XM1.")) {
            call.reject("NFC carries sealed XM1 envelopes only.");
            return;
        }
        // Sized in UTF-8 bytes like the JS gate (payloads are ASCII base64url).
        if (payload.getBytes(StandardCharsets.UTF_8).length > 800) {
            call.reject("Too big for NFC. Use QR, file, or Bluetooth.");
            return;
        }
        if (!ready(call)) return;
        writing = true;
        pending = call;
        startReader();
        armTimeout(call);
    }

    private boolean ready(PluginCall call) {
        if (nfc == null) {
            call.reject("NFC not available on this device.");
            return false;
        }
        try {
            if (!nfc.isEnabled()) {
                call.reject("NFC is switched off. Enable it in system settings.");
                return false;
            }
        } catch (SecurityException e) {
            call.reject("NFC permission denied.");
            return false;
        }
        return true;
    }

    private void startReader() {
        Bundle opts = new Bundle();
        opts.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 5000);
        try {
            nfc.enableReaderMode(
                getActivity(),
                this::onTag,
                NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
                opts);
        } catch (Exception e) {
            PluginCall call = pending;
            pending = null;
            if (call != null) call.reject("Could not start NFC reader.");
        }
    }

    private void armTimeout(PluginCall call) {
        handler.postDelayed(() -> {
            if (pending == call) {
                pending = null;
                stopReader();
                call.reject("NFC timed out. Hold the tag steady against the phone.");
            }
        }, TIMEOUT_MS);
    }

    private void stopReader() {
        try {
            if (nfc != null) nfc.disableReaderMode(getActivity());
        } catch (Exception ignored) {
        }
    }

    private void onTag(Tag tag) {
        PluginCall call = pending;
        pending = null;
        stopReader();
        if (call == null) return;
        try {
            if (writing) {
                doWrite(call, tag);
            } else {
                doRead(call, tag);
            }
        } catch (Exception e) {
            call.reject("NFC tag error: " + e.getMessage());
        }
    }

    private void doRead(PluginCall call, Tag tag) throws Exception {
        Ndef ndef = Ndef.get(tag);
        if (ndef == null) {
            call.reject("Tag is not NDEF formatted.");
            return;
        }
        ndef.connect();
        try {
            NdefMessage msg = ndef.getNdefMessage();
            if (msg == null) {
                call.reject("Tag is empty.");
                return;
            }
            for (NdefRecord rec : msg.getRecords()) {
                String text = recordText(rec);
                if (text != null && text.startsWith("XM1.")) {
                    JSObject out = new JSObject();
                    out.put("payload", text);
                    call.resolve(out);
                    return;
                }
            }
            call.reject("No X Messenger envelope on that tag.");
        } finally {
            try {
                ndef.close();
            } catch (Exception ignored) {
            }
        }
    }

    private void doWrite(PluginCall call, Tag tag) throws Exception {
        String payload = call.getString("payload", "");
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        NdefRecord rec = NdefRecord.createMime(MIME, bytes);
        NdefMessage msg = new NdefMessage(new NdefRecord[]{rec});
        Ndef ndef = Ndef.get(tag);
        if (ndef == null) {
            call.reject("Tag is not NDEF formatted (formatting tags is not supported).");
            return;
        }
        ndef.connect();
        try {
            if (!ndef.isWritable()) {
                call.reject("Tag is read-only.");
                return;
            }
            if (ndef.getMaxSize() < msg.toByteArray().length) {
                call.reject("Tag too small — needs an NTAG216-class tag.");
                return;
            }
            ndef.writeNdefMessage(msg);
            JSObject out = new JSObject();
            out.put("written", bytes.length);
            call.resolve(out);
        } finally {
            try {
                ndef.close();
            } catch (Exception ignored) {
            }
        }
    }

    private static String recordText(NdefRecord rec) {
        try {
            byte[] payload = rec.getPayload();
            if (payload == null) return null;
            short tnf = rec.getTnf();
            if (tnf == NdefRecord.TNF_MIME_MEDIA) {
                return new String(payload, StandardCharsets.UTF_8);
            }
            if (tnf == NdefRecord.TNF_WELL_KNOWN
                && rec.getType() != null
                && rec.getType().length == 1
                && rec.getType()[0] == 'T') {
                int langLen = payload.length > 0 ? (payload[0] & 0x3F) : 0;
                if (payload.length <= 1 + langLen) return null;
                return new String(
                    Arrays.copyOfRange(payload, 1 + langLen, payload.length),
                    StandardCharsets.UTF_8);
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }
}
