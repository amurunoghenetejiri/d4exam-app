/**
 * Keep the Capacitor WebView tappable.
 * Radix Dialog/Sheet/Dropdown (react-remove-scroll) can leave body pointer-events:none
 * which freezes the entire app after menu or one extra click.
 *
 * This module is aggressive on purpose for native Android — UI must never stay dead.
 */

function isVisiblyBlocking(el: HTMLElement): boolean {
  try {
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
    if (st.pointerEvents === "none") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    // Must cover a meaningful portion of the viewport
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const area = r.width * r.height;
    if (area < vw * vh * 0.15) return false;
    return true;
  } catch {
    return false;
  }
}

/** True when a real modal/menu is open and should keep the UI locked. */
export function hasVisibleBlockingOverlay(): boolean {
  if (typeof document === "undefined") return false;
  try {
    // Custom AppShell drawer
    const drawer = document.querySelector(".sa-mobile-menu[role=\"dialog\"]");
    if (drawer && isVisiblyBlocking(drawer as HTMLElement)) return true;

    // Fingerprint / setup lock overlays only when body class says active
    if (document.body.classList.contains("d4-fp-lock-active")) {
      const fp = document.querySelector(".d4-fp-lock-overlay");
      if (fp && isVisiblyBlocking(fp as HTMLElement)) return true;
    }
    if (document.body.classList.contains("d4-setup-lock-active")) {
      return true;
    }

    // Force-update gate
    const update = document.querySelector("[aria-labelledby=\"d4-update-title\"]");
    if (update && isVisiblyBlocking(update as HTMLElement)) return true;

    // Global search full-screen
    const search = document.querySelector("[data-d4-global-search=\"open\"]");
    if (search && isVisiblyBlocking(search as HTMLElement)) return true;

    // Radix dialogs / menus that are open AND visible
    const opens = document.querySelectorAll(
      "[data-state=\"open\"][role=\"dialog\"], [data-state=\"open\"][data-radix-menu-content], [data-state=\"open\"][data-radix-select-content], [data-state=\"open\"][data-radix-popper-content-wrapper]",
    );
    for (const el of opens) {
      if (isVisiblyBlocking(el as HTMLElement)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function unlockUi(): void {
  if (typeof document === "undefined") return;
  try {
    const body = document.body;
    const html = document.documentElement;

    // Always restore interactivity on body/html
    body.style.setProperty("pointer-events", "auto", "important");
    html.style.setProperty("pointer-events", "auto", "important");
    body.style.removeProperty("overflow");
    html.style.removeProperty("overflow");
    body.style.overflow = "";
    html.style.overflow = "";
    body.style.removeProperty("padding-right");
    body.style.removeProperty("margin-right");
    body.style.removeProperty("padding-left");
    body.style.removeProperty("margin-left");
    body.removeAttribute("data-scroll-locked");
    html.removeAttribute("data-scroll-locked");
    body.classList.remove("overflow-hidden");

    // Only strip fingerprint lock class when overlay is gone
    if (!document.querySelector(".d4-fp-lock-overlay")) {
      body.classList.remove("d4-fp-lock-active");
    }
    if (!document.querySelector("[data-d4-setup-lock]")) {
      body.classList.remove("d4-setup-lock-active");
    }

    document.querySelectorAll("[data-scroll-locked]").forEach((el) => {
      try {
        const h = el as HTMLElement;
        h.style.setProperty("pointer-events", "auto", "important");
        h.removeAttribute("data-scroll-locked");
      } catch {
        /* ignore */
      }
    });

    // Remove Radix focus guards (invisible blockers)
    document.querySelectorAll("[data-radix-focus-guard]").forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });

    // Closed / invisible radix portals that still cover the screen
    document.querySelectorAll("[data-state=\"closed\"]").forEach((el) => {
      try {
        const h = el as HTMLElement;
        const style = window.getComputedStyle(h);
        const fixed =
          h.classList.contains("fixed") ||
          style.position === "fixed" ||
          style.position === "absolute";
        if (!fixed) return;
        h.style.pointerEvents = "none";
        // Hide fully closed layers that still paint over the app
        if (style.opacity === "0" || style.visibility === "hidden" || h.getAttribute("aria-hidden") === "true") {
          h.style.display = "none";
        }
      } catch {
        /* ignore */
      }
    });

    // Stale fingerprint lock overlay when not active
    document.querySelectorAll(".d4-fp-lock-overlay").forEach((el) => {
      try {
        const h = el as HTMLElement;
        if (!document.body.classList.contains("d4-fp-lock-active")) {
          h.style.pointerEvents = "none";
          h.style.display = "none";
        }
      } catch {
        /* ignore */
      }
    });

    // Any fixed full-viewport layer that is not a known open overlay → neutralize
    if (!hasVisibleBlockingOverlay()) {
      document.querySelectorAll("body > div, #root ~ div").forEach((el) => {
        try {
          const h = el as HTMLElement;
          const st = window.getComputedStyle(h);
          if (st.position !== "fixed" && st.position !== "absolute") return;
          const z = parseInt(st.zIndex || "0", 10);
          if (Number.isNaN(z) || z < 40) return;
          const state = h.getAttribute("data-state");
          if (state === "open") return;
          if (h.classList.contains("d4-fp-lock-overlay")) return;
          if (h.classList.contains("sa-mobile-menu")) return;
          if (h.getAttribute("data-d4-global-search") === "open") return;
          // High z fixed layers with no open state: don't receive events
          if (!isVisiblyBlocking(h) || state === "closed") {
            h.style.pointerEvents = "none";
          }
        } catch {
          /* ignore */
        }
      });
    }

    // react-remove-scroll leftover attribute
    try {
      document.querySelectorAll("[style*=\"pointer-events\"]").forEach((el) => {
        const h = el as HTMLElement;
        if (h === body || h === html) return;
        // Don't touch intentional pointer-events-none decorative nodes
      });
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/** Unlock after navigation settles (hash change, menu close, etc.). */
export function unlockUiSoon(): void {
  unlockUi();
  if (typeof window === "undefined") return;
  window.setTimeout(() => unlockUi(), 0);
  window.setTimeout(() => unlockUi(), 80);
  window.setTimeout(() => unlockUi(), 200);
  window.setTimeout(() => unlockUi(), 450);
}

export function installUiUnlockSafetyNet(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const tick = () => {
    try {
      const peBody = window.getComputedStyle(document.body).pointerEvents;
      const peHtml = window.getComputedStyle(document.documentElement).pointerEvents;
      const blocking = hasVisibleBlockingOverlay();

      // If body is locked but nothing visible is blocking → force unlock
      if ((peBody === "none" || peHtml === "none") && !blocking) {
        unlockUi();
      }

      // Stale closed portals
      if (!blocking) {
        document.querySelectorAll("[data-state=\"closed\"]").forEach((el) => {
          try {
            const h = el as HTMLElement;
            const st = window.getComputedStyle(h);
            if (st.position === "fixed" && st.pointerEvents !== "none") {
              const r = h.getBoundingClientRect();
              if (r.width > 50 && r.height > 50) {
                h.style.pointerEvents = "none";
              }
            }
          } catch {
            /* ignore */
          }
        });
      }
    } catch {
      /* ignore */
    }
  };

  const onPointer = () => tick();
  window.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("touchstart", onPointer, true);
  window.addEventListener("touchend", onPointer, true);
  window.addEventListener("focusin", onPointer, true);
  window.addEventListener("click", onPointer, true);
  window.addEventListener("hashchange", () => unlockUiSoon(), true);
  window.addEventListener("popstate", () => unlockUiSoon(), true);

  // Faster recovery on native (was 400ms)
  const id = window.setInterval(tick, 250);

  let backSub: { remove: () => Promise<void> } | null = null;
  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      backSub = await App.addListener("backButton", ({ canGoBack }) => {
        try {
          const drawer = document.querySelector(".sa-mobile-menu[role=\"dialog\"]");
          if (drawer) {
            drawer.querySelector<HTMLElement>('button[aria-label="Close menu"]')?.click();
            unlockUiSoon();
            return;
          }
          const search = document.querySelector("[data-d4-global-search=\"open\"]");
          if (search) {
            (search as HTMLElement).querySelector<HTMLElement>("[data-d4-search-close]")?.click();
            unlockUiSoon();
            return;
          }
          if (canGoBack) {
            window.history.back();
            unlockUiSoon();
          } else {
            void App.minimizeApp?.();
          }
        } catch {
          unlockUiSoon();
        }
      });
    } catch {
      /* not native */
    }
  })();

  return () => {
    window.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("touchstart", onPointer, true);
    window.removeEventListener("touchend", onPointer, true);
    window.removeEventListener("focusin", onPointer, true);
    window.removeEventListener("click", onPointer, true);
    window.clearInterval(id);
    void backSub?.remove();
  };
}
