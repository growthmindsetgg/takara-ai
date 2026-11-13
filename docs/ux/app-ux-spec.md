# Takara AI owner app: UX specification

Version 1 · 2026-11-13 · Target file: `web/index.html` (single static HTML file, inline CSS, vanilla JS, Google Fonts only).
Hosted copy: `platform/app/index.html` must be a byte-identical copy of `web/index.html` after the rebuild (the in-app demo banner in section 5.8 replaces the inline-styled banner that is injected there today).

This spec is the source of truth for the implementer and the reviewer. Where it gives an exact string, use that string. Where it gives a value, use that value. Section 8 is the acceptance checklist.

---

## 0. Product frame (what this app is for)

The owner of a small business opens Takara to answer four questions, in this order:

1. **How much can I actually spend?** (spendable now, compared with the balance, plus runway)
2. **What is waiting, and on whom?** (the approval queue: who it waits on, how long it has waited, the deadline)
3. **What is due next?** (upcoming obligations, and whether money is reserved for them)
4. **What did Takara catch for me?** (refusals, frozen payout changes, ignored instructions, in plain English with proof links)

Every screen must serve one of these. Engineering detail (formulas, hashes, attestation numbers) stays one click away, never on the first read.

Hard constraints, all from the frozen contract and the founder's structure:

- The app **never approves**. Bill acceptance and vendor-change approval are policy-signer wallet actions. The UI says who an item waits on and how that person acts. It has no approve or reject button.
- Policy signing works **locally only** (`POST /api/policy/sign`). The hosted demo shows signing as off, and says why.
- Honesty labels are always visible: fictional fixture data, NEAR testnet, test token, and "the mainnet payout is a separate demo".
- Chat is read-only and for exceptions. Routine reading happens on screens.

---

## 1. Critique of the current app (top 10)

Evidence: screenshots of https://takara-ai.vercel.app/app at 382px and 1280px wide (2026-11-13), plus measurements from the live DOM.

