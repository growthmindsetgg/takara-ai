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
const dec = join(ROOT, ".data", "decisions.jsonl");
if (existsSync(dec)) copyFileSync(dec, join(P, "data", "decisions.jsonl"));
// product page + its static data
for (const f of ["architecture.svg", "deployment.json", "judge-run.json", "owner-snapshot.json"]) copyFileSync(join(ROOT, "site", f), join(P, f));
let site = readFileSync(join(ROOT, "site", "index.html"), "utf8");
const PLATFORM_BAR = `<div style="background:#0f6b5c;color:#fff;text-align:center;padding:10px 16px;font:600 15px/1.4 system-ui,sans-serif">Live platform: <a href="/app" style="color:#fff;text-decoration:underline">open the Takara AI owner console</a> (owner view, policy controls, read-only chat, public ledger)</div>`;
if (!site.includes('href="/app"')) site = site.replace(/<body([^>]*)>/, `<body$1>
${PLATFORM_BAR}`);
writeFileSync(join(P, "index.html"), site);
// owner dashboard, hosted mode
let app = readFileSync(join(ROOT, "web", "index.html"), "utf8");
const DEMO_BAR = `<div role="note" style="background:#fbf0dc;color:#5c3a12;text-align:center;padding:10px 16px;font:500 14px/1.45 system-ui,sans-serif;border-bottom:1px solid #ecd9b4">Hosted demo of the <b>fictional</b> fixture treasury on NEAR testnet. Figures are live from chain. Signing is disabled here: a public site never holds a signer's key. <a href="/" style="color:#5c3a12">Product page</a> · <a href="https://github.com/growthmindsetgg/takara-ai" style="color:#5c3a12">GitHub</a></div>`;
app = app.replace(/<body([^>]*)>/, `<body$1>
${DEMO_BAR}`);
writeFileSync(join(P, "app", "index.html"), app);
console.log("platform assembled:", readdirSync(P).join(", "));
