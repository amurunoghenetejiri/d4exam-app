/**
 * Full-screen fingerprint unlock gate for the native D4EXAM shell.
 *
 * Flow: ONE splash → this page (full screen, school logo) → native biometric → dashboard.
 * No white loading gap between splash and this page.
 * School users: school logo. Super Admin only: D4EXAM logo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import {
  useSessionUser,
  readCachedSchoolBrand,
  type AppRole,
} from "@/lib/session";
import { isNativeShell } from "@/native/platform";
import { authenticateWithFingerprint } from "@/native/fingerprintAuth";
import {
  clearBackgroundMark,
  isActiveCbtExamPath,
  isFingerprintEnabledFor,
  isFingerprintLocked,
  markAppBackgrounded,
  markSessionUnlocked,
  readFingerprintPref,
  setFingerprintLocked,
  shouldLockAfterBackground,
} from "@/lib/fingerprint-lock";
import { readLastUserId } from "@/lib/offline-query";
import { cn } from "@/lib/utils";

const SPLASH_SESSION_KEY = "d4exam_splash_shown_v6";
/** App theme navy — matches Capacitor status bar / splash */
const THEME_NAVY = "#0b1b3a";

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

function unlockHint(): string {
  return "Verify your identity to unlock D4EXAM securely.";
}

