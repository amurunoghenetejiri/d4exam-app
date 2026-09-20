/**
 * Publishes student exam camera JPEG frames to officer live-monitor
 * via Supabase Realtime (startLiveCamPublisher).
 * Also heartbeats exam_attempts so officers discover active writers.
 */
import { useEffect, useRef } from "react";
import { startLiveCamPublisher, type LiveCamPublisher } from "@/lib/live-video";
import { pulseExamAttempt } from "@/lib/cbt-attempt-heartbeat";

export function useLiveCamPublish(opts: {
  enabled: boolean;
  schoolId: string | null | undefined;
  studentId: string | null | undefined;
  examId: string | null | undefined;
  attemptId: string | null | undefined;
  stream: MediaStream | null;
  getStream?: () => MediaStream | null;
  getFaceStatus?: () => string;
  getAnsweredCount?: () => number;
  getTotalQuestions?: () => number;
  getTimeRemainingSec?: () => number | null;
  getStudentName?: () => string | null | undefined;
  getMatricNumber?: () => string | null | undefined;
  getCourseCode?: () => string | null | undefined;
  getExamTitle?: () => string | null | undefined;
  getTabSwitchCount?: () => number;
}) {
  const pubRef = useRef<LiveCamPublisher | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const schoolId = String(opts.schoolId || "");
    const studentId = String(opts.studentId || "");
    const examId = String(opts.examId || "");
    // Fall back to pending key so frames flow before attempt row is ready
    const attemptId =
      String(opts.attemptId || "").trim() ||
      (studentId && examId ? `pending:${studentId}:${examId}` : "");

    if (!opts.enabled || !schoolId || !studentId || !examId || !attemptId) {
      try {
        pubRef.current?.stop();
      } catch {
        /* ignore */
      }
      pubRef.current = null;
      return;
    }

    try {
      pubRef.current?.stop();
    } catch {
      /* ignore */
    }

    pubRef.current = startLiveCamPublisher({
      schoolId,
      attemptId,
      studentId,
      examId,
      getStream: () => {
        const o = optsRef.current;
        return o.getStream?.() || o.stream;
      },
      getFaceMeta: () => {
        const o = optsRef.current;
        const raw = String(o.getFaceStatus?.() || "ok").toLowerCase();
        const faceStatus =
          raw === "ok" || raw === "none" || raw === "multi" || raw === "unclear" || raw === "unavailable"
            ? raw
            : "ok";
        const stream = o.getStream?.() || o.stream;
        return {
          faceStatus,
          cameraActive: Boolean(stream),
          answeredCount: o.getAnsweredCount?.(),
          totalQuestions: o.getTotalQuestions?.(),
          timeRemainingSec: o.getTimeRemainingSec?.() ?? null,
          studentName: String(o.getStudentName?.() || "").trim() || undefined,
          matricNumber: String(o.getMatricNumber?.() || "").trim() || undefined,
          courseCode: String(o.getCourseCode?.() || "").trim() || undefined,
          examTitle: String(o.getExamTitle?.() || "").trim() || undefined,
          tabSwitchCount: o.getTabSwitchCount?.(),
        };
      },
      intervalMs: 350,
    });

    // Heartbeat so officer dashboard / monitor keep this attempt as LIVE
    const pulse = () => {
      const o = optsRef.current;
      void pulseExamAttempt(o.attemptId || attemptId, {
        answeredCount: o.getAnsweredCount?.(),
        totalQuestions: o.getTotalQuestions?.(),
        timeRemainingSec: o.getTimeRemainingSec?.() ?? null,
        tabSwitchCount: o.getTabSwitchCount?.(),
        faceStatus: String(o.getFaceStatus?.() || "ok"),
        cameraActive: Boolean(o.getStream?.() || o.stream),
      });
    };
    pulse();
    const hb = window.setInterval(pulse, 8_000);

    return () => {
      window.clearInterval(hb);
      try {
        pubRef.current?.stop();
      } catch {
        /* ignore */
      }
      pubRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.enabled,
    opts.schoolId,
    opts.studentId,
    opts.examId,
    opts.attemptId,
    // stream omitted on purpose: getStream() always reads the latest MediaStream after reconnect
  ]);
}
