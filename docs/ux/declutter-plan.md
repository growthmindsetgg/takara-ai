# Declutter plan for `web/index.html`

Review date: 2026-11-14. I reviewed the live app at `localhost:8787`: every route, the Owner, Signer, Member, Auditor and Public lenses, the bill drawer and the Demo scope sheet.

The founder's brief: "Remove all unnecessary and obvious descriptions and statistics … clean and easy to understand for a new user. Maybe small pop ups while first time someone uses something."

**How to use this plan**
- Line numbers (`~L`) come from a snapshot of a 3,644-line file taken while another agent was editing it. Search for the quoted string or the named function, not the line number.
- `hint(key, anchor, text)` refers to the first-use API the tour agent is adding. Each hint shows once per browser.

---

## 0. Rules applied

- **Target:** cut at least 40% of visible text, and show 3–5 numbers per screen, each tied to a decision.
- **Honesty markers are consolidated, never deleted.** After this pass, each one lives in exactly one place:

  | Honesty marker | Where it stays |
  |---|---|
  | Demo / testnet / fictional data | The top strip (`paintStrip`), plus the Demo scope sheet, which is the full list |
  | Preview | The `pvTag()` chip on each preview component. Never page copy. |
  | "Testnet: no tokens move" | The *Settled* row inside Overview › "How is this calculated?" (beside the number it qualifies, per plan §5.2.8), plus its existing line in the Demo scope sheet. Removed everywhere else. |
  | Reconciliation equation (`eqHTML`, "1,400 in treasury − 577.5 settled − 805 reserved = 17.5 spendable") | Overview only |
  | Lens is not access control | A one-line `lensNote()` (shortened below) |
  | Live source | The single `stampText()` line in the page header |

- **Banned word still in content (plan §5.2.7):** "escrow" appears in three places (~L1436, ~L1891, ~L2638). This pass removes all three.
- No new features, no new success states. A "Saved in this browser" note stays wherever local-only state exists.

---

## 1. Global chrome (every screen)

### Remove
| What | Where | Reason |
|---|---|---|
| The `<p class="ph-d">` description under every H1 (13 owner pages plus the lens pages; every string is listed per screen below) | `header()` ~L2772, each `VIEWS.*.desc` | Obvious; restates the title |
| Strip links "Product page" and "GitHub (opens in a new tab)" | `paintStrip` ~L2862 | Duplicate of the footer links |
| Footer text "NEAR testnet" | `footlinks` ~L3503 | Duplicate of the stamp |
| Agent card subline "· works for Fixture Co" | `paintAgent` ~L2849 | Obvious |
| Sidebar group heading "Account" (it holds one item) | `NAV` ~L1726 | Noise |

### Shorten
| Before | After |
|---|---|
| Strip: "Local dashboard · NEAR testnet · fictional data" / "Demo treasury on NEAR testnet · fictional data" + button "Demo scope" | "Demo on NEAR testnet · fictional data" + button "What's live" (opens the same scope sheet) |
| `lensNote()` ~L1761: "Lens · Shows what this role would see. It's a view, not access control: per-member encryption comes with accounts." | "Lens · What this role would see. A view, not access control." |
| Header button "Refresh" | Icon-only button, `aria-label="Refresh"` |
| Stamp "Live from NEAR testnet · updated just now" | Keep the text unchanged (honesty line) |
| Demo scope sheet (`openScope` ~L2880): 19 bullets of 10–25 words each | Keep every bullet, but cut each to ≤ 8 words. Examples: "Reserved, spendable and runway from the engine report: in treasury − settled − reserved" → "Reserved, spendable and runway, from the engine"; "Token movement on testnet (settlement is recorded on the ledger; payouts run through NEAR Intents on mainnet)" → "Token movement (testnet records settlement only)" |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `lens` | `select[data-act="lens"]` | "See the app as each role would. It's a view, not access control." |
| `ask` | `.askbtn` | "Ask Banto about any bill or payment. It answers from the ledger and can't move money." |
| `wallet` | the "Connect wallet" button | "You only need a wallet to approve or sign. Browsing works without one." |

### Keep
- The strip itself, including the "fictional data" words and the dismiss button.
- The stamp line, the treasury account and copy button in the sidebar, the "Ask Banto · Ctrl K" button, and nav badges (they carry counts a user acts on).
- The footer "Demo scope" button. It is the only route to the scope sheet once the strip is dismissed.

---

## 2. Overview (`VIEWS.overview`, `heroBody`, `projBody`, `railBody`, `comingUp`)

**Before:** about 3,900 characters and about 30 distinct numbers. Bigagency's 900 USDC appears **five times**: Banto line, Needs you figure, Approval queue, Alerts, Coming up.

**After:** about 1,500 characters. The five decision numbers are Spendable (with its equation), Runway, Needs you, Caught for you, and Due in 30 days.

