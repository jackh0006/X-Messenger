package com.xmessenger.offline.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import androidx.room.Delete
import androidx.room.OnConflictStrategy
import com.xmessenger.offline.data.entity.Identity

@Dao
interface IdentityDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(identity: Identity): Long

    @Update
    suspend fun update(identity: Identity): Int

    @Query("SELECT * FROM identity WHERE id = 1")
    suspend fun getIdentity(): Identity?

    @Query("DELETE FROM identity")
    suspend fun clearIdentity(): Int
}