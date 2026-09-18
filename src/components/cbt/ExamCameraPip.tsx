import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic as fireHaptic, refreshHapticUnlock, type HapticKind } from "@/lib/haptic";
import { createFaceEngine, type FaceEngine } from "@/lib/face-detector";
import { toast } from "sonner";

type FaceState = "ok" | "none" | "multi" | "unclear" | "unavailable";
type CamConnState = "active" | "reconnecting" | "unavailable";
type SecurityAlertKind = "none" | "multi" | "unclear" | "camera_blocked";

function haptic(kind: SecurityAlertKind) {
  const map: Record<SecurityAlertKind, HapticKind> = {
    none: "none",
    unclear: "unclear",
    multi: "multi",
    camera_blocked: "camera_blocked",
  };
  fireHaptic(map[kind]);
}

export type FaceSecurityEvent = {
  kind: "none" | "multi" | "unclear" | "camera_blocked";
  faceCount?: number;
  at: number;
};

export type ExamCameraPipProps = {
  stream: MediaStream | null;
  faceDetection?: boolean;
  maxFaceWarnings?: number;
  onFaceSecurityEvent?: (ev: FaceSecurityEvent) => void;
  onCameraStatus?: (status: "active" | "reconnecting" | "unavailable") => void;
  className?: string;
};

const POS_KEY = "d4exam_cam_pip_pos_v1";

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x?: number; y?: number };
    if (typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(x: number, y: number) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ x, y }));
  } catch {
    /* ignore */
  }
}

export function ExamCameraPip({
  stream,
  faceDetection = false,
  maxFaceWarnings = 3,
  onFaceSecurityEvent,
  onCameraStatus,
  className,
}: ExamCameraPipProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<FaceEngine | null>(null);
  const rafRef = useRef<number>(0);
  const lastCountRef = useRef<number | null>(null);
  const lastEmitRef = useRef(0);
  const faceSessionStartRef = useRef(Date.now());
  const warnCountRef = useRef(0);
  const [faceState, setFaceState] = useState<FaceState>("unavailable");
  const [camConn, setCamConn] = useState<CamConnState>("reconnecting");
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const WARMUP_MS = 20_000;
  const [warmupDone, setWarmupDone] = useState(!faceDetection);
  const [pos, setPos] = useState(() => loadPos() ?? { x: 12, y: 72 });
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);

  const setConn = useCallback(
    (s: CamConnState) => {
      setCamConn(s);
      onCameraStatus?.(s);
    },
    [onCameraStatus],
  );

  // Attach stream to video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      void v.play().catch(() => {});
      setConn("active");
    } else {
      v.srcObject = null;
      setConn("unavailable");
    }
  }, [stream, setConn]);

  // Face engine + loop with 20s warmup
  useEffect(() => {
    if (!faceDetection) {
      setWarmupDone(true);
      setFaceState("unavailable");
      return;
    }
    let cancelled = false;
    faceSessionStartRef.current = Date.now();
    setWarmupDone(false);
    setFaceState("unavailable");

    const warmupTimer = window.setTimeout(() => {
      if (!cancelled) setWarmupDone(true);
    }, WARMUP_MS);

    (async () => {
      const engine = await createFaceEngine();
      if (cancelled) {
        engine?.close();
        return;
      }
      engineRef.current = engine;
      if (!engine) {
        setFaceState("unavailable");
        return;
      }

      const tick = async () => {
        if (cancelled) return;
        const v = videoRef.current;
        const eng = engineRef.current;
        if (!v || !eng || camConn !== "active") {
          rafRef.current = window.setTimeout(tick, 400) as unknown as number;
          return;
        }
        // During warmup: do not emit security events, show detecting label
        if (Date.now() - faceSessionStartRef.current < WARMUP_MS) {
          rafRef.current = window.setTimeout(tick, 350) as unknown as number;
          return;
        }
        try {
          const n = await eng.count(v);
          if (cancelled) return;
          lastCountRef.current = n;
          setFaceCount(n);
          let state: FaceState = "unavailable";
          if (n === null) state = "unclear";
          else if (n === 0) state = "none";
          else if (n === 1) state = "ok";
          else if (n > 1) state = "multi";
          setFaceState(state);

          const now = Date.now();
          if (now - lastEmitRef.current > 1200) {
            lastEmitRef.current = now;
            if (state === "none") {
              warnCountRef.current += 1;
              onFaceSecurityEvent?.({ kind: "none", faceCount: 0, at: now });
              haptic("none");
            } else if (state === "multi") {
              warnCountRef.current += 1;
              onFaceSecurityEvent?.({ kind: "multi", faceCount: n ?? 2, at: now });
              haptic("multi");
            } else if (state === "unclear") {
              onFaceSecurityEvent?.({ kind: "unclear", at: now });
            }
          }
        } catch {
          setFaceState("unclear");
        }
        rafRef.current = window.setTimeout(tick, 320) as unknown as number;
      };
      rafRef.current = window.setTimeout(tick, 200) as unknown as number;
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(warmupTimer);
      window.clearTimeout(rafRef.current);
      try {
        engineRef.current?.close();
      } catch {
        /* ignore */
      }
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceDetection]);

  // Track stream live state
  useEffect(() => {
    if (!stream) {
      setConn("unavailable");
      return;
    }
    const check = () => {
      const live = stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled !== false);
      setConn(live ? "active" : "reconnecting");
    };
    check();
    const id = window.setInterval(check, 1500);
    return () => window.clearInterval(id);
  }, [stream, setConn]);

  useEffect(() => {
    refreshHapticUnlock();
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX, oy: e.clientY, sx: pos.x, sy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    const nx = Math.max(4, Math.min(window.innerWidth - 130, dragRef.current.sx + dx));
    const ny = Math.max(4, Math.min(window.innerHeight - 160, dragRef.current.sy + dy));
    setPos({ x: nx, y: ny });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    savePos(pos.x, pos.y);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const inWarmup = Boolean(faceDetection) && camConn === "active" && !warmupDone;
  const faceLabel =
    camConn !== "active"
      ? camConn === "reconnecting"
        ? "Camera reconnecting…"
        : "Camera off"
      : inWarmup
        ? "Face detecting…"
        : faceState === "ok"
          ? "1 face"
          : faceState === "multi"
            ? `${faceCount ?? 2}+ faces`
            : faceState === "none"
              ? "No face"
              : faceState === "unclear"
                ? "Checking…"
                : "Detecting…";

  return (
    <div
      className={cn(
        "fixed z-[100] w-[120px] touch-none overflow-hidden rounded-xl border-2 border-white/80 bg-black shadow-2xl sm:w-[148px]",
        className,
      )}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        <GripVertical className="h-3 w-3 opacity-70" />
        <span className="truncate">Camera</span>
      </div>
      <div className="relative aspect-[3/4] w-full bg-slate-900">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {camConn !== "active" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-center text-[10px] text-white">
            {camConn === "reconnecting" ? "Reconnecting…" : "No camera"}
          </div>
        )}
      </div>
      <div
        className={cn(
          "px-1.5 py-1 text-center text-[10px] font-bold leading-tight",
          inWarmup
            ? "bg-amber-500 text-black"
            : faceState === "ok"
              ? "bg-emerald-600 text-white"
              : faceState === "multi" || faceState === "none"
                ? "bg-rose-600 text-white"
                : "bg-slate-700 text-white",
        )}
      >
        {faceLabel}
      </div>
    </div>
  );
}
