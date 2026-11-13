# Demo recording script (3 minutes)

For the founder, to record right after the 2026-11-13 pre-demo pass. Everything below is live on NEAR testnet or clearly labelled preview. Figures are whatever the chain says when you record. At the time of writing they were 1,400 in treasury − 577.5 settled − 805 reserved = **17.5 USDC spendable**, runway 32 days. Read them off the screen; don't memorise them.

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
5. **Clean browser.** Use a fresh window at 1280 × 800 or larger, with no extensions overlaying the page. Close Ask Banto. Set Viewing as: Owner.
6. Have a terminal ready in the repo for the last step.

---

## Script

| # | Time | Click | On screen | Voiceover (one line) |
|---|---|---|---|---|
| 1 | 0:00 | Product page, top | Headline "Never spend tomorrow's payroll on today's expenses". The Judge check 1 strip plays: Ana's 400 hits the protected line and is refused. | "Takara is a treasury agent for small businesses that can't spend the money you've set aside for payroll." |
| 2 | 0:10 | Scroll to **Proof on NEAR testnet** | Live balance 1,400 USDC. The owner's equation: in treasury − settled − reserved = spendable. | "These figures are read live from NEAR testnet. Spendable is what's left after every accepted bill." |
| 3 | 0:20 | **Open the app** | Overview: Banto's line ("Bigagency's 900 USDC bill needs you"), Spendable now, the envelope strip, runway, and Caught for you. | "This is Banto. It reserves money for every bill you accept and pays only inside the policy you signed." |
| 4 | 0:32 | Sidebar: **Get started** | Six done steps, the last ones live: 17 documents in, 13 bills recorded, 3 refused, 1 not processed. | "Every step here comes from the chain: who owns the treasury, the signed policy, every document Banto received." |
| 5 | 0:42 | Overview: **How is this calculated?** | Each figure with its query, plus the settled line: "Testnet: no tokens move; payouts run through NEAR Intents on mainnet." | "No model writes a number. Settled means recorded on the ledger; real payouts are the mainnet NEAR Intents run." |
| 6 | 0:55 | Sidebar: **Reports & receipts**, then the first "Blocked: paying Ana 400 USDC…" row | The refusal story: blocked because it would break money reserved for Payroll and Railway. | "This is the refusal. Paying Ana would have broken payroll's envelope, so the policy engine said no, inside a TEE." |
| 7 | 1:07 | Sidebar: **Vendors**, then **Railway** | Payout change: `railway-pay.testnet` ≠ `railway-new-bank.testnet`. "New address approved"; the cooling-off ended at a time shown in your time zone. | "An invoice tried to change Railway's bank account. Payment froze, a Signer approved it, and a 24-hour cooling-off ran before any money could go there." |
| 8 | 1:22 | Sidebar: **Approvals** 🔑 | "Needs you 1": Bigagency 900 USDC, the first bill from a new vendor, above the 500 auto-pay limit. Who approves: `signer.takara-ai-hq.testnet`. | "Anything above the limit waits for a Signer. Banto can't accept it by itself." |
| 9 | 1:32 | **Reject** on the Bigagency card, then **Choose wallet** in the pre-sheet 🔑 | The pre-sheet: "Approvals need `signer.takara-ai-hq.testnet` on NEAR testnet." The chooser lists Meteor, MyNearWallet, Intear, NEAR CLI. | "The page never holds a key. I connect the Signer's own wallet." |
| 10 | 1:45 | Sign in as `signer.takara-ai-hq.testnet`. The app returns to the card and asks for a reason: type "Unknown agency, call us first", then **Continue**, then **Continue in wallet**, and confirm in the wallet 🔑 | The confirm box shows `close_commitment` on `treasury.takara-ai-hq.testnet`, 30 Tgas, no deposit. Then "Bill closed." with a transaction link. "Needs you" goes to 0 (the two Railway copies stay under Pending check), and Alerts › Recent events shows "Closed: Bigagency, 900 USDC". | "One function call, shown in full, signed in my wallet. The contract checks who signed." |
| 11 | 2:00 | Viewing as: **Member · Ana**, then the **Alerts** tab | Sent to Ana: paid (settled) 12.5, accepted by a Signer, not accepted automatically because of the minimum runway, claim received, each with its transaction. My pay shows the latest. | "Ana, a team member, sees only her own claims: received, refused with a reason, accepted, paid. Nothing about the company." |
| 12 | 2:15 | Ask Banto (Ctrl K), chip **"Was Ana reimbursed?"** | "Yes. Ana was reimbursed twice, 412.5 USDC in total…", with transaction links. | "Ask Banto answers from the ledger and links the transactions. It can't move money." |
| 13 | 2:25 | Viewing as: **Owner**, chip **"Why was the 400 payment blocked?"** | It names Payroll and Railway, and says the bill was settled later after a top-up. | "Every answer is a deterministic query over the books." |
| 14 | 2:33 | Sidebar: **Public view** | Commitments with states and hashes only. "Visible on-chain" next to "Sealed · TEE" (names, amounts, destinations). | "This is what a stranger sees on-chain: hashes and attestations. Names, amounts and destinations stay sealed." |
| 15 | 2:43 | Terminal: run the attestation check | `node scripts/verify-attestation.mjs 30883 dc3e7c5c406cea1872b338cfed59bb14ed37a422f5bb31486d02346f94a7f019 '{"request":"step0-onchain","treasury":"takara-ai-hq.testnet"}' '{"ok":true,"engine":"takara-ai-engine","step":0,"input_len":61,"echo":"request:step0-onchaintreasury:takara-ai-hq.testnet"}'` prints 6 of 6 checks passing. | "And you don't have to trust me: anyone can verify the Intel TDX attestation of the engine's decisions." |
| 16 | 2:55 | Back to the product page | | "Takara: an agent that keeps your books and can't take your money." |

---

## If step 10 can't be done live

**Option A: cancel in the wallet.** The app says "You cancelled in the wallet. Nothing was sent." That still shows the full flow, and Bigagency stays in the queue for the judges who come later.

**Option B: use any testnet account.**
- Pick **Approve**, then **Try anyway as …**. The contract refuses with `E_NOT_POLICY_SIGNER`, and the app shows "The contract refused".
- Voiceover: "Anyone else is refused by the contract itself."
- This costs a little gas from that account.

**Why not Approve?** Approving Bigagency as the Signer works on-chain, but it reserves 900 against 17.5 spendable. The treasury then reads "Short by 882.5" for everyone until the owner adds funds. That's why the script rejects it instead.

## Don't show or claim

- **Tokens moving on testnet.** Settlement is ledger-only. Real payouts are the mainnet 1Click demonstration.
- **Buying a plan, adding teammates, payroll setup, weekly per-person payroll, or alert delivery.** Each is labelled Preview. A click explains it and changes nothing. Adding a teammate means a Signer signs a new policy version.
- **Nightly or Ledger.** They were removed from the chooser.
