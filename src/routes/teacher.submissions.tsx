import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { useTeacherContext } from "@/lib/teacher";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/teacher/submissions")({
  head: () => ({
    meta: [{ title: "Submissions — D4EXAM" }],
  }),
  component: Page,
});

type AttemptRow = {
  id: string;
  exam_id: string;
  student_id: string;
  status: string;
  submitted_at: string | null;
  examinations: { id: string; title: string; course_id: string | null } | null;
  students: {
    id: string;
    full_name?: string | null;
    matric_number: string | null;
    student_id: string | null;
    profiles: { full_name: string | null } | null;
  } | null;
};

function isEssayType(ty: string): boolean {
  const t = (ty || "").toLowerCase();
  return (
    t.includes("essay") ||
    t.includes("short") ||
    t.includes("theory") ||
    t.includes("descript") ||
    t === "numerical"
  );
}

function Page() {
  const { data: teacher, isLoading } = useTeacherContext();

  const attemptsQ = useQuery({
    queryKey: ["teacher-submissions", teacher?.schoolId, teacher?.courseIds],
    enabled: Boolean(teacher?.schoolId && teacher?.courseIds?.length),
    staleTime: 5_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!teacher) return [] as AttemptRow[];
      const { data: exams, error: eErr } = await supabase
        .from("examinations")
        .select("id")
        .eq("school_id", teacher.schoolId)
        .in("course_id", teacher.courseIds);
      if (eErr) throw eErr;
      const examIds = (exams ?? []).map((e) => e.id as string);
      if (!examIds.length) return [];

      let res = await supabase
        .from("exam_attempts")
        .select(
          `id, exam_id, student_id, status, submitted_at,
           examinations(id, title, course_id),
           students(id, full_name, matric_number, student_id, profiles(full_name))`,
        )
        .eq("school_id", teacher.schoolId)
        .in("exam_id", examIds)
        .in("status", ["submitted", "terminated", "flagged"])
        .order("submitted_at", { ascending: false })
        .limit(200);
      if (res.error) {
        res = await supabase
          .from("exam_attempts")
          .select(
            `id, exam_id, student_id, status, submitted_at,
             examinations(id, title, course_id)`,
          )
          .eq("school_id", teacher.schoolId)
          .in("exam_id", examIds)
          .in("status", ["submitted", "terminated", "flagged"])
          .order("submitted_at", { ascending: false })
          .limit(200);
      }
      if (res.error) throw res.error;
      return (res.data ?? []) as AttemptRow[];
    },
  });

  const essayExamIdsQ = useQuery({
    queryKey: ["teacher-essay-exam-ids", teacher?.schoolId, teacher?.courseIds],
    enabled: Boolean(teacher?.schoolId && teacher?.courseIds?.length),
    queryFn: async () => {
      if (!teacher) return new Set<string>();
      const { data: exams } = await supabase
        .from("examinations")
        .select("id")
        .eq("school_id", teacher.schoolId)
        .in("course_id", teacher.courseIds);
      const examIds = (exams ?? []).map((e) => e.id as string);
      if (!examIds.length) return new Set<string>();
      const { data: links } = await supabase
        .from("exam_questions")
        .select("exam_id, question_id")
        .in("exam_id", examIds)
        .limit(3000);
      const qids = [...new Set((links ?? []).map((l) => String(l.question_id)).filter(Boolean))];
      if (!qids.length) return new Set<string>();
      const { data: qs } = await supabase.from("questions").select("id, question_type").in("id", qids);
      const essayQ = new Set(
        (qs ?? [])
          .filter((q) => isEssayType(String((q as { question_type?: string }).question_type || "")))
          .map((q) => String((q as { id: string }).id)),
      );
      return new Set(
        (links ?? [])
          .filter((l) => essayQ.has(String(l.question_id)))
          .map((l) => String(l.exam_id)),
      );
    },
  });
  const essayExams = essayExamIdsQ.data ?? new Set<string>();

  const rows = attemptsQ.data ?? [];
  const essayRows = useMemo(
    () => (essayExams.size ? rows.filter((r) => essayExams.has(r.exam_id)) : rows),
    [rows, essayExams],
  );

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!teacher) {
    return <EmptyState title="Teacher profile not found" description="Contact School Admin." />;
  }

  return (
    <>
      <PageHeader
        title="Submissions"
        description={`Student attempts on your assigned courses · ${teacher.fullName}`}
        actions={
          <Button className="font-semibold" asChild>
            <Link to="/teacher/marking">Open Marking Center</Link>
          </Button>
        }
      />
      <SectionCard
        title="Scripts needing essay marking"
        description="Theory / essay papers submitted by students. Open Marking Center to score them."
      >
        {attemptsQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading submissions…</p>
        ) : essayRows.length === 0 ? (
          <EmptyState
            title="No essay scripts yet"
            description="When students submit exams that include essay or short-answer questions on your courses, they appear here."
          />
        ) : (
          <ul className="space-y-2">
            {essayRows.map((a) => {
              const name =
                (a.students?.full_name || "").trim() ||
                (a.students?.profiles?.full_name || "").trim() ||
                "Student";
              const mat =
                a.students?.matric_number || a.students?.student_id || a.student_id.slice(0, 8);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {mat} · {a.examinations?.title ?? "Examination"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={a.status} />
                    <Button size="sm" className="font-semibold" asChild>
                      <Link to="/teacher/marking">Mark</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="All recent submissions" description="Every submitted attempt on your courses">
        {rows.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="When students sit officer-approved exams on your courses, their attempts appear here."
          />
        ) : (
          <ul className="space-y-2">
            {rows.slice(0, 50).map((a) => {
              const name =
                (a.students?.full_name || "").trim() ||
                (a.students?.profiles?.full_name || "").trim() ||
                "Student";
              const hasEssay = essayExams.has(a.exam_id);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-50 bg-slate-50/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                    <p className="truncate text-xs text-slate-500">{a.examinations?.title ?? "Exam"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasEssay ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Essay
                      </span>
                    ) : null}
                    <StatusBadge status={a.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
