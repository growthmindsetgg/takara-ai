// Takara AI local dashboard server (owner's machine).
//   node backend/server.mjs   ->  http://localhost:8787
//
// - Public ledger: exactly what anyone can read on-chain (states, hashes, attestation refs).
// - Owner view: deterministic figures from the engine report (owner's ledger key, local only),
//   each with the query that produced it.
// - Policy controls: three settings -> JSON diff + a ready-to-sign proposal. A policy signer signs
//   it in their own browser wallet (the page never holds a key). The CLI-keychain endpoint
//   /api/policy/sign stays as a secondary fallback for operators without a wallet.
// - Network: testnet, and mainnet once fixtures/deployment.mainnet.json exists. Each request picks
//   one with ?network= or x-takara-network (allow-list in scripts/lib/networks.mjs); without one
//   it gets the default (GET /api/network). Mainnet owner key: TAKARA_KEYS_MAINNET (a JSON file
//   with engine_sk, like .secrets/keys.json) or .secrets/mainnet/keys.json.
// - Chat: read-only. Answers come from recorded decisions and the deterministic report; it can
//   never move money, approve anything, or change a vendor record.
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { call, recordDecision, NETWORK as CLI_NETWORK } from "../scripts/lib/near.mjs";
import { netContext, networkStatus, requestedNetwork, ownerReport, publicLedger as ledger, belongsTo, outcome } from "../scripts/lib/networks.mjs";
import { runEngine } from "../scripts/lib/engine.mjs";
import * as K from "../scripts/lib/takara.mjs";
import { answer, dedupeDecisions } from "../scripts/lib/chat.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const FIXTURES = process.env.TAKARA_DEPLOYMENTS_DIR ?? join(K.ROOT, "fixtures"); // override: tests only
const POLICY_PLAIN = { testnet: join(K.ROOT, ".secrets", "policy.plain.json"), mainnet: join(K.ROOT, ".secrets", "mainnet", "policy.plain.json") };
const DECISIONS = join(K.ROOT, ".data", "decisions.jsonl");

/** The owner's ledger key for a network (local only), or null. Same files scripts/lib/takara.mjs reads. */
function ownerSk(id) {
  const p = id === "testnet" ? join(K.ROOT, ".secrets", "keys.json") : process.env.TAKARA_KEYS_MAINNET ?? join(K.ROOT, ".secrets", "mainnet", "keys.json");
  try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")).engine_sk ?? null : null; } catch { return null; }
}
const needSk = (ctx) => { const k = ownerSk(ctx.id); if (!k) throw new Error(`owner keys for NEAR ${ctx.id} not found on this machine: reports are for the owner`); return k; };
const status = () => networkStatus(FIXTURES, (id) => !!ownerSk(id));
async function contextFor(req) { return netContext(FIXTURES, requestedNetwork(req) ?? (await status()).default); }
// The network the owner tools (scripts/lib/takara.mjs, NEAR_NETWORK) were started on keeps using them; the other runs the same logic with its own key.
const reportFor = (ctx) => (ctx.id === CLI_NETWORK ? K.report() : ownerReport(ctx, runEngine, needSk(ctx)));
async function openSealedFor(ctx, sealed) {
  if (ctx.id === CLI_NETWORK) return K.openSealed(sealed);
  const r = await runEngine({ v: 1, op: "open_local", sk: needSk(ctx), sealed });
  return r.ok ? r.plaintext : null;
}
// Per-launch token: only the page this server served can call owner endpoints. Together with
// the Host and Origin checks this blocks cross-site requests and DNS rebinding.
const TOKEN = randomBytes(24).toString("hex");
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const ORIGINS = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);

