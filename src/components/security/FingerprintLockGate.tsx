/**
 * Full-screen fingerprint unlock gate for the native D4EXAM shell.
 * Matches the secure-access design: navy background, large fingerprint,
 * rotating rings, scanning beam. Triggers real Android BiometricPrompt.
 *
 * Does not replace Supabase auth — only gates access to an existing local session.
 * Never stores fingerprint data.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
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

type GatePhase = "locked" | "verifying" | "success" | "failed";

export function FingerprintLockGate() {
  const native = isNativeShell();
  const { data: session, isLoading } = useSessionUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<GatePhase>("locked");
  const [message, setMessage] = useState<string | null>(null);
  const promptedRef = useRef(false);
  const successTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

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
    if (isFingerprintLocked() || shouldLockAfterBackground()) {
      setFingerprintLocked(true);
      setLocked(true);
      setPhase("locked");
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
            setPhase("locked");
            setMessage(null);
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
      if (successTimerRef.current != null) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, [native, userId]);

  useEffect(() => {
    if (!locked || phase === "success" || phase === "verifying") return;
    if (promptedRef.current || runningRef.current) return;
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
    }, 700);
  }

  async function tryUnlock() {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("verifying");
    setMessage(null);

    const safety = window.setTimeout(() => {
      if (runningRef.current) {
        runningRef.current = false;
        setPhase("failed");
        setMessage("Fingerprint timed out. Tap the sensor area to try again.");
      }
    }, 28_000);

    try {
      const avail = await checkFingerprintAvailable();
      if (!avail.ok) {
        setPhase("failed");
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

      if (result.code === "cancelled") {
        setPhase("locked");
        setMessage(null);
      } else {
        setPhase("failed");
        setMessage(result.message || "Fingerprint not recognised. Try again.");
      }
    } catch (e) {
      setPhase("failed");
      setMessage((e as Error)?.message || "Could not verify fingerprint.");
    } finally {
      window.clearTimeout(safety);
      runningRef.current = false;
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
  const isVerifying = phase === "verifying";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden text-center"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 40%, #0f2744 0%, #0b1b3a 55%, #071228 100%)",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isSuccess ? "Unlocked" : "D4EXAM locked"}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mb-10 text-center">
        <p className="text-[1.65rem] font-extrabold tracking-[0.14em] text-white">
          D<span className="text-[#3b82f6]">4</span>EXAM
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.32em] text-slate-400">
          Secure Access
        </p>
      </div>

      {isSuccess ? (
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative grid h-36 w-36 place-items-center">
            <div className="absolute inset-0 rounded-full bg-[#2563eb]/25 animate-pulse" />
            <div className="relative grid h-28 w-28 place-items-center rounded-full bg-[#2563eb] shadow-xl shadow-blue-600/50">
              <Check className="h-14 w-14 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="mt-8 text-xl font-bold text-white">Unlocked</h1>
          <p className="mt-2 text-sm text-slate-300">Opening your workspace…</p>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center">
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => {
              promptedRef.current = false;
              void tryUnlock();
            }}
            className="group relative grid h-44 w-44 place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1b3a] disabled:opacity-95"
            aria-label="Unlock with fingerprint"
          >
            <div
              className="absolute inset-0 rounded-full border border-[#3b82f6]/35"
              style={{
                animation: "d4-fp-spin 8s linear infinite",
                borderStyle: "dashed",
              }}
            />
            <div
              className="absolute inset-3 rounded-full border-2 border-[#2563eb]/50"
              style={{
                animation: "d4-fp-spin-rev 6s linear infinite",
                borderTopColor: "transparent",
                borderRightColor: "rgba(59,130,246,0.8)",
              }}
            />
            <div
              className="absolute inset-6 rounded-full"
              style={{
                boxShadow: "0 0 40px 8px rgba(37,99,235,0.35), inset 0 0 24px rgba(37,99,235,0.15)",
              }}
            />
            <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-full">
              <svg
                viewBox="0 0 64 64"
                className="h-20 w-20 text-[#3b82f6]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M32 12c-8 0-14 6-14 14v8" opacity="0.9" />
                <path d="M32 10c10 0 18 7 18 16v10" opacity="0.7" />
                <path d="M22 28c0 10 4 18 10 22" opacity="0.85" />
                <path d="M42 28c0 12-5 20-10 24" opacity="0.75" />
                <path d="M26 20c-3 3-5 7-5 12" opacity="0.8" />
                <path d="M38 20c3 3 5 7 5 12" opacity="0.7" />
                <path d="M32 22v18" opacity="0.9" />
                <path d="M28 26c0 8 2 14 4 16" opacity="0.65" />
                <path d="M36 26c0 8-2 14-4 16" opacity="0.65" />
                <path d="M24 34c2 8 5 12 8 14" opacity="0.55" />
                <path d="M40 34c-2 8-5 12-8 14" opacity="0.55" />
              </svg>
              <div
                className="pointer-events-none absolute left-0 right-0 h-[2px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, #60a5fa 20%, #93c5fd 50%, #60a5fa 80%, transparent 100%)",
                  boxShadow: "0 0 12px 2px rgba(96,165,250,0.7)",
                  animation: "d4-fp-scan 2.2s ease-in-out infinite",
                }}
              />
            </div>
          </button>

          <h1 className="mt-9 text-[1.35rem] font-bold tracking-tight text-white">
            Place your finger
          </h1>
          <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-slate-400">
            Use your fingerprint to continue
          </p>

          {isVerifying && (
            <p className="mt-5 text-xs font-medium uppercase tracking-widest text-[#60a5fa]">
              Scanning…
            </p>
          )}

          {phase === "failed" && message && (
            <p className="mt-5 max-w-xs rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
              {message}
            </p>
          )}

          {phase === "failed" && (
            <button
              type="button"
              onClick={() => {
                promptedRef.current = false;
                void tryUnlock();
              }}
              className="mt-4 rounded-full bg-[#2563eb] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 active:scale-[0.98]"
            >
              Try again
            </button>
          )}

          <button
            type="button"
            onClick={usePasswordLogin}
            className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            <Lock className="h-3.5 w-3.5" />
            Use password / login
          </button>
        </div>
      )}

      <style>{`
        @keyframes d4-fp-scan {
          0%   { top: 12%; opacity: 0.4; }
          15%  { opacity: 1; }
          50%  { top: 82%; opacity: 1; }
          85%  { opacity: 1; }
          100% { top: 12%; opacity: 0.4; }
        }
        @keyframes d4-fp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes d4-fp-spin-rev {
          from { transform: rotate(360deg); }
          to   { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
