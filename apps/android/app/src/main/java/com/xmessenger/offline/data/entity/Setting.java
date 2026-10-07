package com.xmessenger.offline.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.io.Serializable

@Entity(tableName = "settings")
data class Setting(
    @PrimaryKey
    val key: String,

    @ColumnInfo(name = "value")
    val value: String
) : Serializable