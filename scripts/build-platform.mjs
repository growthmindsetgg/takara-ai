// Assemble platform/ (the hosted Vercel app): product page at /, owner dashboard at /app,
// serverless API under /api. Copies the engine wasm, public deployment record, judge run and
// the decision log (rebuilt from on-chain outcomes; contains no secrets).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = join(ROOT, "platform");
mkdirSync(join(P, "data"), { recursive: true });
mkdirSync(join(P, "app"), { recursive: true });
copyFileSync(join(ROOT, "dist", "takara-engine.wasm"), join(P, "data", "takara-engine.wasm"));
copyFileSync(join(ROOT, "fixtures", "deployment.json"), join(P, "data", "deployment.json"));
// The hosted app has no write path, so its activity feed is this file as of the build. Every build
// refreshes it from the latest local log; the app labels the feed "Activity as of <latest entry>".
const dec = join(ROOT, ".data", "decisions.jsonl");
if (existsSync(dec)) {
  copyFileSync(dec, join(P, "data", "decisions.jsonl"));
  const lines = readFileSync(dec, "utf8").trim().split("\n").filter(Boolean);
  const latest = lines.length ? JSON.parse(lines[lines.length - 1]).at : "none";
  console.log(`decision log: ${lines.length} entries, latest ${latest}`);
} else console.warn("warning: .data/decisions.jsonl not found; the hosted activity feed keeps its previous copy");
// shared read-only chat intents (the local server imports the same file from scripts/lib)
copyFileSync(join(ROOT, "scripts", "lib", "chat.mjs"), join(P, "lib", "chat.mjs"));
// product page + its static data
for (const f of ["architecture.svg", "deployment.json", "judge-run.json", "owner-snapshot.json"]) copyFileSync(join(ROOT, "site", f), join(P, f));
let site = readFileSync(join(ROOT, "site", "index.html"), "utf8");
const PLATFORM_BAR = `<div style="background:#0f6b5c;color:#fff;text-align:center;padding:10px 16px;font:600 15px/1.4 system-ui,sans-serif">Live platform: <a href="/app" style="color:#fff;text-decoration:underline">open the Takara AI owner console</a> (owner view, policy controls, read-only chat, public ledger)</div>`;
if (!site.includes('href="/app"')) site = site.replace(/<body([^>]*)>/, `<body$1>
${PLATFORM_BAR}`);
writeFileSync(join(P, "index.html"), site);
// owner dashboard: a byte-identical copy of web/index.html. The app detects hosted mode itself
// (the token placeholder is left unreplaced) and renders its own demo banner.
copyFileSync(join(ROOT, "web", "index.html"), join(P, "app", "index.html"));
console.log("platform assembled:", readdirSync(P).join(", "));
