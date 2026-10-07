package com.xmessenger.offline.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import java.io.Serializable

@Entity(tableName = "proxy_configs")
data class ProxyConfig(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "proxy_type")
    val proxyType: Int,

    @ColumnInfo(name = "server")
    val server: String,

    @ColumnInfo(name = "port")
    val port: Int,

    @ColumnInfo(name = "username")
    val username: String? = null,

    @ColumnInfo(name = "password")
    val password: String? = null,

    @ColumnInfo(name = "tls_enabled")
    val tlsEnabled: Boolean = false,

    @ColumnInfo(name = "tls_sni")
    val tlsSni: String? = null,

    @ColumnInfo(name = "tls_fingerprint")
    val tlsFingerprint: String? = null,

    @ColumnInfo(name = "plugin")
    val plugin: String? = null,

    @ColumnInfo(name = "plugin_opts")
    val pluginOpts: String = "{}",

    @ColumnInfo(name = "is_active")
    val isActive: Boolean = false,

    @ColumnInfo(name = "created_at")
    val createdAt: Long
) : Serializable