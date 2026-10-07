package com.xmessenger.offline.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import androidx.room.OnConflictStrategy
import com.xmessenger.offline.data.entity.Session
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: Session): Long

    @Update
    suspend fun update(session: Session): Int

    @Delete
    suspend fun delete(session: Session): Int

    @Query("DELETE FROM sessions WHERE id = :id")
    suspend fun deleteById(id: String): Int

    @Query("SELECT * FROM sessions WHERE contact_id = :contactId")
    suspend fun getByContactId(contactId: String): Session?

    @Query("SELECT * FROM sessions WHERE id = :id")
    suspend fun getById(id: String): Session?
}