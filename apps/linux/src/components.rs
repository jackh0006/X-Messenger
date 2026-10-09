//! Components for the Omni Messenger Linux App

use adw::prelude::*;
use gtk4::gio;
use relm4::{Component, ComponentParts, ComponentSender, RelmWidgetExt};
use std::sync::Arc;

use crate::crypto::XMessengerCrypto;
use crate::data::{Contact, Message, Database};
use crate::settings::AppSettings;

/// Chats Component
#[relm4::component(pub)]
impl Component for ChatsComponent {
    type Init = (Arc<XMessengerCrypto>, Arc<Database>, Arc<AppSettings>);
    type Input = ChatsMsg;
    type Output = ();
    type CommandOutput = ();

    view! {
        gtk4::Box {
            set_orientation: gtk4::Orientation::Vertical,
            set_spacing: 0,

            // Toolbar
            adw::ToolbarView {
                set_content = &chat_list,

                add_top_bar = &toolbar,
            } as toolbar_view,

            // Chat list
            chat_list = gtk4::ListBox {
                set_selection_mode: gtk4::SelectionMode::Single,
                add_css_class: "chat-list",
                set_vexpand: true,
            },

            // Toolbar
            toolbar = adw::HeaderBar {
                set_show_title: true,
                set_title_widget = &title_box,

                pack_start = &search_button,
                pack_end = &menu_button,
            },

            title_box = gtk4::Box {
                set_orientation: gtk4::Orientation::Horizontal,
                set_spacing: 12,

                gtk4::Image {
                    set_icon_name: Some("mail-send-receive-symbolic"),
                    set_pixel_size: 24,
                },
                gtk4::Label {
                    set_label: "Chats",
                    add_css_class: "title-1",
                },
            },

            search_button = gtk4::Button {
                set_icon_name: Some("system-search-symbolic"),
                add_css_class: "flat",
            },

            menu_button = gtk4::MenuButton {
                set_icon_name: Some("open-menu-symbolic"),
                set_menu_model = &menu_model,
            },
        }
    }

    model = ChatsModel {
        crypto: init.0,
        database: init.1,
        settings: init.2,
        chats: Vec::new(),
        selected_chat: None,
    }

    init {
        load_chats(&model.database);
    }

    update(msg) {
        match msg {
            ChatsMsg::ChatSelected(chat) => {
                model.selected_chat = Some(chat);
            }
            ChatsMsg::NewMessage(contact, message) => {
                add_message_to_chat(contact, message);
            }
            ChatsMsg::Refresh => {
                load_chats(&model.database);
            }
        }
    }
}

/// Chats Model
pub struct ChatsModel {
    crypto: Arc<XMessengerCrypto>,
    database: Arc<Database>,
    settings: Arc<AppSettings>,
    chats: Vec<ChatSummary>,
    selected_chat: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ChatSummary {
    pub contact_id: String,
    pub contact_name: String,
    pub last_message: Option<String>,
    pub last_message_time: u64,
    pub unread_count: u32,
    pub is_online: bool,
}

#[derive(Debug)]
pub enum ChatsMsg {
    ChatSelected(ChatSummary),
    NewMessage(Contact, Message),
    Refresh,
}

fn load_chats(database: &Database) {
    // Load chats from database
}

fn add_message_to_chat(contact: Contact, message: Message) {
    // Add message to chat
}

/// Contacts Component
#[relm4::component(pub)]
impl Component for ContactsComponent {
    type Init = (Arc<XMessengerCrypto>, Arc<Database>, Arc<AppSettings>);
    type Input = ContactsMsg;
    type Output = ();
    type CommandOutput = ();

    view! {
        gtk4::Box {
            set_orientation: gtk4::Orientation::Vertical,
            set_spacing: 0,

            adw::ToolbarView {
                set_content = &contacts_list,

                add_top_bar = &toolbar,
            },

            contacts_list = gtk4::ListBox {
                set_selection_mode: gtk4::SelectionMode::Single,
                add_css_class: "contacts-list",
                set_vexpand: true,
            },

            toolbar = adw::HeaderBar {
                set_title_widget = &title_box,
                pack_start = &add_button,
            },

            title_box = gtk4::Box {
                set_orientation: gtk4::Orientation::Horizontal,
                set_spacing: 12,

                gtk4::Image {
                    set_icon_name: Some("contact-new-symbolic"),
                    set_pixel_size: 24,
                },
                gtk4::Label {
                    set_label: "Contacts",
                    add_css_class: "title-1",
                },
            },

            add_button = gtk4::Button {
                set_icon_name: Some("list-add-symbolic"),
                add_css_class: "flat",
                connect_clicked => ContactsMsg::AddContact,
            },
        }
    }

