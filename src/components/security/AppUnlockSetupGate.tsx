/**
 * One-time app unlock password setup after first successful account login.
 * Does NOT change the Supabase account password.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { Fingerprint, Loader2, Shield } from "lucide-react";
import { useSessionUser } from "@/lib/session";
import { isNativeShell } from "@/native/platform";
import { hasAppUnlockFor, setAppUnlockPassword } from "@/lib/app-unlock";
import {
  enableFingerprintFor,
  isFingerprintEnabledFor,
  markSessionUnlocked,
  setFingerprintLocked,
} from "@/lib/fingerprint-lock";
import { authenticateWithFingerprint } from "@/native/fingerprintAuth";
import { toast } from "sonner";

const THEME_NAVY = "#0b1b3a";

export function AppUnlockSetupGate() {
  const { data: session } = useSessionUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [needed, setNeeded] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"password" | "fingerprint" | "done">("password");

  const isPublic =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/school-application") ||
    pathname.startsWith("/features");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!session?.userId || isPublic) {
        if (!cancelled) setNeeded(false);
        return;
      }
      try {
        const has = await hasAppUnlockFor(session.userId);
        if (!cancelled) setNeeded(!has);
      } catch {
        if (!cancelled) setNeeded(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.userId, isPublic, pathname]);

  if (!needed || !session?.userId || isPublic || typeof document === "undefined") {
    return null;
  }

  async function onSetPassword() {
    if (!session?.userId) return;
    if (pw.length < 4) {
      setErr("Use at least 4 characters");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await setAppUnlockPassword(session.userId, pw);
      if (!r.ok) {
        setErr(r.error || "Could not save");
        return;
      }
      markSessionUnlocked();
      setFingerprintLocked(false);
      if (isNativeShell()) {
        setStep("fingerprint");
      } else {
        setNeeded(false);
        toast.success("App password saved");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onEnableFp() {
    if (!session?.userId) return;
    setBusy(true);
    try {
      const auth = await authenticateWithFingerprint({
        reason: "Enable fingerprint unlock for D4EXAM",
        title: "D4EXAM",
        subtitle: "Confirm with your fingerprint",
      });
      if (auth.ok) {
        enableFingerprintFor(session.userId);
        toast.success("Fingerprint unlock enabled");
      } else if (auth.code !== "cancelled") {
        toast.error(auth.message || "Could not enable fingerprint");
      }
    } catch (e) {
      toast.error((e as Error).message || "Fingerprint failed");
    } finally {
      setBusy(false);
      setNeeded(false);
    }
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147482900,
        background: THEME_NAVY,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Set app unlock password"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1f3d] p-6 shadow-2xl">
        {step === "password" ? (
          <>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-blue-600/20 text-blue-300">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-center text-xl font-extrabold text-white">Secure your D4EXAM app</h2>
            <p className="mt-2 text-center text-sm text-slate-400">
              Create a password you&apos;ll use to unlock D4EXAM when you return to the app. This is
              not your account login password.
            </p>
            <label className="mt-5 block text-xs font-semibold text-slate-400">New App Password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400"
            />
            <label className="mt-3 block text-xs font-semibold text-slate-400">Confirm App Password</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400"
            />
            {err ? <p className="mt-2 text-center text-xs font-semibold text-amber-300">{err}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSetPassword()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Set Password
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-blue-600/20 text-blue-300">
              <Fingerprint className="h-6 w-6" />
            </div>
            <h2 className="text-center text-xl font-extrabold text-white">Enable Fingerprint?</h2>
            <p className="mt-2 text-center text-sm text-slate-400">
              Optionally unlock with your fingerprint next time. You can change this in Settings.
            </p>
            <button
              type="button"
              disabled={busy || isFingerprintEnabledFor(session.userId)}
              onClick={() => void onEnableFp()}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              Enable Fingerprint
            </button>
            <button
              type="button"
              className="mt-3 w-full py-2 text-sm font-medium text-slate-400 hover:text-white"
              onClick={() => {
                setNeeded(false);
                toast.success("App password saved");
              }}
            >
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
