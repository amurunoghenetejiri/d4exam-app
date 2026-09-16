/**
 * Multi-account switcher for D4EXAM.
 * Stores session tokens (never passwords) per account on-device.
 * Backend remains authority for roles/permissions.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, SessionUser } from "@/lib/session";
import { roleHome, clearPendingLoginRole, seedPendingLoginRole } from "@/lib/session";
import { offlineClearUser } from "@/lib/offline-cache";
import { clearFingerprintIfUser, disableFingerprint } from "@/lib/fingerprint-lock";

const VAULT_KEY = "d4_account_vault_v1";
const ACTIVE_KEY = "d4_account_active_v1";
const ADD_ACCOUNT_FLAG = "d4_add_account_flow";

export type SavedAccount = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  roles: AppRole[];
  schoolId: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  identifier: string | null;
  accessToken: string;
  refreshToken: string;
  savedAt: number;
  lastUsedAt: number;
};

type Vault = { accounts: SavedAccount[] };

function readVault(): Vault {
  if (typeof window === "undefined") return { accounts: [] };
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return { accounts: [] };
    const parsed = JSON.parse(raw) as Vault;
    if (!parsed || !Array.isArray(parsed.accounts)) return { accounts: [] };
    return { accounts: parsed.accounts.filter((a) => a && a.userId && a.refreshToken) };
  } catch {
    return { accounts: [] };
  }
}

function writeVault(vault: Vault): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  } catch {
    /* quota */
  }
}

export function listSavedAccounts(): SavedAccount[] {
  return [...readVault().accounts].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

export function getActiveAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function setActiveAccountId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(ACTIVE_KEY, userId);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export type AccountListItem = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  roles: AppRole[];
  schoolId: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  identifier: string | null;
  lastUsedAt: number;
  isActive: boolean;
};

export function listAccountsForUi(activeUserId?: string | null): AccountListItem[] {
  const active = activeUserId ?? getActiveAccountId();
  return listSavedAccounts().map((a) => ({
    userId: a.userId,
    email: a.email,
    fullName: a.fullName,
    role: a.role,
    roles: a.roles,
    schoolId: a.schoolId,
    schoolName: a.schoolName,
    schoolCode: a.schoolCode,
    identifier: a.identifier,
    lastUsedAt: a.lastUsedAt,
    isActive: Boolean(active && a.userId === active),
  }));
}

export function roleLabel(role: AppRole | string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "school_admin":
      return "School Admin";
    case "examination_officer":
      return "Officer";
    case "teacher":
      return "Teacher";
    case "student":
      return "Student";
    default:
      return role ? String(role) : "User";
  }
}

function envSupabase(): { url: string; key: string } {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: Record<string, string> }).env || {}
      : {};
  const url = String(env["VITE_SUPABASE_URL"] || "").replace(/\/$/, "");
  const key = String(env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"] || "");
  return { url, key };
}

export async function saveCurrentAccountToVault(sessionUser?: SessionUser | null): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess?.access_token || !sess.refresh_token || !sess.user?.id) return false;

    let user = sessionUser;
    if (!user) {
      const { fetchSessionUser } = await import("@/lib/session");
      user = await fetchSessionUser();
    }
    if (!user?.userId) return false;

    const entry: SavedAccount = {
      userId: user.userId,
      email: user.email || sess.user.email || "",
      fullName: user.fullName || user.email || "Account",
      role: user.role,
      roles: user.roles || [],
      schoolId: user.schoolId,
      schoolName: user.schoolName,
      schoolCode: user.schoolCode,
      identifier: user.identifier,
      accessToken: sess.access_token,
      refreshToken: sess.refresh_token,
      savedAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    const vault = readVault();
    const idx = vault.accounts.findIndex((a) => a.userId === entry.userId);
    if (idx >= 0) vault.accounts[idx] = { ...vault.accounts[idx], ...entry };
    else vault.accounts.push(entry);
    writeVault(vault);
    setActiveAccountId(entry.userId);
    return true;
  } catch {
    return false;
  }
}

