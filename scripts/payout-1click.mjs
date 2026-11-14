#!/usr/bin/env node
// Takara AI: one confidential payout on NEAR MAINNET through the NEAR Intents 1Click API.
//
// LABEL: separately labelled MAINNET INTEGRATION DEMO. The testnet treasury contract does not
// and cannot enforce this payout. The founder runs this script; nobody else moves funds.
//
// Default is a DRY RUN: it fetches and prints a quote and moves nothing. Funds move only with
// --execute AND either an interactive "YES" or --yes. Hard cap: 10 USDC.
//
//   node scripts/payout-1click.mjs --amount 3 --recipient <account.near> [--route near]
//   node scripts/payout-1click.mjs --amount 3 --recipient 0xYourBaseAddress --route base
//   node scripts/payout-1click.mjs --amount 3 --recipient <account.near> --execute        (asks YES)
//   node scripts/payout-1click.mjs --status <depositAddress>                              (read-only)
//
// Options:
//   --amount <USDC>          decimal USDC, 0 < amount <= 10 (hard cap)
//   --recipient <addr>       payee: NEAR account (route near / conf-intents) or chain address
//   --route <r>              near (default) | conf-intents | base | arb | sol
//   --sender <account>       NEAR account that signs the USDC deposit (default takara-ai-hq.near);
//                            key must be in the near-cli legacy keychain ~/.near-credentials/mainnet/
//   --refund-to <account>    NEAR account for refunds (default: the sender; must exist on mainnet)
//   --confidentiality <c>    basic (default) | advanced
//   --slippage-bps <n>       default 50
//   --max-fee-bps <n>        refuse a quote whose amountOut is below amountIn by more than this (default 100)
//   --timeout-min <n>        status polling timeout in minutes (default 20)
//   --auth-tx <hash>         testnet settle tx whose settlement_receipt this demo references
//                            (default: commitment #9, Ana's 12.5 reimbursement, from the e2e run)
//   --auth-sender <account>  signer of --auth-tx (default agent.takara-ai-hq.testnet)
//   --execute                actually deposit (otherwise dry run)
//   --yes                    skip the interactive YES prompt (founder only)
//
// Key: ONECLICK_JWT (or ONECLICK_API_KEY) from the environment, else from
// .secrets/mainnet/1click.env (line: ONECLICK_JWT=...). The key is never printed or written.
// No npm dependencies: plain fetch, node:crypto and the `near` CLI (near-cli-rs).
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ONECLICK = "https://1click.chaindefuser.com";
const RPC = process.env.NEAR_RPC ?? "https://rpc.mainnet.fastnear.com";
const TESTNET_RPC = "https://rpc.testnet.fastnear.com";
const NEAR_BIN = process.env.NEAR_CLI ?? "near";
const USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const USDC_DECIMALS = 6;
const HARD_CAP_USDC = 10;
const STORAGE_DEPOSIT = "0.00125 NEAR"; // native USDC storage_balance_bounds.min (measured)
const LABEL = "MAINNET integration demo of confidential settlement. Not enforced by the testnet treasury contract.";
const RECORD_PATH = join(ROOT, "fixtures", "payout-1click.mainnet.json");
const OPENING_PATH = join(ROOT, ".secrets", "mainnet", "payout-1click.opening.json");

