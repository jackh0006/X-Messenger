package com.xmessenger.offline.service

import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.lifecycle.LifecycleService
import com.xmessenger.offline.XMessengerApplication
import com.xmessenger.offline.crypto.XMessengerCrypto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncService : LifecycleService() {

    private var isRunning = false

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        startSyncLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun startSyncLoop() {
        lifecycleScope.launch(Dispatchers.IO) {
            while (isRunning) {
                try {
                    syncContacts()
                    syncMessages()
                    checkConnections()
                } catch (e: Exception) {
                    // Log error
                }
                
                // Wait 30 seconds before next sync
                kotlinx.coroutines.delay(30_000)
            }
        }
    }

    private suspend fun syncContacts() = withContext(Dispatchers.IO) {
        val app = applicationContext as XMessengerApplication
        val database = app.getDatabase()
        val crypto = app.getCrypto()
        
        // Sync contacts with server if online
        // For now, just check if contacts are still valid
        val contacts = database.contactDao().getAll().first()
        contacts.forEach { contact ->
            // Check if contact is reachable
            checkContactReachability(contact)
        }
    }

    private suspend fun syncMessages() = withContext(Dispatchers.IO) {
        val app = applicationContext as XMessengerApplication
        val database = app.getDatabase()
        
        // Sync messages with contacts
        // In offline mode, this would be triggered by QR code scan or USB transfer
        // For now, just clean up old ephemeral messages
        val messages = database.messageDao().getRecentMessages(0, Int.MAX_VALUE).first()
        val now = System.currentTimeMillis()
        messages.filter { it.isEphemeral && (it.expiresAt ?: Long.MAX_VALUE) < now }
            .forEach { message ->
                database.messageDao().delete(message)
            }
    }

    private suspend fun checkConnections() = withContext(Dispatchers.IO) {
        // Check if we can reach our servers
        val app = applicationContext as XMessengerApplication
        val database = app.getDatabase()
        val contacts = database.contactDao().getAll().first()
        
        contacts.forEach { contact ->
            // Update contact online status
            val isOnline = checkServerReachable(contact.server, contact.port)
            if (contact.isOnline != isOnline) {
                val updatedContact = contact.copy(isOnline = isOnline)
                database.contactDao().update(updatedContact)
            }
        }
    }

    private fun checkContactReachability(contact: Contact) {
        // Try to connect to contact's server
        checkServerReachable(contact.server, contact.port)
    }

    private fun checkServerReachable(server: String, port: Int): Boolean {
        return try {
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress(server, port), 5000)
            socket.close()
            true
        } catch (e: Exception) {
            false
        }
    }
}