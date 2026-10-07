package com.xmessenger.offline.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import androidx.room.OnConflictStrategy
import com.xmessenger.offline.data.entity.Message
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: Message): Long

    @Update
    suspend fun update(message: Message): Int

    @Delete
    suspend fun delete(message: Message): Int

    @Query("DELETE FROM messages WHERE id = :id")
    suspend fun deleteById(id: String): Int

    @Query("SELECT * FROM messages WHERE contact_id = :contactId ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    fun getMessagesByContact(contactId: String, limit: Int, offset: Int): Flow<List<Message>>

    @Query("SELECT * FROM messages WHERE id = :id")
    suspend fun getById(id: String): Message?

    @Query("SELECT * FROM messages WHERE contact_id = :contactId AND is_read = 0 AND direction = 1")
    fun getUnreadMessages(contactId: String): Flow<List<Message>>

    @Query("SELECT COUNT(*) FROM messages WHERE contact_id = :contactId AND is_read = 0 AND direction = 1")
    suspend fun getUnreadCount(contactId: String): Int

    @Query("SELECT * FROM messages WHERE timestamp > :since ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentMessages(since: Long, limit: Int): Flow<List<Message>>
}