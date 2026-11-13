# Skills applied: product page rebuild (`site/index.html`)

2026-11-13. Each skill was loaded with the Skill tool (theme-factory read from `.claude/skills/theme-factory/SKILL.md`) before the page was written. The source of truth for visuals stayed `docs/ux/design-direction.md`. Where a skill and that file disagreed, the file won, and the conflict is noted below.

## unslop

Direction written first. Product: a NEAR treasury whose agent reserves money for accepted bills and pays inside a signed policy. Character: calm, exact, protective. World: a merchant's ledger and cash envelopes. Moment: the hero reserve strip. Signature: the dashed protected line.

- **Pill badge above the headline:** "● Live on NEAR testnet" rounded chip → removed. The headline is now the first thing under the nav.
- **Hero CTAs:** two buttons plus a "Judge checks" text link (three actions) → two only, "Open the app" (ink) and "See the proof" (quiet).
- **Status pills everywhere:** coloured pills for state, flags, PASS badges and agent status → an 8px dot and a text label (`.st`, `.dot`). Flags became plain words, and the only tag left is the mono `SEALED · TEE` signature.
- **Gradients and shimmer:** `.tile.hi` linear-gradient, the shimmering `.skel` loader and the striped `repeating-linear-gradient` shortfall → solid fills. The shortfall hatch is now an SVG pattern, and loading states are static text ("Reading NEAR testnet").
- **Equal card grids:** four identical tiles, ten identical judge-check cards and two equal verify cards → one 2×2 hairline ledger (no card borders) with a different kind of visual in each cell, a 10-row list, and a 4/8 text-and-commands split.
- **Template check:** a generic "Live treasury / Public ledger / Owner view / How it works" set of sections → Banto, the envelopes and the protected line run through the hero, the guarantees, the diagram and the proof, so the page could not belong to another product.

## frontend-design

- **Design plan before code:** palette (paper `#FAFAF7`, ink `#0E1A16`, treasury green `#0B5D4B`, mint `#D6ECE3`, vermilion `#B4432F` used only for refusals), type roles and a 12-column layout sketch, then checked against the brief.
- **Hero subject:** a receipt card with static bars → the most characteristic thing in this product's world, an envelope strip that refuses a payment at a protected line.
- **Numbered markers only for real sequences:** used on the four "How Banto works" steps and the five setup steps, which are sequences. Not used on the guarantees, which are not.
- **One orchestrated motion moment:** the hero story is the only page-load sequence. There are no section fade-ins and no hover lift on cards.
- **Copy from the user's side:** section titles changed from system names ("Public ledger", "Owner view") to what the reader cares about ("Same books, two views", "Caught for you", "Free until your first payout").
- **Conflict noted:** the skill flags `·`-joined meta strings and mono data labels as tells, but the design file asks for mono numbers and the `SEALED · TEE` tag. Kept as the file says. Middle dots are limited to the source line, the run line and the tag.

## emil-design-eng

- **Easing:** `cubic-bezier(.2,.7,.2,1)` plus a stray `ease` → the single curve `cubic-bezier(.23,1,.32,1)` on every transition and keyframe. That curve is the strong ease-out the skill recommends.
- **Press feedback:** `.btn:active { translateY(1px) }` → `transform: scale(.98)` at 100ms, as the design file specifies.
- **Named transition properties:** colour, border and transform each named in the transition, never `all`.
- **Entrances:** the envelopes slot in from `translateY(-24px)` with opacity, never from `scale(0)`. The stamp lands from `scale(1.15)` down to 1.
- **Number tween:** the "Caught for you" figure counts up once (700ms, cubic ease-out) when it scrolls into view, and appears static under reduced motion.

## redesign-existing-projects

- **Font swap:** IBM Plex Sans and Mono → Newsreader 400 for headlines only, Geist 400/500 for UI and Geist Mono for amounts and hashes, all from Google Fonts with system fallbacks.
- **Container and grid:** 1,160px with ad hoc grids → a 1,200px wrap and a 12-column grid (`.g12`): hero 5/7, how-it-works 4/8, proof 7/5, pricing 5/7, verify 4/8.
- **Section rhythm:** 64px section tops → 120px (80px on phones).
- **Missing states:** the error state is now an inline red sentence ("Couldn't reach the NEAR testnet RPC…"). Loading is static text, and fallbacks are labelled ("owner figures from the snapshot of 2026-11-12").
- **Raster diagram:** `<img src="architecture.svg">` with 11px text and a lavender box → two inline SVGs drawn in the palette: a three-column one for desktop (about 14px labels at 1,200px) and a stacked one for phones (about 15px at 375px).

## ux-copy

- **Hero lede:** "An AI agent pays bills only inside a policy the owner signs, and the owner can revoke it at any time without the agent's cooperation" → "Its agent, Banto, sets money aside for every bill you accept and pays only inside the policy you sign. It can never take the money, and you can switch it off at any time."
- **Raw identifiers out of copy:** "Refused `would_break_commitments`" → "Refused. Paying it would break money reserved for payroll and Railway." `new:6a77f4b28dfd` becomes "New vendor". Raw codes appear only inside the expanded assertion detail, where they are proof.
- **Judge check titles:** script titles like "Field-level spoofing: memo asks to become payroll/critical" → plain row titles like "An invoice can't promote itself to payroll". The script title stays in the expanded row.
- **CTA labels:** "Open the live app" / "View on GitHub" → "Open the app" / "See the proof". The nav's "Open the app →" loses its arrow.
- **Lapse rules:** taken from the structure doc and rewritten in plain words, headed "A lapse never locks your money." Banned words ("insurance", "escrow", "mock", "fake", "coming soon", "demo" outside the banner) were checked with grep, and none remain in the content.

