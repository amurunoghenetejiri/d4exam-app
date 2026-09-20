/**
 * In-app role manuals — live guides with deep links into the app.
 */
import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, GraduationCap, Shield, Building2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ManualRole =
  | "student"
  | "teacher"
  | "examination_officer"
  | "school_admin"
  | "super_admin"
  | "generic";

type ManualLink = { label: string; to: string };
type ManualSection = {
  title: string;
  body: string[];
  links?: ManualLink[];
};

function ManualA({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to as never}
      className="font-semibold text-primary underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}

function sectionsFor(role: ManualRole): ManualSection[] {
  if (role === "student") {
    return [
      {
        title: "Getting started",
        body: [
          "Open D4EXAM and unlock with fingerprint (if enabled) or your app unlock password. This is separate from any school login password.",
          "After unlock you land on your Dashboard with shortcuts to exams, results, materials, and courses.",
        ],
        links: [
          { label: "Open Dashboard", to: "/student" },
          { label: "Settings", to: "/student/settings" },
        ],
      },
      {
        title: "Writing an examination (CBT)",
        body: [
          "Go to Examinations, find your paper, and tap Start or Continue when the window is open.",
          "The timer runs live. Answer questions, use Next/Previous, and review before Submit.",
          "If the teacher enabled a calculator, it appears in the exam environment only for that paper.",
          "Camera monitoring may show One face / No face / Multiple faces. Follow invigilation rules — leaving the app can create integrity events.",
          "On Submit, confirm unanswered questions. Time-up may auto-submit depending on exam rules.",
        ],
        links: [
          { label: "My Examinations", to: "/student/examinations" },
          { label: "Results", to: "/student/results" },
        ],
      },
      {
        title: "Materials & Study Help",
        body: [
          "Open Materials to read notes, assignments, and past questions shared with your courses.",
          "Cards show Teacher or Student as the uploader role (not personal names).",
          "Tap a material to open the full viewer (PDF, image, or text). Use Download or Share from the viewer menu.",
          "Study Help (students only) suggests related educational videos. Use Search inside Study Help for any topic. It needs internet; offline materials still open without new videos.",
        ],
        links: [{ label: "Learning Materials", to: "/student/materials" }],
      },
      {
        title: "Notifications & profile",
        body: [
          "Notifications list exam reminders, published results, and announcements.",
          "Profile shows your school identity as configured by admin. Update only fields your school allows.",
        ],
        links: [
          { label: "Notifications", to: "/student/notifications" },
          { label: "Profile", to: "/student/profile" },
        ],
      },
      {
        title: "Preferences that affect you",
        body: [
          "In Settings you can change interface language, time zone, appearance, compact lists, and reduced motion.",
          "Your name, course names, exam titles, and uploaded file content never change with language — only the app chrome does.",
        ],
        links: [{ label: "Open Settings", to: "/student/settings" }],
      },
    ];
  }

  if (role === "teacher") {
    return [
      {
        title: "Your workspace",
        body: [
          "Teachers manage courses assigned by School Admin: papers, security, materials, marking, and live monitoring for those courses only.",
        ],
        links: [
          { label: "Teacher Dashboard", to: "/teacher" },
          { label: "My Courses", to: "/teacher/courses" },
        ],
      },
      {
        title: "Question bank & examinations",
        body: [
          "Build questions in Question Bank, then create an examination with schedule, duration, and paper content.",
          "Set exam security: calculator mode, camera/face rules, tab/fullscreen rules, and threshold actions (warn / pause / terminate). Students cannot turn these off in their Settings.",
          "If your school requires approval, submit the exam for the Departmental Officer to approve before the window opens.",
        ],
        links: [
          { label: "Question Bank", to: "/teacher/question-bank" },
          { label: "Examinations", to: "/teacher/examinations" },
          { label: "Exam security defaults", to: "/teacher/exam-security" },
        ],
      },
      {
        title: "Live monitoring",
        body: [
          "When students write your course exams, open Live Exams / monitoring to see camera and screen tiles.",
          "Use pause, resume, warn, or terminate carefully — actions apply to the current attempt the student is writing now.",
          "Integrity events (no face, multiple faces, tab switches) help you invigilate; coordinate serious cases with the officer.",
        ],
        links: [
          { label: "Live exams", to: "/teacher/live-exams" },
          { label: "Integrity", to: "/teacher/integrity" },
        ],
      },
      {
        title: "Materials (My Materials)",
        body: [
          "You only see materials you uploaded. Upload PDF/image/document with course and type. Prefer original files so size stays accurate.",
          "Students see your uploads with a Teacher badge. Teachers do not get Study Help.",
        ],
        links: [{ label: "My Materials", to: "/teacher/materials" }],
      },
      {
        title: "Marking & results",
        body: [
          "Open Submissions and Marking for papers that need review. Objective items may auto-score.",
          "Publish according to your school workflow (officer/admin may control final release).",
        ],
        links: [
          { label: "Submissions", to: "/teacher/submissions" },
          { label: "Marking", to: "/teacher/marking" },
          { label: "Results", to: "/teacher/results" },
        ],
      },
      {
        title: "Settings",
        body: [
          "Language, time zone, appearance, compact tables, notifications, app unlock password, and fingerprint are under Settings. They never weaken exam security for students.",
        ],
        links: [{ label: "Settings", to: "/teacher/settings" }],
      },
    ];
  }

  if (role === "examination_officer") {
    return [
      {
        title: "Role overview",
        body: [
          "Departmental Officers approve exams, monitor live sessions for the department scope, review integrity, and oversee results communication.",
        ],
        links: [{ label: "Officer Dashboard", to: "/officer" }],
      },
      {
        title: "Approvals",
        body: [
          "Open Approvals to review teacher exam requests: schedule, paper settings, and security summary. Approve or reject with a clear reason when required.",
        ],
        links: [{ label: "Approvals", to: "/officer/approvals" }],
      },
      {
        title: "Live Monitor",
        body: [
          "Open Live Monitor before the exam window. Filter by level/course/exam when several cohorts write at once.",
          "Student cards show identity, timer, status, and live camera/screen when shared. Focus mode enlarges one student.",
          "Pause, resume, terminate, submit, and send warning must target the attempt the student is writing now — not an old finished paper.",
          "Treat face and tab events as operational signals; keep alerts from permanently blocking the grid.",
        ],
        links: [{ label: "Live Monitor", to: "/officer/live-monitor" }],
      },
      {
        title: "Integrity, results, audit",
        body: [
          "Integrity lists events by exam and student. Results oversee publication. Audit logs record critical actions such as approvals.",
        ],
        links: [
          { label: "Integrity", to: "/officer/integrity" },
          { label: "Results", to: "/officer/results" },
          { label: "Audit logs", to: "/officer/audit-logs" },
        ],
      },
      {
        title: "Messaging students",
        body: [
          "Use Post to students for cohort announcements. Prefer enabling integrity alerts in Settings on exam days.",
        ],
        links: [
          { label: "Post to students", to: "/officer/post-to-students" },
          { label: "Settings", to: "/officer/settings" },
        ],
      },
    ];
  }

  if (role === "school_admin" || role === "super_admin") {
    return [
      {
        title: "School setup order",
        body: [
          "Configure academic structure before bulk users: Faculties → Departments → Levels → Sessions → Semesters → Courses.",
          "Assign teachers to courses so they can create exams and materials.",
        ],
        links: [
          { label: "Faculties", to: "/admin/faculties" },
          { label: "Departments", to: "/admin/departments" },
          { label: "Levels", to: "/admin/levels" },
          { label: "Sessions", to: "/admin/sessions" },
          { label: "Semesters", to: "/admin/semesters" },
          { label: "Courses", to: "/admin/courses" },
          { label: "Structure overview", to: "/admin/structure" },
        ],
      },
      {
        title: "People",
        body: [
          "Add or import students (matric, department, level). Create teachers and departmental officers. Open a student record to adjust status.",
        ],
        links: [
          { label: "Students", to: "/admin/students" },
          { label: "Import students", to: "/admin/student-import" },
          { label: "Teachers", to: "/admin/teachers" },
          { label: "Officers", to: "/admin/officers" },
          { label: "Users", to: "/admin/users" },
        ],
      },
      {
        title: "Exams & results oversight",
        body: [
          "Teachers create papers; officers approve and monitor. Admins oversee school-wide examination lists, results publication, and reports.",
        ],
        links: [
          { label: "Examinations", to: "/admin/examinations" },
          { label: "Results", to: "/admin/results" },
          { label: "Reports", to: "/admin/reports" },
        ],
      },
      {
        title: "School identity & Settings",
        body: [
          "In Settings, set the official school name and logo (square PNG/JPG). Set time zone (e.g. Automatic — Africa/Lagos) so schedules display consistently.",
          "Language changes interface text only — not student names, course titles, or exam titles.",
        ],
        links: [{ label: "Admin Settings", to: "/admin/settings" }],
      },
    ];
  }

  return [
    {
      title: "D4EXAM help",
      body: [
        "Use Settings for language, notifications, app unlock, and offline storage. Contact support from Help & legal if you need assistance.",
      ],
      links: [],
    },
  ];
}

function roleMeta(role: ManualRole) {
  if (role === "student") return { title: "Student manual", icon: GraduationCap, color: "bg-emerald-100 text-emerald-800" };
  if (role === "teacher") return { title: "Teacher manual", icon: UserRound, color: "bg-blue-100 text-blue-800" };
  if (role === "examination_officer") return { title: "Officer manual", icon: Shield, color: "bg-violet-100 text-violet-800" };
  if (role === "school_admin" || role === "super_admin") return { title: "School Admin manual", icon: Building2, color: "bg-amber-100 text-amber-900" };
  return { title: "App manual", icon: BookOpen, color: "bg-slate-100 text-slate-800" };
}

export function RoleManual({ role, className }: { role: ManualRole; className?: string }) {
  const meta = roleMeta(role);
  const Icon = meta.icon;
  const sections = sectionsFor(role);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", meta.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900">{meta.title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Step-by-step guide for your role. Blue links open the real page inside D4EXAM. Course names, people names, and exam titles stay as entered — only the interface language changes in Settings.
          </p>
        </div>
      </div>

      {sections.map((s) => (
        <section key={s.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
          </div>
          <div className="space-y-2.5 px-4 py-3">
            {s.body.map((p) => (
              <p key={p.slice(0, 48)} className="text-sm leading-relaxed text-slate-600">
                {p}
              </p>
            ))}
            {s.links && s.links.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {s.links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to as never}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                    >
                      <ChevronRight className="h-4 w-4 shrink-0" />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

export function resolveManualRole(scope: string, sessionRole?: string | null): ManualRole {
  const s = `${scope} ${sessionRole || ""}`.toLowerCase();
  if (s.includes("student")) return "student";
  if (s.includes("teacher")) return "teacher";
  if (s.includes("officer") || s.includes("examination")) return "examination_officer";
  if (s.includes("super")) return "super_admin";
  if (s.includes("admin") || s.includes("school")) return "school_admin";
  return "generic";
}
