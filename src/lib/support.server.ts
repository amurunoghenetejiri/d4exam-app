/**
 * Server-only support ticket submission.
 * Delivers every message to amurundestiny@gmail.com via Resend.
 * No secrets in client code — uses RESEND_API_KEY on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { sendEmail } from "@/lib/email.server";

export const SUPPORT_INBOX = "amurundestiny@gmail.com";
export const SUPPORT_PHONE = "08165906606";

export type SupportCategory =
  | "Technical Problem"
  | "Examination Problem"
  | "Account Problem"
  | "Result Problem"
  | "Payment/School Problem"
  | "Other";

export type SupportMessageInput = {
  subject: string;
  message: string;
  category: SupportCategory | string;
  /** Optional overrides when not signed in */
  name?: string;
  email?: string;
  role?: string;
  school?: string;
  route?: string;
};

function escapeHtml(s: string) {
  const amp = String.fromCharCode(38);
  return String(s)
    .replace(/&/g, amp + "amp;")
    .replace(/</g, amp + "lt;")
    .replace(/>/g, amp + "gt;")
    .replace(/"/g, amp + "quot;");
}

function sanitize(s: unknown, max = 4000): string {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

export const submitSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((data: Record<string, unknown>) => data)
  .handler(
  async ({ data }): Promise<{ ok: true; id?: string } | { ok: false; error: string }> => {
    const input = (data || {}) as SupportMessageInput;
    const subject = sanitize(input.subject, 200);
    const message = sanitize(input.message, 8000);
    const category = sanitize(input.category, 80) || "Other";
    const name = sanitize(input.name, 120);
    const email = sanitize(input.email, 200);
    const role = sanitize(input.role, 60);
    const school = sanitize(input.school, 200);
    const route = sanitize(input.route, 300);

    if (!subject) {
      return { ok: false, error: "Subject is required." };
    }
    if (!message || message.length < 5) {
      return { ok: false, error: "Please describe your issue in more detail." };
    }

    const when = new Date().toISOString();
    const ref = `SR-${Date.now().toString(36).toUpperCase()}`;

    const text = [
      `D4EXAM Support Request (${ref})`,
      ``,
      `Category: ${category}`,
      `Subject: ${subject}`,
      ``,
      `From name: ${name || "—"}`,
      `From email: ${email || "—"}`,
      `Role: ${role || "—"}`,
      `School: ${school || "—"}`,
      `Route/context: ${route || "—"}`,
      `Submitted at: ${when}`,
      ``,
      `Message:`,
      message,
      ``,
      `— D4EXAM platform (automated)`,
    ].join("\n");

    const html = [
      `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;line-height:1.5;">`,
      `<h1 style="font-size:18px;margin:0 0 12px;">D4EXAM Support Request</h1>`,
      `<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Reference <strong>${escapeHtml(ref)}</strong> · ${escapeHtml(when)}</p>`,
      `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">`,
      `<tr><td style="padding:6px 0;color:#64748b;width:120px;">Category</td><td style="padding:6px 0;"><strong>${escapeHtml(category)}</strong></td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b;">Subject</td><td style="padding:6px 0;">${escapeHtml(subject)}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b;">Name</td><td style="padding:6px 0;">${escapeHtml(name || "—")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;">${escapeHtml(email || "—")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b;">Role</td><td style="padding:6px 0;">${escapeHtml(role || "—")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b;">School</td><td style="padding:6px 0;">${escapeHtml(school || "—")}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#64748b;">Route</td><td style="padding:6px 0;">${escapeHtml(route || "—")}</td></tr>`,
      `</table>`,
      `<div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;white-space:pre-wrap;">${escapeHtml(message)}</div>`,
      `<p style="margin-top:16px;font-size:12px;color:#94a3b8;">Reply directly to the sender if an email was provided.</p>`,
      `</div>`,
    ].join("\n");

    const mailSubject = `[D4EXAM Support] [${category}] ${subject} (${ref})`;

    const result = await sendEmail({
      to: SUPPORT_INBOX,
      subject: mailSubject,
      html,
      text,
    });

    if (!result.ok) {
      return { ok: false, error: result.error || "Could not send support email." };
    }
    return { ok: true, id: result.id || ref };
  },
);
