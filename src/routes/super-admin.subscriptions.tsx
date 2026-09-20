import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Clock, Search, AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtimeInvalidate } from "@/lib/realtime";

export const Route = createFileRoute("/super-admin/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — D4EXAM" }] }),
  component: Page,
});

type SchoolSub = {
  id: string;
  name: string;
  school_code: string | null;
  logo_url: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  status: string;
  created_at: string | null;
  approved_at: string | null;
};

function planDays(plan: string | null) {
  const p = (plan || "").toLowerCase();
  if (p.includes("trial") || p.includes("demo")) return 30;
  if (p.includes("month")) return 30;
  if (p.includes("year") || p.includes("annual")) return 365;
  return 365;
}

function endsAt(s: SchoolSub) {
  const base = s.approved_at || s.created_at;
  if (!base) return null;
  const d = new Date(base);
  d.setDate(d.getDate() + planDays(s.subscription_plan));
  return d;
}

function daysLeft(end: Date | null) {
  if (!end) return null;
  return Math.ceil((end.getTime() - Date.now()) / 864e5);
}

function Page() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<SchoolSub | null>(null);
  const qc = useQueryClient();
  useRealtimeInvalidate("sa-subs", [{ table: "schools" }], [["sa-subscriptions-v2"]], true);

  const listQ = useQuery({
    queryKey: ["sa-subscriptions-v2"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, school_code, logo_url, subscription_plan, subscription_status, status, created_at, approved_at")
        .order("name");
      if (error) throw error;
      return (data ?? []) as SchoolSub[];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (listQ.data ?? [])
      .map((s) => {
        const end = endsAt(s);
        return { ...s, end, left: daysLeft(end) };
      })
      .filter((s) => {
        if (!term) return true;
        return [s.name, s.school_code, s.subscription_plan, s.subscription_status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => (a.left ?? 9999) - (b.left ?? 9999));
  }, [listQ.data, q]);

  async function setPlan(id: string, plan: string, status: string) {
    try {
      const { error } = await supabase
        .from("schools")
        .update({ subscription_plan: plan, subscription_status: status } as never)
        .eq("id", id);
      if (error) throw error;
      toast.success("Subscription updated");
      void qc.invalidateQueries({ queryKey: ["sa-subscriptions-v2"] });
      setSelected(null);
    } catch (e) {
      toast.error((e as Error).message || "Update failed");
    }
  }

  const expiring = rows.filter((r) => r.left != null && r.left <= 7 && r.left >= 0).length;
  const expired = rows.filter((r) => r.left != null && r.left < 0).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Subscriptions" description="Live plans per school with countdown to expiry." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Schools", rows.length, "bg-blue-50 text-blue-700"],
            ["Expiring <=7d", expiring, "bg-amber-50 text-amber-800"],
            ["Expired", expired, "bg-red-50 text-red-700"],
            [
              "Active",
              rows.filter((r) => (r.subscription_status || "").toLowerCase() === "active").length,
              "bg-emerald-50 text-emerald-800",
            ],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className={cn("rounded-2xl border border-slate-200 p-3 shadow-sm", tone)}>
            <p className="text-[11px] font-semibold opacity-80">{label}</p>
            <p className="mt-1 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search school or plan..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {listQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No schools" description="Approve applications to see subscription cards." icon={CreditCard} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const urgent = s.left != null && s.left <= 3;
            const warn = s.left != null && s.left <= 7 && s.left > 3;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className={cn(
                  "rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md",
                  urgent ? "border-red-200" : warn ? "border-amber-200" : "border-slate-200",
                )}
              >
                <div className="flex items-start gap-3">
                  <SchoolLogo logoUrl={s.logo_url} schoolName={s.name} size="md" className="rounded-full ring-2 ring-slate-100" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.school_code || "No code"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {s.subscription_plan || "Standard"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                          (s.subscription_status || "").toLowerCase() === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {s.subscription_status || s.status || "-"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Clock className={cn("h-4 w-4", urgent ? "text-red-600" : warn ? "text-amber-600" : "text-slate-500")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">
                      {s.left == null
                        ? "No end date"
                        : s.left < 0
                          ? `Expired ${Math.abs(s.left)}d ago`
                          : s.left === 0
                            ? "Expires today"
                            : `${s.left} day(s) remaining`}
                    </p>
                    {s.end ? (
                      <p className="text-[11px] text-slate-500">
                        Until {s.end.toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </p>
                    ) : null}
                  </div>
                  {(urgent || warn) && (
                    <AlertTriangle className={cn("h-4 w-4", urgent ? "text-red-500" : "text-amber-500")} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <SchoolLogo logoUrl={selected.logo_url} schoolName={selected.name} size="lg" className="rounded-full" />
              <div>
                <p className="font-extrabold text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-500">{selected.school_code}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Plan: <strong>{selected.subscription_plan || "Standard"}</strong>
              <br />
              Status: <strong>{selected.subscription_status || selected.status}</strong>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="font-semibold" onClick={() => void setPlan(selected.id, "Trial", "active")}>
                Set Trial (30d)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="font-semibold"
                onClick={() => void setPlan(selected.id, "Annual", "active")}
              >
                Set Annual
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="font-semibold text-amber-800"
                onClick={() => void setPlan(selected.id, selected.subscription_plan || "Standard", "expired")}
              >
                Mark expired
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/super-admin/schools/$id" params={{ id: selected.id }}>
                  Open school
                </Link>
              </Button>
            </div>
            <Button className="mt-4 w-full" variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
