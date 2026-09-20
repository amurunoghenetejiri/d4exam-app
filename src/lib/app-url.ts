/**
 * Canonical public application URL for D4EXAM.
 * Production: https://d4exam.name.ng
 *
 * Prefer APP_URL / PUBLIC_APP_URL / VITE_APP_URL on the server.
 * Client falls back to window.location.origin when not on a known host,
 * otherwise uses the production canonical domain.
 */

export const CANONICAL_APP_ORIGIN = "https://d4exam.name.ng";

/** Legacy Vercel hostname — keep allowlisted for redirects/compat only. */
export const LEGACY_VERCEL_ORIGIN = "https://d4exam-platform.vercel.app";

function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Server- and client-safe origin for links in emails, auth redirects, push, SEO.
 */
export function getAppOrigin(): string {
  const fromEnv =
    (typeof process !== "undefined" &&
      (process.env["APP_URL"] ||
        process.env["PUBLIC_APP_URL"] ||
        process.env["VITE_APP_URL"] ||
        process.env["SITE_URL"])) ||
    "";
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return stripSlash(fromEnv);
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    // Prefer canonical when already on either production host
    if (o.includes("d4exam.name.ng") || o.includes("d4exam-platform.vercel.app")) {
      // When served from legacy host, still emit canonical for share/email/auth
      // so users migrate; browser relative nav continues to work via same origin.
      if (o.includes("d4exam-platform.vercel.app")) return CANONICAL_APP_ORIGIN;
      return stripSlash(o);
    }
    // Local/dev: use current origin
    if (o.includes("localhost") || o.includes("127.0.0.1")) return stripSlash(o);
  }

  return CANONICAL_APP_ORIGIN;
}

/** Absolute URL for a path (leading slash optional). */
export function appUrl(path = "/"): string {
  const origin = getAppOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return origin;
  return `${origin}${p}`;
}

/** Password recovery redirect (existing route). */
export function passwordResetRedirectUrl(): string {
  return appUrl("/reset-password");
}

export function loginUrl(): string {
  return appUrl("/login");
}
