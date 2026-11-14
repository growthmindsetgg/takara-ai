# Demo recording script (3 minutes)

For the founder. Updated 2026-11-14 for the new UI (Home, sidebar of six plus More, "Viewing as" at the sidebar foot, the guided tour, "Add funds" / "Approve anyway"). Everything below is live on NEAR testnet or clearly labelled preview. Figures are whatever the chain says when you record. At the time of writing they were 1,400.00 in treasury − 577.50 settled − 805.00 set aside = **17.50 USDC free to spend**, runway 32 days. Read them off the screen; don't memorise them.

**Steps marked 🔑 need a wallet.** The other steps are read-only.

---

## Preflight (10 minutes before recording)

1. **Top up the agent's gas.** `agent.takara-ai-hq.testnet` has about **0.585 testnet NEAR**. A full judge run spends roughly 0.17 NEAR, so send it 2 to 3 testnet NEAR from the owner, for example:
   `near tokens takara-ai-hq.testnet send-near agent.takara-ai-hq.testnet '2 NEAR' network-config testnet sign-with-legacy-keychain send`
   The faucet works too. This pass did not move any funds. The Signer (`signer.takara-ai-hq.testnet`) has about 0.30 NEAR, which is enough for the one signature below.
2. **Deploy what you reviewed.** Run `node scripts/build-platform.mjs` once more right before deploying, so the hosted activity log is current. The hosted app labels it "Activity as of <time of the latest entry>".
3. **Choose the surface.** Record on `https://takara-ai.vercel.app` (product page) and `/app` (the app). If Vercel is slow, run `node backend/server.mjs` and use `http://localhost:8787` instead. It's the same app, and its activity log updates live.
4. **Wallet dry run 🔑.** The approval step needs the Signer account **`signer.takara-ai-hq.testnet`** in one of these:
   - **Meteor** (recommended) or **MyNearWallet**, after you import the Signer key into it yourself;
   - **NEAR CLI** in the chooser. The key stays in your keychain: run the command it shows, with `sign-with-legacy-keychain`, then paste the transaction hash back.

   Allow popups for the app's site. Do one sign-in before recording. Owner actions would need `takara-ai-hq.testnet`, but the script doesn't use them.
