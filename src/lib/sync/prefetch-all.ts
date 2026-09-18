/**
 * Proactive offline cache fill — downloads ALL authorized user data while online
 * so the user does not need to open each page first.
 * Uses existing offline-cache + local-db mirror. Does not change Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import { offlineSet, OfflineKeys } from "@/lib/offline-cache";
import { mirrorByOfflineKey, mirrorSessionUser } from "@/lib/local-db/mirror";
import { isOnlineNow } from "@/lib/offline-sync";

export type PrefetchCtx = {
  userId: string;
  schoolId?: string | null;
  role?: string | null;
  profileId?: string | null;
  studentId?: string | null;
};

let running = false;

async function resolveStudentId(ctx: PrefetchCtx): Promise<string | null> {
  if (ctx.studentId) return ctx.studentId;
  if (!ctx.userId && !ctx.profileId) return null;
  try {
    let q = supabase.from("students").select("id").limit(1);
    if (ctx.profileId) q = q.eq("profile_id", ctx.profileId);
    else q = q.eq("user_id", ctx.userId);
    const { data } = await q.maybeSingle();
    return data?.id ? String(data.id) : null;
  } catch {
    return null;
  }
}

async function cache(userId: string, key: string, data: unknown, schoolId?: string | null) {
  await offlineSet(userId, key, data, { schoolId });
  await mirrorByOfflineKey(userId, key, data, { schoolId });
}

/**
 * Download and store profile, school, courses, exams, results, notifications,
 * materials index, and role dashboards. Safe to call often; skips when offline.
 */
