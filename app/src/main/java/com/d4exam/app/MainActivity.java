package com.d4exam.app;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;

/**
 * D4EXAM — same product UI as d4exam-web, in-app WebView.
 * Crash-safe startup, navy splash, progress, offline retry page.
 */
public class MainActivity extends AppCompatActivity {

    // Primary + fallback hosts (same platform)
    private static final String[] APP_URLS = new String[] {
        "https://d4exam-platform.vercel.app",
        "https://d4exam.name.ng",
        "https://www.d4exam.name.ng"
    };

    private static final int COLOR_NAVY = Color.parseColor("#0b1b3a");
    private static final int COLOR_BLUE = Color.parseColor("#2563eb");

    private WebView web;
    private ProgressBar progress;
    private FrameLayout splash;
    private int urlIndex = 0;
    private boolean pageOk = false;

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
        } catch (Throwable t) {
            // Extremely defensive — should never happen
            super.onCreate(null);
        }

        try {
            applySystemBars();
            FrameLayout root = buildUi();
            setContentView(root);
            setupWebView();
            loadApp();
        } catch (Throwable t) {
            // Last-resort UI so the process does not die with a white crash screen
            TextView err = new TextView(this);
            err.setText("D4EXAM failed to start.\n" + (t.getMessage() == null ? t.toString() : t.getMessage()));
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
            if (Build.VERSION.SDK_INT >= 21) {
                w.setNavigationBarColor(COLOR_NAVY);
            }
            if (Build.VERSION.SDK_INT >= 23) {
                View decor = w.getDecorView();
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            }
        } catch (Throwable ignored) {
        }
    }

    private FrameLayout buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(COLOR_NAVY);
        root.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        web = new WebView(this);
        web.setBackgroundColor(COLOR_NAVY);
        web.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.addView(web);

        /* progress bar removed for native-app feel */

        // Splash overlay (same navy branding as d4exam-web)
        splash = new FrameLayout(this);
        splash.setBackgroundColor(COLOR_NAVY);
        splash.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        ImageView logo = new ImageView(this);
        try {
            logo.setImageResource(R.drawable.d4exam_logo);
        } catch (Throwable t) {
            try {
                logo.setImageResource(R.drawable.ic_launcher);
            } catch (Throwable ignored) {
            }
        }
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(120), dp(120));
        lp.gravity = Gravity.CENTER;
        logo.setLayoutParams(lp);
        splash.addView(logo);

        TextView brand = new TextView(this);
        brand.setText("D4EXAM");
        brand.setTextColor(Color.WHITE);
        brand.setTextSize(22f);
        brand.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams bp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        bp.gravity = Gravity.CENTER;
        bp.topMargin = dp(90);
        brand.setLayoutParams(bp);
        splash.addView(brand);

        ProgressBar spin = new ProgressBar(this);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(dp(36), dp(36));
        sp.gravity = Gravity.CENTER;
        sp.topMargin = dp(150);
        spin.setLayoutParams(sp);
        splash.addView(spin);

        root.addView(splash);
        return root;
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
        // Avoid setDatabaseEnabled — can crash on some OEM WebViews
        try {
            s.setAllowFileAccess(true);
        } catch (Throwable ignored) {
        }

        // Persist login session across app restarts
        try {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= 21) {
                cm.setAcceptThirdPartyCookies(web, true);
            }
        } catch (Throwable ignored) {
        }

        // Offline: use HTTP cache from previous online visits
        try {
            if (isOnline()) {
                s.setCacheMode(WebSettings.LOAD_DEFAULT);
            } else {
                s.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
            }
        } catch (Throwable ignored) {
            try {
                if (!isOnline()) s.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
            } catch (Throwable ignored2) {
            }
        }

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                try {
                    if (progress == null) return;
                    if (newProgress >= 100) {
                        /* no top progress bar in app */
                    } else {
                        /* no top progress bar in app */
                        progress.setProgress(newProgress);
                    }
                    if (newProgress > 60) hideSplash();
                } catch (Throwable ignored) {
                }
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep navigation inside the WebView (same as Capacitor shell)
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                pageOk = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageOk = true;
                hideSplash();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request == null || !request.isForMainFrame()) return;
                tryNextOrOffline();
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Older API path
                tryNextOrOffline();
            }
        });
    }

    private void loadApp() {
        urlIndex = 0;
        loadCurrentUrl();
    }

    private void loadCurrentUrl() {
        if (urlIndex < APP_URLS.length) {
            try {
                web.loadUrl(APP_URLS[urlIndex]);
            } catch (Throwable t) {
                urlIndex++;
                loadCurrentUrl();
            }
        } else {
            showOfflineHtml();
        }
    }

    private void tryNextOrOffline() {
        if (pageOk) return;
        urlIndex++;
        if (urlIndex < APP_URLS.length) {
            loadCurrentUrl();
        } else {
            showOfflineHtml();
        }
    }

    private void showOfflineHtml() {
        hideSplash();
        String html = "<!DOCTYPE html><html><head>"
            + "<meta charset='utf-8'/>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1'/>"
            + "<style>"
            + "body{margin:0;min-height:100vh;background:#0b1b3a;color:#e2e8f0;font-family:system-ui,sans-serif;"
            + "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center}"
            + "h1{font-size:1.6rem;margin:0 0 8px}h1 span{color:#3b82f6}"
            + "p{color:#94a3b8;max-width:280px;line-height:1.5}"
            + "button{margin-top:20px;border:0;border-radius:999px;background:#2563eb;color:#fff;"
            + "font-weight:700;padding:12px 22px;font-size:1rem}"
            + "</style></head><body>"
            + "<h1><span>D4EXAM</span></h1>"
            + "<p>No network. D4EXAM UI is served from the cloud (Vercel) and data from Supabase. After you open the app once online, pages may load from cache offline. Connect and Retry.</p>"
            + "<button onclick=\"location.href='" + APP_URLS[0] + "'\">Retry</button>"
            + "</body></html>";
        try {
            web.loadDataWithBaseURL(APP_URLS[0], html, "text/html", "UTF-8", null);
        } catch (Throwable t) {
            try {
                web.loadData(html, "text/html", "UTF-8");
            } catch (Throwable ignored) {
            }
        }
    }

    private void hideSplash() {
        if (splash == null) return;
        try {
            splash.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (splash != null) splash.setVisibility(View.GONE);
                    } catch (Throwable ignored) {
                    }
                }
            });
        } catch (Throwable ignored) {
        }
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            NetworkInfo n = cm.getActiveNetworkInfo();
            return n != null && n.isConnected();
        } catch (Throwable t) {
            return true;
        }
    }

    private int dp(int v) {
        float d = getResources().getDisplayMetrics().density;
        return Math.round(v * d);
    }

    @Override
    public void onBackPressed() {
        try {
            if (web != null && web.canGoBack()) {
                web.goBack();
                return;
            }
        } catch (Throwable ignored) {
        }
        try {
            super.onBackPressed();
        } catch (Throwable ignored) {
            finish();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            if (web != null) {
                web.onResume();
                try {
                    WebSettings s = web.getSettings();
                    s.setCacheMode(isOnline() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK);
                } catch (Throwable ignored) {
                }
            }
        } catch (Throwable ignored) {
        }
    }

    @Override
    protected void onPause() {
        try {
            if (web != null) web.onPause();
        } catch (Throwable ignored) {
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        try {
            if (web != null) {
                web.stopLoading();
                web.loadUrl("about:blank");
                web.setWebViewClient(null);
                web.setWebChromeClient(null);
                if (web.getParent() instanceof ViewGroup) {
                    ((ViewGroup) web.getParent()).removeView(web);
                }
                web.destroy();
                web = null;
            }
        } catch (Throwable ignored) {
        }
        super.onDestroy();
    }
}