// One local log holds both networks (scripts/lib/near.mjs appends to it); each view keeps its own deployment's entries.
function decisions(ctx) {
  if (!existsSync(DECISIONS)) return [];
  return dedupeDecisions(readFileSync(DECISIONS, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter(belongsTo(ctx)));
}

// ------------------------------------------------------------------ read-only chat
// Plain-language intents shared with the hosted platform (scripts/lib/chat.mjs).
async function chat(ctx, q) {
  return answer(q, {
    report: () => reportFor(ctx), decisions: () => decisions(ctx), openSealed: (s) => openSealedFor(ctx, s), explorer: ctx.explorer,
    network: ctx.id, settleMovesTokens: ctx.settleMovesTokens,
    vendorChanges: () => ctx.view(ctx.T, "list_vendor_changes"),
    policy: async () => { const { policy } = await currentPolicy(ctx); return { max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days }; },
  });
}

// ------------------------------------------------------------------ policy controls
const CONTROLS = ["max_auto_pay", "cooling_off_hours", "min_runway_days"];

const sha256 = (s) => createHash("sha256").update(s).digest("hex"); // policy hash = sha256(plaintext), engine seal_policy_local

// The local plaintext copy is only a cache. If a signer applied a new version from a wallet (or
// anywhere else), rebuild it from the on-chain sealed policy with the owner's ledger key, and
// prove the rebuild against the on-chain hash before trusting it.
async function currentPolicy(ctx) {
  const cfg = await ctx.view(ctx.T, "get_config");
  const cacheFile = POLICY_PLAIN[ctx.id];
  let pt = existsSync(cacheFile) ? readFileSync(cacheFile, "utf8") : null;
  if (!pt || sha256(pt) !== cfg.policy_hash) {
    const opened = await openSealedFor(ctx, (await ctx.view(ctx.T, "get_policy")).sealed);
    const candidate = opened && (typeof opened === "string" ? opened : JSON.stringify(opened));
    if (!candidate) throw new Error("could not rebuild the on-chain policy from its sealed copy");
    const parsed = JSON.parse(candidate);
    if (sha256(candidate) === cfg.policy_hash) { pt = candidate; try { writeFileSync(cacheFile, pt); } catch { /* cache only */ } }
    // The engine returns the policy re-serialized (key order differs), so the bytes can't match the
    // on-chain hash. Opening it with the owner's key authenticates it; check the version and don't cache it.
    else if (Number(parsed.version) === Number(cfg.policy_version)) return { pt: candidate, policy: parsed, cfg };
    else throw new Error("could not rebuild the on-chain policy from its sealed copy");
  }
  return { pt, policy: JSON.parse(pt), cfg };
}

async function policyDiff(ctx, body) {
  const { policy, cfg } = await currentPolicy(ctx);
  const next = { ...policy, version: cfg.policy_version + 1 };
  const diff = {};
  for (const k of CONTROLS) {
    if (body[k] === undefined || body[k] === "") continue;
    const v = k === "max_auto_pay" ? String(Math.round(Number(body[k]) * 10 ** policy.decimals)) : Number(body[k]);
    if ((k === "max_auto_pay" && !(Number(v) > 0)) || (k !== "max_auto_pay" && !(Number.isInteger(v) && v >= 0 && v <= 720))) throw new Error(`invalid ${k}`);
    if (String(policy[k]) !== String(v)) diff[k] = { from: policy[k], to: v };
    next[k] = v;
  }
  diff.version = { from: policy.version, to: next.version };
  const nextPt = JSON.stringify(next);
  const sealed = await runEngine({ v: 1, op: "seal_policy_local", pt: nextPt, eph: randomBytes(32).toString("hex"), sk: needSk(ctx) });
  // Ready-to-sign propose_policy args. The browser re-checks hash, diff_hash, version and expiry
  // before its wallet signs. Only a hash of the reviewed diff goes on-chain.
  const propose = Object.keys(diff).length > 1 ? {
    version: next.version,
    hash: sealed.hash,
    expires_at: String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n),
    sealed: sealed.sealed,
    diff_hash: sha256(JSON.stringify(diff)),
  } : null;
  return { diff, next_hash: sealed.hash, next_pt: nextPt, propose, signer: ctx.D.accounts.signer, network: ctx.id, signers: cfg.signers, threshold: cfg.threshold, current_hash: cfg.policy_hash };
}

