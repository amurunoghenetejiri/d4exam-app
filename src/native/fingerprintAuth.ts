/**
 * Fingerprint-only biometric auth for the native D4EXAM shell.
 * Uses the OS BiometricPrompt — never stores fingerprint data.
 * Face unlock is intentionally not preferred; we still accept isAvailable
 * when the device reports fingerprint or multiple biometrics.
 */
import { isNativeShell } from "@/native/platform";

export type FingerprintAvailability =
  | { ok: true; hasFingerprint: true }
  | {
      ok: false;
      reason:
        | "web"
        | "no_plugin"
        | "no_hardware"
        | "not_enrolled"
        | "no_fingerprint"
        | "timeout"
        | "unknown";
      message: string;
    };

export type FingerprintAuthResult =
  | { ok: true }
  | { ok: false; code: "cancelled" | "failed" | "unavailable" | "error" | "timeout"; message: string };

/**
 * Capgo @capgo/capacitor-native-biometric BiometryType enum (v7/v8):
 * NONE=0, TOUCH_ID=1, FACE_ID=2, FINGERPRINT=3, FACE_AUTHENTICATION=4,
 * IRIS_AUTHENTICATION=5, MULTIPLE=6, DEVICE_CREDENTIAL=7
 */
const BiometryType = {
  NONE: 0,
  TOUCH_ID: 1,
  FACE_ID: 2,
  FINGERPRINT: 3,
  FACE_AUTHENTICATION: 4,
  IRIS_AUTHENTICATION: 5,
  MULTIPLE: 6,
  DEVICE_CREDENTIAL: 7,
} as const;

const CHECK_TIMEOUT_MS = 8_000;
const AUTH_TIMEOUT_MS = 45_000;

async function loadPlugin(): Promise<null | {
  isAvailable: (opts?: { useFallback?: boolean }) => Promise<{
    isAvailable: boolean;
    biometryType?: number;
    errorCode?: number;
    authenticationStrength?: number;
  }>;
  verifyIdentity: (opts: Record<string, unknown>) => Promise<void>;
}> {
  if (!isNativeShell()) return null;
  try {
    const mod = await import("@capgo/capacitor-native-biometric");
    const plugin = (mod as { NativeBiometric?: unknown }).NativeBiometric;
    if (!plugin || typeof (plugin as { isAvailable?: unknown }).isAvailable !== "function") {
      return null;
    }
    return plugin as never;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, ms);
    promise
      .then((v) => {
        window.clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(t);
        reject(e);
      });
  });
}

/** Prefer fingerprint / touch; allow MULTIPLE. Reject pure face-only if we can detect it. */
function acceptsFingerprintBiometry(biometryType: number | undefined): boolean {
  if (biometryType == null || !Number.isFinite(biometryType)) return true;
  const t = Number(biometryType);
  if (t === BiometryType.FINGERPRINT) return true;
  if (t === BiometryType.TOUCH_ID) return true;
  if (t === BiometryType.MULTIPLE) return true;
  // FACE_ID / FACE_AUTHENTICATION / IRIS — still allow if isAvailable said true
  // (many Android devices report face hardware but still accept fingerprint via BiometricPrompt).
  if (t === BiometryType.FACE_ID || t === BiometryType.FACE_AUTHENTICATION) return true;
  if (t === BiometryType.IRIS_AUTHENTICATION) return true;
  if (t === BiometryType.NONE || t === BiometryType.DEVICE_CREDENTIAL) return false;
  return t > 0;
}

export async function checkFingerprintAvailable(): Promise<FingerprintAvailability> {
  if (!isNativeShell()) {
    return {
      ok: false,
      reason: "web",
      message: "Fingerprint unlock is only available in the D4EXAM Android app.",
    };
  }
  const plugin = await loadPlugin();
  if (!plugin) {
    return {
      ok: false,
      reason: "no_plugin",
      message:
        "Fingerprint unlock is not available in this app build. Install the latest APK (Capacitor 8 + biometric plugin).",
    };
  }
  try {
    const info = await withTimeout(
      plugin.isAvailable({ useFallback: false }),
      CHECK_TIMEOUT_MS,
      "fp_check",
    );
    if (!info?.isAvailable) {
      const code = info?.errorCode;
      // Capgo: 3 = BIOMETRICS_NOT_ENROLLED (also seen as 1 in older mappings)
      if (code === 3 || code === 1 || code === -1) {
        return {
          ok: false,
          reason: "not_enrolled",
          message:
            "No fingerprint is enrolled on this device. Add one in system Settings, then try again.",
        };
      }
      return {
        ok: false,
        reason: "no_hardware",
        message: "Fingerprint unlock is not available on this device.",
      };
    }
    if (!acceptsFingerprintBiometry(info.biometryType)) {
      return {
        ok: false,
        reason: "no_fingerprint",
        message: "This device does not support fingerprint unlock for D4EXAM.",
      };
    }
    return { ok: true, hasFingerprint: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "").toLowerCase();
    if (msg.includes("timeout")) {
      return {
        ok: false,
        reason: "timeout",
        message: "Fingerprint check timed out. Try again.",
      };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "Could not check fingerprint availability on this device.",
    };
  }
}

export async function authenticateWithFingerprint(opts?: {
  reason?: string;
  title?: string;
  subtitle?: string;
}): Promise<FingerprintAuthResult> {
  const availability = await checkFingerprintAvailable();
  if (!availability.ok) {
    return { ok: false, code: "unavailable", message: availability.message };
  }
  const plugin = await loadPlugin();
  if (!plugin) {
    return {
      ok: false,
      code: "unavailable",
      message: "Fingerprint unlock is not available in this app build.",
    };
  }
  try {
    await withTimeout(
      plugin.verifyIdentity({
        reason: opts?.reason || "Unlock D4EXAM with your fingerprint",
        title: opts?.title || "D4EXAM",
        subtitle: opts?.subtitle || "Use your fingerprint to continue",
        description: "Place your finger on the sensor",
        negativeButtonText: "Cancel",
        maxAttempts: 5,
        useFallback: false,
      }),
      AUTH_TIMEOUT_MS,
      "fp_auth",
    );
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "").toLowerCase();
    if (msg.includes("timeout")) {
      return {
        ok: false,
        code: "timeout",
        message: "Fingerprint prompt timed out. Try again.",
      };
    }
    if (
      msg.includes("cancel") ||
      msg.includes("user cancel") ||
      msg.includes("canceled") ||
      msg.includes("dismiss")
    ) {
      return { ok: false, code: "cancelled", message: "Fingerprint cancelled." };
    }
    if (msg.includes("lockout") || msg.includes("too many")) {
      return {
        ok: false,
        code: "failed",
        message: "Too many failed attempts. Use password login or try again later.",
      };
    }
    if (msg.includes("not available") || msg.includes("no biometrics")) {
      return {
        ok: false,
        code: "unavailable",
        message: "Fingerprint is temporarily unavailable on this device.",
      };
    }
    return {
      ok: false,
      code: "failed",
      message: "Fingerprint not recognised. Try again or use password login.",
    };
  }
}
