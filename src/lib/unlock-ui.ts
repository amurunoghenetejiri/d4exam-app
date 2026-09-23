/**
 * Radix Sheet/Dialog can leave body { pointer-events: none } after close,
 * which makes the whole Capacitor app look frozen (taps do nothing).
 */
export function unlockUi(): void {
  if (typeof document === "undefined") return;
  try {
    const body = document.body;
    const html = document.documentElement;
    body.style.pointerEvents = "";
    html.style.pointerEvents = "";
    body.style.overflow = "";
    html.style.overflow = "";
    body.removeAttribute("data-scroll-locked");
    html.removeAttribute("data-scroll-locked");
    // react-remove-scroll markers
    body.style.removeProperty("padding-right");
    body.style.removeProperty("margin-right");
    const locked = document.querySelectorAll("[data-scroll-locked]");
    locked.forEach((el) => {
      try {
        (el as HTMLElement).style.pointerEvents = "";
        el.removeAttribute("data-scroll-locked");
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

/** Install a light safety net: if user taps and body is locked with no open dialog, unlock. */
export function installUiUnlockSafetyNet(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onPointer = () => {
    try {
      const pe = window.getComputedStyle(document.body).pointerEvents;
      if (pe !== "none") return;
      // If a radix dialog/sheet is open, leave it
      const open =
        document.querySelector("[data-state='open'][role='dialog']") ||
        document.querySelector("[data-state='open'].fixed.inset-0") ||
        document.querySelector("[data-radix-focus-guard]");
      if (open) return;
      unlockUi();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("touchstart", onPointer, true);
  const id = window.setInterval(() => {
    try {
      if (window.getComputedStyle(document.body).pointerEvents === "none") {
        const open = document.querySelector("[data-state='open'][role='dialog']");
        if (!open) unlockUi();
      }
    } catch {
      /* ignore */
    }
  }, 1500);
  return () => {
    window.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("touchstart", onPointer, true);
    window.clearInterval(id);
  };
}
