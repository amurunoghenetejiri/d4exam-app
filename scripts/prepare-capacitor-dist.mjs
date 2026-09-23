/**
 * Prepare dist/ for Capacitor Android SPA shell (no Vercel).
 * 1) Scan server modules and write a full stub map
 * 2) Build client SPA with vite.capacitor.config.ts
 * 3) Write dist/index.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const distCap = path.join(root, "dist-capacitor");
const stubDir = path.join(root, "scripts", ".cap-stubs");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "android") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function collectExportNames(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const names = new Set();
  const re =
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)|export\s+const\s+([A-Za-z0-9_]+)|export\s+{\s*([^}]+)\s*}/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) names.add(m[1]);
    if (m[2]) names.add(m[2]);
    if (m[3]) {
      for (const part of m[3].split(",")) {
        const bit = part.trim().split(/\s+as\s+/).pop().trim();
        if (bit && /^[A-Za-z_][A-Za-z0-9_]*$/.test(bit)) names.add(bit);
      }
    }
  }
  return [...names];
}

function writeStubs() {
  fs.rmSync(stubDir, { recursive: true, force: true });
  fs.mkdirSync(stubDir, { recursive: true });

  const srcFiles = walk(path.join(root, "src"));
  const serverLike = srcFiles.filter(
    (f) =>
      /\.server\.[cm]?[jt]sx?$/.test(f) ||
      /\.functions\.[cm]?[jt]sx?$/.test(f) ||
      /server\.ts$/.test(f),
  );

  const allNames = new Set([
    "getStartContext",
    "getSchoolDashboardCounts",
    "sendTestNotificationToSelf",
    "getMyStudentContext",
    "createServerFn",
    "createMiddleware",
    "getCookie",
    "setCookie",
    "getRequest",
    "getWebRequest",
    "getResponse",
    "createStartHandler",
  ]);

  for (const f of serverLike) {
    for (const n of collectExportNames(f)) allNames.add(n);
  }

  const uniqueLines = [
    "/* auto-generated capacitor server stubs — SPA runs offline; server work uses Supabase client or online API */",
    "const _noop = async () => null;",
    "const _ORIGIN = 'https://d4exam.name.ng';",
    "export const createServerFn = (opts) => {",
    "  let method = (opts && opts.method) || 'POST';",
    "  const chain = {",
    "    method(m) { method = m; return chain; },",
    "    inputValidator() { return chain; },",
    "    middleware() { return chain; },",
    "    handler(_h) {",
    "      const invoker = async (input) => {",
    "        // Client-side: most server logic is unavailable offline; callers should use Supabase.",
    "        // Online: attempt a soft no-op so UI does not crash; real auth uses client paths.",
    "        try {",
    "          if (typeof navigator !== 'undefined' && navigator.onLine === false) {",
    "            return { error: 'You are offline. Connect to the internet for this action.' };",
    "          }",
    "        } catch (_) {}",
    "        return { error: 'This action needs the online D4EXAM service. Open the app while online and try again.' };",
    "      };",
    "      invoker.url = '';",
    "      return invoker;",
    "    },",
    "  };",
    "  return chain;",
    "};",
    "export const createMiddleware = () => ({ server: (h) => h });",
    "export const createStartHandler = () => () => {};",
    "export const getCookie = () => undefined;",
    "export const setCookie = () => {};",
    "export const getRequest = () => undefined;",
    "export const getWebRequest = () => undefined;",
    "export const getResponse = () => undefined;",
    "export const getStartContext = () => ({});",
    "export default {};",
  ];
  const reserved = new Set([
    "createServerFn",
    "createMiddleware",
    "createStartHandler",
    "getCookie",
    "setCookie",
    "getRequest",
    "getWebRequest",
    "getResponse",
    "getStartContext",
    "default",
  ]);
  for (const n of [...allNames].sort()) {
    if (reserved.has(n)) continue;
    uniqueLines.push(`export const ${n} = _noop;`);
  }

  const stubFile = path.join(stubDir, "server-shim.js");
  fs.writeFileSync(stubFile, uniqueLines.join("\n") + "\n", "utf8");

  const nodeStub = path.join(stubDir, "node-shim.js");
  fs.writeFileSync(
    nodeStub,
    [
      "export default {};",
      "export const createHash = () => ({ update: () => ({ digest: () => '' }) });",
      "export const randomBytes = () => '';",
      "export const AsyncLocalStorage = class { run(_, f) { return f(); } getStore() { return undefined; } };",
      "export class Readable { static from() { return { pipe() {} }; } }",
      "export class Transform {}",
      "export class PassThrough {}",
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(
    "[prepare-capacitor-dist] Generated stubs for",
    allNames.size,
    "exports from",
    serverLike.length,
    "server files",
  );
  return { stubFile, nodeStub };
}

const { stubFile, nodeStub } = writeStubs();

fs.writeFileSync(
  path.join(stubDir, "paths.json"),
  JSON.stringify({ stubFile, nodeStub, root }),
  "utf8",
);

console.log("[prepare-capacitor-dist] Building Capacitor SPA (client-only)\u2026");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const build = spawnSync(
  process.execPath,
  [viteBin, "build", "--config", "vite.capacitor.config.ts"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      VITE_CONFIG_NATIVE_IGNORE_WARNING: "true",
      D4_CAP_STUB: stubFile,
      D4_CAP_NODE_STUB: nodeStub,
    },
  },
);
if (build.status !== 0) {
  console.error("FATAL: Capacitor SPA build failed");
  process.exit(build.status || 1);
}

