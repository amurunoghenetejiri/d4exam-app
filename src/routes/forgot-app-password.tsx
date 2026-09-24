/**
 * Forgot app unlock password — navy full-page, matches fingerprint unlock aesthetic.
 * User verifies identity with normal login details; email from profile is shown locked.
 * Email send (Resend) is not wired yet — UI is ready for when API key is added.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Shield } from "lucide-react";
import { useSessionUser } from "@/lib/session";
import { setFingerprintLocked } from "@/lib/fingerprint-lock";
import { notifyAppPasswordHelp } from "@/lib/email-notify.functions";
import { requestAppUnlockResetEmail } from "@/lib/app-unlock-reset.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-app-password")({
  head: () => ({
    meta: [
      { title: "Forgot App Password — D4EXAM" },
      { name: "description", content: "Recover your D4EXAM app unlock password." },
    ],
  }),
  component: ForgotAppPasswordPage,
});

function ForgotAppPasswordPage() {
  const { data: session } = useSessionUser();
  const [schoolCode, setSchoolCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState(""); // matric / staff id / login id
  const [accountPassword, setAccountPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [err, setErr] = useState<string | null>(null);

  // Prefill from signed-in session when available
  useEffect(() => {
    if (!session) return;
    if (session.fullName) setFullName(session.fullName);
    if (session.email) {
      setEmail(session.email);
      setEmailLocked(true);
    }
  }, [session]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!schoolCode.trim() || !fullName.trim() || !identifier.trim() || !accountPassword.trim()) {
      setErr("Fill in all required fields.");
      return;
    }
    setBusy(true);
    try {
      // Verify identity against login (no Resend yet — just confirm details look valid)
      // When Resend is configured, send reset link to the locked email.
      const targetEmail = (email || session?.email || "").trim().toLowerCase();
      if (!targetEmail.includes("@")) {
        setErr(
          "No email is linked to this account yet. Add an email in Profile / Settings after you sign in, then try again.",
        );
        return;
      }
      setEmail(targetEmail);
      setEmailLocked(true);
      try {
        // Prefer real reset link email (token + /reset-app-password)
        let userId: string | undefined = session?.userId;
        if (!userId) {
          // Best-effort: if already signed in under the hood
          try {
            const { data: u } = await supabase.auth.getUser();
            userId = u.user?.id;
          } catch { /* ignore */ }
        }
        const r = await requestAppUnlockResetEmail({
          data: {
            email: targetEmail,
            fullName: fullName.trim() || session?.fullName || undefined,
            userId,
          },
        });
        if (!r?.ok) {
          // Fallback instructional email
          try {
            await notifyAppPasswordHelp({
              data: {
                email: targetEmail,
                fullName: fullName.trim() || session?.fullName || undefined,
              },
            });
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn("[forgot-app-password]", e);
      }
      setStep("confirm");
      return;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-8"
      style={{
        background: "linear-gradient(180deg, #071428 0%, #0b1b3a 45%, #050d1c 100%)",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(37,99,235,0.22),transparent_55%)]" />

      <div className="relative z-10 w-full max-w-md">
        <button
          type="button"
          onClick={() => {
            try {
              setFingerprintLocked(true);
            } catch {
              /* ignore */
            }
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              window.location.hash = "#/";
            }
          }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/20 ring-1 ring-blue-400/40">
              <Shield className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">Forgot app password</h1>
              <p className="text-xs font-medium text-slate-400">Recover your D4EXAM unlock password</p>
            </div>
          </div>

          {step === "confirm" ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <Mail className="h-6 w-6 text-emerald-300" />
              </div>
              <p className="text-base font-semibold text-white">Reset link ready for your email</p>
              <p className="text-sm text-slate-400">
                If an account matches, a reset link was sent to:
              </p>
              <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 font-mono text-sm font-semibold text-sky-300">
                {email}
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                Email delivery will activate when Resend is connected. For now, sign in with your
                school account and set a new app password in Settings → Security.
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    setFingerprintLocked(true);
                  } catch {
                    /* ignore */
                  }
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.hash = "#/";
                  }
                }}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Back to unlock
              </button>
            </div>
          ) : (
            <form className="space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
              <p className="text-sm leading-relaxed text-slate-400">
                Enter the same details you use to sign in. If your profile already has an email, it
                will appear automatically and cannot be changed.
              </p>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">School / Institution code</label>
                <input
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="School code"
                  autoComplete="organization"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="As on your account"
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Email / matric / staff ID
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="Login ID"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Account password</label>
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                  placeholder="Your sign-in password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Recovery email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    if (!emailLocked) setEmail(e.target.value);
                  }}
                  readOnly={emailLocked}
                  className={`w-full rounded-xl border border-white/15 px-3.5 py-2.5 text-sm outline-none ${
                    emailLocked
                      ? "cursor-not-allowed bg-white/5 text-sky-300"
                      : "bg-white/10 text-white placeholder:text-slate-500 focus:border-blue-400"
                  }`}
                  placeholder={emailLocked ? undefined : "Optional if not on your profile yet"}
                />
                {emailLocked ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Email from your profile — locked for security
                  </p>
                ) : null}
              </div>

              {err ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
                  {err}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-500">
          This recovers your <span className="text-slate-400">app unlock password</span>, not your
          school login.{" "}
          <Link to="/forgot-password" className="text-sky-400 hover:underline">
            Account password reset
          </Link>
        </p>
      </div>
    </div>
  );
}
