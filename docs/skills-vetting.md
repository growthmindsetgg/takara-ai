# Claude Code skills: research and security vetting

Date: 2026-11-13. Scope: skills that would improve the Takara AI owner app (near-white, premium fintech treasury UI, plain HTML/CSS/JS in `web/` and `site/`, no React, no Tailwind) and the green/white/black pitch deck (currently an HTML artifact; a .pptx export is possible later).

Nothing was installed into any `.claude/skills` folder. No downloaded script was executed, and nothing was installed from any downloaded repo with npm or pip. Every repo was cloned with `git clone --depth 1 --no-recurse-submodules -c core.hooksPath=/dev/null -c core.symlinks=false` into a quarantine folder. All inspection was static: reading files, grep pattern scans, a hidden-Unicode scan with a UTF-8 locale, magic-byte checks on binaries, and a check of the bundled PDF for active content. One small offline Python helper, kept outside the quarantine and run with `python -I`, decompressed the PDF streams.

Quarantine root: `C:\Users\Admin\AppData\Local\Temp\claude\a30c1ce7346a809f\fff47e11-6cfd-4037-8282-3e2fdab4e5a3\scratchpad\skills-quarantine\`
- `repos\` holds the raw clones.
- `vetted\<name>\` holds clean copies of the SAFE skills, ready to copy.
- `vetted-sha256.txt` lists SHA-256 hashes of every file in `vetted\`, so you can confirm the copy you install is the one that was reviewed.

## Recommended skills (SAFE only)

| # | Skill | Why it helps Takara | Source (URL @ commit) | Vetted copy | Suggested install path |
|---|---|---|---|---|---|
| 1 | **unslop** | Fits the owner app better than any other candidate. It takes a dashboard through nine ordered passes: spacing on a 4px grid, one neutral ramp with one accent, line icons, copy, type, layout, details, visuals and motion. Its rules match a treasury app: `tabular-nums` and one number format, stat cards that show plain numbers, one main chart with one accent, "+x% vs last month" comparisons, and no glows, gradients or emoji. It ships light graphite ramps that suit a near-white UI. It is more specific about dashboards than the redesign-existing-projects and improve-ui skills you already have. | https://github.com/heydamir/unslop @ `97daa3eb365670ea3f87ed85356cbfcee18105a5` (path `skills/unslop`) | `...\skills-quarantine\vetted\unslop` | `C:\Near Product - Takara\.claude\skills\unslop\` |
| 2 | **theme-factory** (official) | Locks one palette and font pairing across the deck and any other artifacts. The 10 preset themes do not match Takara, but the "Create your own theme" flow fits a green/white/black theme. After install, add a `themes/takara.md` with the brand hexes so the app, deck and social images stay consistent. | https://github.com/anthropics/skills @ `2c5958ecac7cee2b583967a2c4981d0f4a75c579` (path `skills/theme-factory`) | `...\skills-quarantine\vetted\theme-factory` | `C:\Near Product - Takara\.claude\skills\theme-factory\` |
| 3 | **design-system-patterns** | Sets up primitive, semantic and component token layers as CSS custom properties, with theming through `prefers-color-scheme` and high-contrast and reduced-motion modes. Plain CSS variables are what `web/` needs to turn the near-white palette into tokens without adding a framework. | https://github.com/wshobson/agents @ `9c61ab243def98f72da12abd41cfcf5bcd91af9d` (path `plugins/ui-design/skills/design-system-patterns`) | `...\skills-quarantine\vetted\design-system-patterns` | `C:\Near Product - Takara\.claude\skills\design-system-patterns\` |
| 4 | **kpi-dashboard-design** | Covers choosing and ranking KPIs: 5–7 headline metrics, context through comparisons and targets, drilldown from summary to detail, and keeping calculation methods documented. Use it to decide which treasury figures (balance, runway, pending payouts, agent actions) lead the owner dashboard. It pairs with the `dataviz` skill you already have, which covers how charts are drawn. | same repo @ `9c61ab243def98f72da12abd41cfcf5bcd91af9d` (path `plugins/business-analytics/skills/kpi-dashboard-design`) | `...\skills-quarantine\vetted\kpi-dashboard-design` | `C:\Near Product - Takara\.claude\skills\kpi-dashboard-design\` |
| 5 | **pptx-deck-context** | Before any slide is designed, it makes you pick a narrative framework (SCQA, pyramid, action titles and others) and give a `source_ref` to every metric and claim. That matters when judges check testnet numbers. It applies to the HTML deck as well. | same repo @ `9c61ab243def98f72da12abd41cfcf5bcd91af9d` (path `plugins/pptx-deck-creation/skills/pptx-deck-context`) | `...\skills-quarantine\vetted\pptx-deck-context` | `C:\Near Product - Takara\.claude\skills\pptx-deck-context\` |
| 6 | **pptx-quality-gates** | A release checklist for the deck: no content collisions or text overflow, no text under 9 pt, safe margins, alt text, reading order, and every number traceable to a source. The checks apply to an HTML deck too. Step 4 points to a sibling script, `pptx-reference-deck-analysis/scripts/validate_package.py`, which is not recommended (see the full table). Without it, that step is simply skipped. | same repo @ `9c61ab243def98f72da12abd41cfcf5bcd91af9d` (path `plugins/pptx-deck-creation/skills/pptx-quality-gates`) | `...\skills-quarantine\vetted\pptx-quality-gates` | `C:\Near Product - Takara\.claude\skills\pptx-quality-gates\` |
| 7 | **pptx-slide-specification** | Optional; only useful if you export the deck as .pptx with the built-in `anthropic-skills:pptx` skill. Every object gets explicit inch coordinates and the deck is built from that JSON layout, so slides stay editable and do not overflow. | same repo @ `9c61ab243def98f72da12abd41cfcf5bcd91af9d` (path `plugins/pptx-deck-creation/skills/pptx-slide-specification`) | `...\skills-quarantine\vetted\pptx-slide-specification` | `C:\Near Product - Takara\.claude\skills\pptx-slide-specification\` |

(`...` stands for the quarantine root above.)

### What each vetted copy contains

- **unslop** (1.5 MB, license CC-BY-4.0, 15.4k stars, last commit 2026-11-09)
  - Files: `SKILL.md` 31.9 KB; `references/` with signs.md, tokens.md, visuals.md, effects.md and refs.md (2.5–8.4 KB each); 5 reference images (`refs/*.webp`, 75–569 KB, RIFF/WEBP headers confirmed); `scripts/snapshot.mjs` 8.5 KB; `scripts/story.mjs` 25.9 KB; `agents/openai.yaml` 200 B; `LICENSE`.
  - Scripts: both were read. They run only when called by hand: `snapshot.mjs` saves a copy of a page from a URL you give it, and `story.mjs` renders a before/after video. Neither is needed for normal use. They load Playwright only if it is already installed and print an install hint otherwise; they install nothing. `story.mjs` serves files on 127.0.0.1 only, guards against path traversal, and calls `ffmpeg` with a fixed argument list (no shell). `process.env` is read only for `CHROME_PATH`. No credential access and no outbound calls other than the page you choose.
  - License: CC BY 4.0 requires keeping the author credit, which is already in the files.
- **theme-factory** (154 KB, Apache-2.0)
  - Files: `SKILL.md` 3.2 KB, 10 theme files (about 0.5 KB each), `theme-showcase.pdf` 124 KB, `LICENSE.txt`.
  - The PDF (version 1.4, 10 pages) contains only Catalog, Pages, Page, Font and FontDescriptor objects. There is no JavaScript, OpenAction, additional-actions dictionary, Launch, URI, EmbeddedFile or form. The 12 raw "/AA" byte matches are inside compressed streams, not dictionary entries.
- **design-system-patterns** (68 KB, MIT): `SKILL.md` 4.1 KB plus 4 reference files (5.8–15.9 KB). Code examples only; the only links are documentation links (W3C design tokens, Style Dictionary, MDN, Radix and similar).
- **kpi-dashboard-design** (28 KB, MIT): `SKILL.md` 5.7 KB plus `references/details.md` 15.3 KB. The SQL, Streamlit and Python snippets are examples to read; nothing in the skill tells the agent to run them.
- **pptx-deck-context**, **pptx-quality-gates**, **pptx-slide-specification** (12 KB each, MIT): each has a `SKILL.md` (1.7–2.0 KB) plus one reference file (1.1–1.9 KB). The README states the boundary: "No browser, no MCP, no credentials or online service."
- wshobson/agents has 42.5k stars, MIT license, last commit 2026-11-08. Its skill folders carry no license file, so the repo's `LICENSE` was copied into each vetted wshobson folder.
- anthropics/skills has 193.9k stars, last commit 2026-11-06.

### Install notes for the lead

- Copy from `vetted\<name>\`, not from `repos\`, then check the copies against `vetted-sha256.txt`.
- Keep the copies project-scoped (`.claude\skills\`). Skills you already have, such as frontend-design and dataviz, cover the rest.
- Suggested pairings:
  - Owner app: unslop with design-system-patterns, plus kpi-dashboard-design, dataviz and accessibility-review.
  - Deck: pptx-deck-context, then theme-factory with a Takara theme, then pptx-quality-gates. Add pptx-slide-specification only if you export .pptx.

## Everything examined

Verdict key: **SAFE** means instruction-only, or scripts that were reviewed and are benign. **CAUTION** means usable only with the noted edits. **REJECT** means do not install.

| Skill | Source @ commit | Size / files | Verdict | Red flags and notes |
|---|---|---|---|---|
| theme-factory | anthropics/skills @ 2c5958e | 154 KB / 13 | **SAFE** | None. The PDF has no active content. |
| canvas-design | anthropics/skills @ 2c5958e | 6.2 MB / 83 (81 OFL `.ttf` fonts, magic bytes checked) | CAUTION | Instruction-only, but one line says "Download and use whatever fonts are needed", which would send the agent to fetch from the network. Delete that line before using it, for example for deck cover art. It overlaps the algorithmic-art skill you already have. |
| brand-guidelines | anthropics/skills @ 2c5958e | 2.3 KB | REJECT | Not a security issue: it applies Anthropic's own brand, which would make Takara material look like Anthropic's. Useful only as a pattern for writing a Takara brand skill. |
| web-artifacts-builder | anthropics/skills @ 2c5958e | 3 scripts + 20 KB tarball | REJECT | `init-artifact.sh` runs `npm install -g pnpm` (a global install) and unpinned `pnpm create vite`, `vite@latest` and dozens of `pnpm install` calls. `bundle-artifact.sh` adds more unpinned dev dependencies. The tarball holds standard shadcn `.tsx` files. Wrong stack for this project, and the built-in Artifact tool already covers the use case. |
| frontend-design | anthropics/skills @ 2c5958e | 9.5 KB | SAFE (skip) | Byte-identical to the frontend-design skill already installed in `~/.claude/skills`, so it would be a duplicate. |
| unslop | heydamir/unslop @ 97daa3e | 1.5 MB / 15 (skill folder) | **SAFE** | Both scripts read and benign (see above). Repo tests (`test/*.mjs`) were not copied. |
| ui-ux-pro-max (core) | nextlevelbuilder/ui-ux-pro-max-skill @ 6ae86f6 | about 3 MB; 5 Python scripts (4,140 lines) and about 2.9 MB of CSV/JSON data | CAUTION | The workflow requires running `scripts/search.py`. Imports are stdlib only (csv, difflib, json); no network or subprocess calls were found. It writes `design-system/<slug>/MASTER.md` into the project. Paths assume `${CLAUDE_PLUGIN_ROOT}/.claude/skills/...` and need editing. The 4k lines were pattern-scanned, not read line by line. It also works against Takara's look: its fintech and Web3 recommendations are glassmorphism, neon, gradient text and pulsing indicators, the opposite of a premium near-white UI. Not recommended. |
| ui-ux-pro-max: design | same | 18 refs, 9 Python scripts, CSVs | REJECT | `scripts/cip/generate.py` reads `GEMINI_API_KEY`/`GOOGLE_API_KEY`, loads a `.env` file into `os.environ`, and tells the user to `pip install`. SKILL.md and references send API keys to a third-party proxy (`api.muapi.ai`). Logo and image generation is out of scope anyway. |
| ui-ux-pro-max: ui-styling | same | 7 refs, 2 scripts, `.coverage` (53 KB binary), fonts | REJECT | `shadcn_add.py` runs `npx shadcn@<version> add` through `subprocess`. It ships a committed coverage database binary and a `requirements.txt` for pip. Built for React, shadcn and Tailwind. |
| ui-ux-pro-max: design-system | same | 7 refs, 9 scripts, 8 CSVs | REJECT | `fetch-background.py` downloads remote images from pexels.com. `slide-token-validator.py` uses `subprocess.run`. The rest of the scripts were not reviewed line by line. |
| ui-ux-pro-max: brand | same | 11 refs, 4 `.cjs` scripts | REJECT | `sync-brand-to-tokens.cjs` uses `child_process.execFileSync` and writes into `docs/` and `assets/`. Not reviewed line by line. |
| ui-ux-pro-max: slides | same | 1.8 KB + 5 refs | REJECT | A thin router that hands off to sibling skills' scripts (design-system `generate-slide.py` and others), which are themselves rejected. |
| ui-ux-pro-max: banner-design | same | 7.2 KB + 5.1 KB ref | CAUTION | Instruction-only and self-contained; could help with the X-post header image. Its "Security" section says to never reveal "file paths", which contradicts its own Step 5 (report file paths) and could make the agent withhold paths. Delete that section before using it. |
| taste-skill (design-taste-frontend) | Leonxlnx/taste-skill @ f6b7657 | 68 MB repo; skill folder has 1,631 files (133 JS, 23 MJS, 963 SVG, many images) | REJECT | SKILL.md frontmatter defines a Claude Code **Stop hook** that runs `node .../scripts/gate.mjs` automatically at the end of every turn (600 s timeout). Code would run without being asked, and it is unreviewed. The workflow depends on dozens of `.mjs` tools, including `photos.mjs search`, which fetches photos from the network, and `node -e` one-liners. `install.sh` symlinks into `~/.claude/skills`. Too large to review, and aimed at marketing sites rather than apps. |
| frontend-slides | zarazhangrui/frontend-slides @ 9906a34 | 88 files | REJECT | Broken at this commit: SKILL.md says to include the full contents of `viewport-base.css` in every deck and to run `scripts/extract-pptx.py`, `scripts/deploy.sh` and `scripts/export-pdf.sh`, but none of those files are in the repo. The agent would have to invent them or fetch them. It also tells the agent to `pip install python-pptx`, auto-install Playwright and Chromium (about 150 MB), and publish decks to a public Vercel URL. `deck-stage.js` (23 KB) had no fetch, eval or cookie access. |
| writing-guidelines | vercel-labs/agent-skills @ 1a2c79d | 1.3 KB | REJECT | Fetches its rules at run time from a mutable `raw.githubusercontent.com/.../main/command.md` and follows them, so its instructions can change after vetting. Fix: vendor a pinned copy, as already done for `web-design-guidelines`. The repo has no LICENSE file at its root. |
| web-design-guidelines (upstream wrapper) | vercel-labs/agent-skills @ 1a2c79d | 1.3 KB | REJECT | Same live-fetch pattern. The installed `~/.claude/skills/web-design-guidelines` is already a pinned, inlined copy (upstream commit `434b7f9`), so keep that one. |
| react-best-practices, composition-patterns, react-view-transitions, react-native-skills, deploy-to-vercel, vercel-cli-with-tokens, vercel-optimize | vercel-labs/agent-skills @ 1a2c79d | – | Not applicable | Wrong stack (React, Vercel), so file lists only, not vetted. Skip. |
| baseline-ui | ibelick/ui-skills @ ba966a3 | 3.5 KB | SAFE (not recommended) | Instruction-only and good rules (`tabular-nums`, `h-dvh`, an AlertDialog before destructive actions, no gradients, one accent per view). But it requires Tailwind, `motion/react` and Radix or Base UI, which this project doesn't use. Use it only after removing its "Stack" section. |
| create-design-md | ibelick/ui-skills @ ba966a3 | 16.5 KB | CAUTION | Instruction-only and useful (records the design system in a `DESIGN.md`), but it runs the unpinned npm package `npx @google/design.md` (spec, lint, export, diff). Usable only if that package is pinned and vetted separately. |
| component-canvas, create-canvas | ibelick/ui-skills @ ba966a3 | 9.0 KB / 13.7 KB | SAFE (not recommended) | Instruction-only, explicit about permissions, no red flags. They build a canvas for browsing components, which isn't needed here. |
| improve-ui, fixing-accessibility, fixing-metadata, fixing-motion-performance | ibelick/ui-skills @ ba966a3 | – | Skip | Already installed. |
| visual-design-foundations | wshobson/agents @ 9c61ab2 | 39 KB / 4 | SAFE (not recommended) | No red flags, but its defaults are generic (Inter, `#2563eb` blue, safe font pairings) and would pull the UI toward a template look. |
| interaction-design, tailwind-design-system, wcag-audit-patterns, accessibility-compliance | wshobson/agents @ 9c61ab2 | 15–43 KB each | REJECT (not fully read) | The automated scans found no red flags, but these were not read line by line. They overlap installed skills (animate, emil-design-eng, accessibility-review) or the wrong stack (Tailwind). |
| pptx-visual-assets | wshobson/agents @ 9c61ab2 | 2.4 KB / 2 | SAFE (optional) | Instruction-only rules on image provenance, alt text and avoiding images that replace editable text. Add it only if the deck gets a .pptx build. |
| pptx-reference-deck-analysis | wshobson/agents @ 9c61ab2 | 3 Python scripts, 19 KB | CAUTION | The scripts use stdlib `zipfile` plus `defusedxml` (needs `pip install defusedxml`) and claim protection against path traversal, symlinks and zip bombs. Imports were reviewed but not every line. Not needed unless analysing a reference .pptx. |
| board-deck-builder | alirezarezvani/claude-skills @ 08cd8a9 | 21 KB / 3 | SAFE (not recommended) | Instruction-only, but written for board and QBR decks, not a hackathon pitch. The repo bundles about 410 skills in bulk, so trust in it is lower. |
| md-slides | alirezarezvani/claude-skills @ 08cd8a9 | 3 Python scripts, 36 KB | CAUTION | The workflow requires running its Python scripts (imports are stdlib only) and depends on a sibling design-system or orchestrator skill. Generic output. |
| design-qa, ui-design-system | alirezarezvani/claude-skills @ 08cd8a9 | 4 Python scripts + 2 JS assets | REJECT (not reviewed) | Script-heavy and not reviewed line by line. Lower-trust bulk collection. |
| ComposioHQ/awesome-claude-skills | – | – | Skip | Mirrors the official Anthropic skills (canvas-design, theme-factory, brand-guidelines). Use the official source instead. |

## Scan results applied to every shortlisted folder

- **Hidden or bidi Unicode** (zero-width characters, bidi overrides, BOM, tag characters), scanned with a UTF-8 locale: no matches in any text file. The only matches were random bytes inside binary images and the PDF.
- **Long base64 blobs** (200+ characters in .md, .py, .js, .mjs and .sh files): none.
- **Prompt-injection phrases** (ignore previous instructions, act silently or without telling the user, bypass permissions, `--no-verify`, references to .ssh, .aws, cookies, keychains or private keys): none in the recommended skills. All hits elsewhere were harmless, such as WCAG "Bypass Blocks" or dataset text mentioning "wallet".
- **Network, process and credential access** (`curl`, `wget`, `fetch`, `requests`, `urllib`, `child_process`, `subprocess`, `exec`, `eval`, `process.env`, `os.environ`, `pip install`, `npm install`): the only matches in the recommended set are in unslop's optional scripts, which were reviewed and are benign.
- **Symlinks**: none in any vetted copy.
- **Hooks**: no recommended skill declares hooks. taste-skill does (a Stop hook) and is rejected for it.

## Re-scan of installed skills (2026-11-14 05:30 UTC)

Before the simplicity pass, every installed skill under `~/.claude/skills` was scanned statically (nothing executed):
- Non-Markdown files were grepped for network calls, shell execution, `eval`, base64 decoding, credential paths and secret environment variables. The only hits were Anthropic's official document skills (they call LibreOffice via `subprocess`) and `webapp-testing/scripts/with_server.py`, which starts a server command the user passes. Both are expected and unused here.
- Markdown was grepped for prompt-injection phrases. The three hits (`break-ui`, `find-animation-opportunities`, `improve-animations`) are defensive rules telling the agent to *ignore* injected instructions.
- Hidden-Unicode scan: two hits, both benign. One is a zero-width joiner inside an emoji test string in `break-ui/CATALOG.md`; the other is zero-width spaces used to escape nested code fences in `improve-animations/PLAN-TEMPLATE.md`.

Verdict: safe to read. No new skill, package or script was installed or downloaded for this pass.

## Additional skills (2026-11-14)

Goal: find at most 4 more skills for first-run onboarding and hints, progressive disclosure, plain-language copy, simpler dashboards, mobile usability and cognitive-load reviews. Same method as above: shallow clone with `--depth 1 --no-recurse-submodules -c core.hooksPath=/dev/null -c core.symlinks=false`, static inspection only, nothing executed or installed, nothing copied into any `.claude/skills` folder.

Quarantine root: `C:\Users\Admin\AppData\Local\Temp\claude\a30c1ce7346a809f\fff47e11-6cfd-4037-8282-3e2fdab4e5a3\scratchpad\skills-quarantine-2\` (`repos\` = raw clones, `vetted\` = clean copies, `vetted-sha256.txt` = hashes).

Repos chosen:
- **pbakaus/impeccable**: about 110k stars, Apache-2.0, last commit 2026-11-13. Cloned at `5ffe90b8403424a0888e0575bc1fb90517c7af74`.
- **Owl-Listener/designer-skills**: about 3.4k stars, MIT, last commit 2026-09-05. Cloned at `9a6930cf84a822eb458624bd11c61aac5bbdf224`.

Considered and not cloned:
- mastepanoski/claude-skills (`nielsen-heuristics-audit`, 73 stars) and dembrandt/dembrandt-skills (193 stars): too little reputation.
- rampstackco/claude-skills (`onboarding-wizard-design`): built for multi-step signup wizards, not contextual hints.
- jeremylongshore's bulk marketplace: same low-trust bulk-collection concern as alirezarezvani above.
- Nothing relevant was found in anthropics/skills. Its design skills are already installed.

| Skill | Source @ commit (path) | Size | Verdict | Evidence and notes |
|---|---|---|---|---|
| impeccable: full skill | pbakaus/impeccable @ 5ffe90b (`.claude/skills/impeccable`) | 63 files, about 1.9 MB | **UNSAFE as a whole (do not install)** | Setup step 1 in SKILL.md tells the agent to run `scripts/impeccable context` on every session. That launcher (`scripts/impeccable`, `impeccable.cmd`) downloads a compiled engine binary from `github.com/pbakaus/impeccable/releases` with `curl`/`wget`, then `chmod +x` and `exec`s it. The download is SHA-256-checked against `engine-checksums.txt` (engine 0.1.24), but a compiled binary cannot be reviewed statically. The skill also offers a design-detector hook that runs automatically after edits (`reference/hooks.md`), plus `live-browser.js` (565 KB, 40 fetch/WebSocket/localStorage hits, not reviewed line by line). Fails the "nothing runs unasked" rule. |
| impeccable: four reference files (`onboard.md`, `clarify.md`, `distill.md`, `adapt.md`) | same @ 5ffe90b (`.claude/skills/impeccable/reference/`) | 7.8 / 4.5 / 5.5 / 11.0 KB | **SAFE (reference reading only)** | All four were read in full. They are plain Markdown and do not mention the launcher, scripts, network or credentials. The one grep hit, "still downloads" in `adapt.md`, is about CSS `display:none`. Each ends with a harmless "hand off to `/impeccable polish`" line that points at a command that won't exist here, so ignore it. Useful content: onboard covers time to first value, skippable tours of 3–7 steps, versioned "seen" keys, and five empty-state types. Clarify is a message hierarchy for UI text. Distill covers one primary action, progressive disclosure and cutting redundancy. Adapt covers 44 px targets, thumb zones, `pointer: coarse` and 16 px minimum text. Apache-2.0 `LICENSE` copied alongside. SKILL.md was **not** copied because it routes to the launcher. |
| onboarding-design | Owl-Listener/designer-skills @ 9a6930c (`interaction-design/skills/onboarding-design`) | 4.5 KB, 1 file | **SAFE** | Read in full. Instruction-only: no frontmatter hooks, no tool or script references, no links. Covers a sample-data/demo mode (label it as sample data, make it easy to clear), "orient, don't educate", tours of 3–5 concepts that can be dismissed at any point, empty states as onboarding, and re-orientation for returning users. MIT `LICENSE` copied alongside. |
| critique-information-density | same @ 9a6930c (`visual-critique/skills/critique-information-density`) | 3.5 KB, 1 file | **SAFE** | Read in full. Instruction-only. A four-part rubric (cognitive load, content priority, scanning pattern, progressive disclosure), each scored pass / minor / major with observation, problem and fix. Its failure patterns include "dashboards that show every available metric". MIT `LICENSE` copied alongside. |
| heuristic-evaluation | same @ 9a6930c (`prototyping-testing/skills/heuristic-evaluation`) | 2.0 KB, 1 file | **NOT USEFUL** (safe) | Read in full. No red flags, but it only lists Nielsen's 10 heuristics and a 0–4 severity scale. The installed `design-critique` and `accessibility-review` already cover this, so not copied. |

Scans run on the whole impeccable skill folder and the whole designer-skills repo:
- **Symlinks**: 0 in either repo (no git mode-120000 entries).
- **Submodules**: no `.gitmodules` in either repo.
- **Hook declarations**: none in any of the four candidates' SKILL.md files. The full impeccable skill offers its hook through a command, which is part of the UNSAFE verdict above.
- **Hidden Unicode** (zero-width, bidi, BOM, soft hyphen, tag characters), scanned with `LC_ALL=C.UTF-8`; the scan was first checked against a planted U+200B test file: no matches in any text file. The only non-ASCII characters in the copied files are `⌘ é ≠ → – —`.
- **Long base64** (200+ characters): none.
- **Prompt-injection phrases**: no hits in the copied files. Elsewhere, the only hits are harmless: "bypassed" design tokens in designer-skills, "inline" in impeccable's hooks.md, and minified code in `modern-screenshot.umd.js`.
- **Network, exec and credentials** in designer-skills: only in its repo CI scripts (`scripts/*.py` run `git ls-remote` via `subprocess` and read `GITHUB_ACTIONS`). These are not part of any skill and were not copied.
- **Magic bytes**: impeccable's only non-text-looking files (`scripts/data/font-index.json` 1.1 MB, `command-metadata.json`, `font-index-failures.json`) start with `{` or `[`, so they are JSON. designer-skills has no binaries.

Vetted copies and SHA-256 (also in `vetted-sha256.txt`):

```
44cd4e5d26a18075c3a99484bf7b03240baf83a1d8e1b5837e78427e750f7cb6  vetted/impeccable-ux-refs/onboard.md
ae344a11a75cb29cf09ad2325bbdf8caa2e7468a61b88f766a01c758b95bbd23  vetted/impeccable-ux-refs/clarify.md
3cfd0f9156156cb4fe638c0f6cdf709e0b556c6601a9ad0f0548d4282853448a  vetted/impeccable-ux-refs/distill.md
395f347b83c7323c4b10858ac9707c16d3fd996a062b3f901a0304be4157293c  vetted/impeccable-ux-refs/adapt.md
fc0673369dae07c045c46869d3d4c9113678c77fcc7d3b4e3a39ac074cfa68b6  vetted/impeccable-ux-refs/LICENSE
91ad39b03059baddc8027ff85436187d3c307ab9a6a2f0d9ac045e851049a2c2  vetted/onboarding-design/SKILL.md
6514aed70fa2446f3159fdb088e984a0e2a360736d24d1fe6c8a80a865cd7064  vetted/onboarding-design/LICENSE
94bb66b3594ed0bf08a5be2b227d382784c7ba903c82ce51767472d2156386e5  vetted/critique-information-density/SKILL.md
6514aed70fa2446f3159fdb088e984a0e2a360736d24d1fe6c8a80a865cd7064  vetted/critique-information-density/LICENSE
```

Notes:
- `impeccable-ux-refs` is a folder of reference documents, not a skill: it has no SKILL.md. Read it directly, or give it a small local SKILL.md wrapper later if you want it to trigger on its own.
- What these skills would change in the owner app is in `docs/ux/skills-checklist-2026-11-14.md`.
