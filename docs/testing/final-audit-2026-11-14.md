# Final pre-demo audit (2026-11-14)

Independent QA and UX pass on `web/index.html` (live at localhost:8787), `site/index.html` and `site/how-it-works.html` (served at :8790). Started from a fresh state (`takaraHintReset()`, `takara.*` cleared). Tested at 1280×800 and 375×812. Nothing was signed, and no key or password was entered.

## Pass/fail by area

| Area | Result | Notes |
|---|---|---|
| Desktop 1280 | Pass (after fixes) | No console errors from the app. No horizontal scroll on any of the 14 views or drawers. |
| Mobile 375 | Pass (after fixes) | Tab bar is Home · Approvals · Money · Ask · More. "Viewing as" sits in the More sheet (16px, 44px tall). No touch target under 44px. |
| Tour | Pass | Desktop: 4 steps, each arrow centred on its target. Phone: 3 steps (the lens step is dropped); the card docks at the bottom and a spotlight marks the target. |
| Hints | Pass | Each shows once, at most one per view, and none stack. They don't come back after reload or with storage blocked. |
| Figures | Pass | 1,400.00 − 577.50 − 805.00 = 17.50; reserved 4 bills = 805; settled 6 = 577.50; runway 32; shortfall 882.50; Alerts 1,140 → short 1,122.50. All match the chain. |
| Honesty | Pass | Demo strip ×1, Demo scope sheet ×1, Preview tags present, "Testnet: no tokens move." ×1 in app chrome, equation behind "How is this calculated?". "Add funds" opens a Preview explanation; no fake success states. |
| A11y | Pass | Keyboard order is logical, focus is visible on every stop (rows use a `:focus-within` ring), contrast is 5.11:1 or better, the reduced-motion kill-switch is in place, and a storage-blocked first load renders with no errors. |
| Wallet list | Pass | Meteor, MyNearWallet, Intear, NEAR CLI only. |
| Product page | Pass (after fixes) | The flow reads simply. Steps 1–5 link to `how-it-works.html#step-n`. No horizontal scroll at 375. |
| Detail page | Pass (after fixes) | Example numbers are labelled "Example from the demo treasury". Anchors land below the sticky header. |

## Bugs found

| # | Sev | Bug | Fixed? Where |
|---|---|---|---|
| 1 | High | Phone: the 60-day chart's axis text rendered at about 5px | Yes. `web/index.html` `bindProj` + `.proj` CSS: font size no longer shrinks with the chart (at least 11px); when the chart is narrow only the start and end dates and the y-scale show. The sentence and "Show as a table" are kept. |
| 2 | High | Phone/tablet: the demo strip scrolled away while the top bar stayed pinned 32px down, leaving a see-through gap. The same gap appeared above the desktop sidebar. | Yes. CSS `[data-slot="strip"] { display: contents }` |
| 3 | Med | Phone: the Money "Add a bill" menu overflowed by 43px, causing horizontal scroll | Yes. CSS: on phones it opens from the toolbar row's edge |
| 4 | Med | "Caught" was used for 3 different counts (Home 6, Money 5, Get started 3) | Yes. Money filter → "Flagged" (per the declutter plan); Get started → "3 refused at intake" |
| 5 | Med | Bill drawer said "Accepting leaves −882.50 USDC spendable." | Yes. `billDrawer`: "Accepting now would leave you 882.50 USDC short." |
| 6 | Med | Vendor drawer and Public view said "in cooling-off" after it had ended | Yes. `vendorDrawer` and the public-view vendor_changes: "approved, cooling-off ended" |
| 7 | Low | Bill hint repeated the testnet line (a second honesty marker) | Yes. `tourOnDrawer` hint text |
| 8 | Low | Equation used "reserved / spendable" next to "Set aside / Free to spend" | Yes. `eqHTML` |
| 9 | Low | Ask Banto answers said "escrow released" and used "412.5 USDC" | Yes. `fmtAnswer` rewrites the display only (the backend is untouched) |
| 10 | Low | Phone: demo strip cut off as "fictional da…" | Yes. Short phone copy: "Testnet demo · fictional data" |
| 11 | Low | Site: "escrow" in body copy; "577.5 / 17.5"; "spendable / reserved" | Yes. `site/index.html` (live equations now `n2`, "set aside", "free to spend") |
| 12 | Low | Detail page: states said "Paid" (the app says "Settled"); wallet list omitted NEAR CLI | Yes. `site/how-it-works.html` |

## Still open (not fixed, low risk)

- Hero strip on the product page still says "Spendable 280". "Free to spend" doesn't fit the segment.
- Site "Caught for you" shows 5 when served statically (it counts the judge run); the app shows 6. The hosted /api/decisions should match the app. Check on Vercel.
- Reports: the "Caught 7" chip sits above "Caught for you 6". The breakdown explains the gap, but it's busy.
- The wallet chooser's unlabelled gear button opens a library "custom wallet" settings screen. It's third-party UI and the `debug-wallets` persistence is already blocked. Don't click it on camera.
- Phone hint cards can cover the lower edge of their target (for example "View bill" on Approvals) until "Got it".
- Ask Banto answers repeat "On testnet no tokens move". This is honest, but it's a second instance.

`node --check` passes on both inline scripts of `web/index.html`.

## Verdict: ready to record, after these must-dos

1. Run `node scripts/build-platform.mjs` and deploy. `platform/how-it-works.html` doesn't exist yet, so the product page's step links will 404 on Vercel without this.
2. Follow the updated `docs/demo-script.md` preflight item 6: do a dry run so every hint is marked seen, then `localStorage.removeItem("takara.tour.v2.main")` and reload to show only the welcome card and tour.
3. Reject Bigagency as Signer. Never use "Approve anyway".
