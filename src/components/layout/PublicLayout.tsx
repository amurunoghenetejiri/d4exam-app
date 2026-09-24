import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Watermark } from "@/components/brand/Watermark";
import { Button } from "@/components/ui/button";
import { isAppLikeShell } from "@/native/platform";
import { cn } from "@/lib/utils";
import { appNavigate } from "@/lib/app-navigate";
import { unlockUiSoon } from "@/lib/unlock-ui";

const links = [
  { to: "/features", label: "Features" },
  { to: "/school-application", label: "For Schools" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About Us" },
  { to: "/support", label: "Support" },
] as const;

const menuGroups = [
  {
    title: "Platform",
    items: [
      { to: "/features", label: "Features" },
      { to: "/pricing", label: "Pricing" },
      { to: "/school-application", label: "For Schools" },
    ],
  },
  {
    title: "Company",
    items: [
      { to: "/about", label: "About Us" },
      { to: "/support", label: "Support" },
      { to: "/privacy", label: "Privacy Policy" },
    ],
  },
] as const;

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const appShell = useMemo(() => {
    try {
      return isAppLikeShell();
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll only while menu open; always restore on unmount
  useEffect(() => {
    if (!open) {
      unlockUiSoon();
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      unlockUiSoon();
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    unlockUiSoon();
  }

  function goTo(to: string) {
    const path = to.startsWith("/") ? to : `/${to}`;
    setOpen(false);
    unlockUiSoon();
    // Prefer hash assignment first on WebView — most reliable, never freezes
    window.setTimeout(() => {
      try {
        const hash = `#${path}`;
        if (window.location.hash !== hash) {
          window.location.hash = hash;
        } else {
          appNavigate(path);
        }
      } catch {
        try {
          appNavigate(path);
        } catch {
          /* ignore */
        }
      }
      unlockUiSoon();
    }, 20);
  }

  const menuPortal =
    mounted && open
      ? createPortal(
          <div
            className="sa-mobile-menu fixed inset-0 z-[2147483000] flex flex-col bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            data-d4-public-menu="open" data-d4-app-menu="open"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100vw",
              height: "100vh",
              minHeight: "100dvh",
              backgroundColor: "#ffffff",
              zIndex: 2147483000,
              pointerEvents: "auto",
              isolation: "isolate",
              transform: "translateZ(0)",
              WebkitTransform: "translateZ(0)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
            >
              <Logo size="sm" wordmark />
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-slate-100 active:bg-slate-200"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>

            {/* Scrollable menu body — full height, solid white */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 py-5"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {menuGroups.map((g) => (
                <div key={g.title} className="mb-6">
                  <p className="mb-2 px-1 text-[0.7rem] font-bold uppercase tracking-wider text-primary">
                    {g.title}
                  </p>
                  <div className="flex flex-col gap-1">
                    {g.items.map((l) => (
                      <button
                        key={l.label}
                        type="button"
                        className="rounded-xl px-3 py-3.5 text-left text-base font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
                        onClick={() => goTo(l.to)}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-2 space-y-3 border-t border-slate-100 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
                <button
                  type="button"
                  onClick={() => goTo("/school-application")}
                  className={cn(
                    "inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground",
                    "hover:bg-primary/90 active:opacity-90",
                  )}
                >
                  Apply Now
                </button>
                <button
                  type="button"
                  onClick={() => goTo("/login")}
                  className={cn(
                    "inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800",
                    "hover:bg-slate-50 active:bg-slate-100",
                  )}
                >
                  Login
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-white">
      <Watermark opacity={0.1} size="xl" />

      <header className="d4-public-header fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6">
          <Link to="/" aria-label="D4EXAM home" className="shrink-0" onClick={() => unlockUiSoon()}>
            <span className="inline-flex lg:hidden">
              <Logo size="sm" wordmark />
            </span>
            <span className="hidden lg:inline-flex">
              <Logo size="md" />
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="rounded-md px-3 py-2 text-sm font-semibold text-primary/80 transition-colors hover:text-primary"
                activeProps={{ className: "text-primary" }}
                onClick={() => unlockUiSoon()}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Button variant="ghost" size="sm" className="font-semibold text-primary" asChild>
              <Link to="/login" onClick={() => unlockUiSoon()}>
                Login
              </Link>
            </Button>
            <Button size="sm" className="rounded-full px-5 font-semibold" asChild>
              <Link to="/school-application" onClick={() => unlockUiSoon()}>
                Apply Now
              </Link>
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="d4-public-menu relative z-[60] lg:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => {
              setOpen(true);
              unlockUiSoon();
            }}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {menuPortal}

      <div className="d4-public-header-spacer h-14 shrink-0 sm:h-[4.5rem]" aria-hidden />

      <main className="relative z-10 flex-1">{children}</main>

      {!appShell && (
        <footer className="relative z-10 border-t border-slate-200 bg-slate-50/95">
          <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
            <div>
              <Logo size="md" showTagline />
              <p className="mt-4 max-w-xs text-sm text-slate-600">
                Professional examination management for schools, colleges and universities worldwide.
              </p>
            </div>
            <FooterCol
              title="Platform"
              items={[
                { to: "/features", label: "Features" },
                { to: "/pricing", label: "Pricing" },
                { to: "/school-application", label: "For Schools" },
              ]}
            />
            <FooterCol
              title="Company"
              items={[
                { to: "/about", label: "About Us" },
                { to: "/support", label: "Support" },
                { to: "/privacy", label: "Privacy Policy" },
              ]}
            />
            <FooterCol title="Access" items={[{ to: "/login", label: "Login" }]} />
          </div>
          <div className="border-t border-slate-200">
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>© 2026 D4EXAM. All rights reserved.</p>
              <p>Smart. Secure. Seamless.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function FooterCol({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-bold text-primary">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className="text-sm text-slate-600 hover:text-primary" onClick={() => unlockUiSoon()}>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
