package com.xmessenger.offline.ui.settings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.xmessenger.offline.data.AppDatabase
import com.xmessenger.offline.data.entity.Setting
import com.xmessenger.offline.XMessengerApplication
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val database = (application as XMessengerApplication).getDatabase()
    private val _settings = MutableLiveData<AppSettings>()
    val settings: LiveData<AppSettings> = _settings

    private val _errorMessage = MutableLiveData<String>()
    val errorMessage: LiveData<String> = _errorMessage

    init {
        loadSettings()
    }

    private fun loadSettings() {
        viewModelScope.launch {
            database.settingDao().getAll().collect { settingsList ->
                val appSettings = AppSettings()
                settingsList.forEach { setting ->
                    when (setting.key) {
                        "dark_mode" -> appSettings.darkMode = setting.value.toBoolean()
                        "compact_mode" -> appSettings.compactMode = setting.value.toBoolean()
                        "language" -> appSettings.language = setting.value
                        "notifications_enabled" -> appSettings.notificationsEnabled = setting.value.toBoolean()
                        "message_preview" -> appSettings.messagePreview = setting.value.toBoolean()
                        "sound_enabled" -> appSettings.soundEnabled = setting.value.toBoolean()
                        "cipher_algorithm" -> appSettings.cipherAlgorithm = setting.value
                        "key_rotation_interval" -> appSettings.keyRotationInterval = setting.value.toLong()
                        "ephemeral_default" -> appSettings.ephemeralDefault = setting.value.toBoolean()
                        "auto_lock_minutes" -> appSettings.autoLockMinutes = setting.value.toInt()
                        "tunnel_token" -> appSettings.tunnelToken = setting.value
                        "custom_domain" -> appSettings.customDomain = setting.value
                        "auto_connect" -> appSettings.autoConnect = setting.value.toBoolean()
                        "qr_enabled" -> appSettings.qrEnabled = setting.value.toBoolean()
                        "nfc_enabled" -> appSettings.nfcEnabled = setting.value.toBoolean()
                        "usb_enabled" -> appSettings.usbEnabled = setting.value.toBoolean()
                        "bluetooth_enabled" -> appSettings.bluetoothEnabled = setting.value.toBoolean()
                        "debug_logging" -> appSettings.debugLogging = setting.value.toBoolean()
                        "log_level" -> appSettings.logLevel = setting.value
                        "max_message_size" -> appSettings.maxMessageSize = setting.value.toInt()
                        "max_cache_size" -> appSettings.maxCacheSize = setting.value.toInt()
                    }
                }
                _settings.postValue(appSettings)
            }
        }
    }

    fun updateSetting(key: String, value: String) {
        viewModelScope.launch {
            try {
                val setting = Setting(key, value)
                database.settingDao().insert(setting)
                
                // Update live data
                _settings.value?.let { current ->
                    when (key) {
                        "dark_mode" -> current.darkMode = value.toBoolean()
                        "compact_mode" -> current.compactMode = value.toBoolean()
                        "language" -> current.language = value
                        "notifications_enabled" -> current.notificationsEnabled = value.toBoolean()
                        "message_preview" -> current.messagePreview = value.toBoolean()
                        "sound_enabled" -> current.soundEnabled = value.toBoolean()
                        "cipher_algorithm" -> current.cipherAlgorithm = value
                        "key_rotation_interval" -> current.keyRotationInterval = value.toLong()
                        "ephemeral_default" -> current.ephemeralDefault = value.toBoolean()
                        "auto_lock_minutes" -> current.autoLockMinutes = value.toInt()
                        "tunnel_token" -> current.tunnelToken = value
                        "custom_domain" -> current.customDomain = value
                        "auto_connect" -> current.autoConnect = value.toBoolean()
                        "qr_enabled" -> current.qrEnabled = value.toBoolean()
                        "nfc_enabled" -> current.nfcEnabled = value.toBoolean()
                        "usb_enabled" -> current.usbEnabled = value.toBoolean()
                        "bluetooth_enabled" -> current.bluetoothEnabled = value.toBoolean()
                        "debug_logging" -> current.debugLogging = value.toBoolean()
                        "log_level" -> current.logLevel = value
                        "max_message_size" -> current.maxMessageSize = value.toInt()
                        "max_cache_size" -> current.maxCacheSize = value.toInt()
                    }
                    _settings.postValue(current)
                }
                _errorMessage.postValue(null)
            } catch (e: Exception) {
                _errorMessage.postValue("Failed to update setting: ${e.message}")
            }
        }
    }

    fun clearAllData() {
        viewModelScope.launch {
            try {
                database.contactDao().getAll().first().forEach { contact ->
                    database.contactDao().delete(contact)
                }
                database.messageDao().getRecentMessages(0, Int.MAX_VALUE).first().forEach { message ->
                    database.messageDao().delete(message)
                }
                database.proxyConfigDao().getAll().first().forEach { config ->
                    database.proxyConfigDao().delete(config)
                }
                database.sessionDao().getAll().first()?.forEach { session ->
                    database.sessionDao().delete(session)
                }
                _errorMessage.postValue(null)
            } catch (e: Exception) {
                _errorMessage.postValue("Failed to clear data: ${e.message}")
            }
        }
    }

    fun exportLogs(): String {
        // Export logs as text
        return "Logs exported at ${System.currentTimeMillis()}"
    }

    fun runSelfTests(): Boolean {
        // Run crypto self-tests
        try {
            val crypto = (getApplication() as XMessengerApplication).getCrypto()
            // Test encryption/decryption
            val key = crypto.generateKey()
            val plaintext = "Test message".toByteArray()
            val ciphertext = crypto.encrypt(plaintext, key)
            val decrypted = crypto.decrypt(ciphertext, key)
            return decrypted.contentEquals(plaintext)
        } catch (e: Exception) {
            return false
        }
    }

    data class AppSettings(
        var darkMode: Boolean = true,
        var compactMode: Boolean = false,
        var language: String = "en",
        var notificationsEnabled: Boolean = true,
        var messagePreview: Boolean = true,
        var soundEnabled: Boolean = true,
        var cipherAlgorithm: String = "XChaCha20-Poly1305",
        var keyRotationInterval: Long = 100,
        var ephemeralDefault: Boolean = false,
        var autoLockMinutes: Int = 15,
        var tunnelToken: String = "",
        var customDomain: String = "",
        var autoConnect: Boolean = true,
        var qrEnabled: Boolean = true,
        var nfcEnabled: Boolean = false,
        var usbEnabled: Boolean = true,
        var bluetoothEnabled: Boolean = false,
        var debugLogging: Boolean = false,
        var logLevel: String = "info",
        var maxMessageSize: Int = 16 * 1024 * 1024,
        var maxCacheSize: Int = 500 * 1024 * 1024
    )
}