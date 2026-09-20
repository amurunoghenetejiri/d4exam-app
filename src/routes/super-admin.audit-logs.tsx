import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ScrollText } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dashboard/kit";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidate } from "@/lib/realtime";

export const Route = createFileRoute("/super-admin/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — D4EXAM" }] }),
  component: Page,
});

type Log = {
  id: string;
  action: string | null;
  description: string | null;
  actor_role: string | null;
  entity_type: string | null;
  created_at: string;
  school_id: string | null;
};

function actionTone(action: string | null) {
  const a = (action || "").toLowerCase();
  if (a.includes("approv") || a.includes("create") || a.includes("publish")) return "bg-emerald-100 text-emerald-800";
  if (a.includes("reject") || a.includes("delete") || a.includes("suspend") || a.includes("terminat")) return "bg-red-100 text-red-800";
  if (a.includes("update") || a.includes("change") || a.includes("edit")) return "bg-amber-100 text-amber-900";
  if (a.includes("login") || a.includes("auth")) return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

function Page() {
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useRealtimeInvalidate("sa-audit", [{ table: "audit_logs" }], [["sa-audit-logs-v2"]], true);

  const listQ = useQuery({
    queryKey: ["sa-audit-logs-v2"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, description, actor_role, entity_type, created_at, school_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Log[];
    },
  });

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const r of listQ.data ?? []) if (r.action) set.add(r.action);
    return ["all", ...[...set].sort()];
  }, [listQ.data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!term) return true;
      return [r.action, r.description, r.actor_role, r.entity_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [listQ.data, q, actionFilter]);

  return (
    <div className="space-y-4">
      <PageHeader title="Audit Logs" description="Platform activity trail — who did what, when." />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search action, description, role..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActionFilter(a)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize",
              actionFilter === a ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600",
            )}
          >
            {a === "all" ? "All actions" : a}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
          Logs ({filtered.length})
        </div>
        {listQ.isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading audit logs...</p>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matching logs" description="Try another filter or wait for platform activity." icon={ScrollText} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {filtered.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", actionTone(log.action))}>
                      {log.action || "event"}
                    </span>
                    {log.actor_role ? (
                      <span className="text-[11px] font-semibold text-slate-500">{log.actor_role}</span>
                    ) : null}
                    {log.entity_type ? (
                      <span className="text-[11px] text-slate-400">· {log.entity_type}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-800">{log.description || "No description"}</p>
                </div>
                <time className="shrink-0 text-[11px] font-medium text-slate-400">
                  {new Date(log.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
