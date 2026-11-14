# Mainnet confidential payout (1Click)

**Label: separately labelled MAINNET integration demo of confidential settlement.** The testnet
treasury contract does not and cannot enforce this payout (frozen spec, row 6 and the honesty
line). The founder runs the payout command; no agent or coordinator moves funds.

Written 2026-11-14 from the primary docs (docs.near-intents.org, the 1Click OpenAPI spec 0.1.10,
`near-examples/near-intents-examples`) and live, read-only dry quotes against
`https://1click.chaindefuser.com`. "Measured" means observed today; nothing was deposited.

## 1. What the 1Click API needs (from the primary docs)

| Step | Endpoint | Auth | Notes |
|---|---|---|---|
| Tokens | `GET /v0/tokens` | none | Native NEAR USDC is `nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` (measured, 231 tokens listed). |
| Quote | `POST /v0/quote` | `X-API-Key: <partner JWT>` (or `Authorization: Bearer`) | `dry: true` returns a price and no deposit address; `dry: false` returns `depositAddress` and `deadline`. `confidentiality`: `public` (default), `basic`, `advanced`. |
| Deposit | on-chain | founder's key | For a NEAR origin: `ft_transfer` of exactly `amountIn` USDC to `depositAddress` (an implicit account, which must be registered on the USDC contract first, 0.00125 NEAR). |
| Notify (optional) | `POST /v0/deposit/submit` | same key | `{ depositAddress, txHash, nearSenderAccount }`; speeds up detection. |
| Status | `GET /v0/status?depositAddress=` | optional | `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`. `swapDetails` carries `nearTxHashes`, `originChainTxHashes`, `destinationChainTxHashes` (hash + explorer URL), `refundedAmount`, `refundReason`. |
| Refunds | in the quote | | `refundTo` + `refundType: ORIGIN_CHAIN` returns the deposit to a NEAR account if the swap fails or the deadline passes. |
| Quote authenticity | `signature` in every quote | | `ed25519:` over base58(sha256(stable-JSON of `{...quoteRequest, ...quote, timestamp}`)); verifiable with the official SDK's `verifyQuoteSignature()`. |

**Fees** (docs, "Fees"): without a key +25 bps on every quote; with a partner key 20 bps, or
**1 bp on stablecoin and same-asset routes**; protocol fee 0.0001%. No swap minimum for NEAR,
Base, Arbitrum or Solana ("Swap limits" page).

### Measured today (unauthenticated dry quotes, 3 USDC in)

| Route (from NEAR USDC) | Public quote | Confidential (`basic`/`advanced`) |
|---|---|---|
| → NEAR USDC, `DESTINATION_CHAIN` (a NEAR account) | 3.0 → **3.0**, ~20 s | **401** |
| → NEAR USDC, `INTENTS` balance | 3.0 → 3.0, ~20 s | 401 |
| → NEAR USDC, `CONFIDENTIAL_INTENTS` balance | 401 even as public | 401 |
| → Base USDC | 3.0 → 2.997, ~22 s | 401 |
| → Arbitrum USDC | 3.0 → 2.994, ~19 s | 401 |
| → Solana USDC | 3.0 → 2.798, ~17 s | 401 |

- The 401 body is `"User authentication is required for confidential intent quotes"`. The
  OpenAPI spec lists only `X-API-Key` / `JWT-auth` (the partner JWT) for `/v0/quote`; the
  separate User-Session token is only for reading private balances and history. A fake key
  returns 401 `"Invalid token"`.
- **Correction to `docs/mainnet-plan.md`:** NEAR USDC → NEAR USDC *is* quotable. The earlier
  "not quotable" result was caused by a refund account that does not exist: 1Click answers
  HTTP 400 `"Internal server error"` when `refundTo` is a named NEAR account that does not exist
  (measured with `takara-ai-hq.near`, which is not created yet; the same quote with an existing
  account succeeds). The same applies to a named NEAR `recipient` that does not exist (measured
  with `ana.takara-ai-hq.near`). The script detects and explains both, and `--execute` refuses.

