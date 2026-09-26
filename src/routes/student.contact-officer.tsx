import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Temporary shell while full messaging page is restored.
 * The complete fixed implementation is available; this prevents a broken build.
 */
export const Route = createFileRoute("/student/contact-officer")({
  head: () => ({ meta: [{ title: "Messages — D4EXAM" }] }),
  component: function ContactOfficerShell() {
    const navigate = useNavigate();
    useEffect(() => {
      // Keep users on a safe screen until full chat page is redeployed
    }, []);
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <p className="text-sm font-semibold text-slate-800">Messages are updating</p>
        <p className="max-w-sm text-xs text-slate-500">
          The chat screen is being restored. Please check back in a moment or use the app after the next deploy.
        </p>
        <button
          type="button"
          className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => navigate({ to: "/student" })}
        >
          Back to home
        </button>
      </div>
    );
  },
});