### Remove
| What | Where | Reason |
|---|---|---|
| Description "Fixture Co's treasury. What you can spend, what's waiting, what's due, and what Banto caught." | `desc` ~L1861 | Obvious |
| The whole **Approval queue** panel ("1 needs you · 2 pending check", Bigagency row, the Railway row with "2 identical copies") | `railBody` ~L1979 and its section in `body` | Duplicates the Banto line, the figure and the badge |
| Figure **"Not reserved yet · 1,140 USDC · 3 bills received, not accepted"** | `heroBody` ~L1909 | Stat nobody acts on here |
| Second line of the Needs you figure: "2 pending check" | `heroBody` ~L1908 | Nobody needs to act on these |
| "Plus 7 blocked in the security test run (judge checks)" | `heroBody` ~L1910 | Lives in Reports › Security tests |
| Runway sub-line "Recurring bills 25.5 USDC a day" | `heroBody` ~L1907 | Moved into the calculation disclosure |
| Strip legend label "Protected line" | `reserveStrip` ~L1637 | The dashed line explains itself |
| Strip footnote "Each envelope is an accepted bill. Its money can only pay that bill." | `reserveStrip` ~L1638 | Becomes a hint |
| "Figures come from deterministic queries over the ledger. No model writes a number." | `heroBody` ~L1904 | Jargon; the queries already show it |
| Chart footnote "Not included: 1,140 USDC in 3 bills not reserved yet (1 needs you · 2 pending check). Each recurring bill is shown once, for the cycle already on file." | `projBody` ~L1953 | Duplicate stat, plus an edge case |
| Activity footer "Business events only. 1 security test run (judge checks) in Reports." | `body` ~L1868 | Noise; Reports has the filter |
| Activity rows for `authorization_issued` ("Authorized payment of Payroll run 15 USDC, valid until …") | the Overview feed (`feedItems` call ~L1868): exclude kind `admin` | Internal step; not a business event |
| Per-alert meta rows "Amount 1,122.5 USDC / Deadline Dec 30" on Overview | `alertRow(x, true)` | The amount is already in the sentence |
| Alert "Approval waiting: new vendor Bigagency, 900 USDC, waiting 2d." on Overview | `ov-al` section | Duplicate of the Banto line |

### Shorten
| Before | After |
|---|---|
| "Banto · Bigagency's 900 USDC bill needs you (due Dec 30)." + "Open approvals" | Keep it; this is the screen's one action |
| Needs you figure: "1 · 1 bill · 900 USDC · 2 pending check" | "1 · 900 USDC" |
| Caught figure: "6 · 1 payout change frozen · 2 hidden instructions ignored · 1 duplicate refused · 2 reserve breaches blocked" | "6 · Payout change, hidden instructions, duplicate, reserve" (the whole tile links to Reports › Caught, which has the breakdown) |
| Runway context "Above your 7-day floor" | Keep |
| Chart summary "Starts at 822.5 USDC today (1,400 in treasury − 577.5 settled) and ends at 17.5 USDC on Jan 12, 2027, under your 7-day runway floor of 178.5 USDC." | "Ends at 17.5 USDC on Jan 12, 2027, below your 7-day floor (178.5)." |
| Chart table row "Today: 1,400 in treasury − 577.5 settled" | "Today" |
| Activity panel: 12 rows | 5 rows. Use the one-line event copy from §11. |
| Calculation rows (`rows` in `heroBody` ~L1891). *Settled:* "Bills settled on the ledger: escrow released, nonce burned, receipt on-chain. They count against the balance until payouts are reconciled. Testnet: no tokens move; payouts run through NEAR Intents on mainnet." | *Settled:* "Bills marked paid on the ledger. Testnet: no tokens move." (**the single home of this disclosure**) |
| *Reserved:* "Accepted bills that aren't paid yet. Each is an envelope in the strip." | "Accepted bills not paid yet." |
| *In treasury:* "The treasury contract's balance, read from NEAR." | "Contract balance on NEAR." |
| *Recurring bills per day:* "Accepted recurring bills as a monthly amount, divided by 30." | "Monthly recurring ÷ 30." |
| *Runway:* "Days the money left after settled bills covers your recurring bills." | "Days of recurring bills you can cover." |
| "Coming up": "645 USDC due in 30 days, all reserved." | Keep |
| "No alerts. Banto tells you before a renewal, a shortfall or a payout change." | "No alerts." |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `ov.spendable` | `.hl` (Spendable now) | "Spendable is what's left after money set aside for accepted bills. Banto can't spend reserved money." |
| `ov.strip` | `.rstrip` (reserve strip) | "Each block is an accepted bill. That money can only pay that bill." |
| `ov.caught` | the "Caught for you" figure | "Bad invoices Banto refused: changed payout addresses, duplicates, hidden instructions. Tap to see each." |

### Keep
- The Banto line, Spendable, the **equation (its only home)**, and the reserve strip.
- The "How is this calculated?" disclosure, including the `m.queries` formulas. Judges use it to verify the numbers.
- The Runway, Needs you and Caught figures, the 60-day chart (the visual stays; only its text is cut), and the "Coming up" list.
- The Alerts panel, limited to the shortfall alert. It is the only place a new user sees "if you accept these, you're short".

---

## 3. Approvals (`VIEWS.approvals`, `approvalCard`, `qDesc`)

**After:** about 600 characters on screen, down from 1,530.

