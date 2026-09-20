import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Monitor } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  adminNav,
  officerNav,
  studentNav,
  superAdminNav,
  teacherNav,
} from "@/components/navigation/navConfig";
import type { RoleConfig } from "@/components/navigation/navConfig";
import { initials, useSessionUser } from "@/lib/session";

function RoleShell({ config, children }: { config: RoleConfig; children: ReactNode }) {
  const { data: user } = useSessionUser();

  return (
    <AppShell
      config={config}
      user={{
        name: user?.fullName ?? "…",
        avatar: initials(user?.fullName ?? ""),
        subtitle: user?.identifier ?? user?.schoolName ?? "",
      }}
    >
      {children}
    </AppShell>
  );
}

/** CBT exam must be distraction-free: no sidebar, top bar, or bottom nav. */
export function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isExamMode = pathname.startsWith("/student/exam/");

  if (isExamMode) {
    return <>{children}</>;
  }

  return <RoleShell config={studentNav}>{children}</RoleShell>;
}

export function TeacherLayout({ children }: { children: ReactNode }) {
  return <RoleShell config={teacherNav}>{children}</RoleShell>;
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleShell config={adminNav}>{children}</RoleShell>;
}

export function OfficerLayout({ children }: { children: ReactNode }) {
  return <RoleShell config={officerNav}>{children}</RoleShell>;
}

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleShell config={superAdminNav}>
      <SuperAdminDesktopShell>{children}</SuperAdminDesktopShell>
    </RoleShell>
  );
}

/** Mobile ↔ desktop viewport toggle for Super Admin only (does not affect other roles). */
function SuperAdminDesktopShell({ children }: { children: ReactNode }) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("d4_sa_desktop_view");
      if (v === "1") setDesktop(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("d4_sa_desktop_view", desktop ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (desktop) {
      root.classList.add("sa-desktop-view");
      // Force a desktop-like min width so layout expands on phones
      root.style.setProperty("--sa-desktop-min", "1100px");
    } else {
      root.classList.remove("sa-desktop-view");
      root.style.removeProperty("--sa-desktop-min");
    }
    return () => {
      root.classList.remove("sa-desktop-view");
      root.style.removeProperty("--sa-desktop-min");
    };
  }, [desktop]);

  return (
    <div
      className={desktop ? "min-w-[1100px] origin-top-left" : undefined}
      style={desktop ? { minWidth: "1100px" } : undefined}
    >
      <button
        type="button"
        onClick={() => setDesktop((v) => !v)}
        title={desktop ? "Switch to mobile view" : "Switch to desktop view"}
        aria-pressed={desktop}
        className="fixed bottom-20 right-3 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 md:bottom-6 md:right-6"
      >
        <Monitor className="h-5 w-5" aria-hidden />
        <span className="sr-only">{desktop ? "Mobile view" : "Desktop view"}</span>
      </button>
      {children}
    </div>
  );
}
