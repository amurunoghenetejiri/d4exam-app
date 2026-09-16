/**
 * Multi-account switcher for D4EXAM.
 * Stores session tokens (never passwords) per account on-device.
 * Switch is instant: no “refresh account” login screen.
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

function updateAccountTokens(userId: string, access: string, refresh: string): void {
  const vault = readVault();
  const idx = vault.accounts.findIndex((a) => String(a.userId) === String(userId));
  if (idx < 0) return;
  vault.accounts[idx] = {
    ...vault.accounts[idx],
    accessToken: access,
    refreshToken: refresh,
    lastUsedAt: Date.now(),
  };
  writeVault(vault);
}

export async function saveCurrentAccountToVault(sessionUser?: SessionUser | null): Promise<boolean> {
  try {
    // Prefer a fresh session so vault always has current refresh token
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* use existing */
    }
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
    updateAccountTokens(sess.user.id, sess.access_token, sess.refresh_token);
    setActiveAccountId(sess.user.id);
  } catch {
    /* ignore */
  }
}

/** Keep vault tokens in sync whenever Supabase refreshes the active session. */
let keepAliveStarted = false;
export function startAccountVaultKeepAlive(): void {
  if (typeof window === "undefined" || keepAliveStarted) return;
  keepAliveStarted = true;
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user?.id || !session.access_token || !session.refresh_token) return;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        updateAccountTokens(session.user.id, session.access_token, session.refresh_token);
        setActiveAccountId(session.user.id);
      }
    });
  } catch {
    /* ignore */
  }
  // Periodic soft refresh of active account into vault
  window.setInterval(() => {
    void touchActiveAccountTokens();
  }, 60_000);
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
 * Instant switch into another saved account (no login / “refresh account” screen).
 * 1) Snapshot + save current account tokens
 * 2) Refresh target tokens via API
 * 3) Local signOut → setSession(target) → hard navigate to role home
 * 4) On failure restore previous session (stay logged in as before)
 */
export async function switchToAccount(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vault = readVault();
  const account = vault.accounts.find((a) => a.userId === userId);
  if (!account) return { ok: false, error: "Account not found on this device." };

  const path = account.role && account.role in roleHome ? roleHome[account.role] : "/";
  const targetId = String(userId);

  let prevAccess: string | null = null;
  let prevRefresh: string | null = null;
  let prevUserId: string | null = null;

  try {
    // Fresh tokens for CURRENT account before leaving it
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.access_token && refreshed.session.refresh_token) {
        prevAccess = refreshed.session.access_token;
        prevRefresh = refreshed.session.refresh_token;
        prevUserId = String(refreshed.session.user?.id || "");
      }
    } catch {
      /* fall through */
    }
    if (!prevAccess || !prevRefresh) {
      const { data: cur } = await supabase.auth.getSession();
      if (cur.session?.access_token && cur.session.refresh_token && cur.session.user?.id) {
        prevAccess = cur.session.access_token;
        prevRefresh = cur.session.refresh_token;
        prevUserId = String(cur.session.user.id);
      }
    }
    if (prevUserId && prevAccess && prevRefresh) {
      updateAccountTokens(prevUserId, prevAccess, prevRefresh);
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
  if (!refreshTok) {
    return { ok: false, error: "No saved session for that account. Use Add Account and sign in once." };
  }

  async function restorePrevious(): Promise<void> {
    if (!prevAccess || !prevRefresh) return;
    try {
      await supabase.auth.setSession({
        access_token: prevAccess,
        refresh_token: prevRefresh,
      });
      if (prevUserId) setActiveAccountId(prevUserId);
    } catch {
      /* ignore */
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
    // Refresh TARGET tokens first (while still on current session)
    const api = await refreshViaApi(refreshTok);
    if (api && (!api.uid || api.uid === targetId)) {
      accessTok = api.access;
      refreshTok = api.refresh;
      updateAccountTokens(targetId, accessTok, refreshTok);
    } else {
      // Try supabase client refresh with stored token
      try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshTok });
        if (!error && data.session?.access_token && data.session.refresh_token) {
          const uid = String(data.session.user?.id || "");
          if (!uid || uid === targetId) {
            accessTok = data.session.access_token;
            refreshTok = data.session.refresh_token;
            updateAccountTokens(targetId, accessTok, refreshTok);
          }
        }
      } catch {
        /* keep stored tokens */
      }
    }

    if (!accessTok || !refreshTok) {
      await restorePrevious();
      return {
        ok: false,
        error: "Could not open that account. Open Add Account and sign in once to save it again.",
      };
    }

    // Clear local session so a different user can be set
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 50));

    const { data, error } = await supabase.auth.setSession({
      access_token: accessTok,
      refresh_token: refreshTok,
    });

    if (error || !data.session?.access_token) {
      await restorePrevious();
      return {
        ok: false,
        error: "Could not switch accounts right now. Stay on this account and try again.",
      };
    }

    const uid = String(data.session.user?.id || "");
    if (uid && uid !== targetId) {
      await restorePrevious();
      return { ok: false, error: "Could not switch to that account." };
    }

    // Persist new tokens for next switch
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

/** @deprecated Prefer instant switchToAccount — kept for compatibility */
export function beginRefreshAccountLogin(opts: {
  email?: string | null;
  userId?: string | null;
  role?: AppRole | null;
}): void {
  // No longer used for switch — stay on current account; user should use Switch again after re-saving.
  if (typeof window === "undefined") return;
  void opts;
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
  // Save current account tokens before leaving so switch back still works
  void saveCurrentAccountToVault().finally(() => {
    try {
      window.sessionStorage.setItem(ADD_ACCOUNT_FLAG, "1");
    } catch {
      /* ignore */
    }
    void supabase.auth.signOut({ scope: "local" }).finally(() => {
      window.location.href = "/login?addAccount=1";
    });
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