// Destination asset and recipient format per route (asset ids from GET /v0/tokens, measured 2026-11-14).
const ROUTES = {
  near: { asset: `nep141:${USDC_CONTRACT}`, recipientType: "DESTINATION_CHAIN", chain: "near", fmt: "near" },
  "conf-intents": { asset: `nep141:${USDC_CONTRACT}`, recipientType: "CONFIDENTIAL_INTENTS", chain: "near-intents (confidential)", fmt: "near" },
  base: { asset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", recipientType: "DESTINATION_CHAIN", chain: "base", fmt: "evm" },
  arb: { asset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", recipientType: "DESTINATION_CHAIN", chain: "arbitrum", fmt: "evm" },
  sol: { asset: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", recipientType: "DESTINATION_CHAIN", chain: "solana", fmt: "sol" },
};

// Default reference: the treasury authorization for Ana's 12.5 USDC reimbursement (commitment #9),
// settled on testnet in the 2026-11-13 end-to-end run (docs/testing/e2e-report-2026-11-13.md).
const DEFAULT_AUTH_TX = "GPXj598iHiBPKNAVL8SL6Vi7y3D56RwQuKoH2ht5L22z";
const DEFAULT_AUTH_SENDER = "agent.takara-ai-hq.testnet";

// ---------------------------------------------------------------------------------------------
// args, key handling
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = new Set(["execute", "yes", "help"]);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) die(`unexpected argument: ${a}`);
    const k = a.slice(2);
    if (flags.has(k)) out[k] = true;
    else {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) die(`--${k} needs a value`);
      out[k] = v;
    }
  }
  return out;
}

let SECRET = null; // the partner JWT, held only in memory

function loadKey() {
  let k = process.env.ONECLICK_JWT || process.env.ONECLICK_API_KEY || "";
  const file = join(ROOT, ".secrets", "mainnet", "1click.env");
  if (!k && existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?(ONECLICK_JWT|ONECLICK_API_KEY)\s*=\s*(.*)\s*$/);
      if (m) k = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  SECRET = k || null;
  return SECRET ? "present (hidden)" : "absent";
}

/** Remove the key from any text before it is printed. */
function redact(s) {
  let t = String(s);
  if (SECRET) t = t.split(SECRET).join("[REDACTED]");
  return t;
}

function say(...a) {
  console.log(redact(a.join(" ")));
}

class Stop extends Error {
  constructor(msg, code) {
    super(msg);
    this.code = code;
  }
}

/** Abort: unwinds to main() so Node exits cleanly (process.exit with open fetch handles trips a
 *  libuv assertion on Windows). */
function die(msg, code = 1) {
  throw new Stop(msg, code);
}

const HOW_TO_GET_KEY = `How to get a 1Click partner key (JWT), about 5 minutes:
  1. Open https://partners.near-intents.org and sign in (account via signin.near-intents.org).
  2. Create an API key in the Partner Dashboard and copy the JWT.
  3. Save it locally, never in git or chat:
       mkdir -p .secrets/mainnet && printf 'ONECLICK_JWT=%s\\n' '<paste>' > .secrets/mainnet/1click.env
     or for one shell:  export ONECLICK_JWT='<paste>'
  4. Re-run this dry run. Full steps: docs/mainnet-payout.md`;

// ---------------------------------------------------------------------------------------------
// amounts
// ---------------------------------------------------------------------------------------------

function toBase(usdc) {
  if (!/^\d+(\.\d{1,6})?$/.test(String(usdc))) die(`--amount must be a decimal USDC value with up to 6 decimals, got "${usdc}"`);
  const [w, f = ""] = String(usdc).split(".");
  return BigInt(w) * 10n ** BigInt(USDC_DECIMALS) + BigInt((f + "000000").slice(0, USDC_DECIMALS));
}

function fmt(base) {
  const b = BigInt(base);
  const w = b / 10n ** BigInt(USDC_DECIMALS);
  const f = (b % 10n ** BigInt(USDC_DECIMALS)).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return f ? `${w}.${f}` : `${w}`;
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// ---------------------------------------------------------------------------------------------
// NEAR RPC
// ---------------------------------------------------------------------------------------------

async function rpc(method, params, url = RPC) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await res.json().catch(() => ({}));
    if (j.result !== undefined) return j.result;
    const msg = JSON.stringify(j.error ?? j);
    if (attempt < 5 && /TIMEOUT|UNKNOWN_TRANSACTION|429|Too Many|timeout/i.test(msg + res.status)) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`rpc ${method}: ${msg.slice(0, 400)}`);
  }
}

