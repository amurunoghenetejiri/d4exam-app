/**
 * Full-screen fingerprint unlock gate for the native app shell.
 * Does not replace Supabase auth — only gates access to an existing local session.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { App as CapApp } from "@capacitor/app";
import { useSessionUser } from "@/lib/session";
import { isNativeShell } from "@/native/platform";
import {
  authenticateWithFingerprint,
  checkFingerprintAvailable,
} from "@/native/fingerprintAuth";
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

export function FingerprintLockGate() {
  const native = isNativeShell();
  const { data: session, isLoading } = useSessionUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const promptedRef = useRef(false);

  const userId = session?.userId ?? null;

  const isPublicAuthPath =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/school-application") ||
    pathname.startsWith("/application-status");

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
    if (isFingerprintLocked()) {
      setLocked(true);
      return;
    }
    if (shouldLockAfterBackground() || isFingerprintLocked()) {
      setFingerprintLocked(true);
      setLocked(true);
    }
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
            promptedRef.current = false;
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

  useEffect(() => {
    if (!locked || promptedRef.current || busy) return;
    promptedRef.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  async function tryUnlock() {
    setBusy(true);
    setMessage(null);
    try {
      const avail = await checkFingerprintAvailable();
      if (!avail.ok) {
        setMessage(avail.message);
        return;
      }
      const result = await authenticateWithFingerprint({
        reason: "Unlock D4EXAM",
        title: "D4EXAM",
        subtitle: "Use your fingerprint to continue",
      });
      if (result.ok) {
        setFingerprintLocked(false);
        clearBackgroundMark();
        markSessionUnlocked();
        setLocked(false);
        setMessage(null);
        return;
      }
      if (result.code !== "cancelled") setMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

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

  if (!native || !locked || isLoading || isPublicAuthPath) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a1a3a] px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="D4EXAM locked"
    >
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
        <span className="text-lg font-extrabold tracking-wide text-white">
          D<span className="text-blue-400">4</span>
        </span>
      </div>
      <h1 className="text-xl font-bold text-white">App Locked</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-300">
        Use your fingerprint to continue to D4EXAM.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          promptedRef.current = false;
          void tryUnlock();
        }}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 active:scale-[0.98] disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
        {busy ? "Checking…" : "Fingerprint"}
      </button>

      {message && <p className="mt-4 max-w-xs text-xs text-amber-200/90">{message}</p>}

      <button
        type="button"
        onClick={usePasswordLogin}
        className="mt-8 text-sm font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
      >
        Use password / login
      </button>
    </div>
  );
}
