package com.xmessenger.offline.ui.contacts

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.xmessenger.offline.data.AppDatabase
import com.xmessenger.offline.data.entity.Contact
import com.xmessenger.offline.XMessengerApplication
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class ContactsViewModel(application: Application) : AndroidViewModel(application) {

    private val database = (application as XMessengerApplication).getDatabase()
    private val _contacts = MutableLiveData<List<Contact>>()
    val contacts: LiveData<List<Contact>> = _contacts

    private val _errorMessage = MutableLiveData<String>()
    val errorMessage: LiveData<String> = _errorMessage

    init {
        loadContacts()
    }

    private fun loadContacts() {
        viewModelScope.launch {
            database.contactDao().getAll().collect { contactList ->
                _contacts.postValue(contactList)
            }
        }
    }

    fun addContact(contact: Contact) {
        viewModelScope.launch {
            try {
                database.contactDao().insert(contact)
                _errorMessage.postValue(null)
            } catch (e: Exception) {
                _errorMessage.postValue("Failed to add contact: ${e.message}")
            }
        }
    }

    fun removeContact(contactId: String) {
        viewModelScope.launch {
            try {
                database.contactDao().deleteById(contactId)
                _errorMessage.postValue(null)
            } catch (e: Exception) {
                _errorMessage.postValue("Failed to remove contact: ${e.message}")
            }
        }
    }

    fun updateContact(contact: Contact) {
        viewModelScope.launch {
            try {
                database.contactDao().update(contact)
                _errorMessage.postValue(null)
            } catch (e: Exception) {
                _errorMessage.postValue("Failed to update contact: ${e.message}")
            }
        }
    }

    fun importFromQr(qrData: String) {
        // Parse QR data and add contact
        viewModelScope.launch {
            try {
                // Try to parse as contact JSON
                val contact = parseContactFromQr(qrData)
                if (contact != null) {
                    database.contactDao().insert(contact)
                    _errorMessage.postValue(null)
                } else {
                    _errorMessage.postValue("Invalid QR code format")
                }
            } catch (e: Exception) {
                _errorMessage.postValue("Failed to import contact: ${e.message}")
            }
        }
    }

    private fun parseContactFromQr(qrData: String): Contact? {
        try {
            // Try to decode base64
            val decoded = android.util.Base64.decode(qrData, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP)
            val json = String(decoded)
            
            // Parse JSON
            val gson = com.google.gson.Gson()
            val contactData = gson.fromJson(json, ContactQrData::class.java)
            
            if (contactData != null) {
                return Contact(
                    id = java.util.UUID.randomUUID().toString(),
                    name = contactData.n,
                    server = contactData.s ?: "unknown",
                    port = contactData.p ?: 443,
                    username = contactData.u ?: "",
                    password = contactData.pwd ?: "",
                    publicKey = contactData.i?.let { android.util.Base64.decode(it, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP) },
                    fingerprint = contactData.f,
                    addedAt = System.currentTimeMillis(),
                    isVerified = false
                )
            }
        } catch (e: Exception) {
            // Try parsing as plain JSON
            try {
                val gson = com.google.gson.Gson()
                val contactData = gson.fromJson(qrData, ContactQrData::class.java)
                if (contactData != null) {
                    return Contact(
                        id = java.util.UUID.randomUUID().toString(),
                        name = contactData.n,
                        server = contactData.s ?: "unknown",
                        port = contactData.p ?: 443,
                        username = contactData.u ?: "",
                        password = contactData.pwd ?: "",
                        publicKey = contactData.i?.let { android.util.Base64.decode(it, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP) },
                        fingerprint = contactData.f,
                        addedAt = System.currentTimeMillis(),
                        isVerified = false
                    )
                }
            } catch (e2: Exception) {
                // Not a valid contact QR
            }
        }
        return null
    }

    fun generateQrCode(contact: Contact): String {
        val qrData = ContactQrData(
            v = 1,
            n = contact.name,
            s = contact.server,
            p = contact.port,
            u = contact.username,
            pwd = contact.password,
            i = contact.publicKey?.let { android.util.Base64.encodeToString(it, android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP) },
            f = contact.fingerprint
        )
        val gson = com.google.gson.Gson()
        val json = gson.toJson(qrData)
        return android.util.Base64.encodeToString(json.toByteArray(), android.util.Base64.URL_SAFE | android.util.Base64.NO_WRAP)
    }

    data class ContactQrData(
        val v: Int = 1,
        val n: String,
        val s: String? = null,
        val p: Int? = null,
        val u: String? = null,
        val pwd: String? = null,
        val i: String? = null,
        val f: String? = null
    )
}