import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { completeAppUnlockReset } from "@/lib/app-unlock-reset.functions";
import { setAppUnlockPassword } from "@/lib/app-unlock";

export const Route = createFileRoute("/reset-app-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    uid: typeof s.uid === "string" ? s.uid : "",
    token: typeof s.token === "string" ? s.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Reset app unlock password — D4EXAM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetAppPasswordPage,
});

function ResetAppPasswordPage() {
  const search = Route.useSearch();
  const uid = search.uid || "";
  const token = search.token || "";
  const validLink = Boolean(uid && token && token.length >= 16);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = useMemo(
    () => validLink && pw.length >= 4 && pw === pw2 && !busy,
    [validLink, pw, pw2, busy],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!validLink) {
      setErr("This reset link is invalid. Request a new one from Forgot app password.");
      return;
    }
    if (pw.length < 4) {
      setErr("App password must be at least 4 characters.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const r = await completeAppUnlockReset({
        data: { userId: uid, token, newPassword: pw },
      });
      if (!r?.ok) {
        setErr((r as { error?: string })?.error || "Could not reset password.");
        return;
      }
      // Also write local cache if this browser will be used after login
      try {
        await setAppUnlockPassword(uid, pw);
      } catch {
        /* cloud already set */
      }
      setDone(true);
    } catch (e) {
      setErr((e as Error).message || "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-8"
      style={{
        background: "linear-gradient(180deg, #071428 0%, #0b1b3a 45%, #050d1c 100%)",
      }}
    >
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-lg bg-white object-contain" />
          <div>
            <p className="text-lg font-extrabold tracking-tight text-white">D4EXAM</p>
            <p className="text-xs text-slate-400">App unlock password</p>
          </div>
        </div>

        {!validLink ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-300">This reset link is missing or invalid.</p>
            <Button asChild className="w-full font-semibold">
              <Link to="/forgot-app-password">Request a new link</Link>
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="text-xl font-extrabold text-white">Password updated</h1>
            <p className="text-sm text-slate-300">
              Your app unlock password was reset. Sign in, then use the new password when D4EXAM asks to unlock.
            </p>
            <Button asChild className="w-full font-semibold">
              <Link to="/login">Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="flex items-center gap-2 text-white">
              <KeyRound className="h-5 w-5 text-sky-400" />
              <h1 className="text-lg font-extrabold">Choose a new app unlock password</h1>
            </div>
            <p className="text-xs text-slate-400">
              This unlocks the D4EXAM app on your device. It is not your school login password.
            </p>
            <div className="space-y-2">
              <Label className="text-slate-200">New app password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="bg-white/10 text-white border-white/20"
                minLength={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Confirm app password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="bg-white/10 text-white border-white/20"
                minLength={4}
                required
              />
            </div>
            {err ? <p className="text-sm text-red-300">{err}</p> : null}
            <Button type="submit" className="w-full font-semibold" disabled={!canSubmit}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save new app password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
