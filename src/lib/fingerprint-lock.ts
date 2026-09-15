/**
 * Device-local fingerprint unlock preferences.
 * Never stores biometric templates — only whether unlock is enabled for a userId.
 */
import { isNativeShell } from "@/native/platform";

const PREF_KEY = "d4_fp_lock_v1";
const LOCKED_KEY = "d4_fp_locked_v1";
const BG_AT_KEY = "d4_fp_bg_at_v1";

/** Grace period (ms) after background before requiring fingerprint again */
export const FP_LOCK_GRACE_MS = 30_000;

export type FingerprintLockPref = {
  enabled: boolean;
  userId: string;
  enabledAt: number;
};

function safeParse(raw: string | null): FingerprintLockPref | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as FingerprintLockPref;
    if (!v || typeof v.userId !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

export function readFingerprintPref(): FingerprintLockPref | null {
  if (typeof window === "undefined") return null;
  try {
    return safeParse(window.localStorage.getItem(PREF_KEY));
  } catch {
    return null;
  }
}

export function isFingerprintEnabledFor(userId: string | null | undefined): boolean {
  if (!userId || !isNativeShell()) return false;
  const p = readFingerprintPref();
  return Boolean(p?.enabled && p.userId === userId);
}

export function enableFingerprintFor(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  const pref: FingerprintLockPref = {
    enabled: true,
    userId,
    enabledAt: Date.now(),
  };
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(pref));
    setFingerprintLocked(false);
    try {
      window.sessionStorage.setItem("d4_fp_session_unlocked_v1", "1");
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}

export function disableFingerprint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREF_KEY);
    window.localStorage.removeItem(LOCKED_KEY);
    window.localStorage.removeItem(BG_AT_KEY);
  } catch {
    /* ignore */
  }
}

export function clearFingerprintIfUser(userId: string | null | undefined): void {
  const p = readFingerprintPref();
  if (!p) return;
  if (!userId || p.userId === userId) {
    disableFingerprint();
  }
}

export function isFingerprintLocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFingerprintLocked(locked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (locked) window.localStorage.setItem(LOCKED_KEY, "1");
    else window.localStorage.removeItem(LOCKED_KEY);
  } catch {
    /* ignore */
  }
}

export function markAppBackgrounded(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BG_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

const SESSION_UNLOCKED_KEY = "d4_fp_session_unlocked_v1";

export function markSessionUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_UNLOCKED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSessionUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldLockAfterBackground(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(BG_AT_KEY);
    if (raw) {
      const at = Number(raw);
      if (Number.isFinite(at) && Date.now() - at >= FP_LOCK_GRACE_MS) return true;
      return false;
    }
    return !isSessionUnlocked();
  } catch {
    return true;
  }
}

export function clearBackgroundMark(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BG_AT_KEY);
  } catch {
    /* ignore */
  }
}

export function isActiveCbtExamPath(pathname?: string): boolean {
  try {
    const path = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
    if (/\/student\/exam\/[^/]+/i.test(path)) return true;
    if (typeof window !== "undefined") {
      const flag = window.sessionStorage.getItem("d4_exam_active");
      if (flag === "1") return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function setExamActiveFlag(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) window.sessionStorage.setItem("d4_exam_active", "1");
    else window.sessionStorage.removeItem("d4_exam_active");
  } catch {
    /* ignore */
  }
}
