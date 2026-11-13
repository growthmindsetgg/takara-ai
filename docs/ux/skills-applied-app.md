# Skills applied to the owner app (`web/index.html`)

Rework of 2026-11-13. Each skill was invoked with the Skill tool. Three of them (`unslop`, `design-system-patterns`, `kpi-dashboard-design`) load from the project copies in `.claude/skills/`, so the SKILL.md read is the project one. Every line below names an element in the new `web/index.html` and gives the before → after.

## unslop

Direction written before editing:
- **Product:** a non-custodial treasury agent that a small-business owner trusts with bills.
- **Character:** calm, exact, protective.
- **World:** a ledger book and cash envelopes.
- **Moment:** the reserve strip.
- **Signature:** `SEALED · TEE`.

Changes:
1. **Status everywhere.** Before: `.pill` badges with tinted fills and a dot, in every table, card and drawer. After: `.st`, an 8px dot plus a text label (`st()` / `stOf()`); nothing in the app is pill-shaped.
2. **Approval cards.** Before: `.acard` had `border-left: 3px solid` amber or red. After: `.ap` uses only a hairline border. Urgency is carried by the dot and the label.
3. **Issues.** Before: badge chips such as "Payout changed" and "Instructions ignored", stacked under each bill. After: `issuesLine()`, one second line in muted vermilion (`--issue: #9C4A3B`), with the issues joined by " · ".
4. **Demo banner.** Before: an 87px amber `.demo` box, plus `Testnet` and `Fictional data` chips in the sidebar and top bar. After: one 32px ink `.strip`, dismissible for the session. All `etag` chips and the per-row "Fictional" tags (`fictTag`) are deleted.
5. **One bright element.** Before: a 12px `.bar` where "already paid" (grey) was the widest segment. After: the 40px `.rs-bar` reserve strip. It is the only rich-colour object on Overview; the chrome around it stays neutral.
6. **Copy tells.** Before: placeholders ended in an ellipsis ("Ask about a bill, a block or a figure…") and buttons read "Loading wallets…" and "Confirm in your wallet…". After: no ellipses in placeholders or button labels. Labels use sentence case, and there are no uppercase tracked labels.

## frontend-design

1. **Type.** Before: IBM Plex Sans and IBM Plex Mono, with 24px/600 titles. After: Geist for the UI and Geist Mono for amounts, accounts and hashes, with page titles at 28px/500. The app uses 7 type sizes (`--t-12` to `--t-44`).
2. **Signature element.** Before: a generic stacked bar and legend. After: `reserveStrip()`, which draws each accepted bill as an envelope with a flap (`.env::before`), then a dashed `.perf` protected line, then a mint `.spendseg`. Paid money moves to a footnote (`.rs-foot`).
3. **Layout.** Before: a 240px sidebar, `.queue { max-width: 760px }`, and a lot of dead space. After: a 248px sidebar and `--maxw: 1240px`. Overview pairs an 8-column hero (strip plus `.figs`) with a 4-column approval-queue rail; Approvals pairs 8 columns of cards with a 4-column side panel.
4. **Numbered markers only for real sequences.** The 01–06 style appears only in `.stepper` on Get started (six ordered setup steps), the offboarding list `.offl` (an ordered procedure) and the lapse rules `.lapse`. Nowhere else.
5. **One orchestrated motion.** The strip's `grow` entrance runs once (`stripAnimated`). Nothing else animates on load.

## emil-design-eng

1. **Easing.** Before: two curves (`--ease: cubic-bezier(.2,.7,.2,1)` and `--ease-out`). After: one, `cubic-bezier(.23,1,.32,1)`, with 140ms hovers (`--hover`) and 240ms drawers and sheets (`--enter`).
2. **Press feedback.** Before: `.btn:active { transform: translateY(1px) }`. After: `scale(.98)` over 100ms (`--press`) on `.btn` and `.askbtn`.
3. **No animation on keyboard-initiated actions.** The ⌘K / Ctrl K Ask Banto dock opens and closes with no transition, so it feels instant (Raycast rule).
4. **Popover origin.** The new "Add money" menu (`.menu-l`) uses `transform-origin: top right` and enters with `mdIn` at 160ms. It never animates from `scale(0)`.
5. **Numbers tween on refresh, never on first paint.** The `tween()` helper interpolates the Spendable and Runway figures (`data-tween`) over 600ms with an ease-out. It skips the first render and respects `prefers-reduced-motion`.
6. **Skeletons.** Before: a gradient shimmer (`@keyframes shimmer`). After: a quiet opacity pulse (`skp`). The live RPC dot (`.live`) is the only looping element that remains, as the design direction allows.

