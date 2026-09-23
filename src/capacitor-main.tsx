/**
 * Capacitor SPA entry — mounts the app without SSR / Vercel.
 * Used only by the Android bundled shell (scripts/prepare-capacitor-dist.mjs).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { installUiUnlockSafetyNet, unlockUi } from "./lib/unlock-ui";
import "./styles.css";

/** Force hash history (#/route) for the local APK shell — never browser path routing. */
try {
  (window as unknown as { __D4_FORCE_HASH__?: boolean }).__D4_FORCE_HASH__ = true;
} catch {
  /* ignore */
}

const SPLASH_MIN_MS = 2200;
const bootStarted = Date.now();

function hideBoot() {
  const boot = document.getElementById("d4-boot");
  if (!boot) return;
  const elapsed = Date.now() - bootStarted;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  window.setTimeout(() => {
    try {
      boot.style.opacity = "0";
      boot.style.pointerEvents = "none";
      window.setTimeout(() => {
        try {
          boot.style.display = "none";
        } catch {
          /* ignore */
        }
        unlockUi();
      }, 220);
    } catch {
      /* ignore */
    }
  }, wait);
}

function showBootError(message: string) {
  const boot = document.getElementById("d4-boot");
  if (!boot) return;
  boot.classList.add("show-retry");
  boot.style.opacity = "1";
  boot.style.display = "flex";
  const p = boot.querySelector(".s") || boot.querySelector("p");
  if (p) p.textContent = message;
}

function main() {
  try {
    installUiUnlockSafetyNet();
    unlockUi();

    let rootEl = document.getElementById("root");
    if (!rootEl) {
      rootEl = document.createElement("div");
      rootEl.id = "root";
      document.body.appendChild(rootEl);
    }

    const router = getRouter();
    createRoot(rootEl).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    const obs = new MutationObserver(() => {
      if (rootEl && rootEl.childNodes.length > 0) {
        hideBoot();
        obs.disconnect();
      }
    });
    obs.observe(rootEl, { childList: true, subtree: true });
    // Absolute fallback so splash never sticks forever
    window.setTimeout(hideBoot, 8000);
  } catch (err) {
    console.error("[D4EXAM] Capacitor SPA boot failed", err);
    showBootError(
      "Could not start D4EXAM. Tap Try again. If this continues, reinstall the app.",
    );
  }
}

main();
