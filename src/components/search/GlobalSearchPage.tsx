/**
 * Full-screen role-aware D4EXAM search.
 * Queries are scoped by role + school_id; never bypasses RLS.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  FileText,
  Loader2,
  Search,
  Users,
  X,
  GraduationCap,
  Building2,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser, type AppRole } from "@/lib/session";
import { cn } from "@/lib/utils";

type SearchHit = {
  id: string;
  kind: "course" | "exam" | "student" | "teacher" | "material" | "feature" | "school";
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
};

const FEATURES: { q: string[]; title: string; href: string; roles?: AppRole[] }[] = [
  { q: ["settings", "security", "password"], title: "Settings", href: "/settings" },
  { q: ["notification", "alerts"], title: "Notifications", href: "/notifications" },
  { q: ["material", "notes", "pdf"], title: "Materials", href: "/student/materials", roles: ["student"] },
  { q: ["result", "score", "grade"], title: "Results", href: "/student/results", roles: ["student"] },
  { q: ["exam", "cbt", "test"], title: "Examinations", href: "/student/examinations", roles: ["student"] },
  { q: ["monitor", "live", "integrity"], title: "Live monitoring", href: "/officer/live-monitor", roles: ["examination_officer", "school_admin"] },
  { q: ["approval", "approve"], title: "Approvals", href: "/officer/approvals", roles: ["examination_officer"] },
  { q: ["study", "orb"], title: "Study Orb", href: "/student/study", roles: ["student"] },
];

const RECENT_KEY = "d4_search_recent_v1";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  const t = q.trim();
  if (t.length < 2) return;
  const prev = loadRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
  localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...prev].slice(0, 8)));
}

export function GlobalSearchPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSessionUser();
  const role = (session?.role || "student") as AppRole;
  const schoolId = session?.schoolId ?? null;
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQ("");
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const out = await runSearch(term, role, schoolId, session?.userId ?? null);
          if (!cancelled) setHits(out);
        } catch {
          if (!cancelled) setHits([]);
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, open, role, schoolId, session?.userId]);

  function go(hit: SearchHit) {
    saveRecent(q);
    onClose();
    if (hit.href) {
      try {
        void nav({ to: hit.href as never });
      } catch {
        window.location.href = hit.href;
      }
    }
  }

  if (!open || typeof document === "undefined") return null;

  const grouped = useMemo(() => {
    const g: Record<string, SearchHit[]> = {};
    for (const h of hits) {
      (g[h.kind] ||= []).push(h);
    }
    return g;
  }, [hits]);

  const kindLabel: Record<string, string> = {
    course: "Courses",
    exam: "Examinations",
    student: "Students",
    teacher: "Teachers",
    material: "Materials",
    feature: "Features",
    school: "Schools",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex flex-col bg-[#0b1b3a] text-white"
      style={{ width: "100%", height: "100%", minHeight: "100vh" }}
      role="dialog"
      aria-modal
      aria-label="Search D4EXAM"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students, courses, examinations, materials…"
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-slate-500"
        />
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close search">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {q.trim().length < 2 ? (
          <div className="space-y-6">
            {recent.length ? (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Recent</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQ(r)}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Suggested</p>
              <div className="grid gap-2">
                {FEATURES.filter((f) => !f.roles || f.roles.includes(role)).map((f) => (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => {
                      onClose();
                      try {
                        void nav({ to: f.href as never });
                      } catch {
                        window.location.href = f.href;
                      }
                    }}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
                  >
                    <ClipboardList className="h-4 w-4 text-blue-300" />
                    <span className="font-semibold">{f.title}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : hits.length === 0 && !busy ? (
          <p className="py-12 text-center text-sm text-slate-400">No results for “{q.trim()}”</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([kind, list]) => (
              <section key={kind}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{kindLabel[kind] || kind}</p>
                <div className="grid gap-2">
                  {list.map((h) => (
                    <button
                      key={`${h.kind}-${h.id}`}
                      type="button"
                      onClick={() => go(h)}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left hover:bg-white/10"
                    >
                      <HitIcon kind={h.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{h.title}</p>
                        {h.subtitle ? <p className="mt-0.5 text-sm text-slate-300">{h.subtitle}</p> : null}
                        {h.meta ? <p className="mt-1 text-xs text-slate-400">{h.meta}</p> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function HitIcon({ kind }: { kind: SearchHit["kind"] }) {
  const cls = "h-5 w-5 shrink-0 text-blue-300 mt-0.5";
  if (kind === "course") return <BookOpen className={cls} />;
  if (kind === "exam") return <ClipboardList className={cls} />;
  if (kind === "student") return <GraduationCap className={cls} />;
  if (kind === "teacher") return <Users className={cls} />;
  if (kind === "material") return <FileText className={cls} />;
  if (kind === "school") return <Building2 className={cls} />;
  return <Shield className={cls} />;
}

async function runSearch(
  term: string,
  role: AppRole,
  schoolId: string | null,
  userId: string | null,
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const like = `%${term.replace(/%/g, "")}%`;

  // Features
  for (const f of FEATURES) {
    if (f.roles && !f.roles.includes(role)) continue;
    if (f.q.some((k) => term.toLowerCase().includes(k) || k.includes(term.toLowerCase()))) {
      hits.push({ id: f.href, kind: "feature", title: f.title, href: f.href });
    }
  }

  if (role === "super_admin") {
    const { data: schools } = await supabase
      .from("schools")
      .select("id, name")
      .ilike("name", like)
      .limit(8);
    for (const s of schools ?? []) {
      hits.push({
        id: s.id,
        kind: "school",
        title: String(s.name || "School"),
        subtitle: undefined,
        href: `/super-admin/schools`,
      });
    }
  }

  if (schoolId && role !== "student") {
    const { data: courses } = await supabase
      .from("courses")
      .select("id, code, name, department_id")
      .eq("school_id", schoolId)
      .or(`code.ilike.${like},name.ilike.${like}`)
      .limit(10);
    for (const c of courses ?? []) {
      hits.push({
        id: c.id,
        kind: "course",
        title: `${c.code || ""} — ${c.name || "Course"}`.trim(),
        subtitle: "Course",
        href: role === "teacher" ? `/teacher/courses` : role === "examination_officer" ? `/officer/live-monitor` : `/school-admin/courses`,
      });
    }

    const { data: exams } = await supabase
      .from("examinations")
      .select("id, title, status, duration_minutes, courses(code, name)")
      .eq("school_id", schoolId)
      .or(`title.ilike.${like}`)
      .limit(10);
    for (const e of exams ?? []) {
      const course = Array.isArray(e.courses) ? e.courses[0] : e.courses;
      hits.push({
        id: e.id,
        kind: "exam",
        title: String(e.title || "Examination"),
        subtitle: course ? `${(course as { code?: string }).code || ""} ${(course as { name?: string }).name || ""}`.trim() : undefined,
        meta: `Status: ${e.status || "—"} · ${e.duration_minutes ?? "—"} min`,
        href: role === "examination_officer" ? `/officer/live-monitor` : `/teacher/examinations`,
      });
    }

    if (role === "school_admin" || role === "examination_officer" || role === "super_admin") {
      const { data: students } = await supabase
        .from("students")
        .select("id, matric_number, student_id, full_name")
        .eq("school_id", schoolId)
        .or(`matric_number.ilike.${like},student_id.ilike.${like},full_name.ilike.${like}`)
        .limit(10);
      for (const s of students ?? []) {
        hits.push({
          id: s.id,
          kind: "student",
          title: String(s.full_name || s.matric_number || "Student"),
          subtitle: s.matric_number ? `Matric: ${s.matric_number}` : s.student_id || undefined,
          href: `/officer/live-monitor`,
        });
      }
    }
  }

  if (schoolId && role === "student") {
    const { data: courses } = await supabase
      .from("courses")
      .select("id, code, name")
      .eq("school_id", schoolId)
      .or(`code.ilike.${like},name.ilike.${like}`)
      .limit(8);
    for (const c of courses ?? []) {
      hits.push({
        id: c.id,
        kind: "course",
        title: `${c.code || ""} — ${c.name || ""}`.trim(),
        subtitle: "Your course search",
        href: `/student/materials`,
      });
    }
    const { data: exams } = await supabase
      .from("examinations")
      .select("id, title, status")
      .eq("school_id", schoolId)
      .or(`title.ilike.${like}`)
      .limit(8);
    for (const e of exams ?? []) {
      hits.push({
        id: e.id,
        kind: "exam",
        title: String(e.title || "Examination"),
        meta: `Status: ${e.status || "—"}`,
        href: `/student/examinations`,
      });
    }
  }

  void userId;
  return hits.slice(0, 40);
}
