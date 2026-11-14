# Checklist from the newly vetted skills (2026-11-14)

Sources: three files vetted on 2026-11-14 (see `docs/skills-vetting.md`, "Additional skills (2026-11-14)"):
- impeccable reference files `onboard.md`, `clarify.md`, `distill.md` and `adapt.md` (tagged **[onboard]**, **[clarify]**, **[distill]**, **[adapt]** below)
- `onboarding-design` (**[od]**)
- `critique-information-density` (**[density]**)

Target: `web/index.html`, as a first-time, non-technical small-business owner sees it. Grounded in the live app at http://localhost:8787 on 2026-11-14, viewed at desktop width and at 375×812. This is a plan only; `web/index.html` was not edited.

## The app already does these (keep them)

- A 4-step tour that can be skipped and replayed, plus contextual hints shown once per page (`takara.hint.*`). This matches [onboard] "3–7 steps, skippable, replayable" and "hints at point of use".
- The first card is one sentence about what needs you, with one button. This matches [distill] "one obvious next action".
- Detail sits behind "How is this calculated?" and "Show as a table", which is progressive disclosure.
- On mobile: a bottom tab bar with 5 items, `viewport-fit=cover`, and `env(safe-area-inset-*)` on the top bar, tab bar, sheets and toasts. This matches [adapt].
- No horizontal scroll at 375 px.

## Top 10 (priority order)

1. **Say the shortfall in plain words, and don't offer "Approve" as if it were safe.** [clarify] [density]
   - The hero and Approvals both say "Accepting it leaves −882.5 USDC spendable." A negative number inside a sentence makes the reader do arithmetic.
   - Rewrite as: one fact, one consequence, one action. For example: "Bigagency's 900 USDC bill needs a Signer. You don't have enough yet: you'd be 882.50 USDC short. Add money first."
   - In Approvals, make "Add money" the primary button on that card while the bill can't be covered. Keep "Approve" available but secondary, or show the shortfall again right before it is confirmed (error prevention).

2. **Move "Viewing as" out of the main column.** [distill] [density] [od]
   - The role picker (Owner / Signer / Member · Ana / Auditor / Public observer) is the first control under every page title, on desktop and mobile. A real owner never needs it; it is a demo tool.
   - Move it into a single "Demo: switch role" entry in the account menu or the demo banner, and drop tour step 4 ("Viewing as").
   - This also fixes the 13 px select, which zooms the page on iOS when tapped (see item 7).

3. **Label sample data as sample data, and say how to start fresh.** [od]
   - The top banner says "Demo on NEAR testnet · fiction…" and the business is "Fixture Co".
   - onboarding-design: make it clear the data is a sample, and make it easy to clear and start over.
   - Use one plain line: "You're looking at a sample business. Nothing here is real money." Add a visible "Start with my own business" or "Reset demo" link. Show this once; it should not be a permanent second banner.

4. **Use one name for blocked bills.** [clarify]
   - A newcomer sees three different words and three different counts for what looks like the same thing:
     - Overview: "Caught for you 6 · Bad invoices refused"
     - Get started: "13 bills, 3 refused"
     - Money: "Flagged 5"
   - Pick one term (for example "Blocked") and use it for the tile, the filter and the setup step. If the counts measure different things, say what each counts in the label (for example "Blocked this month").
   - Keep a short glossary so Refused / Flagged / Caught / Ignored aren't used interchangeably.

5. **Introduce Banto before Banto appears in a status.** [onboard] [od]
   - "Banto is checking 2" appears in Approvals and Money. The one-line explanation of Banto is only at the bottom of Get started, and on tour step 3.
   - Add a single sentence to the first-run card or tour step 1: "Banto is your assistant. It reads bills and sets money aside, but it can't pay anyone without your rules."
   - Use the same phrase whenever "Banto is checking" first shows on a screen, for example as a hint on the status pill.

