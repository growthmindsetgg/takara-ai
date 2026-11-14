# Stage 2 review: `settle` transfers USDC to NEAR-native payees

Independent review, 2026-11-14 (~15:05–15:40 UTC). Scope: uncommitted diff in `contract/src/{lib,types,events,tests}.rs`, `scripts/judge.mjs`, `scripts/lib/takara.mjs`, cross-checked against `engine/src/engine.rs` (pinned `bc7a4694…caeb`). Source reviewed as of lib.rs mtime 14:19 UTC; `dist/takara_treasury.wasm` (sha256 `3f90a8e3…745d`, matches `dist/SHA256SUMS`) was built after that. Any further edit to `settle` / `on_settle_transfer` / `opening_matches` needs re-review.

`cargo test` (contract): **61 passed, 0 failed** (22 compiler warnings, unused `let _` results only).

## Verdict

**GO** for a mainnet deploy holding ≤2 USDC, with the conditions at the end. No Critical or High finding in the contract diff. The worst stolen-agent-key outcome to an attacker-controlled account is bounded by the policy's `provisional_cap` (0.1 USDC in the `mainnet-min` profile) and never exceeds `balance`.

## Verified properties (no finding)

- **Commitment recomputation matches the engine byte-for-byte.**
  - The engine (`engine.rs:524-527`) hashes `format!("takara-ai:amount:{}:{}:{}", inp.asset, amount, salt)` and `format!("takara-ai:destination:{}:{}:{}", e.rec.c, destination, salt)` with `sha256_hex`, which is lowercase `hex::encode`. The contract (`lib.rs:1370-1379`) uses identical format strings and a lowercase `hex()`.
  - `inp.asset` is the contract's own `self.asset` (`engine_input`, `lib.rs:1191`). It is immutable, and the engine refuses a policy whose asset differs.
  - The amount is a `u128` Display in base units on both sides. `U128` JSON parsing canonicalises leading zeros, so "0400" cannot produce a second preimage.
  - The chain is `auth.destination_chain`, stored verbatim from the engine's `dch` (`= e.rec.c`). The salt is the engine's 16-hex string, passed back verbatim.
  - The preimages are unambiguous: `AccountId` and hex contain no `:`, and the chain is fixed by the issued auth.
  - The real engine → contract path is proven on testnet. Judge check 2 of run `cae2edcc` (14:45 UTC) shows `+400000000` to `ana.fixtureco.testnet` with ok.
- **A stolen agent key cannot redirect or inflate an issued authorization.**
  - `amount`, `receiver_id` and `salt` must open both commitments, with SHA-256 preimage resistance. A different receiver or amount gets `opening_mismatch`.
  - Replay: the nonce is burned on settle (`used_nonces`), and `issued` is removed.
  - A non-accepted commitment is refused (`commitment_not_accepted`), checked before the opening.
- **Accounting stays consistent.** Engine spendable = `balance − outflow − reserved`, where reserved = Σ accepted.
  - NEAR settle: balance −a, reserved −a (state → settled), outflow unchanged ⇒ spendable unchanged.
  - Ledger-only settle: outflow +a, reserved −a ⇒ spendable unchanged.
  - Revert: balance +a, reserved +a ⇒ spendable unchanged.
  - `recover` is bounded by the decremented balance. Tests: `recover_*` ×3.
  - Concurrent `recover` during an in-flight payout stays consistent with tokens held, because the balance is decremented *before* the promise.