### Remove
| What | Where | Reason |
|---|---|---|
| Description "Everything waiting, who it waits on, how long, and what it blocks. Approve or reject in one click; your wallet opens only when you click." | ~L2000 | Obvious, and a hint covers it |
| Summary line "1 needs you · 2 pending check" | `approvalsBody` | Duplicates the group headers |
| Whole right rail: "Who approves · Signer · signer.takara-ai-hq.testnet · Signatures needed 1 of 1" | ~L2003 | Already in Policy and People |
| Panel "Rejecting · A reject needs a reason of at least 10 characters … the reason stays in this browser." | ~L2004 | Becomes a hint. The reason box already enforces the minimum, and "stays in this browser" moves to the reason box. |
| Panel "Escalation · Preview · If the approver is away …" | ~L2005 | Preview noise on the action screen. It stays listed in Demo scope. |
| Card fact "Waiting · 2d so far" | `approvalCard` | Rarely drives the decision |
| Duplicate badge text: "Needs you" appears as the group header **and** as the card status | `approvalCard` `.ap-st` | Duplicate |

### Shorten
| Before | After |
|---|---|
| `qDesc.signer`: "A Signer approves each one in their own wallet. Sorted by deadline." | (none; the hint covers it) |
| `qDesc.policy`: "Banto accepts or refuses these within policy. Nobody needs to act." | "Banto handles these. Nothing to do." |
| `qDesc.timer`: "A Signer already approved. The cooling-off period runs out on its own, so a hijacked approval can still be caught." | "Approved. Waiting out the 24-hour safety delay." |
| Card head "First bill from a new vendor, above the auto limit. Nothing is reserved until a Signer accepts it." | "New vendor, above your 500 USDC auto-pay limit." |
| Facts list "Waits on / a Signer (signer.takara-ai-hq.testnet): accept this bill so money is reserved · Deadline Dec 30 (in 46 days) · Blocks: Payment of 900 USDC to bigagency.testnet, due Dec 30. Accepting it would leave −882.5 USDC spendable, so you'd also need to add funds." | Two lines: "Due Dec 30 (in 46 days)" and "Accepting leaves −882.5 USDC spendable. Add funds first." |
| Pending row "Railway · Subscription · 120 USDC · Pending check · 2 identical copies · Instructions ignored · 2d so far · Blocks: Nothing yet. Banto decides this within policy." | "Railway · 120 USDC · 2 copies · hidden instructions ignored" |
| Empty state "Nothing is waiting. Bills above 500 USDC, first bills from new vendors over the limit, and payout changes land here. Banto pays everything else within policy." | "Nothing needs you." |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `ap.approve` | the first card's Approve button | "Approving opens your wallet to sign. Rejecting needs a short reason so the sender knows what to fix." |
| `ap.timer` | the "Waiting on time" group header (only when present) | "A Signer approved this. The wait lets you catch a hijacked approval before payment." |

### Keep
- "How is this approved?" disclosure (closed by default).
- The role-disabled reason under the buttons ("Only a Signer can do this … You're connected as …") and **Try anyway**. This is honesty state (plan §5.2.6).
- The −882.5 USDC consequence. It is the one number that changes the decision.

---

## 4. Money (`VIEWS.money`)

### Remove
| What | Where | Reason |
|---|---|---|
| Description "Invoices, subscriptions, payroll and reimbursements. One kind of record underneath. Money is reserved only when a bill is accepted." | ~L2040 | Obvious; internal model |
| Legend "Received → Reserved → Settled → Closed / Only Reserved reduces what you can spend. Receiving a document never creates an obligation." | ~L2054 | Becomes a hint |
| `eqHTML(m)` reconciliation equation | ~L2055 | Duplicate; Overview owns it |
| Sum line "7 open · 1 needs you · 2 pending check · 1,140 USDC not reserved yet" | ~L2055 | Duplicates the filter counts |
| Count badges on the **kind** tabs (All 13 / Invoices 2 / Subscriptions 5 / Payroll 4 / Reimbursements 2) | ~L2050 | Stat nobody acts on. Keep the counts on the status tabs only. |

### Shorten
| Before | After |
|---|---|
| Row meta "Payroll · critical · Due Dec 1" | "Payroll · Due Dec 1" (keep "critical" only in the drawer) |
| Status filter "Flagged 5" | Keep |
| Empty state "Nothing here. Takara records a bill when a document arrives. Nothing is reserved until it's accepted." | "No bills yet." / "Nothing matches this filter." |
| Auditor note "Auditor range Nov 1–30: bills recorded inside the range, read-only." | "Nov 1–30 only · read-only" |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `money.flow` | `.seg[aria-label="Status"]` | "A received bill costs nothing. Only Reserved bills reduce what you can spend." |

### Keep
- The "Add money · Preview" menu and "Export CSV".
- The flag tags ("Payout changed", "Instructions ignored", "New vendor over the limit"). They tell the safety story at row level.

---

## 5. Bill drawer (`billDrawer` ~L2603)

### Remove
| What | Reason |
|---|---|
| "Details": the "Vendor · Bigagency" row and the "Payee chain and token · NEAR · USDC" row | Both duplicate the header and the Destination block |
| "Route · Preview · If a route is unavailable or costs more than usual, Banto tells you instead of taking a worse one." (~L2636) | Preview noise; it stays listed in Demo scope |
| Receipt line "Escrow released, nonce burned, receipt on-chain." (~L2638) | Banned word and jargon |
| Receipt line "Testnet: no tokens move; payouts run through NEAR Intents on mainnet." (~L2638) | Consolidated into Overview's calculation disclosure |

