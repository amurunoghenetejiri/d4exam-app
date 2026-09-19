/**
 * Fingerprint auth for native D4EXAM (Android).
 * Opens the system BiometricPrompt — never stores fingerprint data.
 * Must be called from a user gesture (button tap) or from the lock gate.
 *
 * Fingerprint only — face unlock is disabled via useFallback: false and
 * biometryType preference where the plugin supports it.
 */
import { registerPlugin } from "@capacitor/core";
import { isNativeShell } from "@/native/platform";

export type FingerprintAvailability =
  | { ok: true; hasFingerprint: true }
  | {
      ok: false;
      reason: "web" | "no_plugin" | "no_hardware" | "not_enrolled" | "timeout" | "unknown";
      message: string;
    };

export type FingerprintAuthResult =
  | { ok: true }
  | {
      ok: false;
      code: "cancelled" | "failed" | "unavailable" | "error" | "timeout";
      message: string;
    };

/** Capgo biometryType: 1=TOUCH_ID, 2=FACE_ID, 3=FINGERPRINT, 4=FACE_AUTHENTICATION, 5=IRIS */
const BIOMETRY_FINGERPRINT = 3;

type NativeBiometricPlugin = {
  isAvailable: (opts?: { useFallback?: boolean }) => Promise<{
    isAvailable: boolean;
    biometryType?: number;
    errorCode?: number;
  }>;
  verifyIdentity: (opts: Record<string, unknown>) => Promise<void>;
};

const LOAD_MS = 2_500;
const CHECK_MS = 4_000;
const AUTH_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const t = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`${label}_timeout`));
    }, ms);
    promise.then(
      (v) => {
        if (done) return;
        done = true;
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        if (done) return;
        done = true;
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

let cachedPlugin: NativeBiometricPlugin | null | undefined;

/**
 * Prefer Capacitor registerPlugin (works after cap sync) so we don't hang
 * on dynamic import in the WebView.
 */
function getPluginSync(): NativeBiometricPlugin | null {
  if (!isNativeShell()) return null;
  if (cachedPlugin !== undefined) return cachedPlugin;

  try {
    const registered = registerPlugin<NativeBiometricPlugin>("NativeBiometric");
    if (registered && typeof registered.verifyIdentity === "function") {
      cachedPlugin = registered;
      return cachedPlugin;
    }
  } catch {
    /* fall through */
  }

  try {
    const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, NativeBiometricPlugin> } })
      .Capacitor;
    const p = cap?.Plugins?.NativeBiometric;
    if (p && typeof p.verifyIdentity === "function") {
      cachedPlugin = p;
      return cachedPlugin;
    }
  } catch {
    /* ignore */
  }

  return null;
}

async function getPlugin(): Promise<NativeBiometricPlugin | null> {
  if (!isNativeShell()) return null;
  if (cachedPlugin !== undefined) return cachedPlugin;

  const sync = getPluginSync();
  if (sync) return sync;

  try {
    const mod = await withTimeout(
      import("@capgo/capacitor-native-biometric"),
      LOAD_MS,
      "fp_import",
    );
    const fromMod = (mod as { NativeBiometric?: NativeBiometricPlugin }).NativeBiometric;
    if (fromMod && typeof fromMod.verifyIdentity === "function") {
      cachedPlugin = fromMod;
      return cachedPlugin;
    }
  } catch {
    /* ignore */
  }

  const again = getPluginSync();
  if (again) return again;

  cachedPlugin = null;
  return null;
}

export async function checkFingerprintAvailable(): Promise<FingerprintAvailability> {
  // Web: platform authenticator (Windows Hello / Touch ID in browser) counts as supported
  if (!isNativeShell()) {
    try {
      const pk = (window as unknown as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }).PublicKeyCredential;
      if (pk?.isUserVerifyingPlatformAuthenticatorAvailable) {
        const ok = await withTimeout(pk.isUserVerifyingPlatformAuthenticatorAvailable(), 2500, "web_fp");
        if (ok) return { ok: true, hasFingerprint: true };
      }
    } catch {
      /* fall through */
    }
    return {
      ok: false,
      reason: "web",
      message: "Fingerprint unlock is only available when this device supports it.",
    };
  }
  const plugin = await getPlugin();
  if (!plugin) {
    // Plugin missing in this build — do not claim hardware exists
    return {
      ok: false,
      reason: "no_plugin",
      message:
        "Fingerprint is not in this app build. Install the latest D4EXAM APK, then try again.",
    };
  }
  try {
    const info = await withTimeout(plugin.isAvailable({ useFallback: false }), CHECK_MS, "fp_check");
    if (!info?.isAvailable) {
      const code = info?.errorCode;
      // not enrolled still means device SUPPORTS fingerprint — UI can offer enable later
      if (code === 3 || code === 1 || code === -1) {
        return { ok: true, hasFingerprint: true };
      }
      return {
        ok: false,
        reason: "no_hardware",
        message: "Fingerprint is not available on this device.",
      };
    }
    const bt = info.biometryType;
    // Face-only devices: treat as no fingerprint for D4EXAM
    if (bt === 2 || bt === 4) {
      return {
        ok: false,
        reason: "no_hardware",
        message: "This device only supports face unlock. D4EXAM requires fingerprint.",
      };
    }
    return { ok: true, hasFingerprint: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "").toLowerCase();
    // Timeouts / transient errors: optimistically allow FP UI on native
    if (msg.includes("timeout") || msg.includes("fp_check")) {
      return { ok: true, hasFingerprint: true };
    }
    return {
      ok: false,
      reason: "unknown",
      message: "Could not check fingerprint on this device.",
    };
  }
}

/**
 * Shows the system fingerprint dialog immediately.
 * Call this on a user tap (Enable / Unlock) or from the lock gate.
 * Never hang the UI past AUTH_MS.
 */
export async function authenticateWithFingerprint(opts?: {
  reason?: string;
  title?: string;
  subtitle?: string;
}): Promise<FingerprintAuthResult> {
  if (!isNativeShell()) {
    return {
      ok: false,
      code: "unavailable",
      message: "Fingerprint unlock is only available in the D4EXAM Android app.",
    };
  }

  let plugin = getPluginSync();
  if (!plugin) {
    plugin = await getPlugin();
  }
  if (!plugin) {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Fingerprint is not in this app build. Install the latest D4EXAM APK from the download link.",
    };
  }

  try {
    await withTimeout(
      plugin.verifyIdentity({
        reason: opts?.reason || "Unlock D4EXAM with your fingerprint",
        title: opts?.title || "D4EXAM",
        subtitle: opts?.subtitle || "Confirm it is you",
        description: "Touch the fingerprint sensor",
        negativeButtonText: "Cancel",
        maxAttempts: 5,
        useFallback: false,
        biometryType: BIOMETRY_FINGERPRINT,
      }),
      AUTH_MS,
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
      msg.includes("dismiss") ||
      msg.includes("user_cancel")
    ) {
      return { ok: false, code: "cancelled", message: "Fingerprint cancelled." };
    }
    if (msg.includes("lockout") || msg.includes("too many")) {
      return {
        ok: false,
        code: "failed",
        message: "Too many failed attempts. Try again later or use password / login.",
      };
    }
    if (
      msg.includes("not available") ||
      msg.includes("no biometrics") ||
      msg.includes("unimplemented") ||
      msg.includes("not implemented")
    ) {
      return {
        ok: false,
        code: "unavailable",
        message: "Fingerprint is not available in this app build. Install the latest APK.",
      };
    }
    return {
      ok: false,
      code: "failed",
      message: "Fingerprint not recognised. Try again.",
    };
  }
}
