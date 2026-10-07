package com.xmessenger.offline.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import androidx.room.OnConflictStrategy
import com.xmessenger.offline.data.entity.Setting

@Dao
interface SettingDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(setting: Setting): Long

    @Update
    suspend fun update(setting: Setting): Int

    @Delete
    suspend fun delete(setting: Setting): Int

    @Query("SELECT * FROM settings WHERE key = :key")
    suspend fun get(key: String): Setting?

    @Query("SELECT value FROM settings WHERE key = :key")
    suspend fun getValue(key: String): String?

    @Query("SELECT * FROM settings")
    fun getAll(): Flow<List<Setting>>
}