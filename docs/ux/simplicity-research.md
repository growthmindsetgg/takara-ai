# Simplicity research for Takara (2026-11-14)

Goal: make the app easy for a café or agency owner, their manager (the Signer) and team members claiming money back. These users are not finance or crypto people.

Method:
- Desk research, using primary sources where possible (NN/g, GOV.UK, Apple, Android/Material, W3C, and help docs from Mercury, Ramp, Wise and NEAR).
- A walkthrough of the live app at `http://localhost:8787` on desktop and at 375px (Owner, Signer and Member views; Overview, Approvals, Alerts, Get started, More).
- A read of `docs/ux/design-direction.md`.

This file only gives recommendations; it changes nothing. It sits alongside the design direction (v3) and doesn't override it.

---

## What we saw in the current app (grounding)

1. **The same message appears four times on Overview.** "Bigagency 900 USDC needs you" shows up in the Banto banner, the "Needs you" stat, the Approval queue card and the Alerts card. The Shortfall alert is a fifth version of the same fact. A non-technical owner reads this as five problems, not one.
2. **The first number comes with an equation.** "1,400 in treasury − 577.5 settled − 805 reserved = 17.5 spendable" is shown up front. "Settled" money being subtracted from the treasury is confusing: people expect paid money to have already left.
3. **The "Viewing as" role selector is on every page header**, along with "Live from NEAR testnet · updated …" and a Refresh button. On a 375px phone these take most of the first screen before any money appears.
4. **Demo and judge language shows on business screens.** Examples: "Plus 7 blocked in the security test run (judge checks)" and "Business events only. 1 security test run (judge checks) in Reports."
5. **Each payment shows up as four rows in Activity.** The rows are Recorded, Accepted, Authorized ("valid until 11:51 PM") and Settled ("Escrow released and a receipt recorded on-chain"). That is 12 rows for three small payments.
6. **Approval cards show every field at once:**
   - Waits on `signer.takara-ai-hq.testnet`
   - Waiting
   - Deadline
   - Blocks
   - "How is this approved?"
   - the reject-reason rule ("at least 10 characters…")
   - an Escalation preview

   The card also offers a plain **Approve** button even though the card says approving "would leave −882.5 USDC spendable".
7. **Raw account IDs and hashes appear in normal copy.** Examples: `treasury.takara-ai-hq.testnet`, `bigagency.testnet` and policy hash `68ea8f18…5281`.
8. **Navigation:**
   - On desktop, the sidebar has 11 destinations in 5 groups, plus Get started, which still shows "6/6 ✓" after setup is finished.
   - On mobile, the bottom bar is Overview, Approvals, Money, Ask and More. Alerts, which has a badge, is hidden in More.
