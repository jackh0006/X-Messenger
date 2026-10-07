package com.xmessenger.offline

import android.app.Application
import android.content.Intent
import androidx.lifecycle.ProcessLifecycleOwner
import com.xmessenger.offline.data.AppDatabase
import com.xmessenger.offline.crypto.XMessengerCrypto
import com.xmessenger.offline.service.SyncService
import timber.log.Timber

class XMessengerApplication : Application() {

    private var appDatabase: AppDatabase? = null
    private var xmCrypto: XMessengerCrypto? = null

    override fun onCreate() {
        super.onCreate()

        // Initialize Timber for logging
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        // Initialize database
        appDatabase = AppDatabase.getInstance(this)

        // Initialize crypto
        xmCrypto = XMessengerCrypto.getInstance(this)
        xmCrypto?.initialize()

        // Start sync service
        startSyncService()
    }

    fun getDatabase(): AppDatabase {
        return appDatabase!!
    }

    fun getCrypto(): XMessengerCrypto {
        return xmCrypto!!
    }

    private fun startSyncService() {
        val intent = Intent(this, SyncService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    companion object {
        @Suppress("UNUSED_PARAMETER")
        fun getInstance(context: android.content.Context): XMessengerApplication {
            return context.applicationContext as XMessengerApplication
        }
    }
}