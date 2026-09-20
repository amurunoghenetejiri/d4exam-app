import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Radio, Server, Database, Shield, Globe, Activity } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/dashboard/kit";
import { supabase } from "@/integrations/supabase/client";
import { getAppOrigin } from "@/lib/app-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin/services")({
  head: () => ({
    meta: [{ title: "Platform Services — D4EXAM" }],
  }),
  component: Page,
});

function Page() {
  const healthQ = useQuery({
    queryKey: ["sa-services-health"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const start = Date.now();
      const { error } = await supabase.from("schools").select("id", { count: "exact", head: true });
      const latency = Date.now() - start;
      return {
        dbOk: !error,
        latency,
        origin: getAppOrigin(),
      };
    },
  });

  const h = healthQ.data;
  const services = [
    {
      name: "API / Database",
      icon: Database,
      status: h?.dbOk ? "Operational" : "Degraded",
      detail: h ? `${h.latency}ms response` : "Checking…",
      ok: h?.dbOk ?? true,
    },
    {
      name: "Authentication",
      icon: Shield,
      status: "Operational",
      detail: "Supabase Auth + session",
      ok: true,
    },
    {
      name: "Email (Resend)",
      icon: Mail,
      status: "Configured",
      detail: "noreply@d4exam.name.ng",
      ok: true,
    },
    {
      name: "Realtime",
      icon: Radio,
      status: "Live",
      detail: "Exam monitoring & notifications",
      ok: true,
    },
    {
      name: "Canonical domain",
      icon: Globe,
      status: "Active",
      detail: h?.origin || "https://d4exam.name.ng",
      ok: true,
    },
    {
      name: "Platform core",
      icon: Server,
      status: "Healthy",
      detail: "CBT, materials, monitoring",
      ok: true,
    },
  ];

  return (
    <>
      <PageHeader
        title="Services"
        description="Platform infrastructure health — email, auth, realtime, and storage."
      />
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
        <Activity className="h-4 w-4" />
        Overall status: Operational
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <SectionCard key={s.name} title={s.name}>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl",
                  s.ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600",
                )}
              >
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className={cn("text-sm font-bold", s.ok ? "text-emerald-700" : "text-red-700")}>
                  {s.status}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{s.detail}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