## design-system-patterns

1. **Token layers.** Before: primitives were named after hues (`--p-amber-800`, `--p-red-800`) and a `--seg-*` set was half-wired. After: three layers matching design-direction.md: primitives (`--c-paper #FAFAF7`, `--c-ink #0E1A16`, `--c-green #0B5D4B`, `--c-mint`, `--c-paid`, `--c-amber`, `--c-verm`), semantic roles (`--brand`, `--spend`, `--paid`, `--wait`, `--bad`, `--issue`) and component tokens (`--side`, `--maxw`, `--dock`, `--strip-h`, `--r-ctl/card/sheet`, `--env`).
2. **Radii by role.** Before: 4, 6, 10 and 14px used ad hoc. After: 8 for controls, 12 for cards and 16 for sheets (`--r-ctl`, `--r-card`, `--r-sheet`).
3. **Shadows.** Before: a `--lift` shadow on the hero card plus popovers. After: hairlines only. The one `--sheet-shadow` is used on dialogs, the drawer, menus and toasts.
4. **One preview component.** Before: none existed. After: `.pv` (dashed hairline), `pvTag()` (mono "Preview · after the hackathon"), `pvBtn()` (a dashed button with a "preview" suffix that opens the How sheet) and `pvFoot()`. All are used the same way on People, Alerts, Plan, Reports, Vendors, Money and the drawers.
5. **Shared status vocabulary.** Before, tone names were mixed: neutral, accent, quiet and warn. After, the single set is `t-good`, `t-wait`, `t-bad`, `t-paid` and `t-quiet`, used by bills, vendors, the public view and alerts.

## kpi-dashboard-design

1. **Contradictory number formats.** Before: "1400USDC", "805 USDC" and "Recurring burn 25.5 USDC a day" each came from a different formatter. After: one formatter, `money()` / `moneyT()`, renders `1,400 USDC` with a thin space and tabular Geist Mono figures everywhere, including the CSV header and the toasts.
2. **Methodology on the card.** "How is this calculated?" stays on the hero. It lists each figure with the deterministic query behind it, as the skill's "don't hide methodology" rule asks.
3. **KPI count and hierarchy.** Before: one hero number and three equal metric cards. After: one hero (Spendable now, of the total), the strip, and four subordinate figures in `.figs`: Runway with its floor context, Awaiting approval, Not reserved yet, and Caught for you. The wider Caught cell carries the "$39 a month" link to pricing.
4. **Context on each number.** "Above your 7-day floor" and "Burn 25.5 USDC a day" sit under Runway. "Available after payouts 880 USDC · Reserved in 4 envelopes 805 USDC" sits beside the hero, so the 75, 805, 880 and 1,400 figures reconcile on screen.
5. **Alerts that people keep reading.** `computeAlerts()` gives every alert an amount, a deadline, its recipients and exactly one action. Paid notices go into a separate "Sent to payees only" list, so they don't inflate the badge, which shows 3.

## redesign-existing-projects

1. **Kept the stack and the working machinery.** About 570 lines of the previous file are reused verbatim by line range in `scratchpad/assemble.mjs`: the wallet module, the `TREASURY_ACTIONS` allowlist, `verifyProposal`, `runTx`, `walletBoot` and the activity sentence tables. Only the presentation around them changed.
2. **Active nav.** Before: a 3px green `::before` stripe on the active item. After: a surface step (`--brand-wash`) with the icon tinted, and grouped sections (Set up, Operate, Organise, Records, Account).
3. **Empty, loading and error states.** Every new section has a skeleton (`sec()` → `skRows`), an error block with Try again, and a composed empty state. For example, Alerts says "No renewals in the next 7 days. Next renewal: Inkwell Design Tools, 45 USDC on Dec 5. You'll hear on Nov 28."
4. **Dead clicks.** Before: there were no previews at all, and the 3-connect-button problem on Policy. After: every preview button opens the How sheet (`openHow`), which names its build phase, and Owner controls have one connect action (`.connectrow`) instead of three.
5. **Activity rows.** Before: underlined "View transaction" and "Bill" links in every row. After: the whole row is a stretched link to the bill (`.act a.stretch::after`), and the tx glyph (`.txg`) shows on hover or focus (always on touch). Repeats are grouped with a count, for example "4 attempts blocked" (`groupItems`).

## ux-copy

