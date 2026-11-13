# Making the app embody the product structure

Plan, 2026-11-13. Source: [Takara AI product structure v1](../Takara%20AI%20product%20structure%20v1.md) (the "structure doc"), cross-checked against [product-review.md](product-review.md), [product-flow.md](product-flow.md), [ux/app-ux-spec.md](ux/app-ux-spec.md), [wallet-connect-plan.md](wallet-connect-plan.md), the code in `web/index.html`, `platform/lib/core.mjs` and `contract/src/lib.rs`, and the live app at https://takara-ai.vercel.app/app (every view and both drawers read on 2026-11-13).

**The problem in one paragraph.** Today's app is a well-made *treasury console*. It answers "what can I spend, what's waiting, what's due, what was caught", and its signer and owner actions are real wallet transactions. But it starts at the dashboard, and the structure doc's product starts with setup. The app has no named agent, no setup interview, no people or roles, no alerts, no plans or lapse rules, no receipts or export. The four kinds of money appear in one sentence of copy and nowhere else. An owner who reads the structure doc and then opens the app would not recognise it. This plan fixes that in about 10 hours. It keeps every live figure live, and it labels everything else as preview without making the app look like a mock-up.

**Ground rules for this build**

- **Live** means backed by data the app really has: the owner report (`/api/owner/report`: figures, commitments with vendor, amount, due day, state, priority, flags, destination, proposed destination, vendor-change status, recurrence, `accepted_by`), public state (`/api/public`: owners, signers, threshold, agent, paused, policy version and hash, engine, commitments, vendor changes), the decision log (`/api/decisions`), the policy (`/api/policy/current`: `max_auto_pay`, `cooling_off_hours`, `min_runway_days`), the diff and sign flow, read-only chat, and wallet roles.
- **Preview** means fictional sample data or an inert control. It is always labelled and never mixed into live totals.
- **The contract has three authorities.** Ownership (`owners`), policy (`policy.signers`, threshold 1) and execution (`agent`). There is no Manager, Member or Auditor on chain, no mail server, no Telegram and no billing. The app says so where it matters.
- **Review changes are adopted.** Say "fraud prevention", not insurance. Plans auto-renew. The grace period covers every accepted commitment due within 14 days, and security alerts never stop. Approvals that touch money or a destination are wallet signatures. "Two owners" means two owner *keys*. Say "milestone commitments", not escrow. The shared registry stays private and only ever warns. The agent is not named "Ledger".

---

## 1. Coverage table

Status: **Present** (the app does it), **Partial** (some of it, or the data without the experience), **Missing**. Evidence names the route and the visible element.

### 1.1 The flow

| # | Structure doc item | Status | Evidence in the current app |
|---|---|---|---|
| F1 | Setup first, paywall at first payout (order of the whole product) | Missing | The app opens on `#/overview` with a populated dashboard. There is no first-run state, no setup progress and no paywall moment |
| F2 | Step 1: sign up, connect or create a treasury | Partial | Sidebar **Connect wallet** works (near-connect, role read from the contract). No sign-up, no company, no "create treasury" (a CLI, `scripts/setup-testnet.mjs`, does that today) |
| F3 | Step 2: setup interview → policy to review and sign | Partial | `#/policy` **Current limits** form (3 fields) → **Preview change** → diff dialog → **Sign with wallet** (policy signer). No interview |
| F4 | Step 3: add team and vendors by chat, form or CSV | Missing | `#/vendors` "Vendors & team" is read-only. No add, invite or import |
| F5 | Step 4: forward invoices → reserved, spendable, runway from real bills | Partial | The numbers are live (Overview hero: 75 of 1,400 USDC spendable, 805 reserved, 34 days runway). There is no intake surface. Intake exists only as a backend CLI over `.eml` bytes |
| F6 | Step 5: first payout = paywall, pick a plan | Missing | No plan, price or billing anywhere |
| F7 | Step 6: daily operation (alerts, approvals, payouts, reports) | Partial | Approvals queue and Activity are present. No alerts, no reports or receipts, no export |

### 1.2 Buying the agent

| # | Item | Status | Evidence |
|---|---|---|---|
| B1 | Three plans: $59 / $149 / $468 | Missing | Not in the app or on the product page (`site/index.html` has no pricing) |
| B2 | Sold as fraud protection ("$39 a month so one fake invoice never costs you $8,000") | Missing | Overview **Caught for you 12** is the right proof point, but it is never tied to a price |
| B3 | No percentage of treasury, no payroll fee | Missing | Not stated |
| B4 | Lapse: treasury always withdrawable with everything switched off | Partial | `#/policy` **Owner controls → Recover funds** ("works even when the agent is offline") is live. It is not framed as the lapse guarantee |
| B5 | Lapse: records always exportable | Missing | No export of any kind |
| B6 | Lapse: what stops (intake, authorizations, alerts) | Missing | |
| B7 | Lapse: 14-day grace for payroll and `critical` | Missing | Priority `critical` is in the data (Payroll run). There is no grace logic or copy |
| B8 | Warnings at 14, 7 and 1 days naming the obligations | Missing | |

### 1.3 The agent

| # | Item | Status | Evidence |
|---|---|---|---|
| A1 | Named agent: name, short description, avatar | Missing | The app calls it "Takara agent" in Activity, "Ask Takara" in the nav, and shows the raw account `agent.takara-ai-hq.testnet` on the Public ledger |
| A2 | Ten-question setup interview, each question producing a policy field | Missing | |
| A3 | Answers become a policy diff the owner reviews and signs | Partial | The diff dialog and wallet signing exist for 3 controls (`propose_policy`, browser checks the hash) |
| A4 | Every field editable by hand afterwards, no conversation needed | Present (3 fields) | `#/policy` form: Auto-pay limit 500, Cooling-off 24 h, Minimum runway 7 days |
| A5 | Chat for setup, questions and exceptions | Partial | `#/ask` "Ask Takara · Read-only" answers *why blocked*, *spendable*, *vendor changes*, *list bills*. It cannot answer the doc's other two examples ("afford another contractor at 2,000 a month", "what renews next month") |
| A6 | Forms and buttons for repeated actions, one click each | Partial | Wallet-signed **Accept bill / Close bill / Approve new destination / Reject change / Sign with wallet / Pause / Revoke / Recover / Release reservation**. No add member, invite, offboard, import or export, and no reject reason |
| A7 | A chat box that is always there | Missing | Chat is a separate page. The only bridge is **Ask why** in a refused bill's drawer |

### 1.4 People

| # | Item | Status | Evidence |
|---|---|---|---|
| P1 | Four named roles (Owner, Manager, Member, Auditor) | Missing | The app's roles are the contract's: Owner, Policy signer, Takara agent, Viewer (wallet block badges) |
| P2 | Owner; at least two | Partial | `#/policy` **Who can change this → Owners: takara-ai-hq.testnet**. There is one owner key and no warning about it |
| P3 | Manager: approves, sets budgets, final say on spending | Partial | The policy signer does approvals (wallet). It also signs policy, which the doc reserves for owners. Budgets aren't enforced |
| P4 | Member: submits claims, sets own payout, sees only own pay | Partial | Ana appears only as a payee ("Team member", `ana.fixtureco.testnet`, 400 USDC paid). No member experience |
| P5 | Auditor: read-only, date-scoped | Missing | `#/ledger` covers the *public observer*, not an auditor |
| P6 | Joining by email invite or link | Missing | |
| P7 | Member sets own chain, token and address; manager approves it once | Missing | |
| P8 | Member address change → freeze, signer, cooling-off | Missing (vendor case Present) | The vendor freeze is live: Railway `railway-pay.testnet` vs proposed `railway-new-bank.testnet`, "approved, in cooling-off". The member freeze isn't in code (product-flow Appendix A #9) |
| P9 | Offboarding in one action | Missing | |
| P10 | CSV bulk import of members and vendors | Missing | |

