import { createFileRoute } from "@tanstack/react-router";
import { LiveMonitorPage } from "@/routes/officer.live-monitor";
import { useTeacherContext } from "@/lib/teacher";
import { EmptyState } from "@/components/dashboard/kit";

export const Route = createFileRoute("/teacher/live-exams")({
  head: () => ({
    meta: [{ title: "Live Monitoring — D4EXAM" }],
  }),
  component: TeacherLiveMonitorPage,
});

function TeacherLiveMonitorPage() {
  const { data: teacher, isLoading } = useTeacherContext();

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (!teacher) {
    return (
      <EmptyState
        title="Teacher profile not found"
        description="Contact School Admin to link your teacher profile."
      />
    );
  }
  if (!teacher.courseIds?.length) {
    return (
      <EmptyState
        title="No courses assigned"
        description="You can monitor live exams once courses are assigned to you."
      />
    );
  }

  return (
    <LiveMonitorPage
      courseIds={teacher.courseIds}
      pageTitle="Live Monitoring"
    />
  );
}
