import { useEffect, useRef } from "react";
import { pulseExamAttempt, type AttemptPulseStats } from "@/lib/cbt-attempt-heartbeat";

/** Keep exam_attempts.updated_at / metadata live while writing (officer monitor). */
export function useExamAttemptHeartbeat(opts: {
  enabled: boolean;
  attemptId: string | null | undefined;
  getStats?: () => AttemptPulseStats | null | undefined;
}) {
  const idRef = useRef(opts.attemptId);
  idRef.current = opts.attemptId;
  const getStatsRef = useRef(opts.getStats);
  getStatsRef.current = opts.getStats;

  useEffect(() => {
    if (!opts.enabled) return;
    const id = String(opts.attemptId || "");
    if (!id) return;
    const tick = () => {
      const stats = getStatsRef.current?.() || null;
      void pulseExamAttempt(idRef.current, stats);
    };
    tick();
    const t = window.setInterval(tick, 8_000);
    return () => window.clearInterval(t);
  }, [opts.enabled, opts.attemptId]);
}
