# Demo recording script (3 minutes)

For the founder. Updated 2026-11-14 for the new UI (Home, sidebar of six plus More, "Viewing as" at the sidebar foot, the guided tour, "Add funds" / "Approve anyway") and for the contract change that makes `settle` send the tokens.

**Figures are whatever the chain says when you record.** Read them off the screen; don't memorise them. This script names the parts of the equation ("in treasury", "settled", "set aside", "free to spend") rather than numbers, because every judge run and every seed changes them.

**Steps marked 🔑 need a wallet.** The other steps are read-only.

---

## Which network to record on

**Record on mainnet if it is live; otherwise on testnet.** "Live" means all of these are true:
- `treasury.takara-ai-hq.near` exists;
- the app's network switch shows **Mainnet** and opens on it by default;
- the seed's dry run (below) prints no `TODO` or `gap` lines except the ones listed as acceptable.

| | Mainnet (preferred) | Testnet (fallback) |
|---|---|---|
| Treasury | `treasury.takara-ai-hq.near` | `treasury.takara-ai-hq.testnet` |
| Signer for the Reject step | `signer.takara-ai-hq.near` | `signer.takara-ai-hq.testnet` |
| Amounts | Real USDC at 1/1000 of the testnet story (Payroll 0.60, Big Agency 0.90 and so on) | tUSDC at full size (Payroll 600, Big Agency 900) |
| Seed command | `NEAR_NETWORK=mainnet node scripts/seed-demo.mjs` | `node scripts/seed-demo.mjs` |

On mainnet the small amounts are the point: they are real USDC, and every settled payment is a real token transfer anyone can see on nearblocks.io. Say so once ("real USDC, kept small on purpose"), then talk in terms of the figures on screen.

---

## Preflight (10 minutes before recording)

1. **Seed the demo state (read-only check first).** On the network you chose, run the seed's dry run:
   - `node scripts/seed-demo.mjs` (testnet) or `NEAR_NETWORK=mainnet node scripts/seed-demo.mjs` (mainnet).
   - It prints the live figures, a checklist and a plan. Each line starting with `ok` is in place.
   - The demo needs: Payroll run, Railway, Inkwell and Tiny Logo **reserved**; one **Big Agency** bill **claimed** whose approval would overdraw; at least one **settled** payment to **Ana**; and the **Caught** refusals (payout change, hidden instructions, duplicate, reserve breach, a sender not on the team).
   - If there are `TODO` lines, re-run with `--execute`. The seed only claims, reserves (policy or Signer acceptance) and records one refusal. It never pays, so it can't move money.
   - If it prints a **Founder-run** block, that is a payment (it sends real tokens). Run it yourself only if you want it in the story.
   - Never run the seed while a judge run is in progress. It refuses to execute if the treasury had activity in the last 3 minutes.
2. **Top up gas.** The agent pays gas for claims and engine calls. Check its balance (`agent.takara-ai-hq.testnet` / `agent.takara-ai-hq.near`) and top it up from the owner if it is under about 1 NEAR, for example on testnet:
   `near tokens takara-ai-hq.testnet send-near agent.takara-ai-hq.testnet '2 NEAR' network-config testnet sign-with-legacy-keychain send`
   The Signer needs a little NEAR for the one signature below.
3. **Deploy what you reviewed.** Run `node scripts/build-platform.mjs` right before deploying, so the hosted activity log includes the judge run and the seed. The hosted app labels it "Activity as of <time of the latest entry>".
4. **Choose the surface.** Record on `https://takara-ai.vercel.app` (product page) and `/app` (the app). If Vercel is slow, run `node backend/server.mjs` and use `http://localhost:8787` instead. It's the same app, and its activity log updates live. To force a network, add `?network=mainnet` or `?network=testnet`.
5. **Wallet dry run 🔑.** The Reject step needs the Signer account for your network (table above) in one of these:
   - **Meteor** (recommended) or **MyNearWallet**, after you import the Signer key into it yourself;
   - **NEAR CLI** in the chooser. The key stays in your keychain: run the command it shows, with `sign-with-legacy-keychain`, then paste the transaction hash back.

   Allow popups for the app's site. Do one sign-in before recording. Owner actions would need the owner account, but the script doesn't use them.