5. **Clean browser.** Use a fresh window at 1280 × 800 or larger, with no extensions overlaying the page. Close Ask Banto. Set **Viewing as** (sidebar foot) to Owner.
6. **Tour and hints.** First-use hints pop once per page (Approvals, Money, Vendors, Alerts, Policy, Public view, a bill, Ask Banto). So that none pops mid-take:
   - Do one full dry run of the script in the recording browser (it marks every hint as seen; click "No thanks" on Ana's welcome card too).
   - Then, to show the welcome card and tour at the start, open the browser console and run `localStorage.removeItem("takara.tour.v2.main")`, then reload. Only the Owner welcome card comes back.
   - `takaraHintReset()` brings back **every** hint as well as the tour. Use it only if you want the hints on camera.
   - If you skip the tour, run nothing: Home opens straight to the figures.
7. Have a terminal ready in the repo for the last step.

---

## Script

| # | Time | Click | On screen | Voiceover (one line) |
|---|---|---|---|---|
| 1 | 0:00 | Product page, top | Headline "Never spend tomorrow's payroll on today's expenses". The Judge check 1 strip plays: Ana's 400 hits the protected line and is refused. | "Takara is a treasury agent for small businesses that can't spend the money you've set aside for payroll." |
| 2 | 0:10 | Scroll to **Proof on NEAR testnet** | Live balance 1,400 USDC. The owner's equation: 1,400.00 in treasury − 577.50 settled − 805.00 set aside = 17.50 free to spend. | "These figures are read live from NEAR testnet. Free to spend is what's left after every accepted bill." |
| 3 | 0:20 | **Open the app**. The welcome card shows: **Take a 30-second tour**, **Next** once, then **Skip** | Home. Tour step 1 "What needs you" points at Banto's line ("1 bill is waiting for a Signer's approval… you'd be 882.50 USDC short"). Step 2 "Free to spend" points at the envelope strip. | "This is Banto. It reserves money for every bill you accept and pays only inside the policy you signed." |
| 4 | 0:32 | Home | Free to spend 17.50 USDC, 805.00 set aside for 4 bills, the envelope strip, Runway 32 days, Caught for you 6. | "One number matters: what's free to spend after every accepted bill." |
| 5 | 0:40 | Home: **How is this calculated?** | 1,400.00 in treasury − 577.50 settled − 805.00 set aside = 17.50 free to spend, each figure with its query. The Settled row: "Bills marked paid on the ledger. Testnet: no tokens move." | "Every figure is read from the chain. No model writes a number. Settled means recorded on the ledger; real payouts are the mainnet NEAR Intents run." |
| 6 | 0:53 | Home: the **Caught for you** tile (opens Reports › Caught), then the "Blocked: paying Ana 400.00 USDC…" row | The breakdown (payout change, hidden instructions, duplicate, reserve breaches), then the refusal: it would break money reserved for Payroll run and Railway. | "This is the refusal. Paying Ana would have broken payroll's envelope, so the policy engine said no, inside a TEE." |
| 7 | 1:07 | Sidebar: **Vendors**, then **Railway** | Payout change: `railway-pay.testnet` ≠ `railway-new-bank.testnet`. "New address approved"; "Approved, cooling-off ended." | "An invoice tried to change Railway's bank account. Payment froze, a Signer approved it, and a 24-hour cooling-off ran before any money could go there." |
| 8 | 1:22 | Sidebar: **Approvals** 🔑 | "Needs you 1": Bigagency 900.00 USDC, new vendor above the 500.00 auto-pay limit. "Approving now would leave you 882.50 USDC short. Add funds first." Buttons: **Add funds** · **Approve anyway** · **Reject**. | "Anything above the limit waits for a Signer. And the app won't pretend there's money: approving this would overdraw, so it says so." |
| 9 | 1:32 | **Reject** on the Bigagency card (never Approve anyway), then **Choose wallet** in the pre-sheet 🔑 | The pre-sheet: "Approvals need `signer.takara-ai-hq.testnet` on NEAR testnet." The chooser lists Meteor, MyNearWallet, Intear, NEAR CLI. Don't click the chooser's gear icon (it opens a developer settings screen). | "The page never holds a key. I connect the Signer's own wallet." |
| 10 | 1:45 | Sign in as `signer.takara-ai-hq.testnet`. The app returns to the card and asks for a reason: type "Unknown agency, call us first", then **Continue**, then **Continue in wallet**, and confirm in the wallet 🔑 | The confirm box shows `close_commitment` on `treasury.takara-ai-hq.testnet`, 30 Tgas, no deposit. Then "Bill closed." with a transaction link. "Needs you" goes to 0 (the two Railway copies stay under "Banto is checking"), and Alerts › Recent shows the closed bill. | "One function call, shown in full, signed in my wallet. The contract checks who signed." |
| 11 | 2:00 | **Viewing as** (sidebar foot): **Member · Ana**, then **Alerts** in her sidebar | Ana's alerts: "Settled: your reimbursement of 12.50 USDC", accepted by a Signer, held because it would have gone below the company's minimum runway, claim received, each with its transaction. My pay shows 412.50 USDC total. | "Ana, a team member, sees only her own claims: received, refused with a reason, accepted, paid. Nothing about the company." |
| 12 | 2:15 | Ask Banto (Ctrl K), chip **"Was Ana reimbursed?"** | "Yes. Ana was reimbursed twice, 412.50 USDC in total…", with transaction links. | "Ask Banto answers from the ledger and links the transactions. It can't move money." |
| 13 | 2:25 | **Viewing as**: **Owner**, then type **"Why was the 400 payment blocked?"** (chips only show in a fresh conversation) | It names Payroll and Railway, and says the bill was settled later after a top-up. | "Every answer is a deterministic query over the books." |
| 14 | 2:33 | Sidebar: **More › Public view** | Commitments with states and hashes only. "Public" (bill states, flags, hashes, total balance) next to "Sealed · TEE" (names, amounts, payout addresses, policy). | "This is what a stranger sees on-chain: hashes and attestations. Names, amounts and destinations stay sealed." |
| 15 | 2:43 | Terminal: run the attestation check | `node scripts/verify-attestation.mjs 30883 dc3e7c5c406cea1872b338cfed59bb14ed37a422f5bb31486d02346f94a7f019 '{"request":"step0-onchain","treasury":"takara-ai-hq.testnet"}' '{"ok":true,"engine":"takara-ai-engine","step":0,"input_len":61,"echo":"request:step0-onchaintreasury:takara-ai-hq.testnet"}'` prints 6 of 6 checks passing. | "And you don't have to trust me: anyone can verify the Intel TDX attestation of the engine's decisions." |
| 16 | 2:55 | Back to the product page | | "Takara: an agent that keeps your books and can't take your money." |

---

## If step 10 can't be done live

**Option A: cancel in the wallet.** The app says "You cancelled in the wallet. Nothing was sent." That still shows the full flow, and Bigagency stays in the queue for the judges who come later.

**Option B: use any testnet account.**
- Pick **Approve anyway**, then **Try anyway as …**. The contract refuses with `E_NOT_POLICY_SIGNER`, and the app shows "The contract refused".
- Voiceover: "Anyone else is refused by the contract itself."
- This costs a little gas from that account.

**Why not "Approve anyway"?** Approving Bigagency as the Signer works on-chain, but it reserves 900 against 17.50 free to spend. The treasury then reads "Short by 882.50" for everyone until the owner adds funds. That's why the script rejects it instead. **Add funds** only opens an explanation (Preview); nothing moves.

**Get started** is hidden from the sidebar once all six setup steps are done. If you want it on camera, open `/app#/start` (or `localhost:8787/#/start`); it now reads "17 documents in · 13 bills, 3 refused at intake".

## Don't show or claim

- **Tokens moving on testnet.** Settlement is ledger-only. Real payouts are the mainnet 1Click demonstration.
- **Buying a plan, adding teammates, payroll setup, weekly per-person payroll, or alert delivery.** Each is labelled Preview. A click explains it and changes nothing. Adding a teammate means a Signer signs a new policy version.
- **Nightly or Ledger.** They were removed from the chooser.
