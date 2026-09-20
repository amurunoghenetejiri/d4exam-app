import { useEffect } from "react";
import { useSessionUser } from "@/lib/session";
import {
  applyDisplayPrefsToDom,
  DEFAULT_DISPLAY_PREFS,
  hydratePrefsFromDb,
  loadDisplayPrefs,
} from "@/lib/notification-prefs";
import { setLocale } from "@/lib/i18n";

/**
 * Hydrates display prefs on session load and applies DOM classes / i18n locale.
 */
export function DisplayPrefsBootstrap() {
  const { data: session } = useSessionUser();

  useEffect(() => {
    let cancelled = false;
    const userId = session?.userId;
    if (!userId) {
      // Guest: still respect OS reduced motion lightly
      try {
        applyDisplayPrefsToDom({ ...DEFAULT_DISPLAY_PREFS });
      } catch {
        /* */
      }
      return;
    }
    const local = loadDisplayPrefs(userId);
    applyDisplayPrefsToDom(local);
    setLocale(local.language || "en");

    void (async () => {
      try {
        const { display } = await hydratePrefsFromDb(userId, session?.profileId);
        if (cancelled) return;
        applyDisplayPrefsToDom(display);
        setLocale(display.language || "en");
      } catch {
        /* */
      }
    })();

    // React to system theme when appearance === system
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onScheme = () => {
      const prefs = loadDisplayPrefs(userId);
      if (prefs.appearance === "system") applyDisplayPrefsToDom(prefs);
    };
    mq?.addEventListener?.("change", onScheme);
    return () => {
      cancelled = true;
      mq?.removeEventListener?.("change", onScheme);
    };
  }, [session?.userId, session?.profileId]);

  return null;
}
