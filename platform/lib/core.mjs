// Takara AI hosted platform core (Vercel serverless). Same logic as backend/server.mjs, for a
// public demo of the fictional fixture treasury on NEAR testnet.
//
// - Reads chain state over JSON-RPC; runs the same engine wasm (committed in dist/) with WASI.
// - The owner view uses TAKARA_ENGINE_SK, the FIXTURE treasury's ledger key, stored as an
//   encrypted Vercel environment variable. A real business would never put its key on a server;
//   this demo exposes only fictional data.
// - Signing is never available here: no signer or agent key exists on this server.
import { readFileSync, writeFileSync, mkdtempSync, openSync, closeSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WASI } from "node:wasi";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
export const D = JSON.parse(readFileSync(join(ROOT, "data", "deployment.json"), "utf8"));
export const T = D.accounts.treasury;
const RPC = process.env.NEAR_RPC ?? "https://rpc.testnet.fastnear.com";
export const explorer = (tx) => `https://testnet.nearblocks.io/txns/${tx}`;
const fmt6 = (s) => (Number(s) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });

export async function view(contract, method, args = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }) });
    const j = await r.json().catch(() => ({}));
    if (j.result) return JSON.parse(Buffer.from(j.result.result).toString() || "null");
    if (i >= 2) throw new Error(`rpc ${method}: ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
    await new Promise((ok) => setTimeout(ok, 600 * (i + 1)));
  }
}

let compiled;
async function runEngine(input) {
  compiled ??= await WebAssembly.compile(readFileSync(join(ROOT, "data", "takara-engine.wasm")));
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

function ownerKey() {
  const k = process.env.TAKARA_ENGINE_SK;
  if (!k) throw new Error("owner view not configured on this deployment");
  return k;
}

export async function publicLedger() {
  const cfg = await view(T, "get_config");
  const commitments = await view(T, "list_commitments", { from: "0", limit: 100 });
  const changes = await view(T, "list_vendor_changes");
  return {
    treasury: T, network: "testnet", balance: fmt6(cfg.balance), paused: cfg.paused, agent: cfg.agent, owners: cfg.owners, signers: cfg.signers,
    policy: { version: cfg.policy_version, hash: cfg.policy_hash }, engine: cfg.engine, ledger_state_hash: cfg.ledger_state_hash,
    commitments: commitments.map((c) => ({ id: c.id, state: c.state, priority: c.priority, flags: c.flags, evidence_hash: c.evidence_hash, commitment_hash: c.commitment_hash, vendor_ref: c.vendor_ref, request_no: c.attestation.request_no, output_hash: c.attestation.output_hash, settled_nonce: c.settled_nonce })),
    vendor_changes: changes,
    note: "Public state holds commitments, hashes and attestations only. Amounts, vendors and payees are sealed.",
  };
}

/** Owner report: same engine binary, over every non-closed commitment. */
export async function report() {
  const input = JSON.parse(await view(T, "preview_engine_input", { op: "claim", commitment_id: null }));
  const all = await view(T, "list_commitments", { from: "0", limit: 100 });
  const changes = Object.fromEntries((await view(T, "list_vendor_changes")).map((v) => [v.id, v]));
  input.cs = all.filter((c) => c.state !== "closed").map((c) => {
    const vc = c.vendor_change != null ? changes[c.vendor_change] : null;
    const acc = c.accepted_by === "policy" ? "p" : c.accepted_by ? "s" : "";
    return [Number(c.id), c.state, c.priority, c.flags, acc, c.sealed, vc?.settlement_status ?? null, vc?.decided_at ? Number(vc.decided_at) : null];
  });
  const r = await runEngine({ ...input, op: "report", sk: ownerKey() });
  return { ...r, hosted_demo: true, note: "Owner view of the fictional fixture treasury (hosted demo)." };
}

async function openSealed(sealed) {
  const r = await runEngine({ v: 1, op: "open_local", sk: ownerKey(), sealed });
  return r.ok ? r.plaintext : null;
}

function decisions() {
  const p = join(ROOT, "data", "decisions.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export async function chat(q) {
  const text = String(q ?? "").toLowerCase().slice(0, 500);
  if (/\b(pay|send|approve|accept|transfer|change|update|set|raise|delete|withdraw)\b/.test(text) && !/why|what|which|how much|show|list/.test(text)) {
    return { answer: "This chat is read-only. It can explain decisions and figures, but it cannot pay, approve, or change anything.", sources: [] };
  }
  const rep = await report();
  const byId = Object.fromEntries(rep.commitments.map((c) => [String(c.id), c]));
  const label = (id) => (byId[id] ? `#${id} ${byId[id].vendor} ${byId[id].amount} ${rep.symbol} (${byId[id].priority}, ${byId[id].state})` : `#${id}`);
  if (/why|blocked|refused|rejected|denied|held/.test(text)) {
    const amount = text.match(/(\d[\d,]*(?:\.\d+)?)/)?.[1]?.replace(/,/g, "");
    const refusals = decisions().filter((d) => d.value && d.value.ok === false && d.value.reason).reverse();
    const match = refusals.find((d) => !amount || byId[d.value.commitment_id]?.amount === amount) ?? refusals[0];
    if (!match) return { answer: "No refusals have been recorded yet.", sources: [] };
    const v = match.value;
    const detail = v.detail ? await openSealed(v.detail) : null;
    const lines = [`Commitment ${label(v.commitment_id)} was refused with reason \`${v.reason}\`.`];
    if (v.blocking?.length) lines.push(`Blocking commitments: ${v.blocking.map(label).join("; ")}.`);
    if (detail?.shortfall) lines.push(`Spendable was ${detail.spendable} ${rep.symbol}; the request was ${detail.requested}; shortfall ${detail.shortfall} ${rep.symbol}.`);
    if (v.until) lines.push(`Held until ${new Date(Number(BigInt(v.until) / 1_000_000n)).toISOString()}.`);
    return { answer: lines.join(" "), reason: v.reason, blocking: v.blocking, sources: [{ tx: match.tx, url: explorer(match.tx) }] };
  }
  if (/spend|balance|reserv|runway|how much|available/.test(text)) {
    const f = rep.figures;
    return { answer: `Treasury balance ${f.treasury_balance} ${rep.symbol}; reserved for accepted commitments ${f.reserved}; settled outflow ${f.settled_outflow}; spendable ${f.spendable}; runway ${f.runway_days ?? "n/a"} days.`, figures: f, queries: rep.queries, sources: [{ query: "engine report (deterministic)" }] };
  }
  if (/vendor|destination|suspend|cooling|change/.test(text)) {
    const changes = await view(T, "list_vendor_changes");
    if (!changes.length) return { answer: "No vendor destination changes have been detected.", sources: [] };
    return { answer: changes.map((c) => `Change ${c.id} on ${label(c.commitment_id)}: ${c.settlement_status}${c.decided_by ? ` (decided by ${c.decided_by})` : ""}. Proposed destination ${byId[c.commitment_id]?.proposed_destination ?? "?"} vs verified ${byId[c.commitment_id]?.destination ?? "?"}.`).join("\n"), sources: [] };
  }
  if (/commitment|bill|invoice|list|pending|claimed|accepted/.test(text)) {
    return { answer: rep.commitments.map((c) => label(c.id)).join("\n") || "No commitments.", sources: [] };
  }
  return { answer: 'Ask me things like: "why was the 400 payment blocked?", "what is spendable?", "any vendor changes?", "list commitments". I am read-only.', sources: [] };
}