1. **Approvals.** Before: "Accept bill / Close bill". After: "Approve / Reject" (`signerActs`). A Reject opens "Why are you rejecting this?", and the placeholder says "Tell the person what to fix…" without an ellipsis. Errors state the fix: "Add a little more: 3 more characters."
2. **Wallet pre-sheet.** Before: the chooser opened with no context. After: `openPreSheet()` shows "Connect the policy signer to approve, or the owner to pause, revoke or recover", lists both accounts with what each can do, and offers "Choose wallet / Not now".
3. **Role names a person understands.** "Policy signer" became "Manager (policy signer)" the first time and "a manager" after that. "Takara agent" became "Banto (agent)" in Activity (`roleOf`). Contract truths read as one plain sentence beside the element (`.truth`), for example "In this build the manager also signs policy…".
4. **Provisional vendors.** Before: `New vendor · bigagency.testnet` and `new:fb341c87866a` in chat. After: "Bigagency", with "New vendor" as the sub-label (`titleFromAcct`), and chat answers rewrite `new:…` ids to the readable name.
5. **Confirmation copy that names the consequence.** For example: "Blocks: Payment of 900 USDC to bigagency.testnet, due Dec 30. Accepting it would leave −825 USDC spendable, so you'd also need to add funds." And: "Offboard (after the hackathon)", disabled, with the reason given.
6. **Chat refusals point to the button.** "This chat is read-only. Approve or reject in Approvals: one click, signed in your wallet." This comes with an "Open Approvals" link, in both `core.mjs` and `server.mjs`.

## fixing-accessibility

1. **Focus rings.** All visible rings are scoped to `:focus-visible`, with `:focus { outline: none }`. Programmatic focus on page headings (`h1[tabindex="-1"]`) moves the screen reader without painting a ring, but every control keeps one.
2. **Contrast.** The design-direction muted `#7C8580` measures 3.6:1 on paper, so it is used only for non-text marks. Muted text uses `#67706B` (≥ 4.5:1).
3. **Forms and errors.** The reject reason `textarea` has a `<label>`, `aria-describedby` pointing to its help and error text, `aria-required`, and `aria-invalid` on failure, and focus returns to it. Interview number inputs link to `#iv-err` with `role="alert"`.
4. **Dialogs and the dock.** The How sheet, pre-sheet and offboarding dialog are native `showModal()` dialogs with initial focus on their title and focus restored to the opener on close. The Ask dock is `role="dialog" aria-modal="false"`: Escape closes it and returns focus, and ⌘K / Ctrl K toggles it, declared with `aria-keyshortcuts`.
5. **Names on icon-only controls.** The tx glyph (`aria-label="View transaction on NEAR testnet (opens in a new tab)"`), the dock close, strip dismiss and copy buttons, the nav badges and tab badges (`aria-label="Approvals, 1 waiting on a manager"`) all have accessible names, and decorative SVGs are `aria-hidden`.
6. **The reserve strip is announced.** `.rs-bar` has `role="img"` and an `aria-label` that reads every envelope and the spendable amount. The legend underneath is a real `<ul>`.


---

# Fix round 3 (2026-11-13): blind review 6/10

Five skills were loaded and applied to two places: `web/index.html`, and the shared chat intents in `scripts/lib/chat.mjs` (copied to `platform/lib/chat.mjs` by `scripts/build-platform.mjs`).

## kpi-dashboard-design (items 1 and 9)

1. **The calculation is written on the card.** The headline now shows the engine's own formula as a visible equation (`eqHTML`): `1,400 in treasury − 520 paid, settling − 805 reserved = 75 spendable USDC`.
   - The same equation appears on Money, on Get started step 5, in the reserve strip's `aria-label`, in every Ask answer about money and on the product page proof card.
   - The old "Available after payouts 880" side figure is gone, because it was the term that didn't reconcile.
   - The formula matches `queries.spendable` in the engine report.
2. **Each count has one definition.** There are three queue states, each with one label in `Q_LABEL`:
   - "Needs you": a Signer must approve.
   - "Waiting on time": the cooling-off period is running.
   - "Pending check": Banto's policy check is running.

   The nav badge, Overview's "Needs you" figure, the rail summary, the Approvals section headers and the Money status filters all now read 1 · 1 · 2. "Waiting 4" is gone. "Reserved" counts every accepted bill (4), which matches the four envelopes.