export async function prefetchAllAuthorized(ctx: PrefetchCtx | null | undefined): Promise<{
  ok: boolean;
  keys: string[];
  errors: string[];
}> {
  const keys: string[] = [];
  const errors: string[] = [];
  if (!ctx?.userId || !isOnlineNow()) return { ok: false, keys, errors };
  if (running) return { ok: false, keys, errors: ["busy"] };
  running = true;

  const schoolId = ctx.schoolId ?? null;
  const role = String(ctx.role || "").toLowerCase();
  const studentId = (await resolveStudentId(ctx)) || null;

  try {
    // Session-shaped profile blob (no secrets)
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email, status, school_id, avatar_url")
        .eq("id", ctx.profileId || ctx.userId)
        .maybeSingle();
      if (profile) {
        await cache(ctx.userId, OfflineKeys.profile, profile, schoolId);
        keys.push(OfflineKeys.profile);
        await mirrorSessionUser({
          userId: ctx.userId,
          profileId: String(profile.id || ctx.profileId || ""),
          email: profile.email,
          fullName: profile.full_name,
          status: profile.status,
          schoolId: profile.school_id || schoolId,
          role: ctx.role,
          roles: ctx.role ? [ctx.role as never] : [],
        });
      }
    } catch (e) {
      errors.push(`profile:${e instanceof Error ? e.message : String(e)}`);
    }

    if (schoolId) {
      try {
        const { data: school } = await supabase
          .from("schools")
          .select("id, name, code, logo_url, status")
          .eq("id", schoolId)
          .maybeSingle();
        if (school) {
          await cache(ctx.userId, OfflineKeys.school, school, schoolId);
          await cache(ctx.userId, OfflineKeys.schoolIdentity, school, schoolId);
          keys.push(OfflineKeys.school);
        }
      } catch (e) {
        errors.push(`school:${e instanceof Error ? e.message : String(e)}`);
      }

      try {
        const { data: courses } = await supabase
          .from("courses")
          .select("id, code, name, school_id, status")
          .eq("school_id", schoolId)
          .limit(200);
        await cache(ctx.userId, OfflineKeys.courses, courses ?? [], schoolId);
        keys.push(OfflineKeys.courses);
      } catch (e) {
        errors.push(`courses:${e instanceof Error ? e.message : String(e)}`);
      }

      try {
        const { data: exams } = await supabase
          .from("examinations")
          .select(
            "id, title, status, scheduled_start, scheduled_end, duration_minutes, course_id, school_id, updated_at",
          )
          .eq("school_id", schoolId)
          .order("updated_at", { ascending: false })
          .limit(150);
        await cache(ctx.userId, OfflineKeys.studentDashboardExams, exams ?? [], schoolId);
        await cache(ctx.userId, OfflineKeys.studentExams, exams ?? [], schoolId);
        keys.push(OfflineKeys.studentExams);
      } catch (e) {
        errors.push(`exams:${e instanceof Error ? e.message : String(e)}`);
      }

      try {
        const { data: materials } = await supabase
          .from("course_materials")
          .select("id, title, course_id, school_id, file_url, mime_type, created_at, updated_at")
          .eq("school_id", schoolId)
          .order("updated_at", { ascending: false })
          .limit(120);
        await cache(ctx.userId, OfflineKeys.materialsIndex, materials ?? [], schoolId);
        keys.push(OfflineKeys.materialsIndex);
      } catch {
        // table name may differ — try materials
        try {
          const { data: materials } = await supabase
            .from("materials")
            .select("id, title, course_id, school_id, file_url, created_at")
            .eq("school_id", schoolId)
            .limit(120);
          await cache(ctx.userId, OfflineKeys.materialsIndex, materials ?? [], schoolId);
          keys.push(OfflineKeys.materialsIndex);
        } catch (e2) {
          errors.push(`materials:${e2 instanceof Error ? e2.message : String(e2)}`);
        }
      }
    }

    // Notifications for this user
    try {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id, title, message, type, link, href, read_at, created_at, recipient_user_id, user_id, school_id")
        .or(`recipient_user_id.eq.${ctx.userId},user_id.eq.${ctx.userId}`)
        .order("created_at", { ascending: false })
        .limit(150);
      await cache(ctx.userId, OfflineKeys.notifications, notifs ?? [], schoolId);
      await cache(ctx.userId, OfflineKeys.studentDashboardNotifs, notifs ?? [], schoolId);
      keys.push(OfflineKeys.notifications);
    } catch (e) {
      errors.push(`notifications:${e instanceof Error ? e.message : String(e)}`);
    }

    // Student-only: results + attempts + context
    if (role === "student" && studentId) {
      try {
        const { data: results } = await supabase
          .from("results")
          .select("id, student_id, exam_id, school_id, score, max_score, total_score, published, updated_at, created_at")
          .eq("student_id", studentId)
          .order("updated_at", { ascending: false })
          .limit(100);
        await cache(ctx.userId, OfflineKeys.studentResults, results ?? [], schoolId);
        await cache(ctx.userId, OfflineKeys.studentDashboardResults, results ?? [], schoolId);
        keys.push(OfflineKeys.studentResults);
      } catch (e) {
        errors.push(`results:${e instanceof Error ? e.message : String(e)}`);
      }

      try {
        const { data: attempts } = await supabase
          .from("exam_attempts")
          .select("id, exam_id, student_id, status, tab_switch_count, updated_at, created_at")
          .eq("student_id", studentId)
          .order("updated_at", { ascending: false })
          .limit(80);
        await cache(ctx.userId, OfflineKeys.studentExamAttempts, attempts ?? [], schoolId);
        await cache(ctx.userId, OfflineKeys.studentDashboardAttempts, attempts ?? [], schoolId);
        keys.push(OfflineKeys.studentExamAttempts);
      } catch (e) {
        errors.push(`attempts:${e instanceof Error ? e.message : String(e)}`);
      }

      try {
        const { data: student } = await supabase
          .from("students")
          .select("id, full_name, matric_number, student_id, school_id, profile_id, level, department")
          .eq("id", studentId)
          .maybeSingle();
        if (student) {
          await cache(ctx.userId, OfflineKeys.studentContext, student, schoolId);
          keys.push(OfflineKeys.studentContext);
        }
      } catch (e) {
        errors.push(`studentContext:${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Soft settings marker
    await cache(
      ctx.userId,
      OfflineKeys.settings,
      {
        lastFullPrefetchAt: Date.now(),
        role,
        schoolId,
        studentId,
      },
      schoolId,
    );
    keys.push(OfflineKeys.settings);

    if (typeof console !== "undefined") {
      console.info("[prefetch-all]", keys.length, "keys", errors.length ? errors : "ok");
    }
    return { ok: errors.length === 0, keys, errors };
  } finally {
    running = false;
  }
}
