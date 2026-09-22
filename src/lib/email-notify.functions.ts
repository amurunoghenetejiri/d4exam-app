/**
 * Server functions for transactional D4EXAM emails (Resend).
 * Failures never throw to the client in a way that blocks core UX.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const notifyStudentEmailLinked = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), studentName: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { sendStudentEmailLinkedEmail } = await import("@/lib/email.server");
      const r = await sendStudentEmailLinkedEmail({
        to: data.email,
        studentName: data.studentName || "Student",
      });
      return r;
    } catch (e) {
      console.warn("[email] student linked", e);
      return { ok: false as const, error: "send failed" };
    }
  });

export const notifyAppPasswordHelp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), fullName: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { sendAppPasswordHelpEmail } = await import("@/lib/email.server");
      return await sendAppPasswordHelpEmail({ to: data.email, fullName: data.fullName });
    } catch (e) {
      console.warn("[email] app password help", e);
      return { ok: false as const, error: "send failed" };
    }
  });

export const notifyWelcomeRole = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().optional(),
        role: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { sendWelcomeRoleEmail } = await import("@/lib/email.server");
      return await sendWelcomeRoleEmail({
        to: data.email,
        fullName: data.fullName || "User",
        role: data.role,
      });
    } catch (e) {
      console.warn("[email] welcome", e);
      return { ok: false as const, error: "send failed" };
    }
  });


export const notifySchoolApplicationReceived = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        applicantName: z.string().optional(),
        schoolName: z.string(),
        trackingCode: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { sendSchoolApplicationReceivedEmail } = await import("@/lib/email.server");
      return await sendSchoolApplicationReceivedEmail({
        to: data.email,
        applicantName: data.applicantName || "Applicant",
        schoolName: data.schoolName,
        trackingCode: data.trackingCode,
      });
    } catch (e) {
      console.warn("[email] application received", e);
      return { ok: false as const, error: "send failed" };
    }
  });


export const notifyTeacherCoursesAssigned = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().optional(),
        schoolName: z.string().optional(),
        courseLabels: z.array(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { sendTeacherCoursesAssignedEmail } = await import("@/lib/email.server");
      return await sendTeacherCoursesAssignedEmail({
        to: data.email,
        fullName: data.fullName || "Teacher",
        schoolName: data.schoolName,
        courseLabels: data.courseLabels,
      });
    } catch (e) {
      console.warn("[email] courses assigned", e);
      return { ok: false as const, error: "send failed" };
    }
  });

export const sendPlatformMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().optional(),
        authUserId: z.string().optional(),
        title: z.string().min(1),
        body: z.string().min(1),
        viaEmail: z.boolean(),
        viaNotification: z.boolean(),
        recipientName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const results: string[] = [];
    if (data.viaEmail && data.email) {
      try {
        const { sendEmail } = await import("@/lib/email.server");
        const { getAppOrigin } = await import("@/lib/app-url");
        const r = await sendEmail({
          to: data.email,
          subject: data.title,
          html: `<div style="font-family:system-ui;padding:16px"><h2>${data.title}</h2><p>${data.body.replace(/\n/g, "<br/>")}</p><p style="color:#64748b;font-size:12px">Message from D4EXAM Super Admin · ${getAppOrigin()}</p></div>`,
          text: data.body,
        });
        if (r.ok) results.push("email");
        else results.push(`email_failed:${r.error}`);
      } catch (e) {
        results.push(`email_failed:${(e as Error).message}`);
      }
    }
    if (data.viaNotification && data.authUserId) {
      try {
        const { notifyUser } = await import("@/lib/notify");
        await notifyUser({
          recipientUserId: data.authUserId,
          title: data.title,
          message: data.body,
          type: "platform_message",
          link: "/notifications",
        });
        results.push("notification");
      } catch (e) {
        results.push(`notification_failed:${(e as Error).message}`);
      }
    }
    return { ok: results.some((x) => x === "email" || x === "notification"), results };
  });


/** Email every super_admin profile when a school applies (Resend). */
export const notifySuperAdminsApplicationEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        schoolName: z.string().min(1),
        trackingCode: z.string().min(1),
        applicantName: z.string().optional(),
        applicantEmail: z.string().email().optional().or(z.literal("")).optional(),
        applicationId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const url =
        process.env["SUPABASE_URL"] ||
        process.env["VITE_SUPABASE_URL"] ||
        "";
      const service =
        process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
        process.env["SUPABASE_SECRET_KEY"] ||
        "";
      if (!url || !service) {
        return { ok: false as const, error: "server not configured" };
      }
      const admin = createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: roles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const ids = [...new Set((roles || []).map((r: { user_id: string }) => r.user_id).filter(Boolean))];
      if (!ids.length) return { ok: false as const, error: "no super admins" };
      const { data: profiles } = await admin
        .from("profiles")
        .select("email, full_name, auth_user_id")
        .in("auth_user_id", ids);
      const emails = [
        ...new Set(
          (profiles || [])
            .map((p: { email?: string | null }) => (p.email || "").trim().toLowerCase())
            .filter((e: string) => e.includes("@")),
        ),
      ];
      const { sendSuperAdminNewApplicationEmail } = await import("@/lib/email.server");
      let sent = 0;
      for (const to of emails) {
        const r = await sendSuperAdminNewApplicationEmail({
          to,
          schoolName: data.schoolName,
          trackingCode: data.trackingCode,
          applicantName: data.applicantName,
          applicantEmail: data.applicantEmail || null,
        });
        if (r.ok) sent += 1;
      }
      return { ok: sent > 0, sent };
    } catch (e) {
      console.warn("[email] super admin application", e);
      return { ok: false as const, error: "send failed" };
    }
  });