3. **Settled bills no longer read as fully paid.** While `settled_outflow > 0`, settled bills read "Paid, settling". The settlement activity line says the balance catches up at reconciliation, instead of "Paid … on testnet".
4. **The headline row stays at four figures.** They are Runway, Needs you, Not reserved yet, and Caught for you. Caught for you shows 5 business catches, with the 7 security-test blocks on a secondary line.

## dataviz (item 9)

1. **Form.** A 60-day cash projection is a change-over-time job, so `projBody` draws it as a single-series step line in inline SVG, with no library.
   - It starts at 880 (in treasury − paid, settling) and steps down on each reserved bill's due date.
   - A dashed reference line marks the protected 7-day runway floor (7 × 25.5 = 178.5).
   - A "Today" marker shows the start.
2. **Marks.**
   - The line is 2px in the brand colour, over a brand-wash area.
   - Markers are 4px with a 2px surface ring.
   - Gridlines and axes stay in the background: hairline rules and 11px muted mono labels.
   - Only two steps get a direct label (the biggest drop and the last step). There is never a number on every point.
3. **Hover by default.** `bindProj` gives each step a 28px hit area with a dark tooltip, and a `<title>` acts as the fallback.
4. **Accessibility.**
   - The SVG has `role="img"`, a title, and a `desc` that reads every step.
   - A "Show as a table" disclosure gives the same numbers in a real table.
   - Bills that aren't reserved are not drawn. They are listed under the chart as not included.
5. **Reserve strip.** Every envelope is now labelled.
   - Wide envelopes carry their label inside.
   - Narrow envelopes show a callout under the bar with a leader line (`.env-c`, container query at 84px). Callouts alternate rows, so neighbours never collide.
   - When the strip itself is under 600px wide, a legend that names every envelope replaces the callouts (`.rs-leg.compact`).
   - Each segment keeps a `title` tooltip.
   - The decorative diagonal "fold" (`.env::before`) is removed.

## ux-copy (items 3, 4 and 5)

1. **Ask Banto answers its own chips.**
   - Answers use plain owner language with names, amounts and dates, never "Commitment #2 … (discretionary, settled)". For example: "Ana's 400 USDC reimbursement was blocked … because paying it would have broken money reserved for Payroll run (600 USDC, due Dec 1) and Railway (120 USDC, due Dec 12)."
   - Every chip on every view was tested on both the local path and the hosted path. All of them answered, so none was removed.
   - Times are sent as ISO and shown in the reader's own time zone.
2. **The feed no longer reads like an attack.**
   - The judge run's probes (wrong-key calls, replays, and the owner's pause, revoke and recover drill) are grouped into one collapsible item: "Security test run · 7 blocked attempts (judge checks)" (`testRuns`, `testGroupItem`).
   - The feed defaults to Business. The other filters are Caught, Held, Money moved, Admin, Security tests and All.
   - Overview shows business events only, plus one line pointing to the test runs.
   - "Caught for you" now separates business catches from test-run blocks.
3. **One Demo scope legend replaces about 20 caveats.**
   - A "Demo scope" button in the top strip opens a sheet listing what is live and what is preview. The same button is in the sidebar footer and the mobile More sheet.
   - Preview items carry one quiet marker: a dashed mono "Preview" tag.
   - Removed:
     - "after the hackathon" (9 places)
     - "Contract truth ·"
     - "In this build"
     - "Billing is ninth in the build order on purpose"
     - "Build phase N of 11"
     - founder-memo lines such as "It's why the plan is $39 a month" and "saying it plainly beats implying more"
   - "Your wallet opens when you click" now appears once, in the Approvals description.
4. **Roles.**
   - The on-chain role is now "Signer" everywhere: nav, the "Viewing as" lens, the wallet role, alerts, the interview and the policy page. It is described as approving bills and signing policy.
   - People says once that the founder plan calls this role Manager.
   - The orange "1 owner key" warning is now a neutral recommendation: "Add a second owner before mainnet".
5. **Plan no longer contradicts itself.** The lapse warning on Alerts is now framed as a sample, starting with "You're on the free design-partner plan, so nothing lapses. Once billing starts…".

## break-ui (item 2)

