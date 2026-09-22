import type { CapacitorConfig } from "@capacitor/cli";

/**
 * D4EXAM Capacitor — standalone Android application.
 *
 * Production APK loads the BUNDLED web assets from webDir (dist/), not Chrome
 * and not a remote website redirect.
 *
 * - Offline: local index.html + offline.html work without internet.
 * - Online: Supabase + HTTPS API calls to d4exam.name.ng / *.supabase.co.
 * - Native plugins (biometric, push, camera, screen share) bind to this WebView.
 *
 * The public website https://d4exam.name.ng remains a separate deployment.
 */
const config: CapacitorConfig = {
  appId: "com.d4exam.app",
  appName: "D4EXAM",
  webDir: "dist",
  server: {
    // Local-only shell (no remote server.url — prevents website/Chrome behavior)
    androidScheme: "https",
    hostname: "localhost",
    allowNavigation: [
      "d4exam.name.ng",
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
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: "#0b1b3a",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 300,
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