| # | Problem | What the screenshot shows | Consequence |
|---|---|---|---|
| 1 | **No navigation and no hierarchy.** | A single scroll with one segmented control ("Owner view / Public ledger"). Figures, a table, a form and a chat are stacked as equal white boxes. | No view answers "what needs me". Everything has the same weight, so it reads as an admin page. |
| 2 | **Formulas under every number.** | Each KPI tile has a dashed rule and mono text such as `contract.get_config().balance` and `(treasury_balance - settled_outflow) / daily_recurring_burn`. On mobile the formulas wrap onto 3 lines, longer than the figure itself. | Debug output is the primary content. The owner reads code before reading money. |
| 3 | **"None" everywhere.** | The Flags column says "None" in 4 of 9 rows, and empty hashes render "None" too. | Emptiness is shown as data. Noise makes the 5 real flags harder to spot. |
| 4 | **Raw identifiers instead of names.** | Rows 7 and 8 read `new:6a77f4b28dfd` and `new:fb341c87866a`. A `#` column of 0–8 leads every row. Names carry "(fictional hosting vendor)" inline. | The two riskiest bills (a new vendor and a 900 new vendor above the limit) are the hardest to read. |
| 5 | **The table overflows its card.** | At 1280px the commitments table scrolls (scrollWidth 1154 > container 1110). The proposed destination is cut off at "railway-new-bank.test…", which is the single most important string on the page. At 382px the "Amount" header is cut off and a horizontal scrollbar appears (`min-width: 820px`). | The fraud signal is literally off-screen. |
| 6 | **Machine vocabulary.** | `claimed`, `accepted`, `settled`, `normal`, `approved cooling off`, `new vendor > limit`, `instruction ignored`, with no explanation and no "who" or "when". | The owner can't tell what is safe, what is stuck, or what to do. |
| 7 | **No dates, deadlines or ages.** | `due_day` is in the data but never shown. No relative time anywhere. | Payroll on Dec 1 looks the same as a bill on Jan 12. |
| 8 | **Nothing shows what Takara caught.** | `/api/decisions` is never called. Refusals are only reachable by typing into chat. There is no prevention counter (founder's addition #9). | The product's core value (blocked fraud, protected reserves) is invisible. |
| 9 | **The hero is weighted wrong.** | Four equal tiles: Balance 1400, Reserved 805, Spendable 75, Runway 34. Settled outflow (520) is used in the formula but never shown, so 1400 − 805 ≠ 75 and the numbers look broken. No bar shows how the balance is split. | The key insight, "only 75 of 1,400 is free", needs arithmetic the page doesn't support. |
| 10 | **The policy and sign flow are misleading on the hosted demo.** | Inputs are labelled `max_auto_pay`, `cooling_off_hours` in mono. The diff dialog shows raw JSON with base units (`"500000000"`). "Sign as policy signer" is enabled on the hosted site and only then fails. The header says "Owner console, local" on the public website. | Signing looks available when it isn't. The wrong environment label hurts trust. |

Secondary issues: chat answers echo raw codes (`` `would_break_commitments` ``) and ISO timestamps; the chat panel sits below the fold at half width; the public table repeats the overflow; the hosted banner is an inline-styled `div` outside the design system; there are no error, empty or per-section loading states beyond one shimmer.

---

## 2. Research: patterns worth borrowing

Sources were fetched 2026-11-13. "[snippet]" means the claim comes from a search-result summary, not a page that was opened.

| Pattern | Seen in | How Takara uses it |
|---|---|---|
| The status names the viewer: "Needs your confirmation" only when the connected wallet can sign; otherwise "Awaiting confirmations". | Safe{Wallet} (`useTransactionStatus.ts`, safe-wallet-monorepo) | The app can't know whether the viewer is a signer, so every item says "Waiting on: Policy signer (signer.takara-ai-hq.testnet)". It never says "needs you" as if the viewer could act. |
| One task feed ranked by urgency, with a due date and one action on each task. | Brex task overview (brex.com/product-announcements/new-task-overview-page); Ramp homepage "Requires your approval" (support.ramp.com/introduction-to-homepage) | The Approvals queue and the Overview "Needs attention" list are sorted by deadline. Each card has exactly one link: "View bill". |
| Bill tabs follow the lifecycle (Drafts, For approval, For payment, In-flight, History) and a "Next approver" column. | Ramp bill lifecycle (support.ramp.com …/4417814078611); Brex bill pay (brex.com/support/bill-pay-overview) | Bills filters: All, Waiting, Reserved, Paid, Flagged. Each row and drawer has a "Waits on" field. |
| Fraud alerts in two severities, with "new or changed bank details" as a named trigger. | Ramp Bill Pay fraud (support.ramp.com …/37791491771027) | Issue badges in two tones: red for "Payout changed" and "Instructions ignored", amber for "New vendor over limit" and "Provisional vendor". |
| A proposed vendor edit shows in a banner and never replaces live details until approved. A pending new vendor is "provisional". | Ramp vendor edits approval (support.ramp.com …/31702539953171) | Approval cards show Registered and Proposed destinations side by side, with Registered marked as the one in use. "Provisional vendor" uses Ramp's word. |
| Verification has its own vocabulary, separating "can't verify" from "risk found"; red means do not pay. | Trustpair (trustpair.com/platform/evaluate/); Eftsure [snippet] | Vendor status pills: Registered, Provisional, New (awaiting signer), Payout change frozen, Cooling off, Change rejected. |
| Approved and paid are separate facts. | Bill.com payment approvals (bill.com/product/payment-approvals) [snippet] | Bill drawer shows a three-step timeline (Received, Reserved, Paid) plus "Accepted by". |
| Burn, runway and money in/out, with questions you can click to ask. | Mercury Insights (mercury.com/blog/introducing-insights) | Runway sits next to spendable in the hero. Bills that Takara refused have an "Ask why" button that opens chat with the question filled in. |
| Bill pay inbox ordered by approval status and due date; duplicate detection. | Mercury Bill Pay (mercury.com/bill-pay) | Same ordering. "Duplicate invoice rejected" is an activity sentence and a prevention category. |
| Customisable home modules; banners that can be dismissed. | Brex home (brex.com/support/home-page); Ramp homepage | Not adopted in v1: fixed modules keep the build small. The demo banner can be dismissed for the session only. |

Not found or blocked: Request Finance (403), Coinshift (repositioned, docs missing), Mercury and Bill.com help centers (403). No source documented empty states, so section 4.9 follows the founder's rule instead: "an empty screen is an invitation to act".

---

## 3. Information architecture

### 3.1 Views and routes

Hash routing (works on both hosts without server changes). The URL reflects state, so views, filters and open drawers can be deep-linked.

| Nav label | Route | Page `<h1>` | Answers | Data |
|---|---|---|---|---|
| Overview | `#/overview` (default; also used for an empty or unknown hash) | Overview | Can I spend? What's waiting? What's due? What was caught? | report, public, decisions, policy |
| Approvals | `#/approvals` | Needs attention | What is waiting, on whom, for how long, until when? | report (commitments), public (`vendor_changes`, `signers`), decisions (ages), policy (`max_auto_pay`, `cooling_off_hours`) |
| Bills | `#/bills`, `#/bills?status=waiting\|reserved\|paid\|flagged`, `#/bills/<id>` (drawer) | Bills | Every obligation, its state, due date, destination and evidence | report, decisions, public (hashes, attestation) |
| Vendors & team | `#/vendors`, `#/vendors/<vendor_id>` (drawer) | Vendors & team | Who we pay, where to, how much is open or paid, and any destination change | report (grouped by `vendor_id`) |
| Policy | `#/policy` | Policy | What limits bind the agent, who can change them, preview a change | policy/current, policy/diff, policy/sign, public (signers, policy hash) |
| Ask Takara | `#/ask` | Ask Takara | Exceptions: "why was X blocked?" | chat |
| Public ledger | `#/ledger` | Public ledger | What a stranger sees on-chain, and what stays sealed | public |
| (not in nav) | `#/activity`, `#/activity?filter=caught` | Activity | The full plain-English decision history | decisions, report, public |

Activity opens from "Show all activity" on Overview and from the "Caught for you" metric.

### 3.2 Navigation

**Desktop (≥1024px): left sidebar, 240px wide (224px at 1024–1279), fixed, full height, background `--surface`, right border `--line`.**

```
┌────────────────────────┐
│ [logo] Takara AI       │  brand row, 64px tall
│ treasury.takara-ai-…  ⧉│  treasury account, mono 12px, truncated, copy button
├────────────────────────┤
│ ▣ Overview             │  nav items: 40px tall, 20px icon + 14px/500 label
│ ✓ Approvals        (1) │  count badge = items waiting on a signer
│ ▤ Bills                │
│ ◫ Vendors & team       │
│ ⚙ Policy               │
│ ◌ Ask Takara           │
│ ◎ Public ledger        │
│                        │
│ (flex spacer)          │
├────────────────────────┤
│ [Testnet] [Fictional data]  │  env tags
│ Product page · GitHub  │  13px links
└────────────────────────┘
```

- Active item: background `--accent-soft`, text `--accent-ink`, a 3px `--accent` bar on the left edge, and `aria-current="page"`.
- Hover: background `--sunken`.
- Count badge: fully round, min-width 20px, 12px/600, `--warn-soft` background with `--warn` text. Hidden when the count is 0. Accessible name: "Approvals, 1 waiting on a signer".

**Tablet (768–1023px): 72px icon rail.** Each item shows its icon with an 11px/500 label under it (no tooltips needed). Items are 64px tall and the full rail width. The count badge sits at the icon's top-right. The env tags collapse into one "Test" tag with the full text in `title` and in a visually hidden span.

**Mobile (<768px): top bar plus bottom tab bar.**

- Top bar: 56px, sticky, `--surface`, bottom border. Logo (24px), the "Takara AI" wordmark, then right-aligned `[Testnet]` and `[Fictional]` tags.
- Bottom bar: fixed, 64px plus `env(safe-area-inset-bottom)`, 5 equal items: Overview, Approvals (badge), Bills, Ask, More. Icon above an 11px label.
- "More" opens a bottom sheet (a `<dialog>`) listing Vendors & team, Policy, Public ledger, then Product page and GitHub, plus the treasury account with a copy button. Each sheet item is 48px tall.
- `<main>` gets `padding-bottom: calc(64px + env(safe-area-inset-bottom) + 16px)` so the bar never covers content.

**Icons:** custom inline SVG, 20×20 viewBox, `stroke="currentColor"`, `stroke-width="1.6"`, round caps and joins, `fill="none"`, `aria-hidden="true"`.

| Icon | Shape |
|---|---|
| Overview | Four 6×6 rounded squares (rx 1.5) in a 2×2 grid |
| Approvals | A tray (U-shape) with a check above it |
| Bills | A document with a folded corner and three lines |
| Vendors & team | Two overlapping squircles (rx 4) |
| Policy | Three horizontal sliders with knobs |
| Ask | A speech bubble with a tail at the bottom-left |
| Public ledger | An open book |
| More | Three dots |

No icon library.

### 3.3 Global elements, on every view

1. Skip link "Skip to content", targeting `#main`. Visible on focus.
2. Demo banner (hosted only, section 5.8). It sits above the content area, not over the sidebar, and can be dismissed for the session (`sessionStorage` key `takara.demoBanner`, wrapped in try/catch).
3. Treasury state banner (only when needed):
   - `public.paused === true`: "The treasury is paused. No payment can settle until an owner resumes it." Tone bad.
   - `public.agent === null` or empty: "The agent's access is revoked. It can't record or pay bills until an owner restores it." Tone warn.
4. Page header in each view: `<h1>` (24px/600), an optional one-line description (14px, `--muted`), and on the right "Updated 2 min ago" (13px, `--muted`, live-updating every 30s) plus a ghost "Refresh" button.
5. Toast region (section 4.11).

---

## 4. Views and components

### 4.0 Shared derived model (implement once, use everywhere)

Fetch all four GET endpoints in parallel on load and on Refresh. Each view renders as soon as its own data arrives. A failed endpoint only breaks the sections that depend on it (section 4.10).

```js
const TOKEN = document.querySelector('meta[name="takara-token"]').content;
const DEMO = TOKEN === "__TAKARA" + "_TOKEN__";   // concatenate: the local server replaces only the FIRST literal occurrence
const DAY = 86400000;
const todayDay = () => Math.floor(Date.now() / DAY); // UTC day number, same basis as due_day
const nsToMs = (ns) => Number(BigInt(ns) / 1000000n);
```

Per commitment `c` from `/api/owner/report`, derive:

| Field | Rule |
|---|---|
| `name` | See section 5.1 |
| `kind` | `"payroll"` if `vendor_id === "payroll"`; `"team"` if `vendor_id` starts with `member:`; `"new"` if it starts with `new:`; otherwise `"vendor"` |
| `fictional` | true if the vendor string contains `(fictional…)` |
| `amountNum` | `Number(c.amount)` |
| `due` | `c.due_day > 0 ? c.due_day : null` |
| `flagsSet` | Booleans from the report; if missing, use bits of `c.flags`: 1 provisional, 2 new vendor over limit, 4 instructions ignored, 8 destination changed |
| `change` | Entry in `public.vendor_changes` where `commitment_id === String(c.id)` (may be absent) |
| `coolingUntil` | If `c.vendor_change === "approved_cooling_off"` and `change?.decided_at`: `nsToMs(change.decided_at) + policy.cooling_off_hours * 3600000`; else null |
| `claimedAt` | `at` of the newest decision with a `commitment_claimed` event whose `data[0].commitment_id === String(c.id)`; else null |
| `waitsOn` | See below |
| `status` | See section 4.2.2 |

`waitsOn(c)`, evaluated in this order; first match wins:

1. `c.state === "settled"` → null.
2. `c.vendor_change === "suspended_destination_mismatch"` → `{ who: "signer", label: "Policy signer", task: "approve or reject the new payout destination", since: change?.requested_at }`
3. `c.vendor_change === "approved_cooling_off"` → `{ who: "timer", label: "Cooling-off period", task: coolingUntil > now ? "payment unlocks " + fmtDateTime(coolingUntil) : "cooling-off has ended; payment can be authorized", since: change?.decided_at }`
4. `c.state === "claimed" && (c.new_vendor_over_limit || amountNum > policy.max_auto_pay)` → `{ who: "signer", label: "Policy signer", task: "accept this bill so money is reserved" }`
5. `c.state === "claimed"` → `{ who: "policy", label: "Takara policy check", task: "accept within policy or refuse" }`
6. Otherwise null (accepted and reserved; nothing is waiting).

The signer account names come from `public.signers` (render as "Policy signer (signer.takara-ai-hq.testnet)"; with several signers, "Policy signer (any of 2)" with the accounts in `title`).

### 4.1 Overview

**Desktop wireframe (content column max-width 1120px, 12-column grid, 24px gutters, 32px page padding):**

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Overview                                                Updated 1 min ago [Refresh]│
│ treasury.takara-ai-hq.testnet on NEAR testnet                                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HERO (panel, span 12)                                                             │
│ ┌──────────────────────────────────────────────┬───────────────────────────────┐ │
│ │ Spendable now                                │ Runway                        │ │
│ │ 75 USDC                         (48px/600)   │ 34 days     above your 7-day  │ │
│ │ of 1,400 USDC in the treasury                │             floor             │ │
│ │                                              ├───────────────────────────────┤ │
│ │ [████ paid 520 ███][▓▓▓▓▓ reserved 805 ▓▓▓▓▓▓][█ 75]│ Waiting on a signer   │ │
│ │  ● Already paid 520  ● Reserved for bills 805│ 1 bill · 900 USDC   View ›    │ │
│ │  ● Spendable 75                              ├───────────────────────────────┤ │
│ │ ▸ How is this calculated?                    │ Caught for you                │ │
│ │                                              │ 12   frozen 1 · ignored 2 …   │ │
│ └──────────────────────────────────────────────┴───────────────────────────────┘ │
├───────────────────────────────────────────────┬──────────────────────────────────┤
│ Needs attention (span 7)        View all (4) ›│ Coming up (span 5)               │
│ [approval card, compact] ×3                    │ 645 USDC due in the next 30 days,│
│                                                │ all reserved.                    │
│                                                │ Dec 1   Payroll run   600 Reserved│
│                                                │ Dec 5   Inkwell       45  Reserved│
│                                                │ Dec 20  New vendor…   40  Reserved│
│                                                │ Dec 30  New vendor…  900 Waiting │
│                                                │ Jan 12  Railway      120 Frozen… │
│                                                │ All bills ›                      │
├───────────────────────────────────────────────┴──────────────────────────────────┤
│ Activity (span 12)                                         Show all activity ›    │
│ Today                                                                            │
│ ⦸ Blocked: paying Ana 400 USDC would break money reserved for Payroll run and    │
│   Railway.  12 min ago · Takara agent · View transaction                          │
│ … (8 most recent items)                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.1 Hero

The hero is one panel: `--surface`, 1px `--line` border, `--r-lg` radius, `--lift` shadow. Inside it a 12-column grid: the left region spans 7, the right region spans 5. On tablet and mobile the regions stack (left first). The left region has 28px padding. The right region is three stacked rows separated by 1px `--line`, with a 1px `--line` left border on desktop.

**Left region, "Spendable now":**

- Label "Spendable now", 14px/500, `--ink-2`.
- Value: `fmtMoney(figures.spendable)` at `--t-hero` (48px/52px, 600, tracking −0.025em, tabular numbers), colour `--accent-ink`. The symbol is set at 20px/500 in `--muted` after a thin space.
- If spendable < 0: value in `--bad`, prefixed with U+2212, and the label becomes "Short by" with the absolute value.
- Sub-line: "of {fmtMoney(treasury_balance)} in the treasury", 15px, `--muted`.
- **Allocation bar.** This is the page's one memorable element. Height 14px, `--r-sm` radius on the outer ends only, 2px `--surface` gaps between segments. It sits 20px below the sub-line.

  | Segment (left to right) | Value | Colour |
  |---|---|---|
  | Already paid | `settled_outflow` | `--seg-paid` #8C918C |
  | Reserved for bills | `reserved` | `--seg-reserved` #4A8F84 |
  | Spendable | `max(spendable, 0)` | `--seg-spendable` #0B5D52 |

  - Each segment's width is `value / treasury_balance` as a flex-grow ratio, with a minimum of 4px when the value is above 0.
  - If `settled + reserved > balance`, scale the segments to their sum and add a `--bad` outline to the bar.
  - Show the bar as `role="img"` with `aria-label="Of 1,400 USDC: 520 already paid, 805 reserved for bills, 75 spendable."`.
- **Legend** under the bar, 12px top margin. One flex-wrap row of three items, each a 10px square swatch (radius 2) + label (13px `--muted`) + value (13px/600 `--ink`, tabular).
- **Disclosure:** `<details>` with summary "How is this calculated?" (13px/500, `--accent`, chevron rotates 90° on open). The body is a definition list with one row per figure in this order: Treasury balance, Already paid, Reserved for bills, Spendable, Daily recurring burn, Runway. Each row has the label, the plain sentence from section 5.6, and the formula from `report.queries[key]` in `--mono` 12px `--muted`. Add one closing line: "Figures come from deterministic queries over the ledger. No model writes a number."

**Right region, three metric rows (component: Metric row, 4.2.1):**

1. **Runway**
   - Value: "{runway_days} days" (32px/600).
   - Context, compared with `policy.min_runway_days`:
     - runway ≥ floor × 2: "above your {n}-day floor" in `--muted`.
     - floor ≤ runway < floor × 2: "close to your {n}-day floor" in `--warn`.
     - runway < floor: "below your {n}-day floor" in `--bad`.
   - If `runway_days == null`: value "No recurring burn", 20px.
   - Secondary line: "Recurring burn {daily_recurring_burn} USDC a day".
2. **Waiting on a signer**
   - Value: the count of commitments with `waitsOn.who === "signer"`.
   - Context: "{n} bill(s) · {sum} USDC".
   - Link "View ›" to `#/approvals`.
   - If 0: value "0" and context "Nothing is waiting on a signer".
   - If any item has `who === "timer"`, add the line "{n} cooling off".
3. **Caught for you**
   - Value: the prevention total (section 4.1.4).
   - Context: up to three non-zero categories as "frozen 1 · ignored 2 · blocked 1", then "+N more" if needed.
   - The whole row is a link to `#/activity?filter=caught`.
   - If 0: "Nothing caught yet. Payout changes, duplicates and hidden instructions are counted here."

#### 4.1.2 Needs attention (Overview card)

- Heading "Needs attention" (17px/600) and a right link "View all ({n}) ›" to `#/approvals`.
- Shows up to 3 compact approval cards (4.2.6, compact variant), sorted as in 4.3.
- Empty: "Nothing needs attention. Bills above {max_auto_pay} USDC, new vendors over the limit and payout changes appear here."

#### 4.1.3 Coming up

- Heading "Coming up".
- Summary sentence, 15px. Take unsettled commitments with `due` in `[todayDay(), todayDay()+30]`:
  - With items: "{sum} USDC due in the next 30 days, all reserved." If some aren't reserved, end with "…, {x} USDC not reserved yet." instead. Overdue unsettled bills (`due < today`) put this first: "{n} overdue."
  - No items: "Nothing due in the next 30 days."
- List: the next 5 unsettled commitments by `due` ascending (`due == null` excluded; ties broken by `id` ascending). Each is a link row (4.2.4, compact variant):
  - date block (month 12px `--muted` above day 17px/600, 44px wide)
  - name, with "Monthly" or "Weekly" under it in 13px `--muted` when recurring
  - amount, right-aligned and tabular
  - status pill
- Footer link "All bills ›".

#### 4.1.4 "Caught for you" prevention counter

Count distinct incidents from two sources, then merge on a key so each incident counts once.

| Category (label in UI) | From decisions | From report flags | Dedupe key |
|---|---|---|---|
| Payout changes frozen | `value.reason === "vendor_destination_mismatch"` | `destination_mismatch` or flag bit 8 | `dest:{commitment_id}` |
| Hidden instructions ignored | `commitment_claimed` event with `flags & 4` | `injection_flagged` or bit 4 | `inject:{commitment_id}` |
| Duplicate invoices rejected | `reason === "duplicate_evidence"` | none | `dup:{value.original}` |
| Reserve breaches blocked | `reason === "would_break_commitments"` or `"below_min_runway"` | none | `reserve:{commitment_id}` |
| Replayed or altered payments refused | `reason === "nonce_used"` or `"authorization_mismatch"` | none | `{reason}:{commitment_id}` |
| Out-of-scope agent actions refused | `ok === false` and `failure` is `E_NOT_POLICY_SIGNER`, `E_NOT_OWNER`, `E_AGENT_REVOKED`, `E_NOT_AGENT`, or a failure object containing "Method new is private" | none | `scope:{method}:{code}` |

- `vendor_change_cooling_off` and `needs_signer_acceptance` are **holds, not catches**. They show in Activity but are not counted.
- With today's local log this gives 1 + 2 + 1 + 1 + 2 + 5 = 12. The hosted endpoint currently returns `[]`, so the counter falls back to flags only (3: one frozen payout change, two ignored instructions) and still works.
- The disclosure under the Activity filter says: "Counted from recorded decisions and bill flags. Each incident is counted once."

#### 4.1.5 Activity (Overview card)

- The 8 most recent activity items (4.2.7), grouped under day headings ("Today", "Yesterday", or "Nov 12").
- Link "Show all activity ›".
- Empty (decisions `[]`): "No decisions are recorded on this deployment yet. Flags on each bill are still shown in Bills."

**Mobile Overview order:** hero left region, then the three metric rows as a 3-row list, then Needs attention, Coming up, Activity.

### 4.2 Components

#### 4.2.1 Metric row (KPI)

- Grid of `label / value / context`. Padding 20px 24px.
- Label 13px/500 `--ink-2`. Value 32px/600 tabular, tracking −0.02em (units at 15px/500 `--muted`). Context 13px `--muted` (tone colour when stated).
- When it is a link, the whole row is an `<a>`. Hover: background `--sunken`. A trailing chevron at 16px.
- No formulas, no borders inside the row.

#### 4.2.2 Status pill (bill status)

- Inline-flex, height 22px, padding 0 8px, **radius 6px** (square-ish, not a capsule), 12.5px/500, a 1px border, and a 6px dot before the text.
- Derived status, first match wins:

| Condition | Text | Tone (bg / text / border) |
|---|---|---|
| `vendor_change === "suspended_destination_mismatch"` | Frozen | bad: `--bad-soft` / `--bad` / #F1D2D3 |
| `vendor_change === "approved_cooling_off"` and state ≠ settled | Cooling off | warn: `--warn-soft` / `--warn` / #F0DDB8 |
| `vendor_change === "rejected"` and state ≠ settled | Change rejected | bad |
| state `claimed` and `waitsOn.who === "signer"` | Awaiting signer | warn |
| state `claimed` | Received | neutral: `--sunken` / `--ink-2` / `--line` |
| state `accepted` | Reserved | accent: `--accent-soft` / `--accent-ink` / #CFE2DC |
| state `settled` | Paid | quiet: `--surface` / `--muted` / `--line-2`, with a check glyph instead of the dot |

- Never print the raw state word. In the bill drawer timeline, "Received / Reserved / Paid" correspond to claimed / accepted / settled.

#### 4.2.3 Issue badge

- Same geometry as the status pill, but with a 12px leading glyph instead of the dot (a diamond for red, a triangle for amber). Rendered only when the flag is set. **No badge, and no text, when there are no issues.**

| Flag | Badge text | Tone | Sentence in the drawer |
|---|---|---|---|
| `destination_mismatch` / bit 8 | Payout changed | bad | "This invoice asks to pay {proposed_destination} instead of the registered {destination}. Payment stays frozen until a policy signer approves the change and the {cooling_off_hours}-hour cooling-off passes." |
| `injection_flagged` / bit 4 | Instructions ignored | bad | "The invoice text contained instructions for the agent. Takara treats document text as data and ignored them. The policy did not change." |
| `new_vendor_over_limit` / bit 2 | New vendor over limit | warn | "This is the first bill from this vendor and it is above the new-vendor auto limit, so a policy signer must accept it." |
| `provisional_vendor` / bit 1 | Provisional vendor | warn | "First bill from this vendor, small enough to pay without a signature. Takara flagged it so you can check the vendor." |

#### 4.2.4 Bill row

**Desktop and tablet (≥768px):** a semantic `<table>` with `table-layout: fixed`, width 100%, **no min-width**. Columns:

| Column | Width | Content |
|---|---|---|
| Bill | auto (≥ 34%) | Name (15px/500, truncated with ellipsis, full text in `title`), the "Fictional" tag (5.1), and a 13px `--muted` sub-line with the destination (mono 12.5px, truncated) and "· Monthly" if recurring |
| Due | 120px | Date (14px), and relative time under it (12.5px `--muted`; `--bad` if overdue and unsettled) |
| Amount | 120px | Right-aligned, 15px/600, tabular, symbol 12.5px `--muted` |
| Status | 132px | Status pill |
| Issues | 180px | Issue badges, wrapping; at 768–1023px this column is hidden and the badges move under the name |
| Waits on | 160px (≥1280 only) | `waitsOn.label`, or nothing |

- The whole row opens the drawer. Put the name in a `<a href="#/bills/{id}">` and stretch it over the row with `::after { inset: 0 }`, with the row `position: relative`, so middle-click works.
- Row height ≥ 56px. Hover: background #FCFCFA. Focus-visible ring on the row via `:focus-within`.

**Mobile (<768px):** each bill is an `<li>` card in a `<ul>`, padding 14px 16px, divided by 1px `--line`:

```
Payroll run                         600 USDC
Monthly · Due Dec 1 (in 18 days)   [Reserved]
[Payout changed] [Instructions ignored]          ← only if any
```

#### 4.2.5 Vendor row

- Columns (desktop): Vendor (name + kind tag + "Fictional" tag), Pays to (mono destination + chain in 12px `--muted`), Bills (count), Open (sum of claimed + accepted), Paid (sum of settled), Status (vendor status pill).
- Vendor status, first match wins:
  1. any commitment suspended → "Payout change frozen" (bad)
  2. any approved_cooling_off → "Cooling off" (warn)
  3. any rejected → "Change rejected" (neutral)
  4. kind new with an unaccepted bill → "New, awaiting signer" (warn)
  5. any provisional → "Provisional" (warn)
  6. otherwise "Registered" (accent), with `title`: "The payout destination is on file in the sealed vendor registry. An invoice with a different destination is frozen."
- Mobile: a card with the name and status on line 1, and the destination and open amount on line 2.

#### 4.2.6 Approval card

Full variant (Approvals view):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Frozen]  Railway [Fictional]                                    120 USDC    │
│ Payout change: the invoice asks to pay a different account.                  │
│ ┌ Registered destination (in use) ─────┐ ┌ Proposed by invoice ──────────────┐│
│ │ railway-pay.testnet                  │ │ railway-new-bank.testnet          ││
│ │ NEAR                                 │ │ NEAR                              ││
│ └──────────────────────────────────────┘ └───────────────────────────────────┘│
│ Waits on   Cooling-off period · payment unlocks Nov 13, 4:29 PM (in 3 h)      │
│ Waiting    1 day      Deadline  Jan 12 (in 60 days)                          │
│ View bill        How is this approved? ▸                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Container: `--surface`, 1px `--line` border, `--r-md`, padding 20px. The left border is 3px in the tone colour (bad for Frozen, warn for Awaiting signer and Cooling off, `--line-2` for policy-check items).
- **Line 1:** status pill, name (17px/600, truncated), "Fictional" tag, and the amount right-aligned (17px/600 tabular).
- **Line 2, headline sentence (15px `--ink-2`):**

  | Type | Sentence |
  |---|---|
  | Frozen or cooling off | "Payout change: the invoice asks to pay a different account." |
  | New vendor over limit | "New vendor above the auto limit. A signer must accept it before money is reserved." |
  | Above max_auto_pay | "{amount} is above your {max_auto_pay} USDC auto-pay limit." |
  | Policy check with instructions ignored | "Invoice text tried to instruct the agent. Ignored. Not reserved yet." |
  | Policy check, other | "Received. Not reserved until accepted." |

