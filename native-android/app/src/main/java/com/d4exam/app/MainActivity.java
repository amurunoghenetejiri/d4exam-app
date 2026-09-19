package com.d4exam.app;

import android.content.Context;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

/**
 * D4EXAM main activity.
 *
 * ONLINE  -> loads the production Vercel app (server.url in capacitor.config.json).
 *            SSR + server functions keep working exactly as before.
 * OFFLINE -> at cold start only, the server URL is dropped so the WebView loads the
 *            bundled local D4EXAM app shell from assets/public. The user then gets the
 *            normal D4EXAM splash, fingerprint/unlock and cached dashboard instead of
 *            the generic "No Internet Connection" error page.
 *
 * Do not use the AndroidX system splash install API here: it needs a matching
 * theme + dependency and caused instant cold-start crashes when CI regenerates
 * the Android project. Splash is handled by:
 *   1) AppTheme.NoActionBarLaunch (solid navy, no adaptive-icon flash on API 31+)
 *   2) Capacitor SplashScreen plugin (kept until web hides it)
 *   3) AnimatedSplash in the web app (branded D4EXAM screen)
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Register native plugins BEFORE super.onCreate (Capacitor requirement)
    registerPlugin(ExamImmersivePlugin.class);
    registerPlugin(ScreenSharePlugin.class);

    if (!hasInternet()) {
      try {
        CapConfig offlineConfig = new CapConfig.Builder(this).setServerUrl(null).create();
        bridgeBuilder.setConfig(offlineConfig);
      } catch (Throwable ignored) {
        // Never block launch — fall back to the normal remote shell
      }
    }

    super.onCreate(savedInstanceState);
    applyChromeColors();
  }

  /** True only when the device has a validated internet-capable connection. */
  private boolean hasInternet() {
    try {
      ConnectivityManager cm =
          (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return true;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Network net = cm.getActiveNetwork();
        if (net == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(net);
        if (caps == null) return false;
        boolean internet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        boolean validated =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        return internet && validated;
      }
      return cm.getActiveNetworkInfo() != null && cm.getActiveNetworkInfo().isConnected();
    } catch (Throwable ignored) {
      return true;
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    applyChromeColors();
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
      // Never block launch
    }
  }
}
