import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText } from "lucide-react";
import { PageHeader, EmptyState, StatusBadge } from "@/components/dashboard/kit";
import { Input } from "@/components/ui/input";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidate } from "@/lib/realtime";

export const Route = createFileRoute("/super-admin/examinations")({
  head: () => ({ meta: [{ title: "All Examinations — D4EXAM" }] }),
  component: Page,
});

type ExamRow = {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string | null;
  school_id: string | null;
  schoolName: string;
  schoolLogo: string | null;
  courseCode: string | null;
};

function Page() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<ExamRow | null>(null);

  useRealtimeInvalidate("sa-exams", [{ table: "examinations" }], [["sa-all-exams-v2"]], true);

  const listQ = useQuery({
    queryKey: ["sa-all-exams-v2"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: exams }, { data: schools }] = await Promise.all([
        supabase
          .from("examinations")
          .select("id, title, status, scheduled_start, scheduled_end, created_at, school_id, courses(code, name)")
          .order("created_at", { ascending: false })
          .limit(800),
        supabase.from("schools").select("id, name, logo_url").limit(2000),
      ]);
      const schoolMap = new Map<string, { name: string; logo: string | null }>();
      for (const s of schools ?? []) {
        const row = s as { id: string; name: string; logo_url: string | null };
        schoolMap.set(row.id, { name: row.name, logo: row.logo_url });
      }
      const out: ExamRow[] = [];
      for (const e of exams ?? []) {
        const row = e as {
          id: string;
          title: string;
          status: string;
          scheduled_start: string | null;
          scheduled_end: string | null;
          created_at: string | null;
          school_id: string | null;
          courses?: { code?: string; name?: string } | null;
        };
        const sch = row.school_id ? schoolMap.get(row.school_id) : null;
        out.push({
          id: row.id,
          title: row.title,
          status: row.status,
          scheduled_start: row.scheduled_start,
          scheduled_end: row.scheduled_end,
          created_at: row.created_at,
          school_id: row.school_id,
          schoolName: sch?.name || "—",
          schoolLogo: sch?.logo || null,
          courseCode: row.courses?.code || null,
        });
      }
      return out;
    },
  });

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of listQ.data ?? []) if (r.status) set.add(r.status);
    return ["all", ...[...set].sort()];
  }, [listQ.data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!term) return true;
      return [r.title, r.schoolName, r.courseCode, r.status].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [listQ.data, q, statusFilter]);

  return (
    <div className="space-y-4">
      <PageHeader title="All Examinations" description="Every exam across the platform — school, schedule, and status." />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search exam, school, course..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize",
              statusFilter === s ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600",
            )}
          >
            {s === "all" ? "All statuses" : s}
          </button>
        ))}
      </div>
      {listQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading examinations...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No examinations" description="Exams created by schools appear here." icon={FileText} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">School</th>
                  <th className="px-4 py-2.5">Examination</th>
                  <th className="px-4 py-2.5">Course</th>
                  <th className="px-4 py-2.5">Scheduled</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/80"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SchoolLogo logoUrl={r.schoolLogo} schoolName={r.schoolName} size="sm" className="rounded-full" />
                        <span className="max-w-[140px] truncate font-semibold text-slate-800">{r.schoolName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.title}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.courseCode || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.scheduled_start ? new Date(r.scheduled_start).toLocaleString() : "Not scheduled"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <SchoolLogo logoUrl={selected.schoolLogo} schoolName={selected.schoolName} size="md" className="rounded-full" />
              <div>
                <p className="font-extrabold text-slate-900">{selected.title}</p>
                <p className="text-xs text-slate-500">{selected.schoolName}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                <dt className="text-slate-500">Course</dt>
                <dd className="font-semibold">{selected.courseCode || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                <dt className="text-slate-500">Status</dt>
                <dd><StatusBadge status={selected.status} /></dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                <dt className="text-slate-500">Start</dt>
                <dd className="font-semibold">{selected.scheduled_start ? new Date(selected.scheduled_start).toLocaleString() : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-100 py-2">
                <dt className="text-slate-500">End</dt>
                <dd className="font-semibold">{selected.scheduled_end ? new Date(selected.scheduled_end).toLocaleString() : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-slate-500">Created</dt>
                <dd className="font-semibold">{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</dd>
              </div>
            </dl>
            {selected.school_id ? (
              <Link
                to="/super-admin/schools/$id"
                params={{ id: selected.school_id }}
                className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Open school overview →
              </Link>
            ) : null}
            <button type="button" className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
