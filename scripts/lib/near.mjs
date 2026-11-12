// Minimal NEAR access for the tools: views over JSON-RPC, transactions through the official
// `near` CLI (keys stay in the CLI's keychain), outcomes read back over RPC.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".data");

export const NETWORK = process.env.NEAR_NETWORK ?? "testnet";
export const RPC = process.env.NEAR_RPC ?? (NETWORK === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com");
const NEAR_BIN = process.env.NEAR_CLI ?? "near";

async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await res.json().catch(() => ({}));
    if (j.result !== undefined) return j.result;
    const msg = JSON.stringify(j.error ?? j);
    if (attempt < 4 && /TIMEOUT|UNKNOWN_TRANSACTION|429|Too Many|timeout/i.test(msg + res.status)) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`rpc ${method}: ${msg}`);
  }
}

export async function view(contract, method, args = {}) {
  const r = await rpc("query", { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  const text = Buffer.from(r.result).toString();
  return text ? JSON.parse(text) : null;
}

export async function accountExists(accountId) {
  try {
    await rpc("query", { request_type: "view_account", finality: "final", account_id: accountId });
    return true;
  } catch {
    return false;
  }
}

/** Run the near CLI; returns stdout+stderr text. */
export function cli(args, { allowFail = false } = {}) {
  const r = spawnSync(NEAR_BIN, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const clean = out.replace(/\x1b\[[0-9;]*m/g, "");
  if (r.status !== 0 && !allowFail) throw new Error(`near ${args.slice(0, 3).join(" ")} failed:\n${clean.slice(-3000)}`);
  return clean;
}

/**
 * Call a contract method as `signer`. Returns { txHash, ok, value, logs, events, failure }.
 * A contract panic (E_* codes) is returned as ok=false with `failure`, not thrown, so callers
 * can assert on refusals.
 */
export async function call(signer, contract, method, args = {}, { deposit = "0 NEAR", gas = "300.0 Tgas" } = {}) {
  const out = cli([
    "contract", "call-function", "as-transaction", contract, method, "json-args", JSON.stringify(args),
    "prepaid-gas", gas, "attached-deposit", deposit, "sign-as", signer, "network-config", NETWORK, "sign-with-legacy-keychain", "send",
  ], { allowFail: true });
  const m = out.match(/Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/);
  if (!m) throw new Error(`no transaction id from near CLI:\n${out.slice(-2000)}`);
  const r = await outcome(m[1], signer);
  recordDecision(signer, contract, method, r);
  return r;
}

/** Append every Takara AI decision (approvals and refusals) to a local log the read-only chat
 *  answers from. Each entry carries its transaction hash, so every answer is checkable on-chain. */
export function recordDecision(signer, contract, method, r) {
  const ev = r.events.filter((e) => e.standard === "takara-ai");
  if (!ev.length && !r.failure) return;
  try {
    mkdirSync(DATA, { recursive: true });
    appendFileSync(join(DATA, "decisions.jsonl"), JSON.stringify({ at: new Date().toISOString(), tx: r.txHash, signer, contract, method, ok: r.ok, failure: r.failure, value: r.value, events: ev }) + "\n");
  } catch {}
}

export async function outcome(txHash, sender) {
  const r = await rpc("EXPERIMENTAL_tx_status", { tx_hash: txHash, sender_account_id: sender, wait_until: "FINAL" });
  const logs = [];
  let failure = null;
  for (const ro of [r.transaction_outcome, ...r.receipts_outcome]) {
    logs.push(...ro.outcome.logs);
    const f = ro.outcome.status?.Failure;
    if (f && !failure) failure = extractFailure(f);
  }
  const events = logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => JSON.parse(l.slice(11)));
  const sv = r.status?.SuccessValue;
  let value = null;
  if (typeof sv === "string" && sv.length) {
    const t = Buffer.from(sv, "base64").toString();
    try { value = JSON.parse(t); } catch { value = t; }
  }
  if (r.status?.Failure && !failure) failure = extractFailure(r.status.Failure);
  return { txHash, ok: !failure, value, logs, events, failure };
}

function extractFailure(f) {
  const s = JSON.stringify(f);
  const code = s.match(/E_[A-Z_]+/);
  return code ? code[0] : s.slice(0, 300);
}

export const explorer = (tx) => `https://testnet.nearblocks.io/txns/${tx}`;
