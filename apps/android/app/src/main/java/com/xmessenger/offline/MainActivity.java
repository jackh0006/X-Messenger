//! Android App - Offline Messenger UI
//! Modern, beautiful UI like Telegram with offline-first design

package com.xmessenger.offline;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.NavigationUI;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.snackbar.Snackbar;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.NotFoundException;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import com.xmessenger.offline.databinding.ActivityMainBinding;
import com.xmessenger.offline.ui.chats.ChatsViewModel;
import com.xmessenger.offline.ui.contacts.ContactsViewModel;
import com.xmessenger.offline.ui.settings.SettingsViewModel;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    private ActivityMainBinding binding;
    private NavController navController;
    private MainViewModel viewModel;
    private ExecutorService executorService;

    private final ActivityResultLauncher<Intent> pickImageLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                Uri imageUri = result.getData().getData();
                if (imageUri != null) {
                    viewModel.setAvatarUri(imageUri);
                }
            }
        }
    );

    private final ActivityResultLauncher<Intent> scanQrLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                Uri qrUri = result.getData().getData();
                if (qrUri != null) {
                    processQrCode(qrUri);
                }
            }
        }
    );

    private final ActivityResultLauncher<String> requestCameraPermission = registerForActivityResult(
        new ActivityResultContracts.RequestPermission(),
        granted -> {
            if (granted) {
                openCameraForQrScan();
            } else {
                Toast.makeText(this, "Camera permission required for QR scanning", Toast.LENGTH_SHORT).show();
            }
        }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        viewModel = new ViewModelProvider(this).get(MainViewModel.class);
        executorService = Executors.newSingleThreadExecutor();

        setupNavigation();
        setupBottomNavigation();
        setupObservers();
        setupQrScanner();
        checkPermissions();
    }

    private void setupNavigation() {
        NavHostFragment navHostFragment = (NavHostFragment) getSupportFragmentManager()
            .findFragmentById(R.id.nav_host_fragment);
        if (navHostFragment != null) {
            navController = navHostFragment.getNavController();
        }
    }

    private void setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_chats) {
                navController.navigate(R.id.chatsFragment);
                return true;
            } else if (itemId == R.id.nav_contacts) {
                navController.navigate(R.id.contactsFragment);
                return true;
            } else if (itemId == R.id.nav_settings) {
                navController.navigate(R.id.settingsFragment);
                return true;
            }
            return false;
        });

        NavigationUI.setupWithNavController(binding.bottomNavigation, navController);
    }

    private void setupObservers() {
        viewModel.getConnectionState().observe(this, state -> {
            runOnUiThread(() -> {
                switch (state) {
                    case CONNECTED:
                        binding.connectionStatus.setText("🟢 Connected via Cloudflare Tunnel");
                        binding.connectionStatus.setTextColor(ContextCompat.getColor(this, R.color.green));
                        break;
                    case CONNECTING:
                        binding.connectionStatus.setText("🟡 Connecting...");
                        binding.connectionStatus.setTextColor(ContextCompat.getColor(this, R.color.orange));
                        break;
                    case DISCONNECTED:
                        binding.connectionStatus.setText("🔴 Offline Mode");
                        binding.connectionStatus.setTextColor(ContextCompat.getColor(this, R.color.red));
                        break;
                }
            });
        });

        viewModel.getUnreadCount().observe(this, count -> {
            if (count > 0) {
                binding.badgeUnread.setText(String.valueOf(count));
                binding.badgeUnread.setVisibility(View.VISIBLE);
            } else {
                binding.badgeUnread.setVisibility(View.GONE);
            }
        });

        viewModel.getErrorMessage().observe(this, error -> {
            if (error != null && !error.isEmpty()) {
                Snackbar.make(binding.getRoot(), error, Snackbar.LENGTH_LONG).show();
            }
        });
    }

    private void setupQrScanner() {
        binding.fabScanQr.setOnClickListener(v -> {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                openCameraForQrScan();
            } else {
                requestCameraPermission.launch(Manifest.permission.CAMERA);
            }
        });

        binding.fabAddContact.setOnClickListener(v -> showAddContactDialog());
    }

    private void openCameraForQrScan() {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getPackageManager()) != null) {
            scanQrLauncher.launch(intent);
        }
    }

    private void processQrCode(Uri imageUri) {
        executorService.execute(() -> {
            try {
                InputStream inputStream = getContentResolver().openInputStream(imageUri);
                if (inputStream == null) return;

                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                if (bitmap == null) return;

                // Decode QR code
                RGBLuminanceSource source = new RGBLuminanceSource(bitmap.getWidth(), bitmap.getHeight(), getPixels(bitmap));
                BinaryBitmap binaryBitmap = new BinaryBitmap(new HybridBinarizer(source));
                QRCodeReader reader = new QRCodeReader();
                Result result = reader.decode(binaryBitmap);

                String qrContent = result.getText();
                runOnUiThread(() -> processQrContent(qrContent));

            } catch (NotFoundException e) {
                runOnUiThread(() -> Toast.makeText(this, "No QR code found in image", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Error processing QR: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        });
    }

    private int[] getPixels(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int[] pixels = new int[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);
        return pixels;
    }

    private void processQrContent(String content) {
        // Try to decode as base64 first
        String decoded;
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(content);
            try {
                // Try to decompress
                java.util.zip.Inflater inflater = new java.util.zip.Inflater();
                inflater.setInput(decoded);
                byte[] buffer = new byte[1024 * 1024]; // 1MB max
                int decompressedLength = inflater.inflate(buffer);
                inflater.end();
                decoded = new String(buffer, 0, decompressedLength, StandardCharsets.UTF_8);
            } catch (Exception e) {
                // Not compressed, use as-is
                decoded = new String(decoded, StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            // Not base64, use as-is
            decoded = content;
        }

        // Try to parse as contact
        try {
            com.xmessenger.offline.data.Contact contact = parseContact(decoded);
            if (contact != null) {
                showContactPreview(contact);
                return;
            }
        } catch (Exception e) {
            // Not a contact
        }

        // Try to parse as message/config
        try {
            if (decoded.startsWith("ss://") || decoded.startsWith("socks5://")) {
                showProxyConfigPreview(decoded);
                return;
            }
        } catch (Exception e) {
            // Not a proxy config
        }

        // Show raw content
        showRawQrContent(content);
    }

    private com.xmessenger.offline.data.Contact parseContact(String json) {
        try {
            com.google.gson.Gson gson = new com.google.gson.Gson();
            return gson.fromJson(decoded, com.xmessenger.offline.data.Contact.class);
        } catch (Exception e) {
            return null;
        }
    }

    private void showContactPreview(com.xmessenger.offline.data.Contact contact) {
        new MaterialAlertDialogBuilder(this)
            .setTitle("Add Contact")
            .setMessage("Add " + contact.getName() + "?\n\nFingerprint: " + contact.getFingerprint())
            .setPositiveButton("Add", (dialog, which) -> {
                viewModel.addContact(contact);
                Toast.makeText(this, "Contact added!", Toast.LENGTH_SHORT).show();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void showProxyConfigPreview(String config) {
        new MaterialAlertDialogBuilder(this)
            .setTitle("Proxy Configuration")
            .setMessage("Add this proxy configuration?\n\n" + config.substring(0, Math.min(200, config.length())) + "...")
            .setPositiveButton("Add", (dialog, which) -> {
                viewModel.addProxyConfig(config);
                Toast.makeText(this, "Proxy configuration added!", Toast.LENGTH_SHORT).show();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void showRawQrContent(String content) {
        new MaterialAlertDialogBuilder(this)
            .setTitle("QR Code Content")
            .setMessage(content.length() > 500 ? content.substring(0, 500) + "..." : content)
            .setPositiveButton("Copy", (dialog, which) -> {
                android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(android.content.ClipData.newPlainText("QR Content", content));
                Toast.makeText(this, "Copied to clipboard", Toast.LENGTH_SHORT).show();
            })
            .setNegativeButton("Close", null)
            .show();
    }

    private void showAddContactDialog() {
        View dialogView = getLayoutInflater().inflate(R.layout.dialog_add_contact, null);
        androidx.appcompat.widget.AppCompatEditText etName = dialogView.findViewById(R.id.etContactName);
        androidx.appcompat.widget.AppCompatEditText etServer = dialogView.findViewById(R.id.etServerAddress);
        androidx.appcompat.widget.AppCompatEditText etPort = dialogView.findViewById(R.id.etPort);
        androidx.appcompat.widget.AppCompatEditText etUser = dialogView.findViewById(R.id.etUsername);
        androidx.appcompat.widget.AppCompatEditText etPass = dialogView.findViewById(R.id.etPassword);

        new MaterialAlertDialogBuilder(this)
            .setTitle("Add Contact Manually")
            .setView(dialogView)
            .setPositiveButton("Add", (dialog, which) -> {
                String name = etName.getText().toString().trim();
                String server = etServer.getText().toString().trim();
                String portStr = etPort.getText().toString().trim();
                String user = etUser.getText().toString().trim();
                String pass = etPass.getText().toString().trim();

                if (name.isEmpty() || server.isEmpty() || portStr.isEmpty()) {
                    Toast.makeText(this, "Please fill all required fields", Toast.LENGTH_SHORT).show();
                    return;
                }

                int port;
                try {
                    port = Integer.parseInt(portStr);
                } catch (NumberFormatException e) {
                    Toast.makeText(this, "Invalid port number", Toast.LENGTH_SHORT).show();
                    return;
                }

                com.xmessenger.offline.data.Contact contact = new com.xmessenger.offline.data.Contact();
                contact.setName(name);
                contact.setServer(server);
                contact.setPort(port);
                contact.setUsername(user);
                contact.setPassword(pass);

                viewModel.addContact(contact);
                Toast.makeText(this, "Contact added!", Toast.LENGTH_SHORT).show();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void checkPermissions() {
        String[] permissions = {
            Manifest.permission.CAMERA
        };

        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(permissions, 100);
                break;
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 100) {
            for (int i = 0; i < permissions.length; i++) {
                if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                    Toast.makeText(this, "Permission denied: " + permissions[i], Toast.LENGTH_LONG).show();
                }
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executorService.shutdown();
    }

    public enum ConnectionState {
        CONNECTED, CONNECTING, DISCONNECTED
    }
}
