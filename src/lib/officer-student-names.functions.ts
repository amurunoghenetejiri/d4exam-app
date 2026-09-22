/**
 * Resolve student display names for officers (bypasses client RLS gaps).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolveStudentNamesForOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { schoolId: string; studentIds: string[] }) => data)
  .handler(
    async ({
      data,
      context,
    }: {
      data: { schoolId: string; studentIds: string[] };
      context: { userId: string };
    }): Promise<Record<string, { full_name: string; matric_number: string | null; student_id: string | null }>> => {
      const schoolId = String(data?.schoolId || "").trim();
      const studentIds = [...new Set((data?.studentIds || []).map(String).filter(Boolean))].slice(0, 300);
      if (!schoolId || !studentIds.length) return {};

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const userId = context.userId;

      // Caller must belong to this school (any staff role)
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, school_id")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (!profile || String((profile as { school_id?: string }).school_id) !== schoolId) {
        return {};
      }

      const { data: studs } = await supabaseAdmin
        .from("students")
        .select("id, full_name, matric_number, student_id, profile_id")
        .eq("school_id", schoolId)
        .in("id", studentIds);

      const out: Record<string, { full_name: string; matric_number: string | null; student_id: string | null }> = {};
      const needProfiles: { studentId: string; profileId: string }[] = [];

      for (const s of studs ?? []) {
        const id = String((s as { id: string }).id);
        const fn = String((s as { full_name?: string | null }).full_name || "").trim();
        const mat = (s as { matric_number?: string | null }).matric_number ?? null;
        const sid = (s as { student_id?: string | null }).student_id ?? null;
        const pid = (s as { profile_id?: string | null }).profile_id;
        out[id] = { full_name: fn, matric_number: mat, student_id: sid };
        if (!fn && pid) needProfiles.push({ studentId: id, profileId: String(pid) });
      }

      if (needProfiles.length) {
        const pids = [...new Set(needProfiles.map((x) => x.profileId))];
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", pids);
        const pmap = new Map<string, string>();
        for (const pr of profiles ?? []) {
          const pid = String((pr as { id: string }).id);
          const full = String((pr as { full_name?: string }).full_name || "").trim();
          const first = String((pr as { first_name?: string | null }).first_name || "").trim();
          const last = String((pr as { last_name?: string | null }).last_name || "").trim();
          const composed = full || [first, last].filter(Boolean).join(" ");
          if (composed) pmap.set(pid, composed);
        }
        for (const n of needProfiles) {
          const name = pmap.get(n.profileId);
          if (name && out[n.studentId]) out[n.studentId].full_name = name;
        }
      }

      return out;
    },
  );
