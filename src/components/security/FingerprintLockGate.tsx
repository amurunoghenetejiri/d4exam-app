/**
 * Full-screen fingerprint unlock gate for the native D4EXAM shell.
 *
 * Flow: splash fully done → this page mounts (visible) → native biometric prompt.
 * Never shows OS biometric over the splash. Never stores fingerprint data.
 * On success → unlock → role dashboard. Cancel/fail → stay on this page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Fingerprint,
  GraduationCap,
  LogIn,
  Shield,
  ShieldCheck,
  UserRound,
  Building2,
} from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { App as CapApp } from "@capacitor/app";
import { useSessionUser, type AppRole } from "@/lib/session";
import { isNativeShell } from "@/native/platform";
import { authenticateWithFingerprint } from "@/native/fingerprintAuth";
import {
  clearBackgroundMark,
  isActiveCbtExamPath,
  isFingerprintEnabledFor,
  isFingerprintLocked,
  markAppBackgrounded,
  markSessionUnlocked,
  setFingerprintLocked,
  shouldLockAfterBackground,
} from "@/lib/fingerprint-lock";
import { cn } from "@/lib/utils";

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

function roleLabel(role: AppRole | string | null | undefined): string {
  switch (role) {
    case "student":
      return "Student";
    case "teacher":
      return "Teacher";
    case "examination_officer":
      return "Departmental Officer";
    case "school_admin":
      return "School Admin";
    case "super_admin":
      return "Super Admin";
    default:
      return role ? String(role).replace(/_/g, " ") : "User";
  }
}

function roleIcon(role: AppRole | string | null | undefined) {
  switch (role) {
    case "student":
      return GraduationCap;
    case "teacher":
      return UserRound;
    case "examination_officer":
      return Shield;
    case "school_admin":
      return Building2;
    case "super_admin":
      return ShieldCheck;
    default:
      return UserRound;
  }
}

function roleDashboardHint(role: AppRole | string | null | undefined): string {
  switch (role) {
    case "student":
      return "Quick and secure access to your student dashboard.";
    case "teacher":
      return "Quick and secure access to your teacher dashboard.";
    case "examination_officer":
      return "Quick and secure access to your officer dashboard.";
    case "school_admin":
      return "Quick and secure access to your school admin dashboard.";
    case "super_admin":
      return "Quick and secure access to the super admin console.";
    default:
      return "Quick and secure access to your dashboard.";
  }
}

export function FingerprintLockGate() {
  const native = isNativeShell();
  const { data: session, isLoading } = useSessionUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [locked, setLocked] = useState(false);
  const [failedMsg, setFailedMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "failed">("idle");
  const [pageReady, setPageReady] = useState(false);
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
  const isSuperAdmin = session?.role === "super_admin";
  const RoleIcon = roleIcon(session?.role);

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
    }, 80);
    const cap = window.setTimeout(() => setSplashDone(true), 5_000);
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
    // Cold start / background: shouldLockAfterBackground covers both
    if (isFingerprintLocked() || shouldLockAfterBackground()) {
      setFingerprintLocked(true);
      setLocked(true);
      setFailedMsg(null);
      setStatus("idle");
      promptedRef.current = false;
      return;
    }
    setLocked(false);
  }, [native, isPublicAuthPath, userId, pathname]);

  useEffect(() => {
    if (!native) return;
    evaluateLock();
  }, [native, evaluateLock, session?.userId]);

  // Background / resume lock
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
            setStatus("idle");
            promptedRef.current = false;
            runningRef.current = false;
            setPageReady(false);
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

  // Page mounted + visible → mark ready (for auto biometric)
  useEffect(() => {
    if (!locked || !splashDone || !native) {
      setPageReady(false);
      return;
    }
    setPageReady(false);
    const t1 = window.requestAnimationFrame(() => {
      const t2 = window.requestAnimationFrame(() => {
        // small delay so paint is on screen before OS prompt
        window.setTimeout(() => setPageReady(true), 280);
      });
      void t2;
    });
    return () => window.cancelAnimationFrame(t1);
  }, [locked, splashDone, native]);

  function finishUnlock() {
    setFingerprintLocked(false);
    clearBackgroundMark();
    markSessionUnlocked();
    setFailedMsg(null);
    setStatus("success");
    setLocked(false);
    promptedRef.current = false;
    runningRef.current = false;
  }

  async function tryUnlock() {
    if (runningRef.current) return;
    if (!splashDone || isSplashStillShowing()) return;
    runningRef.current = true;
    setFailedMsg(null);
    setStatus("scanning");

    const safety = window.setTimeout(() => {
      if (runningRef.current) {
        runningRef.current = false;
        setStatus("failed");
        setFailedMsg("Fingerprint timed out. Tap the fingerprint to try again.");
      }
    }, 18_000);

    try {
      const result = await authenticateWithFingerprint({
        reason: "Unlock D4EXAM",
        title: "D4EXAM",
        subtitle: "Use your fingerprint to continue",
      });
      if (result.ok) {
        setStatus("success");
        window.setTimeout(() => finishUnlock(), 350);
        return;
      }
      if (result.code === "cancelled") {
        setStatus("idle");
        setFailedMsg(null);
      } else {
        setStatus("failed");
        setFailedMsg(result.message || "Fingerprint not recognised. Tap to try again.");
      }
    } catch (e) {
      setStatus("failed");
      setFailedMsg((e as Error)?.message || "Could not verify fingerprint. Tap to try again.");
    } finally {
      window.clearTimeout(safety);
      runningRef.current = false;
    }
  }

  // Auto-open OS fingerprint AFTER splash done AND page ready (never over splash)
  useEffect(() => {
    if (!locked || !splashDone || !pageReady || !native) return;
    if (promptedRef.current || runningRef.current) return;
    if (isLoading && !session) return;
    promptedRef.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, splashDone, pageReady, native, isLoading, session?.userId]);

  // Android back must not bypass unlock
  useEffect(() => {
    if (!locked || !native) return;
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        handle = await CapApp.addListener("backButton", () => {
          // Stay on fingerprint page — do not navigate away
        });
        if (cancelled) await handle?.remove();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [locked, native]);

  function usePasswordLogin() {
    setFingerprintLocked(false);
    setLocked(false);
    setStatus("idle");
    try {
      window.location.href = "/login";
    } catch {
      window.location.assign("/login");
    }
  }

  // Nothing while not locked, public path, or splash still up
  if (!native || !locked || isPublicAuthPath || !splashDone) {
    return null;
  }

  const name = session?.fullName || "D4EXAM User";
  const schoolName = isSuperAdmin ? null : session?.schoolName || null;
  const logoUrl = isSuperAdmin ? null : session?.schoolLogoUrl || null;
  const role = session?.role;
  const label = roleLabel(role);

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        maxHeight: "100dvh",
        background: "radial-gradient(ellipse at 50% 0%, #132a4d 0%, #0a1628 45%, #070d1b 100%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock with fingerprint"
    >
      {/* Soft blue glow accents */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(37,99,235,0.25) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-6 pb-6 pt-8">
        {/* School logo or D4EXAM mark */}
        <div className="mt-2 flex shrink-0 justify-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={schoolName || "School"}
              className="h-[min(28vw,112px)] w-[min(28vw,112px)] rounded-full border-2 border-white/20 bg-white object-contain shadow-lg shadow-blue-900/40"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="grid h-[min(28vw,112px)] w-[min(28vw,112px)] place-items-center rounded-full border-2 border-[#2563eb]/50 bg-[#0b1b3a] shadow-lg shadow-blue-900/40">
              <img src="/logo.png" alt="D4EXAM" className="h-[65%] w-[65%] object-contain" />
            </div>
          )}
        </div>

        {/* Role badge */}
        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-sm">
          <RoleIcon className="h-3.5 w-3.5 text-blue-300" aria-hidden />
          {label}
        </div>

        {/* Name + school */}
        <h1 className="mt-4 max-w-[20rem] text-center text-xl font-bold tracking-tight text-white sm:text-2xl">
          {isLoading && !session ? "Loading…" : name}
        </h1>
        {!isSuperAdmin && schoolName ? (
          <p className="mt-1.5 max-w-[18rem] text-center text-sm text-slate-400">{schoolName}</p>
        ) : null}

        {/* Fingerprint control */}
        <div className="mt-10 flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            aria-label="Use fingerprint"
            onClick={() => {
              if (runningRef.current) return;
              promptedRef.current = false;
              void tryUnlock();
            }}
            className="relative grid h-[140px] w-[140px] place-items-center focus:outline-none"
          >
            {/* Outer rings */}
            <span
              className={cn(
                "absolute inset-0 rounded-full border-2 border-[#2563eb]/35",
                status === "scanning" && "animate-pulse",
              )}
            />
            <span
              className={cn(
                "absolute inset-[10px] rounded-full border border-[#3b82f6]/40",
                status === "scanning" && "animate-pulse",
              )}
            />
            <span className="absolute inset-[22px] rounded-full bg-[#0b1b3a]/80 shadow-[0_0_40px_rgba(37,99,235,0.45)]" />

            {/* Scan beam */}
            {status === "scanning" ? (
              <span
                className="pointer-events-none absolute left-[22px] right-[22px] z-20 h-1 rounded-full bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-90"
                style={{
                  animation: "d4-fp-scan 1.4s ease-in-out infinite",
                }}
              />
            ) : null}

            <Fingerprint
              className={cn(
                "relative z-10 h-14 w-14",
                status === "success"
                  ? "text-emerald-400"
                  : status === "failed"
                    ? "text-amber-300"
                    : "text-[#60a5fa]",
              )}
              strokeWidth={1.5}
            />
          </button>

          <p className="mt-8 text-center text-lg font-semibold text-white">
            {status === "success"
              ? "Fingerprint verified"
              : status === "scanning"
                ? "Waiting for fingerprint…"
                : "Use your fingerprint"}
          </p>
          <p className="mt-2 max-w-[16rem] text-center text-sm text-slate-400">
            {failedMsg || roleDashboardHint(role)}
          </p>
        </div>

        {/* Bottom: Use login only (no Cancel) */}
        <div className="mt-auto flex w-full shrink-0 justify-center pb-2 pt-4">
          <button
            type="button"
            onClick={usePasswordLogin}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Use login
          </button>
        </div>
      </div>

      <style>{`
        @keyframes d4-fp-scan {
          0% { top: 28%; opacity: 0.35; }
          50% { top: 68%; opacity: 1; }
          100% { top: 28%; opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
