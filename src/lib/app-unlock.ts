/**
 * App unlock password — separate from Supabase account password.
 * Per-account, device-local. Stores only salt + SHA-256 hash (never plaintext).
 */
import { isNativeShell } from "@/native/platform";

/** Native Preferences omitted intentionally — hard import breaks Vercel build. localStorage is durable in WebView. */
async function prefsGet(_key: string): Promise<string | null> {
  return null;
}
async function prefsSet(_key: string, _value: string): Promise<void> {}
async function prefsRemove(_key: string): Promise<void> {}

const STORAGE_KEY = "d4_app_unlock_v1";

export type AppUnlockRecord = {
  userId: string;
  salt: string;
  hash: string;
  createdAt: number;
  updatedAt: number;
};

function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashAppPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`d4exam|${salt}|${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readRaw(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    if (isNativeShell()) {
      const value = await prefsGet(STORAGE_KEY);
      if (value) return value;
    }
  } catch {
    /* fall through */
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeRaw(json: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
  try {
    if (isNativeShell()) await prefsSet(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
}

async function clearRaw(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    if (isNativeShell()) await prefsRemove(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function readAppUnlockRecord(): Promise<AppUnlockRecord | null> {
  const raw = await readRaw();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as AppUnlockRecord;
    if (!v?.userId || !v?.salt || !v?.hash) return null;
    return v;
  } catch {
    return null;
  }
}

export async function hasAppUnlockFor(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const r = await readAppUnlockRecord();
  return Boolean(r && r.userId === userId && r.hash);
}

export async function setAppUnlockPassword(userId: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: "Not signed in" };
  const pw = String(password || "");
  if (pw.length < 4) return { ok: false, error: "App password must be at least 4 characters" };
  const salt = randomSalt();
  const hash = await hashAppPassword(pw, salt);
  const now = Date.now();
  const prev = await readAppUnlockRecord();
  const rec: AppUnlockRecord = {
    userId,
    salt,
    hash,
    createdAt: prev?.userId === userId ? prev.createdAt : now,
    updatedAt: now,
  };
  await writeRaw(JSON.stringify(rec));
  return { ok: true };
}

export async function verifyAppUnlockPassword(
  userId: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!userId) return false;
  const r = await readAppUnlockRecord();
  if (!r || r.userId !== userId) return false;
  const h = await hashAppPassword(String(password || ""), r.salt);
  return h === r.hash;
}

export async function changeAppUnlockPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await verifyAppUnlockPassword(userId, currentPassword);
  if (!ok) return { ok: false, error: "Current app password is incorrect" };
  return setAppUnlockPassword(userId, newPassword);
}

/** Clear unlock config only when it belongs to this user (logout). */
export async function clearAppUnlockFor(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const r = await readAppUnlockRecord();
  if (r && r.userId === userId) await clearRaw();
}

/** True if this account should show the app-unlock screen on return. */
export async function needsAppUnlockScreen(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const hasPw = await hasAppUnlockFor(userId);
  return hasPw;
}
