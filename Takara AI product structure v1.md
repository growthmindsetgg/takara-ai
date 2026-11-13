# Takara AI: product structure v1

Nov 12, 2026 · @Kurogane

This is the product after the hackathon, written in the order an owner meets it. The hackathon spec is unchanged and frozen; nothing here is built this weekend.

## The flow

One change to your sequence, and it is the most valuable optimization in this document: do not put the paywall at the front.

Your order was plans, buy, dashboard, agent, setup. That asks someone to pay before they know what they are buying, for a product whose value is invisible until it has their data in it. Invert it. Let them sign up, run the setup interview, add their team and vendors, forward a few invoices, and see their real reserved and spendable numbers. Charge at the first payout.

By then the agent knows their business, the dashboard is populated, and they are looking at a runway figure they did not have an hour ago. That is the moment someone pays, and the setup work is itself the switching cost.

| Step | What the owner does | What they get |
| --- | --- | --- |
| 1 | Sign up, connect or create a treasury | An empty treasury they own |
| 2 | Setup interview with the agent, about ten questions | A policy to review and sign |
| 3 | Add team and vendors, by chat, form or CSV | A populated dashboard |
| 4 | Forward a few invoices | Reserved, spendable and runway, computed from their real bills |
| 5 | First payout | Paywall. Pick a plan |
| 6 | Daily operation | Alerts, approvals, payouts, reports |

Everything before step 5 is free and unlimited in time. You are not giving away the product, you are giving away the setup, and the setup is what makes the product sticky.

## Buying the agent

Three durations as you planned, priced so the annual plan is the obvious choice.

| Plan | Price | Note |
| --- | --- | --- |
| 1 month | $59 | The try-it price. Deliberately not the best value |
| 3 months | $149 | $50 a month |
| 12 months | $468 | $39 a month, two months free, and it is the one most will take |

Sell it as fraud insurance, not as automation. "$39 a month so one fake invoice never costs you $8,000" lands with a founder. "Automate your reimbursements" does not, because they are already doing that for free in a spreadsheet and they do not value their own time correctly.

No percentage of treasury and no fee on payroll volume. Businesses hate both, and a percentage fee on payroll makes you look like you are taxing their payroll, which is the one expense nobody accepts friction on.

**When the plan lapses, the rules are absolute and belong on the pricing page in plain words.**

- The treasury is theirs. Funds are always withdrawable, with your servers, the enclave and the agent all switched off. This is the owner recovery path, which exists already.
- Records are always exportable. Commitments, vendors, receipts and history, continuously, not on request.
- What stops: the agent stops taking invoices, authorizing payments and sending alerts.
- Grace period: payroll and anything marked `critical` still settles for 14 days after lapse. Everything else freezes immediately.
- Warnings at 14, 7 and 1 days, each one naming exactly which obligations will go unpaid.

That grace period is cheap to build and it is the difference between a churned customer and a founder whose payroll failed because their card expired.

## The agent

Naming it is worth building. People trust something they named, and an agent called Ledger that belongs to this company is treated differently from "the AI." Name, short description, avatar. Cheap, and it does real work on adoption.

**The setup interview.** Ten questions, no more, each one producing a field in the policy. Think of it as a form that happens to be conversational, not a conversation that happens to produce a form.

1. What does the company do, and how many people
2. Does Takara handle payroll, or only bills and reimbursements
3. Who are the owners, meaning who can revoke and recover
4. Who approves spending above the limit
5. What is the largest payment the agent may make without asking
6. What is the minimum runway to protect, in days
7. Which recurring services do you pay for, with amounts and dates
8. Who gets paid regularly, on what chain and token
9. Where should alerts go: Telegram, email or both
10. Anything the agent must never do

The answers become a policy diff the owner reviews and signs. Every field stays editable by hand afterwards, without talking to the agent, which matters because people change settings in a hurry and do not want a conversation about it.

**The rule for chat versus forms, which decides whether this product is used daily.**

Chat is for setup, questions and exceptions. "Why was the 400 payment blocked?" "Can we afford another contractor at 2,000 a month?" "Show me what renews next month." These are good in chat because the question varies every time.

Forms and buttons are for repeated actions. Approve, reject, pay, add member, change a limit. Nobody wants to type a sentence to approve the seventh invoice of the week, and products that force chat onto routine work get abandoned around week three.

So: a chat box that is always there, and a dashboard where every routine action is one click. Not one or the other.

## People

Four roles. Name them explicitly, because every confidentiality rule in this product depends on which one you are.

