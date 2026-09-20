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
