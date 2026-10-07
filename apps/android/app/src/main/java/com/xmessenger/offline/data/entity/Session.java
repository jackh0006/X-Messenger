package com.xmessenger.offline.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.io.Serializable

@Entity(tableName = "sessions")
data class Session(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "contact_id")
    val contactId: String,

    @ColumnInfo(name = "session_keys")
    val sessionKeys: ByteArray,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "last_used")
    val lastUsed: Long,

    @ColumnInfo(name = "message_count_sent")
    val messageCountSent: Long = 0,

    @ColumnInfo(name = "message_count_received")
    val messageCountReceived: Long = 0,

    @ColumnInfo(name = "ratchet_state")
    val ratchetState: ByteArray? = null
) : Serializable