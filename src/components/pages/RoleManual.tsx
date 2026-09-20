/**
 * D4EXAM role-based full-screen Manual Guide — one section at a time with slide navigation.
 * Super Admin has no manual.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen, Search } from "lucide-react";
import { useSessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export type ManualRole =
  | "student"
  | "teacher"
  | "examination_officer"
  | "school_admin"
  | "super_admin"
  | "generic";

export type ManualSection = {
  id: string;
  title: string;
  intro: string;
  body: string[];
  bullets?: string[];
  warnings?: string[];
  whatYouCanDo?: string[];
};

function roleTitle(role: ManualRole): string {
  if (role === "examination_officer") return "Departmental Officer";
  if (role === "school_admin") return "School Admin";
  if (role === "teacher") return "Teacher";
  if (role === "student") return "Student";
  return "User";
}

/** Build sections from actual product behaviour — static offline-friendly content. */
export function sectionsFor(role: ManualRole): ManualSection[] {
  if (role === "school_admin") {
    return [
      { id: "start", title: "Getting Started", intro: "How to open D4EXAM and reach your School Admin workspace.", body: ["Open the D4EXAM app or website. After the splash screen, unlock with fingerprint if enabled, or use your app unlock password.", "Your school login is separate from the app lock password. Once unlocked, D4EXAM restores your session and loads the School Admin dashboard.", "Online mode syncs live data. Offline mode still opens the app (splash → unlock → dashboard) for cached views; actions that need the network wait until you are online."], bullets: ["Splash → unlock → dashboard", "Fingerprint or app password for lock", "Session restores after unlock"], whatYouCanDo: ["Open dashboard", "Open Settings for language, security, offline status"] },
      { id: "dash", title: "School Admin Dashboard", intro: "Your home overview of school activity.", body: ["The dashboard summarises students, teachers, officers, courses, examinations and notifications.", "Use the sidebar (desktop) or menu (mobile) to move between Students, Teachers, Officers, academic structure, Examinations, Results, Reports, Notifications, Profile and Settings.", "Quick actions and badges highlight items that need attention."], whatYouCanDo: ["Review school stats", "Open any module from the nav", "Check notifications"] },
      { id: "students", title: "Students", intro: "Manage student records for your school.", body: ["Open Students to search, filter and open a student profile (name, matric, department, level, session).", "Import students with the supported file formats listed in Help. Fix validation errors before re-importing.", "Keep matric numbers unique. Department and level must match your academic structure."], bullets: ["Search and filter", "Import bulk lists", "Edit student details where allowed"] },
      { id: "teachers", title: "Teachers", intro: "Teachers create papers for assigned courses only.", body: ["Add and manage teachers, assign courses, and ensure each teacher only sees their courses.", "Teachers cannot approve their own examinations — approval is for the Departmental Officer."] },
      { id: "officers", title: "Departmental Officers", intro: "Officers approve exams, monitor live CBT and release results.", body: ["Assign officers carefully. They can approve/reject exams, live-monitor students, review integrity, and release results for the school."] },
      { id: "structure", title: "Academic Structure", intro: "Faculties, departments, levels, courses, sessions and semesters.", body: ["Build structure top-down: Faculties → Departments → Levels → Courses.", "Academic sessions and semesters frame when courses and exams apply. Incorrect structure blocks student eligibility and course assignment."] },
      { id: "exams", title: "Examinations", intro: "School-wide view of examination status.", body: ["School Admin can view examinations and statuses (draft, pending approval, scheduled, published, completed).", "Teachers submit for approval; Departmental Officers approve, schedule and post. School Admin does not replace the officer approval workflow."] },
      { id: "results", title: "Results", intro: "School results and privacy.", body: ["View result status for the school. Students only see scores after official release by the Departmental Officer where that rule applies.", "Protect result privacy — never share credentials or export data outside authorised staff."] },
      { id: "reports", title: "Reports", intro: "School reports and exports available in Reports.", body: ["Open Reports for institutional summaries. Use filters carefully and only share outputs with authorised personnel."] },
      { id: "notifs", title: "Notifications", intro: "In-app notification centre.", body: ["Read examination, result and system alerts. Mark as read and act from deep links when provided."] },
      { id: "profile", title: "Profile", intro: "Your account profile.", body: ["Update display name and profile details allowed by the school. Keep contact information accurate for support."] },
      { id: "settings", title: "Settings", intro: "Preferences, security and offline storage.", body: ["Language, timezone, appearance, compact tables, reduced motion, notification preferences, app lock, biometric unlock, offline/storage status and account/session options live under Settings.", "Help & legal and this Manual Guide are under Help in Settings."] },
      { id: "security", title: "Security", intro: "Protect school data and accounts.", body: ["Never share passwords or unlock PINs. Log out on shared devices.", "D4EXAM uses role-based access and school isolation (RLS). UI visibility is not the security boundary — the server enforces permissions.", "Report suspicious activity to institutional IT and D4EXAM support."], warnings: ["Do not share service credentials or API keys", "Do not approve access for users outside your school"] },
    ];
  }

  if (role === "examination_officer") {
    return [
      { id: "start", title: "Getting Started", intro: "Open D4EXAM as a Departmental Officer.", body: ["Unlock the app, then open the Departmental Officer portal. Your dashboard shows pending approvals, live monitoring, active writers and posts to students.", "Use Live Monitor, Exam Approvals, Results Release, Integrity, Reports and Post to Students from the menu."] },
      { id: "dash", title: "Dashboard", intro: "Live officer overview.", body: ["Pending approvals should refresh live when teachers submit exams. The examinations list prioritises pending and changes-requested papers.", "Open Approvals or Live Monitor from the stat cards."] },
      { id: "approvals", title: "Examination Approvals", intro: "Review teacher-submitted papers.", body: ["Open Exam Approvals. Pending papers appear first. Open a paper to preview questions, security settings, schedule and duration.", "Actions: Approve, Request changes, or Reject (per available buttons). Request changes returns the paper to the teacher; it surfaces at the top of their list by recent update."] },
      { id: "preview", title: "Exam Preview", intro: "Inspect the paper before approval.", body: ["Preview validates structure, question count, calculator/camera/screen-share settings and schedule. Do not approve incomplete or misconfigured papers."] },
      { id: "schedule", title: "Scheduling & Publishing", intro: "When students may sit the paper.", body: ["After approval, ensure start and end times and duration are correct before the paper is posted/published to eligible students.", "Only published papers in an open window appear as Ready to start for students."] },
      { id: "live", title: "Live Monitor", intro: "Watch active writers in real time.", body: ["Live Monitor lists students currently writing. Cards show camera and screen-share status when enabled.", "Use Focus mode for a larger view of one student. Filter by level/course when multiple papers run."] },
      { id: "camera", title: "Camera & Screen Share", intro: "Proctoring feeds.", body: ["Camera shows the student face feed when required. Screen share shows the student device screen when enabled on the paper.", "Offline or blocked media shows clearly on the card — follow up with the student if feeds are missing."] },
      { id: "face", title: "Face Detection & Tab Violations", intro: "Integrity signals during CBT.", body: ["Face monitoring reports one face, no face, or multiple faces. Detection informs officers; tab-violation limits and consequences are configured on the paper.", "Tab violations are counted when the student leaves the exam surface according to the paper rules."] },
      { id: "pause", title: "Pause, Resume, Submit, Terminate", intro: "Officer actions on a live attempt.", body: ["Manual pause: student stays paused until you Resume — no automatic countdown for officer pause.", "Tab-violation pause: may use a configured duration; after the countdown the student may still need Resume depending on configuration. Answers stay preserved. The attempt end time remains authoritative — do not create duplicate attempts or reset timers.", "Submit / Terminate end the attempt for that student according to the action labels in Live Monitor."] },
      { id: "results", title: "Results Release", intro: "Official release to students.", body: ["Open Results Release. Student full name and matric should appear for each script.", "If the paper includes essay questions, wait until the teacher has marked essays before releasing. Held / not marked badges indicate status.", "Release all or individual results only when the school is ready for students to see scores."] },
      { id: "post", title: "Post to Students", intro: "Broadcast messages related to exams.", body: ["Use Post to Students for official notices. Prefer clear titles and actionable body text."] },
      { id: "integrity", title: "Integrity & Audit", intro: "Events and logs.", body: ["Integrity Review lists proctoring and rule events. Audit logs record approval and officer actions. Use them for investigations, not to reset legitimate attempts."] },
      { id: "settings", title: "Profile, Settings & Security", intro: "Account preferences.", body: ["Profile and Settings match other roles: language, appearance, app lock, biometric, offline status.", "Never share unlock credentials. Log out on shared devices."] },
    ];
  }

  if (role === "teacher") {
    return [
      { id: "start", title: "Getting Started", intro: "Teacher portal basics.", body: ["Unlock D4EXAM and open the Teacher portal. You only see courses assigned to you.", "Build questions in the Question Bank, create examinations, submit for officer approval, then monitor and mark."] },
      { id: "courses", title: "Courses", intro: "Assigned courses only.", body: ["My Courses lists papers you teach. Question banks and exams are scoped to these courses."] },
      { id: "bank", title: "Question Bank", intro: "Create and manage questions.", body: ["Add MCQ, true/false, essay/short answer and related types supported by your school.", "Import when available. Keep marks and correct answers accurate — objective items auto-score on submit."] },
      { id: "create-exam", title: "Creating Examinations", intro: "Build a paper from your bank.", body: ["Create an examination: title, type, duration, instructions.", "Optional: pick specific bank questions for the paper, then set how many questions each student answers (random draw from your selection).", "Set start and end times with the schedule picker (day, month, year, hour, minute, second). End time is not auto-filled."] },
      { id: "security", title: "Exam Security", intro: "Defaults and per-paper rules.", body: ["Configure fullscreen, tab monitoring limits and consequences, camera, face monitoring, microphone, screen share mode, calculator type.", "Face monitoring detects status; tab violations use limits and consequences. Save defaults under Exam Security so new papers inherit them."] },
      { id: "submit", title: "Submit for Approval", intro: "Teachers cannot approve their own exams.", body: ["Submit the paper for Departmental Officer approval. Track status: draft, pending approval, changes requested, approved, scheduled, published.", "If the officer requests changes, the paper returns for edits — update and resubmit."] },
      { id: "live", title: "Live Exams & Monitoring", intro: "Watch students on your papers.", body: ["Live Monitor (teacher) focuses on exams you created or are assigned to. Camera and integrity signals follow the same model as officers for those papers."] },
      { id: "marking", title: "Marking & Submissions", intro: "Essay and theory scripts.", body: ["Objective items are auto-marked. Essay/short-answer scripts appear in Marking Center for papers that include them.", "After marking, results wait for officer release when school policy requires it."] },
      { id: "results", title: "Results / Exam Analysis", intro: "Performance for your courses.", body: ["Open Results / Exam Analysis, select an examination, and review participation, pass/fail rates and score ranges."] },
      { id: "materials", title: "Materials", intro: "Course materials and Study Help.", body: ["Upload materials for your courses. Students can view, download and use Study Help where enabled."] },
      { id: "settings", title: "Profile, Settings & Security", intro: "Account and device security.", body: ["Use Settings for preferences and app lock. Never share passwords. Log out on shared devices."] },
    ];
  }

  if (role === "student") {
    return [
      { id: "start", title: "Getting Started", intro: "Open D4EXAM as a student.", body: ["Launch the app or site. After splash, unlock with fingerprint if enabled, or your app unlock password.", "You land on the Dashboard with exams, results, materials and courses."] },
      { id: "login", title: "Login & App Lock", intro: "School login vs app unlock.", body: ["School credentials sign you into D4EXAM. App lock (fingerprint or password) protects the session when you leave and return.", "If biometrics are unavailable, use the password path only."] },
      { id: "dash", title: "Dashboard", intro: "Ready to start and results.", body: ["Ready to start shows only exams you can start now or continue with time remaining. Time-up papers are not listed there — they are submitted and appear under history/results.", "Continue shows a live green countdown of time left. Start opens a new attempt when the window is open."] },
      { id: "exams", title: "Examinations & Eligibility", intro: "Which papers you can sit.", body: ["Only officer-published exams for your school, department and level in an open time window are available.", "Writing an examination requires a network connection where D4EXAM requires online CBT."] },
      { id: "start-exam", title: "Starting an Examination", intro: "Enter the CBT environment.", body: ["Tap Start (or the green countdown to continue). Grant camera/microphone/screen-share if the paper requires them.", "Stay in fullscreen when lockdown is enabled. The timer is authoritative."] },
      { id: "cbt", title: "Answering Questions", intro: "CBT tools.", body: ["Navigate with question numbers, Next and Previous. Flag items for review if available.", "Essay boxes accept typed answers; paste is blocked. Calculator opens only if enabled for the paper.", "Submit when finished — you cannot change answers after submit."] },
      { id: "integrity", title: "Rules, Face & Tab Monitoring", intro: "Integrity during the paper.", body: ["Face monitoring may show one face / no face / multiple faces. Follow invigilator instructions.", "Leaving the exam tab or app may count as a tab violation per paper rules and can pause your attempt."] },
      { id: "pause", title: "Pause & Connectivity", intro: "If the exam pauses or network drops.", body: ["Officer pause or rule-based pause may block answering until resume or countdown ends. Your answers remain saved.", "If the network drops, reconnect to continue and submit. Do not create a second attempt."] },
      { id: "results", title: "Results", intro: "After the paper.", body: ["Submitted attempts appear in history. Scores and grades show when the officer releases results.", "Open a result for breakdown when published."] },
      { id: "materials", title: "Materials & Study Help", intro: "Learning resources.", body: ["Open Materials for course files. View PDFs and documents in the viewer, download or share when allowed.", "Study Help can suggest related videos where configured."] },
      { id: "settings", title: "Profile, Settings, Offline & Security", intro: "Your account.", body: ["Update profile details allowed by the school. Settings include language, appearance, app lock and offline status.", "Offline mode opens the app for cached content; starting/writing exams still requires online where the platform requires it.", "Never share your password or unlock credentials."] },
    ];
  }

  return [
    { id: "generic", title: "D4EXAM", intro: "Open Settings for role-specific help when signed in as School Admin, Departmental Officer, Teacher or Student.", body: ["This account type does not use a dedicated interactive manual."] },
  ];
}

