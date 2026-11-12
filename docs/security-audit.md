# Security audit

An independent read-only review of the contract, engine, backend and scripts was run on
2026-11-12, after the first 10/10 testnet run. It found no Critical issue on testnet. Every
High and Medium finding was fixed and pinned with a test; Low findings were fixed or are
disclosed below. The fixed build was redeployed and the ten checks were re-run.

## Confirmed properties (unchanged)

- The agent cannot reach any owner or signer method; every attempt fails with a named `E_*` error, and the agent cannot be made a signer or owner.
- `revoke_agent`, `pause` and `recover` never call OutLayer; `recover` works while paused with the agent revoked, and a failed transfer restores the balance.
- No code path deletes a commitment. Downgrade is signer-only, accepted discretionary to claimed only, and logged.
- Claims always start as `claimed`; only a signer or the engine's accept callback moves one to `accepted`.
- `on_engine` is private; a `null`, failed or unparseable result is `engine_error`; the echo binds request number, op, commitment, policy hash and ledger state.
- `settle` accepts only an authorization recorded by the contract's own callback under a contract-generated nonce, compares all 16 fields, burns the nonce, caps expiry at 30 minutes, and requires an accepted commitment and current ledger state.
- The model cannot set vendor, priority or state; invoices never modify the registry; destination changes need a signer plus cooling-off.
- The full-ledger `report` and `open_local` ops are refused when the engine runs with the TEE key.

## Findings and fixes

| ID | Finding | Fix | Test |
|---|---|---|---|
| H1 | Repeated sub-limit invoices from "first-time" vendors could be auto-paid until spendable ran out | New vendors require an authenticated sender (`sender_unverified` otherwise); any earlier commitment from the same new vendor makes the next one need a signer; total provisional spend capped by policy `provisional_cap` (default 100 USDC); settled provisional commitments stay in the engine's input as vendor history | engine `audit_h1_*` (3 tests) |
| H2 | Local dashboard reachable by cross-site requests / DNS rebinding, so a web page could trigger a policy signature | Host allow-list, per-launch token injected into the served page and required on every owner call, Origin check, JSON-only POSTs | manual (curl without token → 403) |
| M1 | Sender identity taken from any `Authentication-Results` line, unanchored domain match, tax-ID path skipped DKIM | Only the first header whose authserv-id is our MTA counts; one clause must say `dkim=pass` for exactly the From domain; the tax-ID path also needs an authenticated sender | parser cases: genuine passes; look-alike domain, foreign server, split clause fail |
| M2 | Engine answers in flight survived re-pinning, agent revocation or agent change | Pending requests store the engine hash; `on_engine` refuses if the engine changed (`authorization_engine_changed`) or the requester is no longer the agent (`agent_changed`); `set_engine`, `revoke_agent`, `set_agent`, `set_secrets`, `pause` bump the ledger state | contract `in_flight_answer_after_*` (2 tests) |
| M3 | The reviewed policy diff (limit values) was stored in readable public state | Only `sha256(diff)` is stored on-chain (`diff_hash`) | contract tests updated |
| M4 | Engine input iterated every commitment ever created; spam could push requests past gas/input limits | `open` index of commitments the engine needs (claimed, accepted, settled-with-vendor-history), `MAX_OPEN = 200`, new claims refused beyond it (`E_TOO_MANY_OPEN_COMMITMENTS`) | contract `settled_plain_commitments_leave_the_engine_input` |
| M5 | Duplicate detection keyed on raw email bytes; changed headers re-submitted the same invoice | Evidence = keyed hash of vendor + normalized invoice number when present, else of the document | engine `audit_m5_*` |
| M6 | Unaccepted claims inflated the runway buffer; wrapping arithmetic in release builds | Runway burn counts accepted recurrences only; amounts capped at 10^18 base units; saturating sums; `overflow-checks = true` | engine `audit_m6_*` |
| L1 | Any 1-unit `ft_transfer_call` voided every in-flight request | Funding no longer bumps the ledger state (more funds cannot break a reserve check) | contract `recovery_changes_ledger_state_but_funding_does_not` |
| L2 | The agent could re-accept a commitment a signer had preempted | Contract sets a `DOWNGRADED` flag; the engine requires a signer for it | contract + engine `*downgrade*` |
| L3 | Temp files carrying the owner key could survive an exception | Temp folder removed in `finally` | — |
| L4 | NEAR AI evidence not enforced | Intake refuses an unverified parse; TCB status, compose hash and RTMR3 replay required; GPU evidence required when present | — |
| L5 | Member payouts used the address captured at claim time | Authorizations use the signed roster's current address | — |
| L6 | `reject_vendor_change` could close an accepted reservation; `settle` ignored policy expiry | Reject closes only claimed commitments; `settle` refuses `policy_expired` | contract `reject_vendor_change_never_releases_an_accepted_reservation` |

## Disclosed, not fixed in this build

- **Agent key custody.** The agent is a NEAR account whose key the backend holds. Its power is limited by the contract (request engine decisions, settle what the engine issued), not by key custody in the enclave.
- **DKIM is modeled.** Intake trusts the `Authentication-Results` header written by our receiving server; there is no live mail server in the demo, and the engine trusts the relayed verdict.
- **NVIDIA NRAS token.** The overall GPU verdict and nonce are read from NVIDIA's JWT; its signature is not re-verified locally.
- **Public linkability.** `vendor_ref` is stable per vendor, and `discretionary` priority reveals member payouts; deterministic sealing reveals equal plaintexts. Composition stays private; linkage over time does not.
- **OutLayer secret rule** names one agent account; after `set_agent`, re-run setup to rebind the secret.
- **Engine key on the CLI.** `setup-testnet.mjs` passes the engine key to `outlayer secrets set` as an argument (visible in the local process list during setup).
- **Upgradability.** The treasury's own account key can redeploy the contract (and `new` can re-initialise, callable only by the treasury account). A production deployment should remove the treasury account's full-access keys after deploy.
