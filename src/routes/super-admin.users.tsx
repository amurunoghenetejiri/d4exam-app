import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Filter } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dashboard/kit";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidate } from "@/lib/realtime";

export const Route = createFileRoute("/super-admin/users")({
  head: () => ({
    meta: [
      { title: "Platform Users — D4EXAM" },
      { name: "description", content: "All people across every school on D4EXAM." },
    ],
  }),
  component: Page,
});

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  school_id: string | null;
  schoolName: string;
  roles: string[];
};

const ROLE_FILTERS = [
  { id: "all", label: "All roles" },
  { id: "student", label: "Student" },
  { id: "teacher", label: "Teacher" },
  { id: "examination_officer", label: "Dept. Officer" },
  { id: "school_admin", label: "School Admin" },
  { id: "super_admin", label: "Super Admin" },
] as const;

function roleLabel(r: string) {
  const m: Record<string, string> = {
    student: "Student",
    teacher: "Teacher",
    examination_officer: "Dept. Officer",
    school_admin: "School Admin",
    super_admin: "Super Admin",
  };
  return m[r] || r;
}

function roleTone(r: string) {
  const m: Record<string, string> = {
    student: "bg-sky-100 text-sky-800",
    teacher: "bg-violet-100 text-violet-800",
    examination_officer: "bg-amber-100 text-amber-900",
    school_admin: "bg-emerald-100 text-emerald-800",
    super_admin: "bg-indigo-100 text-indigo-900",
  };
  return m[r] || "bg-slate-100 text-slate-700";
}

function Page() {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");

  useRealtimeInvalidate(
    "sa-users",
    [{ table: "profiles" }, { table: "user_roles" }, { table: "schools" }],
    [["super-admin-users-v2"]],
    true,
  );

  const listQ = useQuery({
    queryKey: ["super-admin-users-v2"],
    staleTime: 15_000,
    refetchInterval: 45_000,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: schools }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, status, school_id, auth_user_id")
          .order("created_at", { ascending: false })
          .limit(4000),
        supabase.from("user_roles").select("user_id, role").limit(8000),
        supabase.from("schools").select("id, name").limit(2000),
      ]);

      const schoolMap = new Map<string, string>();
      for (const s of schools ?? []) {
        const row = s as { id: string; name: string };
        schoolMap.set(row.id, row.name);
      }

      const rolesByAuth = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const row = r as { user_id: string; role: string };
        const list = rolesByAuth.get(row.user_id) ?? [];
        if (row.role && !list.includes(row.role)) list.push(row.role);
        rolesByAuth.set(row.user_id, list);
      }

      const out: Row[] = [];
      for (const p of profiles ?? []) {
        const row = p as {
          id: string;
          full_name: string | null;
          email: string | null;
          status: string | null;
          school_id: string | null;
          auth_user_id: string;
        };
        out.push({
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          status: row.status,
          school_id: row.school_id,
          schoolName: row.school_id ? schoolMap.get(row.school_id) || "—" : "Platform",
          roles: rolesByAuth.get(row.auth_user_id) ?? [],
        });
      }
      return out;
    },
  });

  const schools = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of listQ.data ?? []) {
      if (r.school_id) set.set(r.school_id, r.schoolName);
    }
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [listQ.data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => {
      if (roleFilter !== "all" && !r.roles.includes(roleFilter)) return false;
      if (schoolFilter !== "all" && r.school_id !== schoolFilter) return false;
      if (!term) return true;
      return [r.full_name, r.email, r.schoolName, r.roles.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [listQ.data, q, roleFilter, schoolFilter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform Users"
        description="Name, email, school, and role across every institution. Filter and search live."
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 pl-9"
            placeholder="Search name, email, school…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRoleFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
                roleFilter === f.id
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSchoolFilter("all")}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            schoolFilter === "all" ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-600",
          )}
        >
          All schools
        </button>
        {schools.map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSchoolFilter(id)}
            className={cn(
              "max-w-[160px] truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              schoolFilter === id ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-600",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
          Users ({filtered.length})
        </div>
        {listQ.isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading platform users…</p>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No users match" description="Try another filter or search term." icon={Users} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">School</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 transition hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.full_name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 sm:text-sm">{r.email || "—"}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{r.schoolName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.roles.length ? r.roles : ["—"]).map((role) => (
                          <span
                            key={role}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold",
                              role === "—" ? "bg-slate-100 text-slate-500" : roleTone(role),
                            )}
                          >
                            {role === "—" ? "—" : roleLabel(role)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                          (r.status || "").toLowerCase() === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {r.status || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
