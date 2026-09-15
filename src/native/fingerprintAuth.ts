/**
 * Fingerprint-only biometric auth for the native D4EXAM shell.
 * Uses the OS BiometricPrompt — never stores fingerprint data.
 * Face unlock is intentionally not offered or preferred.
 */
import { isNativeShell } from "@/native/platform";

export type FingerprintAvailability =
  | { ok: true; hasFingerprint: true }
  | { ok: false; reason: "web" | "no_plugin" | "no_hardware" | "not_enrolled" | "no_fingerprint" | "unknown"; message: string };

export type FingerprintAuthResult =
  | { ok: true }
  | { ok: false; code: "cancelled" | "failed" | "unavailable" | "error"; message: string };

/** Biometry type codes used by @capgo/capacitor-native-biometric */
const TYPE_FINGERPRINT = 1;
const TYPE_FACE = 2;
const TYPE_IRIS = 3;
const TYPE_MULTIPLE = 4;

async function loadPlugin(): Promise<null | {
  isAvailable: () => Promise<{ isAvailable: boolean; biometryType: number; errorCode?: number }>;
  verifyIdentity: (opts: Record<string, unknown>) => Promise<void>;
}> {
  if (!isNativeShell()) return null;
  try {
    const mod = await import("@capgo/capacitor-native-biometric");
    return mod.NativeBiometric as never;
  } catch {
    return null;
  }
}

function hasFingerprintType(biometryType: number): boolean {
  if (biometryType === TYPE_FINGERPRINT) return true;
  if (biometryType === TYPE_MULTIPLE) return true;
  if (biometryType === TYPE_FACE || biometryType === TYPE_IRIS) return false;
  return biometryType > 0;
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
      message: "Fingerprint unlock is not available in this app build. Install the latest APK.",
    };
  }
  try {
    const info = await plugin.isAvailable();
    if (!info?.isAvailable) {
      const code = info?.errorCode;
      if (code === 1 || code === -1) {
        return {
          ok: false,
          reason: "not_enrolled",
          message: "No fingerprint is enrolled on this device. Add one in system Settings, then try again.",
        };
      }
      return {
        ok: false,
        reason: "no_hardware",
        message: "Fingerprint unlock is not available on this device.",
      };
    }
    if (!hasFingerprintType(Number(info.biometryType))) {
      return {
        ok: false,
        reason: "no_fingerprint",
        message: "This device does not support fingerprint unlock for D4EXAM.",
      };
    }
    return { ok: true, hasFingerprint: true };
  } catch {
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
    await plugin.verifyIdentity({
      reason: opts?.reason || "Unlock D4EXAM with your fingerprint",
      title: opts?.title || "D4EXAM",
      subtitle: opts?.subtitle || "Use your fingerprint to continue",
      description: "Fingerprint authentication",
      negativeButtonText: "Cancel",
      maxAttempts: 5,
      useFallback: false,
    });
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "").toLowerCase();
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