export async function touchActiveAccountTokens(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess?.user?.id || !sess.access_token || !sess.refresh_token) return;
    const vault = readVault();
    const idx = vault.accounts.findIndex((a) => a.userId === sess.user!.id);
    if (idx < 0) return;
    vault.accounts[idx] = {
      ...vault.accounts[idx],
      accessToken: sess.access_token,
      refreshToken: sess.refresh_token,
      lastUsedAt: Date.now(),
    };
    writeVault(vault);
    setActiveAccountId(sess.user.id);
  } catch {
    /* ignore */
  }
}

export function isAccountSaved(userId: string): boolean {
  return readVault().accounts.some((a) => a.userId === userId);
}

export async function removeAccountFromDevice(userId: string): Promise<void> {
  const vault = readVault();
  vault.accounts = vault.accounts.filter((a) => a.userId !== userId);
  writeVault(vault);
  try {
    await offlineClearUser(userId);
  } catch {
    /* ignore */
  }
  if (getActiveAccountId() === userId) setActiveAccountId(null);
}

async function refreshViaApi(
  refreshToken: string,
): Promise<{ access: string; refresh: string; uid: string } | null> {
  try {
    const { url, key } = envSupabase();
    if (!url || !key) return null;
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        ...(key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")
          ? {}
          : { Authorization: `Bearer ${key}` }),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      user?: { id?: string };
    };
    if (!json.access_token || !json.refresh_token) return null;
    return {
      access: json.access_token,
      refresh: json.refresh_token,
      uid: String(json.user?.id || ""),
    };
  } catch {
    return null;
  }
}

/**
 * Switch to a saved account.
 * Flow: refresh target tokens → local signOut → setSession(new) → navigate.
 * On any failure, restore previous session so the user is never left logged out.
 */
export async function switchToAccount(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; needsLogin?: boolean; email?: string }> {
  const vault = readVault();
  const account = vault.accounts.find((a) => a.userId === userId);
  if (!account) return { ok: false, error: "Account not found on this device." };

  const path = account.role && account.role in roleHome ? roleHome[account.role] : "/";
  const targetId = String(userId);

  let prevAccess: string | null = null;
  let prevRefresh: string | null = null;
  let prevUserId: string | null = null;
  try {
    const { data: cur } = await supabase.auth.getSession();
    if (cur.session?.access_token && cur.session?.refresh_token && cur.session.user?.id) {
      prevAccess = cur.session.access_token;
      prevRefresh = cur.session.refresh_token;
      prevUserId = String(cur.session.user.id);
      const idx = vault.accounts.findIndex((a) => String(a.userId) === prevUserId);
      if (idx >= 0) {
        vault.accounts[idx] = {
          ...vault.accounts[idx],
          accessToken: prevAccess,
          refreshToken: prevRefresh,
          lastUsedAt: Date.now(),
        };
        writeVault(vault);
      }
    }
  } catch {
    /* ignore */
  }

  if (prevUserId === targetId && prevAccess) {
    setActiveAccountId(targetId);
    if (account.role) seedPendingLoginRole(account.role);
    if (typeof window !== "undefined") window.location.replace(path);
    return { ok: true };
  }

  let refreshTok = (account.refreshToken || "").trim();
  let accessTok = (account.accessToken || "").trim();
  if (!refreshTok && !accessTok) {
    return {
      ok: false,
      error: "No saved session for that account. Sign in again.",
      needsLogin: true,
      email: account.email,
    };
  }

  async function restorePrevious(): Promise<boolean> {
    if (!prevAccess || !prevRefresh) return false;
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: prevAccess,
        refresh_token: prevRefresh,
      });
      if (error || !data.session?.access_token) return false;
      if (prevUserId) setActiveAccountId(prevUserId);
      return true;
    } catch {
      return false;
    }
  }

  function goHome(): { ok: true } {
    if (account.role) seedPendingLoginRole(account.role);
    if (typeof window !== "undefined") {
      try {
        window.location.replace(path);
      } catch {
        window.location.href = path;
      }
    }
    return { ok: true };
  }

  try {
    // 1) Always try to refresh the TARGET account tokens first (while still on current session)
    if (refreshTok) {
      const api = await refreshViaApi(refreshTok);
      if (api && (!api.uid || api.uid === targetId)) {
        accessTok = api.access;
        refreshTok = api.refresh;
      }
    }

    if (!accessTok || !refreshTok) {
      await restorePrevious();
      return {
        ok: false,
        error: "Session for that account expired on this device. Sign in once to refresh it.",
        needsLogin: true,
        email: account.email,
      };
    }

    // 2) Clear local session so setSession for a different user is accepted
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 40));

    // 3) Commit target session
    const { data, error } = await supabase.auth.setSession({
      access_token: accessTok,
      refresh_token: refreshTok,
    });

    if (error || !data.session?.access_token) {
      await restorePrevious();
      return {
        ok: false,
        error: "Session for that account expired on this device. Sign in once to refresh it.",
        needsLogin: true,
        email: account.email,
      };
    }

    const uid = String(data.session.user?.id || "");
    if (uid && uid !== targetId) {
      await restorePrevious();
      return {
        ok: false,
        error: "Could not switch to that account. Sign in once more.",
        needsLogin: true,
        email: account.email,
      };
    }

    account.accessToken = data.session.access_token;
    account.refreshToken = data.session.refresh_token || refreshTok;
    account.lastUsedAt = Date.now();
    const idx = vault.accounts.findIndex((a) => String(a.userId) === targetId);
    if (idx >= 0) vault.accounts[idx] = { ...vault.accounts[idx], ...account };
    else vault.accounts.push(account);
    writeVault(vault);
    setActiveAccountId(targetId);

    return goHome();
  } catch (e) {
    await restorePrevious();
    return { ok: false, error: (e as Error).message || "Could not switch account." };
  }
}