## 2. Route chosen

**Default: NEAR USDC → NEAR USDC to a NEAR account, `confidentiality: "basic"`, refunds to the
sender.** Suggested payee: `ana.takara-ai-hq.near`, the founder-owned mainnet stand-in for the
testnet payee `ana.fixtureco.testnet` (created by `scripts/setup-mainnet.mjs`).

Why:
- Cheapest: same-asset stablecoin route, 1 bp with a partner key (0.0003 USDC on 3 USDC), no
  bridge, no withdrawal fee, no destination-chain gas.
- Most reliable: no bridge leg, ~20 s estimate, no minimum, both ends on NEAR, the payee can be
  checked on nearblocks.
- Confidential in the sense the spec claims: with `basic`, the deposit from the treasury owner
  and the withdrawal to the payee are not linkable to each other on chain. It is not anonymity:
  the withdrawal itself (amount, payee) is visible, and amount and timing can be correlated.

Alternatives the script also supports: `--route base` (shows "pays out on the recipient's chain";
needs a Base address the founder controls; ~10 bps public, 1 bp with a key) and
`--route conf-intents` (payee receives into a Confidential Intents balance, so no public
withdrawal at all; the payee then needs a wallet that signs intents to use the funds). If 1Click
refuses `basic` on the same-asset NEAR route even with a key, use `--route base`.

## 3. Founder: get a 1Click partner key (about 5–10 minutes)

1. Open **https://partners.near-intents.org** in a browser. It redirects to the NEAR Intents
   sign-in page (`signin.near-intents.org`, a WorkOS sign-in). Create an account or sign in.
2. In the **Partner Dashboard**, create an API key and copy the **JWT** it shows.
3. Save it locally only (never in git, chat, screenshots or the video):
   ```bash
   mkdir -p .secrets/mainnet
   printf 'ONECLICK_JWT=%s\n' '<paste the JWT>' > .secrets/mainnet/1click.env
   ```
   `.secrets/` is git-ignored. Alternatively `export ONECLICK_JWT='<paste>'` in one shell.
4. Check it with a dry run (moves nothing):
   ```bash
   node scripts/payout-1click.mjs --amount 3 --recipient ana.takara-ai-hq.near
   ```
   Expect "Confidential dry quote" with `confidentiality basic`. A 401 `"Invalid token"` means
   the key was mis-pasted or revoked.
5. If the dashboard asks for review or approval and no key is issued in time, ask in the NEAR
   Intents Telegram (`t.me/near_intents`, linked from the docs). Without a key the confidential
   payout cannot run; do not substitute a public payout and call it confidential.

## 4. Founder: run the payout (`scripts/payout-1click.mjs`)

Prerequisites:
- `takara-ai-hq.near` exists and its key is in `~/.near-credentials/mainnet/` (setup step
  `node scripts/setup-mainnet.mjs owner`).
- The payee account exists (e.g. `ana.takara-ai-hq.near`, created by the mainnet setup). Until
  it does, even the dry run fails at 1Click.
- It holds at least the payout amount in native USDC plus ~0.01 NEAR for gas and up to
  2 × 0.00125 NEAR for storage registration (payee and deposit address).
- The partner key from section 3.

```bash
# 1. Dry run: fetches a quote, prints it, moves nothing
node scripts/payout-1click.mjs --amount 3 --recipient ana.takara-ai-hq.near

# 2. Real payout: prints the plan and asks you to type YES
node scripts/payout-1click.mjs --amount 3 --recipient ana.takara-ai-hq.near --execute

# Later, read-only status of any deposit address
node scripts/payout-1click.mjs --status <depositAddress>
```

