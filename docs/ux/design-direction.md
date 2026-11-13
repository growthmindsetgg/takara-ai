# Takara design direction (v3, 2026-11-13)

Shared by the app (`web/index.html`) and the product page (`site/index.html`). Both pages use the same tokens below. Source: the independent design review of 2026-11-13 (app scored 5/10, landing 4/10, "correct but forgettable"). This file sets the visual direction; `docs/product-structure-app-plan.md` sets the product structure.

## Character
Calm, exact, protective. The idea behind it is a ledger book plus the cash envelopes a careful owner sets aside: payroll goes in a sealed envelope and the rest stays in the drawer. No Web3 template look.

## Tokens
- Type:
  - **Newsreader** 400 for product-page headlines only (64/56px, −1% tracking).
  - **Geist** 400/500 for all UI (body 14/16px, app page titles 28px/500).
  - **Geist Mono** for amounts, hashes and accounts, with `font-variant-numeric: tabular-nums`.
  - Load all three from Google Fonts with system fallbacks.
  - Use at most about 8 type sizes in total.
- Colour:

  | Role | Value |
  |---|---|
  | Paper (page background) | `#FAFAF7` |
  | Surface | `#FFFFFF` |
  | Ink | `#0E1A16` |
  | Text 2 | `#4A5550` |
  | Muted | `#7C8580` |
  | Hairline | `rgba(14,26,22,.08)` |
  | Treasury green (reserved, selected, brand) | `#0B5D4B` |
  | Spendable | mint `#D6ECE3` fill with a green stroke |
  | Paid | `#DCDFDB` |
  | Waiting (text only) | amber `#9A6210` |
  | Frozen or refused (only for those states) | vermilion `#B4432F` |
  | Primary buttons | ink black, white text |

- Dark mode is optional. If you add it, derive it from the same roles.
- Spacing and shape:
  - 8px grid.
  - Radii: 8 for controls, 12 for cards, 16 for sheets.
  - Hairline borders rather than shadows. One soft shadow, for sheets only.
- Motion:
  - One easing curve, `cubic-bezier(.23,1,.32,1)`.
  - 140ms hover, 100ms press at `scale(.98)`, 240ms drawers.
  - Numbers tween on refresh.
  - The only loop is the live RPC dot.
  - Honour `prefers-reduced-motion`.

## Signature component: the reserve strip
- Draw each reserved bill as its own labelled "envelope" block, for example "Payroll 600" and "Railway 120".
- Then a perforated, dashed **protected line**, then the open spendable segment (mint).
- Paid amounts are not part of the strip; show them as a footnote.
- Use the same component in four places:
  - the product-page hero, which plays a ~2.4s story once on load;
  - Overview, at 40px tall;
  - the bill drawer, showing where this bill sits;
  - the policy preview, showing before and after.

## Small signature detail
A mono `SEALED · TEE` tag wherever data is private. Use it nowhere else.

## Banned (unslop tells)
- A pill badge above the headline.
- Three or more hero CTAs.
- Coloured left-border stripes.
- Status pills everywhere. Use an 8px dot plus a text label instead.
- Stacked chips.
- Every section built from the same "title + grey paragraph + bordered card" pattern.
- Equal card grids used as the default layout.
- Lavender or blue accents.
- A different accent colour on each stat.
- Gradients, glows, emoji and sparkles.
- Uppercase tracked micro-labels used everywhere.
- Ellipses in placeholders.
- Underlined links in every row. Make the whole row clickable instead.
- Raw identifiers in copy (`would_break_commitments`, `new:6a77f4b28dfd`).

## Number format
`1,400 USDC`: tabular figures, a thin space before the unit, the same everywhere. Never "1400USDC".

## Honesty
- Live data is unlabelled except for one source line per page: "Live from NEAR testnet · updated 2 min ago".
- Fiction is marked once: a 32px ink strip at the very top reading "Demo treasury on NEAR testnet · fictional data", which can be dismissed for the session.
- Preview elements use one component: a dashed hairline border, a mono `Preview · after the hackathon` tag, and muted sample data.
- Never mix previews into live tables.
- Never show a fake success state.
