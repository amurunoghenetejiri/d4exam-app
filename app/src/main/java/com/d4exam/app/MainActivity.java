package com.d4exam.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.CookieManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;

public class MainActivity extends AppCompatActivity {

    private static final String[] APP_URLS = new String[] {
        "https://d4exam-platform.vercel.app",
        "https://d4exam.name.ng"
    };
    private static final int COLOR_NAVY = Color.parseColor("#0b1b3a");
    private static final int REQ_PERMS = 4401;

    private WebView web;
    private FrameLayout splash;
    private int urlIndex = 0;
    private boolean pageOk = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            applySystemBars();
            FrameLayout root = buildUi();
            setContentView(root);
            setupWebView();
            requestStartupPermissions();
            loadApp();
        } catch (Throwable t) {
            TextView err = new TextView(this);
            err.setText("D4EXAM failed to start.\n" + t.getMessage());
            err.setTextColor(Color.WHITE);
            err.setBackgroundColor(COLOR_NAVY);
            err.setGravity(Gravity.CENTER);
            err.setPadding(48, 48, 48, 48);
            setContentView(err);
        }
    }

    private void applySystemBars() {
        try {
            Window w = getWindow();
            w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            w.setStatusBarColor(COLOR_NAVY);
            if (Build.VERSION.SDK_INT >= 21) w.setNavigationBarColor(COLOR_NAVY);
        } catch (Throwable ignored) {}
    }

    private FrameLayout buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(COLOR_NAVY);

        web = new WebView(this);
        web.setBackgroundColor(COLOR_NAVY);
        root.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Splash: big logo + D4EXAM + SMART. SECURE. SEAMLESS. at bottom
        splash = new FrameLayout(this);
        splash.setBackgroundColor(COLOR_NAVY);
        splash.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ImageView logo = new ImageView(this);
        try { logo.setImageResource(R.drawable.d4exam_logo); }
        catch (Throwable t) {
            try { logo.setImageResource(R.drawable.ic_launcher); } catch (Throwable ignored) {}
        }
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(168), dp(168));
        lp.gravity = Gravity.CENTER;
        lp.bottomMargin = dp(28);
        logo.setLayoutParams(lp);
        // gentle pulse
        logo.animate().scaleX(1.06f).scaleY(1.06f).setDuration(900).withEndAction(new Runnable() {
            @Override public void run() {
                try {
                    logo.animate().scaleX(1f).scaleY(1f).setDuration(900).withEndAction(this).start();
                } catch (Throwable ignored) {}
            }
        }).start();
        splash.addView(logo);

        TextView brand = new TextView(this);
        brand.setText("D4EXAM");
        brand.setTextColor(Color.WHITE);
        brand.setTextSize(26f);
        brand.setGravity(Gravity.CENTER);
        brand.setLetterSpacing(0.18f);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bp.gravity = Gravity.CENTER;
        bp.topMargin = dp(110);
        brand.setLayoutParams(bp);
        splash.addView(brand);

        TextView tag = new TextView(this);
        tag.setText("SMART. SECURE. SEAMLESS.");
        tag.setTextColor(Color.parseColor("#94a3b8"));
        tag.setTextSize(10f);
        tag.setLetterSpacing(0.28f);
        tag.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams tp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        tp.bottomMargin = dp(48);
        tag.setLayoutParams(tp);
        splash.addView(tag);

        root.addView(splash);
        return root;
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
        try {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= 21) cm.setAcceptThirdPartyCookies(web, true);
        } catch (Throwable ignored) {}

        web.addJavascriptInterface(new D4Bridge(), "D4Android");

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        try { request.grant(request.getResources()); } catch (Throwable ignored) {}
                    }
                });
            }
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress > 55) hideSplash();
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                pageOk = true;
                hideSplash();
                injectNativeFlag();
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) tryNextOrOffline();
            }
        });
    }

    private void injectNativeFlag() {
        try {
            web.evaluateJavascript(
                "window.__D4_NATIVE__=true;"
                    + "try{window.localStorage.setItem('d4exam_native_shell_v1','android');}catch(e){}"
                    + "try{window.dispatchEvent(new Event('d4-native-ready'));}catch(e){}",
                null
            );
        } catch (Throwable ignored) {}
    }

    private void requestStartupPermissions() {
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                need.add(Manifest.permission.POST_NOTIFICATIONS);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED)
                need.add(Manifest.permission.READ_MEDIA_IMAGES);
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED)
                need.add(Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
                need.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.CAMERA);
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.RECORD_AUDIO);
        if (!need.isEmpty()) {
            ActivityCompat.requestPermissions(this, need.toArray(new String[0]), REQ_PERMS);
        }
    }

    private void loadApp() {
        urlIndex = 0;
        loadCurrentUrl();
    }

    private void loadCurrentUrl() {
        if (urlIndex < APP_URLS.length) {
            try { web.loadUrl(APP_URLS[urlIndex]); }
            catch (Throwable t) { urlIndex++; loadCurrentUrl(); }
        } else {
            showOfflineHtml();
        }
    }

    private void tryNextOrOffline() {
        if (pageOk) return;
        urlIndex++;
        if (urlIndex < APP_URLS.length) loadCurrentUrl();
        else showOfflineHtml();
    }

    private void showOfflineHtml() {
        hideSplash();
        String html = "<!DOCTYPE html><html><body style='background:#0b1b3a;color:#fff;font-family:sans-serif;text-align:center;padding:40px'>"
            + "<h2>D4EXAM</h2><p>No network. Connect and retry.</p>"
            + "<p><a style='color:#60a5fa' href='" + APP_URLS[0] + "'>Retry</a></p></body></html>";
        try { web.loadDataWithBaseURL(APP_URLS[0], html, "text/html", "UTF-8", null); }
        catch (Throwable ignored) {}
    }

    private void hideSplash() {
        if (splash == null) return;
        splash.post(new Runnable() {
            @Override public void run() {
                try { if (splash != null) splash.setVisibility(View.GONE); } catch (Throwable ignored) {}
            }
        });
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            NetworkInfo n = cm.getActiveNetworkInfo();
            return n != null && n.isConnected();
        } catch (Throwable t) { return true; }
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        try {
            if (web != null && web.canGoBack()) { web.goBack(); return; }
        } catch (Throwable ignored) {}
        try { super.onBackPressed(); } catch (Throwable t) { finish(); }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            if (web != null) {
                web.onResume();
                try {
                    web.getSettings().setCacheMode(
                        isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
                } catch (Throwable ignored) {}
            }
        } catch (Throwable ignored) {}
    }

    @Override
    protected void onPause() {
        try { if (web != null) web.onPause(); } catch (Throwable ignored) {}
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        try {
            if (web != null) {
                web.stopLoading();
                web.destroy();
                web = null;
            }
        } catch (Throwable ignored) {}
        super.onDestroy();
    }

    /** JS bridge used by unlock screen for fingerprint */
    public class D4Bridge {
        @JavascriptInterface
        public boolean isBiometricAvailable() {
            try {
                BiometricManager bm = BiometricManager.from(MainActivity.this);
                int can = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
                return can == BiometricManager.BIOMETRIC_SUCCESS;
            } catch (Throwable t) {
                return false;
            }
        }

        @JavascriptInterface
        public void authenticate(final String reason) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Executor ex = ContextCompat.getMainExecutor(MainActivity.this);
                        BiometricPrompt prompt = new BiometricPrompt(
                            MainActivity.this,
                            ex,
                            new BiometricPrompt.AuthenticationCallback() {
                                @Override
                                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                    notifyJs(true, "ok", "ok");
                                }
                                @Override
                                public void onAuthenticationError(int errorCode, CharSequence errString) {
                                    String code = (errorCode == BiometricPrompt.ERROR_USER_CANCELED
                                        || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON)
                                        ? "cancelled" : "failed";
                                    notifyJs(false, code, String.valueOf(errString));
                                }
                                @Override
                                public void onAuthenticationFailed() {
                                    // keep prompt open; optional soft fail
                                }
                            }
                        );
                        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                            .setTitle("D4EXAM")
                            .setSubtitle(reason == null || reason.isEmpty() ? "Unlock with fingerprint" : reason)
                            .setNegativeButtonText("Use password")
                            .build();
                        prompt.authenticate(info);
                    } catch (Throwable t) {
                        notifyJs(false, "error", t.getMessage());
                    }
                }
            });
        }

        private void notifyJs(boolean ok, String code, String message) {
            final String js = "try{if(window.__d4FpResult)window.__d4FpResult("
                + (ok ? "true" : "false") + ","
                + jsonStr(code) + ","
                + jsonStr(message) + ");}catch(e){}";
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try { web.evaluateJavascript(js, null); } catch (Throwable ignored) {}
                }
            });
        }

        private String jsonStr(String s) {
            if (s == null) return "\"\"";
            return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        }
    }
}