What `--execute` does, in order: read-only preflight (accounts, balances, keychain, storage);
live confidential quote (`dry: false`, `refundTo` = the sender); refuses if the amount is over
**10 USDC**, the quote's `amountIn` differs from the request, the implied cost is over
`--max-fee-bps` (default 100), the deadline is under 10 minutes away, or the refund account does
not exist; asks for `YES` (or `--yes`, which only the founder should pass); registers the payee
and the deposit address on USDC if needed; sends `ft_transfer` of `amountIn` to the deposit
address through `near` (near-cli-rs, legacy keychain; the script never reads key files); submits
the hash to 1Click; polls status every 5 s until `SUCCESS`, `REFUNDED`, `FAILED` or 20 minutes.

Output: deposit transaction (nearblocks link), 1Click status, intents and destination transaction
hashes with explorer links, the NEAR Intents explorer link
(`https://explorer.near-intents.org/transactions/<depositAddress>`).

**Public record** `fixtures/payout-1click.mainnet.json` (no keys): label, route, amounts, sender,
deposit address and transactions, 1Click status and hashes, quote correlation id and signature,
and:
- `recipient_commit` = sha256(`takara-ai:mainnet-recipient:` chain `:` recipient `:` salt). The
  payee is not written in the public record; the opening (payee and salt) is written to
  `.secrets/mainnet/payout-1click.opening.json` for the owner or an auditor.
- `linked_authorization`: the testnet `settlement_receipt` this demo illustrates (default:
  commitment #9, Ana's 12.5 USDC reimbursement, settle tx
  `GPXj598iHiBPKNAVL8SL6Vi7y3D56RwQuKoH2ht5L22z`, auth_hash `56da9b9d…c329b2`), read from
  testnet RPC. Override with `--auth-tx`.
- `link_commitment` = sha256(`takara-ai:mainnet-demo-link:v1:` + JSON of deposit tx, deposit
  address, amount in, recipient commit, linked auth hash, linked settle tx): a public hash that
  ties the mainnet payout record to the treasury authorization.

Honest wording for the demo: the link is a published cross-reference, not enforcement. The demo
amount (≤ 10 USDC) and the mainnet payee differ from the sealed testnet payout (12.5 USDC to
`ana.fixtureco.testnet`), so the testnet `amount_commit` and `destination_commit` do not open to
the mainnet values, and the record says so.

### Dry-run results (2026-11-14, no key present)

- `--amount 3 --recipient intents.near` (route near): confidential quote → 401 with the key
  instructions; the script then proved the route with the same request as a public,
  unauthenticated dry quote: 3.0 → 3.0 USDC, ~20 s. Because `takara-ai-hq.near` does not exist
  yet, the dry run substitutes `refundTo=intents.near` and says so; `--execute` refuses in that
  case.
- `--route base` to an EVM address: 401, then public proof 3.0 → 2.996994 USDC, ~22 s.
- `--recipient ana.takara-ai-hq.near`: 401, and the public proof fails because the account does
  not exist yet; the script names that cause.
- Fake key: 401 `"Invalid token"`, explained; the key never appears in output.
- `--amount 10.5`: refused (hard cap). `--execute` without an existing refund account: refused
  before any quote or transfer.

## 5. Stage 2 feasibility: make `settle` move USDC on mainnet (analysis only)

### (a) Plain `ft_transfer` to a NEAR-native payee

