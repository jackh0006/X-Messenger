package com.xmessenger.offline.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import com.xmessenger.offline.service.SyncService
import com.xmessenger.offline.XMessengerApplication

class NetworkChangeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        val connectivityManager = context?.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager?
        
        val isConnected = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager?.activeNetwork
            val capabilities = network?.let { connectivityManager.getNetworkCapabilities(it) }
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true ||
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true ||
            capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true
        } else {
            val networkInfo = connectivityManager?.activeNetworkInfo
            networkInfo?.isConnected == true
        }

        if (isConnected) {
            // Network became available - start sync service
            val syncIntent = Intent(context, SyncService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context?.startForegroundService(syncIntent)
            } else {
                context?.startService(syncIntent)
            }
            
            // Notify app that we're online
            val app = context?.applicationContext as? XMessengerApplication
            app?.getDatabase()?.settingDao()?.insert(com.xmessenger.offline.data.entity.Setting("network_status", "online"))
        } else {
            // Network lost - notify app
            val app = context?.applicationContext as? XMessengerApplication
            app?.getDatabase()?.settingDao()?.insert(com.xmessenger.offline.data.entity.Setting("network_status", "offline"))
        }
    }
}