### Shorten
| Before | After |
|---|---|
| "Waiting on a Signer (signer.takara-ai-hq.testnet): accept this bill so money is reserved." | "Waiting for a Signer to accept." |
| "It needs its own envelope: accepting it would leave −882.5 USDC spendable." | "Accepting leaves −882.5 USDC spendable." |
| "Issues · New vendor over the limit. This is the first bill from this vendor and it is above the new-vendor auto limit, so a Signer must accept it." | "New vendor, above the auto-pay limit." |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `drawer.strip` | the drawer's `.rstrip` | "Where this bill's money sits among everything already set aside." |

### Keep
- The "On-chain proof" disclosure (commitment hash, evidence hash, attestation, nonce), the settlement transaction link, "Copy receipt", "Ask Banto why", and the Approve/Reject buttons with the role reason. Judges verify from these.

---

## 6. Alerts (`VIEWS.alerts` ~L2172)

**Before:** 6 sections, about 3,300 characters. **After:** "Live now" and "Recent" open; everything else in one closed disclosure. About 1,100 characters.

### Remove
| What | Reason |
|---|---|
| Description "What Banto would send, to whom, right now." | Obvious |
| Sub "Each carries the amount, the deadline and one action. The content is live; delivery to Telegram or email is preview." | Becomes a hint |
| "No renewals in the next 7 days." footer | Noise when nothing is due |
| The whole section **"Renews in 14 days or less 0 · Lower priority. A heads-up before the 7-day alert …"** when empty. When it has items, merge them into Live now. | Stat nobody acts on |
| Sub "Resolved or informational. Nothing to do." | Obvious |
| The whole section **"Sent to payees only"** (6 "Settled: … To Payee only (…) View receipt" rows) | Duplicate of Reports › Receipts |
| Per-row "Amount …" meta (it is already in the sentence) | Duplicate |

### Shorten
| Before | After |
|---|---|
| "To Owner (takara-ai-hq.testnet), Signer (signer.takara-ai-hq.testnet)" | "To Owner, Signer" |
| "Shortfall predicted: if the 3 bills not yet reserved (1,140 USDC) are accepted, bills would exceed available money by 1,122.5 USDC." | "If you accept the 3 waiting bills (1,140 USDC), you'll be short 1,122.5 USDC." |
| "Payout change cleared: Railway's new address railway-new-bank.testnet was approved by a Signer, and the cooling-off ended Nov 13, 9:59 PM. Its next payment goes there." | "Railway's new payout address is approved and active since Nov 13." |
| The rest of the page ("Plan lapsing · Preview", "The rules" table, "Delivery · Preview") | Move into one closed `<details>`: "How alerts work". Rules table, delivery and plan lapsing go inside, each keeping its Preview chip. |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `alerts.live` | `#al-live` | "What Banto would send right now. Telegram and email delivery is a Preview." |

### Keep
- "Payout-change alerts keep sending even if your plan lapses" inside the rules table (a product promise).
- The Preview chips on Delivery and Plan lapsing.

---

## 7. People (`VIEWS.people` ~L2148)

### Remove
| What | Reason |
|---|---|
| Description "Who can do what, and who gets paid. Owner and Signer rights are enforced by the treasury contract." | Becomes a hint |
| "Four roles plus Banto. Every confidentiality rule depends on which one you are." (~L2153) | Obvious |
| "Adding a teammate means signing a new policy version: the team roster lives inside the signed policy, so a Signer approves every change." (~L2154) | Too long. Keep the honest part as a short line next to the Invite button: "Today: a Signer signs a new policy version." |
| "The founder plan calls this role Manager. On-chain, the same key also signs policy." (~L2157) | Internal history. Keep only "Also signs policy." (contract truth, §5.2.8) |
| Role map sublines "contract owners", "contract agent", "none on-chain" | Jargon |
| "Payroll is private between colleagues, not from the people who approve it." (~L2164) | Becomes a hint |

### Shorten
| Before | After |
|---|---|
| Owner: "Pause or resume, revoke or restore Banto, recover funds, release a reservation. Wallet buttons on Policy." | "Can pause, switch off Banto, recover funds." |
| "Recommended: add a second owner before mainnet, so one lost device can't lock you out." | "Add a second owner, so one lost device can't lock you out." (keep: contract truth, "one owner key") |
| Signer: "approves bills and signs policy · 1 of 1 / Accepts or closes bills, approves or rejects payout changes, signs policy changes. Every action is signed in the Signer's own wallet." | "Approves bills and payout changes. Also signs policy." |
| Member: "gets paid · no on-chain authority / Gets paid, by payroll or a reimbursement. Payroll today is one aggregate payee on a monthly cycle. Per-person and weekly payroll, submitting claims in the app and setting their own payout address are Preview" | "Gets paid. Payroll today: one monthly payee." + Preview chip |
| Banto: "Records bills, requests decisions, pays what the engine authorized. Never an owner or Signer action." | "Records and pays bills within policy. Can't approve or change limits." |
| "Who sees what" block (5 rows) | Put it in a closed `<details>` and keep the SEALED · TEE tag on its summary |
| Three Preview buttons "Invite / Set up payroll / Import CSV" | One "Add person" button carrying the Preview chip (opens the existing How sheet) |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `people.roles` | the Owner row | "Owner and Signer powers are enforced by the treasury contract, not by this app." |
| `people.private` | the "Who sees what" summary | "Colleagues never see each other's pay. Approvers see what they approve." |

