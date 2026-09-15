import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/lib/session";
import {
  enablePushNotifications,
  getPushPermissionState,
  refreshNativePushPermissionState,
  type PushPermissionState,
} from "@/lib/push";
import { isNativeShell } from "@/native/platform";

export function PushSettingsCard({ scope }: { scope?: string }) {
  const { data: session } = useSessionUser();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushPermissionState>(() => getPushPermissionState());
  const native = isNativeShell();

  useEffect(() => {
    if (!native) return;
    void refreshNativePushPermissionState().then(setPushStatus);
  }, [native]);

  const enabled = pushStatus === "granted";
  const unsupported = !native && pushStatus === "unsupported";

  return (
    <SectionCard title="Notifications" description="Exam and result alerts on this device">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {enabled
            ? "Notifications are enabled on this device."
            : unsupported
              ? "Notifications are not supported in this browser."
              : "Enable notifications to get exam and result alerts."}
        </p>
        <p className="text-xs text-slate-500">
          Status:{" "}
          <span className={`font-semibold ${enabled ? "text-emerald-600" : "text-slate-700"}`}>
            {enabled ? "Enabled" : pushStatus === "denied" ? "Blocked" : unsupported ? "Unsupported" : "Off"}
          </span>
        </p>
        <Button
          type="button"
          disabled={pushBusy || unsupported || enabled}
          onClick={() => {
            if (!session?.userId) {
              toast.error("Sign in required.");
              return;
            }
            if (enabled) {
              toast.message("Notifications are already enabled.");
              return;
            }
            setPushBusy(true);
            void enablePushNotifications(session.userId, session.role)
              .then(async (r) => {
                if (native) setPushStatus(await refreshNativePushPermissionState());
                else setPushStatus(getPushPermissionState());
                if (r.ok) toast.success("Notifications enabled.");
                else toast.error(r.error || "Could not enable notifications.");
              })
              .finally(() => setPushBusy(false));
          }}
        >
          {pushBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {enabled ? "Notifications enabled" : "Enable notifications"}
        </Button>
        {pushStatus === "denied" && (
          <p className="text-xs text-amber-700">
            Notifications are blocked. Allow them in your device or browser settings for D4EXAM.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