    model = ContactsModel {
        crypto: init.0,
        database: init.1,
        settings: init.2,
        contacts: Vec::new(),
    }

    init {
        load_contacts(&model.database);
    }

    update(msg) {
        match msg {
            ContactsMsg::AddContact => {
                // Show add contact dialog
            }
            ContactsMsg::ContactSelected(contact) => {
                // Open chat with contact
            }
            ContactsMsg::ContactRemoved(id) => {
                // Remove contact
            }
            ContactsMsg::Refresh => {
                load_contacts(&model.database);
            }
            ContactsMsg::ShowQrCode(contact) => {
                // Show QR code for contact
            }
            ContactsMsg::ImportQrCode => {
                // Import contact from QR
            }
        }
    }
}

pub struct ContactsModel {
    crypto: Arc<XMessengerCrypto>,
    database: Arc<Database>,
    settings: Arc<AppSettings>,
    contacts: Vec<Contact>,
}

#[derive(Debug)]
pub enum ContactsMsg {
    AddContact,
    ContactSelected(Contact),
    ContactRemoved(String),
    Refresh,
    ShowQrCode(Contact),
    ImportQrCode,
}

fn load_contacts(database: &Database) {
    // Load contacts from database
}

/// Settings Component
#[relm4::component(pub)]
impl Component for SettingsComponent {
    type Init = (Arc<XMessengerCrypto>, Arc<Database>, Arc<AppSettings>);
    type Input = SettingsMsg;
    type Output = ();
    type CommandOutput = ();

    view! {
        adw::PreferencesWindow {
            set_title: "Settings",
            set_search_enabled: true,

            adw::PreferencesPage {
                set_title: "General",
                set_icon_name: Some("preferences-system-symbolic"),

                adw::PreferencesGroup {
                    set_title: "Appearance",
                    set_description: Some("Customize the look and feel"),

                    adw::SwitchRow {
                        set_title: "Dark Mode",
                        set_subtitle: "Use dark theme",
                        set_active: model.settings.dark_mode,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleDarkMode(row.is_active()));
                        },
                    },

                    adw::SwitchRow {
                        set_title: "Compact Mode",
                        set_subtitle: "Reduce spacing for more content",
                        set_active: model.settings.compact_mode,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleCompactMode(row.is_active()));
                        },
                    },
                },

