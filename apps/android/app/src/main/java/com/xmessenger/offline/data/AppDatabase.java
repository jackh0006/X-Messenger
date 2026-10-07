package com.xmessenger.offline.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.xmessenger.offline.data.dao.*
import com.xmessenger.offline.data.entity.*
import com.xmessenger.offline.data.converter.Converters

@Database(
    entities = [
        Contact::class,
        Message::class,
        ProxyConfig::class,
        Session::class,
        Identity::class,
        Setting::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {

    abstract fun contactDao(): ContactDao
    abstract fun messageDao(): MessageDao
    abstract fun proxyConfigDao(): ProxyConfigDao
    abstract fun sessionDao(): SessionDao
    abstract fun identityDao(): IdentityDao
    abstract fun settingDao(): SettingDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "omni_messenger.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}