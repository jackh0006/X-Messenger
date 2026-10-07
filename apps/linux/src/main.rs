//! X-Messenger - Linux Desktop Application
//! Modern, beautiful GTK4/Libadwaita UI like Telegram

use adw::prelude::*;
use adw::Application;
use gtk4::gio;
use relm4::{Component, ComponentParts, ComponentSender, RelmApp, RelmWidgetExt};
use std::sync::Arc;

mod components;
mod crypto;
mod data;
mod settings;
mod transport;

use components::{ChatsComponent, ContactsComponent, SettingsComponent, QrScannerComponent};
use crypto::XMessengerCrypto;
use data::{Contact, Message, ProxyConfig, Database};
use settings::AppSettings;

/// Main Application State
pub struct App {
    crypto: Arc<XMessengerCrypto>,
    database: Arc<Database>,
    settings: Arc<AppSettings>,
    current_page: Page,
    connection_state: ConnectionState,
    unread_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Page {
    Chats,
    Contacts,
    Settings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Connected,
    Connecting,
    Disconnected,
    Offline,
}

/// Application Messages
#[derive(Debug)]
pub enum AppMsg {
    SwitchPage(Page),
    NewContact,
    ScanQrCode,
    SettingsChanged,
    ConnectionStateChanged(ConnectionState),
    UnreadCountChanged(u32),
    NewMessage(Contact, Message),
    ContactAdded(Contact),
    ContactRemoved(String),
    ProxyConfigAdded(ProxyConfig),
    ShowError(String),
    ShowInfo(String),
}

/// Main Window Component
#[relm4::component(pub)]
impl Component for App {
    type Init = ();
    type Input = AppMsg;
    type Output = ();
    type CommandOutput = ();

    view! {
        adw::ApplicationWindow {
            set_title: Some("X-Messenger"),
            set_default_size: (1000, 700),
            set_content = &main_box,

            adw::NavigationView {
                set_show_title: false,
                set_back_button_visible: false,
                set_content = &nav_page,
            } as nav_view,

            // Main content box
            main_box = gtk4::Box {
                set_orientation: gtk4::Orientation::Horizontal,
                set_spacing: 0,

                // Sidebar
                sidebar = gtk4::Box {
                    set_orientation: gtk4::Orientation::Vertical,
                    set_size_request: (280, -1),
                    add_css_class: "sidebar",
                    set_spacing: 0,

                    // Header
                    gtk4::Box {
                        set_orientation: gtk4::Orientation::Horizontal,
                        set_spacing: 12,
                        set_margin_top: 16,
                        set_margin_bottom: 16,
                        set_margin_start: 16,
                        set_margin_end: 16,
                        add_css_class: "sidebar-header",

                        gtk4::Image {
                            set_icon_name: Some("x-messenger"),
                            set_pixel_size: 48,
                        },
                        gtk4::Box {
                            set_orientation: gtk4::Orientation::Vertical,
                            set_hexpand: true,
                            gtk4::Label {
                                set_label: "X-Messenger",
                                add_css_class: "title-1",
                                set_halign: gtk4::Align::Start,
                            },
                            gtk4::Label {
                                set_label: &format!("{}", model.connection_state_text()),
                                add_css_class: "caption",
                                set_halign: gtk4::Align::Start,
                            },
                        },
                    },

                    // Navigation
                    adw::NavigationPage {
                        set_title: "Chats",
                        set_tag: "chats",
                        set_child = &chats_button,
                    } as chats_nav_page,

                    adw::NavigationPage {
                        set_title: "Contacts",
                        set_tag: "contacts",
                        set_child = &contacts_button,
                    } as contacts_nav_page,

                    adw::NavigationPage {
                        set_title: "Settings",
                        set_tag: "settings",
                        set_child = &settings_button,
                    } as settings_nav_page,

                    // Bottom actions
                    gtk4::Box {
                        set_orientation: gtk4::Orientation::Vertical,
                        set_spacing: 8,
                        set_margin_top: 16,
                        set_margin_bottom: 16,
                        set_margin_start: 16,
                        set_margin_end: 16,
                        set_vexpand: true,

                        gtk4::Button {
                            set_label: "Scan QR Code",
                            set_icon_name: Some("camera-symbolic"),
                            set_halign: gtk4::Align::Fill,
                            add_css_class: "suggested-action",
                            connect_clicked => AppMsg::ScanQrCode,
                        },
                        gtk4::Button {
                            set_label: "Add Contact",
                            set_icon_name: Some("list-add-symbolic"),
                            set_halign: gtk4::Align::Fill,
                            connect_clicked => AppMsg::NewContact,
                        },
                    },
                },

                // Separator
                gtk4::Separator {
                    set_orientation: gtk4::Orientation::Vertical,
                },

                // Main content area
                content_stack = adw::ViewStack {
                    set_vexpand: true,
                    set_hexpand: true,
                    set_transition_type: adw::ViewStackTransitionType::SlideLeftRight,
                },
            },
        }
    }

