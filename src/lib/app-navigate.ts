/**
 * Client-side navigation that works inside the Capacitor APK SPA.
 * Local shell uses hash history (#/path). Public website keeps normal paths.
 */

export function isPublicWebHost(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const host = (window.location.hostname || "").toLowerCase();
    return (
      host === "d4exam.name.ng" ||
      host === "www.d4exam.name.ng" ||
      host.endsWith(".vercel.app") ||
      host.includes("lovable.app") ||
      host.includes("lovableproject.com")
    );
  } catch {
    return false;
  }
}

/** True when the UI is the bundled APK / local Capacitor shell (not the public website). */
export function isLocalAppShell(): boolean {
  if (typeof window === "undefined") return false;
  return !isPublicWebHost();
}

/**
 * Navigate to an in-app route without leaving the SPA.
 * On the APK this sets location.hash so TanStack hash history updates immediately.
 */
export function appNavigate(path: string): void {
  if (typeof window === "undefined") return;
  let p = String(path || "/").trim() || "/";
  if (!p.startsWith("/") && !p.startsWith("http") && !p.startsWith("#")) {
    p = `/${p}`;
  }
  // External / special schemes — leave alone
  if (/^(https?:|intent:|mailto:|tel:)/i.test(p)) {
    try {
      window.location.href = p;
    } catch {
      /* ignore */
    }
    return;
  }
  // Strip accidental hash prefix
  if (p.startsWith("#")) p = p.slice(1);
  if (!p.startsWith("/")) p = `/${p}`;

  if (isLocalAppShell()) {
    try {
      // Prefer hash SPA navigation — never load a remote path
      const next = `#${p}`;
      if (window.location.hash === next) {
        // force re-notify if same route
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        window.location.hash = next;
      }
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    window.location.assign(p);
  } catch {
    try {
      window.location.href = p;
    } catch {
      /* ignore */
    }
  }
}

export function appReplace(path: string): void {
  if (typeof window === "undefined") return;
  let p = String(path || "/").trim() || "/";
  if (p.startsWith("#")) p = p.slice(1);
  if (!p.startsWith("/")) p = `/${p}`;
  if (isLocalAppShell()) {
    try {
      const url = `${window.location.pathname}${window.location.search}#${p}`;
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    window.location.replace(p);
  } catch {
    appNavigate(p);
  }
}
