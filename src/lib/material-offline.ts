import { offlineGet, offlineSet } from "@/lib/offline-cache";

export type OfflineMaterialBlob = {
  materialId: string;
  title: string;
  fileName: string | null;
  mime: string | null;
  /** data URL or remote url snapshot */
  dataUrl: string;
  savedAt: number;
  meta?: Record<string, unknown>;
};

function key(materialId: string) {
  return `material-blob::${materialId}`;
}

export async function isMaterialOffline(userId: string, materialId: string): Promise<boolean> {
  if (!userId || !materialId) return false;
  const hit = await offlineGet<OfflineMaterialBlob>(userId, key(materialId));
  return Boolean(hit?.data?.dataUrl);
}

export async function getOfflineMaterial(
  userId: string,
  materialId: string,
): Promise<OfflineMaterialBlob | null> {
  if (!userId || !materialId) return null;
  const hit = await offlineGet<OfflineMaterialBlob>(userId, key(materialId));
  return hit?.data ?? null;
}

export async function saveMaterialOffline(
  userId: string,
  material: {
    id: string;
    title: string;
    file_url: string | null;
    file_name: string | null;
    file_mime: string | null;
  },
  schoolId?: string | null,
): Promise<void> {
  if (!userId || !material.id) throw new Error("Missing user or material");
  if (!material.file_url) throw new Error("No file to save offline");

  const res = await fetch(material.file_url);
  if (!res.ok) throw new Error("Could not download material for offline use");
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  const payload: OfflineMaterialBlob = {
    materialId: material.id,
    title: material.title,
    fileName: material.file_name,
    mime: material.file_mime || blob.type || null,
    dataUrl,
    savedAt: Date.now(),
  };
  await offlineSet(userId, key(material.id), payload, { schoolId });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

/** Soft size cap so IndexedDB does not blow up on large PDFs/videos. */
const MAX_BLOB_BYTES = 12 * 1024 * 1024; // 12 MB
const DEFAULT_PREFETCH_LIMIT = 24;
const PREFETCH_CONCURRENCY = 2;

let prefetchRunning = false;

/**
 * Quiet background download of course materials for offline open.
 * Safe to call often — skips if already offline, too large, or offline network.
 * Never throws to UI; best-effort only.
 */
export async function prefetchMaterialsOffline(
  userId: string,
  materials: Array<{
    id: string;
    title: string;
    file_url: string | null;
    file_name: string | null;
    file_mime: string | null;
    file_size?: number | null;
  }>,
  opts?: { schoolId?: string | null; limit?: number },
): Promise<{ saved: number; skipped: number }> {
  if (!userId || !materials?.length) return { saved: 0, skipped: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { saved: 0, skipped: materials.length };
  }
  if (prefetchRunning) return { saved: 0, skipped: 0 };
  prefetchRunning = true;

  const limit = Math.max(1, Math.min(opts?.limit ?? DEFAULT_PREFETCH_LIMIT, 40));
  let saved = 0;
  let skipped = 0;

  try {
    const candidates = materials
      .filter((m) => m.id && m.file_url)
      .filter((m) => {
        const size = m.file_size ?? 0;
        if (size > 0 && size > MAX_BLOB_BYTES) return false;
        return true;
      })
      .slice(0, limit);

    const queue = [...candidates];
    const workers = Array.from({ length: PREFETCH_CONCURRENCY }, async () => {
      while (queue.length) {
        const m = queue.shift();
        if (!m) break;
        try {
          const already = await isMaterialOffline(userId, m.id);
          if (already) {
            skipped += 1;
            continue;
          }
          const res = await fetch(m.file_url!);
          if (!res.ok) {
            skipped += 1;
            continue;
          }
          const blob = await res.blob();
          if (blob.size > MAX_BLOB_BYTES) {
            skipped += 1;
            continue;
          }
          const dataUrl = await blobToDataUrl(blob);
          const payload: OfflineMaterialBlob = {
            materialId: m.id,
            title: m.title,
            fileName: m.file_name,
            mime: m.file_mime || blob.type || null,
            dataUrl,
            savedAt: Date.now(),
          };
          await offlineSet(userId, key(m.id), payload, { schoolId: opts?.schoolId });
          saved += 1;
        } catch {
          skipped += 1;
        }
      }
    });
    await Promise.all(workers);
  } finally {
    prefetchRunning = false;
  }

  return { saved, skipped };
}
