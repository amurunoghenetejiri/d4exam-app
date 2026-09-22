
/**
 * Reliable school logo upload via service role (storage + schools.logo_url).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function envUrl() {
  return process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
}
function envService() {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SB_SERVICE_ROLE_KEY"] ||
    ""
  );
}

export const uploadSchoolLogoServer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        schoolId: z.string().uuid(),
        /** base64 without data: prefix optional; or full data URL */
        base64: z.string().min(32),
        contentType: z.string().default("image/jpeg"),
        fileName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const url = envUrl();
    const service = envService();
    if (!url || !service) {
      return { ok: false as const, error: "Server storage not configured" };
    }
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let b64 = data.base64;
    if (b64.includes(",")) b64 = b64.split(",")[1] || b64;
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      return { ok: false as const, error: "Invalid image data" };
    }
    if (buf.length < 32) return { ok: false as const, error: "Image too small" };
    if (buf.length > 2_500_000) return { ok: false as const, error: "Image too large (max ~2MB)" };

    const ext =
      data.contentType.includes("png")
        ? "png"
        : data.contentType.includes("webp")
          ? "webp"
          : "jpg";
    const path = `${data.schoolId}/logo-${Date.now()}.${ext}`;
    const buckets = ["school-logos", "public", "avatars"];
    let publicUrl = "";

    for (const bucket of buckets) {
      const { error: upErr } = await admin.storage.from(bucket).upload(path, buf, {
        contentType: data.contentType || "image/jpeg",
        upsert: true,
        cacheControl: "3600",
      });
      if (upErr) continue;

      // Make object public when possible
      try {
        await admin.storage.from(bucket).getPublicUrl(path);
      } catch {
        /* ignore */
      }

      const { data: signed } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed?.signedUrl) {
        publicUrl = signed.signedUrl;
        break;
      }
      const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
      if (pub?.publicUrl) {
        publicUrl = pub.publicUrl;
        break;
      }
    }

    if (!publicUrl) {
      // Last resort: store data URL in DB (works for display everywhere)
      const dataUrl = `data:${data.contentType || "image/jpeg"};base64,${b64}`;
      if (dataUrl.length > 1_500_000) {
        return { ok: false as const, error: "Could not store logo (file too large after compress)" };
      }
      publicUrl = dataUrl;
    }

    const { error: dbErr } = await admin
      .from("schools")
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", data.schoolId);

    if (dbErr) {
      return { ok: false as const, error: dbErr.message || "Could not save logo on school record" };
    }

    return { ok: true as const, url: publicUrl };
  });