6. **Clean browser.** Use a fresh window at 1280 × 800 or larger, with no extensions overlaying the page. Close Ask Banto. Set **Viewing as** (sidebar foot) to Owner.
7. **Tour and hints.** First-use hints pop once per page (Approvals, Money, Vendors, Alerts, Policy, Public view, a bill, Ask Banto). So that none pops mid-take:
   - Do one full dry run of the script in the recording browser (it marks every hint as seen; click "No thanks" on Ana's welcome card too). **Cancel in the wallet at step 10 during the dry run**, so Big Agency stays in the queue for the real take.
   - Then, to show the welcome card and tour at the start, open the browser console and run `localStorage.removeItem("takara.tour.v2.main")`, then reload. Only the Owner welcome card comes back.
   - `takaraHintReset()` brings back **every** hint as well as the tour. Use it only if you want the hints on camera.
   - If you skip the tour, run nothing: Home opens straight to the figures.
8. Have a terminal ready in the repo for the last step.

**Retakes:** once the Signer rejects Big Agency, it's closed. For another take, run the seed again with `--execute`: it claims a fresh Big Agency bill (a new invoice number, so it isn't refused as a duplicate).

---

## Script

| # | Time | Click | On screen | Voiceover (one line) |
|---|---|---|---|---|
| 1 | 0:00 | Product page, top | Headline "Never spend tomorrow's payroll on today's expenses". The Judge check 1 strip plays: Ana's request hits the protected line and is refused. | "Takara is a treasury agent for small businesses that can't spend the money you've set aside for payroll." |
| 2 | 0:10 | Scroll to **Proof on NEAR** | The live balance and the owner's equation: in treasury − settled − set aside = free to spend. | "These figures are read live from NEAR. Free to spend is what's left after every accepted bill." |
| 3 | 0:20 | **Open the app**. The welcome card shows: **Take a 30-second tour**, **Next** once, then **Skip** | Home. Tour step 1 "What needs you" points at Banto's line ("1 bill is waiting for a Signer's approval… you'd be … short"). Step 2 "Free to spend" points at the envelope strip. | "This is Banto. It reserves money for every bill you accept and pays only inside the policy you signed." |
| 4 | 0:32 | Home | Free to spend, the amount set aside for 4 bills, the envelope strip, Runway in days, the Caught for you count. | "One number matters: what's free to spend after every accepted bill." |
| 5 | 0:40 | Home: **How is this calculated?** | The equation with each figure's query. Read the **Settled** row as the app words it. | "Every figure is read from the chain. No model writes a number. Paid bills leave the treasury as real token transfers." |
| 6 | 0:53 | Home: the **Caught for you** tile (opens Reports › Caught), then the "Blocked: paying Ana …" row | The breakdown (payout change, hidden instructions, duplicate, reserve breaches), then the refusal: it would break money reserved for Payroll run and Railway. | "This is the refusal. Paying Ana would have broken payroll's envelope, so the policy engine said no, inside a TEE." |
| 7 | 1:07 | Sidebar: **Vendors**, then **Railway** | Payout change: the registered Railway account ≠ the `railway-new-bank` account the invoice asked for. "New address approved"; cooling-off status. | "An invoice tried to change Railway's bank account. Payment froze, a Signer approved it, and a 24-hour cooling-off runs before any money can go there." |
| 8 | 1:22 | Sidebar: **Approvals** 🔑 | "Needs you 1": Big Agency, new vendor above the auto-pay limit. "Approving now would leave you … short. Add funds first." Buttons: **Add funds** · **Approve anyway** · **Reject**. | "Anything above the limit waits for a Signer. And the app won't pretend there's money: approving this would overdraw, so it says so." |
| 9 | 1:32 | **Reject** on the Big Agency card (never Approve anyway), then **Choose wallet** in the pre-sheet 🔑 | The pre-sheet: "Approvals need the Signer on NEAR …". The chooser lists Meteor, MyNearWallet, Intear, NEAR CLI. Don't click the chooser's gear icon (it opens a developer settings screen). | "The page never holds a key. I connect the Signer's own wallet." |
| 10 | 1:45 | Sign in as the Signer. The app returns to the card and asks for a reason: type "Unknown agency, call us first", then **Continue**, then **Continue in wallet**, and confirm in the wallet 🔑 | The confirm box shows `close_commitment` on the treasury, 30 Tgas, no deposit. Then "Bill closed." with a transaction link. "Needs you" goes to 0 (the flagged Railway copies stay under "Banto is checking"), and Alerts › Recent shows the closed bill. | "One function call, shown in full, signed in my wallet. The contract checks who signed." |
| 11 | 2:00 | **Viewing as** (sidebar foot): **Member · Ana**, then **Alerts** in her sidebar | Ana's alerts: her request refused because it would break reserved money, then accepted and settled after a top-up, each with its transaction. My pay shows her settled total. | "Ana, a team member, sees only her own claims: received, refused with a reason, accepted, paid. Nothing about the company." |
| 12 | 2:15 | Ask Banto (Ctrl K), chip **"Was Ana reimbursed?"** | "Yes …" with the amounts and transaction links. | "Ask Banto answers from the ledger and links the transactions. It can't move money." |
| 13 | 2:25 | **Viewing as**: **Owner**, then type **"Why was the 400 payment blocked?"** (on mainnet: "Why was Ana's payment blocked?"; chips only show in a fresh conversation) | It names Payroll and Railway, and says the payment was settled later after a top-up. | "Every answer is a deterministic query over the books." |
| 14 | 2:33 | Sidebar: **More › Public view** | Commitments with states and hashes. "Public" (bill states, flags, hashes, total balance, and each payout's amount and payee once it's paid) next to "Sealed · TEE" (reserves, rules, vendor list, policy). | "This is what a stranger sees on-chain: hashes and attestations, and the payouts themselves. Reserves, rules and the vendor list stay sealed." |
| 15 | 2:43 | Terminal: run the attestation check | Testnet: `node scripts/verify-attestation.mjs 30883 dc3e7c5c406cea1872b338cfed59bb14ed37a422f5bb31486d02346f94a7f019 '{"request":"step0-onchain","treasury":"takara-ai-hq.testnet"}' '{"ok":true,"engine":"takara-ai-engine","step":0,"input_len":61,"echo":"request:step0-onchaintreasury:takara-ai-hq.testnet"}'` prints 6 of 6 checks passing. Mainnet: `NEAR_NETWORK=mainnet node scripts/verify-attestation.mjs 3580 bc7a4694e92381b384865734a045a15e6f5f7cb785b229f84e37a71ff823caeb '{"v":1,"op":"pubkey"}' '<exact output from fixtures/mainnet/setup-progress.json, smoke.secret-read-direct.value>'` (the setup record notes 6/6 PASS; rehearse it once before recording). | "And you don't have to trust me: anyone can verify the Intel TDX attestation of the engine's decisions." |
| 16 | 2:55 | Back to the product page | | "Takara: an agent that keeps your books and can't take your money." |

