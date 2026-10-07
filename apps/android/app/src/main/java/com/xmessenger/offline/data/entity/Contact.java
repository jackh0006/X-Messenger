package com.xmessenger.offline.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.io.Serializable

@Entity(tableName = "contacts")
data class Contact(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "server")
    val server: String,

    @ColumnInfo(name = "port")
    val port: Int,

    @ColumnInfo(name = "username")
    val username: String,

    @ColumnInfo(name = "password")
    val password: String,

    @ColumnInfo(name = "public_key")
    val publicKey: ByteArray? = null,

    @ColumnInfo(name = "fingerprint")
    val fingerprint: String? = null,

    @ColumnInfo(name = "added_at")
    val addedAt: Long,

    @ColumnInfo(name = "last_seen")
    val lastSeen: Long? = null,

    @ColumnInfo(name = "is_online")
    val isOnline: Boolean = false,

    @ColumnInfo(name = "is_verified")
    val isVerified: Boolean = false,

    @ColumnInfo(name = "metadata")
    val metadata: String = "{}"
) : Serializable