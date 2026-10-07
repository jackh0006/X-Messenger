package com.jackh0006.xmessenger;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SharedPreferences preferences = getSharedPreferences("x_messenger", MODE_PRIVATE);
        if (preferences.getInt("bundled_assets_version", 0) < 2) {
            WebView webView = getBridge().getWebView();
            if (webView != null) webView.clearCache(true);
            preferences.edit().putInt("bundled_assets_version", 2).apply();
        }
    }
}