async function view(contract, method, args = {}) {
  const r = await rpc("query", { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  const t = Buffer.from(r.result).toString();
  return t ? JSON.parse(t) : null;
}

async function account(id) {
  try {
    return await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
  } catch {
    return null;
  }
}

const isNearAccount = (s) => /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(s) && s.length >= 2 && s.length <= 64;
const isImplicit = (s) => /^[0-9a-f]{64}$/.test(s);
const isEvm = (s) => /^0x[0-9a-fA-F]{40}$/.test(s);
const isSol = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// 1Click
// ---------------------------------------------------------------------------------------------

async function oneclick(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "content-type": "application/json" };
  if (auth && SECRET) headers["X-API-Key"] = SECRET;
  const res = await fetch(`${ONECLICK}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, ok: res.ok, json };
}

function quoteBody({ dry, amount, route, recipient, refundTo, confidentiality, slippageBps }) {
  const r = ROUTES[route];
  const body = {
    dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: slippageBps,
    originAsset: `nep141:${USDC_CONTRACT}`,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: r.asset,
    amount: amount.toString(),
    refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: r.recipientType,
    deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
    referral: "takara-ai",
  };
  if (confidentiality && confidentiality !== "public") body.confidentiality = confidentiality;
  return body;
}

function explainQuoteError(status, json, ctx) {
  const msg = json?.message ?? JSON.stringify(json);
  if (status === 401 && SECRET)
    return `1Click returned 401: "${msg}". A key was supplied but 1Click rejected it (expired, revoked or mis-pasted). Create a fresh key in the Partner Dashboard.\n\n${HOW_TO_GET_KEY}`;
  if (status === 401) return `1Click returned 401: "${msg}".\nConfidential quotes need a 1Click partner key.\n\n${HOW_TO_GET_KEY}`;
  if (/Internal server error/i.test(msg) && ctx.refundMissing)
    return `1Click returned "${msg}". Measured cause: refundTo "${ctx.refundTo}" does not exist on mainnet (1Click reports a missing named refund account this way). Create/fund it first or pass --refund-to <existing account>.`;
  if (/recipient is not valid/i.test(msg)) return `1Click rejected the recipient: "${msg}". Check the address format for route ${ctx.route}.`;
  return `1Click quote HTTP ${status}: ${redact(JSON.stringify(json).slice(0, 500))}`;
}

function printQuote(title, req, res) {
  const q = res.quote ?? {};
  say(`\n${title}`);
  say(`  route            ${req.originAsset.slice(0, 18)}... -> ${req.destinationAsset.slice(0, 40)}${req.destinationAsset.length > 40 ? "..." : ""} (${req.recipientType})`);
  say(`  confidentiality  ${req.confidentiality ?? "public"}`);
  say(`  amountIn         ${q.amountInFormatted ?? "?"} USDC (base ${q.amountIn ?? "?"}, minAmountIn ${q.minAmountIn ?? "?"})`);
  say(`  amountOut        ${q.amountOutFormatted ?? "?"} (min ${q.minAmountOut ?? "?"})`);
  say(`  timeEstimate     ${q.timeEstimate ?? "?"} s`);
  say(`  depositAddress   ${q.depositAddress ?? "(dry quote: none issued)"}`);
  if (q.depositMemo) say(`  depositMemo      ${q.depositMemo}`);
  say(`  deadline         ${q.deadline ?? req.deadline}`);
  say(`  correlationId    ${res.correlationId ?? "?"}`);
}

// ---------------------------------------------------------------------------------------------
// near CLI (signing stays in the CLI and its legacy keychain; this script never reads key files)
// ---------------------------------------------------------------------------------------------

function cliCall(signer, contract, method, args, { deposit, gas = "30.0 Tgas" }) {
  const argv = [
    "contract", "call-function", "as-transaction", contract, method, "json-args", JSON.stringify(args),
    "prepaid-gas", gas, "attached-deposit", deposit, "sign-as", signer, "network-config", "mainnet", "sign-with-legacy-keychain", "send",
  ];
  say(`  $ near contract call-function as-transaction ${contract} ${method} ... sign-as ${signer} (mainnet)`);
  const r = spawnSync(NEAR_BIN, argv, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const out = ((r.stdout ?? "") + (r.stderr ?? "")).replace(/\x1b\[[0-9;]*m/g, "");
  const m = out.match(/Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/) ?? out.match(/transactions?\/([1-9A-HJ-NP-Za-km-z]{43,44})/);
  if (!m) die(`near CLI did not return a transaction id for ${method}. Output tail:\n${out.slice(-1500)}`);
  return m[1];
}

async function txOutcome(hash, sender) {
  const r = await rpc("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: sender, wait_until: "FINAL" });
  const failures = [r.transaction_outcome, ...r.receipts_outcome].map((o) => o.outcome.status).filter((s) => s && s.Failure);
  const ok = !("Failure" in (r.status ?? {})) && failures.length === 0;
  return { ok, failure: failures[0]?.Failure ?? r.status?.Failure ?? null };
}

// ---------------------------------------------------------------------------------------------
// link to the treasury authorization
// ---------------------------------------------------------------------------------------------

async function loadSettlementReceipt(txHash, sender) {
  try {
    const r = await rpc("tx", { tx_hash: txHash, sender_account_id: sender, wait_until: "FINAL" }, TESTNET_RPC);
    for (const ro of r.receipts_outcome) {
      for (const l of ro.outcome.logs) {
        if (!l.startsWith("EVENT_JSON:")) continue;
        const e = JSON.parse(l.slice(11));
        if (e.standard === "takara-ai" && e.event === "settlement_receipt") {
          return { network: "testnet", treasury: ro.outcome.executor_id, settle_tx: txHash, settle_tx_url: `https://testnet.nearblocks.io/txns/${txHash}`, ...e.data[0] };
        }
      }
    }
  } catch (e) {
    say(`  (could not read the testnet settlement receipt: ${String(e.message).slice(0, 160)})`);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------------------------

async function pollStatus(depositAddress, timeoutMin) {
  const end = Date.now() + timeoutMin * 60_000;
  let last = "";
  let s = null;
  while (Date.now() < end) {
    const r = await oneclick(`/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`);
    if (r.ok) {
      s = r.json;
      if (s.status !== last) {
        say(`  [${new Date().toISOString()}] 1Click status: ${s.status}`);
        last = s.status;
      }
      if (["SUCCESS", "REFUNDED", "FAILED"].includes(s.status)) return s;
    } else if (r.status !== 404) {
      say(`  status HTTP ${r.status}: ${redact(JSON.stringify(r.json).slice(0, 200))}`);
    }
    await sleep(5000);
  }
  say(`  timed out after ${timeoutMin} min; last status ${last || "unknown"}. Check later with --status ${depositAddress}`);
  return s ?? { status: "TIMEOUT" };
}

function printStatus(s, depositAddress) {
  const d = s?.swapDetails ?? {};
  say(`\n1Click status: ${s?.status}`);
  if (d.amountInFormatted) say(`  amountIn   ${d.amountInFormatted}`);
  if (d.amountOutFormatted) say(`  amountOut  ${d.amountOutFormatted}`);
  for (const t of d.originChainTxHashes ?? []) say(`  origin tx       ${t.hash}  ${t.explorerUrl ?? ""}`);
  for (const t of d.nearTxHashes ?? []) say(`  intents tx      ${t}  https://nearblocks.io/txns/${t}`);
  for (const t of d.destinationChainTxHashes ?? []) say(`  destination tx  ${t.hash}  ${t.explorerUrl ?? ""}`);
  if (d.refundedAmountFormatted && d.refundedAmountFormatted !== "0") say(`  refunded   ${d.refundedAmountFormatted} (${d.refundReason ?? "no reason given"})`);
  say(`  intents explorer  https://explorer.near-intents.org/transactions/${depositAddress}`);
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) {
    say(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 33).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    return;
  }
  say(`Takara AI 1Click payout. ${LABEL}`);
  say(`1Click key: ${loadKey()}`);

  if (a.status) {
    const r = await oneclick(`/v0/status?depositAddress=${encodeURIComponent(a.status)}`);
    if (!r.ok) die(`status HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 300)}`);
    printStatus(r.json, a.status);
    return;
  }

  // ---- validate inputs ----
  if (!a.amount || !a.recipient) die("usage: --amount <USDC> --recipient <address> [--route near|conf-intents|base|arb|sol] [--execute]  (see --help)");
  const route = a.route ?? "near";
  const R = ROUTES[route];
  if (!R) die(`unknown --route ${route}; use one of ${Object.keys(ROUTES).join(", ")}`);
  const amount = toBase(a.amount);
  if (amount <= 0n) die("--amount must be positive");
  if (amount > toBase(String(HARD_CAP_USDC))) die(`refused: ${a.amount} USDC exceeds the hard cap of ${HARD_CAP_USDC} USDC for this demo`);
  const recipient = a.recipient;
  if (R.fmt === "near" && !(isNearAccount(recipient) || isImplicit(recipient))) die(`--recipient must be a NEAR account for route ${route}`);
  if (R.fmt === "evm" && !isEvm(recipient)) die(`--recipient must be a 0x EVM address for route ${route}`);
  if (R.fmt === "sol" && !isSol(recipient)) die(`--recipient must be a Solana address for route ${route}`);
  const sender = a.sender ?? "takara-ai-hq.near";
  const refundTo = a["refund-to"] ?? sender;
  const confidentiality = a.confidentiality ?? "basic";
  if (!["basic", "advanced"].includes(confidentiality)) die("--confidentiality must be basic or advanced (this demo is the confidential payout)");
  const slippageBps = Number(a["slippage-bps"] ?? 50);
  const maxFeeBps = Number(a["max-fee-bps"] ?? 100);
  const timeoutMin = Number(a["timeout-min"] ?? 20);
  const execute = Boolean(a.execute);

  say(`\nMode: ${execute ? "EXECUTE (real mainnet funds)" : "DRY RUN (quote only, nothing is sent)"}`);
  say(`Amount ${fmt(amount)} USDC, route ${route} (${R.chain}), confidentiality ${confidentiality}, sender ${sender}, refundTo ${refundTo}`);

  // ---- chain preflight (read-only) ----
  const [senderAcc, refundAcc] = await Promise.all([account(sender), refundTo === sender ? null : account(refundTo)]);
  // On chain = can actually receive a refund. Quotable = 1Click accepts it (a missing implicit
  // account is quotable; a missing named account fails with "Internal server error", measured).
  const refundOnChain = refundTo === sender ? Boolean(senderAcc) : Boolean(refundAcc);
  const refundExists = refundOnChain || isImplicit(refundTo);
  say(`\nPreflight (mainnet, read-only)`);
  say(`  sender ${sender}: ${senderAcc ? `exists, ${(Number(BigInt(senderAcc.amount) / 10n ** 18n) / 1e6).toFixed(4)} NEAR` : "DOES NOT EXIST YET"}`);
  let senderUsdc = null;
  if (senderAcc) {
    senderUsdc = BigInt((await view(USDC_CONTRACT, "ft_balance_of", { account_id: sender })) ?? "0");
    say(`  sender USDC: ${fmt(senderUsdc)}`);
  }
  if (refundTo !== sender) say(`  refundTo ${refundTo}: ${refundOnChain ? "exists" : "DOES NOT EXIST"}`);
  let recipientRegistered = null;
  let recipientMissing = false;
  if (R.fmt === "near" && !isImplicit(recipient)) {
    recipientMissing = !(await account(recipient));
    if (recipientMissing) {
      say(`  recipient ${recipient}: DOES NOT EXIST on mainnet (1Click rejects quotes to a missing named account with "Internal server error", measured)`);
      if (execute) die(`refused: recipient ${recipient} does not exist on mainnet; create it first (e.g. node scripts/setup-mainnet.mjs)`);
    }
  }
  if (route === "near" && !recipientMissing) {
    recipientRegistered = Boolean(await view(USDC_CONTRACT, "storage_balance_of", { account_id: recipient }));
    say(`  recipient ${recipient} registered on USDC: ${recipientRegistered ? "yes" : "no (will be registered from the sender for " + STORAGE_DEPOSIT + " before the deposit)"}`);
  }
  const keychainFile = join(homedir(), ".near-credentials", "mainnet", `${sender}.json`);
  const keychainDir = join(homedir(), ".near-credentials", "mainnet", sender);
  const hasKey = existsSync(keychainFile) || existsSync(keychainDir);
  say(`  near-cli legacy keychain for ${sender}: ${hasKey ? "found" : "NOT FOUND"} (${keychainFile})`);

  // ---- the treasury authorization this demo references ----
  const authTx = a["auth-tx"] ?? DEFAULT_AUTH_TX;
  const authSender = a["auth-sender"] ?? DEFAULT_AUTH_SENDER;
  const receipt = await loadSettlementReceipt(authTx, authSender);
  if (receipt) {
    say(`\nReferences testnet treasury authorization: commitment #${receipt.commitment_id}, auth_hash ${receipt.auth_hash}`);
    say(`  settle tx ${receipt.settle_tx_url}`);
  }

  // ---- quote ----
  let quoteRefund = refundTo;
  let probeOnly = false;
  if (execute && !refundOnChain) die(`refused: refund account ${refundTo} does not exist on mainnet. A refund to a missing account could be lost.`);
  if (!refundExists) {
    if (execute) die(`refused: refund account ${refundTo} does not exist on mainnet. A refund to a missing account could be lost.`);
    say(`\nNOTE: ${refundTo} does not exist on mainnet yet, and 1Click rejects quotes whose named refund account is missing.`);
    say(`      For this dry run only, the quote uses refundTo=intents.near to prove the route. Never deposit against such a quote.`);
    quoteRefund = "intents.near";
    probeOnly = true;
  }
  const req = quoteBody({ dry: !execute, amount, route, recipient, refundTo: quoteRefund, confidentiality, slippageBps });
  const res = await oneclick("/v0/quote", { method: "POST", body: req });
  if (!res.ok) {
    say(`\n${explainQuoteError(res.status, res.json, { refundMissing: !refundExists, refundTo: quoteRefund, route })}`);
    if (res.status === 401 && !execute) {
      // Prove the route exists with the same request, unauthenticated and public (dry, no deposit address).
      const pub = { ...req, dry: true };
      delete pub.confidentiality;
      const p = await oneclick("/v0/quote", { method: "POST", body: pub, auth: false });
      if (p.ok) printQuote("Route proof: the SAME route as a PUBLIC, UNAUTHENTICATED dry quote (not confidential; unauthenticated, so the +25 bps fee may apply):", pub, p.json);
      else {
        say(`Public route probe also failed: HTTP ${p.status} ${redact(JSON.stringify(p.json).slice(0, 300))}`);
        if (recipientMissing) say(`Cause: recipient ${recipient} does not exist on mainnet yet. Re-run once it exists, or probe with an existing account.`);
      }
      process.exitCode = 2;
      return;
    }
    process.exitCode = 2;
    return;
  }
  printQuote(execute ? "Live confidential quote (deposit address issued):" : "Confidential dry quote (no deposit address is issued in a dry run):", req, res.json);
  const q = res.json.quote ?? {};

  // Fee sanity: same-asset USDC routes should cost ~1 bp with a partner key.
  if (q.amountOut && q.amountIn) {
    const feeBps = Number(((BigInt(q.amountIn) - BigInt(q.amountOut)) * 10000n) / BigInt(q.amountIn));
    say(`  implied cost     ${feeBps} bps (limit ${maxFeeBps})`);
    if (feeBps > maxFeeBps) die(`refused: implied cost ${feeBps} bps exceeds --max-fee-bps ${maxFeeBps}`);
  }

  if (!execute) {
    say(`\nDRY RUN complete. Nothing was sent.${probeOnly ? " (route probe with a stand-in refund account)" : ""}`);
    say(`To pay for real (founder only): add --execute. You will be asked to type YES.`);
    return;
  }

  // ---------------------------------------------------------------------------------------------
  // EXECUTE
  // ---------------------------------------------------------------------------------------------
  if (!senderAcc) die(`refused: sender ${sender} does not exist on mainnet`);
  if (!hasKey) die(`refused: no legacy keychain entry for ${sender} at ${keychainFile}`);
  const amountIn = BigInt(q.amountIn ?? 0);
  const depositAddress = q.depositAddress;
  if (!depositAddress) die("refused: the quote has no depositAddress");
  if (amountIn !== amount) die(`refused: quote amountIn ${q.amountIn} differs from the requested ${amount}`);
  if (amountIn > toBase(String(HARD_CAP_USDC))) die("refused: hard cap");
  if (senderUsdc < amountIn) die(`refused: sender holds ${fmt(senderUsdc)} USDC, needs ${fmt(amountIn)}`);
  if (new Date(q.deadline ?? req.deadline).getTime() - Date.now() < 10 * 60_000) die("refused: quote deadline is under 10 minutes away; re-run for a fresh quote");
  const depositRegistered = Boolean(await view(USDC_CONTRACT, "storage_balance_of", { account_id: depositAddress }));

  say(`\nABOUT TO SEND REAL FUNDS ON NEAR MAINNET`);
  say(`  ${fmt(amountIn)} USDC from ${sender} to 1Click deposit address ${depositAddress}`);
  say(`  payee ${recipient} on ${R.chain}, confidentiality ${confidentiality}, refunds to ${refundTo}`);
  if (route === "near" && !recipientRegistered) say(`  + storage_deposit ${STORAGE_DEPOSIT} for the recipient on USDC`);
  if (!depositRegistered) say(`  + storage_deposit ${STORAGE_DEPOSIT} for the deposit address on USDC`);
  say(`  quote deadline ${q.deadline}`);
  if (!a.yes) {
    if (!process.stdin.isTTY) die("refused: no TTY for confirmation. Re-run in a terminal, or pass --yes yourself.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question('Type YES to send: ');
    rl.close();
    if (ans.trim() !== "YES") die("cancelled; nothing was sent", 0);
  }

  const txs = {};
  if (route === "near" && !recipientRegistered) {
    txs.recipient_storage = cliCall(sender, USDC_CONTRACT, "storage_deposit", { account_id: recipient, registration_only: true }, { deposit: STORAGE_DEPOSIT });
    const o = await txOutcome(txs.recipient_storage, sender);
    if (!o.ok) die(`recipient storage_deposit failed: ${JSON.stringify(o.failure).slice(0, 300)} (tx ${txs.recipient_storage}); nothing else was sent`);
  }
  if (!depositRegistered) {
    txs.deposit_storage = cliCall(sender, USDC_CONTRACT, "storage_deposit", { account_id: depositAddress, registration_only: true }, { deposit: STORAGE_DEPOSIT });
    const o = await txOutcome(txs.deposit_storage, sender);
    if (!o.ok) die(`deposit-address storage_deposit failed: ${JSON.stringify(o.failure).slice(0, 300)} (tx ${txs.deposit_storage}); no USDC was sent`);
  }
  const ftArgs = { receiver_id: depositAddress, amount: amountIn.toString() };
  if (q.depositMemo) ftArgs.memo = q.depositMemo;
  txs.deposit = cliCall(sender, USDC_CONTRACT, "ft_transfer", ftArgs, { deposit: "1 yoctoNEAR" });
  say(`\nDeposit tx: ${txs.deposit}\n  https://nearblocks.io/txns/${txs.deposit}`);
  const dep = await txOutcome(txs.deposit, sender);
  if (!dep.ok) die(`USDC deposit failed on chain: ${JSON.stringify(dep.failure).slice(0, 300)}. No payout started.`);

  const sub = await oneclick("/v0/deposit/submit", { method: "POST", body: { depositAddress, txHash: txs.deposit, nearSenderAccount: sender } });
  say(`Submitted deposit to 1Click: HTTP ${sub.status}`);

  say(`\nPolling 1Click status (up to ${timeoutMin} min)...`);
  const st = await pollStatus(depositAddress, timeoutMin);
  printStatus(st, depositAddress);

  // ---- public record: no keys, payee sealed behind a salted commitment ----
  const d = st?.swapDetails ?? {};
  const salt = randomBytes(16).toString("hex");
  const recipientCommit = sha256(`takara-ai:mainnet-recipient:${R.chain}:${recipient}:${salt}`);
  const core = {
    deposit_tx: txs.deposit,
    deposit_address: depositAddress,
    amount_in: amountIn.toString(),
    recipient_commit: recipientCommit,
    linked_auth_hash: receipt?.auth_hash ?? null,
    linked_settle_tx: receipt?.settle_tx ?? null,
  };
  const linkCommitment = sha256(`takara-ai:mainnet-demo-link:v1:${JSON.stringify(core)}`);
  const record = {
    label: LABEL,
    network: "mainnet",
    created_at: new Date().toISOString(),
    route: { from: `NEAR native USDC (${USDC_CONTRACT})`, to: `${R.chain} USDC (${R.asset})`, recipient_type: R.recipientType, confidentiality },
    amount: { requested_usdc: fmt(amount), amount_in: q.amountIn, amount_out: d.amountOut ?? q.amountOut, amount_out_formatted: d.amountOutFormatted ?? q.amountOutFormatted },
    sender,
    refund_to: refundTo,
    recipient_commit: recipientCommit,
    recipient_commit_scheme: "sha256('takara-ai:mainnet-recipient:' + chain + ':' + recipient + ':' + salt); opening kept off-repo in .secrets/mainnet/payout-1click.opening.json",
    oneclick: {
      correlation_id: res.json.correlationId ?? null,
      quote_signature: res.json.signature ?? null,
      deposit_address: depositAddress,
      deadline: q.deadline ?? null,
      status: st?.status ?? "UNKNOWN",
      updated_at: st?.updatedAt ?? null,
      intent_hashes: d.intentHashes ?? [],
      near_tx_hashes: d.nearTxHashes ?? [],
      origin_chain_txs: d.originChainTxHashes ?? [],
      destination_chain_txs: d.destinationChainTxHashes ?? [],
      refunded_amount: d.refundedAmount ?? null,
      refund_reason: d.refundReason ?? null,
    },
    transactions: Object.fromEntries(Object.entries(txs).map(([k, h]) => [k, { hash: h, url: `https://nearblocks.io/txns/${h}` }])),
    explorer: { intents: `https://explorer.near-intents.org/transactions/${depositAddress}`, deposit: `https://nearblocks.io/txns/${txs.deposit}` },
    linked_authorization: receipt
      ? {
          note: "Testnet treasury authorization this demo illustrates. The testnet contract did not authorize, enforce or observe this mainnet payout; the demo amount and payee differ from the sealed testnet payout.",
          ...receipt,
        }
      : null,
    link_commitment: linkCommitment,
    link_commitment_scheme: "sha256('takara-ai:mainnet-demo-link:v1:' + JSON.stringify({deposit_tx, deposit_address, amount_in, recipient_commit, linked_auth_hash, linked_settle_tx}))",
  };
  mkdirSync(dirname(RECORD_PATH), { recursive: true });
  writeFileSync(RECORD_PATH, JSON.stringify(record, null, 2) + "\n");
  mkdirSync(dirname(OPENING_PATH), { recursive: true });
  writeFileSync(OPENING_PATH, JSON.stringify({ chain: R.chain, recipient, salt, recipient_commit: recipientCommit, deposit_tx: txs.deposit }, null, 2) + "\n");
  say(`\nPublic record written: ${RECORD_PATH}`);
  say(`Recipient opening (keep private, not in git): ${OPENING_PATH}`);
  say(`link_commitment ${linkCommitment}`);
  if (st?.status !== "SUCCESS") process.exitCode = 3;
}

main().catch((e) => {
  const stop = e instanceof Stop;
  console.error(redact(`\n${stop ? "ERROR: " + e.message : e?.stack ?? String(e)}\n`));
  process.exitCode = stop ? e.code : 1;
});
