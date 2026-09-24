/**
 * SPA-safe navigation for D4EXAM Capacitor Android app.
 * Always uses hash routes (#/path) so the WebView never leaves the bundled index.html.
 */

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const ua = navigator.userAgent || "";
    return (
      Boolean(cap?.isNativePlatform?.()) ||
      (/; wv\)/i.test(ua) && /Android/i.test(ua)) ||
      /Capacitor/i.test(ua) ||
      Boolean((window as unknown as { __D4_FORCE_HASH__?: boolean }).__D4_FORCE_HASH__)
    );
  } catch {
    return false;
  }
}

/** App repo always prefers hash (bundled SPA). */
function shouldUseHash(): boolean {
  if (typeof window === "undefined") return true;
  if (window.location.hash.startsWith("#/")) return true;
  if ((window as unknown as { __D4_FORCE_HASH__?: boolean }).__D4_FORCE_HASH__) return true;
  if (isNativeApp()) return true;
  // App product is hash-first even in browser preview of the APK shell
  return true;
}

function normalizePath(path: string): string {
  let p = (path || "/").trim() || "/";
  // Strip accidental hash / origin
  try {
    if (p.includes("://")) {
      const u = new URL(p);
      p = u.pathname || "/";
    }
  } catch {
    /* ignore */
  }
  if (p.startsWith("#")) p = p.slice(1);
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

type D4Router = {
  navigate?: (opts: { to: string; replace?: boolean }) => Promise<unknown> | unknown;
  history?: { push?: (p: string) => void; replace?: (p: string) => void };
};

function getRouter(): D4Router | null {
  if (typeof window === "undefined") return null;
  try {
    return ((window as unknown as { __D4_ROUTER?: D4Router }).__D4_ROUTER as D4Router) || null;
  } catch {
    return null;
  }
}

function unlockAfterNav(): void {
  try {
    void import("@/lib/unlock-ui").then((m) => m.unlockUi());
  } catch {
    /* ignore */
  }
}

/** Push a client route (hash-aware). Never does a full document load for internal paths. */
export function appNavigate(path: string): void {
  const clean = normalizePath(path);
  if (typeof window === "undefined") return;

  const router = getRouter();
  if (router?.navigate) {
    try {
      void Promise.resolve(router.navigate({ to: clean, replace: false })).finally(unlockAfterNav);
      return;
    } catch {
      /* fall through */
    }
  }
  if (router?.history?.push) {
    try {
      router.history.push(clean);
      unlockAfterNav();
      return;
    } catch {
      /* fall through */
    }
  }

  if (shouldUseHash()) {
    const next = `#${clean}`;
    if (window.location.hash === next) {
      try {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } catch {
        window.location.hash = next;
      }
    } else {
      window.location.hash = next;
    }
    unlockAfterNav();
    return;
  }

  try {
    window.history.pushState({}, "", clean);
    window.dispatchEvent(new PopStateEvent("popstate"));
    unlockAfterNav();
  } catch {
    window.location.hash = `#${clean}`;
    unlockAfterNav();
  }
}

/** Replace current route (hash-aware). */
export function appReplace(path: string): void {
  const clean = normalizePath(path);
  if (typeof window === "undefined") return;

  const router = getRouter();
  if (router?.navigate) {
    try {
      void Promise.resolve(router.navigate({ to: clean, replace: true })).finally(unlockAfterNav);
      return;
    } catch {
      /* fall through */
    }
  }
  if (router?.history?.replace) {
    try {
      router.history.replace(clean);
      unlockAfterNav();
      return;
    } catch {
      /* fall through */
    }
  }

  if (shouldUseHash()) {
    const next = `#${clean}`;
    try {
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, "", `${base}${next}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch {
      window.location.hash = next;
    }
    unlockAfterNav();
    return;
  }

  try {
    window.history.replaceState({}, "", clean);
    window.dispatchEvent(new PopStateEvent("popstate"));
    unlockAfterNav();
  } catch {
    window.location.hash = `#${clean}`;
    unlockAfterNav();
  }
}

/** Attach router instance so appNavigate/appReplace can use it. */
export function bindAppRouter(router: D4Router): void {
  if (typeof window === "undefined") return;
  try {
    (window as unknown as { __D4_ROUTER?: D4Router }).__D4_ROUTER = router;
  } catch {
    /* ignore */
  }
}
