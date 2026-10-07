package com.xmessenger.offline.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.io.Serializable

@Entity(tableName = "messages")
data class Message(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "contact_id")
    val contactId: String,

    @ColumnInfo(name = "content")
    val content: String,

    @ColumnInfo(name = "message_type")
    val messageType: Int,

    @ColumnInfo(name = "direction")
    val direction: Int,

    @ColumnInfo(name = "timestamp")
    val timestamp: Long,

    @ColumnInfo(name = "is_read")
    val isRead: Boolean = false,

    @ColumnInfo(name = "is_delivered")
    val isDelivered: Boolean = false,

    @ColumnInfo(name = "is_ephemeral")
    val isEphemeral: Boolean = false,

    @ColumnInfo(name = "expires_at")
    val expiresAt: Long? = null,

    @ColumnInfo(name = "reply_to")
    val replyTo: String? = null,

    @ColumnInfo(name = "attachments")
    val attachments: String = "[]",

    @ColumnInfo(name = "encryption_info")
    val encryptionInfo: String = "{}"
) : Serializable