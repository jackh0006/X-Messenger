package com.xmessenger.offline.crypto

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.xmessenger.offline.BuildConfig
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class XMessengerCrypto private constructor(private val context: Context) {

    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val encryptedPrefs by lazy {
        EncryptedSharedPreferences.create(
            "omni_crypto_prefs",
            masterKey,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val secureRandom = SecureRandom()

    companion object {
        @Volatile
        private var INSTANCE: XMessengerCrypto? = null

        fun getInstance(context: Context): XMessengerCrypto {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: XMessengerCrypto(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    fun initialize() {
        // Generate identity if not exists
        if (!encryptedPrefs.contains("identity_generated")) {
            generateIdentity()
        }
    }

    private fun generateIdentity() {
        try {
            // Generate X25519 key pair for key exchange
            val kpg = KeyPairGenerator.getInstance("X25519")
            val keyPair = kpg.generateKeyPair()
            
            val publicKeyB64 = Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP)
            val privateKeyB64 = Base64.encodeToString(keyPair.private.encoded, Base64.NO_WRAP)
            
            encryptedPrefs.edit()
                .putString("identity_public_key", publicKeyB64)
                .putString("identity_private_key", privateKeyB64)
                .putBoolean("identity_generated", true)
                .apply()
            
            // Generate Ed25519 signing key pair
            val signKpg = KeyPairGenerator.getInstance("Ed25519")
            val signKeyPair = signKpg.generateKeyPair()
            
            val signPublicKeyB64 = Base64.encodeToString(signKeyPair.public.encoded, Base64.NO_WRAP)
            val signPrivateKeyB64 = Base64.encodeToString(signKeyPair.private.encoded, Base64.NO_WRAP)
            
            encryptedPrefs.edit()
                .putString("sign_public_key", signPublicKeyB64)
                .putString("sign_private_key", signPrivateKeyB64)
                .apply()
                
        } catch (e: Exception) {
            throw RuntimeException("Failed to generate identity", e)
        }
    }

    fun getIdentityPublicKey(): String? {
        return encryptedPrefs.getString("identity_public_key", null)
    }

    fun getIdentityPrivateKey(): String? {
        return encryptedPrefs.getString("identity_private_key", null)
    }

    fun getSignPublicKey(): String? {
        return encryptedPrefs.getString("sign_public_key", null)
    }

    fun getSignPrivateKey(): String? {
        return encryptedPrefs.getString("sign_private_key", null)
    }

    fun getFingerprint(): String {
        val publicKey = getIdentityPublicKey() ?: return ""
        try {
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(Base64.decode(publicKey, Base64.NO_WRAP))
            return bytesToHex(hash).substring(0, 64)
        } catch (e: Exception) {
            return ""
        }
    }

    // AES-256-GCM encryption
    fun encrypt(data: ByteArray, key: ByteArray): ByteArray {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val iv = ByteArray(12)
            secureRandom.nextBytes(iv)
            
            val secretKey = SecretKeySpec(key, "AES")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)
            
            val ciphertext = cipher.doFinal(data)
            
            // Prepend IV to ciphertext
            val result = ByteArray(iv.size + ciphertext.size)
            System.arraycopy(iv, 0, result, 0, iv.size)
            System.arraycopy(ciphertext, 0, result, iv.size, ciphertext.size)
            
            return result
        } catch (e: Exception) {
            throw RuntimeException("Encryption failed", e)
        }
    }

    fun decrypt(data: ByteArray, key: ByteArray): ByteArray {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val iv = data.copyOfRange(0, 12)
            val ciphertext = data.copyOfRange(12, data.size)
            
            val secretKey = SecretKeySpec(key, "AES")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
            
            return cipher.doFinal(ciphertext)
        } catch (e: Exception) {
            throw RuntimeException("Decryption failed", e)
        }
    }

    // Generate random key
    fun generateKey(): ByteArray {
        try {
            val kg = KeyGenerator.getInstance("AES")
            kg.init(256, secureRandom)
            return kg.generateKey().encoded
        } catch (e: Exception) {
            throw RuntimeException("Key generation failed", e)
        }
    }

    // Generate random bytes
    fun randomBytes(length: Int): ByteArray {
        val bytes = ByteArray(length)
        secureRandom.nextBytes(bytes)
        return bytes
    }

    // SHA3-256 hash
    fun sha3_256(data: ByteArray): ByteArray {
        try {
            val digest = MessageDigest.getInstance("SHA3-256")
            return digest.digest(data)
        } catch (e: Exception) {
            throw RuntimeException("Hash failed", e)
        }
    }

    // HMAC-SHA3-256
    fun hmacSha3_256(key: ByteArray, data: ByteArray): ByteArray {
        try {
            val mac = javax.crypto.Mac.getInstance("HmacSHA3-256")
            mac.init(SecretKeySpec(key, "HmacSHA3-256"))
            return mac.doFinal(data)
        } catch (e: Exception) {
            throw RuntimeException("HMAC failed", e)
        }
    }

    // HKDF-SHA3-256
    fun hkdfSha3_256(salt: ByteArray, ikm: ByteArray, info: ByteArray, length: Int): ByteArray {
        try {
            // Extract
            val prk = hmacSha3_256(salt, ikm)
            
            // Expand
            val okm = ByteArray(length)
            val hashLen = 32
            var n = 0
            var prev = ByteArray(0)
            
            while (n * hashLen < length) {
                n++
                val mac = javax.crypto.Mac.getInstance("HmacSHA3-256")
                mac.init(SecretKeySpec(prk, "HmacSHA3-256"))
                mac.update(prev)
                mac.update(info)
                mac.update(n.toByte())
                prev = mac.doFinal()
                
                val offset = (n - 1) * hashLen
                val copyLen = kotlin.math.min(hashLen, length - offset)
                System.arraycopy(prev, 0, okm, offset, copyLen)
            }
            
            return okm
        } catch (e: Exception) {
            throw RuntimeException("HKDF failed", e)
        }
    }

    // Sign data with Ed25519
    fun sign(data: ByteArray): ByteArray? {
        val privateKeyB64 = getSignPrivateKey() ?: return null
        try {
            val privateKeyBytes = Base64.decode(privateKeyB64, Base64.NO_WRAP)
            val keyFactory = java.security.KeyFactory.getInstance("Ed25519")
            val privateKey = keyFactory.generatePrivate(java.security.spec.PKCS8EncodedKeySpec(privateKeyBytes))
            
            val signature = java.security.Signature.getInstance("Ed25519")
            signature.initSign(privateKey)
            signature.update(data)
            return signature.sign()
        } catch (e: Exception) {
            return null
        }
    }

    // Verify Ed25519 signature
    fun verify(data: ByteArray, signature: ByteArray, publicKeyB64: String): Boolean {
        try {
            val publicKeyBytes = Base64.decode(publicKeyB64, Base64.NO_WRAP)
            val keyFactory = java.security.KeyFactory.getInstance("Ed25519")
            val publicKey = keyFactory.generatePublic(java.security.spec.X509EncodedKeySpec(publicKeyBytes))
            
            val sig = java.security.Signature.getInstance("Ed25519")
            sig.initVerify(publicKey)
            sig.update(data)
            return sig.verify(signature)
        } catch (e: Exception) {
            return false
        }
    }

    // X25519 key agreement
    fun keyAgreement(theirPublicKeyB64: String): ByteArray? {
        val myPrivateKeyB64 = getIdentityPrivateKey() ?: return null
        try {
            val myPrivateKeyBytes = Base64.decode(myPrivateKeyB64, Base64.NO_WRAP)
            val theirPublicKeyBytes = Base64.decode(theirPublicKeyB64, Base64.NO_WRAP)
            
            val keyFactory = java.security.KeyFactory.getInstance("X25519")
            val myPrivateKey = keyFactory.generatePrivate(java.security.spec.PKCS8EncodedKeySpec(myPrivateKeyBytes))
            val theirPublicKey = keyFactory.generatePublic(java.security.spec.X509EncodedKeySpec(theirPublicKeyBytes))
            
            val keyAgreement = javax.crypto.KeyAgreement.getInstance("X25519")
            keyAgreement.init(myPrivateKey)
            keyAgreement.doPhase(theirPublicKey, true)
            
            return keyAgreement.generateSecret()
        } catch (e: Exception) {
            return null
        }
    }

    // Derive session keys from shared secret
    fun deriveSessionKeys(sharedSecret: ByteArray, context: String): SessionKeys {
        val salt = "OMNI-SESSION".toByteArray()
        val info = context.toByteArray()
        
        val okm = hkdfSha3_256(salt, sharedSecret, info, 128)
        
        val cipherKey = okm.copyOfRange(0, 32)
        val macKey = okm.copyOfRange(32, 64)
        val ratchetKey = okm.copyOfRange(64, 96)
        val authKey = okm.copyOfRange(96, 128)
        
        return SessionKeys(cipherKey, macKey, ratchetKey, authKey)
    }

    // Encrypt message with session keys
    fun encryptMessage(plaintext: ByteArray, sessionKeys: SessionKeys, nonce: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val secretKey = SecretKeySpec(sessionKeys.cipherKey, "AES")
        val spec = GCMParameterSpec(128, nonce)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)
        
        // Add message number as AAD
        val aad = ByteArray(8)
        // TODO: Add message number
        
        return cipher.doFinal(plaintext)
    }

    // Decrypt message with session keys
    fun decryptMessage(ciphertext: ByteArray, sessionKeys: SessionKeys, nonce: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val secretKey = SecretKeySpec(sessionKeys.cipherKey, "AES")
        val spec = GCMParameterSpec(128, nonce)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        return cipher.doFinal(ciphertext)
    }

    // QR Code encoding/decoding
    fun encodeToQr(data: ByteArray): String {
        // Compress with zstd if available
        val compressed = compress(data)
        return Base64.encodeToString(compressed, Base64.URL_SAFE | Base64.NO_WRAP)
    }

    fun decodeFromQr(qrString: String): ByteArray {
        val compressed = Base64.decode(qrString, Base64.URL_SAFE | Base64.NO_WRAP)
        return decompress(compressed)
    }

    private fun compress(data: ByteArray): ByteArray {
        // Simple implementation - in production use zstd
        return data
    }

    private fun decompress(data: ByteArray): ByteArray {
        return data
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val sb = StringBuilder()
        for (b in bytes) {
            sb.append(String.format("%02x", b))
        }
        return sb.toString()
    }

    data class SessionKeys(
        val cipherKey: ByteArray,
        val macKey: ByteArray,
        val ratchetKey: ByteArray,
        val authKey: ByteArray
    )
}