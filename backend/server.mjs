// Takara AI local dashboard server (owner's machine).
//   node backend/server.mjs   ->  http://localhost:8787
//
// - Public ledger: exactly what anyone can read on-chain (states, hashes, attestation refs).
// - Owner view: deterministic figures from the engine report (owner's ledger key, local only),
//   each with the query that produced it.
// - Policy controls: three settings -> JSON diff -> explicit signature by a policy signer.
// - Chat: read-only. Answers come from recorded decisions and the deterministic report; it can
//   never move money, approve anything, or change a vendor record.
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { view, call, explorer } from "../scripts/lib/near.mjs";
import { runEngine } from "../scripts/lib/engine.mjs";
import * as K from "../scripts/lib/takara.mjs";

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
async function chat(q) {
  const text = String(q ?? "").toLowerCase();
  if (/\b(pay|send|approve|accept|transfer|change|update|set|raise|delete|withdraw)\b/.test(text) && !/why|what|which|how much|show|list/.test(text)) {
    return { answer: "This chat is read-only. It can explain decisions and figures, but it cannot pay, approve, or change anything. Use the policy controls (signature required) or ask a policy signer.", sources: [] };
  }
  const rep = await K.report();
  const byId = Object.fromEntries(rep.commitments.map((c) => [String(c.id), c]));
  const label = (id) => (byId[id] ? `#${id} ${byId[id].vendor} ${byId[id].amount} ${rep.symbol} (${byId[id].priority}, ${byId[id].state})` : `#${id}`);

  if (/why|blocked|refused|rejected|denied|held/.test(text)) {
    const amount = text.match(/(\d[\d,]*(?:\.\d+)?)/)?.[1]?.replace(/,/g, "");
    const refusals = decisions().filter((d) => d.value && d.value.ok === false && d.value.reason).reverse();
    const match = refusals.find((d) => !amount || byId[d.value.commitment_id]?.amount === amount) ?? refusals[0];
    if (!match) return { answer: "No refusals have been recorded yet.", sources: [] };
    const v = match.value;
    let shortfall = null;
    if (v.detail) shortfall = await K.openSealed(v.detail);
    const lines = [`Commitment ${label(v.commitment_id)} was refused with reason \`${v.reason}\`.`];
    if (v.blocking?.length) lines.push(`Blocking commitments: ${v.blocking.map(label).join("; ")}.`);
    if (shortfall?.shortfall) lines.push(`Spendable was ${shortfall.spendable} ${rep.symbol}; the request was ${shortfall.requested}; shortfall ${shortfall.shortfall} ${rep.symbol}.`);
    if (v.until) lines.push(`Held until ${new Date(Number(BigInt(v.until) / 1_000_000n)).toISOString()}.`);
    return { answer: lines.join(" "), reason: v.reason, blocking: v.blocking, sources: [{ tx: match.tx, url: explorer(match.tx) }] };
  }
  if (/spend|balance|reserv|runway|how much|available/.test(text)) {
    const f = rep.figures;
    return {
      answer: `Treasury balance ${f.treasury_balance} ${rep.symbol}; reserved for accepted commitments ${f.reserved}; settled outflow ${f.settled_outflow}; spendable ${f.spendable}; runway ${f.runway_days ?? "n/a"} days.`,
      figures: f,
      queries: rep.queries,
      sources: [{ query: "engine report (deterministic)" }],
    };
  }
  if (/vendor|destination|suspend|cooling|change/.test(text)) {
    const changes = await view(K.T, "list_vendor_changes");
    if (!changes.length) return { answer: "No vendor destination changes have been detected.", sources: [] };
    return { answer: changes.map((c) => `Change ${c.id} on ${label(c.commitment_id)}: ${c.settlement_status}${c.decided_by ? ` (decided by ${c.decided_by})` : ""}. Proposed destination ${byId[c.commitment_id]?.proposed_destination ?? "?"} vs verified ${byId[c.commitment_id]?.destination ?? "?"}.`).join("\n"), sources: [] };
  }
  if (/commitment|bill|invoice|list|pending|claimed|accepted/.test(text)) {
    return { answer: rep.commitments.map((c) => label(c.id)).join("\n") || "No commitments.", sources: [] };
  }
  return { answer: 'Ask me things like: "why was the 400 payment blocked?", "what is spendable?", "any vendor changes?", "list commitments". I am read-only.', sources: [] };
}

// ------------------------------------------------------------------ policy controls
const CONTROLS = ["max_auto_pay", "cooling_off_hours", "min_runway_days"];

async function currentPolicy() {
  const pt = readFileSync(POLICY_PLAIN, "utf8");
  const cfg = await view(K.T, "get_config");
  const hash = (await runEngine({ v: 1, op: "seal_policy_local", pt, eph: randomBytes(32).toString("hex"), sk: K.ownerKeys().engine_sk })).hash;
  if (hash !== cfg.policy_hash) throw new Error("local policy copy does not match the on-chain policy hash");
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
  return { diff, next_hash: sealed.hash, sealed: sealed.sealed, next_pt: nextPt, signer: K.SIGNER, current_hash: cfg.policy_hash };
}

async function policySign(body) {
  const d = await policyDiff(body);
  if (Object.keys(d.diff).length <= 1) throw new Error("nothing changed");
  const expires = String(BigInt(Date.now() + 365 * 86400_000) * 1_000_000n);
  // Only a hash of the reviewed diff goes on-chain: policy contents stay private.
  const diffHash = createHash("sha256").update(JSON.stringify(d.diff)).digest("hex");
  const r = await call(K.SIGNER, K.T, "propose_policy", { version: d.diff.version.to, hash: d.next_hash, expires_at: expires, sealed: d.sealed, diff_hash: diffHash }, { gas: "60.0 Tgas" });
  if (r.ok) writeFileSync(POLICY_PLAIN, d.next_pt);
  return { ok: r.ok, failure: r.failure, tx: r.txHash, url: explorer(r.txHash), diff: d.diff, policy_hash: d.next_hash };
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
    if (req.method === "GET" && url.pathname === "/api/decisions") return send(res, 200, decisions().slice(-30).reverse());
    if (req.method === "POST" && url.pathname === "/api/chat") return send(res, 200, await chat((await readBody(req)).q));
    if (req.method === "GET" && url.pathname === "/api/policy/current") { const { policy, cfg } = await currentPolicy(); return send(res, 200, { version: cfg.policy_version, hash: cfg.policy_hash, max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days }); }
    if (req.method === "POST" && url.pathname === "/api/policy/diff") { const d = await policyDiff(await readBody(req)); delete d.sealed; delete d.next_pt; return send(res, 200, d); }
    if (req.method === "POST" && url.pathname === "/api/policy/sign") return send(res, 200, await policySign(await readBody(req)));
    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Takara AI dashboard: http://localhost:${PORT}`));
