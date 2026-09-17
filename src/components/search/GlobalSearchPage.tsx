/**
 * Full-screen / panel role-aware D4EXAM search (white UI).
 * Queries scoped by role + school_id. Never throws to parent error boundary.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Bell,
  Settings,
  Sparkles,
  Monitor,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser, type AppRole } from "@/lib/session";

type SearchHit = {
  id: string;
  kind: "course" | "exam" | "student" | "teacher" | "material" | "feature" | "school" | "action";
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
};

const FEATURES: {
  q: string[];
  title: string;
  href: string;
  roles?: AppRole[];
  icon?: "settings" | "bell" | "materials" | "results" | "exams" | "monitor" | "study" | "support" | "courses";
}[] = [
  { q: ["settings", "security", "password"], title: "Settings", href: "/settings", icon: "settings" },
  { q: ["notification", "alerts"], title: "Notifications", href: "/notifications", icon: "bell" },
  { q: ["material", "notes", "pdf"], title: "Materials", href: "/student/materials", roles: ["student"], icon: "materials" },
  { q: ["result", "score", "grade"], title: "Results", href: "/student/results", roles: ["student"], icon: "results" },
  { q: ["exam", "cbt", "test"], title: "Examinations", href: "/student/examinations", roles: ["student"], icon: "exams" },
  {
    q: ["monitor", "live", "integrity"],
    title: "Live monitoring",
    href: "/officer/live-monitor",
    roles: ["examination_officer", "school_admin"],
    icon: "monitor",
  },
  { q: ["approval", "approve"], title: "Approvals", href: "/officer/approvals", roles: ["examination_officer"], icon: "exams" },
  { q: ["study", "orb"], title: "Study Orb", href: "/student/study", roles: ["student"], icon: "study" },
  { q: ["contact", "support", "help"], title: "Contact & Support", href: "/support", icon: "support" },
  { q: ["course", "courses"], title: "Courses", href: "/student", roles: ["student"], icon: "courses" },
];

const SUGGESTED_CHIPS: { label: string; roles?: AppRole[] }[] = [
  { label: "Students", roles: ["school_admin", "examination_officer", "super_admin", "teacher"] },
  { label: "Teachers", roles: ["school_admin", "examination_officer", "super_admin"] },
  { label: "Examinations" },
  { label: "Courses" },
  { label: "Materials", roles: ["student", "teacher", "school_admin"] },
  { label: "Live exams", roles: ["examination_officer", "school_admin", "super_admin"] },
  { label: "Results", roles: ["student", "teacher", "school_admin", "examination_officer"] },
  { label: "Reports", roles: ["school_admin", "examination_officer", "super_admin"] },
];

const RECENT_KEY = "d4_search_recent_v1";

const KIND_ORDER = ["course", "exam", "student", "teacher", "material", "school", "feature", "action"] as const;

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
  try {
    const t = q.trim();
    if (t.length < 2) return;
    const prev = loadRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
    localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...prev].slice(0, 8)));
  } catch {
    /* ignore */
  }
}

function clearRecent() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}

function safeGo(href: string | undefined) {
  if (!href) return;
  try {
    window.location.assign(href);
  } catch {
    try {
      window.location.href = href;
    } catch {
      /* ignore */
    }
  }
}

function FeatureIcon({ name }: { name?: string }) {
  const cls = "h-4 w-4 shrink-0 text-blue-600";
  if (name === "settings") return <Settings className={cls} />;
  if (name === "bell") return <Bell className={cls} />;
  if (name === "materials") return <FileText className={cls} />;
  if (name === "results") return <ClipboardList className={cls} />;
  if (name === "exams") return <ClipboardList className={cls} />;
  if (name === "monitor") return <Monitor className={cls} />;
  if (name === "study") return <Sparkles className={cls} />;
  if (name === "support") return <Shield className={cls} />;
  if (name === "courses") return <BookOpen className={cls} />;
  return <LayoutGrid className={cls} />;
}

