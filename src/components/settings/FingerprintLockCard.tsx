import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/lib/session";
import { isNativeShell } from "@/native/platform";
import {
  authenticateWithFingerprint,
  checkFingerprintAvailable,
  type FingerprintAvailability,
} from "@/native/fingerprintAuth";
import {
  disableFingerprint,
  enableFingerprintFor,
  isFingerprintEnabledFor,
} from "@/lib/fingerprint-lock";

export function FingerprintLockCard() {
  const { data: session } = useSessionUser();
  const native = isNativeShell();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [availability, setAvailability] = useState<FingerprintAvailability | null>(null);

  const refresh = useCallback(() => {
    setEnabled(isFingerprintEnabledFor(session?.userId));
  }, [session?.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!native) return;
    void checkFingerprintAvailable().then(setAvailability);
  }, [native]);

  if (!native) {
    return null;
  }

  const available = availability?.ok === true;
  const unavailableMsg =
    availability && !availability.ok ? availability.message : null;

  async function onEnable() {
    if (!session?.userId) {
      toast.error("Sign in required.");
      return;
    }
    setBusy(true);
    try {
      const avail = await checkFingerprintAvailable();
      setAvailability(avail);
      if (!avail.ok) {
        toast.error(avail.message);
        return;
      }
      const auth = await authenticateWithFingerprint({
        reason: "Confirm your fingerprint to enable unlock for D4EXAM",
        title: "Enable Fingerprint",
        subtitle: "Use your fingerprint to continue",
      });
      if (!auth.ok) {
        if (auth.code !== "cancelled") toast.error(auth.message);
        return;
      }
      enableFingerprintFor(session.userId);
      setEnabled(true);
      toast.success("Fingerprint unlock enabled on this device.");
    } finally {
      setBusy(false);
    }
  }

  function onDisable() {
    disableFingerprint();
    setEnabled(false);
    toast.success("Fingerprint unlock disabled.");
  }

  return (
    <SectionCard title="Security" description="Fingerprint unlock for this device">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Fingerprint Unlock</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Use your fingerprint to quickly and securely unlock D4EXAM. Your fingerprint stays on
              this device — D4EXAM never stores it.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Status:{" "}
              <span className={`font-semibold ${enabled ? "text-emerald-600" : "text-slate-700"}`}>
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </p>
          </div>
        </div>

        {unavailableMsg && !enabled && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{unavailableMsg}</p>
        )}

        {enabled ? (
          <Button type="button" variant="outline" disabled={busy} onClick={onDisable}>
            Disable Fingerprint
          </Button>
        ) : (
          <Button
            type="button"
            disabled={busy || (availability !== null && !available)}
            onClick={() => void onEnable()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enable Fingerprint
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