    model = App {
        crypto: Arc::new(XMessengerCrypto::new()),
        database: Arc::new(Database::new().unwrap()),
        settings: Arc::new(AppSettings::load()),
        current_page: Page::Chats,
        connection_state: ConnectionState::Offline,
        unread_count: 0,
    }

    init {
        // Initialize components
        let chats_component = ChatsComponent::builder()
            .launch((
                model.crypto.clone(),
                model.database.clone(),
                model.settings.clone(),
            ))
            .detach();

        let contacts_component = ContactsComponent::builder()
            .launch((
                model.crypto.clone(),
                model.database.clone(),
                model.settings.clone(),
            ))
            .detach();

        let settings_component = SettingsComponent::builder()
            .launch((
                model.crypto.clone(),
                model.database.clone(),
                model.settings.clone(),
            ))
            .detach();

        // Add components to stack
        view.content_stack.add_named(chats_component.widget(), "chats");
        view.content_stack.add_named(contacts_component.widget(), "contacts");
        view.content_stack.add_named(settings_component.widget(), "settings");

        // Set initial page
        view.content_stack.set_visible_child_name("chats");

        // Connect navigation
        view.chats_button.connect_clicked(clone!(sender => move |_| {
            sender.input(AppMsg::SwitchPage(Page::Chats));
        }));

        view.contacts_button.connect_clicked(clone!(sender => move |_| {
            sender.input(AppMsg::SwitchPage(Page::Contacts));
        }));

        view.settings_button.connect_clicked(clone!(sender => move |_| {
            sender.input(AppMsg::SwitchPage(Page::Settings));
        }));

        // Start background services
        start_background_services(model.crypto.clone(), model.database.clone(), sender.clone());
    }

