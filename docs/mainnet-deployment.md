# Takara AI on NEAR mainnet

**Status: live on NEAR mainnet at [`treasury.takara-ai-hq.near`](https://nearblocks.io/address/treasury.takara-ai-hq.near)**, where settlement pays the payee in real USDC. **All ten security checks pass on mainnet** ([run fa4a1a16](runs/judge-mainnet-2026-11-14-fa4a1a16.json)). Testnet stays live as the reference deployment: [`treasury.takara-ai-hq.testnet`](https://testnet.nearblocks.io/address/treasury.takara-ai-hq.testnet). On testnet the current contract passed 9 of 10; the one failure (check 10) was an OutLayer `engine_error` while OutLayer's testnet was down that afternoon. The earlier testnet 10/10 (2026-11-12) ran on the previous contract build.

Everything on this page is a public record you can check yourself on [NearBlocks](https://nearblocks.io) and the [OutLayer API](https://api.outlayer.ai). The business is the same fictional fixture company as on testnet. Amounts are **1/1000 of the testnet fixtures** (the "min" profile), so the treasury held about 1 USDC of real money.

Source of truth for the hashes below: [`fixtures/mainnet/setup-progress.json`](../fixtures/mainnet/setup-progress.json) (setup) and `fixtures/deployment.mainnet.json` (the treasury record, written only once the treasury is deployed; the app treats its presence as "mainnet is live").

## Accounts

| Role | Account | Explorer |
|---|---|---|
| Owner (the business) | `takara-ai-hq.near` | [nearblocks.io/address/takara-ai-hq.near](https://nearblocks.io/address/takara-ai-hq.near) |
| Treasury contract | `treasury.takara-ai-hq.near` | [nearblocks.io/address/treasury.takara-ai-hq.near](https://nearblocks.io/address/treasury.takara-ai-hq.near) |
| Agent (Banto) | `agent.takara-ai-hq.near` | [nearblocks.io/address/agent.takara-ai-hq.near](https://nearblocks.io/address/agent.takara-ai-hq.near) |
| Policy signer | `signer.takara-ai-hq.near` | [nearblocks.io/address/signer.takara-ai-hq.near](https://nearblocks.io/address/signer.takara-ai-hq.near) |
| Payee (payroll) | `payroll.takara-ai-hq.near` | [nearblocks.io/address/payroll.takara-ai-hq.near](https://nearblocks.io/address/payroll.takara-ai-hq.near) |
| Payee (contractor) | `ana.takara-ai-hq.near` | [nearblocks.io/address/ana.takara-ai-hq.near](https://nearblocks.io/address/ana.takara-ai-hq.near) |
| Policy engine host | `outlayer.near` (OutLayer) | [nearblocks.io/address/outlayer.near](https://nearblocks.io/address/outlayer.near) |
| Asset | native USDC, `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | [nearblocks.io/address/17208628…33a1](https://nearblocks.io/address/17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1) |

The payees are founder-owned accounts. Two fixture payees, `railway-new-bank` (the changed bank account) and `attacker-wallet`, are deliberately never created on mainnet: the checks that use them must be refused before any money could reach them.

## Setup transactions

| Time (UTC) | Step | Transaction |
|---|---|---|
| 14:50:53 | Create `takara-ai-hq.near` from the funding account | [`34o1Xd5z…`](https://nearblocks.io/txns/34o1Xd5zd6MMKFFPP3soVRGLGhqrsaf1ejwMET3hg6Dj) |
| 14:51:14 | Create `agent.takara-ai-hq.near` | [`GFSywNZA…`](https://nearblocks.io/txns/GFSywNZAJY4WsporfdZUVce15dnhXMBoUvveLsULPQWa) |
| 14:51:23 | Create `signer.takara-ai-hq.near` | [`J2NV1FM5…`](https://nearblocks.io/txns/J2NV1FM5e9sRHCb8m2xveVTAcGQ4kChZabwfKMiKtS5m) |
| 14:51:31 | Create `payroll.takara-ai-hq.near` | [`2w9SysLT…`](https://nearblocks.io/txns/2w9SysLTQiXCrgNc5E5aV5jefND2tDHTPiWS1ZRuTZyc) |
| 14:51:40 | Create `ana.takara-ai-hq.near` | [`HchkyczK…`](https://nearblocks.io/txns/HchkyczKQHimsS9pUyAbuPccDz8TQg6JA4DPVcxDqgbr) |
| 14:51:49 | USDC storage deposit for `takara-ai-hq.near` | [`6CMiMvEh…`](https://nearblocks.io/txns/6CMiMvEhixKRTJLVYeU2cPoitxqrvQ6jUXgfGWRBYT3v) |
| 14:51:57 | USDC storage deposit for `payroll.takara-ai-hq.near` | [`CtkBYPKY…`](https://nearblocks.io/txns/CtkBYPKYTZbN7FdptEdbpdnv1j8RnXUFzLHxueHsgnFk) |
| 14:52:06 | USDC storage deposit for `ana.takara-ai-hq.near` | [`EEt52PTs…`](https://nearblocks.io/txns/EEt52PTszRtXwJDABMgqgEKUfetD8RkYQqNNYBX6WAxf) |
| 14:52:39 | Engine upload to FastFS (the transaction "fails" by design: gas 1, the FastFS indexer reads the arguments) | [`9M1F4vij…`](https://nearblocks.io/txns/9M1F4vijuzpHQCeMtMX22TFniNmiFpASzYwHihxM5n91) |
| 14:53 | OutLayer secret, profile `smoke` (throwaway key, readable by the agent only) | [`9GrpzDyu…`](https://nearblocks.io/txns/9GrpzDyuftetT2BrKbMkNR8ocZmgHrPTmzDXX6xLtxyZ) |
| 14:53 | OutLayer secret, profile `default` (the engine key: readable only when the agent signs **and** the call comes through the treasury) | [`FyMm3srH…`](https://nearblocks.io/txns/FyMm3srHmrWHusL1J3aq25RBQxNrYzJtiooabR3W4cdW) |
| 14:53:52 | Engine smoke run, request 3580 (PASS) | [`EnbrVG85…`](https://nearblocks.io/txns/EnbrVG85S7bWJNxFTaFeydEEfqbLjYXvTokoyK1AkmBz) |
| 14:54:07 | Engine smoke run, request 3581 (refused as designed) | [`81cf1LRb…`](https://nearblocks.io/txns/81cf1LRbmf3qTAYXcSwdo1tWBs7T6JYLqzkb4r5M3rAm) |
| 15:09:39 | Create `treasury.takara-ai-hq.near` (sized from the wasm) | [`EToLqskE…`](https://nearblocks.io/txns/EToLqskEXY2afqYvzCT31Mkxg1VS2zKFwr7qFtPZikbu) |
| 15:09:47 | USDC storage deposit for `treasury.takara-ai-hq.near` | [`CYjfwEan…`](https://nearblocks.io/txns/CYjfwEanKwPqb9vdbYM3GZ8k3gdWDWvzByqrUVo9KWAe) |
| 15:09:55 | Deploy and initialise the treasury (code hash `5H8d7wgh7DKbgVZiU99Cs95gBZV9miLhUhhKt3vcXm1n`) | [`DiRpCGnW…`](https://nearblocks.io/txns/DiRpCGnWR7J6Vx6iUkXF5icZgpY6YnnBeneVNU61ArA6) |

## The policy engine

| | |
|---|---|
| Engine wasm sha256 (pinned by the treasury) | `bc7a4694e92381b384865734a045a15e6f5f7cb785b229f84e37a71ff823caeb` |
| Build target | `wasm32-wasip1`, 299,998 bytes |
| Hosted on FastFS | [main.fastfs.io/takara-ai-hq.near/outlayer.near/bc7a4694…caeb.wasm](https://main.fastfs.io/takara-ai-hq.near/outlayer.near/bc7a4694e92381b384865734a045a15e6f5f7cb785b229f84e37a71ff823caeb.wasm) |
| Runs on | OutLayer (`outlayer.near`), inside Intel TDX |
| Engine public key (x25519, policies and books are sealed to it) | `2ee6860b4b109484e50dd84ce3ee4e6479f1aff85bbbdadb3c7bbb1b38c17511` |
| Secret access rule | profile `default`: `whitelist:agent.takara-ai-hq.near` **and** `from:treasury.takara-ai-hq.near` |

It is the same engine build as on testnet (same sha256), so the mainnet treasury runs exactly the code the ten testnet checks exercised.

## Engine smoke runs and attestation

Two runs on mainnet before the treasury existed, one expected to pass and one expected to be refused:

| Request | Transaction | Expected | Result |
|---|---|---|---|
| [3580](https://api.outlayer.ai/attestations/by-request/3580) | [`EnbrVG85…`](https://nearblocks.io/txns/EnbrVG85S7bWJNxFTaFeydEEfqbLjYXvTokoyK1AkmBz) | The engine reads its sealed secret (profile `smoke`) and returns its public key | **PASS**: `{"ok":true,"op":"pubkey",…}`, cost 0.00116 NEAR, the rest refunded |
| 3581 | [`81cf1LRb…`](https://nearblocks.io/txns/81cf1LRbmf3qTAYXcSwdo1tWBs7T6JYLqzkb4r5M3rAm) | The real engine key (profile `default`) is withheld, because the call did not come through the treasury | **Refused as designed**: OutLayer logged "Access denied by access condition", and refunded 0.009 NEAR |

Run 3581 is the important one: even the agent's own signature is not enough to reach the engine key. Only a call routed through the treasury contract, which checks policy first, can use it.

**Attestation check for request 3580: 6/6 PASS**, verified independently with [`scripts/verify-attestation.mjs`](../scripts/verify-attestation.mjs), without trusting the API's own claims: the executed wasm hash equals the pinned hash; the input and output hashes match; the task hash we recompute equals the Intel TDX quote's REPORTDATA; the worker measurement is approved on chain by `worker.outlayer.near`; and the quote's signature chain verifies to Intel's root (DCAP, TCB status UpToDate).

```bash
NEAR_NETWORK=mainnet node scripts/verify-attestation.mjs 3580 \
  bc7a4694e92381b384865734a045a15e6f5f7cb785b229f84e37a71ff823caeb \
  '{"v":1,"op":"pubkey"}' '<the exact output from the transaction above>'
```

## Treasury

| | |
|---|---|
| Account | [`treasury.takara-ai-hq.near`](https://nearblocks.io/address/treasury.takara-ai-hq.near) |
| Deploy and init transaction | [`DiRpCGnW…`](https://nearblocks.io/txns/DiRpCGnWR7J6Vx6iUkXF5icZgpY6YnnBeneVNU61ArA6) |
| Contract wasm sha256 | `3f90a8e3c50e97454fa0905f0e0656cb89a45b74ffecaf2130162e322140745d` (`dist/takara_treasury.wasm`) |
| Pinned engine | `bc7a4694e92381b384865734a045a15e6f5f7cb785b229f84e37a71ff823caeb` |
| Policy | version 1, hash `cbf814b46758686eab9055e27e948fdb9705555fb9db2410d6009b8f490474af`, signer `signer.takara-ai-hq.near`, threshold 1 |
| Owner / agent | `takara-ai-hq.near` / `agent.takara-ai-hq.near` |
| Settlement | `settle` sends the USDC to the NEAR payee with `ft_transfer` (a failed transfer reverts the settlement); capped per payment by `max_payout` |
| USDC in the treasury | 0 at deploy; funded by the founder before the check run; 0.88 after it |
| Per-payment ceiling (`max_payout`) | 1 USDC |
| NearBlocks code hash | `5H8d7wgh7DKbgVZiU99Cs95gBZV9miLhUhhKt3vcXm1n` (base58 of the sha256 above; the testnet treasury runs the same code hash) |

## Mainnet check run

**10 of 10 checks pass, 47 of 47 assertions**: [run fa4a1a16](runs/judge-mainnet-2026-11-14-fa4a1a16.json), 2026-11-14 15:52:32 UTC, 40 transactions against `treasury.takara-ai-hq.near`, amounts 1/1000 of testnet.

Real USDC moved: the founder funded the treasury, and two settlements paid NEAR payees with `ft_transfer`. On-chain USDC right after the run: treasury 0.88, `ana.takara-ai-hq.near` 0.40, `payroll.takara-ai-hq.near` 0.12, owner 0.60.

| Check | What happened | Key transaction |
|---|---|---|
| 1. Reserve protection | Ana's 0.40 refused `would_break_commitments` while payroll 0.60 and Railway 0.12 are reserved | [`2rYVAAWD…`](https://nearblocks.io/txns/2rYVAAWDYhCWEy1AhE13R7QhH5dQ9vf7V2QBHjy36AmS) |
| 2. Release after funding | after a 0.50 top-up ([`65moq49N…`](https://nearblocks.io/txns/65moq49NxBeffNgyuNFtyGTmQydVtx5sSVDcaFcJPW3h)) the same bill is accepted and **paid: 0.40 USDC sent to `ana.takara-ai-hq.near`** | [`BenNh8MF…`](https://nearblocks.io/txns/BenNh8MF7CCsDCs2Xwq34TgjKPbPVBKzdJQZEdo8i7fY) |
| 3. Claimed is not accepted | a new bill reserves nothing until a signer accepts it | [`2Vh22ySF…`](https://nearblocks.io/txns/2Vh22ySFK5ynSiq4ziKndo6xaPtNXn2djMXLNqRsgdhG) |
| 4. Duplicate rejection | the same invoice again is refused `duplicate_evidence` | [`4xG57A7f…`](https://nearblocks.io/txns/4xG57A7f4rKkKKDsaPRFfUVWPVPnHsunEpW2KgyCLvhg) |
| 5. Destination change | changed bank details suspended `vendor_destination_mismatch`; the agent's approval is refused, the signer's is accepted, cooling-off holds | agent refused [`6eJBwFxG…`](https://nearblocks.io/txns/6eJBwFxGmqin5DiUS86GJU3PE7scNHQkvcfqts5xyu2A), signer [`3fySMk6w…`](https://nearblocks.io/txns/3fySMk6wTXK6H6BzAsp2QE2FAspeCzhgvxP6QU1JxQrF) |
| 6. Prompt injection | instructions in the invoice text flagged and ignored | [`6zPpFWPg…`](https://nearblocks.io/txns/6zPpFWPgfwRDasgCmPqRc7iBqaUjmxYAiuBdrxFYR3zX) |
| 7. Replay and tampering | **first settlement pays 0.12 USDC to `payroll.takara-ai-hq.near`**; the replay is refused `nonce_used`; an amount changed by one unit is refused `authorization_mismatch` | paid [`37kXzVrN…`](https://nearblocks.io/txns/37kXzVrNWZPsQgsdtapqqUJsEnqehgr67X6PGcs8oWXH), replay [`5KnaCz9Y…`](https://nearblocks.io/txns/5KnaCz9YigwbPMdd3FsHEJtsmu3j1L1XDa8XwygxAqvs), tampered [`GnFVYt8Q…`](https://nearblocks.io/txns/GnFVYt8QaZRDbXahRNjb6CXKYazgXesTeEj9X4zBdrer) |
| 8. Non-custodial proof | the owner pauses, revokes the agent and recovers funds with the agent offline; the agent's withdrawal, policy rewrite and re-initialisation are refused | recover [`HYV5wZgu…`](https://nearblocks.io/txns/HYV5wZguKarjDCa7vLecytCj3iEFN8MMeneaYFmHvC91), agent refused [`4fNS56Bi…`](https://nearblocks.io/txns/4fNS56BiBpw83nf5cnLncgPcxkuEVcaQGe6j3HCSka9j) |
| 9. Field-level spoofing | a memo asking to be treated as payroll is recorded as the real vendor, priority normal | [`7jkpQ7sf…`](https://nearblocks.io/txns/7jkpQ7sffgkPGDBnkAmEABJVaPG94GwchT562xsP82GJ) |
| 10. Tiered friction | a new 0.04 vendor is accepted automatically; a new 0.90 vendor (Big Agency) is held for a signer | [`F4NBShNA…`](https://nearblocks.io/txns/F4NBShNAzev56ZHCKWH3ToFKt67NZWZDq3waxeEcwm6M) |

After the run, demo data was added without moving money, including a refused claim from someone who isn't on the team ([`B5i2Zv5s…`](https://nearblocks.io/txns/B5i2Zv5sTA9AGWBnCTzyat66zh18cD9Q6eywGU9sTtrt)). The ledger then: balance 0.88, set aside 0.805, free to spend 0.075, runway 34 days; Big Agency's 0.90 waits for a signer.

Re-run it yourself on a funded treasury: `NEAR_NETWORK=mainnet node scripts/judge.mjs`.

## NEAR spent

The founder sent **6 NEAR** to the funding account and **2 USDC** to `takara-ai-hq.near`.

| | NEAR |
|---|---|
| Sent in | 6.00000 |
| Still in the six accounts at 15:05 UTC (funding account 0.04256, owner 5.33328, agent 0.49639, signer 0.05, payroll 0.01, ana 0.01) | 5.94222 |
| **Used so far** (gas, OutLayer runs and secret storage, 3 × 0.00125 USDC storage deposits) | **0.05778** |

After the treasury deploy, at 15:13 UTC: 5.93085 NEAR remain across the seven accounts (treasury 3.78723, mostly locked as contract storage), so **0.06915 NEAR used in total**.

Most of what remains is not spent: it pays for account storage and comes back when the accounts are deleted after the demo. The treasury account locks about 3.8 NEAR as contract storage. On testnet the measured running cost for a small business is about $8 a month ([docs/mainnet-plan.md](mainnet-plan.md)).

## What's live, what's testnet-only, what's planned

| Feature | Mainnet | Testnet | Notes |
|---|---|---|---|
| Treasury contract: reserves, refusals with a reason, payout-change freeze and hold, owner pause and recovery | Live | Live | Same contract, same engine build |
| Policy engine in Intel TDX (OutLayer), attestation per decision | Live | Live | Smoke runs and 6/6 attestation above |
| Settlement pays the payee | Live | Live (test token) | `settle` checks the engine's one-time permit and the salted amount and payee opening, enforces a per-payment ceiling (`max_payout`, 1 USDC on mainnet), then sends the USDC to the NEAR payee with `ft_transfer`; a failed transfer reverts the settlement. Same contract on both networks |
| Ten security checks as real transactions | **10/10** ([run fa4a1a16](runs/judge-mainnet-2026-11-14-fa4a1a16.json)) | 9/10 on the current contract | Mainnet amounts are 1/1000 of testnet. The testnet failure (check 10) was an OutLayer `engine_error` while OutLayer's testnet was down; the 2026-11-12 testnet 10/10 ran on the previous contract build |
| Sealed books: reserves, signed policy, vendor registry, refusal reasons | Live | Live | Each NEAR payout shows its amount and payee on chain when it is paid; nothing else about the books is public |
| Owner view in the hosted app | Live | Live | The app has a Mainnet / Testnet switch once both are live |
| Private payouts through NEAR Intents 1Click (`confidentiality: "basic"`) | Planned | n/a (Intents has no testnet) | Quote, deposit and status flow are built and dry quotes are verified on mainnet; a confidential quote needs a 1Click partner key, which we don't have yet |
| Email intake | Script | Script | Works on saved email files; no live inbox. The sender check (DKIM) is modelled: intake trusts only our receiving server's `Authentication-Results` header |
| Invoice reading on NEAR AI Cloud | Not used | Not used | Attestation verification is built; parsing needs `NEAR_AI_API_KEY`, which isn't set, so the checks use a labelled offline parser |
| Agent key derived inside the enclave | Planned | Planned | Today the backend holds the agent key; the contract limits it to requesting engine decisions and settling what the engine issued |
| Real amounts | Tiny | Test tokens | About 1 USDC in the mainnet treasury. This is a demo of a fictional business, not a production deployment |

## Owner kill switch

The owner can stop the agent and take the money back at any time, with the agent offline and without OutLayer, from the owner account alone:

```bash
# stop all payments, or remove the agent's authority entirely
near contract call-function as-transaction treasury.takara-ai-hq.near pause json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as takara-ai-hq.near network-config mainnet sign-with-legacy-keychain send
near contract call-function as-transaction treasury.takara-ai-hq.near revoke_agent json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as takara-ai-hq.near network-config mainnet sign-with-legacy-keychain send

# withdraw USDC to the owner (amount in base units, 6 decimals); scripts/mainnet-usdc.mjs recover does the same
near contract call-function as-transaction treasury.takara-ai-hq.near recover json-args '{"amount":"<base units>","to":"takara-ai-hq.near"}' prepaid-gas '60.0 Tgas' attached-deposit '1 yoctoNEAR' sign-as takara-ai-hq.near network-config mainnet sign-with-legacy-keychain send
```

## Keys and the hosted app

- No signing key is on any server. Owner, signer and agent keys live only on the founder's machine (`.secrets/mainnet/`, git-ignored). Approvals and owner actions in the app are signed in the user's own NEAR wallet.
- The hosted owner view uses `TAKARA_ENGINE_SK_MAINNET`, the fixture business's ledger key (an x25519 sealing key that opens the sealed books). It cannot sign NEAR transactions. A real business would never put this key on a server; the demo does it only because the business is fictional.
