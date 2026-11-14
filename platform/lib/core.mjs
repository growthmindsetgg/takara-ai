// Takara AI hosted platform core (Vercel serverless). Same logic as backend/server.mjs, for a
// public demo of the fictional fixture business on NEAR testnet and, once its deployment record is
// bundled (data/deployment.mainnet.json), NEAR mainnet. Each request picks its network with
// ?network= or the x-takara-network header (allow-list in lib/networks.mjs); without one it gets
// the default from networkStatus().
//
// - Reads chain state over JSON-RPC; runs the same engine wasm (committed in dist/) with WASI.
// - The owner view uses TAKARA_ENGINE_SK (testnet) or TAKARA_ENGINE_SK_MAINNET (mainnet), the
//   FIXTURE business's ledger key, stored as an encrypted Vercel environment variable. A real
//   business would never put its key on a server; this demo exposes only fictional business data.
// - Signing never happens here: no signer, owner or agent key exists on this server. A policy
//   signer or owner signs in their own browser wallet; /api/policy/diff only prepares the
//   propose_policy arguments, which the browser re-checks before the wallet opens.
import { readFileSync, writeFileSync, mkdtempSync, openSync, closeSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WASI } from "node:wasi";
import { randomBytes, createHash } from "node:crypto";
import { answer, dedupeDecisions } from "./chat.mjs";
import { netContext, networkStatus as status, requestedNetwork, ownerReport, publicLedger as ledger, belongsTo } from "./networks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DATA = join(ROOT, "data");
const SK_ENV = { testnet: "TAKARA_ENGINE_SK", mainnet: "TAKARA_ENGINE_SK_MAINNET" };

/** Which networks are live, and the default. Public: says only whether an owner key is configured. */
export const networkStatus = () => status(DATA, (id) => !!process.env[SK_ENV[id]]);

/** The request's network context: the asked-for network (validated), else the default. */
export async function contextFor(req) {
  const id = requestedNetwork(req) ?? (await networkStatus()).default;
  return netContext(DATA, id);
}

let compiled;
async function runEngine(input) {
  compiled ??= await WebAssembly.compile(readFileSync(join(DATA, "takara-engine.wasm")));
  const dir = mkdtempSync(join(tmpdir(), "takara-"));
  try {
    const inPath = join(dir, "in");
    const outPath = join(dir, "out");
    writeFileSync(inPath, JSON.stringify(input));
    writeFileSync(outPath, "");
    const stdin = openSync(inPath, "r");
    const stdout = openSync(outPath, "w");
    try {
      const wasi = new WASI({ version: "preview1", args: [], env: {}, stdin, stdout, stderr: 2, returnOnExit: true });
      wasi.start(await WebAssembly.instantiate(compiled, wasi.getImportObject()));
    } finally {
      closeSync(stdin);
      closeSync(stdout);
    }
    return JSON.parse(readFileSync(outPath, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function ownerKey(ctx) {
  const k = process.env[SK_ENV[ctx.id]];
  if (!k) throw new Error(`The owner view for NEAR ${ctx.id} isn't set up on this deployment.`);
  return k;
}

export const publicLedger = (ctx) => ledger(ctx);

/** Owner report: same engine binary, over every non-closed commitment. */
export async function report(ctx) {
  const r = await ownerReport(ctx, runEngine, ownerKey(ctx));
  return { ...r, hosted_demo: true, network: ctx.id, note: "Owner view of the fictional fixture business (hosted demo)." };
}

async function openSealed(ctx, sealed) {
  const r = await runEngine({ v: 1, op: "open_local", sk: ownerKey(ctx), sealed });
  return r.ok ? r.plaintext : null;
}

/** The bundled decision log (one file for both networks), filtered to this network's deployment. */
export function decisions(ctx) {
  const p = join(DATA, "decisions.jsonl");
  if (!existsSync(p)) return [];
  return dedupeDecisions(readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter(belongsTo(ctx)));
}

/** Read-only chat: the shared plain-language intents (scripts/lib/chat.mjs, copied here at build). */
export async function chat(ctx, q) {
  return answer(q, {
    report: () => report(ctx), decisions: () => decisions(ctx), openSealed: (s) => openSealed(ctx, s),
    vendorChanges: () => ctx.view(ctx.T, "list_vendor_changes"), policy: () => policyCurrent(ctx), explorer: ctx.explorer,
    network: ctx.id, settleMovesTokens: ctx.settleMovesTokens,
  });
}

// ------------------------------------------------------------------ policy (preview only)
const CONTROLS = ["max_auto_pay", "cooling_off_hours", "min_runway_days"];

async function currentPolicy(ctx) {
  const cfg = await ctx.view(ctx.T, "get_config");
  const header = await ctx.view(ctx.T, "get_policy");
  const policy = await openSealed(ctx, header.sealed);
  if (!policy) throw new Error("policy unreadable");
  return { policy, cfg };
}

export async function policyCurrent(ctx) {
  const { policy, cfg } = await currentPolicy(ctx);
  return { version: cfg.policy_version, hash: cfg.policy_hash, max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days };
}

export async function policyDiff(ctx, body = {}) {
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
  const sealed = await runEngine({ v: 1, op: "seal_policy_local", pt: nextPt, eph: randomBytes(32).toString("hex"), sk: ownerKey(ctx) });
  const sha256 = (s) => createHash("sha256").update(s).digest("hex");
  return {
    diff, next_hash: sealed.hash, signer: ctx.D.accounts.signer, signers: cfg.signers, threshold: cfg.threshold, current_hash: cfg.policy_hash, hosted_demo: true, network: ctx.id,
    // Fictional fixture data only. A production build returns the plaintext from the owner's
    // local server only. The browser hashes it to check `propose.hash` before signing.
    next_pt: nextPt,
    // Ready-to-sign propose_policy arguments. Signed in the policy signer's own wallet, never here.
    propose: Object.keys(diff).length > 1 ? {
      version: next.version,
      hash: sealed.hash,
      expires_at: String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n),
      sealed: sealed.sealed,
      diff_hash: sha256(JSON.stringify(diff)),
    } : null,
  };
}

export function signDisabled(ctx) {
  const { T, D } = ctx;
  return {
    ok: false,
    failure: "Server-side signing is disabled on the hosted demo",
    error: `This server never signs: a public website must never hold a policy signer's key. A policy signer signs the proposal in their own wallet from the app (Connect wallet), or from their machine (local dashboard, or: near contract call-function as-transaction ${T} propose_policy ... sign-as ${D.accounts.signer} network-config ${ctx.id}). The contract rejects anyone else with E_NOT_POLICY_SIGNER.`,
  };
}

/** Small JSON handler wrapper for Vercel Node functions. fn(body, req, ctx): ctx is the request's
 *  network context ({ net: false } for routes that don't need one). */
export function handler(fn, { methods = ["GET"], net = true } = {}) {
  return async (req, res) => {
    res.setHeader("cache-control", "no-store");
    res.setHeader("content-type", "application/json");
    if (!methods.includes(req.method)) {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: "method not allowed" }));
    }
    try {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      const ctx = net ? await contextFor(req) : null;
      if (ctx) res.setHeader("x-takara-network", ctx.id);
      const out = await fn(body ?? {}, req, ctx);
      res.statusCode = out?.status ?? 200;
      res.end(JSON.stringify(out));
    } catch (e) {
      res.statusCode = e.status === 400 || e.status === 404 ? e.status : 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  };
}
