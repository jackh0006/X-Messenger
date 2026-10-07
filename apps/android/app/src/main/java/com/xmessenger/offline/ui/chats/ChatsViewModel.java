package com.xmessenger.offline.ui.chats

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.xmessenger.offline.data.AppDatabase
import com.xmessenger.offline.data.entity.Contact
import com.xmessenger.offline.data.entity.Message
import com.xmessenger.offline.XMessengerApplication
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.map

class ChatsViewModel(application: Application) : AndroidViewModel(application) {

    private val database = (application as XMessengerApplication).getDatabase()
    private val _chats = MutableLiveData<List<ChatSummary>>()
    val chats: LiveData<List<ChatSummary>> = _chats

    private val _unreadCount = MutableLiveData<Int>(0)
    val unreadCount: LiveData<Int> = _unreadCount

    init {
        loadChats()
    }

    private fun loadChats() {
        viewModelScope.launch {
            database.contactDao().getAll()
                .combine(database.messageDao().getRecentMessages(System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000, 100)) { contacts, recentMessages ->
                    contacts.map { contact ->
                        val messages = recentMessages.filter { it.contactId == contact.id }
                        val lastMessage = messages.firstOrNull()
                        val unreadCount = messages.count { !it.isRead && it.direction == 1 }
                        ChatSummary(
                            contact = contact,
                            lastMessage = lastMessage,
                            unreadCount = unreadCount
                        )
                    }.sortedByDescending { it.lastMessage?.timestamp ?: 0L }
                }
                .collect { chatSummaries ->
                    _chats.postValue(chatSummaries)
                    _unreadCount.postValue(chatSummaries.sumOf { it.unreadCount })
                }
        }
    }

    fun markAsRead(contactId: String) {
        viewModelScope.launch {
            database.messageDao().getUnreadMessages(contactId).first().forEach { message ->
                val updatedMessage = message.copy(isRead = true)
                database.messageDao().update(updatedMessage)
            }
            loadChats()
        }
    }

    fun deleteChat(contactId: String) {
        viewModelScope.launch {
            database.messageDao().getMessagesByContact(contactId, Int.MAX_VALUE, 0).first().forEach { message ->
                database.messageDao().delete(message)
            }
            loadChats()
        }
    }

    data class ChatSummary(
        val contact: Contact,
        val lastMessage: Message?,
        val unreadCount: Int
    )
}