/** Proper name casing (not ALL CAPS). */
function displayName(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "D4EXAM User";
  // If already mixed case with spaces, keep as-is
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function lastKnownRole(): AppRole | null {
  try {
    const r =
      window.localStorage.getItem("d4exam_last_role_v1") ||
      window.localStorage.getItem("d4exam_preferred_role_v1");
    const known = ["student", "teacher", "school_admin", "examination_officer", "super_admin"];
    if (r && known.includes(r)) return r as AppRole;
  } catch {
    /* ignore */
  }
  return null;
}

export function FingerprintLockGate() {
  const native = isNativeShell();
  const { data: session } = useSessionUser();
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
  const [logoBroken, setLogoBroken] = useState(false);
  const promptedRef = useRef(false);
  const runningRef = useRef(false);

  const pref = typeof window !== "undefined" ? readFingerprintPref() : null;
  const lastUid = typeof window !== "undefined" ? readLastUserId() : null;
  const userId = session?.userId ?? pref?.userId ?? lastUid ?? null;

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

  // Splash must finish before fingerprint page + OS prompt
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
    }, 50);
    const cap = window.setTimeout(() => setSplashDone(true), 2_200);
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
    // Prefer live session userId; fall back to fingerprint pref / last user (no white gap while session loads)
    const uid = session?.userId ?? pref?.userId ?? lastUid;
    if (!uid || !isFingerprintEnabledFor(uid)) {
      // If pref says enabled for some user, still lock even before session resolves
      if (pref?.enabled && pref.userId && isFingerprintEnabledFor(pref.userId) && !isPublicAuthPath) {
        if (isActiveCbtExamPath(pathname)) {
          setLocked(false);
          return;
        }
        if (isFingerprintLocked() || shouldLockAfterBackground()) {
          setFingerprintLocked(true);
          setLocked(true);
          setFailedMsg(null);
          setStatus("idle");
          promptedRef.current = false;
          return;
        }
      }
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
      setStatus("idle");
      promptedRef.current = false;
      return;
    }
    setLocked(false);
  }, [native, isPublicAuthPath, session?.userId, pathname, pref?.userId, pref?.enabled, lastUid]);

  useEffect(() => {
    if (!native) return;
    evaluateLock();
  }, [native, evaluateLock, session?.userId, splashDone]);

  // Background / resume
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
          const uid = session?.userId ?? pref?.userId ?? lastUid;
          if (!isFingerprintEnabledFor(uid)) return;
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
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [native, session?.userId, pref?.userId, lastUid]);

  // Page visible → ready for OS prompt (never over splash)
  useEffect(() => {
    if (!locked || !splashDone || !native) {
      setPageReady(false);
      return;
    }
    setPageReady(false);
    const t = window.setTimeout(() => setPageReady(true), 200);
    return () => window.clearTimeout(t);
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
        window.setTimeout(() => finishUnlock(), 280);
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

  useEffect(() => {
    if (!locked || !splashDone || !pageReady || !native) return;
    if (promptedRef.current || runningRef.current) return;
    promptedRef.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, splashDone, pageReady, native]);

  useEffect(() => {
    if (!locked || !native) return;
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    void (async () => {
      try {
        handle = await CapApp.addListener("backButton", () => {
          /* stay on fingerprint page */
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

  // Hide boot splash when fingerprint page is about to show (seamless navy)
  useEffect(() => {
    if (!native || !locked || !splashDone) return;
    try {
      window.dispatchEvent(new Event("d4-hide-boot-splash"));
    } catch {
      /* ignore */
    }
  }, [native, locked, splashDone]);

  // Cover the app as soon as splash is done and we need unlock — no white gap
  if (!native || !locked || isPublicAuthPath || !splashDone) {
    return null;
  }

  const role = (session?.role || lastKnownRole()) as AppRole | null;
  const isSuperAdmin = role === "super_admin";
  const RoleIcon = roleIcon(role);
  const label = roleLabel(role);

  const cachedBrand = readCachedSchoolBrand(session?.schoolId);
  const schoolName = isSuperAdmin
    ? null
    : session?.schoolName || cachedBrand?.name || null;
  const schoolLogo =
    !isSuperAdmin && !logoBroken
      ? session?.schoolLogoUrl || cachedBrand?.logoUrl || null
      : null;

  const name = displayName(session?.fullName);

  return createPortal(
    <div
      className="d4-fp-lock-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        maxWidth: "100vw",
        maxHeight: "100dvh",
        margin: 0,
        padding: 0,
        zIndex: 2147483000,
        backgroundColor: THEME_NAVY,
        background: THEME_NAVY,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock with fingerprint"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.22) 0%, transparent 58%)",
        }}
      />

      <div
        className="relative z-10 flex w-full flex-col items-center justify-between"
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "100%",
          paddingTop: "max(1.25rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(1.25rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1.25rem, env(safe-area-inset-right, 0px))",
          boxSizing: "border-box",
        }}
      >
        <div className="flex w-full flex-col items-center pt-6">
          {/* Logo — no white plate */}
          <div className="flex shrink-0 justify-center">
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt={schoolName || "School"}
                className="h-[min(22vw,92px)] w-[min(22vw,92px)] object-contain"
                style={{ background: "transparent" }}
                onError={() => setLogoBroken(true)}
              />
            ) : (
              <div
                className="grid h-[min(22vw,92px)] w-[min(22vw,92px)] place-items-center rounded-full border border-[#2563eb]/40"
                style={{ backgroundColor: "transparent" }}
              >
                <img src="/logo.png" alt="D4EXAM" className="h-[70%] w-[70%] object-contain" />
              </div>
            )}
          </div>

          {/* School name directly under logo */}
          {!isSuperAdmin && schoolName ? (
            <p className="mt-3 max-w-[18rem] text-center text-sm font-medium leading-snug text-slate-300">
              {schoolName}
            </p>
          ) : null}

          {/* Role badge */}
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-sm">
            <RoleIcon className="h-3.5 w-3.5 text-blue-300" aria-hidden />
            {label}
          </div>

          {/* User name */}
          <h1 className="mt-3 max-w-[22rem] text-center text-[1.3rem] font-bold leading-snug tracking-tight text-white sm:text-2xl">
            {name}
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center py-6">
          <button
            type="button"
            aria-label="Use fingerprint"
            onClick={() => {
              if (runningRef.current) return;
              promptedRef.current = false;
              void tryUnlock();
            }}
            className="relative grid h-[128px] w-[128px] place-items-center focus:outline-none active:scale-[0.98]"
          >
            <span
              className={cn(
                "absolute inset-0 rounded-full border-[2.5px] border-[#2563eb]/40",
                status === "scanning" && "animate-pulse",
              )}
            />
            <span
              className={cn(
                "absolute inset-[10px] rounded-full border border-[#3b82f6]/45",
                status === "scanning" && "animate-pulse",
              )}
            />
            <span
              className="absolute inset-[22px] rounded-full shadow-[0_0_40px_rgba(37,99,235,0.45)]"
              style={{ backgroundColor: "rgba(11,27,58,0.85)" }}
            />
            {status === "scanning" ? (
              <span
                className="pointer-events-none absolute left-[24px] right-[24px] z-20 h-1.5 rounded-full bg-gradient-to-r from-transparent via-sky-300 to-transparent"
                style={{ animation: "d4-fp-scan 1.35s ease-in-out infinite" }}
              />
            ) : null}
            <Fingerprint
              className={cn(
                "relative z-10 h-[52px] w-[52px]",
                status === "success"
                  ? "text-emerald-400"
                  : status === "failed"
                    ? "text-amber-300"
                    : "text-[#60a5fa]",
              )}
              strokeWidth={1.35}
            />
          </button>

          <p className="mt-7 text-center text-lg font-semibold text-white">
            {status === "success"
              ? "Fingerprint verified"
              : status === "scanning"
                ? "Waiting for fingerprint…"
                : "Use your fingerprint"}
          </p>
          <p className="mt-2 max-w-[17rem] text-center text-sm leading-relaxed text-slate-400">
            {failedMsg || unlockHint()}
          </p>
        </div>

        <div className="flex w-full shrink-0 justify-center pb-2">
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
          0% { top: 26%; opacity: 0.3; }
          50% { top: 70%; opacity: 1; }
          100% { top: 26%; opacity: 0.3; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
