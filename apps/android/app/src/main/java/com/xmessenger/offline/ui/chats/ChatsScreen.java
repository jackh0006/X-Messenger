package com.xmessenger.offline.ui.chats

import android.os.Bundle
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.icons.Icons
import androidx.compose.material3.icons.filled.Add
import androidx.compose.material3.icons.filled.Chat
import androidx.compose.material3.icons.filled.MoreVert
import androidx.compose.material3.icons.filled.Person
import androidx.compose.material3.icons.filled.Search
import androidx.compose.material3.icons.filled.Send
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.xmessenger.offline.R
import com.xmessenger.offline.data.entity.Contact
import com.xmessenger.offline.data.entity.Message
import com.xmessenger.offline.ui.theme.OfflineMessengerTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Composable
fun ChatsScreen(
    viewModel: ChatsViewModel = viewModel(),
    onContactClick: (Contact) -> Unit,
    onNewContact: () -> Unit,
    onScanQr: () -> Unit
) {
    val chats by viewModel.chats.observeAsState(emptyList())
    val unreadCount by viewModel.unreadCount.observeAsState(0)

    OfflineMessengerTheme {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.Top
            ) {
                // Top App Bar
                TopAppBar(
                    title = { Text(stringResource(R.string.nav_chats), fontWeight = FontWeight.Bold) },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = OfflineMessengerTheme.colorScheme.surface,
                        titleContentColor = OfflineMessengerTheme.colorScheme.onSurface
                    ),
                    actions = {
                        IconButton(onClick = onScanQr) {
                            Icon(Icons.Default.Search, contentDescription = "Search")
                        }
                        IconButton(onClick = onNewContact) {
                            Icon(Icons.Default.Add, contentDescription = "New Contact")
                        }
                        IconButton(onClick = { /* Menu */ }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Menu")
                        }
                    }
                )

                Divider()

                // Chat List
                if (chats.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.ic_chat_empty),
                                contentDescription = "No chats",
                                tint = OfflineMessengerTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                                modifier = Modifier.size(96.dp)
                            )
                            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                stringResource(R.string.chat_no_messages),
                                color = OfflineMessengerTheme.colorScheme.onSurfaceVariant,
                                fontSize = 16.sp,
                                textAlign = TextAlign.Center
                            )
                            androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = onNewContact,
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                    containerColor = OfflineMessengerTheme.colorScheme.primary
                                )
                            ) {
                                Text(stringResource(R.string.action_add_contact))
                            }
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(chats) { chatSummary ->
                            ChatItem(
                                chat = chatSummary,
                                onClick = { onContactClick(chatSummary.contact) }
                            )
                        }
                    }
                }
            }

            // Floating Action Buttons
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.BottomEnd
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalAlignment = Alignment.End
                ) {
                    FloatingActionButton(
                        icon = Icons.Default.Person,
                        onClick = onNewContact,
                        contentDescription = "Add Contact"
                    )
                    FloatingActionButton(
                        icon = Icons.Default.Search,
                        onClick = onScanQr,
                        contentDescription = "Scan QR",
                        isPrimary = true
                    )
                }
                .padding(16.dp)
            }
        }
    }
}

@Composable
fun ChatItem(
    chat: ChatsViewModel.ChatSummary,
    onClick: () -> Unit
) {
    val contact = chat.contact
    val lastMessage = chat.lastMessage
    val unreadCount = chat.unreadCount

    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = OfflineMessengerTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        androidx.compose.foundation.layout.Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            ContactAvatar(
                name = contact.name,
                isOnline = contact.isOnline,
                modifier = Modifier.size(56.dp)
            )

            androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(12.dp))

            // Content
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(top = 8.dp, bottom = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        contact.name,
                        color = OfflineMessengerTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (lastMessage != null) {
                        Text(
                            formatTime(lastMessage.timestamp),
                            color = OfflineMessengerTheme.colorScheme.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    if (lastMessage != null) {
                        Text(
                            lastMessage.content,
                            color = OfflineMessengerTheme.colorScheme.onSurfaceVariant,
                            fontSize = 14.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    if (unreadCount > 0) {
                        UnreadBadge(count = unreadCount)
                    }
                }

                if (contact.isOnline) {
                    Row {
                        androidx.compose.foundation.layout.Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Color.Green, RoundedCornerShape(4.dp))
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            stringResource(R.string.contact_online),
                            color = Color.Green,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ContactAvatar(
    name: String,
    isOnline: Boolean,
    modifier: Modifier = Modifier
) {
    val colorIndex = name.hashCode().absoluteValue % AVATAR_COLORS.size
    val backgroundColor = AVATAR_COLORS[colorIndex]
    val initial = name.firstOrNull()?.uppercaseChar() ?: '?'

    Box(
        modifier = modifier
            .background(backgroundColor, RoundedCornerShape(28.dp))
            .clip(RoundedCornerShape(28.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            initial.toString(),
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun UnreadBadge(count: Int) {
    val displayText = if (count > 99) "99+" else count.toString()
    
    Box(
        modifier = Modifier
            .height(20.dp)
            .padding(horizontal = 8.dp)
            .background(Color.Red, RoundedCornerShape(10.dp))
            .clip(RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            displayText,
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun FloatingActionButton(
    icon: androidx.compose.material.icons.filled.Icon,
    onClick: () -> Unit,
    contentDescription: String,
    isPrimary: Boolean = false
) {
    val containerColor = if (isPrimary) OfflineMessengerTheme.colorScheme.primary else OfflineMessengerTheme.colorScheme.secondary
    val contentColor = if (isPrimary) OfflineMessengerTheme.colorScheme.onPrimary else OfflineMessengerTheme.colorScheme.onSecondary

    androidx.compose.material3.FloatingActionButton(
        onClick = onClick,
        containerColor = containerColor,
        contentColor = contentColor,
        shape = RoundedCornerShape(28.dp),
        elevation = androidx.compose.material3.FloatingActionButtonDefaults.elevations(
            defaultElevation = 6.dp,
            pressedElevation = 12.dp
        )
    ) {
        Icon(icon, contentDescription = contentDescription)
    }
}

private fun formatTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    
    return when {
        diff < 60_000 -> "Just now"
        diff < 3_600_000 -> "${diff / 60_000}m"
        diff < 86_400_000 -> "${diff / 3_600_000}h"
        else -> java.text.SimpleDateFormat("MMM d", java.util.Locale.getDefault()).format(java.util.Date(timestamp))
    }
}

private val AVATAR_COLORS = listOf(
    Color(0xFF7C3AED), // Purple
    Color(0xFF06B6D4), // Cyan
    Color(0xFF22C55E), // Green
    Color(0xFFF59E0B), // Amber
    Color(0xFFEF4444), // Red
    Color(0xFFEC4899), // Pink
    Color(0xFF8B5CF6), // Violet
    Color(0xFF14B8A6), // Teal
)