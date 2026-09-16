/**
 * Fingerprint biometric auth for the native D4EXAM shell.
 * Uses OS BiometricPrompt — never stores fingerprint data.
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
  | {
      ok: false;
      code: "cancelled" | "failed" | "unavailable" | "error" | "timeout";
      message: string;
    };

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

const LOAD_TIMEOUT_MS = 4_000;
const CHECK_TIMEOUT_MS = 6_000;
const AUTH_TIMEOUT_MS = 30_000;

type NativeBiometricPlugin = {
  isAvailable: (opts?: { useFallback?: boolean }) => Promise<{
    isAvailable: boolean;
    biometryType?: number;
    errorCode?: number;
    authenticationStrength?: number;
  }>;
  verifyIdentity: (opts: Record<string, unknown>) => Promise<void>;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
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

async function loadPlugin(): Promise<NativeBiometricPlugin | null> {
  if (!isNativeShell()) return null;
  try {
    // Capacitor bridge present?
    const cap = (window as unknown as {
      Capacitor?: { isPluginAvailable?: (n: string) => boolean };
    }).Capacitor;
    if (cap?.isPluginAvailable && !cap.isPluginAvailable("NativeBiometric")) {
      // Plugin JS may still exist; native side not registered — fail fast
      // (still try import in case name differs)
    }

    const mod = await withTimeout(
      import("@capgo/capacitor-native-biometric"),
      LOAD_TIMEOUT_MS,
      "fp_load",
    );
    const plugin = (mod as { NativeBiometric?: NativeBiometricPlugin }).NativeBiometric;
    if (!plugin || typeof plugin.isAvailable !== "function") return null;
    return plugin;
  } catch {
    return null;
  }
}

function acceptsBiometry(biometryType: number | undefined): boolean {
  if (biometryType == null || !Number.isFinite(biometryType)) return true;
  const t = Number(biometryType);
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
        "Fingerprint is not in this app build. Install the latest D4EXAM APK from Settings or the download link, then try again.",
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
      if (code === 3 || code === 1 || code === -1) {
        return {
          ok: false,
          reason: "not_enrolled",
          message:
            "No fingerprint is enrolled on this device. Add one in Android Settings → Security, then try again.",
        };
      }
      return {
        ok: false,
        reason: "no_hardware",
        message: "Fingerprint unlock is not available on this device.",
      };
    }
    if (!acceptsBiometry(info.biometryType)) {
      return {
        ok: false,
        reason: "no_fingerprint",
        message: "This device does not support biometric unlock for D4EXAM.",
      };
    }
    return { ok: true, hasFingerprint: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "").toLowerCase();
    if (msg.includes("timeout")) {
      return {
        ok: false,
        reason: "timeout",
        message: "Fingerprint check timed out. Close and reopen the app, then try again.",
      };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "Could not check fingerprint on this device.",
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
    if (msg.includes("not available") || msg.includes("no biometrics") || msg.includes("unimplemented")) {
      return {
        ok: false,
        code: "unavailable",
        message:
          "Fingerprint is not available in this app build. Install the latest D4EXAM APK.",
      };
    }
    return {
      ok: false,
      code: "failed",
      message: "Fingerprint not recognised. Try again or use password login.",
    };
  }
}
