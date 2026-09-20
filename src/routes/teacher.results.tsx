import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Users, CheckCircle2, XCircle, Activity } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dashboard/kit";
import { useTeacherContext } from "@/lib/teacher";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher/results")({
  head: () => ({
    meta: [
      { title: "Results / Exam Analysis — D4EXAM" },
      { name: "description", content: "Detailed examination performance analysis." },
    ],
  }),
  component: Page,
});

type ExamRow = {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_minutes: number | null;
  courses: { code: string; name: string } | null;
};

type ResultRow = {
  id: string;
  percentage: number | null;
  pass_fail: string | null;
  status: string;
  security_review_status?: string | null;
  grade?: string | null;
};

type AttemptRow = { status: string };

function Page() {
  const { data: teacher, isLoading } = useTeacherContext();
  const [openList, setOpenList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const examsQ = useQuery({
    queryKey: ["teacher-results-exams", teacher?.schoolId, teacher?.courseIds],
    enabled: Boolean(teacher?.schoolId && teacher?.courseIds?.length),
    queryFn: async () => {
      if (!teacher) return [] as ExamRow[];
      const { data, error } = await supabase
        .from("examinations")
        .select("id, title, status, scheduled_start, scheduled_end, duration_minutes, courses(code, name)")
        .eq("school_id", teacher.schoolId)
        .in("course_id", teacher.courseIds)
        .order("updated_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as ExamRow[];
    },
  });

  const rows = examsQ.data ?? [];
  const activeId = selectedId ?? null;
  const selected = rows.find((e) => e.id === activeId) ?? null;

  // Attempt counts for list badges (all exams)
  const countsQ = useQuery({
    queryKey: ["teacher-results-attempt-counts", teacher?.schoolId, rows.map((r) => r.id).join(",")],
    enabled: Boolean(teacher?.schoolId && rows.length),
    queryFn: async () => {
      if (!teacher || !rows.length) return {} as Record<string, number>;
      const ids = rows.map((r) => r.id);
      const { data } = await supabase
        .from("exam_attempts")
        .select("exam_id, status")
        .eq("school_id", teacher.schoolId)
        .in("exam_id", ids)
        .limit(2000);
      const map: Record<string, number> = {};
      for (const a of data ?? []) {
        const eid = String((a as { exam_id: string }).exam_id);
        map[eid] = (map[eid] || 0) + 1;
      }
      return map;
    },
  });
  const attemptCounts = countsQ.data ?? {};

  const resultsQ = useQuery({
    queryKey: ["teacher-exam-results-detail", activeId],
    enabled: Boolean(activeId && teacher?.schoolId),
    queryFn: async () => {
      if (!activeId || !teacher) return [] as ResultRow[];
      const { data, error } = await supabase
        .from("results")
        .select("id, percentage, pass_fail, status, security_review_status, grade")
        .eq("school_id", teacher.schoolId)
        .eq("exam_id", activeId)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ResultRow[];
    },
  });

  const attemptsQ = useQuery({
    queryKey: ["teacher-exam-attempts-detail", activeId],
    enabled: Boolean(activeId && teacher?.schoolId),
    queryFn: async () => {
      if (!activeId || !teacher) return [] as AttemptRow[];
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("status")
        .eq("school_id", teacher.schoolId)
        .eq("exam_id", activeId)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as AttemptRow[];
    },
  });

  const analytics = useMemo(() => {
    const results = resultsQ.data ?? [];
    const attempts = attemptsQ.data ?? [];
    const st = (s: string) => (s || "").toLowerCase();
    const inProgress = attempts.filter((a) => st(a.status) === "in_progress").length;
    const submitted = attempts.filter((a) => ["submitted", "flagged"].includes(st(a.status))).length;
    const terminated = attempts.filter((a) => st(a.status) === "terminated").length;
    const totalAttempts = attempts.length;
    const scores = results.map((r) => Number(r.percentage)).filter((n) => !Number.isNaN(n));
    const passed = results.filter((r) => st(r.pass_fail || "") === "pass").length;
    const failed = results.filter((r) => st(r.pass_fail || "") === "fail").length;
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const highest = scores.length ? Math.max(...scores) : null;
    const lowest = scores.length ? Math.min(...scores) : null;
    const passRate = results.length ? Math.round((passed / results.length) * 1000) / 10 : null;
    const buckets = [
      { label: "0–39%", count: 0, color: "bg-red-500" },
      { label: "40–49%", count: 0, color: "bg-orange-400" },
      { label: "50–59%", count: 0, color: "bg-amber-400" },
      { label: "60–69%", count: 0, color: "bg-lime-500" },
      { label: "70–79%", count: 0, color: "bg-emerald-500" },
      { label: "80–100%", count: 0, color: "bg-teal-600" },
    ];
    for (const s of scores) {
      if (s < 40) buckets[0].count += 1;
      else if (s < 50) buckets[1].count += 1;
      else if (s < 60) buckets[2].count += 1;
      else if (s < 70) buckets[3].count += 1;
      else if (s < 80) buckets[4].count += 1;
      else buckets[5].count += 1;
    }
    const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
    const essayMarked = results.filter(
      (r) => String(r.security_review_status || "").toLowerCase() === "teacher_marked",
    ).length;
    return {
      totalAttempts,
      inProgress,
      submitted,
      terminated,
      passed,
      failed,
      avg,
      highest,
      lowest,
      passRate,
      buckets,
      maxBucket,
      essayMarked,
      resultCount: results.length,
    };
  }, [resultsQ.data, attemptsQ.data]);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!teacher) {
    return <EmptyState title="Teacher profile not found" description="Contact School Admin." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      <PageHeader
        title="Results / Exam Analysis"
        description={`Performance database for your courses · ${teacher.fullName}`}
      />

      {/* Exam selector — collapsible list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setOpenList((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Examination</p>
            <p className="truncate text-sm font-extrabold text-slate-900">
              {selected
                ? selected.title
                : rows.length
                  ? "Select an examination"
                  : "No examinations yet"}
            </p>
            {selected?.courses ? (
              <p className="truncate text-xs text-slate-500">
                {selected.courses.code} — {selected.courses.name}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selected ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                {attemptCounts[selected.id] ?? 0} attempts
              </span>
            ) : null}
            {openList ? (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </button>

        {openList ? (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
            {examsQ.isLoading ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Loading exams…</li>
            ) : rows.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500">No exams on your courses yet.</li>
            ) : (
              rows.map((e) => {
                const n = attemptCounts[e.id] ?? 0;
                const active = e.id === activeId;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(e.id);
                        setOpenList(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                        active ? "bg-primary/5" : "hover:bg-slate-50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-bold", active ? "text-primary" : "text-slate-900")}>
                          {e.title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {e.courses?.code ?? "—"} · {String(e.status).replaceAll("_", " ")}
                          {e.scheduled_start
                            ? ` · ${new Date(e.scheduled_start).toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-700">
                        {n} {n === 1 ? "attempt" : "attempts"}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      {/* Detail panel */}
      {!selected ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center">
          <Activity className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Choose an examination above</p>
          <p className="mt-1 text-xs text-slate-500">Detailed participation, scores and ranges appear here.</p>
        </div>
      ) : resultsQ.isLoading || attemptsQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading analysis…</p>
      ) : (
        <div className="space-y-4">
          {/* Header strip */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0b1b3a] to-[#122548] p-4 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300/90">Exam analysis</p>
                <h2 className="mt-0.5 text-lg font-extrabold leading-tight">{selected.title}</h2>
                <p className="mt-1 text-xs text-sky-100/80">
                  {selected.courses?.code} — {selected.courses?.name}
                  {selected.duration_minutes ? ` · ${selected.duration_minutes} min` : ""}
                </p>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                {String(selected.status).replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[10px] font-semibold uppercase text-sky-200/90">Attempts</p>
                <p className="text-xl font-black tabular-nums">{analytics.totalAttempts}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[10px] font-semibold uppercase text-sky-200/90">Pass rate</p>
                <p className="text-xl font-black tabular-nums">
                  {analytics.passRate != null ? `${analytics.passRate}%` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[10px] font-semibold uppercase text-sky-200/90">Average</p>
                <p className="text-xl font-black tabular-nums">
                  {analytics.avg != null ? `${Math.round(analytics.avg)}%` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Participation */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Participation</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini label="In progress" value={analytics.inProgress} icon={Users} tone="sky" />
              <Mini label="Submitted" value={analytics.submitted} icon={CheckCircle2} tone="emerald" />
              <Mini label="Terminated" value={analytics.terminated} icon={XCircle} tone="red" />
              <Mini label="Essay marked" value={analytics.essayMarked} icon={CheckCircle2} tone="violet" />
            </div>
          </section>

          {/* Outcomes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Outcomes</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="Passed" value={String(analytics.passed)} accent="text-emerald-700" />
              <StatBlock label="Failed" value={String(analytics.failed)} accent="text-red-700" />
              <StatBlock
                label="Highest"
                value={analytics.highest != null ? `${Math.round(analytics.highest)}%` : "—"}
                accent="text-slate-900"
              />
              <StatBlock
                label="Lowest"
                value={analytics.lowest != null ? `${Math.round(analytics.lowest)}%` : "—"}
                accent="text-slate-900"
              />
            </div>
            {/* Pass vs fail bars — no ring */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700">Pass</span>
                <span className="tabular-nums text-slate-600">{analytics.passed}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      analytics.passed + analytics.failed > 0
                        ? (100 * analytics.passed) / (analytics.passed + analytics.failed)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-red-700">Fail</span>
                <span className="tabular-nums text-slate-600">{analytics.failed}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{
                    width: `${
                      analytics.passed + analytics.failed > 0
                        ? (100 * analytics.failed) / (analytics.passed + analytics.failed)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </section>

          {/* Score ranges */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Score ranges</h3>
            <ul className="mt-3 space-y-2.5">
              {analytics.buckets.map((b) => (
                <li key={b.label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-[11px] font-bold tabular-nums text-slate-600">{b.label}</span>
                  <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all", b.color)}
                      style={{ width: `${(100 * b.count) / analytics.maxBucket}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-slate-800">
                    {b.count}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-400">
              Based on {analytics.resultCount} result row{analytics.resultCount === 1 ? "" : "s"} recorded for this paper.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone: "sky" | "emerald" | "red" | "violet";
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className={cn("rounded-xl px-3 py-2.5", tones[tone])}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-black tabular-nums", accent)}>{value}</p>
    </div>
  );
}
