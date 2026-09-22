
/**
 * App unlock password reset via email link (Resend).
 * Does NOT change Supabase account password — only D4EXAM app lock.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function envUrl() {
  return process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
}
function envAnon() {
  return (
    process.env["SUPABASE_ANON_KEY"] ||
    process.env["VITE_SUPABASE_ANON_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    ""
  );
}
function envService() {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SB_SERVICE_ROLE_KEY"] ||
    ""
  );
}

function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const requestAppUnlockResetEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().optional(),
        /** Optional: after client verified login, pass auth user id */
        userId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const url = envUrl();
    const service = envService();
    if (!url || !service) {
      return { ok: false as const, error: "Server not configured" };
    }
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId = data.userId || "";
    let email = data.email.toLowerCase();

    if (!userId) {
      // Lookup by profile email
      const { data: prof } = await admin
        .from("profiles")
        .select("auth_user_id, email, full_name")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      userId = (prof as { auth_user_id?: string } | null)?.auth_user_id || "";
      if (!userId) {
        // Still send generic success to avoid enumeration; but no link
        return { ok: true as const, sent: false, reason: "no_user" };
      }
    }

    const token = randomToken();
    const exp = Date.now() + 60 * 60 * 1000; // 1 hour

    try {
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      const prev = (userData?.user?.user_metadata || {}) as Record<string, unknown>;
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...prev,
          d4_app_unlock_reset: { token, exp, userId },
        },
      });
    } catch (e) {
      console.warn("[app-unlock-reset] metadata", e);
      return { ok: false as const, error: "Could not create reset token" };
    }

    try {
      const { sendAppUnlockResetLinkEmail } = await import("@/lib/email.server");
      const { appUrl } = await import("@/lib/app-url");
      const link = appUrl(`/reset-app-password?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`);
      const r = await sendAppUnlockResetLinkEmail({
        to: email,
        fullName: data.fullName,
        resetUrl: link,
      });
      return { ok: r.ok, sent: r.ok, error: r.ok ? undefined : ("error" in r ? r.error : "send failed") };
    } catch (e) {
      console.warn("[app-unlock-reset] email", e);
      return { ok: false as const, error: "Email send failed" };
    }
  });

export const completeAppUnlockReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        token: z.string().min(16),
        newPassword: z.string().min(4).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const url = envUrl();
    const service = envService();
    if (!url || !service) return { ok: false as const, error: "Server not configured" };
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error } = await admin.auth.admin.getUserById(data.userId);
    if (error || !userData?.user) return { ok: false as const, error: "Invalid or expired link" };

    const meta = (userData.user.user_metadata || {}) as Record<string, unknown>;
    const reset = meta["d4_app_unlock_reset"] as
      | { token?: string; exp?: number; userId?: string }
      | undefined;
    if (!reset?.token || reset.token !== data.token) {
      return { ok: false as const, error: "Invalid or expired reset link" };
    }
    if (!reset.exp || Date.now() > Number(reset.exp)) {
      return { ok: false as const, error: "This reset link has expired. Request a new one." };
    }

    // Build same hash shape as client setAppUnlockPassword
    const saltArr = new Uint8Array(16);
    crypto.getRandomValues(saltArr);
    const salt = Array.from(saltArr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const enc = new TextEncoder().encode(`d4exam|${salt}|${data.newPassword}`);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const now = Date.now();
    const rec = {
      userId: data.userId,
      salt,
      hash,
      createdAt: now,
      updatedAt: now,
    };

    await admin.auth.admin.updateUserById(data.userId, {
      user_metadata: {
        ...meta,
        d4_app_unlock: rec,
        d4_app_unlock_reset: null,
      },
    });

    return { ok: true as const };
  });
