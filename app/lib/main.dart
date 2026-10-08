import 'package:flutter/material.dart';

void main() => runApp(const XMessengerApp());

class XMessengerApp extends StatelessWidget {
  const XMessengerApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xff2563eb);
    return MaterialApp(
      title: 'X Messenger',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      themeMode: ThemeMode.system,
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
  static const _titles = ['Chats', 'Scan', 'Vault', 'Settings'];
  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.forum_outlined),
      selectedIcon: Icon(Icons.forum),
      label: 'Chats',
    ),
    NavigationDestination(icon: Icon(Icons.qr_code_scanner), label: 'Scan'),
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
  ];
  static const _railDestinations = [
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
  ];

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 840;
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        actions: [
          IconButton(
            tooltip: 'Security status',
            onPressed: () => _showStatus(context),
            icon: const Icon(Icons.verified_user_outlined),
          ),
        ],
      ),
      body: Row(
        children: [
          if (wide)
            NavigationRail(
              selectedIndex: _tab,
              labelType: NavigationRailLabelType.all,
              onDestinationSelected: (value) => setState(() => _tab = value),
              destinations: _railDestinations,
            ),
          Expanded(child: _page(context)),
        ],
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: _tab,
              onDestinationSelected: (value) => setState(() => _tab = value),
              destinations: _destinations,
            ),
    );
  }

  Widget _page(BuildContext context) => switch (_tab) {
    0 => const _EmptyState(
      icon: Icons.person_add_alt_1_outlined,
      title: 'No verified contacts',
      message: 'Pair face to face before sending anything sensitive.',
    ),
    1 => const _EmptyState(
      icon: Icons.qr_code_2,
      title: 'Scanner not connected',
      message: 'QR transport will be enabled only after the Rust transport is reviewed.',
    ),
    2 => const _EmptyState(
      icon: Icons.shield_outlined,
      title: 'Vault not initialized',
      message: 'The encrypted Rust vault is not available in this build yet.',
    ),
    _ => ListView(
      padding: const EdgeInsets.all(24),
      children: const [
        ListTile(
          leading: Icon(Icons.wifi_off),
          title: Text('Strict offline mode'),
          subtitle: Text('No network feature is enabled in this UI.'),
        ),
        ListTile(
          leading: Icon(Icons.info_outline),
          title: Text('Experimental build'),
          subtitle: Text(
            'Do not store seed phrases, private keys, or other crown-jewel secrets yet.',
          ),
        ),
      ],
    ),
  };

  void _showStatus(BuildContext context) => showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Security status'),
      content: const Text(
        'Shared UI foundation only. Cryptographic storage and transport remain blocked pending clean builds, tests, and review.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
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
            Icon(icon, size: 56),
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
