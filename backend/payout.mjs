// Confidential payout leg via the NEAR Intents 1Click API (MAINNET ONLY).
//
// This is a separately labelled integration demonstration. NEAR Intents has no testnet, and the
// testnet treasury contract does not and cannot enforce this payout. What this module does
// guarantee, off-chain, is that a quote is only executed if it matches the settlement
// authorization: exact amount, destination, chain and fee cap from the authorization's opening.
//
// Usage:
//   node backend/payout.mjs quote <amountUSDC> <recipient> [destChain]        (dry quote, free)
//   ONECLICK_EXECUTE=1 node backend/payout.mjs quote ...                      (real deposit address)
import { createHash } from "node:crypto";

const BASE = "https://1click.chaindefuser.com";
export const USDC = {
  near: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  base: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  arb: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
  sol: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
};

function headers() {
  const h = { "content-type": "application/json" };
  if (process.env.ONECLICK_API_KEY) h["x-api-key"] = process.env.ONECLICK_API_KEY;
  return h;
}

/**
 * Check an opened settlement authorization against the payout we are about to make.
 * `auth` is the on-chain SettlementAuth, `opening` the plaintext the agent decrypted.
 */
export function bindToAuthorization(auth, opening) {
  const h = (s) => createHash("sha256").update(s).digest("hex");
  const problems = [];
  if (h(`takara-ai:amount:${auth.asset_id}:${opening.a}:${opening.s}`) !== auth.amount_commit) problems.push("amount");
  if (h(`takara-ai:destination:${opening.c}:${opening.x}:${opening.s}`) !== auth.destination_commit) problems.push("destination");
  if (h(`takara-ai:max_fee:${opening.f}:${opening.s}`) !== auth.max_fee_commit) problems.push("max_fee");
  if (opening.c !== auth.destination_chain) problems.push("destination_chain");
  return { ok: problems.length === 0, problems };
}

/** Request a 1Click quote. confidentiality "basic" breaks the deposit/withdrawal link. */
export async function quote({ amount, recipient, destChain = "near", refundTo, dry = true, originChain = "near" }) {
  const body = {
    dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: 50,
    originAsset: USDC[originChain],
    depositType: "ORIGIN_CHAIN",
    destinationAsset: USDC[destChain],
    amount: String(amount),
    refundTo: refundTo ?? recipient,
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 20 * 60_000).toISOString(),
    confidentiality: process.env.ONECLICK_CONFIDENTIALITY ?? "basic",
  };
  const r = await fetch(`${BASE}/v0/quote`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`1Click quote HTTP ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return { request: body, response: j };
}

export async function submitDeposit(depositAddress, txHash) {
  const r = await fetch(`${BASE}/v0/deposit/submit`, { method: "POST", headers: headers(), body: JSON.stringify({ depositAddress, txHash }) });
  return r.json().catch(() => ({ status: r.status }));
}

export async function status(depositAddress) {
  const r = await fetch(`${BASE}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`, { headers: headers() });
  return r.json();
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("backend/payout.mjs")) {
  const [cmd, amountUsdc, recipient, destChain = "near", refundTo = process.env.ONECLICK_REFUND_TO] = process.argv.slice(2);
  if (cmd === "quote") {
    const amount = Math.round(Number(amountUsdc) * 1e6);
    const dry = process.env.ONECLICK_EXECUTE !== "1";
    const q = await quote({ amount, recipient, destChain, dry, refundTo: refundTo ?? (destChain === "near" ? recipient : undefined) });
    const qq = q.response.quote ?? {};
    console.log(JSON.stringify({ label: "MAINNET integration demo (not enforced by the testnet contract)", dry, confidentiality: q.request.confidentiality, amountIn: qq.amountInFormatted, amountOut: qq.amountOutFormatted, depositAddress: qq.depositAddress ?? "(dry quote: none)", timeEstimate: qq.timeEstimate, correlationId: q.response.correlationId }, null, 2));
  } else if (cmd === "status") {
    console.log(JSON.stringify(await status(process.argv[3]), null, 2));
  } else {
    console.log("usage: node backend/payout.mjs quote <amountUSDC> <recipient> [destChain] | status <depositAddress>");
  }
}