// ------------------------------------------------------------------ policy (preview only)
const CONTROLS = ["max_auto_pay", "cooling_off_hours", "min_runway_days"];

async function currentPolicy() {
  const cfg = await view(T, "get_config");
  const header = await view(T, "get_policy");
  const policy = await openSealed(header.sealed);
  if (!policy) throw new Error("policy unreadable");
  return { policy, cfg };
}

export async function policyCurrent() {
  const { policy, cfg } = await currentPolicy();
  return { version: cfg.policy_version, hash: cfg.policy_hash, max_auto_pay: Number(policy.max_auto_pay) / 10 ** policy.decimals, cooling_off_hours: policy.cooling_off_hours, min_runway_days: policy.min_runway_days };
}

export async function policyDiff(body = {}) {
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
  const sealed = await runEngine({ v: 1, op: "seal_policy_local", pt: JSON.stringify(next), eph: randomBytes(32).toString("hex"), sk: ownerKey() });
  return { diff, next_hash: sealed.hash, signer: D.accounts.signer, current_hash: cfg.policy_hash, hosted_demo: true };
}

export function signDisabled() {
  return {
    ok: false,
    failure: "Signing is disabled on the hosted demo",
    error: `Signing is disabled on the hosted demo: a public website must never hold a policy signer's key. The signer applies a policy version from their own machine (local dashboard, or: near contract call-function as-transaction ${T} propose_policy ... sign-as ${D.accounts.signer}). The contract rejects anyone else with E_NOT_POLICY_SIGNER.`,
  };
}

/** Small JSON handler wrapper for Vercel Node functions. */
export function handler(fn, { methods = ["GET"] } = {}) {
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
      const out = await fn(body ?? {}, req);
      res.statusCode = out?.status ?? 200;
      res.end(JSON.stringify(out));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  };
}
