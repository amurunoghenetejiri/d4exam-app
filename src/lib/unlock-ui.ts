/**
 * Keep the Capacitor WebView tappable.
 * Radix Dialog/Sheet/Dropdown (react-remove-scroll) can leave body pointer-events:none
 * which freezes the entire app after menu or one extra click.
 *
 * Aggressive on purpose for native Android — UI must never stay dead.
 */

function isVisiblyBlocking(el: HTMLElement): boolean {
  try {
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) {
      return false;
    }
    if (st.pointerEvents === "none") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    if (r.width * r.height < vw * vh * 0.12) return false;
    return true;
  } catch {
    return false;
  }
}

/** True when a real modal/menu is open and should keep scroll-lock. */
export function hasVisibleBlockingOverlay(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const drawer = document.querySelector('.sa-mobile-menu[role="dialog"]');
    if (drawer && isVisiblyBlocking(drawer as HTMLElement)) return true;

    if (document.body.classList.contains("d4-fp-lock-active")) {
      const fp = document.querySelector(".d4-fp-lock-overlay");
      if (fp && isVisiblyBlocking(fp as HTMLElement)) return true;
    }
    if (document.body.classList.contains("d4-setup-lock-active")) return true;

    const update = document.querySelector('[aria-labelledby="d4-update-title"]');
    if (update && isVisiblyBlocking(update as HTMLElement)) return true;

    const search = document.querySelector('[data-d4-global-search="open"]');
    if (search && isVisiblyBlocking(search as HTMLElement)) return true;

    const publicMenu = document.querySelector('[data-d4-public-menu="open"]');
    if (publicMenu && isVisiblyBlocking(publicMenu as HTMLElement)) return true;

    const opens = document.querySelectorAll(
      '[data-state="open"][role="dialog"],' +
        '[data-state="open"][data-radix-menu-content],' +
        '[data-state="open"][data-radix-select-content],' +
        '[data-state="open"][data-radix-popper-content-wrapper],' +
        '[data-state="open"][data-radix-popover-content]',
    );
    for (const el of Array.from(opens)) {
      if (isVisiblyBlocking(el as HTMLElement)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function forceBodyInteractive(): void {
  const body = document.body;
  const html = document.documentElement;
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
}

export function unlockUi(): void {
  if (typeof document === "undefined") return;
  try {
    forceBodyInteractive();

    if (!document.querySelector(".d4-fp-lock-overlay")) {
      document.body.classList.remove("d4-fp-lock-active");
    }
    if (!document.querySelector("[data-d4-setup-lock]")) {
      document.body.classList.remove("d4-setup-lock-active");
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

    document.querySelectorAll("[data-radix-focus-guard]").forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });

    // Closed / invisible fixed layers must not intercept taps
    document.querySelectorAll('[data-state="closed"]').forEach((el) => {
      try {
        const h = el as HTMLElement;
        const style = window.getComputedStyle(h);
        if (style.position === "fixed" || style.position === "absolute" || h.classList.contains("fixed")) {
          h.style.pointerEvents = "none";
          if (
            style.opacity === "0" ||
            style.visibility === "hidden" ||
            h.getAttribute("aria-hidden") === "true"
          ) {
            h.style.display = "none";
          }
        }
      } catch {
        /* ignore */
      }
    });

    document.querySelectorAll(".d4-fp-lock-overlay").forEach((el) => {
      try {
        if (!document.body.classList.contains("d4-fp-lock-active")) {
          const h = el as HTMLElement;
          h.style.pointerEvents = "none";
          h.style.display = "none";
        }
      } catch {
        /* ignore */
      }
    });

    if (!hasVisibleBlockingOverlay()) {
      document.querySelectorAll("body > div").forEach((el) => {
        try {
          const h = el as HTMLElement;
          if (h.id === "root" || h.id === "app") return;
          const st = window.getComputedStyle(h);
          if (st.position !== "fixed" && st.position !== "absolute") return;
          const z = parseInt(st.zIndex || "0", 10);
          if (Number.isNaN(z) || z < 40) return;
          const state = h.getAttribute("data-state");
          if (state === "open") return;
          if (h.classList.contains("d4-fp-lock-overlay")) return;
          if (h.classList.contains("sa-mobile-menu")) return;
          if (h.getAttribute("data-d4-global-search") === "open") return;
          h.style.pointerEvents = "none";
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }
}

/** Unlock now and again after paint / close animations. */
export function unlockUiSoon(): void {
  unlockUi();
  if (typeof window === "undefined") return;
  window.setTimeout(() => unlockUi(), 0);
  window.setTimeout(() => unlockUi(), 50);
  window.setTimeout(() => unlockUi(), 120);
  window.setTimeout(() => unlockUi(), 250);
  window.setTimeout(() => unlockUi(), 400);
}

export function installUiUnlockSafetyNet(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const tick = () => {
    try {
      const blocking = hasVisibleBlockingOverlay();
      const peBody = window.getComputedStyle(document.body).pointerEvents;
      const peHtml = window.getComputedStyle(document.documentElement).pointerEvents;

      if ((peBody === "none" || peHtml === "none") && !blocking) {
        unlockUi();
      }

      if (!blocking) {
        document.querySelectorAll('[data-state="closed"]').forEach((el) => {
          try {
            const h = el as HTMLElement;
            const st = window.getComputedStyle(h);
            if (
              (st.position === "fixed" || st.position === "absolute") &&
              st.pointerEvents !== "none"
            ) {
              const r = h.getBoundingClientRect();
              if (r.width > 40 && r.height > 40) {
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

  const id = window.setInterval(tick, 200);

  let backSub: { remove: () => Promise<void> } | null = null;
  void (async () => {
    try {
      const { App } = await import("@capacitor/app");
      backSub = await App.addListener("backButton", ({ canGoBack }) => {
        try {
          const drawer = document.querySelector('.sa-mobile-menu[role="dialog"]');
          if (drawer) {
            drawer.querySelector<HTMLElement>('button[aria-label="Close menu"]')?.click();
            unlockUiSoon();
            return;
          }
          const search = document.querySelector('[data-d4-global-search="open"]');
          if (search) {
            search.querySelector<HTMLElement>("[data-d4-search-close]")?.click();
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