- **Destination comparison:** only when `proposed_destination` is non-null. A two-column grid (stacked under 560px). Each box: `--sunken` background, `--r-sm`, padding 12px 14px.
  - Left box title "Registered destination (in use)" (12.5px/500 `--ink-2`).
  - Right box title "Proposed by invoice" (12.5px/500 `--bad`), with a 1px `--bad` border at 40% opacity (#E3B7B9).
  - Values in mono 14px, `overflow-wrap: anywhere` (never truncated), chain under each.
  - Between the boxes on desktop, a "≠" glyph, 16px, `--muted`, `aria-hidden`. Screen-reader text: "differs from".
- **Facts grid** (`<dl>`, two columns of term/description, 13px term `--muted`, 14px description):
  - **Waits on:** `waitsOn.label`, the signer account in mono 13px (signer type), then " · " and the task.
  - **Waiting:** relative age from `waitsOn.since` (ns) or `claimedAt`. **Omit the pair if unknown.** Don't print "unknown".
  - **Deadline:** `fmtDate(due)` plus relative time. Omit if there's no due date.
- **Actions row:**
  - "View bill" (text link, 14px/500, `--accent`) to `#/bills/{id}`.
  - `<details>` "How is this approved?". Its body depends on the type:
    - **Signer:** "A policy signer approves this from their own wallet, outside this app. The contract rejects anyone else with E_NOT_POLICY_SIGNER. This app shows the queue. It can't approve."
    - **Timer:** "A policy signer already approved the new destination. Takara still won't pay it until the {cooling_off_hours}-hour cooling-off ends, so a hijacked approval can be caught in time."
    - **Policy check:** "Takara's policy engine accepts this automatically if it fits the policy, or refuses it with a named reason. Nobody needs to act."
- **No approve, reject or pay button. Ever.**
- **Compact variant (Overview):** line 1 plus the headline sentence plus a single meta line, "Waits on {label} · Deadline {date}". No destination boxes, but when there is a proposed destination, add a red "Payout changed" badge after the name. The whole card is a link to `#/bills/{id}`.

#### 4.2.7 Activity item

```
[icon]  Blocked: paying Ana 400 USDC would break money reserved for Payroll run and Railway.
        12 min ago · Takara agent · View transaction
```

- Layout: a 28px icon column and a text column. The sentence is 15px `--ink`. The lead word (Blocked, Held, Frozen, Refused, Paid, Recorded, Accepted…) is 600 weight; the rest is 400.
- Meta line, 13px `--muted`:
  - relative time (`<time datetime>`, full local date-time in `title`)
  - actor role (5.4)
  - "View transaction" link to `https://testnet.nearblocks.io/txns/{tx}`, `target="_blank" rel="noopener"`, with a visually hidden " (opens in a new tab)"
  - "· Bill" link to `#/bills/{id}` when a commitment applies
- Icon tones (16px glyph in a 28px circle):

  | Kind | Circle / glyph | Glyph |
  |---|---|---|
  | caught (blocked, refused, frozen, ignored) | `--bad-soft` / `--bad` | slashed circle |
  | held (waiting) | `--warn-soft` / `--warn` | clock |
  | money moved (paid, funded, recovered) | `--accent-soft` / `--accent-ink` | check |
  | admin (paused, agent set or revoked, reconcile) | `--sunken` / `--ink-2` | dot |

- One decision produces **one** item (rules in 5.5).

#### 4.2.8 Bill drawer (detail)

A `<dialog class="drawer">` opened with `showModal()`.

- Desktop and tablet: anchored right, width `min(520px, 100vw)`, full height.
- Mobile: full screen, sliding up.
- Header: name (20px/600), amount (24px/600), status pill, close button (an "×" icon button, 44×44, `aria-label="Close bill details"`). Closing with Esc, the button or a backdrop click returns focus to the row that opened it and resets the hash to `#/bills` (or the previous route).

Sections, in order (hide a whole section when it has no content):

1. **Timeline:** three steps, Received → Reserved → Paid. Completed steps are filled `--accent`; the current step is outlined; future steps are `--line-2`. Under the active step, the waits-on sentence.
2. **Issues:** each flag's drawer sentence (4.2.3), as a callout in its tone.
3. **Destination:** registered destination plus chain; the proposed-destination comparison if present (same boxes as 4.2.6).
4. **Details** (`<dl>`), each pair only if it has a value:
   - Due
   - Repeats: Monthly or Weekly
   - Priority: Critical (payroll), Normal, Discretionary. Explain in `title`: "Critical bills are paid first and are protected by reserves."
   - Accepted by: "Policy signer" for `s`, "Takara, within policy" for `p`
   - Vendor (link to the vendor drawer)
   - Bill number: "#{id}" in 13px `--muted`, so references to bill numbers in chat can be matched
5. **Activity for this bill:** activity items filtered to this `commitment_id`.
6. **On-chain proof** (`<details>`, closed by default): from the `public.commitments` entry with the same id:
   - commitment hash and evidence hash (truncated, copy buttons)
   - attestation link "Attestation, request {request_no}" to `https://testnet-api.outlayer.ai/attestations/by-request/{request_no}`
   - settled nonce, if present
7. **For settled bills**, a note: "Paid on NEAR testnet. The confidential mainnet payout is a separate demo and isn't enforced by this contract."
8. **"Ask why" button** (secondary): shown only when there is a refusal decision for this bill. Opens `#/ask` and submits "why was the {amount} payment blocked?".

#### 4.2.9 Vendor drawer

Same shell as the bill drawer. It shows:

- name, kind and tags
- vendor status pill
- registered destination and chain, with a copy button
- open and paid totals
- the list of this vendor's bills (compact bill rows)
- if a destination change exists: the comparison boxes and the change record (status sentence, decided by role and account, decided at)

For team members (`member:`), add: "Team members' pay is visible to owners and managers only. Other members never see it."

#### 4.2.10 Policy diff dialog

`<dialog>`, max-width 560px, `--r-lg`, `--shadow-pop`.

- Title: "Review policy change".
- Step indicator: three steps in a row, "1 Proposed" → "2 Signed by a policy signer" → "3 Live". Step 1 is active.
- **Change table** (a real `<table>`): Setting | Current | Proposed.
  - Rows only for keys in `diff` other than `version`.
  - Plain labels (5.7). `max_auto_pay` values in `diff` are base units: divide by `factor = Number(diff.max_auto_pay.from) / policyCurrent.max_auto_pay` (equals 1e6 today).
  - Format as "500 USDC", "24 hours", "7 days".
  - Proposed values in 600 weight, with an up or down arrow glyph and screen-reader text "raised to" or "lowered to".
- Under the table:
  - "Policy version {from} → {to}"
  - "New policy hash {short(next_hash)} (now {short(current_hash)})" in mono 12.5px, with copy
  - "Signer: {signer}"
- `<details>` "Show raw diff" containing the JSON `<pre>`.
- **No changes:** replace the table with "Nothing changed. Edit a value to preview a new version." and disable the sign button.
- **Footer:**
  - Local: [Cancel] [Sign as policy signer] (primary). While signing, the button reads "Waiting for signature and finality…" with a 14px spinner, disabled.
    - Success: close the dialog. Toast "Policy v{to} signed and live.", with a "View transaction" link. Refetch policy, public and report.
    - Failure: inline error in the dialog, `role="alert"`: "Not signed: {plain failure}" (map `E_NOT_POLICY_SIGNER` → "this key isn't a policy signer").
  - Hosted (DEMO): [Close] plus a disabled button "Signing is off in this demo", and under it (13px `--muted`): "A public website never holds a signer's key. A policy signer applies this version from their own machine." **The hosted page never calls `/api/policy/sign`.**

#### 4.2.11 Toasts

- Region: a fixed `<div role="status" aria-live="polite">`. Bottom-right on desktop, 24px inset. On mobile, centred above the bottom bar.
- Toast: `--ink` background, white 14px text, `--r-md`, padding 12px 16px, max-width 400px, optional link (#BFE3DA, underlined), close button (aria-label "Dismiss").
- Auto-dismiss after 6s, paused on hover or focus. At most 3 stacked.
- Used for: policy signed, hash copied ("Copied"), refresh failed.
- **Never use toasts for approvals**, which don't exist in this app.

#### 4.2.12 Loading skeletons

- Each section renders a skeleton matching its final shape (hero: label bar 120×12, value bar 180×40, bar 100%×14, legend 3× 90×10; rows: 3 lines per row ×5).
- Colour `--sunken`, radius 4. Shimmer only under `prefers-reduced-motion: no-preference` (1.4s linear).
- Container `aria-busy="true"` while loading. A visually hidden "Loading bills…" for screen readers.
- The owner report takes 2–6s (RPC plus WASM), so the skeleton must not look broken: no layout shift when the data arrives (reserve the same heights).

#### 4.2.13 Error state (per section)

- Inline block in place of the section content: `--bad-soft` background, `--r-md`, padding 16px.
  - Title (15px/600 `--bad`): e.g. "Couldn't load the owner report."
  - Detail (14px `--ink-2`): the server's `error` message.
  - Button "Try again" (secondary), which refetches only that endpoint.
- Error titles by endpoint:

  | Endpoint | Error title |
  |---|---|
  | report | "Couldn't load the owner report." |
  | public | "Couldn't read the treasury from NEAR testnet." |
  | decisions | "Couldn't load recorded decisions." |
  | policy | "Couldn't load the current policy." |
  | chat | inline in the chat log: "Takara couldn't answer: {message}. Try again." |

- A 403 "missing or wrong dashboard token" error shows the hint: "Open the dashboard from the link printed by the local server."

### 4.3 Approvals ("Needs attention")

- `<h1>` "Needs attention".
- Description: "Everything waiting, who it waits on, how long it has waited, and its deadline. Approvals happen in a signer's wallet, not here."
- Three sections, each an `<h2>` with a count, in this order. A section with 0 items is hidden; if all are empty, show the empty state.
  1. **Waiting on a signer** (`who === "signer"`)
  2. **Waiting on time** (`who === "timer"`)
  3. **Pending policy check** (`who === "policy"`). Add a sub-description: "Takara decides these automatically. Shown so nothing is stuck out of sight."
- Sort within each section: `due` ascending (null last), then amount descending.
- Full approval cards (4.2.6), stacked with 12px gaps, in a single column of max-width 760px. This is a queue, not a grid.
- Empty: illustration-free block with the heading "Nothing is waiting" and the text "Bills above {max_auto_pay} USDC, first bills from new vendors over the limit, and payout destination changes land here. Takara pays everything else within policy." Plus a link "See all bills".

With today's data:

| Section | Items |
|---|---|
| Waiting on a signer (1) | New vendor · bigagency.testnet, 900 USDC, deadline Dec 30 |
| Waiting on time (1) | Railway, 120 USDC, payout change cooling off |
| Pending policy check (2) | Railway, 120 USDC, instructions ignored (two bills: #5 and #6) |

### 4.4 Bills

- `<h1>` "Bills".
- Description: "Invoices, subscriptions, payroll and reimbursements. Money is reserved only when a bill is accepted."
- **Summary strip** above the list: one sentence, 15px: "{n} open bills · {reserved} USDC reserved · {unreserved} USDC not reserved yet · {paid} USDC paid".
- **Filter:** a segmented control (`role="tablist"` is wrong for filters; use a group of `<a>` links with `aria-current`, so the URL updates):

  | Filter | Shows |
  |---|---|
  | All ({n}) | everything |
  | Waiting ({n}) | `waitsOn` non-null |
  | Reserved ({n}) | state accepted and no active change |
  | Paid ({n}) | settled |
  | Flagged ({n}) | any issue flag |

  It scrolls horizontally inside its own container on mobile (`overflow-x: auto`, scrollbar hidden, edge fade), never the page.
- **Sort:** unsettled first by `due` ascending (null last); settled last by `due` descending.
- List: bill rows (4.2.4). Clicking opens the drawer.
- Empty, per filter:
  - All: "No bills yet. Takara records a bill when an invoice arrives. Nothing is reserved until it's accepted."
  - Waiting: "Nothing is waiting."
  - Paid: "No bills paid yet."
  - Flagged: "No flagged bills. Payout changes, hidden instructions and new vendors show up here."

### 4.5 Vendors & team

- `<h1>` "Vendors & team".
- Description: "Who Takara pays and where. A payout destination can't change without a signer and a cooling-off period."
- Group commitments by `vendor_id`.
- Two `<h2>` sections:
  1. **Vendors**: kind vendor or new, sorted by status severity, then name.
  2. **Team and payroll**: kind team or payroll.
- Vendor rows (4.2.5). Clicking opens the vendor drawer (`#/vendors/{encodeURIComponent(vendor_id)}`).
- Name and destination for a group come from the most recent commitment with `destination_mismatch === false` (the registered destination). Fall back to any commitment.
- Empty: "No vendors yet. Vendors are added when their first bill is accepted."

With today's data:

| Section | Rows |
|---|---|
| Vendors | Railway [Fictional] (Cooling off), Inkwell Design Tools [Fictional] (Registered), New vendor · bigagency.testnet (New, awaiting signer), New vendor · tinylogo.testnet (Provisional) |
| Team and payroll | Payroll run (Registered), Ana, Team member (Registered) |

### 4.6 Policy

- `<h1>` "Policy".
- Description: "The limits the agent must stay inside. Changing them needs a policy signer's signature."
- **Layout (desktop):** two columns, 7 and 5.
  - Left: "Current limits" form.
  - Right: "Who can change this" panel:
    - Policy version "v{version}"
    - hash (short, with copy)
    - Owners: from `public.owners`, mono
    - Policy signers: from `public.signers`, mono
    - the sentence: "Owners can pause the treasury, revoke the agent and recover funds, even with the agent offline. Only a policy signer can change these limits."
- **Form fields** (label 15px/500, description 13.5px `--muted`, input 16px with a unit suffix):

  | Label | Description | Unit | Bounds |
  |---|---|---|---|
  | Auto-pay limit | "Bills above this amount wait for a policy signer." | USDC | min 1, step 1 |
  | Cooling-off after a payout change | "How long Takara waits after a signer approves a new vendor destination." | hours | 0–720, step 1 |
  | Minimum runway | "Discretionary payments must leave at least this much runway." | days | 0–720, step 1 |

  - Input `name` stays exactly `max_auto_pay`, `cooling_off_hours`, `min_runway_days` (the API needs them).
  - Each field shows "Current: {value}" under it, and an "Edited" amber tag when the value differs.
- Validation is inline, under the field, with `aria-describedby`:
  - "Enter a whole number of 1 or more."
  - "Enter 0 to 720 hours."
  - "Enter 0 to 720 days."
  - On submit, focus the first invalid field.
- **Callout** above the button (`--sunken`, lock icon): "**Editing previews a change. A signature applies it.** Nothing changes until a policy signer signs the new version on-chain."
- **Buttons:**
  - Primary "Preview change" (POST `/api/policy/diff`, then open the dialog 4.2.10).
  - Secondary "Reset", enabled only when something was edited.
  - Hosted: under the button, 13px `--muted`: "Previewing works here. Signing is off in this demo."
- Warn before leaving the view with unsaved edits (`beforeunload` and the hash change). Use the in-app confirm: "Discard your edits?" [Keep editing] [Discard].

### 4.7 Ask Takara

- `<h1>` "Ask Takara", with a "Read-only" tag (lock icon) beside it.
- Description: "Ask why something was blocked, what's reserved, or what changed. Answers come from the ledger and link to the transaction. Takara can't pay, approve or change anything here."
- **Layout:** a single column, max-width 760px.
  - The chat log (`role="log" aria-live="polite"`) fills the available height: `min-height: 50vh`, scrolling inside itself, `overscroll-behavior: contain`.
  - The input row is sticky at the bottom (above the mobile bottom bar).
- **Suggestions** (chips, 32px tall, 6px radius) shown until the first question:
  - "Why was the 400 payment blocked?"
  - "What is spendable?"
  - "Any vendor changes?"
  - "List bills"
- Input:
  - `<label class="vh">Question for Takara</label>`
  - placeholder "Ask about a bill, a block or a figure…"
  - `autocomplete="off"`, `enterkeyhint="send"`, 16px font (no iOS zoom)
  - button "Ask"
- Messages:
  - The question is right-aligned, `--ink` background, white text.
  - The answer is left-aligned, `--surface`, 1px `--line` border.
  - Pending answer: "Reading the ledger…" in `--muted`.
- **Answer post-processing (client-side, display only):**
  1. Escape the text.
  2. Replace each `` `code` `` that is a known reason code with its short label from 5.5, with the code in `title`.
  3. Replace ISO timestamps (`/\d{4}-\d{2}-\d{2}T[\d:.]+Z/`) with `fmtDateTime`.
  4. Turn each source with a `url` into a link "View transaction".
- Error: "Takara couldn't answer: {message}. Try again."
- `?q=` support: `#/ask?q=...` pre-fills the question and submits it once.

### 4.8 Public ledger

- `<h1>` "Public ledger".
- Description: "The same treasury as anyone can read it on NEAR testnet. Amounts, vendors and payees stay sealed."
- **Summary list** (`<dl>`, a 2-column grid on desktop, 1 column on mobile):
  - Balance: "{balance} tUSDC (test token, no value)"
  - Agent: account, with an "Active" accent tag, or "Revoked" bad tag
  - Treasury: "Running" or "Paused"
  - Policy: "v{version}" plus a short hash
  - Owners
  - Policy signers
  - Pinned engine: short `wasm_hash`, linking to `engine.wasm_url`
  - Ledger state: short hash
- **"What strangers see / what stays sealed":** two columns.
  - Visible: "Bill states, priority, flags, hashes, attestations, the total balance."
  - Sealed: "Vendor names, amounts, payout destinations, policy contents."
- **Commitments:** a table at ≥768px, cards below.
  - Columns: Bill (#id), Status (the same pill vocabulary, from state only), Priority (text), Issues (badges from the `flags` bits; nothing if 0), Commitment hash (short, copy), Attestation ("Request {n}" link).
  - Uses the same no-min-width, fixed-layout table.
  - Owner-only shortcut on each row: "Open in your view" to `#/bills/{id}`.
- **Payout destination changes:** one line per `vendor_changes` entry:
  - "Change {id} on bill #{commitment_id}: {status sentence}. Decided by {role} ({account}) on {fmtDateTime(nsToMs(decided_at))}."
  - Status sentences:
    - `suspended_destination_mismatch` → "frozen, waiting for a signer"
    - `approved_cooling_off` → "approved, in cooling-off"
    - `rejected` → "rejected"
- Footer note: "Settlement on testnet releases escrow and records a receipt without publishing a payee or amount. The confidential mainnet payout is a separate, labelled demo, and this contract doesn't enforce it."

### 4.9 Activity (full)

- `<h1>` "Activity".
- Filter links: All, Caught (prevention items only), Held, Money moved, Admin. Kept in `?filter=`.
- When the filter is Caught, show at the top: the prevention breakdown as a `<dl>` of categories and counts (4.1.4), and the line "Counted from recorded decisions and bill flags. Each incident is counted once."
- Flag-only catches (no decision) appear as activity items without a tx link: "Frozen: an invoice for Railway asks to pay railway-new-bank.testnet instead of railway-pay.testnet." with meta "From bill flags".
- Items newest first, grouped by day. `/api/decisions` returns at most 60.
- Empty: "No decisions recorded on this deployment yet."

---

## 5. Content rules

### 5.1 Names

`cleanName(c)` returns `{ name, tag, sub }`:

1. `vendor_id` starts with `new:` → name "New vendor", sub = `c.destination`. Inline it renders as **"New vendor · bigagency.testnet"** (the destination in mono 13px). Never show the hash.
2. Otherwise strip a trailing parenthetical:
   - `/\s*\((fictional[^)]*)\)\s*$/i` → `tag = "Fictional"`, and the tag's `title` is the parenthetical capitalised (e.g. "Fictional hosting vendor, fixture data").
   - `/\s*\(team member\)\s*$/i` → stripped, kind team.
3. `vendor_id` starts with `member:` → the sub-label "Team member". `vendor_id === "payroll"` → the sub-label "Payroll".
4. The "Fictional" tag: 11.5px/500, `--sunken` background, `--muted` text, radius 4, padding 1px 6px. It never breaks the name onto two lines; the name truncates first.

### 5.2 Money

- `fmtMoney(s, {symbol = report.symbol})`:
  `new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(s))`, then a thin space, then the symbol at a smaller size in `--muted`. Use tabular numbers everywhere money appears.
- Report and commitment amounts are whole units already. Event amounts (`treasury_funded.amount`, `.balance`, `recovery_*.amount`) are **base units**: divide by 1e6 first.
- Negative: U+2212 minus. Zero: "0 USDC".
- The public balance (`public.balance`) is already formatted; show it as-is, with "tUSDC".

### 5.3 Dates and times

- `fmtDate(day)`: `new Date(day * 86400000)` with `Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" })`. Add `year: "numeric"` when the year differs from the current year (e.g. "Jan 12, 2027").
- `relDays(day)`: d = day − todayDay().
  - 0 → "today"; 1 → "tomorrow"; >1 → "in {d} days"
  - −1 → "1 day overdue"; < −1 → "{−d} days overdue". Show overdue only for unsettled bills; for settled bills show the date alone.
- `fmtDateTime(ms)`: `Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })`.
- `relTime(ms)`: `Intl.RelativeTimeFormat(undefined, { numeric: "auto" })`, rounded to minutes, hours or days. Always put the absolute value in a `title` attribute and a `<time datetime>` element.
- `due_day === 0` → show nothing (no "No due date" in rows). The drawer omits the Due pair.

### 5.4 Accounts and roles

- `roleOf(account)`:
  - in `public.owners` → "Owner"
  - in `public.signers` → "Policy signer"
  - `=== public.agent` (or ends with `agent.` + the treasury parent) → "Takara agent"
  - otherwise the account itself
- Display the role, with the account in `title` and in the drawer as mono text.
- Accounts and hashes are mono, with `translate="no"`. Hashes are shortened to `first8…last4`, with a copy button (`aria-label="Copy {what}"`).

### 5.5 Activity sentences (exact templates)

Variables:

- `{bill}` → `"{name} {fmtMoney(amount)}"` from the report commitment with the same id. If missing: "bill #{id}".
- `{vendor}` → the clean name.
- `{list}` → the blocking ids mapped to names, joined with ", " and " and " before the last.
- `{actor}` → `roleOf(decision.signer)`.

**Choosing the item for a decision:**

1. If `ok === false`, use the failure template.
2. Else, if `value` is an object with `reason`, use the reason template.
3. Else, use the first event in the order: `settlement_receipt`, `commitment_accepted`, `vendor_change_approved`, `commitment_claimed`, `recovery_completed`, `recovery_started`, `treasury_funded`, `agent_revoked`, `agent_set`, `treasury_paused`, `treasury_unpaused`, `commitment_closed`, `outflow_reconciled`, `authorization_issued`.
4. Skip `engine_requested`.
5. If nothing matches, use "{actor} called {method}." (admin).

**Reason templates** (`value.reason`). The short label is also used in chat post-processing.

| Reason | Kind | Short label | Sentence |
|---|---|---|---|
| `would_break_commitments` | caught | Would break reserved money | "**Blocked:** paying {bill} would break money reserved for {list}." |
| `below_min_runway` | caught | Below runway floor | "**Blocked:** paying {bill} would leave less than your {min_runway_days}-day runway." |
| `duplicate_evidence` | caught | Duplicate invoice | "**Rejected a duplicate:** this invoice was already recorded as {bill for value.original}." |
| `vendor_destination_mismatch` | caught | Payout destination changed | "**Frozen:** an invoice for {vendor} asks to pay {proposed_destination} instead of {destination}." |
| `vendor_change_cooling_off` | held | In cooling-off | "**Held:** payment to {vendor} waits out the cooling-off period until {fmtDateTime(nsToMs(until))}." |
| `vendor_change_rejected` | caught | Destination change rejected | "**Refused:** the new destination for {vendor} was rejected, so it won't be paid there." |
| `needs_signer_acceptance` | held | Needs a signer | "**Held for a signer:** {bill} needs a policy signer's acceptance." Add " It is a new vendor above the auto limit." if `new_vendor_over_limit` |
| `nonce_used` | caught | Replayed authorization | "**Refused a replay:** a used payment authorization for {bill} was submitted again." |
| `authorization_mismatch` | caught | Altered payment | "**Refused an altered payment** for {bill}: the {fieldLabel} didn't match what was authorized." (fieldLabel: `amount_commit` → amount, `destination_commit` → destination, `destination_chain` → chain, otherwise "details") |
| `commitment_not_accepted` | caught | Not accepted yet | "**Refused:** {bill} isn't accepted yet, so it can't be paid." |
| `sender_unverified` | held | Sender unverified | "**Held:** the sender of the invoice for {vendor} couldn't be verified." |
| `vendor_destination_unknown`, `missing_destination` | held | No destination on file | "**Held:** {bill} has no registered payout destination." |
| `member_not_in_roster`, `unknown_requester` | caught | Unknown requester | "**Refused:** a claim came from someone who isn't on the team." |
| `policy_hash_mismatch` | caught | Outdated policy | "**Refused:** the request used an out-of-date policy." |
| any other | caught | humanised code | "**Refused:** {bill}: {code with _ replaced by spaces}." |

**Failure templates** (`failure`, when `ok === false`). Method labels:

| Method | Label |
|---|---|
| `approve_vendor_change` | approve a payout destination change |
| `propose_policy` | change the policy |
| `recover` | recover the treasury's funds |
| `register_claim` | record a bill |
| `accept_commitment` | accept a bill |
| `pause` | pause the treasury |
| `revoke_agent` | revoke the agent |
| `settle` | pay a bill |
| other | the method name |

| Failure | Kind | Sentence |
|---|---|---|
| `E_NOT_POLICY_SIGNER` | caught | "**Blocked:** {actor} tried to {method label} without being a policy signer." |
| `E_NOT_OWNER` | caught | "**Blocked:** {actor} tried to {method label} without being an owner." |
| `E_AGENT_REVOKED` | caught | "**Blocked:** the agent tried to {method label} after its access was revoked." |
| `E_NOT_AGENT` | caught | "**Blocked:** {actor} tried to {method label} but isn't the treasury's agent." |
| `E_TREASURY_PAUSED` | held | "**Held:** couldn't {method label} while the treasury was paused." |
| `E_INSUFFICIENT_BALANCE` | held | "**Refused:** not enough balance to {method label}." |
| `E_INVALID_TRANSITION` | admin | "**Refused:** that bill can't move to the requested state." |
| `E_ALREADY_APPROVED` | admin | "Already approved; nothing changed." |
| `E_POLICY_EXPIRED` | held | "**Refused:** the signed policy has expired." |
| `E_WRONG_ASSET` | caught | "**Refused:** a token other than the treasury's was sent." |
| `E_TOO_MANY_OPEN_COMMITMENTS` | held | "**Refused:** too many open bills. Close some first." |
| object or string containing "Method new is private" | caught | "**Blocked:** {actor} tried to re-initialise the treasury contract." |
| other | admin | "**Failed:** {method label} ({code or "transaction error"})." |

**Event templates** (when `ok` is true and there's no reason). `d = event.data[0]`.

| Event | Kind | Sentence |
|---|---|---|
| `commitment_claimed` | admin | "**Recorded** a bill from {vendor} for {amount}{, due {fmtDate}}. Not reserved yet." Append "Hidden instructions in it were ignored." if `d.flags & 4`, and "Its payout destination differs from the registered one." if `d.flags & 8` |
| `commitment_accepted` | money | `d.by === "signer"` → "**Accepted:** {roleOf(d.signer)} accepted {bill}. The money is now reserved." Otherwise → "**Accepted** {bill} automatically, within policy. The money is now reserved." |
| `settlement_receipt` | money | "**Paid** {bill} on testnet. The receipt is on-chain." |
| `authorization_issued` | admin | "**Authorized** payment of {bill}, valid until {fmtDateTime(nsToMs(d.expiry))}." |
| `vendor_change_approved` | held | "**Approved, cooling off:** {roleOf(d.by)} approved the new destination for {vendor}. Payment stays frozen until {coolingUntil}." |
| `recovery_started` | money | "**Recovery started:** {roleOf(d.by)} began moving {fmtBase(d.amount)} to {d.to}." |
| `recovery_completed` | money | "**Recovered:** {fmtBase(d.amount)} moved to {d.to} by the owner, with no agent involved." |
| `treasury_funded` | money | "**Funded:** {roleOf(d.from)} added {fmtBase(d.amount)}. Balance {fmtBase(d.balance)}." |
| `agent_revoked` | admin | "**Agent revoked** by {roleOf(d.by)}. It can no longer record or pay bills." |
| `agent_set` | admin | "**Agent access granted** to {d.agent} by {roleOf(d.by)}." |
| `treasury_paused` | admin | "**Paused** by {roleOf(d.by)}. No payment can settle." |
| `treasury_unpaused` | admin | "**Resumed** by {roleOf(d.by)}." |
| `commitment_closed` | admin | "**Closed** {bill}." |
| `outflow_reconciled` | admin | "**Reconciled** paid-out amounts with the balance ({roleOf(d.by)})." |

`fmtBase(s)` = `fmtMoney(Number(s) / 1e6)`.

### 5.6 Figure explanations (for "How is this calculated?")

| Key | Label | Sentence |
|---|---|---|
| `treasury_balance` | Treasury balance | "The treasury contract's balance, read from NEAR." |
| `settled_outflow` | Already paid | "Bills already paid that still count against the balance until the next reconciliation." |
| `reserved` | Reserved for bills | "Accepted bills that aren't paid yet. This money is spoken for." |
| `spendable` | Spendable | "Balance minus already paid minus reserved." |
| `daily_recurring_burn` | Daily recurring burn | "Recurring bills converted to a monthly amount, divided by 30." |
| `runway_days` | Runway | "How many days the balance left after payouts covers your recurring burn." |

### 5.7 Plain labels for internal names

| Internal | Label |
|---|---|
| `max_auto_pay` | Auto-pay limit |
| `cooling_off_hours` | Cooling-off after a payout change |
| `min_runway_days` | Minimum runway |
| claimed / accepted / settled | Received / Reserved / Paid |
| priority critical / normal / discretionary | Critical / Normal / Discretionary (shown in the drawer only; rows show a "Critical" text tag only for critical bills) |
| `accepted_by` s / p | Policy signer / Takara, within policy |
| recurrence m / w | Monthly / Weekly |

### 5.8 Honesty and environment copy

- **Demo banner (DEMO only).** A full-width strip above the content: `--warn-soft` background, `--warn` 1px bottom border at 30%, 14px `--ink`, left-aligned, max line length 80ch.
  > "Hosted demo of a **fictional** treasury on NEAR testnet. Figures are live from chain. Signing is off here, because a public website never holds a signer's key."

  Followed by links "Product page" (`/`) and "GitHub" (https://github.com/growthmindsetgg/takara-ai), and a dismiss button (aria-label "Dismiss for this visit").
- **Env tags** (sidebar footer and mobile top bar): "Testnet" and "Fictional data". In the local app, the tags read "Testnet · local" and "Fictional data". The header subtitle is never "Owner console, local" on the hosted site.
- Token: always "USDC" from `report.symbol` in owner views. The Public ledger says "tUSDC (test token, no value)".
- Mainnet sentence (bill drawer for settled bills, Public ledger footer): "The confidential mainnet payout is a separate demo and isn't enforced by this contract."
- **Signer-only microcopy:** "Only a policy signer can approve this, from their own wallet. This app can't approve."
- **Read-only chat microcopy:** "Takara can't pay, approve or change anything here."

### 5.9 General copy rules

- **No "None", "null", "undefined", "n/a" or "-" placeholders.** Empty means the element isn't rendered. Lint this with the acceptance check in section 8.
- Sentence case everywhere. No ALL-CAPS labels. No "→" appended to link text (use the "›" chevron glyph as a separate `aria-hidden` span on "View all" links only). Use "…" not "...". Loading text ends with "…".
- Numbers as numerals. Active voice. Errors say what happened and what to do next. No exclamation marks.

---

## 6. Visual system

Consistent with the product site (IBM Plex Sans/Mono, paper #FAFAF8, deep teal #0B5D52). There is no reason to diverge: one brand across the site and the app builds trust, and the palette already passes AA. Light theme only in v1 (`color-scheme: light`, `<meta name="theme-color" content="#FAFAF8">`).

### 6.1 Colour tokens

Contrast ratios were computed with the WCAG 2.x formula.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--paper` | #FAFAF8 | page background (`body` explicit) | n/a |
| `--surface` | #FFFFFF | panels, sidebar, rows | n/a |
| `--sunken` | #F4F4F0 | wells, skeletons, neutral pills | n/a |
| `--ink` | #182026 | primary text | 15.78 on paper, 16.49 on white |
| `--ink-2` | #364048 | secondary text | 10.59 on white |
| `--muted` | #5A636B | tertiary text, meta | 5.86 on paper, 6.12 on white, 5.55 on sunken, 5.26 on accent-soft, 5.41 on warn-soft |
| `--line` | #E6E5DF | dividers (decorative) | 1.21 (decorative only) |
| `--line-2` | #D5D4CC | quiet borders on non-interactive containers | 1.49 (decorative only) |
| `--line-strong` | #8C918C | **form input borders, segmented-control outline** | 3.21 on white (meets 1.4.11) |
| `--accent` | #0B5D52 | links, active nav bar, primary focus ring, spendable segment | 7.77 on white, 7.44 on paper |
| `--accent-2` | #4A8F84 | reserved segment | 3.78 on white |
| `--accent-soft` | #E6F0ED | active nav, accent pills | n/a |
| `--accent-ink` | #08473F | text on accent-soft, hero value | 9.10 on accent-soft |
| `--warn` | #8A5300 | warn text and borders | 5.59 on warn-soft, 6.33 on white |
| `--warn-soft` | #FAF0DC | warn backgrounds, demo banner | n/a |
| `--bad` | #9E2A2E | caught and frozen text | 6.38 on bad-soft, 7.44 on white |
| `--bad-soft` | #FAEAEA | bad backgrounds | n/a |
| `--seg-paid` | #8C918C | "Already paid" segment | 3.21 on white |
| `--seg-reserved` | #4A8F84 | "Reserved" segment | 3.78 on white |
| `--seg-spendable` | #0B5D52 | "Spendable" segment | 7.77 on white |

- The bar segments are separated by 2px white gaps, so each needs ≥3:1 only against white, and all pass. Values are always printed in the legend, so colour is never the only carrier.
- Primary button: `--ink` background, white text (16.49).
- Secondary button: white background, `--ink` text, `--line-strong` border.
- Hover states darken: the primary goes to #26323A; links go to `--accent-ink`.

### 6.2 Typography

`IBM Plex Sans` 400/500/600 and `IBM Plex Mono` 400/500 from Google Fonts with `display=swap`, plus `preconnect`.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--t-xs` | 12 / 16 | 500 | tags, rail labels (11px allowed in the rail and bottom bar only) |
| `--t-sm` | 13 / 18 | 400–500 | meta, legend, descriptions |
| `--t-base` | 15 / 22 | 400 | body, rows |
| `--t-md` | 17 / 24 | 600 | card headings (h2) |
| `--t-lg` | 20 / 28 | 600 | drawer titles |
| `--t-xl` | 24 / 30 | 600, −0.015em | page h1 |
| `--t-2xl` | 32 / 38 | 600, −0.02em | metric values |
| `--t-hero` | 48 / 52 | 600, −0.025em | spendable (38 / 42 under 768px) |

- Mono is used only for accounts, destinations, hashes and formulas, never for labels.
- `font-variant-numeric: tabular-nums` on all money, counts and dates in rows.
- `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs. Body line length ≤ 75ch.

### 6.3 Spacing, radii, shadows, layers

- **Spacing scale (px):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Section gap 24 (desktop) and 16 (mobile). Page padding 32 / 24 / 16 at 1280 / 768 / 375.
- **Radii** vary by hierarchy:

  | Radius | Use |
  |---|---|
  | 4 | tags, skeleton bars |
  | 6 (`--r-sm`) | status pills, chips, destination boxes |
  | 10 (`--r-md`) | inputs, buttons, approval cards, toasts |
  | 14 (`--r-lg`) | panels, dialogs |
  | 999 | count badges only |

- **Shadows,** tinted with ink and a single light source from above:
  - `--lift: 0 1px 0 rgba(24,32,38,.03), 0 18px 40px -24px rgba(24,32,38,.28)` for the hero panel only.
  - `--shadow-pop: 0 2px 6px rgba(24,32,38,.06), 0 24px 48px -16px rgba(24,32,38,.28)` for dialogs, drawers and toasts.
  - Other panels use the border only.
- **Z-index scale:** content 0, sticky headers 10, sidebar 20, bottom bar 30, toasts 60. Dialogs and drawers use the native top layer.

### 6.4 Motion

- Easing `--ease: cubic-bezier(.2,.7,.2,1)` for entering; `cubic-bezier(.4,0,1,1)` for exiting.
- **Durations:**

  | Duration | Use |
  |---|---|
  | 120ms | button press (`translateY(1px)`) |
  | 160ms | colour and background hovers (list properties explicitly; never `transition: all`) |
  | 240ms | drawer enter (`translateX(16px)` → 0 plus opacity; mobile `translateY(24px)`) and dialog enter (`translateY(8px) scale(.985)` → none) |
  | 160ms | exits |
  | 90ms | details chevron rotation |

- **The single orchestrated moment:** on the first successful report load, the allocation bar segments grow from `scaleX(0)` with `transform-origin: left`, 600ms, staggered 60ms. The legend values fade in at 200ms. This doesn't replay on Refresh.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, disable every transform animation, the shimmer and the stagger. Keep instant state changes. Opacity fades ≤ 120ms are allowed.

---

## 7. Responsive rules and accessibility

### 7.1 Breakpoints

| Width | Navigation | Layout |
|---|---|---|
| ≥1280 | sidebar 240 | 12-col grid, content max 1120, hero 7/5, Overview row 7/5, bills table with all 6 columns |
| 1024–1279 | sidebar 224 | same grid; bills table hides "Waits on" |
| 768–1023 | 72px rail | single column for Overview cards (hero still 7/5 if ≥ 880px, else stacked); bills table hides "Issues" (badges move under the name) and "Waits on" |
| <768 (test at 375) | top bar plus bottom tab bar | everything stacks; tables become card lists; drawers are full-screen; destination boxes stack; filter control scrolls inside itself |

Global layout rules:

- **No horizontal page scroll at any width:** `document.documentElement.scrollWidth <= window.innerWidth`.
- Every flex or grid child that holds text has `min-width: 0`. Long strings (destinations, hashes, accounts) truncate in rows and wrap with `overflow-wrap: anywhere` in drawers and comparison boxes.
- `body { min-height: 100dvh; }`. Respect `env(safe-area-inset-*)` on the bottom bar and the top bar. Use `touch-action: manipulation` on controls and set `-webkit-tap-highlight-color: transparent` with visible `:active` states instead.
- Inputs are 16px or larger (no iOS zoom). Tap targets are ≥ 44×44 (nav items, close buttons, copy buttons, chips 32px tall with ≥ 8px spacing).

### 7.2 Accessibility checklist (WCAG 2.2 AA)

- [ ] Landmarks: `<header>` (mobile top bar), `<nav aria-label="Main">` (sidebar, rail or bottom bar; only one rendered and exposed at a time), `<main id="main" tabindex="-1">`, and `<footer>` inside the sidebar for the env links.
- [ ] Skip link as the first focusable element.
- [ ] One `<h1>` per view. `<h2>` for sections. Headings in order.
- [ ] On route change:
  - [ ] update `document.title` to "{View} · Takara AI"
  - [ ] move focus to the view's `<h1>` (`tabindex="-1"`)
  - [ ] announce the view name through a polite live region
- [ ] `aria-current="page"` on the active nav item and `aria-current="true"` on the active filter link.
- [ ] Focus is visible on every interactive element: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. Never remove an outline without a replacement. Sticky bars must not cover the focused element (`scroll-padding-top: 72px; scroll-padding-bottom: 88px` on mobile).
- [ ] Everything works by keyboard: Tab order follows the visual order; rows open with Enter (native link); drawers and dialogs trap focus, close on Esc, and return focus to the opener.
- [ ] Live regions:
  - [ ] the toast region (`role="status"`)
  - [ ] the chat log (`role="log"`)
  - [ ] the "Updated …" text (`aria-live="off"`; announce only after a manual Refresh, as "Updated just now")
  - [ ] form errors (`role="alert"` on submit failure)
- [ ] Loading: `aria-busy` on sections, plus visually hidden loading text.
- [ ] Tables have `<caption class="vh">`, `scope="col"` headers and right-aligned numeric columns. The card lists on mobile are `<ul>`.
- [ ] The allocation bar has `role="img"` and a full `aria-label`. The legend repeats the values as text.
- [ ] Status and issue meaning never relies on colour alone (each has text, and the badges have glyphs).
- [ ] Contrast: text ≥ 4.5:1, large text and UI components ≥ 3:1 (section 6.1).
- [ ] Icon-only buttons have `aria-label`: close, copy, dismiss, refresh (when collapsed). Decorative SVGs are `aria-hidden="true"`.
- [ ] External links have `rel="noopener"` and visually hidden "(opens in a new tab)" text.
- [ ] Every form field has a `<label>` with `aria-describedby` for the description and error. Disabled buttons state why in adjacent text.
- [ ] Reduced motion is respected (6.4). No content flashes.
- [ ] Zoom to 200% without loss of content. No `maximum-scale` and no `user-scalable=no`.
- [ ] `lang="en"`. Accounts, hashes and codes have `translate="no"`.

---

## 8. Acceptance checklist

The reviewer verifies each item against the hosted demo data (values as of 2026-11-13) and locally. "Data" values may change if the chain changes; the rule still applies.

### A. Structure and navigation
- [ ] A1. `web/index.html` is one file: inline `<style>` and `<script>`, no external JS, Google Fonts only. `platform/app/index.html` is identical.
- [ ] A2. `<meta name="takara-token" content="__TAKARA_TOKEN__">` is present exactly once, before any other occurrence of that string. JS detects demo mode with a concatenated sentinel (`"__TAKARA" + "_TOKEN__"`).
- [ ] A3. Every fetch sends `x-takara-token`.
- [ ] A4. At 1280px a sidebar shows the 7 views in this order: Overview, Approvals, Bills, Vendors & team, Policy, Ask Takara, Public ledger. At 768px it is a 72px rail with labels. At 375px there is a bottom bar (Overview, Approvals, Bills, Ask, More) and "More" opens a sheet with the other three.
- [ ] A5. Hash routes work and can be deep-linked: `#/approvals`, `#/bills?status=flagged`, `#/bills/4` (drawer open on load), `#/vendors/railway`, `#/ask?q=what%20is%20spendable%3F`, `#/activity?filter=caught`. Back and forward work.
- [ ] A6. On route change: the title updates, focus moves to the h1, and the active nav has `aria-current="page"`.

### B. Overview
- [ ] B1. The hero shows "Spendable now", **75 USDC**, and "of 1,400 USDC in the treasury". There are no formulas visible without opening the disclosure.
- [ ] B2. The allocation bar has three segments in the ratio 520 : 805 : 75, a legend with "Already paid 520 USDC", "Reserved for bills 805 USDC", "Spendable 75 USDC", and an `aria-label` stating all three.
- [ ] B3. "How is this calculated?" opens six rows, each with a plain sentence plus the formula string from `report.queries`.
- [ ] B4. Runway shows **34 days**, "above your 7-day floor", and "Recurring burn 25.5 USDC a day".
- [ ] B5. "Waiting on a signer" shows **1**, "1 bill · 900 USDC" and "1 cooling off", and links to Approvals.
- [ ] B6. "Caught for you" shows **3** while `/api/decisions` returns `[]`, and the correct deduplicated total (12 with the current local log) when decisions are present. It links to `#/activity?filter=caught`.
- [ ] B7. Needs attention shows at most 3 compact cards, sorted by deadline, and "View all (4)".
- [ ] B8. Coming up says "645 USDC due in the next 30 days, all reserved." (date-dependent) and lists Dec 1 Payroll run 600, Dec 5 Inkwell Design Tools 45, Dec 20 New vendor · tinylogo.testnet 40, Dec 30 New vendor · bigagency.testnet 900 (Awaiting signer), Jan 12, 2027 Railway 120 (Cooling off).
- [ ] B9. Activity shows plain-English sentences per 5.5, or the empty state when decisions are `[]`. No raw reason code, event name or `E_` code appears as primary text.

### C. Approvals
- [ ] C1. Sections and counts: "Waiting on a signer (1)", "Waiting on time (1)", "Pending policy check (2)".
- [ ] C2. The Railway cooling-off card shows the "Registered destination (in use)" box `railway-pay.testnet` and the "Proposed by invoice" box `railway-new-bank.testnet` side by side at ≥560px, stacked below. Both are fully visible (no truncation).
- [ ] C3. Each card shows "Waits on" with a role, plus the signer account or the unlock time, the deadline when a due date exists, and the waiting age only when known. Never "unknown" or "None".
- [ ] C4. **No card has an approve, reject, accept or pay button.** Each has "View bill" and "How is this approved?".
- [ ] C5. The empty state renders when there are no items (test by stubbing `commitments: []`).

### D. Bills and vendors
- [ ] D1. No raw `new:<hash>` appears anywhere. These render as "New vendor · tinylogo.testnet" and "New vendor · bigagency.testnet".
- [ ] D2. "(fictional …)" is stripped from names and shown as a "Fictional" tag. "Ana (team member)" renders as "Ana" with "Team member".
- [ ] D3. Status pills read Received / Awaiting signer / Reserved / Paid / Frozen / Cooling off. Raw `claimed`, `accepted`, `settled` never show as text.
- [ ] D4. Issue badges appear only when set. A bill with no flags shows nothing in Issues.
- [ ] D5. The filters (All, Waiting, Reserved, Paid, Flagged) show counts and update the URL.
- [ ] D6. The bill drawer for #4 shows the timeline, the "Payout changed" sentence with both destinations, details, the on-chain proof (commitment hash with copy, attestation link) and its activity. Esc closes it and focus returns to the row.
- [ ] D7. A settled bill's drawer shows the testnet and mainnet-separate-demo sentence.
- [ ] D8. Vendors & team lists Railway (Cooling off), Inkwell Design Tools (Registered), New vendor · bigagency.testnet (New, awaiting signer) and New vendor · tinylogo.testnet (Provisional) under Vendors, and Payroll run and Ana under Team and payroll.

### E. Policy
- [ ] E1. The fields are labelled "Auto-pay limit", "Cooling-off after a payout change" and "Minimum runway", with units, current values (500 USDC, 24 hours, 7 days) and `name` attributes unchanged.
- [ ] E2. Invalid input shows inline errors and focuses the first invalid field. Unchanged values give "Nothing changed…" with signing disabled.
- [ ] E3. The diff dialog shows a human table (e.g. "Auto-pay limit 500 USDC → 750 USDC", base units converted), the version, a short hash and the signer. The raw JSON sits behind "Show raw diff".
- [ ] E4. Hosted: the sign button is disabled and reads "Signing is off in this demo", with the explanation, and **no request is made to `/api/policy/sign`** (verify in the network panel). Local: signing works, and success shows a toast with a transaction link.
- [ ] E5. Leaving the Policy view with edits asks "Discard your edits?".

### F. Ask Takara and Public ledger
- [ ] F1. The chat shows the "Read-only" tag and the microcopy. Suggestions submit questions. Answers replace backticked reason codes with labels and ISO times with local times. Sources render as "View transaction" links.
- [ ] F2. Typing "pay railway 120" returns the server's read-only answer, displayed normally (no error styling).
- [ ] F3. The Public ledger shows the summary list, the visible/sealed explanation, the commitments (table ≥768, cards <768) with hash copy and attestation links, the vendor-change sentence, and the mainnet footer note.

### G. Content rules (automated check in the console)
- [ ] G1. `[...document.querySelectorAll('main *')].filter(e => e.children.length === 0 && /^(None|null|undefined|n\/a|NaN)$/.test(e.textContent.trim())).length === 0` on every view.
- [ ] G2. `document.body.innerText` contains no `new:` followed by hex, and no snake_case policy keys outside the formula disclosure and the raw diff.
- [ ] G3. Money uses grouping ("1,400") and tabular numbers. Dates come from `due_day` via `Intl`. "Testnet" and "Fictional data" tags are visible on every view. The demo banner is visible on hosted and absent locally.

### H. Layout, states, accessibility
- [ ] H1. At 375, 768 and 1280: `document.documentElement.scrollWidth <= innerWidth` on every view and with drawers open. No table has a `min-width` wider than its container.
- [ ] H2. Each section shows a shape-matched skeleton while loading, with no layout shift when the data arrives (CLS ≈ 0 on Overview).
- [ ] H3. Forcing each endpoint to fail (e.g. a wrong token, or offline) shows that section's error block with "Try again". Other sections still render.
- [ ] H4. Keyboard only: you can reach every view, open and close a drawer and the dialog, use the filters, ask a question, and copy a hash. Focus is always visible and never hidden under the sticky bars.
- [ ] H5. Axe or Lighthouse accessibility shows no critical or serious violations. Contrast passes.
- [ ] H6. With `prefers-reduced-motion: reduce`, there is no bar grow, no shimmer and no drawer slide.
- [ ] H7. No `transition: all`, no `outline: none` without a replacement, no `maximum-scale`, no `<div onclick>` (actions are `<button>`, navigation is `<a>`).
- [ ] H8. The honesty rules hold: no screen implies that this app approves bills or vendor changes, that hosted signing works, that the data is real, or that mainnet payout is enforced.