### Keep
- The account ids for owner, signer and agent (judges cross-check them on-chain), and the agent status "Active".
- The "See it as each role" button.

---

## 8. Vendors (`VIEWS.vendors` ~L2080)

Already short. Small cuts only.

### Remove
| What | Reason |
|---|---|
| Description "Who Takara pays and where. A payout destination can't change without a Signer and a cooling-off period." | Becomes a hint |
| Footnote "Payroll and team members are on People and under Money › Payroll." (~L2087) | Obvious |
| "NEAR · USDC" on every row (identical on all rows) | Stat nobody acts on |
| Two Preview buttons "Add vendor / Import CSV" | One "Add vendor" button with the Preview chip |

### Shorten
| Before | After |
|---|---|
| "1 payout change caught and frozen. Approved changes wait 24 hours before any payment." | "1 payout change caught and frozen." |
| "The vendor registry is sealed: names and destinations are encrypted on-chain SEALED · TEE" | "Names and addresses are encrypted on-chain. SEALED · TEE" |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `vendors.payout` | the first vendor row | "A payout address can't change without a Signer and a 24-hour wait." |

---

## 9. Policy (`VIEWS.policy`, `policyForm` ~L2486, `ownerControls` ~L3355)

### Remove
| What | Reason |
|---|---|
| Description "The limits Banto must stay inside. Changing them needs a Signer's signature." | Becomes a hint |
| "Set by the setup interview" (~L2470) | Noise |
| "From setup question 5 / 6 / 7" (~L2490, three times) | Internal plumbing |
| "Enforced by the contract, proven on testnet." (~L2476) | Duplicate of the "Refused on testnet" links |
| Second "Recommended: add a second owner before mainnet." (~L2474) | Duplicate of People |
| "Attaches 1 yoctoNEAR, as token transfers require." (~L3381) | Jargon |
| "Signed in the owner's own wallet (takara-ai-hq.testnet). Each action asks you to confirm first." | The confirm step already shows this |

### Shorten
| Before | After |
|---|---|
| Field description "Discretionary payments must leave at least this much runway." | "Optional payments must leave this much runway." |
| Field description "How long Takara waits after a Signer approves a new vendor destination." | "Wait after a payout address change." |
| "Editing previews a change. A signature applies it. Nothing changes until a Signer signs the new version in their own wallet." | Becomes a hint. Below the buttons keep only "Needs a Signer's signature." |
| "Owner controls · manual fallback" | "Owner controls" |
| "These work with Banto, the enclave and our servers all switched off. A Signer's approval also works without Banto. If you stop paying for Takara, this is how your money stays yours." | "Work even with Banto and our servers off." |
| "Moves tUSDC out of the treasury with no agent involved." | "Move tUSDC out of the treasury yourself." |
| Signer lens: "Owner only. Signers approve bills and sign policy; pausing, revoking and recovering belong to takara-ai-hq.testnet." | "Owner only (takara-ai-hq.testnet)." |
| "Who can change this": the five-row block | Keep the version, the hash and the Signer. Remove the "Owners (ownership)" row (duplicate of People). |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `policy.edit` | the first limit input | "Edit to preview the change. Nothing applies until a Signer signs it in their wallet." |
| `policy.owner` | `#oc-h` | "These work even if Banto and our servers are off. Your money stays yours." |

### Keep
- **"What Banto can never do"**: the four rows with "Refused on testnet" links. These are the judges' proof.
- The policy hash, version, SEALED · TEE on contents, and the before/after strip in the sign dialog.
- The recover form with its double-entry amount. It is safety, not clutter.

---

## 10. Reports & receipts (`VIEWS.reports` ~L2210)

### Remove
| What | Reason |
|---|---|
| Description "Every decision in plain English, scoped receipts, and records you can export at any time, plan or no plan." | Becomes a hint |
| Activity filter chips "Held 2", "Money 20", "Admin 20" | Too many tabs. Keep All, Caught, Security tests, and Business as the default. |
| The "· Banto (agent)" actor suffix on every row (see §11) | Duplicate |
| Receipts footnote "Each receipt shows only its own line. A receipt records settlement on the testnet ledger; no tokens move on testnet, and payouts run through NEAR Intents on mainnet. Signed receipts that a third party can verify are Preview" (~L2241) | Consolidated. Keep only "Receipts are unsigned." + Preview chip (contract truth, §5.2.8). |
| Export: "CSV with a header line marking it as fictional fixture data on NEAR testnet." (~L2249) | Obvious; the file itself says it |
| Export: "Accounting and auditors / QuickBooks · Preview / Xero · Preview / Grant read-only access …" (four Preview items) | Collapse into one "Accounting export" row with the Preview chip |
| Intake: "Receiving a document never creates an obligation. Only an accepted bill reserves money." (~L2272) | Duplicate of the Money hint |