                adw::PreferencesGroup {
                    set_title: "Notifications",
                    set_description: Some("Configure notifications"),

                    adw::SwitchRow {
                        set_title: "Enable Notifications",
                        set_active: model.settings.notifications_enabled,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleNotifications(row.is_active()));
                        },
                    },

                    adw::SwitchRow {
                        set_title: "Message Preview",
                        set_subtitle: "Show message content in notifications",
                        set_active: model.settings.message_preview,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleMessagePreview(row.is_active()));
                        },
                    },
                },
            },

            adw::PreferencesPage {
                set_title: "Security",
                set_icon_name: Some("preferences-security-symbolic"),

                adw::PreferencesGroup {
                    set_title: "Encryption",
                    set_description: Some("Configure encryption settings"),

                    adw::ActionRow {
                        set_title: "Cipher Algorithm",
                        set_subtitle: Some(&format!("Current: {}", model.settings.cipher_algorithm)),
                    },

                    adw::ActionRow {
                        set_title: "Key Rotation Interval",
                        set_subtitle: Some(&format!("{} messages", model.settings.key_rotation_interval)),
                    },
                },

                adw::PreferencesGroup {
                    set_title: "Privacy",
                    set_description: Some("Privacy and data settings"),

                    adw::SwitchRow {
                        set_title: "Ephemeral Messages",
                        set_subtitle: "Auto-delete messages after reading",
                        set_active: model.settings.ephemeral_default,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleEphemeral(row.is_active()));
                        },
                    },

                    adw::ActionRow {
                        set_title: "Clear All Data",
                        set_subtitle: Some("WARNING: This will delete all messages, contacts, and keys"),
                        add_css_class: "destructive-action",
                        connect_activated[sender] => move |_| {
                            sender.input(SettingsMsg::ClearAllData);
                        },
                    },
                },
            },

            adw::PreferencesPage {
                set_title: "Network",
                set_icon_name: Some("preferences-system-network-symbolic"),

                adw::PreferencesGroup {
                    set_title: "Proxy / Tunnel",
                    set_description: Some("Configure proxy or tunnel settings"),

                    adw::EntryRow {
                        set_title: "Cloudflare Tunnel Token",
                        set_text: &model.settings.tunnel_token,
                        connect_changed[sender] => move |row| {
                            sender.input(SettingsMsg::UpdateTunnelToken(row.text().to_string()));
                        },
                    },

                    adw::EntryRow {
                        set_title: "Custom Domain",
                        set_text: &model.settings.custom_domain,
                        connect_changed[sender] => move |row| {
                            sender.input(SettingsMsg::UpdateCustomDomain(row.text().to_string()));
                        },
                    },
                },

                adw::PreferencesGroup {
                    set_title: "Offline Transport",
                    set_description: Some("Configure offline data transfer methods"),

                    adw::SwitchRow {
                        set_title: "QR Code",
                        set_subtitle: "Enable QR code for message transfer",
                        set_active: model.settings.qr_enabled,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleQr(row.is_active()));
                        },
                    },

                    adw::SwitchRow {
                        set_title: "NFC",
                        set_subtitle: "Enable NFC for contact exchange",
                        set_active: model.settings.nfc_enabled,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleNfc(row.is_active()));
                        },
                    },

                    adw::SwitchRow {
                        set_title: "USB/Local Network",
                        set_subtitle: "Enable direct USB or local network transfer",
                        set_active: model.settings.usb_enabled,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleUsb(row.is_active()));
                        },
                    },
                },
            },

            adw::PreferencesPage {
                set_title: "Advanced",
                set_icon_name: Some("preferences-developer-symbolic"),

                adw::PreferencesGroup {
                    set_title: "Debug",
                    set_description: Some("Debug and development options"),

                    adw::SwitchRow {
                        set_title: "Debug Logging",
                        set_active: model.settings.debug_logging,
                        connect_active_notify[sender] => move |row, _| {
                            sender.input(SettingsMsg::ToggleDebugLogging(row.is_active()));
                        },
                    },

                    adw::ActionRow {
                        set_title: "Export Logs",
                        connect_activated[sender] => move |_| {
                            sender.input(SettingsMsg::ExportLogs);
                        },
                    },

                    adw::ActionRow {
                        set_title: "Run Self-Tests",
                        connect_activated[sender] => move |_| {
                            sender.input(SettingsMsg::RunSelfTests);
                        },
                    },
                },

                adw::PreferencesGroup {
                    set_title: "About",
                    set_description: Some("Application information"),

                    adw::ActionRow {
                        set_title: "Version",
                        set_subtitle: Some(env!("CARGO_PKG_VERSION")),
                    },

                    adw::ActionRow {
                        set_title: "License",
                        set_subtitle: Some("AGPL-3.0-or-later"),
                    },

                    adw::ActionRow {
                        set_title: "Source Code",
                        set_subtitle: Some("https://github.com/Jackh0006/openvpn-wizard"),
                    },
                },
            },
        }
    }

    model = SettingsModel {
        crypto: init.0,
        database: init.1,
        settings: init.2,
    }

    update(msg) {
        match msg {
            SettingsMsg::ToggleDarkMode(active) => {
                model.settings.dark_mode = active;
                model.settings.save();
                // Apply theme
            }
            SettingsMsg::ToggleCompactMode(active) => {
                model.settings.compact_mode = active;
                model.settings.save();
            }
            SettingsMsg::ToggleNotifications(active) => {
                model.settings.notifications_enabled = active;
                model.settings.save();
            }
            SettingsMsg::ToggleMessagePreview(active) => {
                model.settings.message_preview = active;
                model.settings.save();
            }
            SettingsMsg::ToggleEphemeral(active) => {
                model.settings.ephemeral_default = active;
                model.settings.save();
            }
            SettingsMsg::ClearAllData => {
                show_clear_confirmation();
            }
            SettingsMsg::UpdateTunnelToken(token) => {
                model.settings.tunnel_token = token;
                model.settings.save();
            }
            SettingsMsg::UpdateCustomDomain(domain) => {
                model.settings.custom_domain = domain;
                model.settings.save();
            }
            SettingsMsg::ToggleQr(active) => {
                model.settings.qr_enabled = active;
                model.settings.save();
            }
            SettingsMsg::ToggleNfc(active) => {
                model.settings.nfc_enabled = active;
                model.settings.save();
            }
            SettingsMsg::ToggleUsb(active) => {
                model.settings.usb_enabled = active;
                model.settings.save();
            }
            SettingsMsg::ToggleDebugLogging(active) => {
                model.settings.debug_logging = active;
                model.settings.save();
            }
            SettingsMsg::ExportLogs => {
                // Export logs
            }
            SettingsMsg::RunSelfTests => {
                // Run crypto self-tests
            }
        }
    }
}

