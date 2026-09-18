import type { CapacitorConfig } from "@capacitor/cli";

/**
 * D4EXAM Capacitor — OFFLINE-FIRST local SPA shell.
 *
 * No server.url: the APK boots from bundled dist/ (scripts/prepare-capacitor-dist.mjs).
 * UI, routing, splash, and cached data work offline.
 * Supabase is contacted only when the device is online (same project/keys as the website).
 * Live-only features (start exam, submit, live monitor, camera) still need internet.
 */
const config: CapacitorConfig = {
  appId: "com.d4exam.app",
  appName: "D4EXAM",
  webDir: "dist",
  server: {
    androidScheme: "https",
    errorPath: "offline.html",
    allowNavigation: [
      "*.supabase.co",
      "*.googleapis.com",
      "*.gstatic.com",
      "*.firebaseio.com",
      "*.firebasestorage.app",
      "*.firebaseapp.com",
      "d4exam-platform.vercel.app",
      "*.vercel.app",
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0b1b3a",
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0b1b3a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
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
