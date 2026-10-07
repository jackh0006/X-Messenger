package com.xmessenger.offline.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import androidx.room.OnConflictStrategy
import com.xmessenger.offline.data.entity.ProxyConfig
import kotlinx.coroutines.flow.Flow

@Dao
interface ProxyConfigDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(config: ProxyConfig): Long

    @Update
    suspend fun update(config: ProxyConfig): Int

    @Delete
    suspend fun delete(config: ProxyConfig): Int

    @Query("DELETE FROM proxy_configs WHERE id = :id")
    suspend fun deleteById(id: String): Int

    @Query("SELECT * FROM proxy_configs ORDER BY name ASC")
    fun getAll(): Flow<List<ProxyConfig>>

    @Query("SELECT * FROM proxy_configs WHERE id = :id")
    suspend fun getById(id: String): ProxyConfig?

    @Query("SELECT * FROM proxy_configs WHERE is_active = 1")
    fun getActiveConfigs(): Flow<List<ProxyConfig>>

    @Query("SELECT * FROM proxy_configs WHERE proxy_type = :type")
    fun getByType(type: Int): Flow<List<ProxyConfig>>
}