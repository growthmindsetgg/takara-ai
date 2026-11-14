// The one network table for the local server (backend/server.mjs) and the hosted API
// (platform/lib/core.mjs, a byte-identical copy written by scripts/build-platform.mjs).
// Read-only: JSON-RPC views and transaction lookups. No keys, no signing.
//
// Each network's accounts come from its public deployment record:
//   testnet: fixtures/deployment.json         (hosted: data/deployment.json)
//   mainnet: fixtures/deployment.mainnet.json (hosted: data/deployment.mainnet.json)
// Default network: mainnet when its record exists AND its treasury account exists on chain AND
// this server can open the owner view for it; otherwise testnet. A request may ask for either
// with ?network= or the x-takara-network header (allow-list below).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// settle_moves_tokens: does the deployed contract's `settle` send the tokens? It drives copy only
// (the app, chat). A deployment record may override it with its own "settle_moves_tokens" field,
// which is the place to flip it once the token-moving settle is deployed on that network.
export const NETWORKS = {
  testnet: {
    id: "testnet", label: "Testnet",
    rpc: process.env.NEAR_RPC_TESTNET ?? "https://rpc.testnet.fastnear.com",
    explorer: "https://testnet.nearblocks.io",
    outlayer_api: "https://testnet-api.outlayer.ai",
    record: "deployment.json",
    settle_moves_tokens: false,
  },
  mainnet: {
    id: "mainnet", label: "Mainnet",
    rpc: process.env.NEAR_RPC_MAINNET ?? "https://rpc.mainnet.fastnear.com",
    explorer: "https://nearblocks.io",
    outlayer_api: "https://api.outlayer.ai",
    record: "deployment.mainnet.json",
    settle_moves_tokens: false,
  },
};
export const NETWORK_IDS = Object.keys(NETWORKS);

/** The network a request asked for (?network= or x-takara-network), or null. Throws on anything off the allow-list. */
export function requestedNetwork(req) {
  let q = null;
  try { q = new URL(req.url || "/", "http://x").searchParams.get("network"); } catch { q = null; }
  const h = req.headers ? req.headers["x-takara-network"] : null;
  const v = String(q || h || "").trim().toLowerCase();
  if (!v) return null;
  if (!NETWORK_IDS.includes(v)) throw Object.assign(new Error(`unknown network "${v.slice(0, 20)}" (allowed: ${NETWORK_IDS.join(", ")})`), { status: 400 });
  return v;
}