if (!fs.existsSync(path.join(distCap, "capacitor-app.js"))) {
  console.error("FATAL: dist-capacitor/capacitor-app.js missing");
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });

for (const name of fs.readdirSync(distCap)) {
  const s = path.join(distCap, name);
  if (fs.statSync(s).isFile()) {
    fs.copyFileSync(s, path.join(dist, "assets", name));
  }
}

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  // Recursive: sub-folders (e.g. public/mediapipe) must reach the Android bundle
  fs.cpSync(publicDir, dist, { recursive: true, force: true });
}

const cssFile = fs.readdirSync(path.join(dist, "assets")).find((f) => f.endsWith(".css"));
const cssLink = cssFile ? `<link rel="stylesheet" href="./assets/${cssFile}" />` : "";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b1b3a" />
    <title>D4EXAM</title>
    ${cssLink}
    <style>
      html, body { margin: 0; min-height: 100%; background: #0b1b3a; }
      #root { min-height: 100dvh; }
      #d4-boot {
        position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: #0b1b3a; color: #e2e8f0; font-family: system-ui, sans-serif;
        text-align: center;
        padding: max(1rem, env(safe-area-inset-top)) 1.25rem max(1rem, env(safe-area-inset-bottom));
        transition: opacity 0.25s ease;
      }
      #d4-boot .boot-main {
        display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center;
      }
      #d4-boot img.logo {
        width: min(40vw, 160px); height: min(40vw, 160px); object-fit: contain;
        animation: d4pulse 1.6s ease-in-out infinite;
      }
      @keyframes d4pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.04); opacity: 0.92; }
      }
      #d4-boot .t {
        margin-top: 1.25rem; font-weight: 800; letter-spacing: 0.14em;
        font-size: clamp(1.5rem, 6vw, 2.25rem); color: #fff;
      }
      #d4-boot .t span.b { color: #2563eb; }
      #d4-boot .s {
        margin-top: 0.5rem; font-size: 10px; letter-spacing: 0.28em;
        color: #94a3b8; font-weight: 600;
      }
      #d4-boot .slogan {
        position: absolute; bottom: max(1.5rem, env(safe-area-inset-bottom));
        left: 0; right: 0; text-align: center;
        font-size: 11px; letter-spacing: 0.12em; color: #94a3b8; font-weight: 600;
        padding: 0 2rem;
      }
      #d4-boot .slogan span.hi { color: #60a5fa; }
      #d4-boot button {
        margin-top: 1.1rem; border: 0; border-radius: 0.75rem;
        background: #2563eb; color: #fff; font-weight: 600;
        padding: 0.7rem 1.25rem; display: none;
      }
      #d4-boot.show-retry button { display: inline-block; }
    </style>
  </head>
  <body>
    <div id="d4-boot" role="status">
      <div class="boot-main">
        <img class="logo" src="./logo.png" alt="D4EXAM" width="160" height="160" />
        <div class="t">D<span class="b">4</span>EXAM</div>
        <div class="s">Smart Examination System</div>
        <button type="button" id="d4-retry">Try again</button>
      </div>
      <div class="slogan">Fast • Secure • <span class="hi">Smart</span> • Seamless</div>
    </div>
    <div id="root"></div>
    <script>
      setTimeout(function () {
        var b = document.getElementById("d4-boot");
        if (b && b.style.display !== "none") b.classList.add("show-retry");
      }, 15000);
      document.getElementById("d4-retry").onclick = function () { location.reload(); };
    </script>
    <script type="module" src="./assets/capacitor-app.js"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(dist, "index.html"), html, "utf8");

const offlinePath = path.join(dist, "offline.html");
if (fs.existsSync(offlinePath)) {
  let offline = fs.readFileSync(offlinePath, "utf8");
  offline = offline.replace(/https:\/\/d4exam-platform\.vercel\.app\/?/g, "./");
  offline = offline.replace(/window\.location\.replace\(\s*LIVE[^)]*\)/g, "window.location.reload()");
  offline = offline.replace(/window\.location\.href\s*=\s*LIVE/g, "window.location.reload()");
  fs.writeFileSync(offlinePath, offline, "utf8");
}

console.log("[prepare-capacitor-dist] SPA shell ready (no Vercel).");
console.log("  assets:", fs.readdirSync(path.join(dist, "assets")).length, "files");
