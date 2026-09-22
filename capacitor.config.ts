import type { CapacitorConfig } from "@capacitor/cli";

/**
 * D4EXAM Capacitor — native Android shell.
 *
 * server.url loads https://d4exam.name.ng INSIDE the APK WebView (required for
 * TanStack Start SSR/server functions). This is the native app, not Chrome.
 *
 * allowNavigation + MainActivity BridgeWebViewClient keep all D4EXAM hosts in-app.
 * errorPath offline.html is used on network failure — still in the APK.
 */
const config: CapacitorConfig = {
  appId: "com.d4exam.app",
  appName: "D4EXAM",
  webDir: "dist",
  server: {
    url: "https://d4exam.name.ng",
    androidScheme: "https",
    errorPath: "offline.html",
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
