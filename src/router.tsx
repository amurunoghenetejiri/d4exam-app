import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isOnlineNow } from "@/lib/offline-sync";
import { bindAppRouter } from "@/lib/app-navigate";

function DefaultPending() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-slate-500">Loading page…</p>
    </div>
  );
}

function DefaultError({ error }: { error: Error }) {
  const msg = String(error?.message ?? "").toLowerCase();
  const network =
    !isOnlineNow() ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed");

  if (network) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0a1a3a] px-6 py-16 text-center">
        <div className="relative mb-7 grid h-[140px] w-[140px] place-items-center" aria-hidden>
          <span className="absolute left-2.5 top-2.5 h-[120px] w-[120px] rounded-full bg-blue-600/20" />
          <span className="absolute right-1.5 top-2 h-9 w-9 rounded-full bg-blue-500/25" />
          <span className="absolute right-0 top-10 h-4.5 w-4.5 rounded-full bg-blue-400/30" />
          <div className="relative z-10 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-[#1e3a6e] to-[#152a52] shadow-xl">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path d="M5.07 11.05a9 9 0 0 1 13.86 0" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
              <path d="M8.53 14.11a5 5 0 0 1 6.95 0" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="18" r="1.35" fill="#93c5fd" />
              <path d="M4.5 5.5 L19.5 18.5" stroke="#ef4444" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-white">
          You're <span className="text-blue-500">Offline</span>
        </h1>
        <p className="mb-7 max-w-xs text-[0.95rem] leading-relaxed text-slate-400">
          It looks like you're not connected to the internet.
          Please check your network connection and try again.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 text-[0.95rem] font-semibold text-white shadow-lg shadow-blue-600/35 transition active:scale-[0.98] active:bg-blue-700"
          onClick={() => {
            try {
              window.location.hash = window.location.hash || "#/";
              window.location.reload();
            } catch {
              window.location.reload();
            }
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-500">
        D4
      </div>
      <h1 className="text-lg font-semibold text-slate-900">This page didn't load</h1>
      <p className="text-sm text-slate-500">{error?.message || "Something went wrong."}</p>
      <a
        href="#/"
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        onClick={(e) => {
          e.preventDefault();
          try {
            window.location.hash = "#/";
          } catch {
            /* ignore */
          }
        }}
      >
        Go home
      </a>
    </div>
  );
}

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const ua = navigator.userAgent || "";
    return (
      Boolean(cap?.isNativePlatform?.()) ||
      (/; wv\)/i.test(ua) && /Android/i.test(ua)) ||
      /Capacitor/i.test(ua) ||
      Boolean((window as unknown as { __D4_FORCE_HASH__?: boolean }).__D4_FORCE_HASH__)
    );
  } catch {
    return false;
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
        retry: (failureCount, error) => {
          if (typeof navigator !== "undefined" && !navigator.onLine) return false;
          const m = String((error as Error)?.message ?? "").toLowerCase();
          if (m.includes("failed to fetch") || m.includes("network")) return failureCount < 1;
          return failureCount < 1;
        },
        retryDelay: 400,
        networkMode: "offlineFirst",
        throwOnError: false,
      },
      mutations: {
        retry: 0,
        networkMode: "online",
      },
    },
  });

  // ALWAYS hash history in the Android APK — path navigations break the local WebView SPA.
  const history = createHashHistory();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history,
    scrollRestoration: true,
    defaultPreloadStaleTime: 5 * 60_000,
    defaultPreload: isNativeApp() ? false : "intent",
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultPendingComponent: DefaultPending,
    defaultErrorComponent: DefaultError as never,
  });

  try {
    bindAppRouter(router as never);
  } catch {
    /* ignore */
  }

  return router;
};
