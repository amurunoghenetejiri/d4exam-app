/**
 * Fingerprint unlock gate for the native D4EXAM shell.
 *
 * After splash: no custom loading page, no rotating rings, no scan beam.
 * Shows a plain navy cover only while the OS BiometricPrompt is open.
 * On success → unlock immediately (no success animation delay).
 * Does not replace Supabase auth — only gates an existing local session.
 * Never stores fingerprint data.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { App as CapApp } from "@capacitor/app";
import { useSessionUser } from "@/lib/session";
import { isNativeShell } from "@/native/platform";
import { authenticateWithFingerprint } from "@/native/fingerprintAuth";
import {
  clearBackgroundMark,
  clearFingerprintIfUser,
  isActiveCbtExamPath,
  isFingerprintEnabledFor,
  isFingerprintLocked,
  markAppBackgrounded,
  markSessionUnlocked,
  setFingerprintLocked,
  shouldLockAfterBackground,
} from "@/lib/fingerprint-lock";

const SPLASH_SESSION_KEY = "d4exam_splash_shown_v6";

function isSplashStillShowing(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1") return false;
    const el = document.getElementById("d4-boot-splash");
    if (el) {
      const d = window.getComputedStyle(el).display;
      if (d && d !== "none") return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function FingerprintLockGate() {
  const native = isNativeShell();
  const { data: session, isLoading } = useSessionUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [locked, setLocked] = useState(false);
  const [failedMsg, setFailedMsg] = useState<string | null>(null);
  const [splashDone, setSplashDone] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1"
      );
    } catch {
      return false;
    }
  });
  const promptedRef = useRef(false);
  const runningRef = useRef(false);

  const userId = session?.userId ?? null;

  const isPublicAuthPath =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/school-application") ||
    pathname.startsWith("/application-status") ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/privacy");

  // Wait for splash to finish before any fingerprint UI / prompt
  useEffect(() => {
    if (!native || splashDone) return;
    if (!isSplashStillShowing()) {
      setSplashDone(true);
      return;
    }
    const id = window.setInterval(() => {
      try {
        if (window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1" || !isSplashStillShowing()) {
          setSplashDone(true);
          window.clearInterval(id);
        }
      } catch {
        setSplashDone(true);
        window.clearInterval(id);
      }
    }, 120);
    const cap = window.setTimeout(() => setSplashDone(true), 12_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(cap);
    };
  }, [native, splashDone]);

  const evaluateLock = useCallback(() => {
    if (!native || isPublicAuthPath) {
      setLocked(false);
      return;
    }
    if (!userId || !isFingerprintEnabledFor(userId)) {
      setLocked(false);
      return;
    }
    if (isActiveCbtExamPath(pathname)) {
      setLocked(false);
      return;
    }
    if (isFingerprintLocked() || shouldLockAfterBackground()) {
      setFingerprintLocked(true);
      setLocked(true);
      setFailedMsg(null);
      promptedRef.current = false;
      return;
    }
    setLocked(false);
  }, [native, isPublicAuthPath, userId, pathname]);

  useEffect(() => {
    if (!native) return;
    evaluateLock();
  }, [native, evaluateLock, session?.userId]);

  useEffect(() => {
    if (!native) return;
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
          if (cancelled) return;
          if (!isActive) {
            markAppBackgrounded();
            return;
          }
          if (isActiveCbtExamPath()) {
            clearBackgroundMark();
            return;
          }
          if (!isFingerprintEnabledFor(userId)) return;
          if (shouldLockAfterBackground()) {
            setFingerprintLocked(true);
            setLocked(true);
            setFailedMsg(null);
            promptedRef.current = false;
            runningRef.current = false;
          }
          clearBackgroundMark();
        });
      } catch {
        /* web / missing plugin */
      }
    })();

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [native, userId]);

  function finishUnlock() {
    setFingerprintLocked(false);
    clearBackgroundMark();
    markSessionUnlocked();
    setFailedMsg(null);
    setLocked(false);
    promptedRef.current = false;
    runningRef.current = false;
  }

  async function tryUnlock() {
    if (runningRef.current) return;
    runningRef.current = true;
    setFailedMsg(null);

    const safety = window.setTimeout(() => {
      if (runningRef.current) {
        runningRef.current = false;
        setFailedMsg("Fingerprint timed out. Tap to try again.");
      }
    }, 18_000);

    try {
      // Direct OS prompt — no isAvailable pre-check (avoids hang / extra loading)
      const result = await authenticateWithFingerprint({
        reason: "Unlock D4EXAM",
        title: "D4EXAM",
        subtitle: "Use your fingerprint to continue",
      });

      if (result.ok) {
        finishUnlock();
        return;
      }

      if (result.code === "cancelled") {
        setFailedMsg(null);
      } else {
        setFailedMsg(result.message || "Fingerprint not recognised. Tap to try again.");
      }
    } catch (e) {
      setFailedMsg((e as Error)?.message || "Could not verify fingerprint. Tap to try again.");
    } finally {
      window.clearTimeout(safety);
      runningRef.current = false;
    }
  }

  // Auto-open OS fingerprint after splash when locked
  useEffect(() => {
    if (!locked || !splashDone || !native) return;
    if (promptedRef.current || runningRef.current) return;
    promptedRef.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, splashDone, native]);

  function usePasswordLogin() {
    try {
      clearFingerprintIfUser(userId);
    } catch {
      /* ignore */
    }
    setFingerprintLocked(false);
    setLocked(false);
    try {
      window.location.href = "/login";
    } catch {
      window.location.assign("/login");
    }
  }

  // Nothing while not locked, still loading session, public path, or splash still up
  if (!native || !locked || isLoading || isPublicAuthPath || !splashDone) {
    return null;
  }

  // Plain navy cover only — no rings, no scan beam, no "Scanning…" page.
  // OS BiometricPrompt is the unlock UI. Tap cover to retry if needed.
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "#0b1b3a",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="D4EXAM locked"
      onClick={() => {
        if (runningRef.current) return;
        promptedRef.current = false;
        void tryUnlock();
      }}
    >
      {failedMsg ? (
        <div className="relative z-10 flex max-w-xs flex-col items-center px-6 text-center">
          <p className="text-sm text-amber-100">{failedMsg}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              promptedRef.current = false;
              void tryUnlock();
            }}
            className="mt-5 rounded-full bg-[#2563eb] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              usePasswordLogin();
            }}
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-slate-400"
          >
            <Lock className="h-3.5 w-3.5" />
            Use password / login
          </button>
        </div>
      ) : null}
    </div>
  );
}
