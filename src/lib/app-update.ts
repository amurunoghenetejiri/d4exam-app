/**
 * Sideloaded APK version check + install helpers.
 * Prefer same-origin /downloads/d4exam.apk when present;
 * fall back to GitHub Release direct asset (Content-Disposition: attachment).
 */
import { isNativeShell } from "@/native/platform";

export type AppVersionConfig = {
  minVersion: string;
  latestVersion: string;
  minBuild: number;
  latestBuild: number;
  apkUrl: string;
  forceUpdate: boolean;
  message: string;
  installMessage: string;
};

const PRODUCTION_ORIGIN = "https://d4exam-platform.vercel.app";

/** Official release asset — always a real APK download when CI publishes apk-latest */
export const GITHUB_APK_RELEASE_URL =
  "https://github.com/amurunoghenetejiri/d4exam-platform/releases/download/apk-latest/d4exam.apk";

const DEFAULT_CONFIG: AppVersionConfig = {
  minVersion: "1.0.0",
  latestVersion: "1.0.0",
  minBuild: 1,
  latestBuild: 1,
  apkUrl: GITHUB_APK_RELEASE_URL,
  forceUpdate: true,
  message: "A new version of D4EXAM is required. Please update to continue.",
  installMessage:
    "Install the D4EXAM Android app for the full exam experience (camera, mic, screen share).",
};

let cachedConfig: { at: number; value: AppVersionConfig } | null = null;
const CACHE_MS = 60_000;

function isRealCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const Cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    if (Cap?.isNativePlatform?.()) return true;
    const p = Cap?.getPlatform?.();
    if (p === "android" || p === "ios") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function parseVersionParts(v: string): number[] {
  return String(v || "0")
    .trim()
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((n) => parseInt(n, 10) || 0);
}

/** Return negative if a < b, 0 if equal, positive if a > b */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function normalizeApkUrl(u: string): string {
  const raw = String(u || "").trim();
  if (!raw) return GITHUB_APK_RELEASE_URL;
  // Missing local file used to show "no file" — map to working release asset
  if (raw === "/downloads/d4exam.apk" || raw.endsWith("/downloads/d4exam.apk")) {
    return GITHUB_APK_RELEASE_URL;
  }
  // Allow official release download URLs through unchanged
  if (/github\.com\/.+\/releases\/download\//i.test(raw)) {
    return raw;
  }
  // Other github.com pages (repo, issues) → force release asset, not HTML
  if (/github\.com/i.test(raw)) {
    return GITHUB_APK_RELEASE_URL;
  }
  return raw;
}

export async function fetchAppVersionConfig(): Promise<AppVersionConfig> {
  if (cachedConfig && Date.now() - cachedConfig.at < CACHE_MS) {
    return cachedConfig.value;
  }

  const urls = [
    `/app-version.json?t=${Date.now()}`,
    `${PRODUCTION_ORIGIN}/app-version.json?t=${Date.now()}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "omit" });
      if (!res.ok) continue;
      const data = (await res.json()) as Partial<AppVersionConfig>;
      const value: AppVersionConfig = {
        ...DEFAULT_CONFIG,
        ...data,
        minBuild: Number(data.minBuild ?? DEFAULT_CONFIG.minBuild) || 1,
        latestBuild: Number(data.latestBuild ?? DEFAULT_CONFIG.latestBuild) || 1,
        forceUpdate: data.forceUpdate !== false,
        apkUrl: normalizeApkUrl(String(data.apkUrl || DEFAULT_CONFIG.apkUrl)),
      };
      cachedConfig = { at: Date.now(), value };
      return value;
    } catch (e) {
      console.warn("[app-update] config fetch failed", url, e);
    }
  }
  return DEFAULT_CONFIG;
}

export type NativeAppInfo = {
  version: string;
  build: string;
};

export async function getNativeAppInfo(): Promise<NativeAppInfo | null> {
  if (typeof window === "undefined") return null;
  if (!isNativeShell() && !isRealCapacitorNative()) return null;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return {
      version: String(info.version || "0"),
      build: String(info.build || "0"),
    };
  } catch (e) {
    console.warn("[app-update] App.getInfo failed", e);
    return null;
  }
}

export function needsForceUpdate(
  info: NativeAppInfo,
  cfg: AppVersionConfig,
): boolean {
  const buildNum = parseInt(info.build, 10);
  if (!Number.isNaN(buildNum) && cfg.minBuild > 0 && buildNum < cfg.minBuild) {
    return true;
  }
  if (compareVersions(info.version, cfg.minVersion) < 0) {
    return true;
  }
  return false;
}

export function resolveApkUrl(apkUrl: string): string {
  const raw = normalizeApkUrl(apkUrl || DEFAULT_CONFIG.apkUrl);
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : PRODUCTION_ORIGIN;
  if (raw.startsWith("/")) return `${origin.replace(/\/$/, "")}${raw}`;
  return `${origin.replace(/\/$/, "")}/${raw}`;
}

/**
 * Start APK download. GitHub Release assets send Content-Disposition: attachment
 * so Android Chrome downloads the file instead of showing a page.
 * Cross-origin: navigate (download attribute is same-origin only).
 */
export function openApkDownload(apkUrl: string) {
  const url = resolveApkUrl(apkUrl);
  const isCrossOrigin =
    typeof window !== "undefined" &&
    /^https?:\/\//i.test(url) &&
    !url.startsWith(window.location.origin);

  // Cross-origin release asset: assign so browser follows 302 → binary download
  if (isCrossOrigin) {
    try {
      window.location.assign(url);
      return;
    } catch {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      } catch {
        /* fall through */
      }
    }
  }

  try {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "d4exam.apk");
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      try {
        a.remove();
      } catch {
        /* ignore */
      }
    }, 2000);
  } catch {
    try {
      window.location.assign(url);
    } catch {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Android Chrome/browser (not real Capacitor APK).
 * Does NOT use isNativeShell() — that flag can stick in localStorage and hide the banner on the website.
 */
export function isAndroidWebBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (isRealCapacitorNative()) return false;
  try {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return false;
    if (!/Android/i.test(ua)) return false;
    if (/; wv\)/i.test(ua) && isRealCapacitorNative()) return false;
    return true;
  } catch {
    return false;
  }
}

export function isIosWebBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(ua);
  } catch {
    return false;
  }
}