    update(msg) {
        match msg {
            AppMsg::SwitchPage(page) => {
                model.current_page = page;
                let page_name = match page {
                    Page::Chats => "chats",
                    Page::Contacts => "contacts",
                    Page::Settings => "settings",
                };
                view.content_stack.set_visible_child_name(page_name);
            }
            AppMsg::NewContact => {
                // Show add contact dialog
                show_add_contact_dialog(&view.main_box, sender.clone());
            }
            AppMsg::ScanQrCode => {
                // Show QR scanner
                show_qr_scanner(&view.main_box, sender.clone());
            }
            AppMsg::SettingsChanged => {
                model.settings = Arc::new(AppSettings::load());
            }
            AppMsg::ConnectionStateChanged(state) => {
                model.connection_state = state;
                update_connection_status(&view.sidebar, state);
            }
            AppMsg::UnreadCountChanged(count) => {
                model.unread_count = count;
            }
            AppMsg::NewMessage(contact, message) => {
                // Handle new message
                handle_new_message(contact, message);
            }
            AppMsg::ContactAdded(contact) => {
                // Refresh contacts
            }
            AppMsg::ContactRemoved(id) => {
                // Refresh contacts
            }
            AppMsg::ProxyConfigAdded(config) => {
                // Add proxy config
            }
            AppMsg::ShowError(msg) => {
                show_error_dialog(&view.main_box, &msg);
            }
            AppMsg::ShowInfo(msg) => {
                show_info_dialog(&view.main_box, &msg);
            }
        }
    }
}

impl App {
    fn connection_state_text(&self) -> String {
        match self.connection_state {
            ConnectionState::Connected => "🟢 Connected via Cloudflare Tunnel".to_string(),
            ConnectionState::Connecting => "🟡 Connecting...".to_string(),
            ConnectionState::Disconnected => "🔴 Disconnected".to_string(),
            ConnectionState::Offline => "⚫ Offline Mode".to_string(),
        }
    }
}

fn update_connection_status(sidebar: &gtk4::Box, state: ConnectionState) {
    // Update status label in sidebar
    if let Some(label) = sidebar.last_child().and_then(|w| w.first_child()) {
        if let Some(label) = label.downcast_ref::<gtk4::Label>() {
            label.set_label(&match state {
                ConnectionState::Connected => "🟢 Connected via Cloudflare Tunnel",
                ConnectionState::Connecting => "🟡 Connecting...",
                ConnectionState::Disconnected => "🔴 Disconnected",
                ConnectionState::Offline => "⚫ Offline Mode",
            });
        }
    }
}

fn show_add_contact_dialog(parent: &gtk4::Box, sender: ComponentSender<App>) {
    let dialog = adw::MessageDialog::new(
        Some(parent.root().and_downcast::<adw::ApplicationWindow>().unwrap()),
        "Add Contact",
        "Enter contact details or scan QR code",
    );
    dialog.add_response("cancel", "Cancel");
    dialog.add_response("manual", "Add Manually");
    dialog.add_response("scan", "Scan QR");
    dialog.set_response_appearance("scan", adw::ResponseAppearance::Suggested);
    dialog.connect_response(move |dialog, response| {
        match response {
            "scan" => sender.input(AppMsg::ScanQrCode),
            "manual" => {
                // Show manual entry form
                show_manual_contact_form(dialog.root().and_downcast::<adw::ApplicationWindow>().unwrap(), sender.clone());
            }
            _ => {}
        }
        dialog.close();
    });
    dialog.present();
}

fn show_manual_contact_form(window: &adw::ApplicationWindow, sender: ComponentSender<App>) {
    let builder = gtk4::Builder::from_string(include_str!("ui/add_contact_dialog.ui"));
    let dialog: adw::Dialog = builder.object("add_contact_dialog").unwrap();
    dialog.set_transient_for(Some(window));
    
    let name_entry: gtk4::Entry = builder.object("name_entry").unwrap();
    let server_entry: gtk4::Entry = builder.object("server_entry").unwrap();
    let port_entry: gtk4::Entry = builder.object("port_entry").unwrap();
    let user_entry: gtk4::Entry = builder.object("user_entry").unwrap();
    let pass_entry: gtk4::Entry = builder.object("pass_entry").unwrap();
    let add_button: gtk4::Button = builder.object("add_button").unwrap();

    add_button.connect_clicked(clone!(sender, name_entry, server_entry, port_entry, user_entry, pass_entry, dialog => move |_| {
        let name = name_entry.text().to_string();
        let server = server_entry.text().to_string();
        let port_str = port_entry.text().to_string();
        let user = user_entry.text().to_string();
        let pass = pass_entry.text().to_string();

        if name.is_empty() || server.is_empty() || port_str.is_empty() {
            show_error_dialog(&dialog, "Please fill all required fields");
            return;
        }

        let port = port_str.parse::<u16>().unwrap_or(443);

        let contact = Contact {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            server,
            port,
            username: user,
            password: pass,
            public_key: None,
            fingerprint: None,
            added_at: chrono::Utc::now().timestamp_millis() as u64,
            last_seen: None,
        };

        sender.input(AppMsg::ContactAdded(contact));
        dialog.close();
    }));

    dialog.present();
}

fn show_qr_scanner(parent: &gtk4::Box, sender: ComponentSender<App>) {
    let qr_scanner = QrScannerComponent::builder()
        .launch((sender.clone(),))
        .detach();
    
    let dialog = adw::Dialog::new();
    dialog.set_content_width(400);
    dialog.set_content_height(500);
    dialog.set_child(Some(qr_scanner.widget()));
    dialog.present(parent.root().and_downcast::<adw::ApplicationWindow>().unwrap());
}

fn show_error_dialog(parent: &gtk4::Widget, message: &str) {
    let dialog = adw::MessageDialog::new(
        parent.root().and_downcast::<adw::ApplicationWindow>(),
        "Error",
        message,
    );
    dialog.add_response("ok", "OK");
    dialog.present();
}

fn show_info_dialog(parent: &gtk4::Widget, message: &str) {
    let dialog = adw::MessageDialog::new(
        parent.root().and_downcast::<adw::ApplicationWindow>(),
        "Information",
        message,
    );
    dialog.add_response("ok", "OK");
    dialog.present();
}

fn handle_new_message(contact: Contact, message: Message) {
    // Handle incoming message
}

fn start_background_services(
    crypto: Arc<XMessengerCrypto>,
    database: Arc<Database>,
    sender: ComponentSender<App>,
) {
    // Start network monitoring, sync service, etc.
    std::thread::spawn(move || {
        // Background sync loop
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            // Check connections, sync messages, etc.
        }
    });
}

fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Initialize crypto
    XMessengerCrypto::init().expect("Failed to initialize crypto");

    // Create application
    let app = Application::new(
        Some("com.xmessenger.offline"),
        gio::ApplicationFlags::DEFAULT_FLAGS,
    );

    // Load CSS
    let css_provider = gtk4::CssProvider::new();
    css_provider.load_from_string(include_str!("style.css"));
    adw::style_manager_get_default().add_provider(&css_provider, gtk4::STYLE_PROVIDER_PRIORITY_APPLICATION);

    // Run app
    let relm_app = RelmApp::new(app.clone());
    relm_app.run::<App>(());
}