6. **Cut the Money page to one starting point.** [distill] [density]
   - Before the first bill, mobile shows 5 type tabs, 6 status chips, "Add money" and "Export CSV": 13 choices.
   - Open on the "Needs you" status, or put it first and select it when it is non-empty. Collapse the type tabs into one "Filter" control. Move "Export CSV" into a "More" menu.
   - Railway appears three times (Reserved / Payout changed / Instructions ignored) with no explanation. Group them into one row with a "3 versions" disclosure so the list doesn't look like duplicate bills.

7. **Make mobile tap targets 44 px and inputs 16 px.** [adapt]
   - Measured at 375 px:
     - Refresh, "?" (tour) and the per-row "View transaction on NEAR testnet" icons are 32×32.
     - "Open approvals" and the role select are 32 px tall.
     - "All activity" and "All money" are 20 px tall.
     - The demo banner's close button is 32 px.
   - Under `@media (pointer: coarse)`, give them a 44 px minimum hit area; padding or `::before` is enough without a visual change.
   - The role select uses `font-size: 13px`, so iOS zooms the page when it is tapped. Use 16 px on touch.

8. **Hide chain jargon behind "Technical details".** [clarify] [distill]
   - A newcomer sees these with no explanation:
     - Policy page: "Policy hash 68ea8f18…5281", "SEALED · TEE", "signer.takara-ai-hq.testnet", "Refused on testnet".
     - Get started: "treasury.takara-ai-hq.testnet", "Hash".
     - The header on every page: "Live from NEAR testnet".
   - Keep the proof, since it is a selling point for judges, but put it in one collapsed `<details>Technical details</details>` per page.
   - Turn the header line into "Up to date · 4 min ago" with the network name in its tooltip or popover.
   - Explain USDC once on first use, for example "USDC (a digital dollar)". After that, stop repeating the unit on every amount within a card (it appears 15 times on Overview).

9. **Make the tour teach actions, not regions, and don't rely on colour.** [onboard] [clarify]
   - Step 2 says "The mint part is what you can spend." That points at a colour, which fails for colour-blind users and in plain-language terms.
   - Rewrite as: "The last block is what you can spend. The others are already set aside for bills."
   - Step 1 should point at the real next action ("Tap Open approvals to review the bill that needs you") instead of "This line tells you…".
   - Version the seen-state keys (`takara.tour.main:v2`) so a reworded tour shows again once. onboard.md recommends account- and version-namespaced keys.

10. **Show amounts consistently and trim repeated detail in lists.** [density] [clarify]
    - Use two decimals for money everywhere ("17.50 USDC", not "17.5"; "882.50", not "882.5"), with tabular numerals so columns line up.
    - In Recent activity, every row repeats "3 earlier steps" and "Receipt saved". Show that once as a single line at the end of the row, and keep the per-row detail behind the disclosure.

## Also worth doing (lower priority)

- **Empty states**: check each of the five types ([onboard]) on Approvals, Alerts, People and Vendors. Approvals' "Banto is checking · Nothing to do." is fine as a no-action state. For a real first-use account, each list needs "what will appear here, why it matters, one first action".
- **Desktop sidebar**: 11 items. Group "Public view", "Plan & billing" and "Policy" under a "Settings & sharing" section, or move them down, so the first five match the mobile tab bar (Overview, Approvals, Money, Ask, More) [distill]. Keep the same information architecture on both, as [adapt] advises.
- **Alerts**: the "Telegram and email delivery · Preview" tag is a feature-status notice placed in the main list. Move it to the "How alerts work" disclosure.
- **Get started for a real new owner**: today it is a 6/6 list of finished steps with hashes. For a fresh account, [od] says to orient rather than educate. Show at most 3 steps (connect, set the auto-pay limit, add the first bill) with a progress count, and make the optional ones skippable.
- **Returning users**: [od] says users coming back after a gap need re-orientation. A one-line "Since you were last here: 2 bills paid, 1 needs you" on Overview covers this without a tour.

## How to check it worked

- At 375×812, with the demo reset (clear the `takara.*` keys), a first-time viewer can answer "how much can I spend and what needs me?" from the first screen alone, without scrolling and without seeing a hash, "testnet" or a role picker.
- No interactive element under 44 px on touch, and no input under 16 px. Count them with a short `getBoundingClientRect` script in the browser.
- One word for blocked bills across Overview, Money and Get started.