## fixing-metadata

- **Title:** "Takara AI, a non-custodial treasury on NEAR" → "Takara AI · a treasury agent that can't take your money". `og:title` and `twitter:title` now match it.
- **Canonical and URL agreement:** added `<link rel="canonical">` and `og:url`, both `https://takara-ai.vercel.app/`, plus `og:type`, `og:site_name`, `og:locale` and `robots`.
- **Twitter card:** added `twitter:card` (`summary`) with title and description. There is no `og:image`, because no 1,200×630 image exists in the repo and the skill forbids inventing assets. This is listed as an open item.
- **theme-color and favicon:** `#FAFAF8` and favicon green `#0B5D52` → the tokens `#FAFAF7` and `#0B5D4B`.
- **JSON-LD:** one `SoftwareApplication` block with name, category, URL, description and license only. There are no offers or ratings, because pricing is planned, not live.

## fixing-accessibility

- **Contrast:** the muted token `#7C8580` measures about 3.7:1 on paper, which fails AA for small text → `--muted: #6B746F`, about 4.6:1. This is the one documented deviation from the design file's colours.
- **Expandable controls:** judge checks use native `<details>`/`<summary>`. The explorer link sits outside the summary so the summary holds no interactive element, and it has an `aria-label` ("Check 5 on NearBlocks").
- **Mobile menu:** links that were simply hidden below 760px → a `Menu` button with `aria-expanded` and `aria-controls`. Escape closes it and returns focus to the button, and choosing a link closes it.
- **Graphics:** the hero strip is one `role="img"` with a full sentence label and `aria-hidden` children. Both SVGs have `<title>`/`<desc>`, and each mini strip has a screen-reader sentence.
- **Live regions and landmarks:** the treasury panel is `aria-live="polite"` with `aria-busy` toggled. The skip link is kept, there is one `h1`, sections are labelled by their `h2`, and the roles table has a caption and row headers that stack on phones.

## animate

- **Gate:** seen once per visit, with the purpose of explanation (how the protected line works), so the delight budget allows a longer sequence than UI motion.
- **Tool:** CSS keyframes, which stay off the main thread while the RPC and JSON load, armed with `animation-play-state: paused` and started by an IntersectionObserver at 45% visibility. On phones the strip sits below the fold, so it plays when it is actually seen rather than off-screen.
- **Properties:** only `transform` and `opacity`. The envelopes use `translateY`, the protected line `scaleY` from the top, the request `translateX(60%)` and the stamp `scale`.
- **Timeline (about 2.4s):** Payroll slots in at 150ms, Railway at 500ms, the spendable figure at 900ms, the line draws at 1,000ms, the request slides from 1,250 to 1,900ms, the line flashes vermilion and the "120 short" hatch appears at 1,900ms, and the stamp lands at 2,150 to 2,390ms.
- **Reduced motion:** without `.play` the markup renders its final state, so it is static and complete. The Replay button is hidden, and the only loop on the page (the live RPC dot) is disabled.
- **Feel-check done:** frames were stepped with `getAnimations()` at 0.7s, 1.6s and 2.05s (screenshots in the scratchpad `rework-site` folder).

## theme-factory (read, not applied)

- Read `SKILL.md` and `themes/forest-canopy.md`, the closest preset (forest green `#2d4a2b`, sage, ivory, FreeSerif and FreeSans).
- **Not applied:** the design file pins the palette and type exactly, and the skill's own flow (show the showcase, wait for a choice) does not fit an autonomous rebuild with a fixed brief.
- **One idea taken:** treat the palette as one named theme in a single `:root` token block that is shared with the app, instead of per-section colours.


---

# Fix round 3 (2026-11-13): blind review 6.5/10

## kpi-dashboard-design (items 1 and 9)
- **Proof card.** It now shows the reconciled equation:
  - `1,400 in treasury − 520 paid, settling − 805 reserved = 75 spendable USDC`
  - One line under it explains "paid, settling".
  - The guarantee mini-strip uses the same equation.
- **Caught for you.** The real final count is in the HTML:
  - 5 business catches: 1 payout change frozen, 2 hidden instructions ignored, 1 duplicate, 1 reserve breach.
  - Then "7 attempts blocked in the security test run (judge checks)".
  - The count-up from 0 is gone. The script only refreshes the figure with the same split.
  - The judge run and the decision log both give 5 + 7.

## dataviz (item 9)
- **Hero envelopes.** The diagonal "fold" (`.env::before`) is removed.
- **Mini-strip segments.** Each has a `title` tooltip, and the legend names every envelope.

## ux-copy (items 5 and 10)
- **One state vocabulary.** It is now Received → Reserved → Paid → Closed.
  - The on-chain names (claimed, accepted, settled, closed) are secondary mono text only.
  - They appear in the states row and in the "Same books, two views" status cells.
  - Settled reads "Paid, settling".
- **"Signer" replaces "Policy signer".** It applies in the architecture diagram, the roles table, the proof facts and the check titles. The roles table notes that the plan calls this role Manager.
- **Pricing labels.**
  - "Most will take this" is now "Best value".
  - The plan lines now say how each plan is billed: "billed yearly. Two months free", "billed quarterly", and "Month to month, cancel any time".

## break-ui (item 10)
- **The "1Click payout, mainnet" box.** Its text overflowed the box in the Under the hood SVG. It is now two short lines that fit: "Separate integration," and "not enforced on testnet".
- **Checks.** The page was checked at 1280 and at 375, with no horizontal scroll and no console errors.

## unslop
- **Banto's mark.** The "B" letter avatar is replaced by the app's SVG monogram: two stacked envelopes drawn on the Takara mark's grid.