| Role | Can do | Cannot do |
| --- | --- | --- |
| Owner | Everything a manager can, plus sign policy, revoke the agent, recover funds | Nothing is above them. There must be at least two |
| Manager | Approve members and vendors, set budgets, approve or reject payments, final say on spending | Sign a new policy, recover funds, remove an owner |
| Member | Submit invoices and reimbursement claims, set their own payout chain and address, see their own payments | See anyone else's pay, approve anything, see company totals |
| Auditor | Read-only, scoped to a date range you grant | Change anything, see beyond the granted scope |

**Joining.** The manager invites by email or link. The member sets their payout chain, token and address themselves, and the manager approves that address once. After approval, the address is in the vendor-style registry: a change to it later triggers the same freeze, signer approval and cooling-off as a vendor destination change. This matters, because an attacker who compromises a contractor's account will try exactly this.

**Leaving.** You did not have this and it is the one most products forget. Offboarding must, in one action: revoke the payout address, resolve or cancel pending claims, end recurring commitments for that person, cut access, and keep their historical records for the auditor. A member who leaves and whose address stays live is a standing liability.

**Bulk.** CSV import for members and vendors. Nobody types thirty contractors into a chat box, and the first thing a real customer will ask is whether they have to.

## Money

Four things that look different to the user and are one object underneath. That is what keeps the product from sprawling.

| What the user calls it | What it is | Recurrence | Who raises it |
| --- | --- | --- | --- |
| Vendor invoice | Commitment | One-off | Forwarded, or entered by a manager |
| Subscription | Commitment | Monthly or annual | Detected from the renewal notice |
| Payroll | Commitment | Every cycle, `critical` | Set once at onboarding |
| Reimbursement | Commitment with a member as the payee | One-off | Raised by the member |

All four flow through the same states: `claimed`, then `accepted` which reserves the money, then `settled`, then `closed`. Only `accepted` reduces spendable balance. Receiving a document never creates an obligation, which is what stops anyone creating fake commitments by sending invoices.

**Four ways in, because people work differently.** Forward an email to the company's Takara address. Upload a file. Tell the agent in chat. Fill a form. A manager can enter anything by hand at any point, including things the agent never saw.

**Payouts.** Each member and vendor stores a preferred chain and token. The business thinks in dollars and obligations; Takara handles routing, fees and settlement. When a route is unavailable or uneconomic, say so rather than silently taking a worse one.

**Reimbursements deserve the detail**, because they are the daily annoyance that gets people to open the product. A member pays Figma on a personal card, forwards the receipt, and the money is back in their wallet on the chain they use, without a DM to the founder and without anyone else learning what they spent.

## Alerts and approvals

Alerts go where the team already is: a Telegram bot, email, or both, set per company and per person. Not a notification bell nobody checks.

| Alert | When | Who |
| --- | --- | --- |
| Renewal approaching | 7 days before, and again at 1 day | Manager |
| Shortfall predicted | As soon as committed exceeds available | Owner and manager |
| Destination change | Immediately, payment already frozen | Owner and manager, both |
| Approval waiting | On arrival, then daily while it sits | The approver |
| Payment settled | On settlement | The payee only |
| Plan lapsing | 14, 7 and 1 days | Owner |

Every alert carries the amount, the deadline and one action. An alert that only says something happened makes people stop reading alerts.

**The approval queue** is the thing you were missing and it is where a manager lives. One list: everything waiting, who it is waiting on, how long it has waited, and what it blocks. Approve or reject in one click, with a required reason on reject so the member learns something.

Anything above `max_auto_pay` lands here. So does every new vendor above the auto limit, every destination change, and every claim that breaks a budget. Nothing in the product should ever be silently stuck somewhere that is not this queue.

## Confidentiality

You were right that salaries must be private. Be precise about from whom, or you will promise something you cannot deliver.

| Who | Sees |
| --- | --- |
| Member | Their own pay, their own claims, their own receipts. Nothing about any colleague |
| Manager | Everything they set, which includes all salaries, because they approve them |
| Owner | Everything |
| Auditor | Everything inside the granted date range, nothing outside it |
| Public chain observer | Commitments, hashes and attestations. No names, no amounts, no destinations |

So payroll is confidential member-to-member, not confidential from management. That is also how every payroll system works, and saying it plainly is better than implying more.

If a company wants salaries hidden even from a manager, that is a separate role, a payroll administrator, with approval rights but no visibility into other categories. Worth building later for larger teams; not v1.

