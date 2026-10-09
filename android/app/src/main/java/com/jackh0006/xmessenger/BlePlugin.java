// SPDX-License-Identifier: MIT
package com.jackh0006.xmessenger;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.CRC32;

/**
 * BLE peripheral for sealed XM1 envelopes (v1.0.8).
 * Advertises the X Messenger GATT service; a nearby central (Linux GUI
 * Chrome) writes XMB frames to RX and subscribes to TX for replies.
 * The radio is hostile: frames are CRC-checked for transport errors, but
 * only the XM1 AEAD inside provides security. Proximity proves nothing.
 */
@CapacitorPlugin(name = "BlePlugin")
public class BlePlugin extends Plugin {
    private static final UUID SVC =
        UUID.fromString("9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6c");
    private static final UUID CHAR_TX =
        UUID.fromString("9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6d");
    private static final UUID CHAR_RX =
        UUID.fromString("9b7c2f4a-3e1d-4a5f-8c6b-1d2e3f4a5b6e");
    private static final UUID CCCD =
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler handler = new Handler(Looper.getMainLooper());
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattServer gattServer;
    private BluetoothDevice subscriber;
    private final Map<Integer, String> rxChunks = new HashMap<>();
    private int rxTotal = -1;
    private String completedPayload;
    private final List<String> txQueue = new ArrayList<>();

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        try {
            if (!startPeripheral()) {
                call.reject("Bluetooth unavailable, switched off, or advertising unsupported.");
                return;
            }
            JSObject out = new JSObject();
            out.put("service", SVC.toString());
            call.resolve(out);
        } catch (SecurityException e) {
            call.reject("Bluetooth permission denied — enable Nearby devices permission in system settings.");
        } catch (Exception e) {
            call.reject("Could not start Bluetooth advertising.");
        }
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        try {
            if (advertiser != null) {
                try {
                    advertiser.stopAdvertising(advertiseCallback);
                } catch (Exception ignored) {
                }
                advertiser = null;
            }
            if (gattServer != null) {
                try {
                    gattServer.close();
                } catch (Exception ignored) {
                }
                gattServer = null;
            }
            subscriber = null;
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not stop Bluetooth advertising.");
        }
    }

    @PluginMethod
    public void queueOutgoing(PluginCall call) {
        try {
            com.getcapacitor.JSArray arr = call.getArray("frames");
            if (arr == null || arr.length() == 0) {
                call.reject("No frames to send.");
                return;
            }
            synchronized (txQueue) {
                txQueue.clear();
                for (int i = 0; i < arr.length(); i++) txQueue.add(arr.getString(i));
            }
            flushTx();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not queue Bluetooth frames.");
        }
    }

    @PluginMethod
    public void pollIncoming(PluginCall call) {
        JSObject out = new JSObject();
        synchronized (rxChunks) {
            if (completedPayload != null) {
                out.put("payload", completedPayload);
                completedPayload = null;
                rxChunks.clear();
                rxTotal = -1;
            } else {
                out.put("payload", null);
            }
        }
        call.resolve(out);
    }

    private boolean startPeripheral() {
        Context ctx = getContext();
        BluetoothManager mgr =
            (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        if (mgr == null) return false;
        BluetoothAdapter adapter = mgr.getAdapter();
        if (adapter == null || !adapter.isEnabled()) return false;
        if (!adapter.isMultipleAdvertisementSupported()) return false;
        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) return false;
        gattServer = mgr.openGattServer(ctx, gattCallback);
        if (gattServer == null) return false;
        BluetoothGattService svc =
            new BluetoothGattService(SVC, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic tx = new BluetoothGattCharacteristic(
            CHAR_TX,
            BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ);
        tx.addDescriptor(descriptor());
        BluetoothGattCharacteristic rx = new BluetoothGattCharacteristic(
            CHAR_RX,
            BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE);
        svc.addCharacteristic(tx);
        svc.addCharacteristic(rx);
        gattServer.addService(svc);
        AdvertiseData data = new AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(new ParcelUuid(SVC))
            .build();
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .setTimeout(0)
            .build();
        advertiser.startAdvertising(settings, data, advertiseCallback);
        return true;
    }

    private BluetoothGattDescriptor descriptor() {
        BluetoothGattDescriptor d = new BluetoothGattDescriptor(
            CCCD,
            BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE);
        d.setValue(BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE);
        return d;
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
    };

    private final BluetoothGattServerCallback gattCallback = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED
                && device.equals(subscriber)) {
                subscriber = null;
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId,
            BluetoothGattDescriptor descriptor, boolean preparedWrite,
            boolean responseNeeded, int offset, byte[] value) {
            if (CCCD.equals(descriptor.getUuid())) {
                subscriber = device;
                descriptor.setValue(value);
                if (responseNeeded && gattServer != null) {
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null);
                }
                flushTx();
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
            BluetoothGattCharacteristic characteristic, boolean preparedWrite,
            boolean responseNeeded, int offset, byte[] value) {
            if (CHAR_RX.equals(characteristic.getUuid()) && value != null) {
                ingestFrame(new String(value, StandardCharsets.UTF_8));
            }
            if (responseNeeded && gattServer != null) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null);
            }
        }

        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId,
            int offset, BluetoothGattCharacteristic characteristic) {
            if (gattServer != null) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, new byte[0]);
            }
        }
    };

    private void ingestFrame(String frame) {
        // XMB.<total>.<idx>.<crc8>.<b64url> — transport check only; XM1 AEAD decides.
        String[] parts = frame.split("\\.", 5);
        if (parts.length != 5 || !"XMB".equals(parts[0])) return;
        int total;
        int idx;
        try {
            total = Integer.parseInt(parts[1]);
            idx = Integer.parseInt(parts[2]);
        } catch (NumberFormatException e) {
            return;
        }
        if (total < 1 || total > 2048 || idx < 0 || idx >= total) return;
        String chunk;
        try {
            chunk = new String(b64urlDecode(parts[4]), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return;
        }
        if (!crc8(total + "." + idx + "." + chunk).equals(parts[3])) return;
        synchronized (rxChunks) {
            if (rxTotal == -1) rxTotal = total;
            if (total != rxTotal) return;
            if (!rxChunks.containsKey(idx)) rxChunks.put(idx, chunk);
            if (rxChunks.size() == rxTotal) {
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < rxTotal; i++) sb.append(rxChunks.get(i));
                completedPayload = sb.toString();
            }
        }
    }

    private void flushTx() {
        final BluetoothGattServer server = gattServer;
        final BluetoothDevice peer = subscriber;
        if (server == null || peer == null) return;
        final List<String> frames;
        synchronized (txQueue) {
            if (txQueue.isEmpty()) return;
            frames = new ArrayList<>(txQueue);
            txQueue.clear();
        }
        new Thread(() -> {
            try {
                BluetoothGattService svc = server.getService(SVC);
                if (svc == null) return;
                BluetoothGattCharacteristic tx = svc.getCharacteristic(CHAR_TX);
                if (tx == null) return;
                for (String f : frames) {
                    tx.setValue(f.getBytes(StandardCharsets.UTF_8));
                    server.notifyCharacteristicChanged(peer, tx, false);
                    Thread.sleep(30);
                }
            } catch (Exception ignored) {
            }
        }).start();
    }

    private static byte[] b64urlDecode(String s) {
        String t = s.replace('-', '+').replace('_', '/');
        int pad = (4 - (t.length() % 4)) % 4;
        StringBuilder sb = new StringBuilder(t);
        for (int i = 0; i < pad; i++) sb.append('=');
        return Base64.decode(sb.toString(), Base64.DEFAULT);
    }

    private static String crc8(String s) {
        CRC32 crc = new CRC32();
        crc.update(s.getBytes(StandardCharsets.UTF_8));
        return String.format("%08x", crc.getValue());
    }
}
