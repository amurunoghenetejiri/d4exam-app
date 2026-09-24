/**
 * Keep the Capacitor WebView tappable.
 * Radix Dialog/Sheet/Dropdown (react-remove-scroll) can leave body pointer-events:none
 * which freezes the entire app after menu or one extra click.
 */
export function unlockUi(): void {
  if (typeof document === "undefined") return;
  try {
    const body = document.body;
    const html = document.documentElement;

    body.style.setProperty("pointer-events", "auto", "important");
    html.style.setProperty("pointer-events", "auto", "important");
    body.style.setProperty("overflow", "", "important");
    html.style.setProperty("overflow", "", "important");
    body.style.removeProperty("padding-right");
    body.style.removeProperty("margin-right");
    body.style.removeProperty("padding-left");
    body.style.removeProperty("margin-left");
    body.removeAttribute("data-scroll-locked");
    html.removeAttribute("data-scroll-locked");
    body.classList.remove(
      "d4-fp-lock-active",
      "d4-setup-lock-active",
      "overflow-hidden",
    );

    document.querySelectorAll("[data-scroll-locked]").forEach((el) => {
      try {
        const h = el as HTMLElement;
        h.style.setProperty("pointer-events", "auto", "important");
        h.removeAttribute("data-scroll-locked");
      } catch {
        /* ignore */
      }
    });

    // react-remove-scroll leftover styles on body
    try {
      if (body.style.overflow === "hidden") body.style.overflow = "";
    } catch {
      /* ignore */
    }

    document.querySelectorAll("[data-radix-focus-guard]").forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });

    // Closed radix portals that still cover the screen
    document.querySelectorAll("[data-state=\"closed\"]").forEach((el) => {
      try {
        const h = el as HTMLElement;
        const style = window.getComputedStyle(h);
        if (
          (h.classList.contains("fixed") || style.position === "fixed") &&
          (h.classList.contains("inset-0") || style.inset === "0px")
        ) {
          h.style.pointerEvents = "none";
          h.style.display = "none";
        }
      } catch {
        /* ignore */
      }
    });

    // Stale fingerprint lock overlay
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

    // Any leftover full-screen blocker without open dialog
    const hasOpenDialog =
      document.querySelector("[data-state=\"open\"][role=\"dialog\"]") ||
      document.querySelector(".sa-mobile-menu[role=\"dialog\"]");
    if (!hasOpenDialog) {
      document.querySelectorAll("[role=\"presentation\"]").forEach((el) => {
        try {
          const h = el as HTMLElement;
          if (h.style.pointerEvents === "auto" || h.classList.contains("fixed")) {
            const z = parseInt(window.getComputedStyle(h).zIndex || "0", 10);
            if (z >= 40 && h.getAttribute("data-state") !== "open") {
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
}

export function installUiUnlockSafetyNet(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const tick = () => {
    try {
      const pe = window.getComputedStyle(document.body).pointerEvents;
      const hasOpenDialog =
        document.querySelector("[data-state=\"open\"][role=\"dialog\"]") ||
        document.querySelector(".sa-mobile-menu[role=\"dialog\"]") ||
        document.querySelector("[data-state=\"open\"][data-radix-menu-content]");
      if (pe === "none" && !hasOpenDialog) {
        unlockUi();
      }
      // Also fix html
      if (window.getComputedStyle(document.documentElement).pointerEvents === "none" && !hasOpenDialog) {
        unlockUi();
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
  const id = window.setInterval(tick, 400);

  let backSub: { remove: () => Promise<void> } | null = null;
  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      backSub = await App.addListener("backButton", ({ canGoBack }) => {
        try {
          const drawer = document.querySelector(".sa-mobile-menu[role=\"dialog\"]");
          if (drawer) {
            drawer.querySelector<HTMLElement>('button[aria-label="Close menu"]')?.click();
            unlockUi();
            return;
          }
          if (canGoBack) {
            window.history.back();
          } else {
            void App.minimizeApp?.();
          }
        } catch {
          unlockUi();
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
