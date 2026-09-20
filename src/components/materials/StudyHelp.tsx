/**
 * Student-only Study Help — related educational YouTube videos.
 * Fetches via server function (API key never in the browser).
 */
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Play, RefreshCw, WifiOff, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchStudyVideos, type StudyVideo } from "@/lib/youtube-study.server";
import { isOnlineNow } from "@/lib/offline-sync";
import { cn } from "@/lib/utils";

type Props = {
  materialId: string;
  title: string;
  courseLabel?: string;
  topic?: string | null;
  description?: string | null;
  ocrText?: string | null;
  className?: string;
  compact?: boolean;
};

const localCacheKey = (id: string) => `d4_study_help_v1:${id}`;

export function StudyHelpPanel({
  materialId,
  title,
  courseLabel,
  topic,
  description,
  ocrText,
  className,
  compact,
}: Props) {
  const [videos, setVideos] = useState<StudyVideo[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(() => !isOnlineNow());
  const [active, setActive] = useState<StudyVideo | null>(null);
  const [showAll, setShowAll] = useState(false);

  const relatedLabel = useMemo(() => {
    return [courseLabel, topic, title].filter(Boolean).slice(0, 2).join(" · ") || title;
  }, [courseLabel, topic, title]);

  async function load(force = false) {
    if (!isOnlineNow()) {
      setOffline(true);
      setError("Study Help is unavailable offline. Connect to the internet to find related study videos.");
      try {
        const raw = localStorage.getItem(localCacheKey(materialId));
        if (raw) {
          const parsed = JSON.parse(raw) as { videos?: StudyVideo[]; query?: string };
          if (parsed.videos?.length) {
            setVideos(parsed.videos);
            setQuery(parsed.query || "");
          }
        }
      } catch {
        /* ignore */
      }
      return;
    }
    setOffline(false);
    setBusy(true);
    setError(null);
    try {
      if (!force) {
        try {
          const raw = localStorage.getItem(localCacheKey(materialId));
          if (raw) {
            const parsed = JSON.parse(raw) as { at?: number; videos?: StudyVideo[]; query?: string };
            if (parsed.videos?.length && parsed.at && Date.now() - parsed.at < 6 * 60 * 60 * 1000) {
              setVideos(parsed.videos);
              setQuery(parsed.query || "");
              setBusy(false);
              return;
            }
          }
        } catch {
          /* ignore */
        }
      }
      const res = await searchStudyVideos({
        data: {
          materialId,
          title,
          course: courseLabel,
          topic: topic || undefined,
          description: description || undefined,
          ocrText: ocrText || undefined,
          maxResults: 8,
        },
      });
      setVideos(res.videos || []);
      setQuery(res.query || "");
      if (res.error) setError(res.error);
      try {
        localStorage.setItem(
          localCacheKey(materialId),
          JSON.stringify({ at: Date.now(), videos: res.videos || [], query: res.query }),
        );
      } catch {
        /* ignore */
      }
    } catch {
      setError("Could not load study videos.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(false);
    const onNet = () => {
      setOffline(!isOnlineNow());
      if (isOnlineNow()) void load(false);
    };
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  const shown = showAll ? videos : videos.slice(0, compact ? 3 : 4);

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600">
          <Youtube className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-slate-900">Study Help</h3>
          <p className="truncate text-[11px] text-slate-500">
            Related study videos for this material
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={busy || offline}
          onClick={() => void load(true)}
          aria-label="Refresh study videos"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {offline && (
        <div className="flex items-start gap-2 px-3 py-3 text-xs text-amber-800 sm:px-4">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Study Help is unavailable offline. Connect to the internet to find related study videos.
          </p>
        </div>
      )}

      {error && !offline && (
        <p className="px-3 py-2 text-xs text-slate-500 sm:px-4">{error}</p>
      )}

      {busy && !videos.length ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Finding related videos…
        </div>
      ) : videos.length === 0 && !busy ? (
        <p className="px-3 py-6 text-center text-sm text-slate-500 sm:px-4">
          No related videos found yet.
        </p>
      ) : (
        <ul className={cn("grid gap-2 p-3 sm:p-4", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
          {shown.map((v) => (
            <li key={v.videoId}>
              <button
                type="button"
                onClick={() => setActive(v)}
                className="flex w-full gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-left transition hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-200 sm:h-[4.5rem] sm:w-32">
                  <img src={v.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span className="absolute inset-0 grid place-items-center bg-black/25">
                    <Play className="h-6 w-6 text-white drop-shadow" fill="currentColor" />
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="line-clamp-2 text-xs font-bold leading-snug text-slate-900 sm:text-[13px]">
                    {v.title}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-medium text-slate-500">{v.channel}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {videos.length > (compact ? 3 : 4) && (
        <div className="border-t border-slate-100 px-3 py-2 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs font-semibold"
            onClick={() => setShowAll((s) => !s)}
          >
            {showAll ? "Show less" : "View more study videos"}
          </Button>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-slate-900">{active.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {active.channel}
                  {relatedLabel ? ` · Related to: ${relatedLabel}` : ""}
                </p>
              </div>
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> YouTube
              </a>
              <Button type="button" size="sm" variant="outline" onClick={() => setActive(null)}>
                Close
              </Button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                title={active.title}
                src={`https://www.youtube.com/embed/${active.videoId}?rel=0`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {query ? (
              <p className="px-3 py-2 text-[10px] text-slate-400 sm:px-4">Search: {query}</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