### Shorten
| Before | After |
|---|---|
| Receipt card rows "Bill #1 / Payee railway-pay.testnet / Commitment hash 6bb50ffc…c8f6 / Attestation Request 1 · output 88ec3059…8673" | Show the name, amount, date, "Settlement transaction ↗" and "Copy receipt". Put the hashes in a per-card "Proof" `<details>`. |
| Intake rows "Document in → recorded as bill #12 (Payroll run, 15 USDC). Not reserved." | "Bill #12 · Payroll run, 15 USDC" |
| Intake "Document in → refused: the sender isn't on the team roster. No obligation created." | "Refused · sender not on the team" |
| "Hidden: 1 security test run from the judge checks. Show security tests" | "1 security test run hidden · Show" |
| "Your records are always exportable, plan or no plan." | Keep (product promise), drop the "Download records" heading |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `reports.tabs` | `.tabs` | "Every decision Banto made, in plain English. Export anytime, plan or no plan." |

### Keep
- The "Security tests" filter, the "(judge checks)" grouping, settlement and attestation links (now inside Proof), and Copy receipt.

---

## 11. Activity sentences (`decisionItem` ~L1404, `actItem` ~L1515), used on Overview, Reports and drawers

| Before | After |
|---|---|
| "Settled on the ledger: Payroll run 15 USDC. Escrow released and a receipt recorded on-chain." | "Settled: Payroll run, 15 USDC." |
| "Recorded a bill from Payroll run for 15 USDC, due Nov 20. Not reserved yet." | "New bill: Payroll run, 15 USDC, due Nov 20." |
| "Accepted Payroll run 15 USDC automatically, within policy. The money is now reserved." | "Reserved: Payroll run, 15 USDC (auto, within policy)." |
| "Accepted: the Signer accepted Ana 12.5 USDC. The money is now reserved." | "Reserved: Ana, 12.5 USDC (Signer)." |
| "Authorized payment of Payroll run 15 USDC, valid until Nov 13, 11:51 PM." | Reports › All only; hidden from the default feed |
| "Blocked: paying Ana 400 USDC would break money reserved for Payroll run and Railway." | Keep (the core story) |
| "Frozen: an invoice for Railway asks to pay railway-new-bank.testnet instead of railway-pay.testnet." | Keep |
| Meta "11:36 PM · Banto (agent)" | "11:36 PM". Show the actor only when it isn't Banto ("· Signer", "· Owner"). |

---

## 12. Public view (`VIEWS.ledger` ~L2504), also the Public and Auditor lens

### Remove
| What | Reason |
|---|---|
| Description "The same treasury as anyone can read it on NEAR testnet." | Becomes a hint |
| "This is the public chain observer row of the confidentiality table: commitments, hashes and attestations. No names, amounts or destinations. Who sees what" (~L2507) | Jargon; duplicate of the "sealed" block |
| "Settlement on testnet releases the reservation and records a receipt without publishing a payee or amount. The confidential mainnet payout is a separate, labelled run, and this contract doesn't enforce it." (~L2524) | Shorten (below); keep the contract-truth half |
| Priority column ("Normal / Critical / Discretionary") on commitments | Stat nobody acts on |

### Shorten
| Before | After |
|---|---|
| "Balance 1,400 tUSDC (test token, no value). Reserved and spendable are sealed." | Keep. It is the one test-token disclosure on a public page. |
| "What strangers see, and what stays sealed / Visible on-chain: Bill states, priority, flags, hashes, attestations, the total balance. / Sealed: Vendor names, amounts, payout destinations, policy contents." | "Public: bill states, flags, hashes, balance. Sealed: names, amounts, addresses, policy. SEALED · TEE" |
| "Change 0 on bill #4: approved, in cooling-off. Decided by Signer (signer.takara-ai-hq.testnet) on Nov 12, 9:59 PM." | "Bill #4 payout change: approved by Signer, Nov 12." |
| The footnote above | "Mainnet payouts are a separate run this contract doesn't enforce." |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `ledger.what` | `#h1` | "Exactly what anyone can read on NEAR testnet. Names, amounts and addresses stay sealed." |

### Keep
- **All on-chain identifiers:** Agent, Treasury state, Policy version and hash, Owners, Signers, Pinned engine (with link), Ledger state hash, and the commitment hashes per bill. This is the judges' verification surface.

---

## 13. Plan & billing (`VIEWS.plan` ~L2279)

### Remove
| What | Reason |
|---|---|
| Description "You're a design partner, so Takara is free. These are the plans once billing starts." | Duplicate of "Current plan" |
| "Renews automatically, paid from your treasury as a bill you accept. Route fees passed through at cost." | Fine print; move it under "Choose plan" as small text, or drop |
| "Why setup is free / Setup is free and has no time limit. You pay at your first payout …" (~L2293) | Duplicate of Get started |
| "Simulation over your real bills." | Obvious |

### Shorten
| Before | After |
|---|---|
| "When a plan lapses" 5-point list | 3 points: "Your funds and records stay yours." / "Banto stops; payout-change alerts never do." / "Payroll and critical bills still pay for 14 days." |
| Lapse simulator: an open list of 7 "Would freeze" rows | A closed `<details>` "What would freeze if the plan lapsed?" |
| "Design partner · free / No card on file and no end date. Nothing lapses while you're a design partner." | "Design partner · free, no end date." Move this to the **top** of the page (plan §5.2.3 exception). |

