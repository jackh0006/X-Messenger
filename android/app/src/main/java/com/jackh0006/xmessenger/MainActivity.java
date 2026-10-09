package com.jackh0006.xmessenger;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep ordinary screenshots and task-switcher previews from exposing
        // a message or phrase. This is defense in depth, not DRM.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE);
        SharedPreferences preferences = getSharedPreferences("x_messenger", MODE_PRIVATE);
        if (preferences.getInt("bundled_assets_version", 0) < 3) {
            WebView webView = getBridge().getWebView();
            if (webView != null) webView.clearCache(true);
            preferences.edit().putInt("bundled_assets_version", 3).apply();
        }
    }
}