- **The revert cannot double-pay.** It runs only on `PromiseError::Failed`, so tokens never moved. A fresh authorization needs a new engine run against the current ledger hash. Every `bump` (settle, revert, pause, revoke, set_agent) invalidates all outstanding auths, so at most one auth is live per ledger state.
- **Cross-contract call.**
  - `ft_transfer` gets 1 yocto (from the contract's own balance; `settle` is non-payable, which is correct) and 20 Tgas. That is ample for USDC on NEAR.
  - The callback has 20 Tgas static plus a share of the leftover gas, and is `#[private]` (`lib.rs:793`).
  - All state changes are committed before the promise. There is no reentrancy surface: NEAR is async, and the callback only adds the balance back.
  - If gas for the promises is insufficient, the whole `settle` receipt fails atomically and no state changes.
  - An unregistered payee (or a USDC blacklist or pause) makes `ft_transfer` panic, which takes the revert path.
- **Controls with the agent offline.** `settle` requires the current agent and checks `paused` first. `pause`, `revoke_agent` and `set_agent` each bump the ledger, so every outstanding authorization goes stale. `recover`, `pause` and `set_max_payout` never touch OutLayer. The in-flight callback deliberately ignores `paused`, which is correct: accounting must settle either way.
- **Judge changes are real assertions.**
  - Check 2 compares the `ft_balance_of` delta to `p.amount`, and pins the receiver and amount to the expected fixture.
  - Check 7 `s4` submits an untampered auth with plain amount +1 and expects `opening_mismatch`. See L3 for its run status.

## Findings

### M1 (Medium; pre-existing, now moves real funds): a stolen agent key can pay an attacker-chosen NEAR account through a forged first-time-vendor claim

- **Where:** `engine.rs:302-303,357-379` (claim), `engine.rs:417-461` (accept), `lib.rs:610-628` and `lib.rs:700-726`.
- **Scenario:**
  - The agent builds the sealed claim itself; the engine pk is public.
  - `sender.dkim = "pass"` is a self-asserted field (security-audit.md: "the engine trusts the relayed verdict"). A forged invoice from a never-seen domain, with `destination = attacker.near`, chain empty (which defaults to `near`) and amount ≤ `new_vendor_auto_limit`, is flagged PROVISIONAL.
  - `request_acceptance` then auto-accepts it under policy, `request_authorization` signs it, and `settle` now transfers USDC to the attacker.
- **Bound:**
  - Σ provisional (accepted + settled) ≤ `provisional_cap`: 0.1 USDC in `mainnet-min`, 1 USDC in `mainnet`.
  - Forged invoices "from" verified vendors or roster members can also be auto-paid up to `max_auto_pay` each, while spendable allows. Those funds go to legitimate (founder-owned) payees, not to the attacker.
- **Fix:**
  - For this deploy: use the `mainnet-min` profile, and accept ≤0.1 USDC of residual exposure.
  - Hardening: in `settle`, for `pays_on_near`, refuse when `c.flags & PROVISIONAL_VENDOR != 0 && c.accepted_by != Some(Signer(_))`. Or set `new_vendor_auto_limit = "0"` on mainnet; judge check 10 would then need updating.
  - Long term: verify DKIM or the attestation inside the TEE rather than trusting the agent-relayed verdict.

### L1 (Low): the default `max_payout` (25 USDC) is not tightened for mainnet

- **Where:** `lib.rs:55`, `lib.rs:267`; `scripts/setup-mainnet.mjs:375-383` omits `max_payout`.
- **Risk:** With ≤2 USDC the ceiling is not binding, so balance is the only effective cap. If someone later tops up the treasury, one auth could move up to 25 USDC. Only the owner can change it (`require_owner` + 1 yocto; tests cover agent, signer and zero).
- **Fix:** pass `max_payout: "1000000"` (1 USDC) in the init args. The largest judge payout is payroll at 0.6 USDC in `mainnet-min`. Alternatively, call `set_max_payout` immediately after init.

### L2 (Low, disclosed): a callback that cannot run strands tokens; no balance resync

- **Where:** `lib.rs:793-816`.
- **Scenario:** `ft_transfer` fails and `on_settle_transfer` then fails (out of gas or storage). `balance` stays decremented while the tokens are still held. `recover` is capped at `balance`, so the difference is stranded. With 20 Tgas static gas this is very unlikely.
- **Fix (post-demo):** add an owner-only `sync_balance` that calls `ft_balance_of(self)` and sets `balance` in a callback, but only while nothing is in flight (track a `pending_payouts` counter).

### L3 (Low, process): the on-chain judge has not yet shown the tampered-plain-amount refusal

- **Where:** `docs/runs/judge-2026-11-14-cae2edcc.json` (7/10); `scripts/judge.mjs:182-184`.
- **What happened:**
  - Check 7 crashed before `s4` ran.
  - Testnet tx `HJiDsBJbdx9X9A4ib5DFKdV6ubDjNZJ84ssaFCKxi7xt` shows OutLayer "Execution promise failed", so the contract refused `engine_error`. That is infrastructure flakiness, not a contract bug.
  - The script dereferences `z2.value.opening` without checking `z2.value.ok`.
  - Checks 9 and 10 crashed the same way ("Received undefined").
- **Fix:** guard `z2.value?.ok` (and the claim results in checks 9 and 10), retry once on `engine_error`, then rerun to 10/10 on testnet before running the judge on mainnet.

### L4 (Low): `on_settle_transfer` re-inserts into `open` without the `MAX_OPEN` bound

- **Where:** `lib.rs:808`. The bound is enforced only at claim time (`lib.rs:1093`).
- **Scenario:** A claim registered while a payout is in flight can fill the slot, and the revert then pushes `open` to `MAX_OPEN + 1`. The only effect is a slightly larger engine input.
- **Fix:** accept, or count in-flight payouts against `MAX_OPEN`.

### I1 (Info): plaintext disclosure is wider than "at payment time"

- `settle` arguments are public in the transaction even when it is refused (`opening_mismatch`, `ledger_state_stale`, `payout_over_ceiling`, a reverted transfer). After a revert, the amount and payee are public even though the re-authorization uses a new salt.
- For non-`near` chains the opening is *optional but accepted* (`lib.rs:707-716`). An agent that passes it would publish a cross-chain payee and amount, defeating the ledger-only confidentiality.
- **Fix:** have the agent never send the opening for non-`near`. Ideally the contract refuses an opening there, or the amendment documents it.
- The events `settlement_transfer_started` / `_completed` / `settlement_reverted` carry `receiver_id` and `amount`, as the amendment discloses. `refusal` events carry no plaintext.

### I2 (Info): salt validation is looser than the engine format

- `opening_matches` accepts 1–64 lowercase hex characters (`lib.rs:1371`), while the engine always emits 16. This is not exploitable, because preimage resistance holds with the chain and asset fixed.
- **Fix:** `is_hex(salt, 16)`.

### I3 (Info): the test that pins the engine format is partly tautological

- `opening_preimage_matches_the_engine_format` (`tests.rs:959`) checks the *test helper* against a literal. It never runs the contract's `opening_matches` against engine-produced output.
- The settle tests do exercise `opening_matches`, but through the same helper, so a format drift shared by the helper and the contract would go unnoticed.
- Real cross-crate evidence exists only from testnet judge check 2.
- **Fix (post-demo):** add a golden vector produced by running the engine's `op_authorize` locally, asserted against `Treasury::opening_matches`.
- The other new tests are meaningful: exact receipt args and deposit, balance deltas, revert restoring every field, nonce burned, and ceiling edge 25,000,000 / 25,000,001.

### I4 (Info): operational notes

- **Payee registration:** `payroll.takara-ai-hq.near` and `ana.takara-ai-hq.near` are USDC storage-registered (see `setup-progress.json`); `mainnet-min` maps every payee to these two. An unregistered payee just reverts on each attempt, which costs the agent OutLayer fees.
- **NEAR float:** keep a NEAR buffer on the treasury. A 1-yocto attach that would breach storage staking makes `settle` fail atomically, which is safe but blocks payouts.
- **Re-initialisation:** never re-initialise a funded treasury (prefixes v3; state layout adds `max_payout`). The mainnet treasury is not yet deployed, so init is fresh.

## Conditions for GO (mainnet, ≤2 USDC)

1. Deploy exactly `dist/takara_treasury.wasm` sha256 `3f90a8e3c50e97454fa0905f0e0656cb89a45b74ffecaf2130162e322140745d`, built from the source reviewed here. If the contract changes again, re-review the diff of `settle`, `on_settle_transfer` and `opening_matches`.
2. Init with `max_payout: "1000000"` (or call `set_max_payout` right after init) (L1).
3. Use the `mainnet-min` policy profile (`provisional_cap` 0.1 USDC) and fund ≤2 USDC total (M1 residual ≤0.1 USDC).
4. Get one green testnet judge run (10/10) with the L3 guard, so check 7's `opening_mismatch` and check 2's payee delta are both shown against the real engine.
5. Keep the owner key offline-capable: `pause` + `revoke_agent` + `recover` is the kill switch, and it works with the agent and OutLayer down.
