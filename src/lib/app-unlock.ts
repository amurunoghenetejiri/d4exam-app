/**
 * App unlock password — separate from Supabase account password.
 * Stored as salt+SHA-256 hash in localStorage AND auth user_metadata so the
 * same password works on any device where the account is signed in.
 * Never stores plaintext. Does NOT change the Supabase account password.
 */
import { isNativeShell } from "@/native/platform";

const STORAGE_KEY = "d4_app_unlock_v1";
const META_KEY = "d4_app_unlock";

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

async function readLocal(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeLocal(json: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
}

async function clearLocal(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function readCloud(): Promise<AppUnlockRecord | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
    const raw = meta?.[META_KEY];
    if (!raw || typeof raw !== "object") return null;
    const v = raw as AppUnlockRecord;
    if (!v?.userId || !v?.salt || !v?.hash) return null;
    return v;
  } catch {
    return null;
  }
}

async function writeCloud(rec: AppUnlockRecord): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.updateUser({ data: { [META_KEY]: rec } });
  } catch (e) {
    console.warn("[app-unlock] cloud save failed", e);
  }
}

async function clearCloud(): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.updateUser({ data: { [META_KEY]: null } });
  } catch {
    /* ignore */
  }
}

export async function readAppUnlockRecord(): Promise<AppUnlockRecord | null> {
  // Prefer local for speed; fall back / merge with cloud
  try {
    const local = await readLocal();
    if (local) {
      const v = JSON.parse(local) as AppUnlockRecord;
      if (v?.userId && v?.salt && v?.hash) return v;
    }
  } catch {
    /* ignore */
  }
  const cloud = await readCloud();
  if (cloud) {
    // cache locally for offline unlock
    try {
      await writeLocal(JSON.stringify(cloud));
    } catch {
      /* ignore */
    }
    return cloud;
  }
  return null;
}

export async function hasAppUnlockFor(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const r = await readAppUnlockRecord();
  if (r && r.userId === userId && r.hash) return true;
  // Try cloud if local miss (other device set the password)
  const cloud = await readCloud();
  if (cloud && cloud.userId === userId && cloud.hash) {
    await writeLocal(JSON.stringify(cloud));
    return true;
  }
  return false;
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
  await writeLocal(JSON.stringify(rec));
  await writeCloud(rec);
  return { ok: true };
}

export async function verifyAppUnlockPassword(
  userId: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!userId) return false;
  let r = await readAppUnlockRecord();
  if (!r || r.userId !== userId) {
    r = await readCloud();
    if (r && r.userId === userId) await writeLocal(JSON.stringify(r));
  }
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
  if (r && r.userId === userId) {
    await clearLocal();
    await clearCloud();
  }
}

export async function needsAppUnlockScreen(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return hasAppUnlockFor(userId);
}

// silence unused in tree-shaking
void isNativeShell;