**Scoped receipts** are the piece that makes this sellable rather than merely secretive. A contractor can prove to a third party that they were paid, without revealing anyone else's line. An accountant gets a date range. A grant sponsor gets proof their money stayed inside the envelope they funded, and nothing else. Each is a signed receipt scoped to one party, not a window into the ledger.

## The freelancer job board

Good idea, wrong release. Posting a job, sourcing a freelancer, judging that the work is done and releasing funds is a second product sitting inside the first.

The phrase "once the work is done" hides the whole problem. Who decides it is done? What happens when the manager says no and the freelancer says yes? Every escrow product lives or dies on that question, and answering it badly costs you money and reputation rather than just a feature.

It also moves you into a different track and a different competitor set: Upwork, Braintrust, every crypto bounty board. Those are marketplaces, and marketplaces need supply before they are worth anything. You would be starting a liquidity problem on top of a treasury product.

**What has to be solved before it ships.**

- Acceptance: a definition of done written into the job at posting time, not argued afterwards
- Dispute path: who arbitrates, on what evidence, and what happens to the money while they decide
- Partial delivery and partial release
- Freelancer identity, so the same person cannot reappear after a bad outcome
- Where the supply comes from, which is the hardest of the five

**The v1.5 version that gets most of the value with none of the problems:** milestone escrow for someone the manager already chose. The manager names the freelancer, the amount and the milestones. Takara reserves the funds, the manager releases each milestone with one click, and the agent handles payout on the freelancer's chain. No sourcing, no marketplace, no arbitration. It is a commitment with a release condition, which your data model already supports.

Build that. Revisit sourcing once there are enough companies on the platform that supply might come from the network itself.

## What was missing

Nine additions, roughly in order of how much they matter.

1. **The shared vendor registry.** The only real moat here. Every business that verifies a vendor strengthens the registry for all the others, so the hundredth customer is protected on day one with no setup, and a destination change seen anywhere warns everyone. Make it free, not premium: it is what makes the product spread.
2. **Lapse behavior.** Covered above. Existential, and it belongs on the pricing page.
3. **Offboarding.** You had joining but not leaving.
4. **The approval queue.** Approvals were implied but had nowhere to live.
5. **Manual fallback.** When the model or the enclave is down, owners and managers must still approve and pay. A system that stops paying payroll during a vendor outage gets uninstalled that week.
6. **Accounting export.** QuickBooks, Xero, and plain CSV. The accountant is never the buyer and always the blocker.
7. **Incoming money.** Client invoices and expected revenue, with `expected`, `invoiced`, `confirmed`, `received` states, and never counting unreceived money as spendable. Without it the agent can tell you that you are short but never that you are fine.
8. **Fiat edges.** Most real vendors do not take USDC. An off-ramp partner is the difference between a crypto-team tool and a small-business tool. A partnership, not a build.
9. **Prevention counter.** Instrument from day one how many destination changes and duplicates were caught. After a year that number is your best marketing asset, and it cannot be backfilled.

## Build order

The treasury layer is done. Everything below assumes it.

| Phase | Build | Done when |
| --- | --- | --- |
| 1 | Accounts, companies, the four roles, invitations and offboarding | A second person can join a company and be paid |
| 2 | Dashboard: reserved, spendable, runway, commitments, approval queue | A manager can run a week without the chat |
| 3 | Members and vendors, with CSV import and address-change protection | Thirty contractors onboard in ten minutes |
| 4 | Invoice intake by email, upload, chat and form | Four ways in, one commitment out |
| 5 | Payroll as recurring commitments | A cycle runs without anyone touching it |
| 6 | Alerts via Telegram and email | Someone finds out before something lapses |
| 7 | Setup interview and the read-only chat | A new company is live in fifteen minutes |
| 8 | Scoped reports and receipts, accounting export | An accountant signs off without asking a question |
| 9 | Billing and plans | Someone pays |
| 10 | Shared vendor registry across companies | A new customer is protected on day one |
| 11 | Milestone escrow for a chosen freelancer | Funds release per milestone, no marketplace |

**Billing is ninth on purpose.** Get five design partners from the communities you already run, before writing payment code. Let them use it free while phases 1 to 8 land, and charge only when someone asks how. Design partners who were there early also become the vendor registry's first entries, which is what makes phase 10 worth anything.

The one thing to protect through all of it: non-custodial. Never hold customer funds, not for netting, not for a moment. The day you pool funds you stop being a software company and start being a licensing project.
