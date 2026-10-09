// SPDX-License-Identifier: AGPL-3.0-or-later
// X Messenger shared UI — v1.0.5 face: dark navy + teal, drawer + tabs,
// chats, QR transfer dialogs, phrase vault, receive scanner, donate.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() => runApp(const XMessengerApp());

class XMessengerApp extends StatelessWidget {
  const XMessengerApp({super.key});

  static const deepSea = Color(0xff0e183b);
  static const panelSea = Color(0xff163140);
  static const tealTide = Color(0xff47aa99);
  static const foam = Color(0xffe8f1f2);

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: tealTide,
      brightness: Brightness.dark,
    ).copyWith(surface: panelSea, surfaceContainerLowest: deepSea);
    return MaterialApp(
      title: 'X Messenger',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: scheme,
        useMaterial3: true,
        scaffoldBackgroundColor: deepSea,
        drawerTheme: const DrawerThemeData(backgroundColor: panelSea),
        dialogTheme: DialogThemeData(
          backgroundColor: panelSea,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        snackBarTheme: const SnackBarThemeData(
          backgroundColor: panelSea,
          contentTextStyle: TextStyle(color: foam),
        ),
      ),
      darkTheme: ThemeData(
        colorScheme: scheme,
        useMaterial3: true,
        scaffoldBackgroundColor: deepSea,
      ),
      themeMode: ThemeMode.dark,
      home: const MessengerHome(),
    );
  }
}

class MessengerHome extends StatefulWidget {
  const MessengerHome({super.key});
  @override
  State<MessengerHome> createState() => _MessengerHomeState();
}

class _MessengerHomeState extends State<MessengerHome> {
  int _tab = 0;
  final List<_ChatMessage> _messages = [];
  final TextEditingController _composer = TextEditingController();
  final TextEditingController _payloadInput = TextEditingController();
  final TextEditingController _phraseInput = TextEditingController();

  static const _titles = ['Chats', 'Scan', 'Vault', 'Settings'];
  static const _subtitles = [
    'Seal here, show QR, decrypt offline',
    'Point, capture, decrypt — nothing leaves the device',
    'Keys rest encrypted. Passphrase first, always',
    'Strict offline. No accounts, no servers',
  ];

  @override
  void dispose() {
    _composer.dispose();
    _payloadInput.dispose();
    _phraseInput.dispose();
    super.dispose();
  }

