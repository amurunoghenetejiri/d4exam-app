import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  GraduationCap,
  FileText,
  CheckCircle2,
  Clock,
  Activity,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/reports")({
  head: () => ({ meta: [{ title: "Platform Reports — D4EXAM" }] }),
  component: Page,
});

function Page() {
  useRealtimeInvalidate(
    "sa-reports",
    [
      { table: "schools" },
      { table: "students" },
      { table: "teachers" },
      { table: "examinations" },
      { table: "school_applications" },
      { table: "profiles" },
    ],
    [["sa-platform-reports"]],
    true,
  );

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const q = useQuery({
    queryKey: ["sa-platform-reports"],
    refetchInterval: 40_000,
    queryFn: async () => {
      const [
        schools,
        schoolsWeek,
        students,
        teachers,
        users,
        exams,
        examsWeek,
        completed,
        pendingApps,
        liveExams,
        byStatus,
      ] = await Promise.all([
        supabase.from("schools").select("id", { count: "exact", head: true }),
        supabase.from("schools").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("examinations").select("id", { count: "exact", head: true }),
        supabase.from("examinations").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("examinations").select("id", { count: "exact", head: true }).in("status", ["completed", "closed"]),
        supabase
          .from("school_applications")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "under_review"]),
        supabase
          .from("examinations")
          .select("id", { count: "exact", head: true })
          .in("status", ["published", "live", "in_progress", "active", "ongoing"]),
        supabase.from("examinations").select("status").limit(5000),
      ]);

      const statusCounts: Record<string, number> = {};
      for (const e of byStatus.data ?? []) {
        const st = String((e as { status?: string }).status || "unknown");
        statusCounts[st] = (statusCounts[st] ?? 0) + 1;
      }

      return {
        schools: schools.count ?? 0,
        schoolsWeek: schoolsWeek.count ?? 0,
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        users: users.count ?? 0,
        exams: exams.count ?? 0,
        examsWeek: examsWeek.count ?? 0,
        completed: completed.count ?? 0,
        pendingApps: pendingApps.count ?? 0,
        liveExams: liveExams.count ?? 0,
        statusCounts,
      };
    },
  });

  const d = q.data;

  function exportCsv() {
    const rows = [
      ["Metric", "Value"],
      ["Schools", String(d?.schools ?? 0)],
      ["Schools this week", String(d?.schoolsWeek ?? 0)],
      ["Users", String(d?.users ?? 0)],
      ["Students", String(d?.students ?? 0)],
      ["Teachers", String(d?.teachers ?? 0)],
      ["Exams", String(d?.exams ?? 0)],
      ["Completed exams", String(d?.completed ?? 0)],
      ["Live exams", String(d?.liveExams ?? 0)],
      ["Pending applications", String(d?.pendingApps ?? 0)],
    ];
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `d4exam-platform-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    { label: "Total schools", value: d?.schools, sub: `+${d?.schoolsWeek ?? 0} this week`, icon: Building2, tone: "from-blue-500 to-blue-600" },
    { label: "Platform users", value: d?.users, sub: "All roles", icon: Users, tone: "from-violet-500 to-violet-600" },
    { label: "Students", value: d?.students, sub: "All schools", icon: GraduationCap, tone: "from-emerald-500 to-emerald-600" },
    { label: "Teachers", value: d?.teachers, sub: "All schools", icon: Users, tone: "from-amber-500 to-amber-600" },
    { label: "Examinations", value: d?.exams, sub: `+${d?.examsWeek ?? 0} this week`, icon: FileText, tone: "from-sky-500 to-sky-600" },
    { label: "Completed", value: d?.completed, sub: "Closed papers", icon: CheckCircle2, tone: "from-teal-500 to-teal-600" },
    { label: "Live now", value: d?.liveExams, sub: "In progress / published", icon: Activity, tone: "from-rose-500 to-rose-600" },
    { label: "Pending apps", value: d?.pendingApps, sub: "Awaiting review", icon: Clock, tone: "from-orange-500 to-orange-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Platform Reports" description="Live platform analytics - schools, users, exams, and applications." />
        <Button variant="outline" size="sm" className="gap-1.5 font-semibold shrink-0" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading live reports...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className={cn("h-1.5 bg-gradient-to-r", c.tone)} />
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-[11px] font-semibold text-slate-500">{c.label}</p>
                    <c.icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">{c.value == null ? "..." : c.value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Examination status breakdown</h2>
            {Object.keys(d?.statusCounts ?? {}).length === 0 ? (
              <p className="text-sm text-slate-500">No examination records yet.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(d?.statusCounts ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                      <span className="text-sm font-semibold capitalize text-slate-800">{status}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
          <p className="text-center text-xs text-slate-400">Updated live · {new Date().toLocaleString()}</p>
        </>
      )}
    </div>
  );
}