export function GlobalSearchPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSessionUser();
  const role = (session?.role || "student") as AppRole;
  const schoolId = session?.schoolId ?? null;
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
    setQ("");
    setHits([]);
    setErr(null);
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
      setErr(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setErr(null);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const out = await runSearch(term, role, schoolId);
          if (!cancelled) setHits(out);
        } catch (e) {
          console.warn("[search]", e);
          if (!cancelled) {
            setHits([]);
            setErr("Search failed. Try a different term.");
          }
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, open, role, schoolId]);

  function go(hit: SearchHit) {
    saveRecent(q);
    onClose();
    safeGo(hit.href);
  }

  const grouped = useMemo(() => {
    const g: Record<string, SearchHit[]> = {};
    for (const h of hits) {
      (g[h.kind] ||= []).push(h);
    }
    return g;
  }, [hits]);

  const orderedKinds = useMemo(() => {
    const keys = Object.keys(grouped);
    return keys.sort((a, b) => {
      const ia = KIND_ORDER.indexOf(a as (typeof KIND_ORDER)[number]);
      const ib = KIND_ORDER.indexOf(b as (typeof KIND_ORDER)[number]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [grouped]);

  const kindLabel: Record<string, string> = {
    course: "Courses",
    exam: "Examinations",
    student: "Students",
    teacher: "Teachers",
    material: "Materials",
    feature: "Features",
    action: "Actions",
    school: "Schools",
  };

  const suggested = useMemo(
    () => SUGGESTED_CHIPS.filter((s) => !s.roles || s.roles.includes(role)),
    [role],
  );

  const roleFeatures = useMemo(
    () => FEATURES.filter((f) => !f.roles || f.roles.includes(role)),
    [role],
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  try {
    return createPortal(
      <div
        className="fixed inset-0 z-[2147483000] flex justify-end sm:items-stretch"
        role="dialog"
        aria-modal="true"
        aria-label="Search D4EXAM"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {/* Backdrop — desktop keeps app visible but dimmed */}
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          aria-label="Close search"
          onClick={onClose}
        />

        {/* Panel: full-screen on mobile, large white panel on desktop */}
        <div
          className="relative flex h-full w-full flex-col bg-white text-slate-900 shadow-2xl sm:ml-auto sm:max-w-[440px] sm:border-l sm:border-slate-200 md:max-w-[520px]"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              autoFocus
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search D4EXAM…"
              className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
              autoComplete="off"
              autoCorrect="off"
            />
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : null}
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {err ? (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
                {err}
              </p>
            ) : null}

            {q.trim().length < 2 ? (
              <div className="space-y-6">
                {recent.length ? (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Recent searches
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          clearRecent();
                          setRecent([]);
                        }}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setQ(r)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                        >
                          <Search className="h-3 w-3 text-slate-400" />
                          {r}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Suggested searches
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {suggested.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setQ(s.label)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-800 shadow-sm hover:border-blue-200 hover:bg-blue-50/60"
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
                          <Search className="h-3.5 w-3.5" />
                        </span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Quick links
                  </p>
                  <div className="grid gap-1.5">
                    {roleFeatures.map((f) => (
                      <button
                        key={f.title}
                        type="button"
                        onClick={() => {
                          onClose();
                          safeGo(f.href);
                        }}
                        className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left hover:border-slate-200 hover:bg-slate-50"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50">
                          <FeatureIcon name={f.icon} />
                        </span>
                        <span className="min-w-0 flex-1 font-semibold text-slate-800">{f.title}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </button>
                    ))}
                  </div>
                </section>

                <p className="pt-2 text-center text-[11px] text-slate-400">
                  Press <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> to close
                </p>
              </div>
            ) : busy && hits.length === 0 ? (
              <div className="space-y-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Searching…</p>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                  >
                    <div className="h-9 w-9 rounded-xl bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-2/3 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hits.length === 0 && !busy ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100">
                  <Search className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-base font-semibold text-slate-800">No results for “{q.trim()}”</p>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Try a course code, exam name, matric number, or a feature like Materials.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {busy ? (
                  <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> Updating results…
                  </p>
                ) : null}
                {orderedKinds.map((kind) => {
                  const list = grouped[kind] || [];
                  if (!list.length) return null;
                  return (
                    <section key={kind}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {kindLabel[kind] || kind}{" "}
                        <span className="font-normal text-slate-300">({list.length})</span>
                      </p>
                      <div className="grid gap-2">
                        {list.map((h) => (
                          <button
                            key={`${h.kind}-${h.id}`}
                            type="button"
                            onClick={() => go(h)}
                            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                          >
                            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50">
                              <HitIcon kind={h.kind} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900">{h.title}</p>
                              {h.subtitle ? (
                                <p className="mt-0.5 text-sm text-slate-500">{h.subtitle}</p>
                              ) : null}
                              {h.meta ? (
                                <p className="mt-1 text-xs text-slate-400">{h.meta}</p>
                              ) : null}
                            </div>
                            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" />
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  } catch (e) {
    console.error("[GlobalSearchPage]", e);
    return null;
  }
}

function HitIcon({ kind }: { kind: SearchHit["kind"] }) {
  const cls = "h-4 w-4 text-blue-600";
  if (kind === "course") return <BookOpen className={cls} />;
  if (kind === "exam") return <ClipboardList className={cls} />;
  if (kind === "student") return <GraduationCap className={cls} />;
  if (kind === "teacher") return <Users className={cls} />;
  if (kind === "material") return <FileText className={cls} />;
  if (kind === "school") return <Building2 className={cls} />;
  if (kind === "action") return <LayoutGrid className={cls} />;
  return <Shield className={cls} />;
}

async function runSearch(term: string, role: AppRole, schoolId: string | null): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const safe = term.replace(/[%_,.()]/g, " ").trim();
  if (safe.length < 2) return hits;
  const like = `%${safe}%`;

  for (const f of FEATURES) {
    if (f.roles && !f.roles.includes(role)) continue;
    if (f.q.some((k) => safe.toLowerCase().includes(k) || k.includes(safe.toLowerCase()))) {
      hits.push({ id: f.href, kind: "feature", title: f.title, href: f.href });
    }
  }

  try {
    if (role === "super_admin") {
      const { data: schools } = await supabase.from("schools").select("id, name").ilike("name", like).limit(8);
      for (const s of schools ?? []) {
        hits.push({
          id: String(s.id),
          kind: "school",
          title: String(s.name || "School"),
          href: "/super-admin",
        });
      }
    }
  } catch (e) {
    console.warn("[search] schools", e);
  }

  if (!schoolId) return hits.slice(0, 40);

  try {
    if (role !== "student") {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, code, name")
        .eq("school_id", schoolId)
        .or(`code.ilike.${like},name.ilike.${like}`)
        .limit(10);
      for (const c of courses ?? []) {
        hits.push({
          id: String(c.id),
          kind: "course",
          title: `${c.code || ""} — ${c.name || "Course"}`.trim(),
          subtitle: "Course",
          href:
            role === "teacher"
              ? "/teacher"
              : role === "examination_officer"
                ? "/officer/live-monitor"
                : "/admin",
        });
      }
    }
  } catch (e) {
    console.warn("[search] courses", e);
  }

  try {
    const { data: exams } = await supabase
      .from("examinations")
      .select("id, title, status, duration_minutes")
      .eq("school_id", schoolId)
      .ilike("title", like)
      .limit(10);
    for (const e of exams ?? []) {
      hits.push({
        id: String(e.id),
        kind: "exam",
        title: String(e.title || "Examination"),
        meta: `Status: ${e.status || "—"} · ${e.duration_minutes ?? "—"} min`,
        href:
          role === "student"
            ? "/student/examinations"
            : role === "examination_officer"
              ? "/officer/live-monitor"
              : role === "teacher"
                ? "/teacher"
                : "/admin",
      });
    }
  } catch (e) {
    console.warn("[search] exams", e);
  }

  try {
    if (role === "school_admin" || role === "examination_officer" || role === "super_admin") {
      const { data: students } = await supabase
        .from("students")
        .select("id, matric_number, student_id, full_name")
        .eq("school_id", schoolId)
        .or(`matric_number.ilike.${like},student_id.ilike.${like},full_name.ilike.${like}`)
        .limit(10);
      for (const s of students ?? []) {
        hits.push({
          id: String(s.id),
          kind: "student",
          title: String(s.full_name || s.matric_number || "Student"),
          subtitle: s.matric_number ? `Matric: ${s.matric_number}` : s.student_id || undefined,
          href: "/officer/live-monitor",
        });
      }
    }
  } catch (e) {
    console.warn("[search] students", e);
  }

  return hits.slice(0, 40);
}