**Status: already implemented in the working tree by another agent (uncommitted, not by this
document's author).** `git diff contract/src` shows:
- `contract/src/lib.rs` `settle(auth, amount?, receiver_id?, salt?) -> PromiseOrValue<Decision>`:
  after all existing checks, recomputes the engine's preimages in `opening_matches()`
  (`takara-ai:amount:{asset}:{amount}:{salt}`, `takara-ai:destination:{chain}:{receiver}:{salt}`,
  identical to `engine/src/engine.rs` `op_authorize`), refuses `opening_mismatch`; for
  `destination_chain == "near"` enforces `max_payout` (default 25 USDC, `set_max_payout`, owner
  only) and the balance, lowers `balance` (and leaves `sealed_outflow` unchanged), then
  `ft_transfer` → `on_settle_transfer` (`#[private]`), which on failure restores the balance,
  returns the commitment to `accepted`, bumps the ledger hash and emits `settlement_reverted`
  (nonce stays burned). Other chains stay ledger-only.
- `contract/src/types.rs` (`Config.max_payout`), `contract/src/events.rs` (four new reasons),
  `contract/src/tests.rs` (≈ 20 new tests: exact amount and payee, no outflow double count, wrong
  amount, payee or salt, missing opening, ordering of checks, ceiling and its access control,
  balance, failed transfer revert, `recover` bounds after payouts, preimage format).
- No engine change is needed: the engine already commits to the plain amount and payee.

What is still missing for (a) to work end to end:
| Item | Files | Hours |
|---|---|---|
| Agent passes the opening to `settle` (open with `open_opening`, then `settle({auth, amount, receiver_id, salt})`; today `settle` is called with `{ auth }` only) | `scripts/lib/takara.mjs` `settle`, `backend/` relay | 1–2 |
| Payees registered on USDC before payout (else the transfer fails and reverts, which is safe but noisy) | `scripts/setup-mainnet.mjs` | 0.5 |
| Gas: `settle` currently sent with 50 Tgas; transfer + callback need ≈ 20 + 20 Tgas more | `scripts/lib/takara.mjs` | 0.5 |
| `cargo test`, rebuild wasm, redeploy, re-run the judge scenario | | 1–2 |
| Wording: README, app copy and spec scope statement must say NEAR-native payouts reveal amount and payee at payment time | docs | 1 |
| **Remaining total** | | **≈ 4–6 h** |

Risks: amount and payee become public per payment (a spec change: "amounts and payees public at
settlement for NEAR-native payees"); `max_payout` applies to already issued authorizations (good);
a revert keeps the nonce burned, so the agent must re-authorize; refunds or plain transfers into
the treasury still bypass `ft_on_transfer` (balance sync is a separate item); the upgrade path
(`#[init(ignore_state)]`) and hot agent key are unchanged, so real funds should stay under the
25 USDC ceiling. It also changes the frozen honesty line: if this ships on mainnet, NEAR-native
payouts *are* contract-enforced there, and every label must be updated to match exactly.

### (b) Transfer to a 1Click deposit address bound into the TEE authorization (private payee)

Goal: the contract pays a one-time 1Click deposit address; the engine has checked, inside the
TEE, that a quote signed by 1Click sends exactly the authorized amount to the sealed payee. The
payee never appears on chain in connection with the treasury; amount, time and the deposit
address do.

Flow: the agent requests a confidential quote (`dry: false`, `refundTo` = treasury,
`refundType: ORIGIN_CHAIN`, `recipient` = payee from the opening, partner JWT as an OutLayer
secret or backend secret) → passes the full quote response to the engine with `authorize` →
the engine verifies and binds it → the contract records the deposit address → `settle` transfers
to it.

Changes:
| Where | Function | Change |
|---|---|---|
| `engine/src/model.rs` | `Policy` | add `oneclick_pubkey` (pinned ed25519 key), `oneclick_max_fee_bps`, allowed destination assets per chain |
| `engine/src/engine.rs` | `Input`, `op_authorize` | accept `q` (quote JSON); verify: ed25519 signature over base58(sha256(stable-JSON(`{...quoteRequest, ...quote, timestamp}`))); `quoteRequest.recipient == destination`; `destinationAsset` matches the payee's chain/token; `amountIn == amount`; `refundTo == treasury`, `refundType == ORIGIN_CHAIN`; `confidentiality` ≠ public; `minAmountOut ≥ amount − max_fee`; `deadline ≥ exp + 15 min`. Emit `dpa` (deposit address, plain) and `qh` (quote hash); fold both into `dsc` so the destination commitment covers payee **and** deposit address |
| `engine/src/crypto.rs` | new `verify_ed25519` | new pinned dependency (e.g. `ed25519-dalek`), plus a byte-exact `json-stable-stringify` port |
| `contract/src/types.rs` | `SettlementAuth` | add `payout_to: Option<AccountId>`, `quote_hash: Option<String>`; `Commitment` gains a `PayoutPending` state or flag |
| `contract/src/lib.rs` | engine-output parser (`on_engine` authorize branch, ~L1170) | validate `dpa` (64-hex implicit) and `qh`; copy into the issued auth; `first_mismatch` grows to 18 fields |
| `contract/src/lib.rs` | `settle` | when `payout_to` is set: open only the amount (`amount` + `salt` against `amount_commit`), enforce `max_payout` and balance, `ft_transfer` to `payout_to`, reuse `on_settle_transfer` for rollback; never accept a payee argument |
| `contract/src/lib.rs` | new `sync_balance` (owner/signer), `mark_payout_refunded(cid)` (signer) | refunds return as plain `ft_transfer` to the treasury and skip `ft_on_transfer`; read `ft_balance_of` in a callback and reopen the commitment |
| agent / backend | `scripts/lib/takara.mjs`, `backend/payout.mjs` | fetch the quote, `storage_deposit` the deposit address (anyone may), call `request_authorization` with the quote, settle, poll 1Click status, report refunds |

Tests to add: engine: valid quote binds; tampered field, wrong signature, wrong key, wrong
recipient, wrong asset, amount ≠ authorized, `refundTo` ≠ treasury, public confidentiality, short
deadline, fee over cap all refuse; stable-stringify golden vectors from real 1Click responses.
Contract: settle pays exactly `payout_to`; payee argument rejected; amount opening mismatch;
ceiling; failed transfer reverts; engine output over the size cap refused; refund → `sync_balance`
→ `mark_payout_refunded` restores the reservation; `recover` stays bounded.

Estimate: engine 10–16 h, contract 10–16 h, agent/backend 4–6 h, tests and golden vectors
4–6 h, mainnet canary 2 h: **≈ 30–46 h**. Not feasible before the deadline.

Risks:
- **Trust moves to 1Click's signing key.** The contract still cannot prove the deposit address
  pays the payee; the TEE checks that 1Click *signed* a quote saying so. The 1Click public key is
  embedded in their SDK, not formally published; key rotation would halt payouts until a policy
  update.
- **Byte-exact stable JSON** in Rust must match 1Click's TypeScript serializer, or every
  signature fails (or, worse, a lax port verifies a different message).
- **OutLayer stdout cap (900 bytes):** `dpa` + `qh` add ≈ 140 bytes to an output that already
  carries a sealed opening; it may need the deposit address folded into a commitment plus a
  shorter quote hash.
- **Timing:** the quote deadline must outlive authorization TTL (900 s) plus settle latency;
  stale quotes need re-authorization.
- **Refunds and balance drift** until `sync_balance` exists; a refunded commitment must not be
  paid twice (signer-gated reopen).
- **Disclosure:** amount, timing and a one-time deposit address are public per payout; the payee
  is not (with `basic`). Spec change: "amounts public at settlement, payees private".
- **Key custody:** the partner JWT only affects fees and quote access, not funds; a stolen agent
  key still cannot redirect funds because the engine binds the quote's recipient to the sealed
  payee.

### Recommendation input for the coordinator

(a) is nearly done and makes NEAR-native payouts real but public. (b) is the private-payee design
and is a post-hackathon item. For the submission, the confidential payout remains the labelled
1Click integration demo in sections 2–4, run by the founder.

## Sources

- https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication.md
- https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request.md
- https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md
- https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature.md
- https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote.md, …/check-swap-execution-status.md, …/submit-deposit-transaction-hash.md
- https://docs.near-intents.org/resources/fees.md, https://docs.near-intents.org/resources/swap-limits.md
- https://1click.chaindefuser.com/docs/v0/openapi.yaml (version 0.1.10)
- https://github.com/near-examples/near-intents-examples (`1click-example/`)
- Partner Dashboard: https://partners.near-intents.org