9. **Small type and small targets on mobile.** The smallest text is 11px (preview tags and chart axes). There are 22 tappable targets under 40px tall at 375px. Muted text contrast has already been fixed (#67706B passes 4.5:1).

What already works and should stay:
- The reserve-strip "envelopes" metaphor.
- Role-based views. The Member view ("My pay, My claims, Alerts") is already nicely small.
- Plain sentences such as "Each envelope is an accepted bill. Its money can only pay that bill."
- "Show as a table" for the chart.
- The wallet opening only at the moment of signing.

---

## (a) Principles, with evidence

| # | Principle | Evidence (source) | For Takara this means… |
|---|---|---|---|
| 1 | **Progressive disclosure, two levels at most.** Show the few things most people need, and put the rest one clearly labelled step away. More than two levels makes people lose their way. | NN/g, Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/ | Each card shows a headline and one action. Everything else goes behind a single "Details" link, never nested twice. |
| 2 | **Skip tours; teach at the moment of need.** In NN/g's study, people who read deck-of-cards tutorials did no better than people who skipped them, and rated the app as *harder*. Onboarding is only justified when you need input from the user or the feature is genuinely new. | NN/g, Mobile-App Onboarding: https://www.nngroup.com/articles/mobile-app-onboarding/ · NN/g, Mobile Tutorials: https://www.nngroup.com/articles/mobile-tutorials/ | No product tour. Explain "reserved" or "Signer" in one line where it first matters, for example on the first approval card. |
| 3 | **If you must hint, use one hint, in context, that can be dismissed and found again.** Coach marks hide the very controls they describe, get dismissed without being read, and strain short-term memory. | NN/g, Onboarding Tutorials vs. Contextual Help: https://www.nngroup.com/articles/onboarding-tutorials/ | At most one hint per screen, shown once, with a "?" to bring it back. Never a chain of popups. |
| 4 | **Empty states should teach and point to the next step.** They should say what is happening, why, and what to do next. | NN/g, Designing Empty States in Complex Applications: https://www.nngroup.com/articles/empty-state-interface-design/ | "No bills yet. Forward a bill to Banto or upload one." Use this instead of a blank table or a setup tour. |
| 5 | **Write for a reading age of 9, even for experts.** GOV.UK requires plain English. NN/g found that highly educated specialists also prefer short, scannable, plain text. | GOV.UK, Writing for GOV.UK: https://www.gov.uk/guidance/content-design/writing-for-gov-uk · NN/g, Plain Language Is for Everyone, Even Experts: https://www.nngroup.com/articles/plain-language-experts/ | "Paid. Receipt saved." instead of "Settled on the ledger. Escrow released and a receipt recorded on-chain." |
| 6 | **When a term can't be avoided, pair it with plain words once.** | NN/g, Technical Jargon: https://www.nngroup.com/articles/technical-jargon/ | Say "USDC (digital dollars, 1 USDC ≈ $1)" once, on first use. Say "Signer (the person who approves big bills)". |
| 7 | **A dashboard is for a glance, not for exploring.** Length and position are read fastest. Strong emphasis only works on the one number that matters. | NN/g, Dashboards: Making Charts and Graphs Easier to Understand: https://www.nngroup.com/articles/dashboards-preattentive/ | Home leads with one number ("free to spend") and the envelope strip, which is a length encoding. Runway, the 60-day chart and the "caught" counts move lower or to Money. |
| 8 | **One thing per page; one primary action.** GOV.UK found that simple one-question-per-page designs work better than complex layouts, and that crowded pages make people miss things. | GOV.UK Service Manual, Structuring forms: https://www.gov.uk/service-manual/design/form-structure · GDS, One thing per page: https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/ | Each screen and card has one black button. Bill intake, claims and rejecting ask one question at a time. |
| 9 | **Bottom navigation: 3–5 equally important places that don't move.** | Android, Layout and navigation patterns: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns · Apple HIG, Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars | Keep 4–5 tabs, chosen per role (Owner, Signer, Member). Never put something with a badge behind "More". |
| 10 | **Hidden navigation is discovered about half as often.** NN/g's hidden-navigation study found discoverability was nearly halved and tasks felt harder. | NN/g, Hamburger Menus and Hidden Navigation Hurt UX Metrics: https://www.nngroup.com/articles/hamburger-menus/ | Everything urgent (approvals, alerts) must be visible without opening More. More holds only rare things: plans, public view, policy. |
| 11 | **An approval inbox is a short, due-date-sorted queue with amount, due date and status.** Rules are based on thresholds, and the person who submits a payment can't approve it. Approvers act from a mobile inbox. | Mercury, Navigating approvals: https://support.mercury.com/hc/en-us/articles/28776049990548-Navigating-approvals · Mercury, Separation of duties: https://support.mercury.com/hc/en-us/articles/45985054591508-Enforcing-separation-of-duties-for-per-payment-approvals · Ramp, Bill Pay approvals: https://support.ramp.com/hc/en-us/articles/4417843897747-Bill-Pay-approvals | An approval row is vendor, amount, due date, a one-line reason, and Approve/Reject. Who signs, how long it has waited and the escalation rule go into Details. |
| 12 | **Show the consequence and the total *before* the button.** Wise shows the full fee, what the recipient gets, and the arrival time before "Send". | Wise, Pricing: https://wise.com/us/pricing/business | Before Approve, show "After this you'd have −882.5 USDC free. Add 882.5 first or approve anyway." |
| 13 | **Use few confirmation dialogs, and make the ones you use specific.** If you warn too often, people stop reading. Offer undo where you can. | NN/g, Confirmation Dialogs Can Prevent User Errors (If Not Overused): https://www.nngroup.com/articles/confirmation-dialog/ | Confirm only signing and moving money, and name the vendor and amount in the button ("Approve 900 USDC to Bigagency"). No "Are you sure?" on filters, views or edits. |
| 14 | **Trust comes from polish, upfront disclosure and current content.** Typos, raw IDs and inconsistencies wear it down. The same visual can read as untrustworthy in a finance setting. | NN/g, Communicating Trustworthiness: https://www.nngroup.com/articles/communicating-trustworthiness/ · NN/g, Prominence-Interpretation Theory: https://www.nngroup.com/articles/prominence-interpretation-theory/ | Use names, not account IDs. Show one quiet "Live from NEAR testnet" line. Give each payment a real receipt link. Mark demo data once, at the top, and nowhere else. |
| 15 | **Hide the blockchain and keep it provable.** Chain abstraction and email or passkey sign-in (NEAR FastAuth, Coinbase Smart Wallet) remove seed phrases, extensions and wallet popups for newcomers. | NEAR, Chain abstraction: https://docs.near.org/concepts/abstraction/introduction · NEAR FastAuth: https://auth.near.org/ · The Block on Coinbase Smart Wallet: https://www.theblock.co/post/298641/coinbase-launches-smart-wallet-with-hopes-of-addressing-cryptos-pain-points | No "Connect wallet" until someone has to sign. Members never see a wallet at all. Hashes live only behind "View receipt on NEAR". After the hackathon, look at email or passkey sign-in for Signers. |
| 16 | **Design for older and less confident users: bigger text and targets, forgiving errors, stable navigation.** Seniors in NN/g's research:<br>- succeeded less often (55% vs 75%)<br>- blamed themselves for problems 90% of the time<br>- often kept written step lists, which redesigns break | NN/g, Usability for Senior Citizens: https://www.nngroup.com/articles/usability-seniors-improvements/ · W3C, WCAG 2.2 SC 2.5.8 Target Size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum | Use at least 13px for meaningful text, 44px tap targets for row actions, and error messages that say what to fix. Settle the navigation once before the demo, then stop moving it. |

---

## (b) Ranked changes for `web/index.html`

The ranking weighs what a regular user would feel against effort. Most items remove or hide something. Effort: S = under about 1 hour, M = a few hours.

| Rank | Change | Desktop / mobile | Impact | Effort | Risk note |
|---|---|---|---|---|---|
| 1 | **Say "needs you" once on Home.** Merge the Banto banner, the "Needs you" stat, the Approval-queue card, the Alerts card and the Shortfall alert into **one** "Needs you" card: "Bigagency · 900 USDC · due Dec 30 · [Review]". Drop the Approval-queue and Alerts cards from Overview, because their pages already exist. Move the 60-day chart and "Caught for you" below Coming up, or to Money. | Both | Very high: removes 4 duplicates and the "five problems" feeling. | M | Make sure the shortfall reason still appears inside that card, as one line. |
| 2 | **Lead with a sentence, not an equation.** Show "17.5 USDC free to spend · 805 set aside for 4 bills", then the strip. Move the "1,400 − 577.5 − 805" equation into the existing "How is this calculated?" disclosure. | Both | High: the first number is understood without arithmetic. | S | Transparency stays one tap away. Keep the wording identical on Get started step 5. |
| 3 | **Take "Viewing as", "Live from…" and Refresh out of every page header.** Put the role switch in one fixed place: a small chip in the top bar or the Demo scope sheet. Refresh automatically and show the source line once, quietly, at the foot of the page. | Both, especially mobile | High: on a phone, money appears in the first screen. | S | Judges need to switch roles quickly, so the chip must stay visible on desktop. Also remove the duplicate "Demo scope" button. |
| 4 | **Make approval cards compact.** Show vendor, amount, due date, a one-line reason and Approve/Reject. Fold "Waits on", "Waiting", "Blocks", "How is this approved?", "Who approves", "Signatures needed" and the Escalation preview into one "Details" link. Show the reject-reason rule only once someone clicks Reject, as inline validation. | Both | High: the Signer's main job becomes a quick scan. | S | No information is lost. Keep the deadline visible, because it drives the sort order. |
| 5 | **Make Approve honest when it would overdraw.** Above the buttons, show "Approving leaves −882.5 USDC. Add funds first, or approve and top up before Dec 30." Make the primary button "Add funds" and the secondary one "Approve anyway", or name the amount: "Approve 900 USDC to Bigagency". | Both | High: prevents the one real money mistake on the page and builds trust. | S–M | Check how the contract treats an overdrawn acceptance. Don't promise a top-up flow that doesn't exist; link to Money if needed. |
| 6 | **Swap jargon for plain words, everywhere at once.** <br>- "Settled on the ledger… escrow released…" → "Paid. Receipt saved."<br>- "Authorized payment… valid until…" → hide it (it's a detail)<br>- "Accepted automatically, within policy" → "Approved automatically (under your limit)"<br>- "Pending check" → "Banto is checking"<br>- "reserved" → "set aside" in UI copy (the envelope metaphor stays)<br>- "Recorded a bill… Not reserved yet" → "New bill from X"<br>- explain USDC once | Both | High: reading effort drops for every user. | S | Other agents and the product page use "reserved". Agree on one glossary, or keep "reserved" and only define it. Don't change identifiers in code or the contract. |
| 7 | **Use names, not account IDs.** "Waits on Maya (Signer)" instead of `signer.takara-ai-hq.testnet`; "Bigagency" instead of `bigagency.testnet`. Move hashes and account IDs into Details, next to "View on NEAR testnet". | Both | Medium–high: removes the "crypto tool" feel. | S | Proof for judges stays one click away. The design direction already bans raw identifiers in copy. |
| 8 | **Group Activity by bill.** Show one row per bill: "Payroll run · 15 USDC · Paid Nov 13 · Receipt". Clicking expands the four steps (received → approved → authorised → paid). | Both | Medium–high: 12 rows become 3, and the story is readable. | M | Keep the full step-by-step log in Reports for auditors. Make sure "Caught" and "Held" events still stand out as their own rows. |
| 9 | **Remove judge and demo language from business screens.** Drop "(judge checks)" and "security test run" from Overview and Activity, and keep them in Reports → Security tests and in Demo scope. | Both | Medium: the owner's view stops talking to someone else. | S | Judges must still find the security tests. Add one line to Demo scope that points there. |
| 10 | **Mobile bottom bar by role.** For Owner and Signer, use **Home · Approvals (badge) · Money · Ask · More**, rename Overview to Home, and fold Alerts into Home's "Needs you" card so no badge is hidden in More. Members keep My pay · My claims · Alerts. | Mobile | Medium–high: everything urgent is visible. | S | Don't change it again after the demo (principle 16). Make sure the More badge isn't the only place an alert shows. |
| 11 | **Trim the desktop sidebar to about 6 items.** Keep Home, Approvals, Money, People & vendors (merged), Rules (Policy) and Records. Move Public view and Plan & billing to an account menu at the foot. | Desktop | Medium: less to scan and choose from. | S–M | Features can still be found through Ctrl K / Ask. Check that deep links (`#/vendors`, `#/people`) still work. |
| 12 | **Hide "Get started" once it's done.** At 6/6, remove it from the nav, and offer it again only from Help or Demo scope. While setup is incomplete it should be a checklist, not a tour. | Both | Medium: removes a finished task from daily view. | S | The demo narrative may use it, so keep the route alive. |
| 13 | **Show "Connect wallet" only when needed.** Hide the top-bar button for Member, Auditor and Observer. For Owner and Signer, prompt the connection at the moment they click Approve. | Both | Medium: no crypto step until someone actually has to sign. | S | Signers who want to connect in advance need a path, so keep it in More or the account menu. |
| 14 | **Shorten page intros to 8 words or fewer, or cut them.** For example, "Everything waiting, who it waits on, how long, and what it blocks. Approve or reject in one click; your wallet opens only when you click." becomes "Bills waiting for a decision." | Both | Medium: less to read above the fold. | S | Keep the helpful facts by moving them to the place they matter, such as the wallet note next to Approve. |
| 15 | **Readability and tap-target pass on mobile.** Raise 11px text (preview tags, chart axes) to at least 12–13px and meta text to at least 13px. Make row actions, Copy, Refresh and the bottom-bar items at least 44px tall; there are 22 targets under 40px at 375px today. Test the layout at 200% text zoom. | Mobile, mostly | Medium: helps older and less confident users and helps on the move. | S | Taller rows mean more scrolling, which items 1, 4 and 8 offset. Keep within the design direction's limit of about 8 type sizes. |

---

## (c) Anti-patterns to avoid

1. **A product tour on first open.** Deck-of-cards tutorials and chained coach marks didn't help people and made the app seem harder (NN/g). If one hint is needed, show it once, in place, with a way back.
2. **Popup stacking.** Don't let a cookie banner, the demo strip, a hint, a "Meet Banto" modal and a wallet prompt appear together. Limit it to one interruption per session, and only for money or signing.
3. **"Are you sure?" on everything.** Confirmation dialogs lose their power when overused. Confirm only signing and moving money, and name the vendor and amount.
4. **Saying the same alert in several places.** One fact should live in one place on a screen. Badges, banners, stat tiles and alert cards for the same bill read as several problems.
5. **Numbers without a sentence.** Stat tiles, each with its own count ("6 caught", "1 needs you", "2 pending check", "3 bills not accepted"), make people do the reading work. Lead with a plain sentence and let the numbers back it up.
6. **Hiding urgent things in "More".** Anything with a badge or a deadline must be in the bottom bar or on Home.
7. **Showing the chain by default.** Account IDs, hashes, "escrow", "authorized… valid until", gas and wallet buttons for people who never sign. Keep proof one click away instead.
8. **Equal-weight buttons.** Approve, Reject and View bill side by side with similar weight. Each card gets one primary button, and the destructive or secondary actions are visibly quieter.
9. **Moving the navigation around after people learn it.** Less confident users keep written step lists (NN/g). Settle the bottom bar and sidebar once.
10. **Demo scaffolding leaking into the product.** Phrases like "judge checks", "security test run" and "fictional data" repeated on every page. Mark the demo once, at the top, as the design direction already says.
11. **AI chatter.** Banto should speak once, when something needs a person, and in one sentence. Don't put a Banto line on every card.
12. **Gating plain explanations behind hover.** Tooltips don't work on touch and are easy to miss. Use a short visible line or a tap-to-expand "Why?" instead.

---

## Sources

- NN/g: progressive disclosure (https://www.nngroup.com/articles/progressive-disclosure/)
- NN/g: mobile-app onboarding (https://www.nngroup.com/articles/mobile-app-onboarding/)
- NN/g: mobile tutorials (https://www.nngroup.com/articles/mobile-tutorials/)
- NN/g: onboarding tutorials (https://www.nngroup.com/articles/onboarding-tutorials/)
- NN/g: empty states (https://www.nngroup.com/articles/empty-state-interface-design/)
- NN/g: plain language for experts (https://www.nngroup.com/articles/plain-language-experts/)
- NN/g: technical jargon (https://www.nngroup.com/articles/technical-jargon/)
- NN/g: dashboards (https://www.nngroup.com/articles/dashboards-preattentive/)
- NN/g: hamburger menus (https://www.nngroup.com/articles/hamburger-menus/)
- NN/g: confirmation dialogs (https://www.nngroup.com/articles/confirmation-dialog/)
- NN/g: communicating trustworthiness (https://www.nngroup.com/articles/communicating-trustworthiness/)
- NN/g: prominence-interpretation theory (https://www.nngroup.com/articles/prominence-interpretation-theory/)
- NN/g: usability for senior citizens (https://www.nngroup.com/articles/usability-seniors-improvements/)
- GOV.UK: writing for GOV.UK (https://www.gov.uk/guidance/content-design/writing-for-gov-uk)
- GOV.UK: form structure (https://www.gov.uk/service-manual/design/form-structure)
- GDS design notes: one thing per page (https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/)
- Android: layout and navigation patterns (https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- Apple HIG: tab bars (https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- W3C: WCAG 2.2 SC 2.5.8 (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- Mercury: approvals (https://support.mercury.com/hc/en-us/articles/28776049990548-Navigating-approvals)
- Mercury: separation of duties (https://support.mercury.com/hc/en-us/articles/45985054591508-Enforcing-separation-of-duties-for-per-payment-approvals)
- Ramp: Bill Pay approvals (https://support.ramp.com/hc/en-us/articles/4417843897747-Bill-Pay-approvals)
- Wise: business pricing (https://wise.com/us/pricing/business)
- NEAR: chain abstraction (https://docs.near.org/concepts/abstraction/introduction)
- NEAR: FastAuth (https://auth.near.org/)
- The Block: Coinbase Smart Wallet (https://www.theblock.co/post/298641/coinbase-launches-smart-wallet-with-hopes-of-addressing-cryptos-pain-points)

Some NN/g pages could only be read in summary. The figures quoted (tutorial results, hidden-navigation discoverability, senior success rates) come from those articles as summarised and should be checked against the original pages before they go in a pitch.
