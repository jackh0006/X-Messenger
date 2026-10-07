package com.xmessenger.offline.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import androidx.room.OnConflictStrategy
import com.xmessenger.offline.data.entity.Contact
import kotlinx.coroutines.flow.Flow

@Dao
interface ContactDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(contact: Contact): Long

    @Update
    suspend fun update(contact: Contact): Int

    @Delete
    suspend fun delete(contact: Contact): Int

    @Query("DELETE FROM contacts WHERE id = :id")
    suspend fun deleteById(id: String): Int

    @Query("SELECT * FROM contacts ORDER BY name ASC")
    fun getAll(): Flow<List<Contact>>

    @Query("SELECT * FROM contacts WHERE id = :id")
    suspend fun getById(id: String): Contact?

    @Query("SELECT * FROM contacts WHERE server = :server AND port = :port")
    suspend fun getByServerAndPort(server: String, port: Int): Contact?

    @Query("SELECT * FROM contacts WHERE is_online = 1")
    fun getOnlineContacts(): Flow<List<Contact>>

    @Query("SELECT COUNT(*) FROM contacts")
    suspend fun getCount(): Int
}