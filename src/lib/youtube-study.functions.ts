/**
 * Server-side YouTube Data API v3 search for Material Study Help.
 * API key is read only from process.env (never VITE_ / never client bundle).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type StudyVideo = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  publishedAt?: string;
};

export type StudyHelpResult = {
  videos: StudyVideo[];
  query: string;
  cached: boolean;
  offline?: boolean;
  error?: string | null;
};

const memoryCache = new Map<string, { at: number; videos: StudyVideo[]; query: string }>();
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

function buildQuery(input: {
  title?: string;
  course?: string;
  topic?: string;
  description?: string;
  ocrText?: string;
}): string {
  const parts = [
    String(input.title || "").trim(),
    String(input.course || "").trim(),
    String(input.topic || "").trim(),
    String(input.description || "").trim().slice(0, 120),
  ].filter(Boolean);
  // Light OCR snippet only — never dump full PDF text
  const ocr = String(input.ocrText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (ocr && parts.join(" ").length < 40) parts.push(ocr);
  const base = parts.join(" ").trim() || "educational study tutorial";
  return `${base} tutorial lecture explained`;
}

const InputSchema = z.object({
  title: z.string().optional(),
  course: z.string().optional(),
  topic: z.string().optional(),
  description: z.string().optional(),
  ocrText: z.string().optional(),
  materialId: z.string().optional(),
  maxResults: z.number().min(1).max(12).optional(),
});

export const searchStudyVideos = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    try {
      const raw =
        data &&
        typeof data === "object" &&
        "data" in (data as object) &&
        (data as { data: unknown }).data &&
        typeof (data as { data: unknown }).data === "object"
          ? (data as { data: unknown }).data
          : data;
      return InputSchema.parse(raw ?? {});
    } catch {
      return {} as z.infer<typeof InputSchema>;
    }
  })
  .handler(async ({ data }): Promise<StudyHelpResult> => {
    const input = data ?? {};
    const query = buildQuery(input);
    const maxResults = input.maxResults ?? 8;
    const cacheKey = `${input.materialId || query}::${maxResults}`;

    const hit = memoryCache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return { videos: hit.videos, query: hit.query, cached: true, error: null };
    }

    const key =
      process.env["YOUTUBE_API_KEY"] ||
      process.env["YOUTUBE_DATA_API_KEY"] ||
      process.env["GOOGLE_YOUTUBE_API_KEY"] ||
      "";

    if (!key) {
      return {
        videos: [],
        query,
        cached: false,
        error: "Study Help is not configured on the server yet.",
      };
    }

    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("q", query);
      url.searchParams.set("maxResults", String(maxResults));
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("relevanceLanguage", "en");
      url.searchParams.set("order", "relevance");
      url.searchParams.set("key", key);

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[study-help] YouTube API", res.status, body.slice(0, 200));
        return {
          videos: [],
          query,
          cached: false,
          error: "Could not load study videos right now.",
        };
      }
      const json = (await res.json()) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            publishedAt?: string;
            thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
          };
        }>;
      };

      const videos: StudyVideo[] = (json.items ?? [])
        .map((it) => {
          const videoId = String(it.id?.videoId || "").trim();
          if (!videoId) return null;
          const sn = it.snippet || {};
          const thumb =
            sn.thumbnails?.medium?.url ||
            sn.thumbnails?.high?.url ||
            sn.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
          return {
            videoId,
            title: String(sn.title || "Video").trim(),
            channel: String(sn.channelTitle || "").trim(),
            thumbnail: thumb,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            publishedAt: sn.publishedAt,
          } satisfies StudyVideo;
        })
        .filter(Boolean) as StudyVideo[];

      memoryCache.set(cacheKey, { at: Date.now(), videos, query });
      return { videos, query, cached: false, error: null };
    } catch (e) {
      console.warn("[study-help]", e);
      return {
        videos: [],
        query,
        cached: false,
        error: "Study Help is temporarily unavailable.",
      };
    }
  },
);