export function resolveManualRole(scope: string, sessionRole?: string | null): ManualRole {
  const s = `${scope} ${sessionRole || ""}`.toLowerCase();
  if (s.includes("super")) return "super_admin";
  if (s.includes("student")) return "student";
  if (s.includes("teacher")) return "teacher";
  if (s.includes("officer") || s.includes("examination")) return "examination_officer";
  if (s.includes("admin") || s.includes("school")) return "school_admin";
  return "generic";
}

export function RoleManual({
  role,
  fullName,
}: {
  role: ManualRole;
  fullName?: string | null;
}) {
  const { data: session } = useSessionUser();
  const name = (fullName || session?.fullName || "").trim() || "there";
  const title = roleTitle(role);
  const sections = useMemo(() => sectionsFor(role), [role]);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev" | "none">("none");
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.intro.toLowerCase().includes(q) ||
        s.body.some((b) => b.toLowerCase().includes(q)) ||
        (s.bullets || []).some((b) => b.toLowerCase().includes(q)),
    );
  }, [sections, query]);

  const total = filtered.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const current = filtered[safeIndex] ?? filtered[0];

  useEffect(() => {
    setIndex(0);
  }, [query, role]);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [safeIndex, reduceMotion]);

  const go = useCallback(
    (next: number, d: "next" | "prev") => {
      if (next < 0 || next >= total) return;
      setDir(d);
      setIndex(next);
      window.setTimeout(() => setDir("none"), reduceMotion ? 0 : 280);
    },
    [total, reduceMotion],
  );

  if (role === "super_admin") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        Manual Guide is not available for Super Admin accounts.
      </div>
    );
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No manual sections match your search.
      </div>
    );
  }

  const isFirst = safeIndex <= 0;
  const isLast = safeIndex >= total - 1;

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Personalized header */}
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#0b1b3a] to-[#122548] px-4 py-4 text-white shadow-sm sm:px-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <BookOpen className="h-5 w-5 text-sky-200" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">Hello, {name}</p>
            <p className="text-sm font-semibold text-sky-200/95">{title}</p>
            <p className="mt-1 text-xs text-sky-100/80">
              D4EXAM Manual Guide — your personalized guide to using D4EXAM as a {title}.
            </p>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-200/70" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manual topics…"
            className="h-10 w-full rounded-xl border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-sky-100/50 outline-none focus:border-sky-300/50"
            aria-label="Search manual topics"
          />
        </div>
      </header>

      {/* Progress */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-bold tabular-nums text-slate-500">
          {safeIndex + 1} / {total}
        </p>
        <div className="flex flex-wrap justify-end gap-1" aria-hidden>
          {filtered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i, i > safeIndex ? "next" : "prev")}
              className={cn(
                "h-2 w-2 rounded-full transition",
                i === safeIndex ? "bg-primary scale-125" : "bg-slate-300 hover:bg-slate-400",
              )}
              aria-label={`Go to section ${i + 1}: ${s.title}`}
            />
          ))}
        </div>
      </div>

      {/* Floating edge arrows — desktop / large screens */}
      <button
        type="button"
        aria-label="Previous manual section"
        disabled={isFirst}
        onClick={() => go(safeIndex - 1, "prev")}
        className={cn(
          "fixed left-2 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-30 lg:grid",
          "xl:left-[max(0.5rem,calc(50%-28rem))]",
        )}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        aria-label="Next manual section"
        disabled={isLast}
        onClick={() => go(safeIndex + 1, "next")}
        className={cn(
          "fixed right-2 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-30 lg:grid",
          "xl:right-[max(0.5rem,calc(50%-28rem))]",
        )}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* ONE large panel */}
      <div
        ref={panelRef}
        className={cn(
          "max-h-[min(70dvh,36rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:max-h-[min(72dvh,40rem)] sm:p-6",
          !reduceMotion && dir === "next" && "animate-in fade-in slide-in-from-right-4 duration-300",
          !reduceMotion && dir === "prev" && "animate-in fade-in slide-in-from-left-4 duration-300",
        )}
        key={current.id + String(safeIndex)}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
          Section {safeIndex + 1}
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{current.title}</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">{current.intro}</p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
          {current.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {current.bullets && current.bullets.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Key points</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
              {current.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {current.whatYouCanDo && current.whatYouCanDo.length > 0 ? (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-sky-800">What you can do here</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-sky-950">
              {current.whatYouCanDo.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {current.warnings && current.warnings.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Important</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-950">
              {current.warnings.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Bottom Previous / Next */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => go(safeIndex - 1, "prev")}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 shadow-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => go(safeIndex + 1, "next")}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-bold text-white shadow-sm disabled:opacity-40"
        >
          {isLast ? "Finish Guide" : "Next"} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
