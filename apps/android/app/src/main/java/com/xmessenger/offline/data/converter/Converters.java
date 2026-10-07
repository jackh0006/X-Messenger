package com.xmessenger.offline.data.converter

import androidx.room.TypeConverter
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.lang.reflect.Type

class Converters {

    @TypeConverter
    fun fromByteArray(value: ByteArray?): String? {
        return value?.let { android.util.Base64.encodeToString(it, android.util.Base64.NO_WRAP) }
    }

    @TypeConverter
    fun toByteArray(value: String?): ByteArray? {
        return value?.let { android.util.Base64.decode(it, android.util.Base64.NO_WRAP) }
    }

    @TypeConverter
    fun fromMap(value: Map<String, String>?): String? {
        return value?.let { Gson().toJson(it) }
    }

    @TypeConverter
    fun toMap(value: String?): Map<String, String>? {
        return value?.let { 
            val type = object : TypeToken<Map<String, String>>() {}.type
            Gson().fromJson<Map<String, String>>(it, type)
        }
    }

    @TypeConverter
    fun fromList(value: List<String>?): String? {
        return value?.let { Gson().toJson(it) }
    }

    @TypeConverter
    fun toList(value: String?): List<String>? {
        return value?.let {
            val type = object : TypeToken<List<String>>() {}.type
            Gson().fromJson<List<String>>(it, type)
        }
    }

    @TypeConverter
    fun fromAttachments(value: List<Attachment>?): String? {
        return value?.let { Gson().toJson(it) }
    }

    @TypeConverter
    fun toAttachments(value: String?): List<Attachment>? {
        return value?.let {
            val type = object : TypeToken<List<Attachment>>() {}.type
            Gson().fromJson<List<Attachment>>(it, type)
        }
    }

    @TypeConverter
    fun fromEncryptionInfo(value: EncryptionInfo?): String? {
        return value?.let { Gson().toJson(it) }
    }

    @TypeConverter
    fun toEncryptionInfo(value: String?): EncryptionInfo? {
        return value?.let { Gson().fromJson<EncryptionInfo>(it, EncryptionInfo::class.java) }
    }
}

data class Attachment(
    val id: String,
    val filename: String,
    val mimeType: String,
    val size: Long,
    val path: String,
    val thumbnailPath: String? = null,
    val encrypted: Boolean = false
)

data class EncryptionInfo(
    val algorithm: String,
    val keyId: String,
    val nonce: String,
    val epoch: Int,
    val messageNum: Long,
    val pqRatchet: Boolean
)