### Move to first-use hint
| key | anchor | text |
|---|---|---|
| `plan.free` | the pricing panel | "You're free as a design partner. These prices show what billing will look like." |

### Keep
- The Preview chip on pricing and "Choose plan", and the "$39 a month" headline.

---

## 14. Get started (`setupSteps` ~L2308) and Setup interview (`ivBody` ~L2376)

### Remove
| What | Reason |
|---|---|
| Description "Fixture Co's treasury is set up. Here is how it got here, step by step." | Obvious |
| Step 4 detail "Receiving a document never created an obligation. Refused: 1 duplicate, 1 from someone not on the team, 1 while Banto was revoked. Not processed: 1 while the policy engine was unavailable; resend it." (~L2329) | Too long; the Intake log has it |
| Step 5 proof: `eqHTML` + reserve strip | Duplicate of Overview. Keep the one line "Spendable 17.5 USDC. Runway 32 days." |
| Step 6 "This is where you'd pick a plan. As a design partner you don't pay." | Duplicate of Plan |
| Panel "Setup is free" (it duplicates Plan) | Duplicate |
| Second "Replay the setup interview" button (in "Meet Banto") | Duplicate |
| Interview description "Ten questions. Each answer becomes a setting you can change later without talking to anyone." | Duplicate of Banto's intro bubble |
| Per-row provenance in the interview rail ("Saved in this browser", "Live from the contract", "On-chain when a Signer signs", repeated 10 times) | Replace with one small dot legend: a solid dot means on-chain, a hollow dot means saved in this browser. Keep the footnote "Rows saved in this browser aren't part of the signed policy." **The honesty signal stays; the repetition goes.** |

### Shorten
| Before | After |
|---|---|
| "Step 1, done: Treasury created. You own it. treasury.takara-ai-hq.testnet, owner takara-ai-hq.testnet" | "Treasury created · treasury.takara-ai-hq.testnet" + "View on NEAR testnet ↗" |
| "3 vendors and 1 team member registered. Payroll run, Railway, Inkwell Design Tools, Ana. New vendors: 2." | "3 vendors and 1 team member added." |
| "17 documents in: 13 bills recorded, 3 refused, 1 not processed." | "17 documents in · 13 bills, 3 refused." |
| "Meet Banto · Banto works for Fixture Co. It reads invoices, reserves money for bills you accept, and pays inside the policy you signed. It can't change its own limits, and an owner can switch it off at any time." | "Banto reads invoices, sets money aside for bills you accept, and pays within your policy. An owner can switch it off." |
| Interview "Saved in this browser. The product name stays Takara AI." | "Saved in this browser." |

### Keep
- The policy hash and "View on NEAR testnet" in steps 1–2, the settlement transaction link in step 6, and the "Saved in this browser" footnote in the interview.

---

## 15. Ask Banto (`#/ask` and the dock)

| Action | What |
|---|---|
| Remove | Description "Ask why something was blocked, what renews next month, or whether you can afford a contractor. Answers come from the ledger and link to the transaction. Banto can't pay, approve or change anything here." The suggested questions already show this; the read-only fact moves to the `ask` hint (§1). |
| Remove | "Suggested for this page" label (the chips are obvious) |
| Shorten | Bubble "Banto answers questions here. To approve or change something, use the buttons. They're one click." → "Ask me about any bill or payment. I can't move money." |
| Keep | The 5 suggested questions |

---

## 16. Lens-specific screens

### Signer
- Same screens as Owner, plus the short `lensNote`. The Policy owner-controls text is shortened in §9.
- **Remove:** nothing extra.

### Member · Ana: My pay (`myPay` ~L2109), My claims, Receipts, Alerts
| Action | Before → after / what |
|---|---|
| Remove | Desc "Ana's own payments, payout address and receipts. Nothing about any colleague." (it becomes the `member` hint) |
| Remove | Footer "You see your own pay, claims and receipts. Nothing about colleagues or company totals." (~L2120): duplicate of the description |
| Remove | Latest-alert meta "To Ana only" (Ana is the only possible recipient) |
| Shorten | "Paid (settled): your reimbursement of 12.5 USDC. Settled on the testnet ledger with a receipt on-chain." → "Settled: your 12.5 USDC reimbursement." |
| Shorten | "My payments · 2 payments · 412.5 USDC" → keep "412.5 USDC paid" only |
| Remove | Claims: "Received → Reserved → Paid. A claim reserves money only when it's accepted." (~L2131) |
| Remove | The duplicate "Submit a claim · Preview" button (it appears twice) and "Forward a receipt and get paid back on the chain you use, without a message to the founder." Keep one button with the chip. |
| Remove | Receipts desc "One line per payment, scoped to Ana. Share a receipt without showing anyone else's pay." |
| Remove | Alerts sub "Newest first. Only Ana's own claims and payments." |
| Remove | The "What Ana hears about" list (5 bullets). It is a duplicate of the alert feed. |
| Remove | "To Ana only" on every alert row |
| Shorten | "Not accepted automatically: your reimbursement of 400 USDC. Paying it then would have used money already set aside for other bills." → "Held: 400 USDC would have used money set aside for other bills." |
| Hint | `member` · anchor `#h1` · "This is Ana's view: only her own pay, claims and receipts. Nothing about colleagues." |

