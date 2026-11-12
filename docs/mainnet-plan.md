# Mainnet plan

Status of this document: research and roadmap, written 2026-11-12 from a read-only feasibility
study (mainnet RPC view calls, public docs, dry 1Click quotes; no transactions). Measured numbers
are marked as such; everything else is an estimate. This submission runs on testnet; the
confidential payout is a separately labelled mainnet integration demo, and the testnet contract
does not enforce it.

## Verdict

- **Feasible:** yes, with code changes. The contract and engine are largely network-agnostic.
- **Before the hackathon deadline:** no. The spec is frozen, and a contract change would void the
  audit and the 10/10 run. Real funds should not sit behind the current upgrade path, a hot agent
  key and modeled DKIM.
- **Biggest blocker:** making the contract enforce the payout puts the amount on-chain, and the
  contract cannot by itself prove that a 1Click deposit address pays the verified payee.

## Component by component

| Component | Mainnet change |
|---|---|
| Treasury contract | `outlayer` init argument → `outlayer.near` (setup already does this); asset → native USDC `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (measured: ft-1.0.0, 6 decimals). Storage registration 0.00125 NEAR per account (measured), required for the treasury, owner and every `recover` target. Add `sync_balance` (reads `ft_balance_of`) because refunds and plain transfers bypass `ft_on_transfer`. |
| OutLayer engine + secrets | `outlayer.near`, `worker.outlayer.near` (both exist, measured), FastFS `main.fastfs.io`, API `api.outlayer.ai`. Secret binding (`--wasm-hash`, `--access whitelist:`, `--via`) documented without a network restriction; behaviour on mainnet not yet tested. Pricing identical to testnet (measured). |
| NEAR AI Cloud | Single endpoint (`cloud-api.near.ai/v1`); no change. |
| 1Click | Mainnet only. Confidential quotes require authentication (401 without, measured). NEAR USDC → NEAR USDC is not quotable (measured), so NEAR-native payees would be a plain `ft_transfer`. |
| Tooling | Parametrize the testnet values in `scripts/verify-attestation.mjs`, `scripts/lib/near.mjs`, `backend/server.mjs`, `backend/intake.mjs`, `web/index.html`. |

## Enforcing the payout from the contract (proposed design)

1. The agent requests a confidential 1Click quote with `refundTo` = the treasury.
2. The engine verifies the quote (or fetches it itself inside the TEE with the partner key stored
   as an OutLayer secret) and binds deposit address, quote hash, amount and fee into the
   authorization; the payee stays sealed in the opening.
3. `settle` performs the USDC transfer to the deposit address, marks the commitment payout-pending,
   and rolls back in a callback on failure.

- **Signer:** only the treasury contract (the promise inside `settle`).
- **Expiry:** quote deadline must exceed authorization expiry plus settle latency; reject quotes
  whose deadline is under ~15 minutes past the authorization expiry.
- **Refunds:** arrive as plain transfers → re-sync balance; a signer restores the commitment.
- **Disclosure:** amount, timing and a one-time deposit address become public; the payee does not
  (confidentiality `basic` breaks the deposit/withdrawal link). This requires a deliberate spec
  change: amounts public at settlement, payees private.
- **Key risk:** without quote verification inside the engine, a stolen agent key could route a
  payout to an attacker's own quote.
- **Fully private alternative (research):** a confidential intents balance signed by a TEE-held
  key, moving enforcement into OutLayer.

## Cost (small business: ~50 payments, ~60 invoices per month)

| Item | Estimate |
|---|---|
| OutLayer (~170 runs × ~0.0011 NEAR, measured per run) | ≈ 0.19 NEAR / month |
| Gas (engine requests, settle at 4.03 Tgas measured) | ≈ 0.5–0.65 NEAR / month |
| NEAR AI Cloud (Qwen3.6-35B: $0.17 / $1.10 per M tokens, measured) | ≈ $0.09 / month |
| 1Click with partner key (1 bp on stablecoin routes, assuming ~$50k volume) | ≈ $5 / month |
| **Total running cost** | **≈ $8 / month** |
| Storage (treasury ≈ 3.53 NEAR locked, measured; ~2 KB per commitment) | ≈ 3.6 NEAR one-time + ≈ 1.2 NEAR / month locked until pruned |
| Without a partner key | +25 bps (≈ $125 / month) and no confidential payouts |

## Must fix before real funds (ranked)

1. **Upgrade path:** remove `#[init(ignore_state)]`, add an owner-controlled upgrade with a
   timelock, then delete the treasury account's full-access keys.
2. **Payee binding** for the enforced payout (above).
3. **Real inbound mail with cryptographic DKIM.** The fix for the new-vendor finding relies on
   authenticated senders.
4. **Agent key** inside the enclave (or HSM with rate limits), not a backend hot key.
5. **Multisig owners and signers** (threshold ≥ 2, hardware wallets), not single plaintext keychain keys.
6. **Balance reconciliation and refund handling.**
7. **External audit** (the review so far was AI-run and testnet-scoped) and a legal review.

Should also address: OutLayer operator trust (the contract cannot verify a TDX quote on-chain),
NVIDIA NRAS token signature verification, vendor linkability over time, sanctions screening and
money-transmission questions (see the compliance statement in the README).

## Work plan

**Safe before the deadline (≈ 4–6 h):** 1Click partner key and one labelled ~$1 confidential
payout; parametrize the testnet values; this document.

**After the hackathon (≈ 80–130 h):**

| Item | Hours |
|---|---|
| Upgrade governance and key removal | 4–6 |
| Enforced payout in `settle` with rollback, balance sync, tests | 12–20 |
| Engine quote verification or in-TEE quote fetch, fee and deadline checks | 8–16 |
| Inbound mail with DKIM | 12–24 |
| Agent key in the enclave | 8–16 |
| Multisig and wallet signing | 8–12 |
| Storage pruning | 4 |
| Monitoring | 4 |
| Capped mainnet canary | 4–6 |

Then an external audit and legal review before onboarding real businesses.

## Sources

- OutLayer CLI and API: https://github.com/out-layer/outlayer/blob/main/docs/CLI.md, https://app.outlayer.ai/docs/secrets, https://app.outlayer.ai/docs/pricing
- 1Click: https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md, https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication.md, https://docs.near-intents.org/integration/distribution-channels/1click-api/fee-config.md, https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote.md
- NEAR AI Cloud models and pricing: `GET https://cloud-api.near.ai/v1/models`
- Mainnet view calls: `https://rpc.mainnet.fastnear.com` (USDC metadata and storage bounds, `outlayer.near` pricing and execution estimate)
