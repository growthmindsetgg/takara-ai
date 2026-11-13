# Review of the product structure v1

An independent strategy review (2026-11-13) of [Takara AI product structure v1](../Takara%20AI%20product%20structure%20v1.md)
against the built system, the frozen hackathon spec, [mainnet-plan.md](mainnet-plan.md) and
[security-audit.md](security-audit.md). Opinions are marked as such; nothing here is built for the hackathon.

**Short answer: yes, the structure makes the product better.** Its best decisions are
chat for exceptions and forms for routine work, one Commitment object, the approval queue,
offboarding, lapse rules and deferring the job board. Six decisions need changes so they
do not weaken the security or privacy model.

## Decisions

| Decision | Verdict | Why |
|---|---|---|
| Setup first, pay at first payout | Change | A treasury locks ~3.6 NEAR of storage. Run setup on an off-chain sealed ledger and deploy the contract at the paywall, so free signups cost nothing and cannot be farmed. |
| $59 / $149 / $468, no % fees | Change | Prefer auto-renew over prepaid terms (lapse by design). Cap volume per plan and pass route fees through at cost: at $500k/month the 1Click partner fee alone (~$50) exceeds the $39 plan. Say "fraud prevention", not "insurance" (no indemnity is offered). |
| Lapse rules, 14-day critical grace | Keep, widen | Cover every accepted commitment due within 14 days, not only `critical`. Security alerts never stop. |
| Named agent | Keep (low priority) | Avoid "Ledger": it is a hardware-wallet brand, the same collision the spec avoided with Takara Lend. |
| Chat for exceptions, forms for routine | Keep | The strongest decision in the doc. |
| Four roles | Change | Map roles onto the contract's three authorities. Manager approvals of vendors or destinations must be wallet signatures (passkeys), never backend clicks, or a compromised backend undoes check 5. Require two owner *keys*, not two owner *people*. |
| One Commitment object | Keep | Reimbursements need per-member limits first (currently roadmap). |
| Approval queue | Keep, extend | Add delegation and escalation by deadline (payroll due tomorrow, approver away). |
| Member address-change protection | Keep, extend | First-time address capture is the weak point: confirm with a small test transfer or an out-of-band check. |
| Offboarding | Keep | Settle the final payout before revoking the address. |
| Scoped receipts | Keep | Needs new engine ops (the engine refuses full reports under the TEE key). |
| Job board → milestone escrow | Keep, rename | "Milestone commitments": owner recovery means freelancers have no guarantee, and "escrow" has licensing meaning in some jurisdictions. |
| Shared vendor registry as moat | Change | Sharing who-pays-whom across companies breaks the privacy claim and invites sybil poisoning. Keep it private: keyed hashes inside the TEE, used as a warning signal only, never auto-verification. Incumbents (Trustpair, Eftsure, Bill.com network) sell this; it is a moat only at scale. |
| Build order, billing ninth | Change | No security phases. "The treasury layer is done" contradicts the 7 mainnet must-fix items. Pilots should be paid (letters of intent). |

## What the structure misses

- **Customer reality (opinion):** most small businesses hold bank dollars, not USDC. The realistic first customer is a crypto-native team paying 5–30 contractors in stablecoins. Approvals happen on phones; a Telegram button cannot sign. Someone must cover gas (a relayer).
- **Security:** forwarded invoices fail the vendor-DKIM rule (they arrive `sender_unverified`), so the four intake channels need trust tiers. Any manual fallback must be an owner multi-signature path. Role-scoped views need per-member encryption, or a shared backend holds plaintext salaries.
- **Confidentiality:** "public observers see no amounts" holds today but not under the enforced-payout design (amounts public at settlement). Stable `vendor_ref` plus payroll timing can expose salaries.
- **Regulatory (needs counsel):** execution authority may count as control under money-transmission rules (FinCEN, MiCA); crypto wages hit withholding and legal-tender rules; GDPR processor duties (DPA, subprocessors NEAR AI / OutLayer / Telegram); amounts in Telegram alerts leak salary data; sealed salary data on a public chain cannot be erased; sanctions screening is missing.
- **Unit economics:** ~$39 price vs ~$8/month measured running cost ≈ 80% gross margin before support, mail infrastructure, screening and audits. Support will be the real cost.

## Improvements beyond the doc (ranked)

1. Deploy the treasury contract at the first payout; keep setup off-chain.
2. Employee payroll as a reserved invoice from a payroll provider (Deel, Gusto); pay contractors directly.
3. Bill the subscription from the treasury as a recurring commitment the owner accepts (no expired cards).
4. Trust tiers per intake channel.
5. Every approval that touches money or a destination is a wallet signature.
6. New payee addresses confirmed by a small test transfer.
7. Sanctions screening of payees.
8. Plans capped by volume, route fees passed through at cost.

## Roadmap (security before features)

| Phase | Work | Done when |
|---|---|---|
| 0 | Design partners and legal scoping | 5 paid letters of intent; counsel memo on money transmission and payroll |
| 1 | Timelocked upgrade and key removal, agent key in enclave, multisig, balance sync, pruning, monitoring | No full-access key on the treasury; agent key never on backend disk; 2-of-N signers |
| 2 | Enforced payout with payee binding, sanctions screening, written confidentiality decision | A test proves a stolen agent key cannot redirect a payout |
| 3 | Roles mapped to authorities, signed approvals, per-member encryption, offboarding | A backend database dump reveals no colleague's pay and approves nothing |
| 4 | Dashboard, approval queue, CSV import, owner-signed manual fallback | A week runs without chat, and with the engine down |
| 5 | Inbound mail with DKIM, intake trust tiers | Vendor-sent invoices resolve automatically; forwarded ones stay unverified |
| 6 | Capped mainnet canary (~$1k per treasury) with partners | 4 weeks of real payouts with no unplanned manual fixes |
| 7 | External audit | Report published, all High findings fixed, caps lifted |
| 8 | Contractor cycles, setup interview, receipts, accounting export | A new company is live in 15 minutes |
| 9 | Billing from the treasury, lapse rules | A partner renews unprompted |
| 10–11 | Private shared registry, then milestone commitments | Registry warnings fire with no data shared in the clear |