/** The public deployment record for a network, or null when it doesn't exist (mainnet before launch). */
export function loadDeployment(dir, id) {
  const p = join(dir, NETWORKS[id].record);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

/** Everything a request needs to talk to one network. */
export function netContext(dir, id) {
  const N = NETWORKS[id];
  const D = loadDeployment(dir, id);
  if (!D) throw Object.assign(new Error(`NEAR ${id} isn't deployed yet: no ${N.record}`), { status: 404 });
  return {
    id, N, D, T: D.accounts.treasury,
    settleMovesTokens: typeof D.settle_moves_tokens === "boolean" ? D.settle_moves_tokens : N.settle_moves_tokens,
    view: (contract, method, args) => view(id, contract, method, args),
    explorer: (tx) => `${N.explorer}/txns/${tx}`,
  };
}

export async function rpc(id, method, params) {
  for (let i = 0; ; i++) {
    let j = {}, status = 0;
    try {
      const r = await fetch(NETWORKS[id].rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      status = r.status;
      j = await r.json().catch(() => ({}));
    } catch (e) { j = { error: { message: e.message } }; }
    if (j.result !== undefined) return j.result;
    const msg = JSON.stringify(j.error ?? j);
    if (i < 2 && /TIMEOUT|UNKNOWN_TRANSACTION|429|Too Many|timeout|fetch failed/i.test(msg + status)) { await new Promise((ok) => setTimeout(ok, 700 * (i + 1))); continue; }
    throw Object.assign(new Error(`rpc ${method} (${id}): ${msg.slice(0, 200)}`), { rpc: j.error });
  }
}

export async function view(id, contract, method, args = {}) {
  const r = await rpc(id, "query", { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  const text = Buffer.from(r.result).toString();
  return text ? JSON.parse(text) : null;
}

/** true / false, or null when the RPC couldn't say. */
export async function accountExists(id, account) {
  try { await rpc(id, "query", { request_type: "view_account", finality: "final", account_id: account }); return true; }
  catch (e) { return /UNKNOWN_ACCOUNT|does not exist/i.test(JSON.stringify(e.rpc ?? e.message)) ? false : null; }
}

/** Transaction outcome (same shape as scripts/lib/near.mjs outcome), on any network. */
export async function outcome(id, txHash, sender) {
  const r = await rpc(id, "EXPERIMENTAL_tx_status", { tx_hash: txHash, sender_account_id: sender, wait_until: "FINAL" });
  const logs = [];
  let failure = null;
  const fail = (f) => { const s = JSON.stringify(f); const c = s.match(/E_[A-Z_]+/); return c ? c[0] : s.slice(0, 300); };
  for (const ro of [r.transaction_outcome, ...r.receipts_outcome]) {
    logs.push(...ro.outcome.logs);
    const f = ro.outcome.status?.Failure;
    if (f && !failure) failure = fail(f);
  }
  const events = logs.filter((l) => l.startsWith("EVENT_JSON:")).map((l) => { try { return JSON.parse(l.slice(11)); } catch { return null; } }).filter(Boolean);
  const sv = r.status?.SuccessValue;
  let value = null;
  if (typeof sv === "string" && sv.length) { const t = Buffer.from(sv, "base64").toString(); try { value = JSON.parse(t); } catch { value = t; } }
  if (r.status?.Failure && !failure) failure = fail(r.status.Failure);
  return { txHash, ok: !failure, value, logs, events, failure, transaction: r.transaction };
}

/** Recorded decisions that belong to this network's deployment (one shared log holds both). */
export function belongsTo(ctx) {
  const mine = new Set([...Object.values(ctx.D.accounts || {}), ctx.D.asset, ctx.D.owner].filter(Boolean));
  return (d) => mine.has(d && d.contract);
}

/** Owner report: the engine binary over every non-closed commitment (needs the owner's ledger key). */
export async function ownerReport(ctx, runEngine, sk) {
  const input = JSON.parse(await ctx.view(ctx.T, "preview_engine_input", { op: "claim", commitment_id: null }));
  const all = [];
  for (let from = 0; ; from += 100) {
    const page = await ctx.view(ctx.T, "list_commitments", { from: String(from), limit: 100 });
    all.push(...page);
    if (page.length < 100) break;
  }
  const changes = Object.fromEntries((await ctx.view(ctx.T, "list_vendor_changes")).map((v) => [v.id, v]));
  input.cs = all.filter((c) => c.state !== "closed").map((c) => {
    const vc = c.vendor_change != null ? changes[c.vendor_change] : null;
    const acc = c.accepted_by === "policy" ? "p" : c.accepted_by ? "s" : "";
    return [Number(c.id), c.state, c.priority, c.flags, acc, c.sealed, vc?.settlement_status ?? null, vc?.decided_at ? Number(vc.decided_at) : null];
  });
  const r = await runEngine({ ...input, op: "report", sk });
  // The engine's label predates the audit fix (M6): the burn counts accepted recurrences only.
  if (r.queries) r.queries.daily_recurring_burn = "sum(monthly-equivalent amount) where state == accepted and recurring, / 30";
  return r;
}

/** Public ledger: exactly what anyone can read on chain. */
export async function publicLedger(ctx) {
  const fmt6 = (s) => (Number(s) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });
  const [cfg, commitments, changes] = await Promise.all([ctx.view(ctx.T, "get_config"), ctx.view(ctx.T, "list_commitments", { from: "0", limit: 100 }), ctx.view(ctx.T, "list_vendor_changes")]);
  return {
    treasury: ctx.T, network: ctx.id, balance: fmt6(cfg.balance), paused: cfg.paused, agent: cfg.agent, owners: cfg.owners, signers: cfg.signers,
    threshold: cfg.threshold, policy_expires_at: cfg.policy_expires_at,
    policy: { version: cfg.policy_version, hash: cfg.policy_hash }, engine: cfg.engine, ledger_state_hash: cfg.ledger_state_hash,
    commitments: commitments.map((c) => ({ id: c.id, state: c.state, priority: c.priority, flags: c.flags, evidence_hash: c.evidence_hash, commitment_hash: c.commitment_hash, vendor_ref: c.vendor_ref, request_no: c.attestation.request_no, output_hash: c.attestation.output_hash, settled_nonce: c.settled_nonce })),
    vendor_changes: changes,
    note: ctx.settleMovesTokens
      ? "Public state holds commitments, hashes and attestations. Each payout shows its amount and payee on chain when it is paid; reserves, rules and the vendor list stay sealed."
      : "Public state holds commitments, hashes and attestations only. Amounts, vendors and payees are sealed.",
  };
}

// ------------------------------------------------------------------ which networks are live
const cache = {};
async function treasuryLive(id, T) {
  const c = cache[id];
  if (c && c.T === T && Date.now() < c.until) return c.ok;
  const ok = await accountExists(id, T);
  cache[id] = { T, ok, until: Date.now() + (ok ? 300000 : 30000) }; // re-check soon while it isn't live
  return ok;
}

/**
 * Public status for the app's network switch. `ownerView(id)` says whether this server holds the
 * owner's ledger key for that network (never the key itself).
 */
export async function networkStatus(dir, ownerView) {
  const networks = {};
  await Promise.all(NETWORK_IDS.map(async (id) => {
    const N = NETWORKS[id];
    const D = loadDeployment(dir, id);
    const base = { id, label: N.label, rpc: N.rpc, explorer: N.explorer, outlayer_api: N.outlayer_api };
    if (!D) { networks[id] = { ...base, available: false, reason: "not deployed yet" }; return; }
    const ctx = netContext(dir, id);
    const live = await treasuryLive(id, ctx.T);
    networks[id] = {
      ...base, available: live === true, reason: live === true ? null : live === false ? "treasury account not found on chain" : "chain unreachable",
      owner: D.owner, accounts: D.accounts, asset: D.asset ?? null,
      settle_moves_tokens: ctx.settleMovesTokens, owner_view: !!ownerView(id),
    };
  }));
  const m = networks.mainnet;
  const def = m && m.available && m.owner_view ? "mainnet" : "testnet";
  return { default: def, networks };
}