| # | Severity | Break | Fix |
|---|---|---|---|
| 1 | Broken | Money and Vendors tables lost the name column and their headers overlapped. This happened at 1024px, and at 1280px with the dock open | `.tblbox` is now a container. At `@container (max-width: 900px)` the table switches to the existing card rows, based on the table's own width. The ledger table uses the same treatment |
| 2 | Broken | The dock reflowed the content | The dock now overlays the content, with the sheet shadow |
| 3 | Broken | The Ask entry was off-screen at 1280×800 | It is now at the top of the sidebar, under Banto |
| 4 | Ugly | "Inkwell Design …" was truncated | Names now wrap in tables and rails (`.tbl .t-name`, `.rows .row-n`) |
| 5 | Ugly | The Alerts count was missing on phones | The More tab now carries the Alerts badge, and the sheet row shows the count |
| 6 | Wrong data | "Payroll run" appeared in Vendors | It is filtered out of Vendors and appears under People › Member and Money › Payroll |
| 7 | Ugly | Strip callouts collided at 375px and in the drawer | Under 600px of strip width, a legend replaces the callouts |

Every route was checked at 1280, at 1024 with and without the dock, at 1280 with the dock, and at 375. None showed horizontal scroll or console errors. The screenshots are in the scratchpad `fix3` folder.

## unslop

1. **Banto's mark.**
   - The placeholder "B" is replaced by an inline SVG monogram (`BANTO_MARK`): a B built from two stacked envelopes.
   - It uses the same 32 grid, 2.5 stroke and rounded corners as the Takara square mark, with no face or sparkle.
   - The status ring is kept, and the product page uses the same mark.
2. **Quiet chrome, one rich moment.** The equation and the projection chart carry the visual weight. The preview marker is a small tag, not a sentence.
3. **The Member lens is real UI.**
   - As Member · Ana, the sidebar and mobile tabs swap to My pay, My claims and Receipts. Owner badges disappear and owner pages are gated.
   - As Auditor, the navigation shows records only (Money, Reports, Public view) and every action is hidden.
   - The lens note still says it is a view, not access control.
4. **The interview has a payoff.**
   - Question 10 of 10 shows 100%.
   - The finish card shows the policy diff for the three on-chain settings, signed v1 against your answers. The four browser-only answers follow.
   - When the answers match, it reads "Your answers match signed policy v1. Nothing to sign."
   - When they differ, "Review and sign v2" opens the existing diff, hash check and wallet stepper.

# Pre-demo pass (2026-11-13/14): e2e test bugs B1–B9, wallets, polish

Skills loaded and applied: `web-design-guidelines`, `fixing-accessibility`, `ux-copy`, `break-ui`, `emil-design-eng`. Each change below names the skill whose rule drove it.

## ux-copy: honest settlement language (B2)
- **One word for one state: "Settled".** It replaces "Paid, settling" and "Payouts already sent" everywhere:
  - the equation ("1,400 in treasury − 577.5 settled − 805 reserved = 17.5 spendable"), on both pages and in Ask Banto;
  - status pills and Money filters;
  - the bill drawer's Received → Reserved → Settled stepper;
  - receipts, the public view, vendor totals and member pay.
- **The testnet note appears once per surface, quietly.** "Testnet: no tokens move; payouts run through NEAR Intents on mainnet" sits in the "How is this calculated?" row, the bill receipt, the Reports receipt footer, the copied receipt text, the product page's owner line and the "What is spendable?" answer.
- **The activity sentence describes the ledger.** It now reads "Settled on the ledger: … Escrow released and a receipt recorded on-chain".
- **No claim of a scheduler.** "Paid automatically when due" is gone. The drawer now says settlement runs as a backend command and a due-date scheduler is preview.
- **Member copy (B1).** It names the event, then the plain reason. It never shows a company figure. Example: "Not accepted automatically: … Paying it would have gone below the company’s minimum runway."
- **Engine errors (B5)** read "Engine unavailable: document not processed. Resend it." They are filed under Admin, not Caught.
- **Ask Banto.** Yes/no questions start with "Yes." and "what did we pay" questions don't. "Twice" replaces "2 times". Identical open bills group as "2 copies of …".