// Fallback for operators without a browser wallet: signs with the signer key in the NEAR CLI
// legacy keychain on this machine. The wallet path in the page is the primary one.
async function policySign(ctx, body) {
  if (ctx.id !== CLI_NETWORK) throw new Error(`The CLI fallback signs on NEAR ${CLI_NETWORK} only. Sign this ${ctx.id} proposal in a wallet.`);
  const d = await policyDiff(ctx, body);
  if (!d.propose) throw new Error("nothing changed");
  const r = await call(ctx.D.accounts.signer, ctx.T, "propose_policy", d.propose, { gas: "60.0 Tgas" });
  if (r.ok) writeFileSync(POLICY_PLAIN[ctx.id], d.next_pt);
  return { ok: r.ok, failure: r.failure, tx: r.txHash, url: ctx.explorer(r.txHash), diff: d.diff, policy_hash: d.next_hash };
}

// A wallet transaction sent from the page, added to the local decision log so Activity shows it.
// The server fetches the transaction itself: signer, method and outcome never come from the client.
const RECORDABLE = new Set(["accept_commitment", "close_commitment", "approve_vendor_change", "reject_vendor_change", "propose_policy", "approve_policy", "pause", "unpause", "revoke_agent", "set_agent", "recover"]);
async function recordWalletTx(ctx, body) {
  const tx = String(body.tx || ""), sender = String(body.signer || "");
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tx)) throw new Error("invalid transaction hash");
  if (!/^[a-z0-9._-]{2,64}$/.test(sender)) throw new Error("invalid signer account");
  if (decisions(ctx).some((d) => d.tx === tx)) return { ok: true, recorded: false };
  let o;
  try { o = await outcome(ctx.id, tx, sender); } catch { throw new Error(`transaction not found on NEAR ${ctx.id}`); }
  const t = o.transaction;
  const fc = t.actions && t.actions[0] && t.actions[0].FunctionCall;
  if (t.receiver_id !== ctx.T || !fc || !RECORDABLE.has(fc.method_name)) throw new Error("not a treasury action this app records");
  recordDecision(t.signer_id, ctx.T, fc.method_name, o);
  return { ok: true, recorded: true };
}

// ------------------------------------------------------------------ http
const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};
const readBody = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

createServer(async (req, res) => {
  try {
    if (!HOSTS.has(String(req.headers.host).toLowerCase())) return send(res, 421, { error: "unexpected Host" });
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, readFileSync(join(K.ROOT, "web", "index.html"), "utf8").replace("__TAKARA_TOKEN__", TOKEN), "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/api/network") return send(res, 200, await status());
    if (req.method === "GET" && url.pathname === "/api/public") return send(res, 200, await ledger(await contextFor(req)));
    const origin = req.headers.origin;
    if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: "cross-origin request refused" });
    if (req.headers["x-takara-token"] !== TOKEN) return send(res, 403, { error: "missing or wrong dashboard token" });
    if (req.method === "POST" && !String(req.headers["content-type"]).startsWith("application/json")) return send(res, 415, { error: "JSON only" });
    const ctx = await contextFor(req);
    if (req.method === "GET" && url.pathname === "/api/owner/report") return send(res, 200, await reportFor(ctx));
    if (req.method === "GET" && url.pathname === "/api/decisions") return send(res, 200, decisions(ctx).slice(-200).reverse());
    if (req.method === "POST" && url.pathname === "/api/chat") return send(res, 200, await chat(ctx, (await readBody(req)).q));
    if (req.method === "GET" && url.pathname === "/api/policy/current") { const { policy, cfg } = await currentPolicy(ctx); return send(res, 200, { version: cfg.policy_version, hash: cfg.policy_hash, max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days }); }
    if (req.method === "POST" && url.pathname === "/api/policy/diff") return send(res, 200, await policyDiff(ctx, await readBody(req)));
    if (req.method === "POST" && url.pathname === "/api/policy/sign") return send(res, 200, await policySign(ctx, await readBody(req)));
    if (req.method === "POST" && url.pathname === "/api/decisions/record") return send(res, 200, await recordWalletTx(ctx, await readBody(req)));
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, e.status === 400 || e.status === 404 ? e.status : 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Takara AI dashboard: http://localhost:${PORT}`));
