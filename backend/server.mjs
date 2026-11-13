// Takara AI local dashboard server (owner's machine).
//   node backend/server.mjs   ->  http://localhost:8787
//
// - Public ledger: exactly what anyone can read on-chain (states, hashes, attestation refs).
// - Owner view: deterministic figures from the engine report (owner's ledger key, local only),
//   each with the query that produced it.
// - Policy controls: three settings -> JSON diff + a ready-to-sign proposal. A policy signer signs
//   it in their own browser wallet (the page never holds a key). The CLI-keychain endpoint
//   /api/policy/sign stays as a secondary fallback for operators without a wallet.
// - Chat: read-only. Answers come from recorded decisions and the deterministic report; it can
//   never move money, approve anything, or change a vendor record.
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { view, call, explorer, outcome, recordDecision, RPC } from "../scripts/lib/near.mjs";
import { runEngine } from "../scripts/lib/engine.mjs";
import * as K from "../scripts/lib/takara.mjs";
import { answer } from "../scripts/lib/chat.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const POLICY_PLAIN = join(K.ROOT, ".secrets", "policy.plain.json");
const DECISIONS = join(K.ROOT, ".data", "decisions.jsonl");
const fmt6 = (s) => (Number(s) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });
// Per-launch token: only the page this server served can call owner endpoints. Together with
// the Host and Origin checks this blocks cross-site requests and DNS rebinding.
const TOKEN = randomBytes(24).toString("hex");
const HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const ORIGINS = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);

async function publicLedger() {
  const cfg = await view(K.T, "get_config");
  const commitments = await view(K.T, "list_commitments", { from: "0", limit: 100 });
  const changes = await view(K.T, "list_vendor_changes");
  return {
    treasury: K.T,
    network: "testnet",
    balance: fmt6(cfg.balance),
    paused: cfg.paused,
    agent: cfg.agent,
    owners: cfg.owners,
    signers: cfg.signers,
    threshold: cfg.threshold,
    policy_expires_at: cfg.policy_expires_at,
    policy: { version: cfg.policy_version, hash: cfg.policy_hash },
    engine: cfg.engine,
    ledger_state_hash: cfg.ledger_state_hash,
    commitments: commitments.map((c) => ({ id: c.id, state: c.state, priority: c.priority, flags: c.flags, evidence_hash: c.evidence_hash, commitment_hash: c.commitment_hash, vendor_ref: c.vendor_ref, request_no: c.attestation.request_no, output_hash: c.attestation.output_hash, settled_nonce: c.settled_nonce })),
    vendor_changes: changes,
    note: "Public state holds commitments, hashes and attestations only. Amounts, vendors and payees are sealed.",
  };
}

