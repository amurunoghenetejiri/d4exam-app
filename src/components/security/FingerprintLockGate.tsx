/**
 * Full-screen fingerprint unlock gate for the native D4EXAM shell.
 * Shows after splash, before any dashboard/room, when fingerprint is enabled.
 * Does not replace Supabase auth — only gates access to an existing local session.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2, Check } from "lucide-react";
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

type GatePhase = "locked" | "success";

export function FingerprintLockGate() {
  const native = isNativeShell();
  const { data: session, isLoading } = useSessionUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<GatePhase>("locked");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const promptedRef = useRef(false);
  const successTimerRef = useRef<number | null>(null);

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
      setPhase("locked");
      return;
    }
    if (!userId || !isFingerprintEnabledFor(userId)) {
      setLocked(false);
      setPhase("locked");
      return;
    }
    if (isActiveCbtExamPath(pathname)) {
      setLocked(false);
      setPhase("locked");
      return;
    }
    if (isFingerprintLocked()) {
      setLocked(true);
      setPhase("locked");
      return;
    }
    if (shouldLockAfterBackground() || isFingerprintLocked()) {
      setFingerprintLocked(true);
      setLocked(true);
      setPhase("locked");
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
            setPhase("locked");
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
      if (successTimerRef.current != null) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, [native, userId]);

  useEffect(() => {
    if (!locked || phase !== "locked" || promptedRef.current || busy) return;
    promptedRef.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, phase]);

  function finishUnlock() {
    setFingerprintLocked(false);
    clearBackgroundMark();
    markSessionUnlocked();
    setPhase("success");
    setMessage(null);
    if (successTimerRef.current != null) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      setLocked(false);
      setPhase("locked");
      successTimerRef.current = null;
    }, 850);
  }

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
        finishUnlock();
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
    setPhase("locked");
    try {
      window.location.href = "/login";
    } catch {
      window.location.assign("/login");
    }
  }

  if (!native || !locked || isLoading || isPublicAuthPath) {
    return null;
  }

  const isSuccess = phase === "success";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b1b3a] px-6 text-center"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isSuccess ? "Unlocked" : "D4EXAM locked"}
    >
      {/* Brand mark */}
      <div className="mb-8 text-center">
        <p className="text-2xl font-extrabold tracking-[0.12em] text-white">
          D<span className="text-[#3b82f6]">4</span>EXAM
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          Smart Examination System
        </p>
      </div>

      {isSuccess ? (
        <>
          <div className="relative grid h-28 w-28 place-items-center">
            <div className="absolute inset-0 rounded-full bg-[#2563eb]/20 animate-pulse" />
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[#2563eb] shadow-lg shadow-blue-600/40">
              <Check className="h-12 w-12 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="mt-8 text-xl font-bold text-white">Unlocked</h1>
          <p className="mt-2 max-w-xs text-sm text-slate-300">Opening your workspace…</p>
        </>
      ) : (
        <>
          {/* Large blue fingerprint */}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              promptedRef.current = false;
              void tryUnlock();
            }}
            className="group relative grid h-28 w-28 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1b3a] disabled:opacity-80"
            aria-label="Unlock with fingerprint"
          >
            <div className="absolute inset-0 rounded-full bg-[#2563eb]/15 group-active:bg-[#2563eb]/25" />
            <div className="absolute inset-2 rounded-full border-2 border-[#2563eb]/40" />
            <div className="relative grid h-20 w-20 place-items-center rounded-full bg-[#2563eb]/20">
              {busy ? (
                <Loader2 className="h-11 w-11 animate-spin text-[#3b82f6]" />
              ) : (
                <Fingerprint className="h-11 w-11 text-[#3b82f6]" strokeWidth={1.5} />
              )}
            </div>
          </button>

          <h1 className="mt-8 text-xl font-bold text-white">Use your fingerprint</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
            Confirm it is you before opening your D4EXAM workspace.
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              promptedRef.current = false;
              void tryUnlock();
            }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 active:scale-[0.98] disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
            {busy ? "Checking…" : "Unlock with fingerprint"}
          </button>

          {message && (
            <p className="mt-5 max-w-xs rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200/95">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={usePasswordLogin}
            className="mt-10 text-sm font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            Use password / login
          </button>
        </>
      )}
    </div>
  );
}