---

## If step 10 can't be done live

**Option A: cancel in the wallet.** The app says "You cancelled in the wallet. Nothing was sent." That still shows the full flow, and Big Agency stays in the queue for the judges who come later.

**Option B: use any account on the same network.**
- Pick **Approve anyway**, then **Try anyway as …**. The contract refuses with `E_NOT_POLICY_SIGNER`, and the app shows "The contract refused".
- Voiceover: "Anyone else is refused by the contract itself."
- This costs a little gas from that account.

**Why not "Approve anyway"?** Approving Big Agency as the Signer works on-chain, but it reserves more than is free to spend. The treasury then reads "Short by …" for everyone until the owner adds funds. That's why the script rejects it instead. **Add funds** only opens an explanation (Preview); nothing moves. If it does get approved by mistake, the seed's dry run says so; have the Signer reject it in the app, then re-run the seed.

**Get started** is hidden from the sidebar once all six setup steps are done. If you want it on camera, open `/app#/start` (or `localhost:8787/#/start`); it shows how many documents came in, how many became bills and how many were refused at intake.

## Don't show or claim

- **That the app holds keys or moves money by itself.** Payments are settled by the agent only inside a TEE-issued authorization; the seed and the video never pay anything.
- **"No tokens move on testnet."** That was true before 2026-11-14. The contract now sends the tokens on `settle` on both networks. If the app's copy still says "no tokens move" on the network you record, don't read that line out.
- **Buying a plan, adding teammates, payroll setup, weekly per-person payroll, or alert delivery.** Each is labelled Preview. A click explains it and changes nothing. Adding a teammate means a Signer signs a new policy version.
- **Nightly or Ledger.** They were removed from the chooser.
