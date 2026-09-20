/**
 * CBT exam vibration — reliable on Capacitor Android + browser.
 * Prefers native ExamImmersive (amplitude 255); falls back to navigator.vibrate.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNativeShell } from "@/native/platform";

export type HapticKind =
  | "start"
  | "none"
  | "unclear"
  | "multi"
  | "camera_blocked"
  | "tab_switch"
  | "officer_warning"
  | "officer_pause"
  | "officer_submit"
  | "light"
  | "strong";

const DURATION: Record<HapticKind, number> = {
  start: 220,
  none: 280,       // soft pulse — no face
  unclear: 320,
  light: 280,
  tab_switch: 420,
  multi: 1600,     // hard triple-pulse — multiple faces
  strong: 1600,
  camera_blocked: 900,
  officer_pause: 700,
  officer_submit: 600,
  officer_warning: 800,
};

type ExamImmersivePlugin = {
  vibrate: (opts: { pattern?: number[]; ms?: number }) => Promise<{ ok?: boolean; error?: string }>;
};

const ExamImmersive = registerPlugin<ExamImmersivePlugin>("ExamImmersive");

let primed = false;
let lastFireAt = 0;

function pulsePattern(totalMs: number): number[] {
  const out: number[] = [0];
  let left = Math.max(200, totalMs);
  const on = 180;
  const gap = 40;
  while (left > 0) {
    const slice = Math.min(on, left);
    out.push(slice);
    left -= slice;
    if (left > 0) {
      out.push(gap);
      left -= gap;
    }
  }
  return out;
}

function useNative(): boolean {
  try {
    if (isNativeShell()) return true;
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function nativeVibrate(ms: number, pattern: number[]): Promise<boolean> {
  try {
    const ret = await ExamImmersive.vibrate({ ms, pattern });
    if (ret && ret.ok === false) return false;
    return true;
  } catch {
    return false;
  }
}

function webVibrate(pattern: number[] | number): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
    return Boolean(navigator.vibrate(pattern));
  } catch {
    return false;
  }
}

async function vibrateHard(ms: number): Promise<void> {
  // Single clean pulse — strong enough to notice, not harsh double-buzz
  const duration = Math.max(60, Math.min(Math.floor(ms), 1500));
  const solid: number[] = [0, duration];
  // Multi / strong: short-gap double for emphasis without long disturbance
  // Triple pulse for multi / strong so student clearly feels it
  const multiPattern: number[] =
    duration >= 700
      ? [0, Math.floor(duration * 0.4), 60, Math.floor(duration * 0.3), 60, Math.floor(duration * 0.25)]
      : solid;

  if (useNative()) {
    const pattern = duration >= 700 ? multiPattern : solid;
    let ok = await nativeVibrate(duration, pattern);
    if (!ok) ok = await nativeVibrate(duration, solid);
    if (ok) return;
  }

  if (duration >= 700) {
    if (webVibrate(multiPattern)) return;
  }
  webVibrate(solid);
}

export function canVibrate(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (useNative()) return true;
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  } catch {
    return false;
  }
}

export function primeHaptics() {
  primed = true;
  void vibrateHard(50);
}

export function refreshHapticUnlock() {
  primed = true;
}

export function haptic(kind: HapticKind) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  // Multi always gets priority — must fire even if a soft "none" just ran
  const isMulti = kind === "multi" || kind === "strong";
  const gap = isMulti ? 450 : 900; // none softer cadence; multi still noticeable
  if (now - lastFireAt < gap && !isMulti) return;
  if (isMulti && now - lastFireAt < 400) return;
  lastFireAt = now;
  primed = true;
  const ms = DURATION[kind] ?? 1500;
  void vibrateHard(ms);
}

export function hapticExamStart() {
  haptic("start");
}
export function hapticOfficerWarning() {
  haptic("officer_warning");
}
export function hapticFaceNone() {
  haptic("none");
}
export function hapticFaceMulti() {
  haptic("multi");
}
export function hapticLightWarning() {
  haptic("none");
}
export function hapticStrongWarning() {
  haptic("multi");
}
export function isHapticPrimed() {
  return primed;
}