export function beginRefreshAccountLogin(opts: {
  email?: string | null;
  userId?: string | null;
  role?: AppRole | null;
}): void {
  if (typeof window === "undefined") return;
  try {
    const path = opts.role && opts.role in roleHome ? roleHome[opts.role] : "/";
    window.sessionStorage.setItem(
      "d4_pending_switch",
      JSON.stringify({
        userId: opts.userId || "",
        email: opts.email || "",
        role: opts.role || null,
        path,
      }),
    );
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(ADD_ACCOUNT_FLAG, "1");
  } catch {
    /* ignore */
  }
  const q = new URLSearchParams();
  q.set("addAccount", "1");
  q.set("switch", "1");
  if (opts.email) q.set("email", opts.email);
  void supabase.auth.signOut({ scope: "local" }).finally(() => {
    window.location.href = `/login?${q.toString()}`;
  });
}

export async function signOutThisAccount(): Promise<void> {
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id ?? getActiveAccountId();
  } catch {
    userId = getActiveAccountId();
  }
  try {
    clearFingerprintIfUser(userId);
  } catch {
    /* ignore */
  }
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
  clearPendingLoginRole();
  if (userId) await removeAccountFromDevice(userId);
  const remaining = listSavedAccounts();
  if (typeof window !== "undefined") {
    window.location.href = remaining.length > 0 ? "/login?switched=1" : "/login";
  }
}

export async function signOutAllAccounts(): Promise<void> {
  const vault = readVault();
  const ids = vault.accounts.map((a) => a.userId);
  try {
    disableFingerprint();
  } catch {
    /* ignore */
  }
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
  clearPendingLoginRole();
  writeVault({ accounts: [] });
  setActiveAccountId(null);
  for (const id of ids) {
    try {
      await offlineClearUser(id);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") window.location.href = "/login";
}

export function beginAddAccountFlow(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ADD_ACCOUNT_FLAG, "1");
  } catch {
    /* ignore */
  }
  void supabase.auth.signOut({ scope: "local" }).finally(() => {
    window.location.href = "/login?addAccount=1";
  });
}

export function consumeAddAccountFlow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.sessionStorage.getItem(ADD_ACCOUNT_FLAG);
    if (v) {
      window.sessionStorage.removeItem(ADD_ACCOUNT_FLAG);
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    return new URLSearchParams(window.location.search).get("addAccount") === "1";
  } catch {
    return false;
  }
}

export function isAddAccountUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("addAccount") === "1";
  } catch {
    return false;
  }
}
