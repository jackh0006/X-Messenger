# Use X Messenger on Android

## Build the standalone Android app

1. Install Android Studio on the Linux computer. At its first launch, accept the recommended Android SDK, Build Tools, and Android platform installation.
2. In this project run:

   ```bash
   npm run android:setup
   ```

3. Android Studio opens the native project. Connect an Android ARM64 phone by USB, enable Developer Options and USB debugging, then select the phone and press the green Run button.
4. To make an APK, choose **Build → Build APK(s)** in Android Studio. The debug APK is installed directly; create a release signing key before sharing a release build.

After the APK is installed, X Messenger’s HTML, JavaScript, QR encoder, and QR decoder are bundled inside the app. It does not need the Linux server, Wi-Fi, mobile data, or internet connection to use encrypted transfers. The Android manifest requests only camera access for QR scanning; it does not request internet permission.

## Everyday use

1. On the sender’s device, type a short message and tap the arrow.
2. Choose a long shared phrase. Give the phrase to the receiver in person, never inside the QR code.
3. Show the generated QR code.
4. On the receiver’s device, tap the QR icon, scan the code, enter the same phrase, and tap **Decrypt on this device**.

Use a new phrase for every important transfer and verify your contact in person.
