package com.d4exam.app;

import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * D4EXAM MainActivity — native Capacitor shell (bundled assets, not the website).
 *
 * Loads local webDir content. API hosts (Supabase / Google / Firebase) stay in-app.
 * Does not open d4exam.name.ng or Vercel in Chrome for normal navigation.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ExamImmersivePlugin.class);
    registerPlugin(ScreenSharePlugin.class);
    super.onCreate(savedInstanceState);
    applyChromeColors();
    installInAppNavigationClient();
  }

  @Override
  public void onResume() {
    super.onResume();
    applyChromeColors();
    installInAppNavigationClient();
  }

  private void installInAppNavigationClient() {
    try {
      Bridge bridge = getBridge();
      if (bridge == null) return;
      WebView webView = bridge.getWebView();
      if (webView == null) return;
      webView.setWebViewClient(
          new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
              if (request == null || request.getUrl() == null) {
                return super.shouldOverrideUrlLoading(view, request);
              }
              if (shouldStayInApp(request.getUrl())) {
                return false;
              }
              return super.shouldOverrideUrlLoading(view, request);
            }
          });
    } catch (Throwable ignored) {
    }
  }

  private static boolean shouldStayInApp(Uri uri) {
    try {
      String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
      if ("file".equals(scheme)
          || "about".equals(scheme)
          || "data".equals(scheme)
          || "capacitor".equals(scheme)
          || "https".equals(scheme)
          || "http".equals(scheme)) {
        // ok
      } else {
        return false;
      }
      if ("file".equals(scheme)
          || "about".equals(scheme)
          || "data".equals(scheme)
          || "capacitor".equals(scheme)) {
        return true;
      }
      String host = uri.getHost();
      if (host == null) return true;
      host = host.toLowerCase();
      if (host.equals("localhost") || host.equals("127.0.0.1")) return true;
      // Backend / media only — not the marketing website
      if (host.contains("supabase.co")) return true;
      if (host.contains("googleapis.com") || host.contains("gstatic.com")) return true;
      if (host.contains("firebaseio.com")
          || host.contains("firebasestorage.app")
          || host.contains("firebaseapp.com")) {
        return true;
      }
      return false;
    } catch (Throwable t) {
      return true;
    }
  }

  private void applyChromeColors() {
    try {
      Window w = getWindow();
      if (w == null) return;
      int navy = Color.parseColor("#0b1b3a");
      w.setStatusBarColor(navy);
      w.setNavigationBarColor(navy);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        w.setNavigationBarContrastEnforced(false);
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        View decor = w.getDecorView();
        int flags = decor.getSystemUiVisibility();
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        decor.setSystemUiVisibility(flags);
      }
    } catch (Exception ignored) {
    }
  }
}
