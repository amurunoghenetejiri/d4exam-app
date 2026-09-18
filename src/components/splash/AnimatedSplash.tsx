import { useEffect } from "react";
import { hideSplashSafely } from "@/native/statusBar";

/** Marks splash already dismissed for this app process / tab session. */
const SESSION_KEY = "d4exam_splash_shown_v6";

function markSplashShown(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

function removeBootSplashDom(): void {
  try {
    const el = document.getElementById("d4-boot-splash");
    if (el) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      el.style.display = "none";
      window.setTimeout(() => {
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      }, 50);
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("d4-hide-boot-splash"));
  } catch {
    /* ignore */
  }
}

/**
 * Silent splash controller — NO second React splash UI.
 *
 * Native Capacitor splash + HTML #d4-boot-splash are the only visible splash.
 * This component only tears them down as soon as React mounts so the user
 * goes straight to the dashboard without a second loading screen.
 */
export function AnimatedSplash(_props?: { force?: boolean }) {
  useEffect(() => {
    markSplashShown();
    removeBootSplashDom();
    void hideSplashSafely();
    const t1 = window.setTimeout(() => {
      removeBootSplashDom();
      void hideSplashSafely();
    }, 40);
    const t2 = window.setTimeout(() => {
      removeBootSplashDom();
      void hideSplashSafely();
    }, 200);
    const t3 = window.setTimeout(() => {
      removeBootSplashDom();
      void hideSplashSafely();
    }, 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  return null;
}