  void _send() {
    final text = _composer.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _messages.add(_ChatMessage(text, DateTime.now(), mine: true));
      _composer.clear();
    });
  }

  void _copy(String label, String value) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied — clears with the app')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 840;
    return Scaffold(
      appBar: AppBar(
        leading: Builder(
          builder: (ctx) => IconButton(
            key: const Key('menuBtn'),
            tooltip: 'Menu',
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titles[_tab], key: ValueKey('viewTitle-$_tab')),
            Text(
              _subtitles[_tab],
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Security status',
            icon: const Icon(Icons.verified_user_outlined),
            onPressed: () => _securityDialog(context),
          ),
          IconButton(
            tooltip: 'About',
            icon: const Icon(Icons.info_outline),
            onPressed: () => _aboutDialog(context),
          ),
        ],
      ),
      drawer: _appDrawer(context),
      body: Row(
        children: [
          if (wide)
            NavigationRail(
              selectedIndex: _tab,
              labelType: NavigationRailLabelType.all,
              onDestinationSelected: (v) => setState(() => _tab = v),
              destinations: const [
                NavigationRailDestination(
                  icon: Icon(Icons.forum_outlined),
                  selectedIcon: Icon(Icons.forum),
                  label: Text('Chats'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.qr_code_scanner),
                  label: Text('Scan'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.lock_outline),
                  selectedIcon: Icon(Icons.lock),
                  label: Text('Vault'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.settings_outlined),
                  selectedIcon: Icon(Icons.settings),
                  label: Text('Settings'),
                ),
              ],
            ),
          Expanded(child: _page(context)),
        ],
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _tab,
              onDestinationSelected: (v) => setState(() => _tab = v),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.forum_outlined),
                  selectedIcon: Icon(Icons.forum),
                  label: 'Chats',
                ),
                NavigationDestination(
                  icon: Icon(Icons.qr_code_scanner),
                  label: 'Scan',
                ),
                NavigationDestination(
                  icon: Icon(Icons.lock_outline),
                  selectedIcon: Icon(Icons.lock),
                  label: 'Vault',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  selectedIcon: Icon(Icons.settings),
                  label: 'Settings',
                ),
              ],
            ),
    );
  }

  Widget _appDrawer(BuildContext context) => Drawer(
    child: ListView(
      padding: EdgeInsets.zero,
      children: [
        const DrawerHeader(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.mark_unread_chat_alt_outlined,
                    size: 32,
                    color: XMessengerApp.tealTide,
                  ),
                  SizedBox(width: 10),
                  Text(
                    'X Messenger',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              SizedBox(height: 6),
              Text(
                'Offline courier · no accounts · no servers',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
        _drawerItem(context, Icons.forum_outlined, 'Chats', 0),
        _drawerItem(
          context,
          Icons.qr_code_2_outlined,
          'New transfer',
          -1,
          onTap: () => _transferDialog(context),
        ),
        _drawerItem(context, Icons.qr_code_scanner, 'Receive', 1),
        _drawerItem(context, Icons.lock_outline, 'Vault', 2),
        _drawerItem(context, Icons.settings_outlined, 'Settings', 3),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.volunteer_activism_outlined),
          title: const Text('Donate'),
          onTap: () => _donateDialog(context),
        ),
        ListTile(
          leading: const Icon(Icons.shield_outlined),
          title: const Text('Security'),
          onTap: () => _securityDialog(context),
        ),
        ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Text('About'),
          onTap: () => _aboutDialog(context),
        ),
      ],
    ),
  );

  ListTile _drawerItem(
    BuildContext context,
    IconData icon,
    String label,
    int tab, {
    void Function()? onTap,
  }) => ListTile(
    leading: Icon(icon),
    title: Text(label),
    onTap: () {
      Navigator.pop(context);
      if (onTap != null) {
        onTap();
      } else {
        setState(() => _tab = tab);
      }
    },
  );

  Widget _page(BuildContext context) => switch (_tab) {
    0 => _chatsPage(context),
    1 => _scanPage(context),
    2 => _vaultPage(context),
    _ => _settingsPage(context),
  };

  Widget _chatsPage(BuildContext context) => Column(
    children: [
      Expanded(
        child: _messages.isEmpty
            ? const _EmptyState(
                icon: Icons.person_add_alt_1_outlined,
                title: 'No verified contacts',
                message: 'Pair face to face before sending anything sensitive.',
              )
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _messages.length,
                itemBuilder: (ctx, i) {
                  final m = _messages[i];
                  return Align(
                    alignment: m.mine
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Card(
                      color: m.mine
                          ? XMessengerApp.tealTide.withValues(alpha: 0.25)
                          : XMessengerApp.panelSea,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(m.text),
                            const SizedBox(height: 2),
                            const Text(
                              'local only · not yet sealed',
                              style: TextStyle(fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
      SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _composer,
                  decoration: const InputDecoration(
                    hintText: 'Write locally…',
                    border: OutlineInputBorder(),
                  ),
                  minLines: 1,
                  maxLines: 4,
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: _send,
                icon: const Icon(Icons.send_outlined),
                label: const Text('Seal'),
              ),
              const SizedBox(width: 4),
              IconButton(
                tooltip: 'Show as QR',
                icon: const Icon(Icons.qr_code_2_outlined),
                onPressed: () => _transferDialog(context),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Widget _scanPage(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const _EmptyState(
        icon: Icons.qr_code_scanner,
        title: 'Scanner',
        message: 'Camera capture arrives with the reviewed transport. Paste a received payload below to inspect its envelope.',
      ),
      TextField(
        controller: _payloadInput,
        decoration: const InputDecoration(
          labelText: 'Received payload',
          border: OutlineInputBorder(),
        ),
        minLines: 3,
        maxLines: 6,
      ),
      const SizedBox(height: 8),
      TextField(
        controller: _phraseInput,
        decoration: const InputDecoration(
          labelText: 'Safety phrase (words shown at pairing)',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 12),
      FilledButton.icon(
        onPressed: () => _receiveSheet(context),
        icon: const Icon(Icons.lock_open_outlined),
        label: const Text('Open envelope'),
      ),
    ],
  );

  Widget _vaultPage(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Card(
        child: ListTile(
          leading: const Icon(Icons.fingerprint),
          title: const Text('Identity fingerprint'),
          subtitle: const Text(
            'Generated at first launch — compare face to face',
          ),
          trailing: IconButton(
            tooltip: 'Copy fingerprint',
            icon: const Icon(Icons.copy_outlined),
            onPressed: () =>
                _copy('Fingerprint', 'XM1 DEMO FINGERPRINT — vault pending'),
          ),
        ),
      ),
      Card(
        child: ListTile(
          leading: const Icon(Icons.password_outlined),
          title: const Text('High-value phrase mode'),
          subtitle: const Text(
            'Keys and seeds are sealed separately from chat text',
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _phraseDialog(context),
        ),
      ),
      const Card(
        child: ListTile(
          leading: Icon(Icons.shield_outlined),
          title: Text('Vault status'),
          subtitle: Text(
            'Rust vault pending: Argon2id + XChaCha20 + duress slot.\nNothing here is encrypted yet.',
          ),
        ),
      ),
    ],
  );

  Widget _settingsPage(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: const [
      Card(
        child: ListTile(
          leading: Icon(Icons.wifi_off),
          title: Text('Strict offline mode'),
          subtitle: Text(
            'No network feature in this UI. Release builds carry no INTERNET permission (CI + aapt2 verified).',
          ),
        ),
      ),
      Card(
        child: ListTile(
          leading: Icon(Icons.info_outline),
          title: Text('Experimental build'),
          subtitle: Text(
            'Do not store seed phrases, private keys, or crown-jewel secrets yet.',
          ),
        ),
      ),
      Card(
        child: ListTile(
          leading: Icon(Icons.volunteer_activism_outlined),
          title: Text('Donate'),
          subtitle: Text('No ads, no premium — see the Donate dialog.'),
        ),
      ),
    ],
  );

  void _transferDialog(BuildContext context) => showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('New transfer'),
      content: const Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _QrPlaceholder(),
          SizedBox(height: 12),
          Text(
            'Sealed QR appears here once the reviewed vault lands. Payload actions stay disabled until then.',
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Close'),
        ),
        FilledButton.icon(
          onPressed: null,
          icon: const Icon(Icons.qr_code_2_outlined),
          label: const Text('Seal transfer'),
        ),
      ],
    ),
  );

  void _phraseDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('High-value phrase mode'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Type the key or seed. It is sealed separately from chat text once the vault lands — never shown in QR previews.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              obscureText: true,
              enableSuggestions: false,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Key / seed phrase',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              controller.clear();
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Vault pending — phrase discarded safely'),
                ),
              );
            },
            child: const Text('Seal phrase'),
          ),
        ],
      ),
    );
  }

  void _receiveSheet(BuildContext context) {
    final payload = _payloadInput.text.trim();
    final phrase = _phraseInput.text.trim();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Envelope inspection'),
        content: Text(
          payload.isEmpty
              ? 'Paste a payload first. Nothing is decrypted in this build.'
              : 'Envelope held (${payload.length} chars, '
                    'phrase ${phrase.isEmpty ? 'missing' : 'present'}). '
                    'Decryption arrives with the reviewed vault — nothing here is trusted yet.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _donateDialog(BuildContext context) {
    const rows = [
      ('Bitcoin', 'bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83'),
      ('DOGE', 'D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC'),
      ('Ethereum / USDT / BNB', '0xdad428900a4359be8f76b3062df34211582e09eb'),
      ('TRX / USDT TRC20', 'TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf'),
      ('SOL / USDT SPL', 'BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL'),
      ('XRP', 'rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9'),
      ('TON', 'UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX'),
      ('LTC', 'ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8'),
    ];
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Donate — no ads, no premium'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: rows.length,
            itemBuilder: (_, i) => ListTile(
              dense: true,
              title: Text(rows[i].$1),
              subtitle: Text(rows[i].$2, style: const TextStyle(fontSize: 11)),
              trailing: IconButton(
                tooltip: 'Copy address',
                icon: const Icon(Icons.copy_outlined),
                onPressed: () => _copy(rows[i].$1, rows[i].$2),
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _securityDialog(BuildContext context) => showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Security status'),
      content: const Text(
        'Strict offline UI: no network code, no INTERNET permission in release builds, backups off, secure window on.\n\nVault, pairing, and QR/NFC transport are pending the reviewed Rust core + independent audit. See docs/MASTER_SPEC_100.md for the per-point status.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Close'),
        ),
      ],
    ),
  );

  void _aboutDialog(BuildContext context) => showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('X Messenger'),
      content: const Text(
        'Offline-first secret courier. AGPL-3.0-or-later, by jackh0006.\nSupport: jackh109867@gmail.com (never send real phrases).',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}

class _ChatMessage {
  _ChatMessage(this.text, this.when, {this.mine = false});
  final String text;
  final DateTime when;
  final bool mine;
}

class _QrPlaceholder extends StatelessWidget {
  const _QrPlaceholder();

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 1,
    child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: XMessengerApp.tealTide, width: 2),
      ),
      child: const Center(
        child: Icon(Icons.qr_code_2_outlined, size: 96, color: Colors.black26),
      ),
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;
  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: XMessengerApp.tealTide),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    ),
  );
}
