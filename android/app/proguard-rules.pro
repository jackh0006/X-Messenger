# X Messenger release keeps: Capacitor bridge + WebView must survive R8.
# Without these, minifyEnabled release builds crash on old devices (API 28+).
-keep public class com.getcapacitor.** { public *; }
-keep public class com.jackh0006.xmessenger.** { *; }
-keepattributes SourceFile,LineNumberTable,JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# Capacitor plugins are loaded by reflection; keep their constructors.
-keepclasseswithmembers class * {
    public <init>(android.content.Context);
}
-dontwarn com.getcapacitor.**
-dontwarn androidx.webkit.**