### 1.5 Money

| # | Item | Status | Evidence |
|---|---|---|---|
| M1 | One Commitment object, four kinds (invoice, subscription, payroll, reimbursement) | Partial | `#/bills` subtitle "Invoices, subscriptions, payroll and reimbursements". Tags "Monthly", "Team member", "Payroll". No kind filter and no kind label. The data supports all four (see 3.4) |
| M2 | States `claimed → accepted → settled → closed` | Present (no closed) | Pills: Received, Reserved, Paid. The drawer has a **Progress** timeline. `closed` has no label (`stateWord` falls back to "Recorded") |
| M3 | Only `accepted` reduces spendable | Present | Hero breakdown and Bills summary: "805 USDC reserved · 1,140 USDC not reserved yet" |
| M4 | Receiving a document never creates an obligation | Present | Cards say "Not reserved yet". Activity: "Recorded a bill … Not reserved yet" |
| M5 | Four ways in: email, upload, chat, form | Missing (UI) | Email intake is a backend CLI over `.eml` (DKIM modeled). No upload, chat entry or form |
| M6 | A manager can enter anything by hand | Missing | `register_claim` is agent-only in the contract |
| M7 | Each payee stores a preferred chain and token | Partial | Destination and chain show on bills and vendors ("railway-pay.testnet · NEAR"). Token per payee is not shown (it's the policy symbol, USDC) |
| M8 | Say so when a route is unavailable or uneconomic | Missing | |
| M9 | Reimbursements in detail (member forwards a receipt, gets paid privately) | Partial | Ana's 400 USDC payment request is in the data (settled). There is no member-side flow |

### 1.6 Alerts and the approval queue

| # | Item | Status | Evidence |
|---|---|---|---|
| L1 | Alerts via Telegram, email or both, per company and per person | Missing | |
| L2 | Renewal approaching (7 d and 1 d) → manager | Missing | The data is there: monthly bills with due days (Inkwell Dec 5, Railway Jan 12) |
| L3 | Shortfall predicted → owner and manager | Missing | Computable: reserved 805 + waiting 1,140 against 880 available |
| L4 | Destination change → owner and manager, payment already frozen | Partial | Shown as an approval card and in Activity ("Frozen: …"). Not an alert |
| L5 | Approval waiting → the approver, on arrival and then daily | Partial | Approvals card "Waiting 19 hours". No notification |
| L6 | Payment settled → the payee only | Missing | |
| L7 | Plan lapsing at 14, 7 and 1 days → owner | Missing | |
| L8 | Every alert carries amount, deadline and one action | Partial | Approval cards have amount, deadline and **View bill** |
| Q1 | Approval queue: one list of everything waiting | Present | `#/approvals` "Needs attention": Waiting on a signer (1), Waiting on time (1), Pending policy check (2) |
| Q2 | Who it waits on, how long, what it blocks | Partial | "Waits on Policy signer (signer.takara-ai-hq.testnet)", "Waiting 19 hours", "Deadline Dec 30". There is no *what it blocks* |
| Q3 | Approve or reject in one click | Present | Signer wallet: **Accept bill / Close bill**, **Approve new destination / Reject change** (approval requires the out-of-band check box). Viewers get **Try anyway** |
| Q4 | Required reason on reject | Missing | `reject_vendor_change` and `close_commitment` take no reason |
| Q5 | Queue entry rules: above `max_auto_pay`, new vendor above auto limit, destination change, budget break | Partial | The first three are present. Budgets aren't enforced |
| Q6 | Nothing silently stuck outside the queue | Present | "Pending policy check — Takara decides these automatically. Shown so nothing is stuck out of sight" |

### 1.7 Confidentiality, escrow, missing pieces, build order

| # | Item | Status | Evidence |
|---|---|---|---|
| C1 | What each role sees (member, manager, owner, auditor, public) | Missing | Only two lenses exist: owner views and `#/ledger` |
| C2 | Public observer sees commitments, hashes, attestations; no names, amounts or destinations | Present | `#/ledger` "What strangers see, and what stays sealed" plus the commitments table with hash and attestation |
| C3 | "Payroll is confidential member-to-member, not from management", said plainly | Missing | |
| C4 | Scoped receipts (contractor, accountant, grant sponsor) | Missing | Settled bills show "Paid on NEAR testnet" and on-chain proof links, but no receipt |
| E1 | Job board | Correctly absent | The structure doc defers it |
| E2 | Milestone commitments for a chosen freelancer (v1.5) | Missing | Pitch only (section 5) |
| N1 | Shared vendor registry | Missing | A per-treasury signed registry exists (sealed). Cross-company sharing is roadmap, and the review says keep it private |
| N2 | Lapse behaviour | Missing | See B4–B8 |
| N3 | Offboarding | Missing | See P9 |
| N4 | Approval queue | Present | See Q1–Q6 |
| N5 | Manual fallback when the model or enclave is down | Partial | Signer `accept_commitment` and every owner control run without the agent or engine (`contract/src/lib.rs`: a direct state change). The app doesn't say this is the fallback |
| N6 | Accounting export (QuickBooks, Xero, CSV) | Missing | |
| N7 | Incoming money (`expected → invoiced → confirmed → received`) | Missing | Pitch only |
| N8 | Fiat edges (off-ramp partner) | Missing | Pitch only |
| N9 | Prevention counter | Present | Overview **Caught for you 12** ("frozen 1 · ignored 2 · duplicate 1 · +3 more"), plus Activity filter **Caught (12)** |
| O1 | Build phases 1–11 | Phase 2 Partial (dashboard, queue); phases 1, 3–11 Missing in UI | Phase 2's "a manager can run a week without the chat" is close. The others have data but no surface |
| O2 | Non-custodial, never pool funds | Present | Owner controls, recover with the agent offline, judge check 8 |

**Score:** 11 Present, 21 Partial, 39 Missing (the job board is excluded as correctly absent). Most of the Partial rows need only a surface, because the data is already there.

---

## 2. Target information architecture

### 2.1 Order of the product

The structure doc is written "in the order an owner meets it", so the navigation is too. It starts with a **Get started** section that this treasury has already completed. Every step's tick comes from real state, which makes the setup journey visible without faking a fresh account. Daily operation follows.

```
Desktop sidebar (grouped)                      Route
────────────────────────────────────────────────────────────────
[avatar] Banto · Active                        agent card (live status)
treasury.takara-ai-hq.testnet ⧉
[Connect wallet]                               (unchanged)

SET UP
  Get started                 6/6 ✓            #/start, #/start/interview
OPERATE
  Overview                                     #/overview (default)
  Approvals                   (1)              #/approvals
  Money                                        #/money?kind=…&status=…   (#/bills → redirect)
  Alerts                      (3)              #/alerts
ORGANISE
  People                                       #/people, #/people/<id>
  Vendors                                      #/vendors, #/vendors/<id>
  Policy                                       #/policy
RECORDS
  Reports & receipts                           #/reports, #/reports/receipt/<id>
  Public view                                  #/ledger (renamed from "Public ledger")
ACCOUNT
  Plan & billing                               #/plan
────────────────────────────────────────────────────────────────
[Ask Banto …]  persistent dock button, bottom of sidebar; opens a non-modal side panel
Testnet · Fictional data · Product page · GitHub
```

- **Mobile bottom bar (5):** Overview, Approvals (badge), Money, Ask, More. The More sheet lists Get started, Alerts, People, Vendors, Policy, Reports & receipts, Public view and Plan & billing, then the wallet block.
- **Header, right side, every view:** "Viewing as: Owner ▾" (the role lens, 3.6), "Updated 2 min ago", Refresh.
- **Rename "Public ledger" to "Public view".** It matches the confidentiality table's "public chain observer". It also avoids "Ledger" sitting next to the Ledger hardware wallet in the connect list.
- **Split "Vendors & team".** People are a different object with roles, while vendors are a registry. The doc treats them separately (People section; registry in "What was missing").
- **Activity moves into Reports & receipts** as its first tab. `#/activity` stays as an alias.

### 2.2 Name the agent

The doc: "People trust something they named… Name, short description, avatar." The review: avoid "Ledger" (hardware-wallet brand). Three candidates fit Takara's Japanese root ("treasure"):

| Name | Meaning | Why it fits | Clash check (run a USPTO and EUIPO knockout search before launch) |
|---|---|---|---|
| **Banto** (recommended) | 番頭, the head clerk of a Japanese merchant house who kept the money and the books for the owner | It's literally the role: works for the owner, keeps the books, can't overrule the owner | No known finance or crypto brand to our knowledge. Short and easy to say |
| **Kura** | 蔵, the storehouse where a house kept its treasure | Pairs with Takara ("treasure in the storehouse") | Kura Sushi is a restaurant chain (different class, but it hurts search) |
| **Mamori** | 守り, protection or a guard | Matches "fraud prevention" positioning | No known finance brand to our knowledge. Slightly harder to say |

- **Default name:** Banto. The owner can rename it on the interview's intro card (not one of the ten questions). People trust what they named.
- **Description:** "Banto works for Fixture Co. It reads invoices, reserves money for bills you accept, and pays inside the policy you signed. It can't change its own limits, and an owner can switch it off at any time."
- **Avatar:** a 32 px (sidebar) or 24 px (chat) rounded square, radius 9, brand green `#0B5D52`, with a white "B" in the app's sans at weight 600, echoing the logo's square-in-square mark. No face, mascot, sparkle, gradient or glow. It wears a **live status ring** (2 px):
  - Accent: active (`public.agent` set and not paused).
  - Warn: the treasury is paused (`public.paused`).
  - Muted with a diagonal slash: revoked (`public.agent` empty).
- **Where the name appears:** the sidebar agent card, chat messages, Activity sentences (only "Takara agent" changes, to "Banto (agent)"), the interview, alert sender lines, and Policy "What Banto can never do". The raw account `agent.takara-ai-hq.testnet` stays one click away (agent card → copy).
- **Where it does not appear:** the product name stays Takara AI. Implementation: one constant `AGENT = { name, initial }`, saved in `localStorage` (try/catch) with "Banto" as the fallback.

---

## 3. Screen specs

Every element is tagged **LIVE** or **PREVIEW**. PREVIEW elements follow the honesty system in section 5.2: the chip "Preview", sample data that never touches live totals, and buttons that open a "How this will work" sheet.

### 3.1 Get started (`#/start`)

**Purpose.** Show the doc's six-step journey and the fact that this treasury has completed it, with real proof for each step. It is also the entry point to the setup interview.

**Layout.** Page `<h1>` "Get started". Subtitle (LIVE): "Fixture Co's treasury is set up. Here is how it got here, step by step." Below that, a vertical stepper with 6 rows. Each row shows a status dot, a title, one line of proof and one link.

| Step | Row copy | Proof shown | Source |
|---|---|---|---|
| 1 Treasury | "Treasury created. You own it." | `treasury.takara-ai-hq.testnet`, owner `takara-ai-hq.testnet`, deploy tx link | LIVE (`public`) |
| 2 Setup interview | "Policy v1 signed." | Version, hash `68ea8f18…5281`, signer. Button **Replay the setup interview** | LIVE (`public.policy`). Interview: mixed, see 3.2 |
| 3 Team and vendors | "3 vendors and 1 team member registered." | Railway, Inkwell, Payroll run, Ana. New vendors: 2 | LIVE (derived from report commitments) |
| 4 Invoices | "9 documents in, 9 bills recorded, 1 duplicate refused." | Link to Reports → intake log | LIVE (`decisions`: `register_claim` outcomes) |
| 5 Your numbers | "Spendable 75 of 1,400 USDC. Runway 34 days." | Mini hero bar | LIVE (`report.figures`) |
| 6 First payout | "First payout settled Nov 12: Railway, 120 USDC." Then: "This is where you'd pick a plan. Design partners use Takara free during the pilot." | Settlement tx link. Button **See plans** → `#/plan` | Payout LIVE. Plan PREVIEW |

- **Side card (desktop) / footer (mobile):** "Setup is free and has no time limit. You pay at your first payout, when Banto already knows your business." (structure doc, The flow)
- **"Start a new company"** is not offered. A second treasury would be a CLI deploy that costs ~3.6 NEAR of storage, so the review recommends deploying at the paywall. Say this once in the "How this will work" sheet behind step 1: "In the product, setup runs before any contract exists; the treasury is deployed at your first payout."
- **Sidebar badge:** "6/6 ✓" when every step is complete, otherwise "n/6".

### 3.2 Setup interview (`#/start/interview`)

**Purpose.** "A form that happens to be conversational." Ten questions, each producing a policy field. It ends in a policy diff that a signer signs.

**Layout.** On desktop, two columns. The left column is the conversation: one question card at a time, with Banto's avatar, the question, an answer control, then **Back**, **Next**, and a progress bar ("Question 4 of 10"). The right column is "Policy being built": a live list of fields filling in as you answer, each tagged with the question number. On mobile the columns stack and the policy panel collapses to a "Policy: 7 fields" summary bar.

**Intro card:** "I'm Banto. Ten questions, about five minutes. Every answer becomes a setting you can change later without talking to me." It has a name field ("What should we call me?", default Banto) and a **Start** button.

| Q | Question (doc wording, tightened) | Answer control | Prefilled from | Field it produces | Can it change the real policy now? |
|---|---|---|---|---|---|
| 1 | What does the company do, and how many people? | Text and number | Sample "Fixture Co (fictional), design studio, 3 people" | `profile` | No, PREVIEW (not in the bundle) |
| 2 | Does Takara handle payroll, or only bills and reimbursements? | Segmented: Payroll + bills / Bills only | LIVE: "Payroll + bills", because a `payroll` commitment exists | `scope.payroll` | No (display only) |
| 3 | Who are the owners, who can revoke and recover? | Account chips | LIVE `public.owners` | `owners` | No: owners are fixed at deploy. Shows warning: "1 owner key. Add a second owner key so losing one device can't lock you out." |
| 4 | Who approves spending above the limit? | Account chips plus threshold | LIVE `public.signers`, threshold 1 | `signers`, `threshold` | No: `rotate_signers` is owner-only and CLI in this build |
| 5 | What is the largest payment Banto may make without asking? | Number, USDC | LIVE `max_auto_pay` 500 | `max_auto_pay` | **Yes:** feeds the real diff |
| 6 | What is the minimum runway to protect, in days? | Number, days | LIVE `min_runway_days` 7 | `min_runway_days` | **Yes** |
| 7 | Which recurring services do you pay for, with amounts and dates? | Editable list | LIVE: Railway 120 monthly (12th), Inkwell 45 monthly (5th) | `vendors[].recurrence` | Edits are PREVIEW (the diff endpoint covers 3 controls). Also asks "Cooling-off after a payout change", LIVE 24 h, **yes** |
| 8 | Who gets paid regularly, on what chain and token? | Editable list | LIVE: Payroll run → `payroll.fixtureco.testnet` NEAR USDC; Ana → `ana.fixtureco.testnet` NEAR USDC | `roster[]`, `vendors[].destinations` | Edits PREVIEW |
| 9 | Where should alerts go: Telegram, email or both? | Two toggles plus address fields | Sample | `alerts.channels` | No, PREVIEW |
| 10 | Anything Banto must never do? | Free text, plus a LIVE list above it: "Already impossible, enforced by the contract: change its own limits · withdraw funds · pay a changed destination without a signer and a cooling-off period · act after an owner revokes it" | Empty | `never[]` (stored, not enforced) | No, PREVIEW |

- **Finish card:** "Here's your policy. 3 settings change on-chain when a policy signer signs; the rest are saved in this browser for now." Button **Review and sign** opens the *existing* diff dialog (`/api/policy/diff` → browser hash check → wallet **Sign with wallet**). It is LIVE and uses the real flow.
- **Unchanged answers:** if nothing changed, the button reads **Done, nothing to sign**.
- **Preview fields:** listed under "Saved in this browser, part of the signed policy after the hackathon" with the Preview chip.
- **Copy rule:** every question card shows the field it produces in small muted text, for example "→ Auto-pay limit". That makes "each question produces a field" visible.

### 3.3 Overview (`#/overview`)

**Purpose.** Unchanged: what I can spend, what's waiting, what's due, what was caught. Three additions bring it into line with the doc.

- **Banto summary line (LIVE)**, above the hero. Avatar, then one sentence built from data, with one action. For example: "1 bill is waiting on a policy signer (900 USDC, due Dec 30) and 1 payout change unlocks at 9:59 PM." The action is **Open approvals**. With nothing pending: "Nothing needs you. Next payment: Payroll run, 600 USDC on Dec 1, already reserved."
- **Alerts card (LIVE):** the top 3 from `#/alerts`, each showing its amount, deadline and one button. It replaces nothing; it sits beside "Coming up".
- **"Caught for you" (LIVE, present).** Add a subline: "Each one is a payment Takara refused or froze. This counter is the reason the plan costs $39 a month." That links the prevention counter to pricing, the doc's positioning.
- **Everything else stays as built** (hero, Needs attention, Coming up, Activity).

### 3.4 Money (`#/money`, replaces Bills)

**Purpose.** "Four things that look different to the user and are one object underneath."

**Layout.**
- `<h1>` "Money". Subtitle: "Invoices, subscriptions, payroll and reimbursements. One kind of record underneath. Money is reserved only when a bill is accepted."
- **Kind tabs** (LIVE, with counts): All 9 · Invoices 2 · Subscriptions 5 · Payroll 1 · Reimbursements 1. Each row has exactly one kind.
- **Status filters** below the tabs (present, keep): All, Waiting, Reserved, Paid, Flagged, plus **Closed** when any exist.
- **Table:** add a "Kind" column (tag) and keep Bill, Due, Amount, Status, Issues and Waits on.

| Kind | Derivation from the live report (exact rule) | Current rows |
|---|---|---|
| Payroll | `vendor_id === "payroll"` or `priority === "critical"`. Tag "Payroll · critical" | Payroll run 600 |
| Reimbursement | `vendor_id` starts with `member:`. Tag "Reimbursement", payee is the member | Ana 400 (paid) |
| Subscription | `recurrence` is `m` or `w` and not payroll | Railway 120 ×4, Inkwell 45 |
| Invoice | everything else (one-off vendor, including `new:` vendors) | tinylogo 40, bigagency 900 |

- **State legend (LIVE):** a one-line strip "Received → Reserved → Paid → Closed" with "Only Reserved reduces what you can spend. Receiving a document never creates an obligation." Add `closed: ["Closed", "quiet"]` to `stateWord`.
- **Add money ▾** (PREVIEW) opens a menu with the four ways in:
  1. **Forward an email:** shows `bills@fixtureco.takara.example`.
  2. **Upload a file.**
  3. **Tell Banto:** opens the dock with "Add a bill from …" prefilled. The chat answers "I can't record bills in this build", which is honest and LIVE.
  4. **Fill a form.**

  Each opens the "How this will work" sheet: "All four end in one claimed bill. Only Banto's key can record it on-chain, and a forwarded email stays *sender unverified* until the vendor's own mail server signs it." (The review's intake trust tiers.)
- **Export CSV (LIVE):** downloads the current filtered rows (id, kind, vendor, amount, symbol, due date, state, priority, flags, destination, chain, proposed destination). This delivers "Records are always exportable" today. Header row plus `#` lines stating "Fictional fixture data · NEAR testnet".
- **Bill drawer additions:**
  - "Kind" in Details (LIVE).
  - "Payee chain and token: NEAR · USDC" (LIVE).
  - A "Route" line (PREVIEW): "If a route is unavailable or costs more than usual, Banto tells you instead of taking a worse one."

### 3.5 Approvals (`#/approvals`)

**Purpose.** "Where a manager lives." It's already the strongest screen. Three gaps from the doc:

- **What it blocks (LIVE, computed):** a fourth meta line on each card.
  - New vendor over limit: "Blocks: payment of 900 USDC to bigagency.testnet, due Dec 30. Accepting it would leave −825 USDC spendable, so you'd also need to add funds." The math is `spendable − amount` from report figures.
  - Cooling-off: "Blocks: Railway's Jan 12 payment until 9:59 PM."
  - Policy check: "Blocks: nothing yet. Banto decides this within policy."
- **Required reason on reject (LIVE input, local storage):** **Close bill** and **Reject change** open an inline reason field (required, minimum 10 characters) before the wallet step. Placeholder: "Tell the person what to fix, e.g. 'Destination doesn't match our records; call us.'" The reason shows in the confirm summary and in Activity as "Reason (saved in this browser): …". Note under the field: "The contract records the rejection, not the reason. Sending the reason to the member comes with accounts." No reason is sent on-chain, because the contract method has no reason argument.
- **Role wording:** the section header reads "Waiting on a manager (policy signer)" the first time, then "Waiting on a manager". The tooltip says: "In this build the manager's approval is the policy signer's wallet signature. A backend click can never approve." (The review asks for wallet-signed approvals; that's already true, so it's shown as a feature.)
- **Delegation and escalation (PREVIEW, one line under the header):** "If the approver is away and payroll is due tomorrow, the item escalates to an owner." It has the Preview chip and no button.
- **Order:** sort by deadline, then waiting time (present).

### 3.6 People (`#/people`)

**Purpose.** "Four roles. Name them explicitly, because every confidentiality rule depends on which one you are." This screen maps them honestly onto the contract's three authorities.

**Layout.** `<h1>` "People". Subtitle: "Who can do what. Owner and manager rights are enforced by the treasury contract; the rest arrive with accounts."

**Role cards (4, plus the agent):**

| Card | Mapped to | Members shown | Can do (live, enforced) | Badge |
|---|---|---|---|---|
| **Owner** | Contract `owners` (ownership authority) | `takara-ai-hq.testnet` (LIVE) | Pause, resume, revoke or restore Banto, recover funds, release a reservation. Wallet buttons live (Policy page) | LIVE. Warning (LIVE fact): "1 owner key. The product requires two owner keys, so a lost device can't lock you out. The contract has no owner threshold yet." |
| **Manager** | Contract `policy.signers` (policy authority), threshold 1 | `signer.takara-ai-hq.testnet` (LIVE) | Accept or close bills, approve or reject payout changes, sign policy. All wallet-signed | LIVE, with note: "In this build the manager also signs policy, which the product reserves for owners. Splitting the two needs a contract change." |
| **Member** | No on-chain authority. Payees in the signed roster | Ana, `ana.fixtureco.testnet`, NEAR · USDC (LIVE, from the `member:ana` commitment) | Today: gets paid. Submitting claims and setting their own payout address comes with accounts | Member list LIVE. Member actions PREVIEW |
| **Auditor** | None | Sample "Sample accountant · Nov 1–30" | Read-only inside a granted date range | PREVIEW |
| **Banto (agent)** | Contract `agent` (execution authority) | `agent.takara-ai-hq.testnet`, status ring (LIVE) | Record bills, request decisions, pay what the engine authorized. Never any owner or manager action | LIVE |

**Person drawer (`#/people/ana`):**
- LIVE: payout address, chain and token; payments (400 USDC paid, with date and tx); open claims (0); recurring commitments (0).
- PREVIEW buttons: **Approve address**, **Change address** (sheet explains: "A change freezes payment until a manager approves and the cooling-off period passes — the same protection Railway's payout change got"), and **Offboard**.

**Offboard (PREVIEW dialog, with live facts):** "Offboard Ana in one step:"
1. Settle the final payout. Live check: "No unpaid claims."
2. Revoke payout address `ana.fixtureco.testnet`.
3. Resolve or cancel pending claims. Live: "0".
4. End recurring commitments. Live: "0".
5. Cut access.
6. Keep history for the auditor. Live: "1 payment, 400 USDC, kept."

The confirm button reads **Offboard (after the hackathon)** and is disabled, with "In this build, removing a member is a new signed policy version from the CLI." Step 1 comes before step 2, per the review: settle the final payout before revoking the address.

**Header actions (PREVIEW):**
- **Invite** (email or link). The sheet describes the joining flow: the member sets their address, a manager approves it once, and a small test transfer confirms it (review).
- **Import CSV.** Template download plus validation, see the stretch list.

**Confidentiality panel (LIVE copy, the doc's table verbatim in plain words).** "Members see their own pay only. Managers see every salary they approve. Owners see everything. Auditors see a date range. The public chain sees hashes, never names or amounts. Payroll is private between colleagues, not from management — like every payroll system." Link: **See it as each role** sets the lens below.

**Role lens ("Viewing as ▾" in the header).** This is how the confidentiality table becomes visible with real data.

| Lens | What changes |
|---|---|
| Owner (default) | Everything, as today |
| Manager | Same views, but Owner controls collapse to "Owner only" |
| Member · Ana | A dedicated **My pay** page replaces Overview: Ana's 400 USDC payment with date, tx and receipt, her payout address and "Submit a claim" (PREVIEW). Money, Vendors, the hero totals and other people are hidden, replaced by "Members don't see company totals or colleagues' pay." |
| Auditor · date range | Reports & receipts and Money, read-only, filtered to the range (default Nov 1–30). Every action button is hidden |
| Public observer | Routes to Public view |

- **Lens label (always visible while not Owner):** "Lens: shows what this role would see. Not access control in this build — per-member encryption comes with accounts." That's the review's point: a backend dump must reveal no colleague's pay, so the lens can't claim to enforce anything.
- **Default lens:** follows the connected wallet: signer → Manager, owner → Owner, otherwise Owner (the demo default).

### 3.7 Vendors (`#/vendors`)

**Purpose.** The registry: who we pay, where to, and protection against payout changes.

- **Present, keep (LIVE):** the table (Vendor, Pays to, Bills, Open, Paid, Status), the Railway payout-change comparison, and new-vendor statuses (Provisional, New, awaiting signer).
- **"Pays in" column (LIVE):** chain and token, "NEAR · USDC".
- **Protection line (LIVE)** above the table: "1 payout change caught and frozen. Approved changes wait 24 hours before any payment." It uses `vendor_changes` and `cooling_off_hours`.
- **Add vendor / Import CSV** (PREVIEW). The sheet says: "New vendors above the auto limit always land in Approvals first."
- **Network warnings** (PREVIEW, a single muted line per vendor drawer): "No warnings from other Takara businesses." The sheet explains the private registry: keyed hashes inside the enclave, a warning signal only, never auto-verification (review). It has no fake counts.

### 3.8 Alerts (`#/alerts`)

**Purpose.** "Every alert carries the amount, the deadline and one action." The alert *content* is computed live in the browser from real data. *Delivery* to Telegram or email is preview.

**Layout.** `<h1>` "Alerts". Subtitle: "What Banto would send, to whom, right now. Delivery to Telegram and email comes with accounts." A list of alert cards, newest or most urgent first. Each card shows an icon, a sentence, the amount, the deadline, the recipients (role plus real account) and one button. A rules table follows.

| Doc alert | Live rule over current data | Today's output | One action | Recipient shown |
|---|---|---|---|---|
| Renewal approaching | `recurrence` set, state accepted or claimed, due in ≤ 7 d (and ≤ 1 d) | None due within 7 days. Empty state: "Next renewal: Inkwell Design Tools, 45 USDC on Dec 5. You'll hear on Nov 28." | View bill | Manager (`signer.…`) |
| Shortfall predicted | Strict: reserved > available (`balance − settled_outflow`). Predictive: reserved + received-but-unreserved > available | Strict: none (805 ≤ 880). Predictive: "If the 3 bills not yet reserved (1,140 USDC) are accepted, bills would exceed available money by 1,065 USDC." | Review waiting bills | Owner + manager |
| Destination change | Any `vendor_changes` entry | "Railway asked to be paid at `railway-new-bank.testnet`. Payment was frozen; a manager approved; cooling-off ends Nov 13, 9:59 PM." | View change | Owner + manager, both |
| Approval waiting | Item waiting on a signer; age from `decisions` | "New vendor bigagency.testnet, 900 USDC, waiting 19 h. Deadline Dec 30." | Open in Approvals | The approver (`signer.…`) |
| Payment settled | `state === settled` | "Paid: Railway, 120 USDC" and "Paid: Ana, 400 USDC" | View receipt | The payee only (lens: Ana sees only hers) |
| Plan lapsing | No billing | Sample card: "Your plan ends in 7 days. Payroll run, 600 USDC on Dec 1, would not be paid." | See plan | Owner. PREVIEW |

- **Security alerts never stop (LIVE copy, review):** a footnote under the Destination change rule: "Payout-change alerts keep sending even if your plan lapses."
- **Delivery settings (PREVIEW panel):** per company and per person, toggles Telegram and Email, with fictional handles. Privacy note (review): "Payroll alerts never include amounts outside the app."
- **Sidebar badge:** the count of live alerts (3 today: shortfall predicted, destination change, approval waiting).

### 3.9 Reports & receipts (`#/reports`)

**Purpose.** "An accountant signs off without asking a question"; scoped receipts; records always exportable.

**Tabs:** Activity (the existing full feed, moved here, LIVE) · Receipts · Export · Intake log.

- **Receipts (mixed).** One card per settled commitment.
  - LIVE: payee, amount, date of the settle transaction, bill number, commitment hash, settlement tx link, attestation request and output hash.
  - Buttons: **Copy receipt** (LIVE; plain-text block scoped to that one payee and line) and **Share with payee** (PREVIEW).
  - Footer, Preview chip: "Unsigned format. Signed receipts a third party can verify need a new engine operation." A receipt shows nothing about any other line, which demonstrates "scoped to one party".
- **Export (LIVE).** **Download CSV** for all commitments, or for a date range (from/to inputs, used by the Auditor lens). **QuickBooks** and **Xero** buttons are PREVIEW. Copy: "Your records are always exportable, plan or no plan."
- **Intake log (LIVE).** Every `register_claim` from `decisions`, as "document in → outcome": recorded as bill #n, or refused with its reason (duplicate, unknown requester). Heading: "Documents received. Receiving a document never creates an obligation."
- **Auditor access (PREVIEW card):** "Grant read-only access for a date range" with sample "Sample accountant · Nov 1–30".

### 3.10 Policy (`#/policy`)

Present: the form, Who can change this, and Owner controls. Changes:

- **Field captions (LIVE):** each field shows "from setup question 5 / 6 / 7". This makes the interview → field link explicit.
- **"What Banto can never do" panel (LIVE, contract-enforced):** the four lines from Q10, each linked to the judge-check tx that proves it (check 8: `E_NOT_OWNER`, `E_NOT_POLICY_SIGNER`; check 5: freeze).
- **Rename and frame Owner controls:** "Owner controls · manual fallback". Copy: "These work with Banto, the enclave and our servers all switched off. A manager's approval also works without Banto. If you stop paying for Takara, this is how your money stays yours." That covers the lapse guarantee (B4) and the manual fallback (N5), both live.
- **Who can change this:** relabel the rows "Owners (ownership)" and "Managers (policy signers)". Keep the two-owner-keys warning.

### 3.11 Plan & billing (`#/plan`)

**Purpose.** The doc's pricing and the lapse rules "in plain words", plus a lapse simulator over real obligations. Billing is entirely preview, and the page says so at the top without apology: "Design partners use Takara free during the pilot. This is what you'll see when billing starts."

- **Current plan (LIVE fact):** "Design partner · free". No billing exists, and saying so is honest.
- **Plans (PREVIEW, 3 cards).** Wording per the review: auto-renew, fraud prevention, volume cap.
  - 1 month, $59: "Try it."
  - 3 months, $149: "$50 a month."
  - 12 months, $468: "**$39 a month**, two months free." Pre-selected and visually primary.

  Headline: "$39 a month so one fake invoice never costs you $8,000." Sub-line: "No percentage of your treasury. No fee on payroll." Note: "Renews automatically, paid from your treasury as a bill you accept. Route fees passed through at cost." Buttons: **Choose plan (after the hackathon)**, disabled.
- **"When a plan lapses" (LIVE copy, verbatim rules):**
  1. "Your treasury is yours. Funds are always withdrawable, even with our servers, the enclave and Banto switched off." Link → Owner controls.
  2. "Your records are always exportable." Link → Export.
  3. "What stops: Banto stops taking invoices, authorizing payments and sending routine alerts. Payout-change alerts never stop."
  4. "Grace: accepted bills due within 14 days still get paid. Everything else freezes immediately." This is the review's widened rule. The doc's narrower "payroll and critical only" appears as a muted footnote.
  5. "Warnings at 14, 7 and 1 days, each naming exactly what would go unpaid."
- **Lapse simulator (LIVE data, simulated plan date).**
  - Control: "If the plan lapsed on [today | Nov 20 | Nov 27]".
  - Output: two lists computed from accepted commitments and due dates: "Still paid during grace" and "Would freeze". Today, the grace window ends Nov 27. Payroll run (600 USDC, Dec 1) falls *after* it, so the simulator shows "Payroll run, 600 USDC on Dec 1 — after the grace period. Renew before Nov 27, or pay it yourself from Owner controls." That is a real, useful finding, generated from live data.
  - Label: "Simulation over your real bills."

### 3.12 Ask Banto (persistent dock, plus `#/ask`)

**Purpose.** "A chat box that is always there… chat is for setup, questions and exceptions."

- **Dock (LIVE).** A non-modal side panel, 380 px, right edge, on desktop ≥ 1280. Below that width it's a full-height sheet. It opens from the sidebar's **Ask Banto** button, the header icon, or any **Ask why** link. It must not use `showModal()`, because a modal blocks the wallet chooser (wallet plan 3.7). `#/ask` stays as the full-page version.
- **Read-only badge (present).** Copy changes to: "Banto answers questions here. To approve or change something, use the buttons — they're one click."
- **Two new deterministic intents (LIVE),** added to `chat()` in both `platform/lib/core.mjs` and `backend/server.mjs`:
  - "What renews next month?" lists commitments with `recurrence` and a due date in the next calendar month, with amount and reserved status.
  - "Can we afford another contractor at 2,000 a month?" Parse the amount, add `amount/30` to `daily_recurring_burn`, and recompute runway as `(balance − settled_outflow) / burn`. Answer, for example: "Runway would fall from 34 to 9 days — above your 7-day floor, but only just. Spendable today is 75 USDC." Sources: report figures.
- **Suggestion chips** become the doc's three examples plus one: "Why was the 400 payment blocked?", "What renews next month?", "Can we afford a contractor at 2,000 a month?", "Any payout changes?"
- **Routine requests** ("approve the 900 bill") are refused, as today. The answer links the exact button: "Approve it in Approvals — one click, signed in your wallet."

### 3.13 Public view (`#/ledger`)

Present and live. Changes:
- Rename the page.
- Add a top line: "This is the 'public chain observer' row of the confidentiality table: commitments, hashes and attestations. No names, amounts or destinations."
- Add a link back to People → confidentiality.

---

## 4. Routine actions: one click each

The doc's rule: "Nobody wants to type a sentence to approve the seventh invoice." Every routine action the doc names, and where it lives:

| Routine action (doc wording) | Button and location | Status | Who (contract check) |
|---|---|---|---|
| Approve a payment above the limit | **Accept bill**: Approvals card, bill drawer | LIVE (wallet `accept_commitment`) | Manager = policy signer |
| Reject a payment | **Close bill** + required reason: Approvals card, drawer | LIVE tx; reason saved in the browser | Manager (claimed); Owner may also close accepted |
| Approve a new vendor | **Accept bill** on the new-vendor-over-limit card (acceptance verifies the vendor) | LIVE | Manager |
| Approve a destination change | **Approve new destination** (out-of-band check box required) | LIVE (`approve_vendor_change`) | Manager |
| Reject a destination change | **Reject change** + required reason | LIVE (`reject_vendor_change`) | Manager |
| Change a limit | Policy form → **Preview change** → **Sign with wallet** | LIVE (`propose_policy`) | Manager (policy signer) |
| Pay | No human button. Banto pays accepted bills when due; card copy says "Paid automatically when due" | LIVE behaviour (agent `settle`) | Agent only, by design |
| Pay when Banto is down (manual fallback) | **Recover funds** in Owner controls · manual fallback | LIVE (`recover`, 1 yocto) | Owner |
| Release a reservation | **Release reservation** in the accepted bill drawer | LIVE (`close_commitment`) | Owner |
| Pause or resume, revoke or restore the agent | Owner controls; **Resume** in the paused banner | LIVE | Owner |
| Export records | **Export CSV** (Money, Reports) | LIVE (client-side) | Anyone with the owner report |
| Copy a receipt | **Copy receipt** (Reports → Receipts, bill drawer of a paid bill) | LIVE (unsigned format) | Owner, Manager; the payee via lens |
| Add a member, invite | **Invite** (People) | PREVIEW | — |
| Approve a member's payout address | **Approve address** (person drawer) | PREVIEW | — |
| Offboard | **Offboard** (person drawer) | PREVIEW (live facts) | — |
| Bulk add members or vendors | **Import CSV** (People, Vendors) | PREVIEW (stretch: client-side validation) | — |
| Add a bill by hand | **Add money → Fill a form** | PREVIEW | — |
| Set a budget | Not shown. Budgets aren't enforced; listed in the Plan page roadmap only | Pitch only | — |
| Set alert channels | Alerts → delivery settings | PREVIEW | — |
| Grant auditor scope | Reports → Auditor access | PREVIEW | — |
| Pick a plan | **Choose plan** | PREVIEW | — |

**Chat stays for exceptions.** These go to the chat: "why was X blocked", "what renews next month", "can we afford…", "any payout changes", "show bills for Railway". Each chat answer that implies an action ends with a link to the button, never with a chat-side action.

---

## 5. Judges vs pitch, and honesty without a mock-up feel

### 5.1 What goes where

| Show in the app (judges click it) | Why |
|---|---|
| Get started with live ticks, and the interview whose answers 5–7 produce a real signed policy diff | The doc's #1 decision (setup before paywall), proven on real state |
| Banto: name, avatar with a live status ring | Cheap, and the status ring is real (revoke → slash) |
| Money with four kinds derived from real commitments, plus CSV export | "One object, four kinds" with real data |
| People mapped to the three authorities, the two-owner-keys warning, Ana as a member, offboarding with live facts | Honest role mapping shows the team understood the doc *and* the contract |
| Role lens (Member · Ana sees only her 400; Auditor sees a range) | Makes the confidentiality table tangible in 10 seconds |
| Approvals with "what it blocks", reject reason, wallet signing, **Try anyway** | The doc's "where a manager lives", already the strongest screen |
| Alerts computed live (shortfall predicted, destination change, approval waiting, settled) | Real alerts with amount, deadline and one action; only delivery is preview |
| Plan page: lapse rules plus the lapse simulator over real bills | Shows the "existential" lapse behaviour, and it finds the Dec 1 payroll gap |
| Receipts (scoped, unsigned) and the intake log | Scoped receipts and "receiving never creates an obligation" made visible |
| Two new chat intents | The doc's own three example questions all work |

| Keep in the pitch only (deck, README, voiceover) | Why not in the app |
|---|---|
| Job board, and why it's deferred | The doc says wrong release; showing it invites "is this built?" |
| Milestone commitments (v1.5) | A new data flow. One slide: "a commitment with a release condition" |
| Shared vendor registry as moat, and the privacy-preserving version | Can't be shown honestly with one company. Only a single muted line in the vendor drawer |
| Incoming money (`expected → received`) | No data. A fake receivables table would undermine the live figures |
| Fiat off-ramp partner | A partnership, not a screen |
| Payroll administrator role (salaries hidden from managers) | The doc says not v1 |
| Unit economics, regulatory notes, design-partner go-to-market, security-first roadmap | Strategy, from product-review.md |
| Telegram bot screenshots | Optional single slide; the in-app delivery panel stays preview |

### 5.2 Honesty system (keeps labels, loses the mock-up feel)

1. **Live is the default and goes unlabelled.** Each page header carries one source line: "Live from NEAR testnet · updated 2 min ago". The global demo banner and the "Testnet · Fictional data" tags already cover the fixture company. Don't stamp "live" on every number.
2. **Preview is a component state, never a page coat.** Use a small chip "Preview" (neutral, dashed 1 px border, no colour alarm) on the component, with the tooltip "After the hackathon. Sample data, not this treasury." Preview panels get a dashed border and a one-line footer: "Preview · nothing here reads or changes the treasury."
3. **Live content first.** On every screen the live content sits above the fold and previews sit below or behind a button. The one exception is Plan & billing, whose top line explains why.
4. **Sample data looks like sample data.** Preview people and accounts are prefixed "Sample" ("Sample accountant") and never use the fixture company's live names. They never feed a total, a badge count or a chart.
5. **Preview buttons explain instead of dying.** A preview button opens a "How this will work" sheet with three short blocks: what it will do, what's live today that it builds on, and its build phase (the doc's phase number). The button label carries the state, for example **Offboard (after the hackathon)**, so nobody clicks and wonders.
6. **Three distinct states, three distinct looks.**
   - Role-disabled (live, but your wallet can't): a disabled button, the reason, and **Try anyway**.
   - Lens: a "Lens" pill and its note.
   - Saved in this browser: a muted "Saved in this browser" note.
   - Preview: the chip.

   Never reuse one look for another.
7. **Banned words inside content:** "mock", "fake", "coming soon", "demo" (the banner owns that word), "insurance", "escrow", "Ledger" (as a name). Use "after the hackathon" only inside chips, sheets and disabled labels.
8. **One sentence of contract truth where the doc outruns the code**, placed beside the element, never in a separate disclaimer page:
   - One owner key.
   - The manager also signs policy.
   - There's no member address freeze yet.
   - The lens isn't access control.
   - Receipts are unsigned.

---

## 6. Implementation order (today) and acceptance criteria

Target file: `web/index.html`, then a byte-identical copy to `platform/app/index.html`. The chat intents touch `platform/lib/core.mjs` and `backend/server.mjs`. No contract or engine changes. Deadline: submission closes 2026-11-14 23:59 UTC.

| # | Work | Hours | Depends on |
|---|---|---|---|
| 1 | **Foundations.** Grouped sidebar plus the mobile More sheet; new routes (`#/start`, `#/start/interview`, `#/money`, `#/people`, `#/alerts`, `#/reports`, `#/plan`); redirects `#/bills → #/money` and `#/activity → #/reports`; rename to Public view; Preview chip, preview panel and "How this will work" sheet components; the `kindOf(b)` rule; `closed` state word; role lens state plus the header control | 1.0 | — |
| 2 | **Banto.** `AGENT` constant plus rename storage; avatar component with live status ring; sidebar agent card; replace "Takara agent" in Activity and "Ask Takara" everywhere; non-modal Ask dock | 1.0 | 1 |
| 3 | **Get started plus interview.** Live checklist (6 steps from `public`, `report`, `decisions`); 10 question cards with live prefills; policy-being-built panel; Q5, Q6 and cooling-off feed the existing diff/sign flow | 1.5 | 1, 2 |
| 4 | **Money.** Kind tabs plus Kind column; state legend; Add money sheet (4 ways, preview); CSV export (filtered); drawer Kind, chain, token and route lines | 0.75 | 1 |
| 5 | **Approvals.** "What it blocks" line; required reject reason (inline, session-stored, shown in confirm and Activity); manager wording; escalation preview line | 0.5 | 1 |
| 6 | **People plus lens.** 5 role cards with live accounts and warnings; person drawer (Ana); offboard dialog with live facts; Invite and Import preview sheets; confidentiality panel; **My pay** page for Member · Ana; Auditor lens (read-only plus date filter on Money and Reports) | 1.5 | 1, 4 |
| 7 | **Alerts.** Six rules computed in the browser; cards with amount, deadline, recipients and one action; delivery-settings preview; sidebar badge; Overview alerts card plus Banto summary line | 1.0 | 1, 2 |
| 8 | **Reports & receipts.** Move Activity; Receipts (copy receipt); Export (all or range); Intake log; Auditor access preview | 0.75 | 4 |
| 9 | **Plan & billing.** Plan cards (preview); lapse rules copy; lapse simulator; Policy page relabels ("manual fallback", "from setup question n", "What Banto can never do") | 0.75 | 1 |
| 10 | **Chat intents.** "Renews next month" and "afford X a month" in both chat implementations; new chips; action-refusal answers link to buttons | 0.5 | — |
| 11 | **QA and ship.** Copy lint (no None, null, "insurance", "escrow" or "Ledger" as a name); 375 px and 1280 px pass on every new view; keyboard path through the interview and lens; console clean; copy to `platform/app/`; deploy; re-run the app-ux-spec section 8 checklist | 0.75 | all |
| | **Total** | **10.0** | |

**If time runs short, cut in this order to reach about 8.5 h:**
1. Drop the dock and keep the `#/ask` page plus a header button (−0.5).
2. Auditor lens: date filter on Reports only (−0.25).
3. Reports: merge Intake log into Activity as a filter (−0.25).
4. Alerts: skip the delivery-settings panel (−0.25).
5. Interview: Q7 and Q8 show live lists without edit controls (−0.25).

**Stretch, only if ahead:**
- CSV import with client-side validation against the live registry (duplicate destination, unknown chain, missing token) that renders "what would change" without applying (1.0).
- Read-only `GET /api/owner/registry`, returning vendors and roster from the fixture policy plaintext, so Vendors and People show `verified_by`, emails and domains live. The hosted copy is fictional only; production serves it from the owner's local server (0.5).
- A pricing section with the lapse rules on the product page (`site/index.html`). The doc says the rules "belong on the pricing page" (0.5).
- `downgrade_discretionary` as a signer drawer action (0.25).

### Acceptance criteria per screen

**Global**
- [ ] The sidebar shows the five groups in the order of section 2.1. Every old route still resolves (`#/bills`, `#/activity`, `#/ledger`).
- [ ] Every PREVIEW element carries the chip or the dashed panel footer. No preview value appears in any total, badge or chart.
- [ ] Every preview button opens the "How this will work" sheet naming a build phase. No dead clicks.
- [ ] Copy lint passes. No "insurance", "escrow", "coming soon" or "mock" in content, and the agent is never called "Ledger".
- [ ] `platform/app/index.html` is byte-identical to `web/index.html`. Nothing scrolls horizontally at 375 px. No console errors.

**Banto**
- [ ] The name appears in the sidebar card, chat, Activity and interview. A rename persists for the session, and the app still renders with storage blocked.
- [ ] The avatar ring reflects `public.agent` and `public.paused` (verify by reading the state; a revoked agent shows the slash).

**Get started and interview**
- [ ] All 6 steps tick from live data, and each proof line links to a real tx or view.
- [ ] Q3–Q8 prefill from live data. Changing Q5 to 600 and finishing opens the existing diff dialog with `max_auto_pay 500 → 600`, and the browser hash check passes.
- [ ] Each card shows the field it produces. Preview fields are listed as "Saved in this browser".

**Overview**
- [ ] The Banto summary sentence matches the Approvals and cooling-off state and has exactly one action.
- [ ] The alerts card shows the top 3 live alerts.

**Money**
- [ ] Tab counts are All 9, Invoices 2, Subscriptions 5, Payroll 1, Reimbursements 1 on the current fixture (re-derive if the data changes).
- [ ] Export CSV downloads the filtered rows with the fixture/testnet header lines.
- [ ] A closed bill (if any) shows "Closed".

**Approvals**
- [ ] Each card shows "Blocks: …" with live math (bigagency: spendable after accepting = −825).
- [ ] **Close bill** and **Reject change** can't proceed without a reason of 10 or more characters. The reason appears in the confirm summary and in session Activity labelled "saved in this browser".

**People and lens**
- [ ] The Owner card shows `takara-ai-hq.testnet` plus the one-owner-key warning. The Manager card shows the signer plus the policy-signing note. Member lists Ana from live data. Auditor is preview.
- [ ] Offboard shows Ana's live facts (0 open claims, 0 recurring, 1 payment kept), lists "settle final payout" first, and the confirm is disabled with its reason.
- [ ] Lens Member · Ana hides company totals, other people and vendors, and shows only her 400 USDC payment and receipt. The lens note is visible in every non-Owner lens.

**Vendors**
- [ ] Shows the "Pays in" column, the protection line using live `vendor_changes` and `cooling_off_hours`, and the Add vendor and Import sheets.

**Alerts**
- [ ] Today's live list is predicted shortfall (1,065 USDC), Railway destination change and bigagency approval waiting. The renewal empty state names Inkwell on Dec 5. Each card has the amount, deadline, recipient account and exactly one action.

**Reports & receipts**
- [ ] Receipts exist for both settled bills, each showing only its own line plus on-chain links. Copy produces plain text.
- [ ] The intake log shows every `register_claim` outcome, including the duplicate refusal.

**Policy**
- [ ] Field captions name their setup question. "What Banto can never do" links to judge-check transactions. Owner controls are titled "manual fallback".

**Plan & billing**
- [ ] The 12-month plan is primary at "$39 a month". Lapse rules are shown verbatim, with the widened grace and the "payout-change alerts never stop" line.
- [ ] The simulator with "today" lists Payroll run 600 USDC (Dec 1) under "after the grace period".

**Ask Banto**
- [ ] "What renews next month?" and "Can we afford another contractor at 2,000 a month?" return figure-backed answers in both the local and hosted builds.
- [ ] "Approve the 900 bill" is refused, with a link to Approvals.
- [ ] Opening the dock never blocks the wallet chooser.

**Public view**
- [ ] Renamed, shows the "public chain observer" line, and links to People → confidentiality.