## fixing-accessibility
- **Wallet pre-sheet focus.** "Not now", Escape and a backdrop click now return focus to the button that opened the sheet. Previously focus fell to `<body>`. Focus is not returned when the wallet chooser opens next.
- **Member alerts.** Each row has a visible time (`<time>` with the full date in its title), a transaction link labelled for screen readers, and a "View claim" button whose hidden suffix names the claim.
- **Headings and labels.** The new Alerts sections ("Renews in 14 days or less", "Recent events", "Sent to Ana", "What Ana hears about") are `h2` with `aria-labelledby` on their section.
- **Pre-sheet.** The account the action needs is the lead sentence. Its row is outlined in brand green, so the cue is not colour alone: the label text also says "For approvals" or "For owner actions".
- **Contrast.** New muted text (`.asof`) uses `--muted` (#67706B, 4.5:1 on white).

## web-design-guidelines
- **Locale.** Every new time goes through `Intl.DateTimeFormat`. ISO times from Ask Banto still render in the reader's own time zone.
- **No layout reads in render.**
- **Accounts stay intact.** New account strings carry `translate="no"`, and long accounts wrap (`overflow-wrap: anywhere`).
- **Nothing new animates.** The only motion is still the existing drawer, sheet and number tween, all behind `prefers-reduced-motion`.

## break-ui (worst realistic data, through the data boundary)
- **Counts at 1 and above.**
  - "1 bill on-chain was recorded after…" and "2 bills … were".
  - Caught-for-you singulars and plurals are fixed: "2 reserve breaches blocked" used to read "2 reserve breach blocked".
  - Interview Q8 counts payees, not payments: four payroll payments are one payee, so the old "5 payees" is now "2 payees" (B6).
- **Empty states.**
  - Member alerts with no events: "No alerts yet. You’ll hear when a claim is received, accepted, paid or refused."
  - No upcoming renewals: "No renewals in the next 14 days. Next: … You’ll hear on <14 days before>, and again on <7 days before>."
  - Recent events is hidden when there are none.
- **Missing fields.**
  - An alert with no amount (a closed bill that has left the owner report) drops the Amount line instead of showing "Amount  USDC".
  - A settled bill without a settlement transaction in the bundled log shows "Settled on the testnet ledger" instead of an empty receipt section.
- **Stale hosted log (B3).** Bills on-chain that are missing from the bundled log are counted: "N bills on-chain were recorded after this log was bundled".
- **Time passing (B4).**
  - An approved payout change whose cooling-off has ended no longer counts as waiting. That applies to the approval queue, Banto's summary and both badges.
  - It moves to "Recent events: payout change cleared".
  - The compare boxes read "Previous destination" and "New destination, approved", without vermilion.
  - Ask Banto's reserved answer says the cooling-off is over.
- **Checked widths.** 1280, 1024 and 375, local and hosted. No horizontal page scroll. The Money and Reports filter rows still scroll inside their own segmented control, as designed.

## emil-design-eng
- **One rich moment per member page.** My pay opens with the single latest alert. The full history lives on Alerts. No new colour, card style or motion was added.
- **Lower priority looks lower priority.** "Renews in 14 days or less" uses the quiet clock icon, sits below Live now and is left out of the badge count.

## Other review fixes in this pass
- **Get started counts (B9).**
  - Bills come live from the chain (13 here). Refused documents and unprocessed ones come from the log: 3 refused (duplicate, someone not on the team, while Banto was revoked) and 1 not processed.
  - On the hosted copy the refusals are labelled "as of" the log time.
- **Hosted activity is labelled (B3).** "Activity as of <latest entry>" appears on Overview, Reports, the intake log and member Alerts.
- **Decision log.**
  - Both servers dedupe by transaction and serve up to 200 entries, not the last 60. A backfill had doubled every first-run entry.
  - `build-platform.mjs` refreshes the hosted copy on every build and logs the count and latest time.
- **Member lens (B1).** Alerts is in Ana's sidebar and tabs (My pay · My claims · Alerts · Ask · More). It shows received, accepted, not accepted with reason, paid (settled), refused and payout-address changes for her claims only. The latest one is on My pay.
- **Subscriptions.**
  - New: "Renews in 14 days or less", a lower-priority section and rule.
  - New: "Subscription closed" or "Bill closed", from the decision log.
  - Both rules are in the rules table. Content is live; delivery stays preview.
- **Gaps labelled.**
  - People explains that adding a teammate means signing a new policy version, and gains a "Set up payroll" preview button with an honest "Live today".
  - Demo scope lists teammates, payroll setup, weekly per-person payroll, the scheduler and testnet token movement as preview.
  - The plan sheet says nothing is charged.
- **Wallets.**
  - The manifest is cut to Meteor (default), MyNearWallet, Intear and NEAR CLI. Evidence is in `docs/wallet-connect-plan.md` under "Wallet shortlist".
  - The pre-sheet names the account each role needs.
- **Product page.**
  - Provisional vendors are named like the app ("Tinylogo", not "New vendor").
  - The payout-change card says the cooling-off ended.
  - The offline snapshot is regenerated from the live report and still labelled as a snapshot.
- **"Manager" becomes "Signer"** in alerts recipients and the drawer action heading.
