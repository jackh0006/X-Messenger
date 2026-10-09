// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:x_messenger/main.dart';

void main() {
  testWidgets('shows the v1.0.5-face shell with drawer and tabs', (
    tester,
  ) async {
    await tester.pumpWidget(const XMessengerApp());
    // AppBar title + navigation destination share the label by design.
    expect(find.text('Chats'), findsWidgets);
    expect(find.text('No verified contacts'), findsOneWidget);
    expect(find.byKey(const Key('menuBtn')), findsOneWidget);
  });

  testWidgets('composer stores a local-only message', (tester) async {
    await tester.pumpWidget(const XMessengerApp());
    await tester.enterText(find.byType(TextField), 'hello offline');
    await tester.tap(find.text('Seal'));
    await tester.pump();
    expect(find.text('hello offline'), findsOneWidget);
    expect(find.text('local only · not yet sealed'), findsOneWidget);
  });

  testWidgets('vault page shows fingerprint row', (tester) async {
    await tester.pumpWidget(const XMessengerApp());
    await tester.tap(find.text('Vault').last);
    await tester.pumpAndSettle();
    expect(find.text('Identity fingerprint'), findsOneWidget);
  });
}
