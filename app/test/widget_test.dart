import 'package:flutter_test/flutter_test.dart';
import 'package:x_messenger/main.dart';

void main() {
  testWidgets('shows the shared X Messenger shell', (tester) async {
    await tester.pumpWidget(const XMessengerApp());
    expect(find.text('Chats'), findsOneWidget);
    expect(find.text('No verified contacts'), findsOneWidget);
  });
}
