import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Search, Send, Mail, Bell } from "lucide-react";
import { PageHeader } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendPlatformMessage } from "@/lib/email-notify.functions";

export const Route = createFileRoute("/super-admin/messages")({
  head: () => ({ meta: [{ title: "Messaging — D4EXAM" }] }),
  component: Page,
});

type Person = {
  profileId: string;
  authUserId: string;
  fullName: string;
  email: string;
  schoolName: string;
  roles: string[];
};

function Page() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [viaEmail, setViaEmail] = useState(true);
  const [viaNotification, setViaNotification] = useState(true);
  const [busy, setBusy] = useState(false);

  const peopleQ = useQuery({
    queryKey: ["sa-message-people"],
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: schools }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, school_id, auth_user_id").limit(4000),
        supabase.from("user_roles").select("user_id, role").limit(8000),
        supabase.from("schools").select("id, name").limit(2000),
      ]);
      const schoolMap = new Map((schools ?? []).map((s) => [(s as { id: string }).id, (s as { name: string }).name]));
      const rolesBy = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const row = r as { user_id: string; role: string };
        const list = rolesBy.get(row.user_id) ?? [];
        if (row.role) list.push(row.role);
        rolesBy.set(row.user_id, list);
      }
      const out: Person[] = [];
      for (const p of profiles ?? []) {
        const row = p as {
          id: string;
          full_name: string | null;
          email: string | null;
          school_id: string | null;
          auth_user_id: string;
        };
        const em = (row.email || "").trim();
        if (!em || em.endsWith(".local")) continue;
        out.push({
          profileId: row.id,
          authUserId: row.auth_user_id,
          fullName: row.full_name || "User",
          email: em,
          schoolName: row.school_id ? schoolMap.get(row.school_id) || "—" : "Platform",
          roles: rolesBy.get(row.auth_user_id) ?? [],
        });
      }
      return out;
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return (peopleQ.data ?? []).slice(0, 40);
    return (peopleQ.data ?? [])
      .filter((p) => [p.fullName, p.email, p.schoolName, p.roles.join(" ")].join(" ").toLowerCase().includes(term))
      .slice(0, 40);
  }, [peopleQ.data, q]);

  async function send() {
    if (!selected) {
      toast.error("Select a recipient");
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and message");
      return;
    }
    if (!viaEmail && !viaNotification) {
      toast.error("Choose email and/or notification");
      return;
    }
    setBusy(true);
    try {
      const r = await sendPlatformMessage({
        data: {
          email: selected.email,
          authUserId: selected.authUserId,
          title: title.trim(),
          body: body.trim(),
          viaEmail,
          viaNotification,
          recipientName: selected.fullName,
        },
      });
      if (r.ok) {
        toast.success("Message sent");
        setTitle("");
        setBody("");
      } else {
        toast.error(`Send issue: ${(r.results || []).join(", ")}`);
      }
    } catch (e) {
      toast.error((e as Error).message || "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messaging"
        description="Search any user on the platform and send email, in-app notification, or both."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Search className="h-4 w-4" /> Find recipient
          </h2>
          <Input placeholder="Name, email, school, matric..." value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
          <ul className="max-h-[360px] space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <li key={p.profileId}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left transition",
                    selected?.profileId === p.profileId
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-slate-50",
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{p.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {p.email} · {p.schoolName}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <MessageSquare className="h-4 w-4" /> Compose
          </h2>
          {selected ? (
            <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              To: <strong>{selected.fullName}</strong> ({selected.email})
            </p>
          ) : (
            <p className="mb-3 text-sm text-slate-500">Select a person on the left.</p>
          )}
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject / notification title" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write your message..." />
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={viaEmail} onChange={(e) => setViaEmail(e.target.checked)} />
                <Mail className="h-4 w-4" /> Email
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={viaNotification} onChange={(e) => setViaNotification(e.target.checked)} />
                <Bell className="h-4 w-4" /> In-app notification
              </label>
            </div>
            <Button className="w-full gap-2 font-semibold" disabled={busy || !selected} onClick={() => void send()}>
              <Send className="h-4 w-4" /> {busy ? "Sending..." : "Send message"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