pub struct SettingsModel {
    crypto: Arc<XMessengerCrypto>,
    database: Arc<Database>,
    settings: Arc<AppSettings>,
}

#[derive(Debug)]
pub enum SettingsMsg {
    ToggleDarkMode(bool),
    ToggleCompactMode(bool),
    ToggleNotifications(bool),
    ToggleMessagePreview(bool),
    ToggleEphemeral(bool),
    ClearAllData,
    UpdateTunnelToken(String),
    UpdateCustomDomain(String),
    ToggleQr(bool),
    ToggleNfc(bool),
    ToggleUsb(bool),
    ToggleDebugLogging(bool),
    ExportLogs,
    RunSelfTests,
}

fn show_clear_confirmation() {
    // Show confirmation dialog
}

/// QR Scanner Component
#[relm4::component(pub)]
impl Component for QrScannerComponent {
    type Init = (ComponentSender<crate::App>,);
    type Input = QrScannerMsg;
    type Output = ();
    type CommandOutput = ();

    view! {
        gtk4::Box {
            set_orientation: gtk4::Orientation::Vertical,
            set_spacing: 16,
            set_margin_top: 16,
            set_margin_bottom: 16,
            set_margin_start: 16,
            set_margin_end: 16,

            gtk4::Label {
                set_label: "Scan QR Code",
                add_css_class: "title-1",
            },

            gtk4::Label {
                set_label: "Point camera at a QR code to scan",
                add_css_class: "caption",
            },

            gtk4::Picture {
                set_content_fit: gtk4::ContentFit::Cover,
                set_size_request: (300, 300),
                set_can_shrink: false,
            } as camera_preview,

            gtk4::Box {
                set_orientation: gtk4::Orientation::Horizontal,
                set_spacing: 12,

                gtk4::Button {
                    set_label: "Scan from Camera",
                    set_icon_name: Some("camera-symbolic"),
                    add_css_class: "suggested-action",
                    set_hexpand: true,
                    connect_clicked => QrScannerMsg::StartCamera,
                },

                gtk4::Button {
                    set_label: "Select from Gallery",
                    set_icon_name: Some("image-loading-symbolic"),
                    set_hexpand: true,
                    connect_clicked => QrScannerMsg::PickFromGallery,
                },
            },

            gtk4::Button {
                set_label: "Cancel",
                add_css_class: "flat",
                connect_clicked => QrScannerMsg::Cancel,
            },
        }
    }

    model = QrScannerModel {
        sender: init.0,
        is_scanning: false,
    }

    update(msg) {
        match msg {
            QrScannerMsg::StartCamera => {
                // Start camera scanning
            }
            QrScannerMsg::PickFromGallery => {
                // Pick image from gallery
            }
            QrScannerMsg::QrDetected(data) => {
                // Process QR data
            }
            QrScannerMsg::Cancel => {
                // Close dialog
            }
        }
    }
}

pub struct QrScannerModel {
    sender: ComponentSender<crate::App>,
    is_scanning: bool,
}

#[derive(Debug)]
pub enum QrScannerMsg {
    StartCamera,
    PickFromGallery,
    QrDetected(String),
    Cancel,
}