### Auditor
- Covered by Money (§4), Reports (§10) and Public view (§12). The nav heading "Records, read-only" stays: it is the honest state label.

### Public
- Public view (§12).
- Gate screens (`lensGate` ~L1752): "The public chain observer sees commitments, hashes and attestations. / No names, no amounts, no destinations." → "Public visitors only see the Public view." Shorten the other gates the same way:
  - Member: "Members only see their own pay."
  - Auditor: "Auditors see records for Nov 1–30, read-only."

---

## 17. Expected reduction (visible `#main` text, characters)

| Screen | Before | After (est.) | Cut |
|---|---:|---:|---:|
| Overview | 3,900 | 1,500 | 62% |
| Approvals | 1,530 | 600 | 61% |
| Money | 1,510 | 950 | 37% |
| Alerts | 3,290 | 1,100 | 67% |
| People | 2,050 | 950 | 54% |
| Vendors | 760 | 450 | 41% |
| Policy | 2,100 | 1,200 | 43% |
| Reports (Activity tab) | 5,280 | 2,600 | 51% |
| Public view | 1,850 | 1,100 | 41% |
| Plan & billing | 2,070 | 1,000 | 52% |
| Get started | 1,710 | 800 | 53% |
| Member · My pay / Alerts | 900 / 2,330 | 450 / 1,000 | 50% / 57% |
| **Total** | **~29,300** | **~13,700** | **~53%** |

Money falls just short of 40%. Its table is data, not copy, and its copy is cut more than 70%.

---

## 18. Top 10 changes, ranked by impact on a first-time user

1. **Overview down to one story.** Banto's single action line, then Spendable with equation and strip, then three figures (Runway, Needs you, Caught), then Coming up. Delete the Approval queue panel, the "Not reserved yet" figure, the chart footnotes and the test-run line. Today the same 900 USDC bill appears 5 times on the first screen.
2. **Delete the description paragraph under every page title.** That is 13 owner pages plus lens pages. Each one restates the H1 or explains rules better shown once as a hint.
3. **One-line activity sentences** (§11). Drop "Escrow released and a receipt recorded on-chain" (banned word), the "valid until" authorization rows, and "· Banto (agent)" on every row. This affects Overview, Reports and drawers.
4. **Alerts: two sections open, the rest closed.** Remove the empty 14-day section and the "Sent to payees only" list (it duplicates Receipts). Fold the rules, delivery and plan lapsing into one "How alerts work" disclosure.
5. **Approvals: one card, two facts.** Remove the right rail (Who approves, Rejecting, Escalation). Cut each card to "Due …" plus the consequence ("Accepting leaves −882.5 USDC spendable"). The reject-reason rule becomes a first-use hint.
6. **Consolidate the honesty markers.** Strip copy: "Demo on NEAR testnet · fictional data · What's live". "Testnet: no tokens move" lives only beside the Settled figure. The equation lives only on Overview. `lensNote` becomes one line. The Preview chips stay as they are.
7. **Turn about 20 inline explanations into first-use hints** (each hint text is listed under its screen above). The most important are Spendable, the reserve strip, Approve, the Money status flow, the payout-address rule, policy editing and the lens switcher.
8. **People: one line per role.** Remove "Four roles plus Banto…", the "founder plan calls this role Manager" history and the jargon sublines. Collapse "Who sees what". Merge three Preview buttons into one.
9. **Receipts and Public view: proof behind a disclosure, not deleted.** Hashes and attestations move into a per-receipt "Proof" `<details>`. Remove the confidentiality-table jargon from Public view. Every on-chain id stays.
10. **Policy and Get started: drop the plumbing.** Remove "From setup question N" ×3, "Set by the setup interview", "Attaches 1 yoctoNEAR", the step-5 equation, the step-4 detail and the duplicate "Setup is free" panel. Replace the interview's provenance label, repeated 10 times, with one dot legend.

---

## Things that look removable but must stay

- **The demo strip** (`paintStrip`), **the scope sheet**, **the Preview chips** (`pvTag`), **"Saved in this browser" notes**, and the **lens note** (shortened). These are honesty, per plan §5.2.
- **One "Testnet: no tokens move"**, on the Settled row in Overview › "How is this calculated?".
- **The reconciliation equation**, on Overview only.
- **The query formulas** inside "How is this calculated?" (judges verify every figure from them).
- **On-chain verification surface:**
  - the "Refused on testnet" links (Policy);
  - the policy hash and version;
  - the pinned engine and ledger state hashes;
  - commitment hashes;
  - attestation links;
  - settlement transaction links;
  - account ids for owner, signer, agent and treasury;
  - the "Security tests (judge checks)" filter in Reports.
- **Role-disabled reasons and "Try anyway"** under action buttons.
- **The −882.5 USDC consequence** on the approval card and in the drawer.
- **Contract-truth one-liners** (plan §5.2.8), in short form: one owner key ("Add a second owner…"), the Signer also signs policy, "Receipts are unsigned", "Mainnet payouts are a separate run this contract doesn't enforce".
- **The SEALED · TEE tag**, once per page where private data appears.
