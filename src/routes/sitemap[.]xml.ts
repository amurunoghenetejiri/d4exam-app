/**
 * Production sitemap for Google Search Console.
 * Public pages only — never lists authenticated dashboards.
 */
import { createFileRoute } from "@tanstack/react-router";

const CANONICAL = "https://d4exam.name.ng";

const PUBLIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/about", priority: "0.8", changefreq: "monthly" },
  { path: "/features", priority: "0.9", changefreq: "monthly" },
  { path: "/pricing", priority: "0.8", changefreq: "monthly" },
  { path: "/school-application", priority: "0.9", changefreq: "monthly" },
  { path: "/application-status", priority: "0.6", changefreq: "monthly" },
  { path: "/support", priority: "0.7", changefreq: "monthly" },
  { path: "/privacy", priority: "0.5", changefreq: "yearly" },
  { path: "/login", priority: "0.7", changefreq: "monthly" },
];

function buildSitemapXml(): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_PATHS.map(({ path, priority, changefreq }) => {
    const loc = path === "/" ? `${CANONICAL}/` : `${CANONICAL}${path}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(buildSitemapXml(), {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
