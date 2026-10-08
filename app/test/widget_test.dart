import 'package:flutter_test/flutter_test.dart';
import 'package:x_messenger/main.dart';

void main() {
  testWidgets('shows the shared X Messenger shell', (tester) async {
    await tester.pumpWidget(const XMessengerApp());
    // 'Chats' appears twice by design: AppBar title + navigation destination.
    expect(find.text('Chats'), findsWidgets);
    expect(find.text('No verified contacts'), findsOneWidget);
  });
}
