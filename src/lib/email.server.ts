/**
 * Server-only email helper (Resend).
 * RESEND_API_KEY on Vercel enables sending.
 * Never import this from client components.
 */
import { getAppOrigin, loginUrl as canonicalLoginUrl, appUrl } from "@/lib/app-url";

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string };

function escapeHtml(s: string) {
  const amp = String.fromCharCode(38);
  return String(s)
    .replace(/&/g, amp + "amp;")
    .replace(/</g, amp + "lt;")
    .replace(/>/g, amp + "gt;")
    .replace(/"/g, amp + "quot;");
}

/** Branded HTML shell — button CTA, no raw long URLs in the body. */
function brandedHtml(opts: {
  title: string;
  greeting: string;
  paragraphs: string[];
  buttonLabel?: string;
  buttonUrl?: string;
  footerNote?: string;
}): string {
  const origin = getAppOrigin();
  const paras = opts.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#334155;">${escapeHtml(p)}</p>`)
    .join("");
  const button =
    opts.buttonLabel && opts.buttonUrl
      ? `<p style="margin:24px 0 8px;text-align:center;">
          <a href="${escapeHtml(opts.buttonUrl)}" style="display:inline-block;background:#0b1b3a;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px;">
            ${escapeHtml(opts.buttonLabel)}
          </a>
        </p>`
      : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0b1b3a,#122548);padding:20px 24px;">
          <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:0.02em;">D4EXAM</div>
          <div style="color:#93c5fd;font-size:12px;margin-top:4px;">Smart. Secure. Seamless.</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${escapeHtml(opts.title)}</h1>
          <p style="margin:0 0 14px;font-size:15px;color:#334155;">${escapeHtml(opts.greeting)}</p>
          ${paras}
          ${button}
          ${
            opts.footerNote
              ? `<p style="margin:20px 0 0;font-size:12px;color:#64748b;">${escapeHtml(opts.footerNote)}</p>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
          © D4EXAM · <a href="${escapeHtml(origin)}" style="color:#64748b;">${escapeHtml(origin.replace(/^https?:\/\//, ""))}</a>
          <br/>This is an automated message. Do not reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from =
    process.env["EMAIL_FROM"] ||
    process.env["RESEND_FROM"] ||
    "D4EXAM <noreply@d4exam.name.ng>";

  const to = (params.to || "").trim().toLowerCase();
  if (!to || !to.includes("@") || to.endsWith(".local")) {
    return { ok: false, error: "Invalid or synthetic recipient email." };
  }
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY is not set — cannot send email");
    return { ok: false, error: "Email is not configured (missing RESEND_API_KEY on the server)." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      const msg = body.message || `Email provider error (${res.status})`;
      console.error("[email] send failed:", msg);
      return { ok: false, error: msg };
    }
    return { ok: true, id: body.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown email error";
    console.error("[email] send exception:", msg);
    return { ok: false, error: msg };
  }
}

export async function sendSchoolApprovalEmail(params: {
  to: string;
  applicantName: string;
  schoolName: string;
  schoolCode: string;
  adminEmail: string;
  adminPassword: string;
  officialEmail?: string | null;
  phone?: string | null;
}): Promise<SendEmailResult> {
  const loginUrl = canonicalLoginUrl();
  const subject = `Your school is approved on D4EXAM — ${params.schoolName}`;
  const text = [
    `Hello ${params.applicantName},`,
    `Your school "${params.schoolName}" has been approved on D4EXAM.`,
    `School code: ${params.schoolCode}`,
    `Admin email: ${params.adminEmail}`,
    `Sign in: ${loginUrl}`,
    `Change your password after first login.`,
  ].join("\n");

  const html = brandedHtml({
    title: "School application approved",
    greeting: `Hello ${params.applicantName},`,
    paragraphs: [
      `Your school "${params.schoolName}" has been approved on D4EXAM.`,
      `School / institution code: ${params.schoolCode}`,
      `Sign-in email: ${params.adminEmail}`,
      `A temporary password was set during approval. Sign in and change it immediately under Settings.`,
      "Use the button below to open D4EXAM.",
    ],
    buttonLabel: "Sign in to D4EXAM",
    buttonUrl: loginUrl,
    footerNote: "Keep your school code private. Only authorised staff should sign in.",
  });

  return sendEmail({ to: params.to, subject, html, text });
}

export async function sendSchoolApplicationReceivedEmail(params: {
  to: string;
  applicantName: string;
  schoolName: string;
  trackingCode: string;
}): Promise<SendEmailResult> {
  const statusUrl = appUrl("/application-status");
  const subject = `D4EXAM — School application received (${params.trackingCode})`;
  const html = brandedHtml({
    title: "Application received",
    greeting: `Hello ${params.applicantName || "Applicant"},`,
    paragraphs: [
      `We received your application for "${params.schoolName}".`,
      `Your reference code is ${params.trackingCode}. Keep it to check status.`,
      "Our team will review your application. You will get another email when there is an update.",
    ],
    buttonLabel: "Check application status",
    buttonUrl: statusUrl,
  });
  const text = `Hello ${params.applicantName}, we received your application for ${params.schoolName}. Reference: ${params.trackingCode}. Status: ${statusUrl}`;
  return sendEmail({ to: params.to, subject, html, text });
}

export async function sendStudentEmailLinkedEmail(params: {
  to: string;
  studentName: string;
}): Promise<SendEmailResult> {
  const subject = "D4EXAM — Your email is linked";
  const html = brandedHtml({
    title: "Email confirmed on D4EXAM",
    greeting: `Hello ${params.studentName || "Student"},`,
    paragraphs: [
      "You successfully linked this email address to your D4EXAM student account.",
      "Important notices will be sent here, including when examination results are released.",
      "If you did not make this change, sign in to D4EXAM and update your profile, or contact your school administrator.",
    ],
    buttonLabel: "Open D4EXAM",
    buttonUrl: canonicalLoginUrl(),
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `Hello ${params.studentName}, your email is now linked to D4EXAM for results and notices.`,
  });
}

export async function sendResultReleasedEmail(params: {
  to: string;
  studentName: string;
  examTitle: string;
  courseLabel?: string | null;
}): Promise<SendEmailResult> {
  const resultsUrl = appUrl("/student/results");
  const exam = params.courseLabel
    ? `${params.courseLabel} — ${params.examTitle}`
    : params.examTitle;
  const subject = `D4EXAM — Result released: ${params.examTitle}`;
  const html = brandedHtml({
    title: "Result published",
    greeting: `Hello ${params.studentName || "Student"},`,
    paragraphs: [
      `Your result for "${exam}" is now available on D4EXAM.`,
      "Sign in to view your score and details. Scores are only shown inside the app after official release.",
    ],
    buttonLabel: "View your result",
    buttonUrl: resultsUrl,
    footerNote: "Do not share your login details. Results are private to your account.",
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `Hello ${params.studentName}, your result for ${exam} is available: ${resultsUrl}`,
  });
}

export async function sendStaffWelcomeEmail(params: {
  to: string;
  fullName: string;
  role: "teacher" | "examination_officer" | "school_admin" | string;
  schoolName?: string | null;
  schoolCode?: string | null;
  identifier: string;
  password: string;
  departmentName?: string | null;
}): Promise<SendEmailResult> {
  const roleLabel =
    params.role === "examination_officer"
      ? "Departmental Officer"
      : params.role === "teacher"
        ? "Teacher"
        : params.role === "school_admin"
          ? "School Admin"
          : params.role;
  const subject = `D4EXAM — You have been added as ${roleLabel}`;
  const lines = [
    `You have been added to ${params.schoolName || "your school"} on D4EXAM as ${roleLabel}.`,
    params.departmentName ? `Department: ${params.departmentName}` : "",
    params.schoolCode ? `School code: ${params.schoolCode}` : "",
    `Login ID / staff ID: ${params.identifier}`,
    `Temporary password: ${params.password}`,
    "Sign in and change your password under Settings. Keep these details private.",
  ].filter(Boolean);
  const html = brandedHtml({
    title: `Welcome, ${roleLabel}`,
    greeting: `Hello ${params.fullName},`,
    paragraphs: lines,
    buttonLabel: "Sign in to D4EXAM",
    buttonUrl: canonicalLoginUrl(),
    footerNote: "Change your password after first login. Never share your credentials.",
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `Hello ${params.fullName},\n${lines.join("\n")}\n${canonicalLoginUrl()}`,
  });
}

export async function sendTeacherCoursesAssignedEmail(params: {
  to: string;
  fullName: string;
  schoolName?: string | null;
  courseLabels: string[];
}): Promise<SendEmailResult> {
  const list =
    params.courseLabels.length > 0
      ? params.courseLabels.slice(0, 20).join(", ")
      : "your assigned courses";
  const subject = "D4EXAM — Course assignment update";
  const html = brandedHtml({
    title: "Courses assigned to you",
    greeting: `Hello ${params.fullName},`,
    paragraphs: [
      params.schoolName
        ? `Your school (${params.schoolName}) has assigned or updated your courses on D4EXAM.`
        : "Your courses on D4EXAM have been updated.",
      `Courses: ${list}`,
      "Open My Courses to build question banks and create examinations for these papers.",
    ],
    buttonLabel: "Open teacher portal",
    buttonUrl: appUrl("/teacher"),
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `Hello ${params.fullName}, courses assigned: ${list}. ${appUrl("/teacher")}`,
  });
}

export async function sendOfficerExamSubmittedEmail(params: {
  to: string;
  officerName?: string | null;
  teacherName: string;
  examTitle: string;
  courseLabel?: string | null;
}): Promise<SendEmailResult> {
  const subject = `D4EXAM — Exam awaiting approval: ${params.examTitle}`;
  const course = params.courseLabel ? ` (${params.courseLabel})` : "";
  const html = brandedHtml({
    title: "Examination submitted for approval",
    greeting: `Hello ${params.officerName || "Departmental Officer"},`,
    paragraphs: [
      `${params.teacherName} submitted "${params.examTitle}"${course} for your review.`,
      "Open Approvals to preview the paper, then approve, request changes, or reject.",
    ],
    buttonLabel: "Open approvals",
    buttonUrl: appUrl("/officer/approvals"),
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `${params.teacherName} submitted ${params.examTitle} for approval. ${appUrl("/officer/approvals")}`,
  });
}

export async function sendWelcomeRoleEmail(params: {
  to: string;
  fullName: string;
  role: string;
}): Promise<SendEmailResult> {
  const role = (params.role || "").toLowerCase();
  let roleTitle = "User";
  let body: string[] = [];
  let home = canonicalLoginUrl();
  if (role.includes("student")) {
    roleTitle = "Student";
    body = [
      "Welcome to D4EXAM — the secure online examination platform for your school.",
      "From your dashboard you can sit published exams, view released results, and open course materials.",
      "Writing an exam requires a stable internet connection when the school requires online CBT.",
    ];
    home = appUrl("/student");
  } else if (role.includes("teacher")) {
    roleTitle = "Teacher";
    body = [
      "Welcome to D4EXAM as a Teacher.",
      "Build question banks, create examinations for your assigned courses, and submit papers for Departmental Officer approval.",
      "You can mark essay scripts and review analysis for your courses.",
    ];
    home = appUrl("/teacher");
  } else if (role.includes("officer") || role.includes("examination")) {
    roleTitle = "Departmental Officer";
    body = [
      "Welcome to D4EXAM as a Departmental Officer.",
      "You approve examinations, post papers to students, live-monitor writers, and release results for your school.",
    ];
    home = appUrl("/officer");
  } else if (role.includes("admin") && !role.includes("super")) {
    roleTitle = "School Admin";
    body = [
      "Welcome to D4EXAM as School Admin.",
      "Manage students, teachers, officers, academic structure, and school settings from your dashboard.",
    ];
    home = appUrl("/admin");
  } else {
    body = ["Welcome to D4EXAM. Sign in to continue to your workspace."];
  }
  const subject = `Welcome to D4EXAM — ${roleTitle}`;
  const html = brandedHtml({
    title: `Welcome, ${roleTitle}`,
    greeting: `Hello ${params.fullName || roleTitle},`,
    paragraphs: body,
    buttonLabel: "Open D4EXAM",
    buttonUrl: home,
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: `Welcome to D4EXAM, ${params.fullName}. ${home}`,
  });
}

export async function sendAppPasswordHelpEmail(params: {
  to: string;
  fullName?: string | null;
}): Promise<SendEmailResult> {
  const subject = "D4EXAM — App unlock password help";
  const html = brandedHtml({
    title: "App unlock password",
    greeting: `Hello ${params.fullName || "there"},`,
    paragraphs: [
      "Someone requested help with the D4EXAM app unlock password for an account linked to this email.",
      "The app unlock password is set on your device and is separate from your school login password.",
      "Sign in to D4EXAM with your school credentials, open Settings, and set a new app unlock password or fingerprint.",
      "If you did not request this, you can ignore this message.",
    ],
    buttonLabel: "Open D4EXAM",
    buttonUrl: canonicalLoginUrl(),
  });
  return sendEmail({
    to: params.to,
    subject,
    html,
    text: "D4EXAM app unlock help: sign in and set a new app unlock password under Settings.",
  });
}
