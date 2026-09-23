/**
 * Keep the Capacitor WebView tappable.
 * Radix Dialog/Sheet (react-remove-scroll) can leave body pointer-events:none
 * which freezes the entire app after one menu/login interaction.
 */
export function unlockUi(): void {
  if (typeof document === "undefined") return;
  try {
    const body = document.body;
    const html = document.documentElement;

    body.style.setProperty("pointer-events", "auto", "important");
    html.style.setProperty("pointer-events", "auto", "important");
    body.style.setProperty("overflow", "auto", "important");
    html.style.setProperty("overflow", "auto", "important");
    body.style.removeProperty("padding-right");
    body.style.removeProperty("margin-right");
    body.removeAttribute("data-scroll-locked");
    html.removeAttribute("data-scroll-locked");
    body.classList.remove("d4-fp-lock-active", "d4-setup-lock-active");

    document.querySelectorAll("[data-scroll-locked]").forEach((el) => {
      try {
        const h = el as HTMLElement;
        h.style.setProperty("pointer-events", "auto", "important");
        h.removeAttribute("data-scroll-locked");
      } catch {
        /* ignore */
      }
    });

    // Orphaned radix overlays (closed but still blocking)
    document.querySelectorAll("[data-radix-focus-guard]").forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
    document.querySelectorAll("[data-state='closed']").forEach((el) => {
      try {
        const h = el as HTMLElement;
        if (h.classList.contains("fixed") && h.classList.contains("inset-0")) {
          h.style.pointerEvents = "none";
          h.style.display = "none";
        }
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

export function installUiUnlockSafetyNet(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const tick = () => {
    try {
      const pe = window.getComputedStyle(document.body).pointerEvents;
      if (pe === "none") {
        const openDialog =
          document.querySelector("[data-state='open'][role='dialog']") ||
          document.querySelector(".sa-mobile-menu[role='dialog']");
        if (!openDialog) unlockUi();
      }
    } catch {
      /* ignore */
    }
  };

  const onPointer = () => tick();
  window.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("touchstart", onPointer, true);
  window.addEventListener("focusin", onPointer, true);
  const id = window.setInterval(tick, 800);

  // Android hardware back: close our drawer first, else history.back
  let backSub: { remove: () => Promise<void> } | null = null;
  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      backSub = await App.addListener("backButton", ({ canGoBack }) => {
        try {
          const drawer = document.querySelector(".sa-mobile-menu[role='dialog']");
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
    window.removeEventListener("focusin", onPointer, true);
    window.clearInterval(id);
    void backSub?.remove();
  };
}
