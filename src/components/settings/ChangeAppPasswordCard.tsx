import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionUser } from "@/lib/session";
import { changeAppUnlockPassword, hasAppUnlockFor } from "@/lib/app-unlock";
import { useEffect } from "react";

export function ChangeAppPasswordCard() {
  const { data: session } = useSessionUser();
  const [has, setHas] = useState(false);
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let c = false;
    void hasAppUnlockFor(session?.userId).then((v) => {
      if (!c) setHas(v);
    });
    return () => {
      c = true;
    };
  }, [session?.userId]);

  if (!session?.userId || !has) return null;

  async function onSave() {
    if (!session?.userId) return;
    if (n1.length < 4) {
      toast.error("New app password must be at least 4 characters");
      return;
    }
    if (n1 !== n2) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const r = await changeAppUnlockPassword(session.userId, cur, n1);
      if (!r.ok) {
        toast.error(r.error || "Could not update");
        return;
      }
      toast.success("App unlock password updated");
      setCur("");
      setN1("");
      setN2("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="App unlock password" description="Used only to unlock the app — not your account login password.">
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-semibold">Current App Password</Label>
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold">New App Password</Label>
          <Input type="password" value={n1} onChange={(e) => setN1(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold">Confirm New App Password</Label>
          <Input type="password" value={n2} onChange={(e) => setN2(e.target.value)} className="mt-1" />
        </div>
        <Button className="font-semibold" disabled={busy} onClick={() => void onSave()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}
          Save app password
        </Button>
      </div>
    </SectionCard>
  );
}