function decisions() {
  if (!existsSync(DECISIONS)) return [];
  return readFileSync(DECISIONS, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// ------------------------------------------------------------------ read-only chat
// Plain-language intents shared with the hosted platform (scripts/lib/chat.mjs).
async function chat(q) {
  return answer(q, {
    report: K.report, decisions, openSealed: K.openSealed, explorer,
    vendorChanges: () => view(K.T, "list_vendor_changes"),
    policy: async () => { const { policy } = await currentPolicy(); return { max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days }; },
  });
}

// ------------------------------------------------------------------ policy controls
const CONTROLS = ["max_auto_pay", "cooling_off_hours", "min_runway_days"];

const sha256 = (s) => createHash("sha256").update(s).digest("hex"); // policy hash = sha256(plaintext), engine seal_policy_local

// The local plaintext copy is only a cache. If a signer applied a new version from a wallet (or
// anywhere else), rebuild it from the on-chain sealed policy with the owner's ledger key, and
// prove the rebuild against the on-chain hash before trusting it.
async function currentPolicy() {
  const cfg = await view(K.T, "get_config");
  let pt = existsSync(POLICY_PLAIN) ? readFileSync(POLICY_PLAIN, "utf8") : null;
  if (!pt || sha256(pt) !== cfg.policy_hash) {
    const opened = await K.openSealed((await view(K.T, "get_policy")).sealed);
    const candidate = opened && (typeof opened === "string" ? opened : JSON.stringify(opened));
    if (!candidate || sha256(candidate) !== cfg.policy_hash) throw new Error("could not rebuild the on-chain policy from its sealed copy");
    pt = candidate;
    writeFileSync(POLICY_PLAIN, pt);
  }
  return { pt, policy: JSON.parse(pt), cfg };
}

async function policyDiff(body) {
  const { policy, cfg } = await currentPolicy();
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
  const sealed = await runEngine({ v: 1, op: "seal_policy_local", pt: nextPt, eph: randomBytes(32).toString("hex"), sk: K.ownerKeys().engine_sk });
  // Ready-to-sign propose_policy args. The browser re-checks hash, diff_hash, version and expiry
  // before its wallet signs. Only a hash of the reviewed diff goes on-chain.
  const propose = Object.keys(diff).length > 1 ? {
    version: next.version,
    hash: sealed.hash,
    expires_at: String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n),
    sealed: sealed.sealed,
    diff_hash: sha256(JSON.stringify(diff)),
  } : null;
  return { diff, next_hash: sealed.hash, next_pt: nextPt, propose, signer: K.SIGNER, signers: cfg.signers, threshold: cfg.threshold, current_hash: cfg.policy_hash };
}

// Fallback for operators without a browser wallet: signs with the signer key in the NEAR CLI
// legacy keychain on this machine. The wallet path in the page is the primary one.
async function policySign(body) {
  const d = await policyDiff(body);
  if (!d.propose) throw new Error("nothing changed");
  const r = await call(K.SIGNER, K.T, "propose_policy", d.propose, { gas: "60.0 Tgas" });
  if (r.ok) writeFileSync(POLICY_PLAIN, d.next_pt);
  return { ok: r.ok, failure: r.failure, tx: r.txHash, url: explorer(r.txHash), diff: d.diff, policy_hash: d.next_hash };
}

// A wallet transaction sent from the page, added to the local decision log so Activity shows it.
// The server fetches the transaction itself: signer, method and outcome never come from the client.
const RECORDABLE = new Set(["accept_commitment", "close_commitment", "approve_vendor_change", "reject_vendor_change", "propose_policy", "approve_policy", "pause", "unpause", "revoke_agent", "set_agent", "recover"]);
async function recordWalletTx(body) {
  const tx = String(body.tx || ""), sender = String(body.signer || "");
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(tx)) throw new Error("invalid transaction hash");
  if (!/^[a-z0-9._-]{2,64}$/.test(sender)) throw new Error("invalid signer account");
  if (decisions().some((d) => d.tx === tx)) return { ok: true, recorded: false };
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tx", params: { tx_hash: tx, sender_account_id: sender, wait_until: "FINAL" } }) });
  const j = await res.json().catch(() => ({}));
  if (j.error || !j.result) throw new Error("transaction not found on testnet");
  const t = j.result.transaction;
  const fc = t.actions && t.actions[0] && t.actions[0].FunctionCall;
  if (t.receiver_id !== K.T || !fc || !RECORDABLE.has(fc.method_name)) throw new Error("not a treasury action this app records");
  recordDecision(t.signer_id, K.T, fc.method_name, await outcome(tx, t.signer_id));
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
    if (req.method === "GET" && url.pathname === "/api/public") return send(res, 200, await publicLedger());
    const origin = req.headers.origin;
    if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: "cross-origin request refused" });
    if (req.headers["x-takara-token"] !== TOKEN) return send(res, 403, { error: "missing or wrong dashboard token" });
    if (req.method === "POST" && !String(req.headers["content-type"]).startsWith("application/json")) return send(res, 415, { error: "JSON only" });
    if (req.method === "GET" && url.pathname === "/api/owner/report") return send(res, 200, await K.report());
    if (req.method === "GET" && url.pathname === "/api/decisions") return send(res, 200, decisions().slice(-60).reverse());
    if (req.method === "POST" && url.pathname === "/api/chat") return send(res, 200, await chat((await readBody(req)).q));
    if (req.method === "GET" && url.pathname === "/api/policy/current") { const { policy, cfg } = await currentPolicy(); return send(res, 200, { version: cfg.policy_version, hash: cfg.policy_hash, max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days }); }
    if (req.method === "POST" && url.pathname === "/api/policy/diff") return send(res, 200, await policyDiff(await readBody(req)));
    if (req.method === "POST" && url.pathname === "/api/policy/sign") return send(res, 200, await policySign(await readBody(req)));
    if (req.method === "POST" && url.pathname === "/api/decisions/record") return send(res, 200, await recordWalletTx(await readBody(req)));
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Takara AI dashboard: http://localhost:${PORT}`));
