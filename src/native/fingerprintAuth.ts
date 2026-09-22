/**
 * Fingerprint auth for native D4EXAM (Android).
 * Opens the system BiometricPrompt — never stores fingerprint data.
 */
import { registerPlugin, Capacitor } from "@capacitor/core";
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

type NativeBiometricPlugin = {
  isAvailable: (opts?: { useFallback?: boolean }) => Promise<{
    isAvailable: boolean;
    biometryType?: number;
    errorCode?: number;
  }>;
  verifyIdentity: (opts: Record<string, unknown>) => Promise<void>;
};

const LOAD_MS = 3_500;
const CHECK_MS = 6_000;
const AUTH_MS = 30_000;

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

/** Only cache SUCCESS. Never cache null forever (bridge may load late with server.url). */
let cachedPlugin: NativeBiometricPlugin | null = null;

function tryRegister(): NativeBiometricPlugin | null {
  try {
    const registered = registerPlugin<NativeBiometricPlugin>("NativeBiometric");
    if (registered && typeof registered.verifyIdentity === "function") {
      return registered;
    }
  } catch {
    /* ignore */
  }
  try {
    const cap = (window as unknown as {
      Capacitor?: { Plugins?: Record<string, NativeBiometricPlugin> };
    }).Capacitor;
    const p = cap?.Plugins?.NativeBiometric;
    if (p && typeof p.verifyIdentity === "function") return p;
  } catch {
    /* ignore */
  }
  return null;
}

async function getPlugin(): Promise<NativeBiometricPlugin | null> {
  if (!isNativeShell()) return null;
  if (cachedPlugin) return cachedPlugin;

  for (let i = 0; i < 5; i++) {
    const p = tryRegister();
    if (p) {
      try {
        await withTimeout(p.isAvailable({ useFallback: false }), 2_500, "fp_probe");
        cachedPlugin = p;
        return cachedPlugin;
      } catch (e) {
        const msg = String((e as Error)?.message || e || "").toLowerCase();
        if (msg.includes("not implemented") || msg.includes("unimplemented")) {
          return null;
        }
        // Transient / timeout: still use plugin for system prompt
        cachedPlugin = p;
        return cachedPlugin;
      }
    }
    await new Promise((r) => setTimeout(r, 350 * (i + 1)));
  }

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

  return tryRegister();
}

export async function checkFingerprintAvailable(): Promise<FingerprintAvailability> {
  if (!isNativeShell()) {
    return {
      ok: false,
      reason: "web",
      message: "Fingerprint unlock is only available in the D4EXAM Android app.",
    };
  }

  const plugin = await getPlugin();
  if (!plugin) {
    return {
      ok: false,
      reason: "no_plugin",
      message:
        "Fingerprint is not available in this app build. Uninstall D4EXAM, then install the latest APK (version 1.4.2-biometric).",
    };
  }

  try {
    const info = await withTimeout(plugin.isAvailable({ useFallback: false }), CHECK_MS, "fp_check");
    if (!info?.isAvailable) {
      const code = info?.errorCode;
      if (code === 2) {
        return {
          ok: false,
          reason: "not_enrolled",
          message: "No fingerprint enrolled. Add a fingerprint in Android Settings, then try again.",
        };
      }
      // Device may still show prompt
      return { ok: true, hasFingerprint: true };
    }
    return { ok: true, hasFingerprint: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "").toLowerCase();
    if (msg.includes("not implemented") || msg.includes("unimplemented")) {
      return {
        ok: false,
        reason: "no_plugin",
        message:
          "Fingerprint is not available in this app build. Uninstall D4EXAM, then install the latest APK (version 1.4.2-biometric).",
      };
    }
    // Optimistic so Enable Fingerprint is shown
    return { ok: true, hasFingerprint: true };
  }
}

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

  const plugin = await getPlugin();
  if (!plugin) {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Fingerprint is not available in this app build. Uninstall and install the latest D4EXAM APK (1.4.2-biometric).",
    };
  }

  try {
    await withTimeout(
      plugin.verifyIdentity({
        reason: opts?.reason || "Unlock D4EXAM",
        title: opts?.title || "D4EXAM",
        subtitle: opts?.subtitle || "Confirm with your fingerprint",
        description: opts?.reason || "Unlock D4EXAM",
        negativeButtonText: "Use password",
        maxAttempts: 5,
        useFallback: false,
      }),
      AUTH_MS,
      "fp_auth",
    );
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error)?.message || e || "");
    const low = msg.toLowerCase();
    if (low.includes("cancel") || low.includes("user") || low.includes("10")) {
      return { ok: false, code: "cancelled", message: "Fingerprint cancelled." };
    }
    if (low.includes("timeout") || low.includes("fp_auth")) {
      return { ok: false, code: "timeout", message: "Fingerprint timed out. Try again." };
    }
    if (low.includes("not implemented") || low.includes("unimplemented")) {
      return {
        ok: false,
        code: "unavailable",
        message: "Fingerprint is not available in this app build. Install APK 1.4.2-biometric.",
      };
    }
    return {
      ok: false,
      code: "failed",
      message: "Fingerprint not recognized. Try again or use your app password.",
    };
  }
}
