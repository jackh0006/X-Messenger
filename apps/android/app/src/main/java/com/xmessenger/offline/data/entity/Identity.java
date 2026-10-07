package com.xmessenger.offline.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.io.Serializable

@Entity(tableName = "identity")
data class Identity(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 1,

    @ColumnInfo(name = "identity_keypair")
    val identityKeypair: ByteArray,

    @ColumnInfo(name = "created_at")
    val createdAt: Long
) : Serializable