import type { CapacitorConfig } from "@capacitor/cli";

/**
 * D4EXAM Capacitor Android shell.
 *
 * Online: loads https://d4exam.name.ng INSIDE the Capacitor WebView (same APK,
 * not Chrome). This keeps TanStack routing, login, and all pages working.
 *
 * Offline: errorPath offline.html + bundled dist/ for cold start assets.
 * MainActivity.shouldStayInApp prevents Android from opening Chrome for D4EXAM hosts.
 *
 * Native plugins (biometric, push, camera, screen share) attach to this WebView.
 */
const config: CapacitorConfig = {
  appId: "com.d4exam.app",
  appName: "D4EXAM",
  webDir: "dist",
  server: {
    url: "https://www.d4exam.name.ng",
    androidScheme: "https",
    cleartext: false,
    errorPath: "offline.html",
    allowNavigation: [
      "d4exam.name.ng",
      "www.d4exam.name.ng",
      "*.d4exam.name.ng",
      "d4exam-platform.vercel.app",
      "*.vercel.app",
      "*.supabase.co",
      "*.googleapis.com",
      "*.gstatic.com",
      "*.firebaseio.com",
      "*.firebasestorage.app",
      "*.firebaseapp.com",
      "localhost",
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0b1b3a",
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0b1b3a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 250,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1b3a",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_d4exam",
      iconColor: "#0b1b3a",
      sound: "default",
    },
  },
};

export default config;
