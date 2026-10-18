# design.md: UI/UX Specification

> **Product:** Evidence-first tournament operations platform for college/community Free Fire MAX battle-royale events (working name: *the platform*; no product name is established in the source documents).
> **Sequence:** 1 of 2 in the UI documentation set. Written after `problem.md`, `ideation.md`, `tech-stack.md`. `animations.md` is written against the Sxx / Cxx IDs defined here.
> **Status:** Draft v1.0 specification for review. No product-specific visual references were supplied. No user research, OCR accuracy figure, or timing result is claimed.

---

## Table of contents

1. Header, scope, ID conventions
2. Design direction and philosophy
3. Design references and deviations
4. Foundations and design tokens
5. App shell, navigation, information architecture
6. Component catalog (C01–C46)
7. Signature components
8. Screen catalog (S01–S54)
9. Data visualization and scores
10. Content design and seed data
11. State matrix and edge cases
12. Accessibility, localization, responsive behavior
13. Component-library and tooling decisions
14. Design rules and banned patterns
15. Traceability
16. Assumptions, open questions, conflicts, handoff

---

# 1. Header, scope, ID conventions

## 1.1 Scope

**In scope:** static visual design, information architecture, component anatomy, screen content and layout, static states, accessibility, responsive behavior, content/copy rules, seed data.

**Explicitly out of scope:**
- **Motion.** Durations, easing, transitions and choreography live in `animations.md`. This file describes what a state *looks like*, never how it animates. Where motion exists, screens cite Mxx IDs only.
- **Application code.** No React, CSS, JavaScript, schemas, or API definitions. Token tables are specifications, not stylesheets.
- Backend behavior. The UI reflects server decisions; it never makes them (tech-stack §4.3 rules 1–2).

## 1.2 ID conventions

| Prefix | Meaning | Defined in |
|---|---|---|
| `Sxx` | Screen (or full-route view). Gaps between ranges are reserved by area, not missing items: S01–S06 public, S07–S08 auth, S09–S16 participant, S20–S42 tournament admin, S43–S46 shared/platform, S50–S54 system. | §8 |
| `Cxx` | Reusable component | §6, §7 |
| `Mxx` | Signature motion moment | `animations.md` only; cited here by ID |
| `Rxx` | Visual reference | **None exist** (§3) |
| `DRxx` | Design rule / banned pattern | §14 |
| Source IDs | **Reused exactly as they appear in the attachments:** `P1–P9` (problem.md §3.1), `FR-*`, `BR-*`, `NFR` areas, `A-xx`, `Q-xx`, edge-case IDs `ER-/EP-/ES-/EM-/EO-/EL-/EX-` (problem.md), `F1–F26` and `D1–D14` (ideation.md), `T-xx` (tech-stack.md). | Attachments |

No source ID is invented in this document. IDs created here are only Sxx, Cxx, DRxx (and Mxx in the sibling file).

## 1.3 Derivation

- `problem.md` (authoritative for problem, constraints, lifecycles, states, risks, open questions): supplies the state vocabularies (§13, §14, §16.7, §17.7, §22), role matrix (§27.2), screen-level requirements (§18.2 review screen), and the open questions that become §16 below.
- `ideation.md`: supplies features F1–F26, the scope labels **Core / Validate / Later**, and the OCR-to-publication flow. Features labelled Validate or Later are marked **[Validate]** / **[Later]** on screens and components and are **not** promoted to initial requirements.
- `tech-stack.md`: constrains the UI to React + TypeScript + Vite SPA, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, shadcn/ui or Radix primitives, a zoom/pan viewer, "lightweight" charts if needed, Playwright/Vitest. Frontend never decides authorization or computes scores (§4.3).
- **Conflicts and gaps** found while reading are recorded in §16.2, not silently reconciled.

## 1.4 Scope labels used on every screen/component

| Label | Meaning |
|---|---|
| **Core** | In ideation §7 "Initial core path" |
| **Validate** | Depends on evidence (OCR, banners, disputes beyond a report, waitlist, second reviewer, external notifications) |
| **Later** | Not designed beyond a placeholder note (multi-game, payments, live integrations) |
| **Open** | Role or behavior depends on an unresolved Q-xx |

---

# 2. Design direction and philosophy

## 2.1 One-sentence direction

**"Match-day control room, tournament-night front door."** The platform has two registers on one system: a *public/participant* register with restrained competitive energy (team identity, podium, big scoreboard numerals) and an *operations* register that is calm, dense, and legible, where the only loud elements are things that need a decision.

## 2.2 Why not the default esports look

Black backgrounds with neon gradients, glow, and angular "gamer" chrome reduce legibility in the places this product matters most: a volunteer admin comparing a screenshot crop against a decorated Unicode name with about five minutes of operational pressure (problem §1; objective, not guarantee). So:

- Operations screens use **neutral cool-slate surfaces and a single cobalt action color**. Both a light and a dark theme are specified (§4.2); light is the default.
- Esports energy is reserved for: the public home hero, tournament cards, the match/standings **scoreboard numerals** (condensed display face), the final **podium**, and team marks. Nothing glows. No decorative gradients; the only gradient permitted is a flat two-stop ink band behind the public hero, specified in §4.9.
- "Volt" (a lime accent) exists only on ink backgrounds as a brand punctuation mark. It is never a status color and never appears on admin work surfaces.

## 2.3 Hierarchy between the three surfaces

| Surface | Audience | Density | Typography emphasis | Color emphasis | Decorative allowance |
|---|---|---|---|---|---|
| **Public** (S01–S06) | Visitors, spectators (Meera) | Low–medium; scan-friendly cards, large scoreboard numerals | Display face for tournament names and ranks | Ink hero, cobalt links, podium metals on S06 only | Hero band, tournament imagery slot, podium |
| **Participant** (S09–S16) | Captains, players (Riya, Kabir) | Medium; checklist- and status-led, mobile-first (A-10) | Status headlines ("What's missing") | Semantic status colors | Team mark only |
| **Admin** (S20–S42) | Organizer-admin (Aarav) | High but calm; tables, queues, review workspace | Mono for IDs/credentials; tabular numerals | Semantic status colors on neutral; cobalt for the single primary action per view | None |

Rule of thumb: **the closer a screen is to a score being made official, the plainer it gets.**

## 2.4 How critical statuses are communicated

Every status is communicated by **three redundant channels: icon glyph + text label + tone (color)**; never color alone (DR-01). Position and shape differ too: unverified/draft content carries a **diagonal hatch band + "Draft: not official" label**; official content carries a **solid "Official · v{n}" seal with timestamp**.

| Concept | Label (exact) | Glyph (Lucide-style name; verify at build) | Tone |
|---|---|---|---|
| Pending | Pending | `clock` | neutral |
| Needs review | Needs review | `eye` | warning |
| Processing | Processing | `loader-circle` (static ring segment) | processing |
| Verified | Verified | `shield-check` | success |
| Published | Published · Official | `badge-check` | success (solid) |
| Rejected | Rejected | `x-circle` | danger |
| Delayed | Delayed | `timer-off` | warning |
| Disputed | Disputed | `message-square-warning` | danger-outline |
| Blocked / not yet allowed | Locked | `lock` | blocked |

## 2.5 Design principles (enforceable)

1. **Evidence first.** Wherever a number came from a screenshot, the screenshot crop is reachable in one action (D1; FR-V1).
2. **Maturity is always visible.** Draft, Verified, Published are different shapes and labels, not different shades (§9.5; D1; BR-X1).
3. **Never guess silently.** Ambiguous identity renders as a question, never a confident name (D3; §16.6).
4. **One primary action per view.** Verify and Publish are separate, explicit, and never adjacent in the same button group (§18.4).
5. **Purposeful color.** Cobalt = the next action. Semantic colors = state. Podium metals = rank position only. No color encodes score or skill (§4.7).
6. **Consistent spacing and vocabulary.** 4-px base grid; one status vocabulary (§10.3); one icon set.
7. **Readable tables.** 14-px minimum body in dense tables, tabular numerals, sticky headers, row height ≥ 40 px (DR-12).
8. **Permissions are visible and honest.** A control the user may not use is either absent or shown **Locked with a reason**; UI hiding is never the security control (D10; §27.3).
9. **Manual path always visible.** "Enter manually" is a first-class control beside every OCR step (D5; F16).
10. **Restrained decoration.** Decorative effects live only in the places listed in §2.3.

## 2.4b Not generic / not AI-vibe-coded checklist

- [ ] Every color, size, radius, and space value comes from §4 tokens.
- [ ] Seed data is domain-specific (§10.5) and marked illustrative.
- [ ] Every screen defines empty, loading, error, offline, permission-denied states or states why one does not apply (§11).
- [ ] One component vocabulary (C01–C46); no one-off cards.
- [ ] No random gradients; no glow; no meaningless metric tiles (DR-02).
- [ ] No placeholder copy ("Lorem", "Welcome back!", "Something went wrong") in final mockups (DR-14).
- [ ] No UI for unsupported features: no live game stats, wallet/payout, anti-cheat, streaming overlays, automatic room creation (§8.4 of problem.md).

---

# 3. Design references and deviations

**No product-specific visual references supplied.** (Rxx IDs are therefore not used.) No screenshots or mockups for this product were provided. Nothing in this document claims to have sampled colors or layouts from any existing site or app.

**Text-only pattern source.** `problem.md` §6.2 records that `eagleesport.com` was inspected by fetching three pages; dynamic data did not render and no visuals were studied. The patterns it records as adaptable are adopted **only as information-architecture ideas**: the Live / Upcoming split on the tournament list (S02), scoped ranking views (S05), a personal "my tickets"-style registration view (S09), explicit empty/error states (§11), and bottom-tab mobile navigation (§5). Branding, wording, palette, wallet/payout, scrims, and daily-stats concepts are **not** adopted.

**Original direction chosen** (§2): a two-register system built around cobalt actions, cool-slate neutrals, a condensed display numeral face for scoreboards, and a status system with redundant glyph/label/tone. This is a reasoned proposal to be reviewed against real organizer feedback (problem §10 personas are unvalidated, R14).

**Reference document handling.** No reference `design.md`/`animations.md` from another project was attached to this task; the structure here follows the brief's required section list. No other project's content is used.

---

# 4. Foundations and design tokens

All values below are proposals for review. Contrast ratios in §4.8 were **computed in this session with the WCAG 2.x relative-luminance formula** on the exact hex pairs; they are calculations, not browser-tested measurements. The accessibility target level is undecided (T-10); the tables below aim for AA-level text contrast (4.5:1) and 3:1 for non-text UI as a working assumption.

## 4.1 Theme decision

problem.md/ideation.md/tech-stack.md **do not require dark mode**. Decision: ship **Light (default)** and **Dark** from one token set because admins may work in dim venues and the audience skews mobile/gaming. If scope must shrink, Dark is the first item to defer (**Open**: confirm in §16). Public hero and podium always use the ink surface regardless of theme.

## 4.2 Color tokens: neutrals and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.canvas` | `#F4F6FA` | `#0B1020` | Page background |
| `bg.surface` | `#FFFFFF` | `#121A2E` | Cards, tables, panels |
| `bg.sunken` | `#EBEEF4` | `#0A0E1B` | Table header, input wells, code blocks |
| `bg.raised` | `#FFFFFF` | `#1A2440` | Dialogs, drawers, menus |
| `bg.ink` | `#0B1020` | `#0B1020` | Public hero, podium, banner template base |
| `border.subtle` | `#DDE2EC` | `#26304C` | Dividers, row separators |
| `border.default` | `#C3CAD8` | `#3A4666` | Card borders |
| `border.strong` | `#7B869B` | `#6B7794` | Input borders (3:1 non-text) |
| `text.primary` | `#0F1729` | `#EEF1F8` | Body, headings, data |
| `text.secondary` | `#4A5468` | `#AEB7CC` | Labels, helper text |
| `text.tertiary` | `#5E687D` | `#8E99B2` | Metadata, timestamps (never for required info) |
| `text.disabled` | `#8A93A6` | `#5B6684` | Disabled controls only (exempt from contrast; always paired with reason text elsewhere) |
| `text.on-ink` | `#EEF1F8` | `#EEF1F8` | Text on `bg.ink` |

## 4.3 Brand tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand.primary` | `#2447D6` | `#8AA4FF` | Primary buttons, links, active nav, selected rows |
| `brand.primary-hover` | `#1B38B0` | `#A5B9FF` | Hover/pressed appearance |
| `brand.primary-subtle` | `#E6ECFF` | `#1B2756` | Selected row bg, active nav bg |
| `brand.on-primary` | `#FFFFFF` | `#0B1020` | Text/icon on primary fill |
| `brand.volt` | `#C5F82A` | `#C5F82A` | **Only on `bg.ink`:** hero accent rule, rank-1 numeral underline on S06, banner accent. Never a status; never behind body text. |

## 4.4 Semantic tokens (state)

| Semantic | Fg (light) | Bg (light) | Border (light) | Fg (dark) | Bg (dark) | Meaning |
|---|---|---|---|---|---|---|
| `success` | `#0F6B3B` | `#E3F6EB` | `#8FD3AD` | `#5FD694` | `#10301F` | Verified, approved, confirmed identity |
| `warning` | `#7A4A00` | `#FFF2D6` | `#F0C36A` | `#F5B94C` | `#382806` | Needs review, suggested match, sanity warning, delayed |
| `danger` | `#B3261E` | `#FDE8E6` | `#F2A59F` | `#FF8A80` | `#3D1512` | Rejected, failed, validation error, disputed, destructive |
| `info` | `#0B5CA8` | `#E4F1FC` | `#9CC9EE` | `#6DB8F5` | `#0F2A44` | Neutral notices, rule explanations |
| `processing` | `#5336C4` | `#EEE9FD` | `#C3B7F2` | `#B3A1FF` | `#251C52` | Queued/running jobs |
| `blocked` | `#475069` | `#E8EBF2` | `#A4ADC0` | `#A9B3CB` | `#242C42` | Locked by lifecycle/role/dependency; always with hatch border |
| `neutral` | `#4A5468` | `#EBEEF4` | `#C3CAD8` | `#AEB7CC` | `#1F2840` | Pending/unreviewed/default |

## 4.5 Domain tokens

**Tournament status chips** (label → tone): Draft→neutral · Published→info · Registration open→success · Registration closed→neutral · In progress→processing · Finalizing→warning · Completed→success · Archived→blocked · Cancelled→danger.

**Match status chips:** Scheduled→neutral · Ready→info · In progress→processing · Awaiting evidence→warning · Processing→processing · Under review→warning · Verified→success · Published→success (solid) · Corrected→info with `v{n}` · Delayed→warning · Rescheduled→neutral · Interrupted→danger · Restarted→warning · Cancelled→danger.

**Maturity tokens** (the draft/verified/published distinction; DR-03):

| Token | Appearance (static) |
|---|---|
| `maturity.draft` | `bg.sunken` fill, 1-px **dashed** `border.strong`, diagonal hatch band 6 px at the top edge, label "Draft · not official" with `file-pen` glyph |
| `maturity.review` | `warning` bg, solid warning border, label "Under review" with `eye` |
| `maturity.verified` | `success` bg, **dotted** success border, `shield-check`, label "Verified · not yet published" |
| `maturity.published` | `bg.surface`, solid 1-px `border.default`, top 3-px `brand.primary` rule, `badge-check` seal "Official · v{n} · {timestamp}" |
| `maturity.superseded` | `bg.sunken`, struck-through values, label "Superseded by v{n}" |

**OCR match-confidence tokens** (see C08). Tier labels derive from problem.md §17.5; they are **not percentages** and carry no numeric certainty until thresholds are calibrated (Q-22):

| Tier / status | Label | Glyph | Pips (of 5) | Tone |
|---|---|---|---|---|
| T1 exact raw | Exact | `check-check` | ●●●●● | success |
| T2 exact after fold | Matches after normalizing | `check` | ●●●●○ | success |
| T3 skeleton match | Look-alike characters | `scan-eye` | ●●●○○ | warning |
| T4 edit distance | Close match | `spell-check` | ●●○○○ | warning |
| T5 stripped fuzzy | Weak match | `help-circle` | ●○○○○ | warning |
| Ambiguous | Ambiguous: {n} candidates | `git-fork` | n/a (shows candidate count) | warning, thick border |
| Collision | Roster collision | `copy-x` | n/a | danger-outline |
| Unreadable | Unreadable | `eye-off` | n/a | danger-outline |
| Unknown player | Not on roster | `user-x` | n/a | danger-outline |
| Confirmed | Confirmed by {admin} | `user-check` | ●●●●● filled solid | success |
| Approximate IGN on roster | Roster name is approximate | `badge-help` | caps tier at "Needs confirmation" | warning |

Only **Confirmed** is ever styled as success for identity. Machine tiers T1–T2 display "Exact"/"Matches after normalizing" and a **"Suggested" ribbon** until the admin confirms (or quick-confirms) it, per §16.6 and FR-I2.

**Rank and team accents:**

| Token | Light/Dark | Use |
|---|---|---|
| `rank.1` fill / text-on | `#E7B93A` / `#1A1400` | Podium position 1 chip and rank number badge |
| `rank.2` | `#C9D1DE` / `#0F1729` | Position 2 |
| `rank.3` | `#D08A55` / `#1A0E05` | Position 3 |
| `team.accent.1…8` | `#2447D6, #0F8F7B, #B3401E, #7A3FD1, #B07A00, #C2287A, #3C6E1E, #54607A` | **Team mark background only** (initial letter tile). Assigned by team id, not by rank or score. Each paired with text-on `#FFFFFF`. |

Team accents are identity, not performance; they never tint rows by rank (DR-05). Rank is shown as a number plus (top 3 on podium views only) a metal chip with the ordinal text.

**Table / chart / selection / focus / input tokens:**

| Token | Light | Dark | Use |
|---|---|---|---|
| `table.header-bg` | `#EBEEF4` | `#0A0E1B` | Sticky header |
| `table.row-hover` | `#F4F6FA` | `#1A2440` | Hover appearance (hover-capable devices only) |
| `table.row-selected` | `#E6ECFF` | `#1B2756` | Selected row (plus 3-px left bar in `brand.primary`) |
| `table.row-flagged` | `#FFF2D6` | `#382806` | Flagged OCR rows (plus warning glyph) |
| `table.zebra` | none (off by default) | none | Dense tables use 1-px separators instead |
| `chart.series.1…4` | `#2447D6, #0F8F7B, #B07A00, #7A3FD1` | `#8AA4FF, #4ECDB4, #F5B94C, #B3A1FF` | Each series also gets a distinct marker shape and direct label (DR-01) |
| `chart.grid` | `#DDE2EC` | `#26304C` | Gridlines |
| `focus.ring` | `#1A3FD0` 2 px + 2 px `bg.surface` offset | `#8AA4FF` 2 px + 2 px offset | All focusable elements; never removed |
| `input.border` | `#7B869B` | `#6B7794` | Default |
| `input.border-hover` | `#4A5468` | `#AEB7CC` | |
| `input.border-focus` | `#1A3FD0` | `#8AA4FF` | + focus ring |
| `input.border-error` | `#B3261E` | `#FF8A80` | + error glyph + message |
| `input.bg-disabled` | `#EBEEF4` | `#0A0E1B` | Disabled; reason shown in helper text |
| `ocr.box.default` | `#2447D6` 2-px outline, 10% fill | `#8AA4FF` | Bounding box on screenshot |
| `ocr.box.active` | `#2447D6` 3-px outline + 2-px white inner stroke | same | Box for selected row |
| `ocr.box.flagged` | `#7A4A00` dashed 2-px | `#F5B94C` | Boxes for flagged rows |

## 4.6 Typography

| Role | Family | Fallback stack | Notes |
|---|---|---|---|
| UI / body | **Inter** (variable) | `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif` | Tabular numerals (`tnum`) enabled in tables and any column of numbers |
| Display / scoreboard numerals | **Barlow Condensed** 600/700 | `"Arial Narrow", "Roboto Condensed", Inter, sans-serif` | Only: hero heading, tournament title on cards, rank numerals, match points on leaderboards, podium. Not for body. **Verify** the font's tabular-figure support before using it in aligned columns; otherwise use Inter `tnum` in tables and Barlow only for single large numbers |
| Monospace | **JetBrains Mono** | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | Room ID, password, UIDs, transaction references, content hashes, job IDs, codepoint display |
| Unicode IGN fallback chain | n/a | `Inter, "Noto Sans", "Noto Sans Math", "Noto Sans Symbols", "Noto Sans Symbols 2", "Noto Sans CJK", system-ui` appended after the role font wherever an IGN renders (C46) | Math alphanumerics, small caps, and ornament symbols are not all in Inter; stack must be tested against the real name census (Q-28). Font licenses and bundle size: **not verified** |

**Type scale** (px / line-height / weight; rem equivalents at 16 px root):

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `type.display-xl` | 56/60 | Barlow 700 | Public hero (≥ lg); 40/44 on mobile |
| `type.display-l` | 40/44 | Barlow 700 | Podium names, tournament page title |
| `type.display-m` | 28/32 | Barlow 600 | Rank numerals, leaderboard points (large) |
| `type.h1` | 28/36 | Inter 650 | Page title |
| `type.h2` | 22/30 | Inter 650 | Section title |
| `type.h3` | 18/26 | Inter 600 | Card title, panel title |
| `type.body` | 16/24 | Inter 400 | Default body (public, forms) |
| `type.body-dense` | 14/20 | Inter 400 | **Minimum for tables and admin lists** (DR-12) |
| `type.label` | 14/20 | Inter 500 | Form labels, column headers |
| `type.caption` | 12/16 | Inter 500 | Timestamps, secondary metadata only; never for the sole carrier of status |
| `type.mono` | 14/20 | JetBrains Mono 500 | Credentials, IDs |
| `type.mono-lg` | 20/28 | JetBrains Mono 600 | Room ID on credential panel |

**Numeric formatting:** tabular numerals; right-aligned numeric columns; integers with no grouping under 10,000 (scores rarely exceed this); ordinals in prose ("3rd"), bare numerals in tables with column header "Rank"; timers `mm:ss` (never `m:s`), countdown `T–08:30`; placement displays as `#7` in compact cells and "7th" in sentences; deltas `+3` / `−2` using the true minus U+2212 plus `▲`/`▼` glyphs and words in `aria-label` ("up 3 places").

**Unicode IGN display rules (C46):** preserve exactly what was submitted (raw) and exactly what OCR detected (raw); never substitute a normalized form into the display. Display font = fallback chain above. **Overflow:** single line with end-ellipsis in dense rows with `title`/tooltip of full text; wrap at grapheme boundaries (never break a combining sequence) in cards and the review panel; allow up to two lines in the review workspace. **Copy:** every IGN has a copy affordance copying the raw string unmodified. **Safety:** bidirectional override/control characters are rendered as visible placeholders `⟦U+202E⟧` (problem §27.3 item 4); invisible characters are surfaced the same way. **Codepoint view:** a "Show characters" toggle lists each grapheme with its `U+XXXX` in mono, so an admin can tell `Ο` (Greek) from `O` (Latin). Tofu/missing-glyph fallback: if the browser cannot render a glyph, the codepoint view auto-offers.

## 4.7 Spacing, layout, density

- **Base unit 4 px.** Spacing tokens: `space.1`=4, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `10`=40, `12`=48, `16`=64.
- **Breakpoints:** `xs` 0–479 · `sm` 480–767 · `md` 768–1023 (tablet) · `lg` 1024–1439 (laptop) · `xl` 1440–1919 (wide desktop) · `2xl` ≥ 1920.
- **Page widths:** public content max 1200 px centered; participant content max 960 px; admin tables fluid up to 1440 px content width, wider only inside the review workspace (full-bleed).
- **Grid:** 4 columns (xs–sm, 16-px gutter), 8 columns (md, 20-px gutter), 12 columns (lg+, 24-px gutter).
- **Sidebar:** admin 248 px expanded / 64 px collapsed at `lg`+; participant uses top bar + bottom tabs below `md`; no sidebar for public.
- **Density:** `comfortable` (default for public/participant: 48-px rows, 16-px card padding on mobile / 24 on desktop) and `compact` (admin tables: 40-px rows, 12-px cell padding). Review workspace rows are 48 px minimum regardless, because each row holds editable fields and chips.
- **Control sizes:** buttons/inputs `sm` 32 px (compact admin only), `md` 40 px (default), `lg` 48 px (primary mobile actions); **touch targets ≥ 44 × 44 px** on touch devices (extend hit area with padding if the visual is smaller).
- **Radii:** `r.sm` 4 (chips, inputs), `r.md` 8 (buttons, cards), `r.lg` 12 (dialogs, drawers), `r.full` (avatars, pips).
- **Borders:** 1 px `border.default` for cards; dashed 1 px for draft maturity; 2 px `focus.ring`.
- **Elevation:** prefer borders to shadows. `elev.0` none; `elev.1` `0 1px 2px rgba(11,16,32,.08)` for cards on hover-capable devices only; `elev.2` `0 8px 24px rgba(11,16,32,.16)` for menus/dialogs/drawers. Layering z-order: base 0 · sticky headers 10 · sidebar 20 · drawers 40 · dialogs 50 · toasts 60 · global connection banner 70.
- **Icons:** one set, **Lucide** (the default of shadcn/ui per tech-stack §4.1), 20 px default / 16 px in dense chips / 24 px in nav, 1.75-px stroke, `currentColor`. Names above are working names; verify they exist when implementing.
- **Avatars/marks:** player avatar 32 px circle (initials fallback; no uploaded photo in Core). **Team mark** 40 px rounded-square: uploaded logo if the organizer has permission (problem §21), else initial-letter tile on a `team.accent` color. No third-party game assets by default (problem §21).
- **Imagery:** Tournament imagery (a banner slot 16:9 on S03 and a 4:3 card thumbnail on S02/S10) is organizer-supplied; fallback is a typographic card on `bg.ink` with the tournament name. Operators never see decorative imagery on S20–S42 work surfaces; compact tables beat illustration for data entry.

## 4.8 Contrast notes (calculated, not browser-tested)

Computed with the WCAG relative-luminance formula on exact hex pairs.

| Pair | Ratio | Passes (working target) |
|---|---|---|
| Light `text.primary` on `bg.surface` | 17.87:1 | Text ≥ 4.5 |
| Light `text.secondary` on `bg.surface` / `bg.canvas` | 7.61 / 7.03 | Text |
| Light `text.tertiary` on `bg.surface` / `bg.canvas` | 5.60 / 5.17 | Text |
| `brand.primary` on `bg.surface` (link/button text) | 7.13 | Text |
| White on `brand.primary` fill | 7.13 | Text |
| Light semantic fg on its bg: success / warning / danger / info / processing / blocked / neutral | 5.85 / 6.74 / 5.56 / 5.88 / 6.58 / 6.72 / 6.55 | Text |
| Light `border.strong` on `bg.surface` | 3.67 | Non-text ≥ 3:1 |
| Light `focus.ring` on `bg.surface` | 7.88 | Non-text |
| Dark `text.primary` / `secondary` / `tertiary` on `bg.surface` | 15.31 / 8.61 / 6.06 | Text |
| Dark `brand.primary` on surface; `on-primary` on primary | 7.28 / 7.97 | Text |
| Dark semantic fg on bg: success / warning / danger / info / processing / blocked | 7.87 / 8.09 / 7.00 / 6.85 / 6.92 / 6.60 | Text |
| Dark `border.strong` on surface | 3.87 | Non-text |
| `brand.volt` on `bg.ink` | 15.18 | Text/graphic |
| Rank text-on-fill: gold / silver / bronze | 9.96 / 11.63 / 6.72 | Text |

**Not computed / to check at implementation:** disabled text (exempt but verify legibility), `text.on-ink` over any organizer-supplied imagery (always place a solid ink scrim), hatch-pattern contrast, and focus ring over `table.row-selected`. The conformance level to claim (e.g., WCAG 2.2 AA) is **T-10, undecided**.

## 4.9 The only permitted gradient

Public hero (S01) only: a flat linear band from `#0B1020` to `#141D3A` at 180° as backing for display type, with a 4-px `brand.volt` rule beneath the headline. It exists to separate the hero from the canvas; it must not appear on any admin surface, card, button, or chart (DR-02).


---

# 5. App shell, global navigation, information architecture

## 5.1 Shell variants

| Variant | Used by | Structure |
|---|---|---|
| **Public shell** (C01-P) | S01–S06, S50–S54 | Top bar (logo placeholder, Tournaments, Sign in / account), footer (rules, privacy notice link, contact). No sidebar. |
| **Participant shell** (C01-U) | S09–S16, S43 | Top bar + tournament context chip; bottom tab bar below `md` (Home, My tournaments, Schedule, Results, Account) |
| **Admin shell** (C01-A) | S20–S42, S45–S46 | Left sidebar (collapsible at `lg`+; drawer on `md`; bottom sheet menu on `sm`), top bar with **tournament context switcher**, global search **omitted** (not justified: the closed set of ~12 teams / ~48 players is browsed via tables and filters), notification bell, account menu |

A **tournament context bar** (name, status chip, "as of Match N") sits under the top bar on every admin and participant tournament-scoped screen so the user always knows which event they are acting in (prevents wrong-tournament actions, problem P9, EM-09).

## 5.2 Navigation items, visibility, targets

| Item | Public | Player | Captain | Tournament admin | Platform admin | Target |
|---|---|---|---|---|---|---|
| Home | ✔ | ✔ | ✔ | ✔ | ✔ | S01 |
| Tournaments | ✔ | ✔ | ✔ | ✔ | ✔ | S02 |
| Sign in / Sign up | ✔ (signed-out) | – | – | – | – | S07 |
| My tournaments | – | ✔ | ✔ | – | – | S09 |
| My schedule & room | – | ✔ (if eligible) | ✔ (if eligible) | – | – | S14 |
| My results | – | ✔ | ✔ | – | – | S15 |
| Disputes **[Validate]** | – | – | ✔ (Open: Q-16 may include players) | – | – | S16 |
| Notifications | – | ✔ | ✔ | ✔ | ✔ | S43 |
| Admin overview | – | – | – | ✔ | ✔ | S20 |
| Tournaments (admin) | – | – | – | ✔ | ✔ | S21 |
| Registrations | – | – | – | ✔ | ✔ | S24 |
| Slots & participants | – | – | – | ✔ | ✔ | S26 |
| Matches | – | – | – | ✔ | ✔ | S27 |
| Match operations | – | – | – | ✔ | ✔ | S28 |
| Results (review queue) | – | – | – | ✔ | ✔ | S31 → S32 |
| Standings | – | – | – | ✔ | ✔ | S37 |
| Disputes **[Validate]** | – | – | – | ✔ | ✔ | S39 |
| Audit history | – | – | – | ✔ (tournament scope) | ✔ (all) | S41 |
| Finalize | – | – | – | ✔ | ✔ | S42 |
| Organizers & access **[Open: Q-20]** | – | – | – | – | ✔ | S45 |
| Account menu (Profile, Theme, Sign out) | – | ✔ | ✔ | ✔ | ✔ | S44 (profile) |

A designated-uploader role (ideation §5, **[PROPOSAL]**) sees only: Matches (S27, read-only) and Upload evidence (S30). Items not in a role's column are **absent**, not disabled, except lifecycle-locked actions inside screens, which are shown **Locked with reason**.

## 5.3 Page header and breadcrumbs

Page header = breadcrumb (≤ 3 levels, e.g. `Tournaments › Inter-Department Showdown S1 › Match 3 review`) + H1 + status chips + page actions (max 1 primary + 2 secondary; overflow into a "More" menu). On `sm`, breadcrumb collapses to a back link with the parent title.

## 5.4 Global status regions

| Region | Static content |
|---|---|
| **Connection banner** (C29-global, z 70) | Persistent bar when the browser is offline or the API is unreachable: "You're offline. Changes you make won't be saved." with the last-synced time. Review workspace additionally shows "Autosave paused" next to the draft status. |
| **Session-expiry** | Re-authentication dialog (C31 variant) preserving the open page; admin sensitive actions may demand re-auth (problem §27.3 item 10). Full-page fallback S53. |
| **Stale-version** | When the server rejects a write as stale (BR-X10 `STALE_VERSION`): inline banner "This row changed since you opened it (by {admin}, {time})" with `Refresh` and `Compare` actions. |
| **Notification bell** (C40) | Badge count (number, not only dot); list of event types from FR-N1: approval/rejection, payment status, slot, schedule change, credentials available/changed, results published, correction. Credentials are **never** printed in notification text (problem §15.1). |

## 5.5 Global overlays (static content)

| Overlay | Component | Static content rules |
|---|---|---|
| Confirmation dialog | C31 | Title states the object and consequence ("Publish Match 3 results?"), body lists what becomes public and what changes, primary action named with the verb ("Publish results"), Cancel is the default-focused button for destructive/irreversible actions |
| Upload dialog | C06 inside C31/C32 | Match selector locked to the match you came from, drop zone, file list with per-file status, guidelines link (F25) |
| Review panel / drawer | C32 | Right drawer ≥ `md` (480 px); full-screen sheet on `sm` |
| Menus | C33 | Account, row actions, "More" |
| Toasts | C30 | Bottom-left (desktop) / top (mobile); never the only record of a result (DR-09) |
| Command palette | **Not included** (not justified by the product; keyboard shortcuts exist in S32 only) |

---

# 6. Component catalog

**Template per entry:** Purpose/screens · Anatomy · Variants/sizes · Static states · Content/data rules · Responsive · Accessibility · Source IDs · Base library. **Motion is never specified here**; `animations.md` maps motion to these IDs. Every component supports the baseline states *default, hover (hover devices only), pressed, focus-visible, disabled* in addition to those listed.

### C01 App shell: header, sidebar, tab bar
- **Purpose/screens:** frame for all screens (§5.1). **Anatomy:** top bar 56 px; admin sidebar sections (Operate / Configure / Review / Audit); participant bottom tabs 56 px with 24-px icons + 12-px labels.
- **Variants:** C01-P public, C01-U participant, C01-A admin; sidebar expanded/collapsed.
- **States:** active item = `brand.primary-subtle` bg + 3-px left bar + bold label; item with attention count shows number badge; permission-limited items are absent.
- **Responsive:** sidebar → drawer at `md`, bottom tabs below `md` (participant), admin menu sheet below `md`.
- **A11y:** `<nav>` landmarks with labels ("Primary", "Tournament"); skip-to-content link first in tab order; current page `aria-current="page"`.
- **Source:** F1, F2, F11, F24; §27.2. **Base:** shadcn/ui Sheet + custom layout.

### C02 Public footer / site chrome
- Links: Rules & privacy notice (must disclose OCR provider data flow if external, problem §27.3 item 8; **Open Q-08**), Contact organizers, College affiliation line (organizer-supplied). **A11y:** `<footer>` landmark.

### C03 Button and icon button
- **Variants:** `primary` (cobalt fill, one per view), `secondary` (outline `border.strong`), `tertiary` (text), `destructive` (danger fill, used only inside C31), `quiet-icon`. **Sizes:** sm 32 / md 40 / lg 48.
- **States:** default · hover · pressed · focus-visible · disabled (bg `input.bg-disabled`, label stays readable, **reason in adjacent helper text or tooltip**, never silent) · loading (label retained, spinner glyph replaces leading icon, button remains in place and width-stable; **disabled while the request is in flight; idempotency per tech-stack §4.3 rule 5**) · locked (lock glyph + reason popover).
- **A11y:** icon-only buttons require `aria-label`; loading exposes `aria-busy`. **Base:** shadcn/ui Button.

### C04 Form field set (text input, textarea, select, date/time, checkbox, radio, switch)
- **Anatomy:** label above (14-px/500), optional "Optional" tag, control, helper text (12–14 px `text.secondary`), error line (danger glyph + text). Required fields are marked with "Required" text (not just an asterisk).
- **States:** default · hover · focus · filled · disabled · read-only (no border, sunken bg) · error · warning (non-blocking sanity message) · permission-limited (read-only + lock + reason).
- **Date/time:** shows the timezone label next to the field ("IST") and the resolved absolute time on the summary; start/end pairs validate order (problem §11.A).
- **A11y:** label bound with `for`; error text associated via `aria-describedby`; error summary at top of forms lists links to fields. **Base:** React Hook Form + Zod resolvers + shadcn/ui Form/Input/Select/Checkbox/Switch; native date/time inputs initially (decide: **Open** whether a custom picker is needed).

### C05 IGN field (roster entry IGN capture)
- **Purpose:** capture raw IGN + exactness + optional UID (FR-R3, F5). **Screens:** S10, S11, S25.
- **Anatomy:** (1) IGN text input (mono-agnostic, uses Unicode fallback stack), paste-friendly; (2) checkbox "I can't type my exact name": when ticked, the label changes to "Closest keyboard version of your name" and the exactness badge becomes *Approximate*; (3) optional UID input (mono); (4) optional "Add profile screenshot" (C06 compact); (5) exactness badge (C07: Exact / Approximate / Unverified / Admin-confirmed); (6) helper "How to copy your in-game name" link (content **[Open Q-06]**, must not state a menu path until verified in the game).
- **Warnings (non-blocking):** "Another player in this tournament has a very similar name ({IGN}). Matching may need manual confirmation on match day." Collision warnings never block registration (problem §17.3 item 5).
- **States:** default · exact · approximate (warning tone) · collision-warning · error (empty/too long/duplicate within registration) · read-only after lock (BR-L1) with "Request a change" action · admin-confirmed (success).
- **Data rules:** raw string preserved byte-for-byte; the derived normalized forms are **never shown to the captain** (admin-only in C46 codepoint view). **A11y:** the approximate toggle is a real checkbox; badge text is read out ("Name exactness: approximate").
- **Source:** FR-R3, F5, P5, ER-07, ER-08. **Base:** C04 + custom.

### C06 File upload / drop zone
- **Anatomy:** dashed `border.strong` region 160 px min-height, icon, "Drop a screenshot here or choose a file", accepted types and max size line (values from server config, **Open**), file list below with thumbnail, filename (mono), size, per-file status chip.
- **Per-file states:** queued · uploading (determinate bar only if byte progress is measurable) · uploaded · **checks failed** (type/size/decode/resolution warning/duplicate by hash) · retryable error · replaced/superseded. Rejection reasons in plain words ("This file isn't a readable image").
- **Mode variants:** `match-screenshot` (requires explicit match; shows locked match context C45), `payment-proof`, `profile-screenshot`.
- **Important:** "Uploaded" ≠ "Extracted". The dropzone never shows processing outcome; that is C36 (DR-07).
- **Responsive:** on touch, includes "Take photo / choose from gallery" label. **A11y:** native file input is the focus target; drop zone is not the only entry path; status changes announced via live region.
- **Source:** FR-E1, FR-E2, FR-P2, F12, F6, EM-09, EM-10, EO-05. **Base:** react-dropzone (recommended, **not verified**; see §13).

### C07 Status badge / chip
- **Anatomy:** glyph (16 px) + label (14 px/500) + optional suffix (`v2`, count). Height 24; radius `r.sm`. Fill from §4.4 semantic bg, text/glyph from fg, 1-px border.
- **Variants:** `solid` (Published / Official only), `soft` (default), `outline` (disputed, collision, unreadable), `hatched-border` (Locked).
- **Domains and labels:** exactly the vocabulary in §10.3. **A11y:** the label is real text; glyph `aria-hidden`. A chip never appears without its text label.
- **Source:** §13, §14, §16.7, §17.7, §22; P2.

### C08 Match-confidence indicator
- **Purpose:** show identity candidate strength without implying certainty. **Anatomy:** glyph + tier label + 5 pips (see §4.5 table); optional "Suggested" ribbon; details popover (C33) lists: tier name, which comparison matched, similarity score labelled **"Similarity (evidence, not proof)"**, normalization version, and any roster flags (approximate IGN, collision).
- **States:** T1…T5 · ambiguous · collision · unreadable · unknown player · confirmed · overridden · rejected · approximate-capped.
- **Rules:** no percentage in the primary view; if the pipeline later provides calibrated confidence (Q-22), it can appear in the popover only. T1/T2 stay "Suggested" until confirmed or quick-confirmed.
- **A11y:** the pips are decorative; the label carries the meaning ("Close match, needs confirmation"). **Source:** FR-I1, FR-I2, §16.6, §17.5, D3.

### C09 Team identity row, player row, roster member card
- **Team identity:** team mark (40 px) + team name + optional `Slot 7` chip. **Player row:** avatar, display name, IGN (C46), exactness badge (C07), UID (mono, if present), role (Captain/Player/Substitute).
- **Roster member card** (participant): same fields + contact status ("Invitation accepted" / "Awaiting response"); contact details (phone/email) are **not shown to teammates by default** (problem §27.1).
- **States:** default · pending invite · confirmed IGN · IGN problem · removed/replaced (struck through, history kept) · read-only/locked.
- **Source:** F4, F5, FR-R2, §26 identity distinctions.

### C10 Tournament card
- **Anatomy:** 4:3 imagery slot or typographic fallback, status chip (C07), title (display), game · format line, date range (IST), capacity meter (C39), entry fee ("₹100 per team" illustrative), CTA label depending on state (View, Register, View results).
- **Variants:** `live`, `upcoming`, `past/archived`, `compact` (list row on `sm`). **States:** registration open · full · closed · results pending · completed · archived · cancelled.
- **Source:** F1, FR-T3.

### C11 Tournament lifecycle strip
- Horizontal stepper of the public-relevant lifecycle: Published → Registration → In progress → Finalizing → Completed. Current step solid; done steps check glyph; cancelled replaces the strip with a danger notice. Labels always present (no icon-only steps).
- **Source:** §13; FR-T3.

### C12 Match card / match list row
- **Anatomy:** `Match 3` (display numeral) · map name · start time (IST) · status chip · participants count · credential state chip (admin/participant) · result maturity chip · overflow actions.
- **States:** one per match status (§4.5). Rescheduled shows old time struck through + new time. Attempt: "Attempt 2" chip after a restart (EM-05).
- **Source:** F9, FR-M1, FR-M2.

### C13 Slot assignment control
- **Anatomy:** slot grid of numbered cells 1…N (N = capacity), each cell: number, team mark/name or "Open"; right list of "Approved, unassigned" teams; waitlist section **[Validate Q-12]**.
- **Variants:** `grid` (≥ `lg`), `list` (below). Assign via a combobox "Slot" select per team plus keyboard-accessible "Assign to slot" button; drag-and-drop is **not** specified (not necessary; accessibility cost).
- **States:** open · assigned · released · conflict (two admins; shows who and when, stale banner) · locked after first match (BR-L1 policy Open) · capacity full.
- **Source:** F8, FR-S1, BR-S1…S3, ES-01…ES-05.

### C14 Room credential panel
- See §7.3 (signature).

### C15 Payment evidence preview and verification actions
- **Anatomy:** proof image (zoomable via C19-lite), payer reference, amount entered vs. expected amount (side by side; mismatch flagged), transaction reference (mono) with duplicate flag if hash/reference exists on another registration (BR-P4), submission history (all attempts), action bar: `Verify payment`, `Reject…` (requires reason), `Waive…` (requires reason).
- **States:** no proof · proof submitted · duplicate flagged · amount mismatch · verified (actor + time) · rejected (reason visible to captain) · waived (reason) · image failed to load (retry) · permission-limited.
- **Privacy:** header reads "Private: visible to you and the submitting captain only". No download of the file to personal devices is presented as a default action. **A11y:** image has alt "Payment proof submitted {date}" and the extracted fields are text beside it.
- **Source:** F6, FR-P1…P4, BR-P1…P4, EP-01…EP-11.

### C16 Data table (sort, filter, pagination, bulk actions)
- **Anatomy:** toolbar (search within table, filter chips, column visibility, density), sticky header, rows, footer (pagination, "Showing 1–25 of 48"), optional bulk-action bar (appears when rows are selected; shows count and permitted actions only).
- **States:** loading (skeleton C28) · empty (C27) · no results (filters active: "No registrations match these filters" + Clear filters) · error (row-level retry + table-level retry) · partial data (cells with "-" and a tooltip reason) · refreshing (stale-data timestamp visible) · selection · stale-version row marker.
- **Responsive:** ≥ `lg` table; `md` table with horizontal scroll inside its own container and sticky first column; `sm` converts each row to a card (C16-card) with the same fields in the same priority order and the same row actions.
- **A11y:** real `<table>` semantics, `scope` on headers, `aria-sort`, selection checkboxes labelled with the row's name, bulk-action count announced.
- **Source:** F7, F24, §24 usability. **Base:** TanStack Table (headless, recommended; not in tech-stack, see §13) + shadcn/ui Table.

### C17 Score breakdown
- See §9.3. **Anatomy:** per-team table: per-player kills, team kills, kill points, placement, placement points, penalties (with reason), match points, running total, rule version, evidence link (policy-permitting). **Source:** §19.6, FR-SC1, F17, F18.

### C18 Leaderboard row and table
- See §9.1–9.2. **Variants:** `match`, `overall`, `compact` (home/preview), `admin` (includes maturity chip and rank-change markers).

### C19 Screenshot viewer (zoom/pan, overlay boxes)
- See §7.4. **Variants:** `full` (S32), `lite` (single-image preview in C15, S30), `crop` (row crop inside C20/C21).
- **Controls:** zoom in/out/fit/100%, reset, rotate **omitted** (evidence immutable; rotation is a view-only transform is **Open**), toggle OCR boxes, toggle contrast boost (**Open**; view-only, never alters stored evidence), image index "2 of 3" for multi-screenshot matches (Q-04), "Original" label with hash short (mono) and upload time.
- **States:** loading · loaded · failed (retry; "The original is still stored") · low-resolution warning ("This image is small; names may be hard to read") · no boxes available (OCR failed → boxes toggle disabled with reason) · multiple evidence versions (superseded labelled).
- **A11y:** every operation reachable by keyboard (`+`, `-`, `0`, arrow keys pan, `B` toggle boxes); image has descriptive alt and an adjacent text table is the accessible equivalent (problem §24 "screenshots have text alternatives where possible"). **Base:** zoom/pan component (see §13).

### C20 Extracted player row (draft row editor)
- See §7.5.

### C21 Candidate chooser
- See §7.6.

### C22 Validation gate panel
- See §7.7.

### C23 Team result panel
- **Purpose:** group rows by team in the review workspace. **Anatomy:** team identity (C09) + resolved players "3/4" + derived team kills (read-only, computed by server) + **placement input** (integer 1…N, required) + status chip + list of unresolved players (names) + "Did not play" marker per absent player (requires reason).
- **States:** complete (4/4 resolved, placement set) · incomplete · placement missing · placement duplicate (error naming the other team) · team absent from screenshot ("No rows matched this team") · DQ'd/withdrawn team (excluded, shown for reference).
- **Source:** F15, §18.2–18.3, BR-X2.

### C24 Result review summary and verification bar
- Sticky bottom bar on S32/S34/S35: left: counts ("41 of 48 rows resolved · 2 flagged · 0 blockers" / "7 blockers"); center: maturity chip; right: `Verify result` (enabled only when the gate is clear, otherwise Locked with reason "7 blockers remain: View list"). **Publish is not on this bar** (separate step, S35).
- **Source:** FR-V2, §18.3–18.4.

### C25 Result-banner preview and export controls **[Validate]**
- **Anatomy:** fixed-aspect preview (1080 × 1350 proportion, **Open**), template selector (theme from organizer), version chip, "Generated from Match {n} snapshot v{k}", `Download PNG`, `Regenerate`. Preview content: tournament name, match number/map, top-N teams and points from the **published** snapshot only. **States:** not generated · generating · ready · failed ("Banner failed. Publication isn't affected.") · superseded (diagonal "Superseded" band over the preview and a link to the new version) · unavailable (result unpublished: control disabled with reason).
- **Source:** F20, FR-B1, §21, ER-06R.

### C26 Timeline / activity / audit row
- **Row anatomy:** time (absolute + relative), actor (name or "System"), action verb phrase, entity link, reason (if any), diff (before → after chips), correlation ID (mono, copy). Append-only look: no edit/delete affordance anywhere.
- **States:** loading older entries · empty ("No events yet") · filtered · permission-limited (tournament admin sees tournament scope only).
- **Source:** FR-AU1, §22.3, F22.

### C27 Empty state
- Structure: 48-px glyph (not illustration), headline stating *why* it's empty, one-line next step, one action. Used for: "No tournaments are live right now", "No registrations yet", "No screenshots for Match 3", "Results for Match 3 haven't been published yet". Empty ≠ error (different glyph, no danger tone).

### C28 Skeleton / loading placeholder
- Shapes mirror the final layout (same heights and column widths) to avoid layout shift; no spinners over content areas > 200 px; spinner only inside buttons and job indicators. **A11y:** region `aria-busy` and "Loading standings" text for screen readers.

### C29 Alert / inline banner
- **Variants:** info, success, warning, danger, blocked; **inline** (in-flow) and **global connection** (z 70). Anatomy: glyph, title (bold), body, optional action. Never auto-dismiss errors/warnings. **A11y:** `role="alert"` for errors, `role="status"` for non-urgent.

### C30 Toast
- Short confirmation of low-stakes actions ("Copied room ID"). Never used for: publication results, verification outcomes, errors that require action, or anything that must persist (those use C29 or the page state). Max 1 visible; text ≤ 80 chars; includes `Undo` only where an undo exists. **A11y:** `role="status"`, focusable action, does not steal focus.

### C31 Confirmation dialog
- Structure: title (verb + object), consequence list, optional **required reason** textarea (publish corrections, waivers, rejections, disqualification, rotation), optional impact summary (C37), buttons: [Cancel][Primary-verb]. Destructive variant uses danger fill and focuses **Cancel** first. **A11y:** focus trap, `aria-labelledby/describedby`, Esc closes unless the action is mid-flight, focus returns to the trigger.
- **Base:** shadcn/ui AlertDialog/Dialog (Radix).

### C32 Drawer / sheet
- Right drawer 480 px (`md`+), 640 px "wide" variant for S25 registration review; bottom/full-screen sheet on `sm`. Header with title + close, scrollable body, sticky footer with actions. **Base:** shadcn/ui Sheet.

### C33 Tooltip and popover
- Tooltips: short text only, 12–14 px, never required to complete a task, also available via keyboard focus. Popovers hold richer content (confidence details, lock reasons) and are click/Enter-activated for touch parity. **Base:** Radix Tooltip/Popover.

### C34 Tabs and segmented control
- Used for S03 sections, S32 views on mobile, leaderboard scope switch. Tab labels include counts when useful ("Flagged (7)"). **A11y:** roving tabindex, arrow keys. **Base:** Radix Tabs.

### C35 Wizard stepper and checklist
- **Variants:** `wizard` (S10, S22: numbered steps, step title, completion tick glyph, "Step 3 of 6"), `checklist` (S09/S13: items with state and owner: "Waiting for you" / "Waiting for organizers").
- **Rules:** any blocked step lists exactly what is missing. Steps are navigable only to completed/current steps; locked later steps show lock + reason.

### C36 OCR job status
- See §7.2.

### C37 Impact preview (diff table)
- **Purpose:** before a correction, rescore, or reopen is confirmed, show **Before → After** for: match rank/points per affected team, overall rank per affected team, podium membership, and counts ("4 teams change rank"). Rows with no change collapse into "8 teams unchanged". Podium changes are flagged with a danger-outline chip "Podium changes".
- **Source:** FR-L2, §22.2 step 3, EL-08, F19, F22, §19.2.

### C38 Podium display
- See §7.9. **Source:** FR-L3, F23.

### C39 Capacity meter
- Segmented bar with N segments (e.g., 12), filled = approved, hatched = pending reviewed, empty = open; text always shown: "9 of 12 slots filled · 2 pending approval". Not a progress animation target. **A11y:** `role="meter"` with `aria-valuetext`.

### C40 Notification menu and item
- Bell + count badge; list item: glyph by event type, title, one-line body (no credentials), time, unread marker (dot **plus** bold title), link target. Footer: "View all" → S43.

### C41 Match lifecycle timeline and live status strip
- See §7.1 (signature: Match operations strip).

### C42 Operations queue card
- **Anatomy:** title ("Payments to verify"), count (number, display face), oldest item age ("oldest 2 h"), primary action "Open queue", subtle state when empty ("All clear"). Shown only for queues that exist in F24: pending registrations, payments to verify, ready to approve, upcoming matches, rows unresolved, results awaiting review, job failures. **A KPI-style count is permitted only because each card opens a worklist** (DR-02).

### C43 Scoring table editor
- **Anatomy:** points-per-kill field; placement-points table (rank 1…N rows with editable points); max rank awarded; optional kill cap; penalty policy select; tie-break order (ordered list with up/down buttons, not drag); disqualification policy radios (a/b/c from §19.4); **sample-match preview** (hypothetical inputs → computed result computed by **server**, labelled "Preview using illustrative inputs"). **States:** draft · valid · invalid (row-level errors) · in-use/frozen (read-only with "Used in Match 1; changes create version {n+1}") · version history.
- **Source:** F17, FR-SC1, §19, BR-X4, EL-05, Q-07, Q-10.

### C44 Version / history diff list
- Small list for rule-set versions, credential versions, and result versions: version number, actor, time, status (Current / Superseded), "View" and "Compare" links. Used in S23, S29, S36, S38.

### C45 Match context bar
- Sticky bar naming the exact context of any match-scoped action: **"Match 3 · Erangel (illustrative) · 15:00 IST · Attempt 1 · Result v1 (Draft)"** plus evidence count. Appears on S29, S30, S32, S34, S35, S36, S38, S40. Purpose: prevent wrong-match entry and wrong-attempt scoring (problem §15 item 5, EM-09, R8). Cannot be edited inline; changing match navigates.

### C46 IGN text (Unicode-safe display)
- Specified in §4.6. **Anatomy:** text (fallback font chain), copy button (raw string), optional "Show characters" toggle, optional "raw" / "detected" caption when used in comparison. **States:** normal · truncated (full on focus/hover) · contains control characters (placeholders shown, warning chip "Contains hidden characters") · contains glyphs not renderable (codepoint view offered) · very long (wraps at graphemes).
- **A11y:** `lang` attribute not forced; the accessible name is the raw text; if screen readers cannot pronounce symbols, the codepoint view is the equivalent.

---

# 7. Signature components

These make the platform recognizably *this* product. Each is tied to the evidence → draft → verified → published ladder.

## 7.1 C41 Match operations strip (match timeline + live status)

- **Purpose:** show, per match, exactly where the match is on the §13 lifecycle and the single **next action**. Not a generic progress bar: it is a labelled, state-machine-accurate sequence, driven by admin-declared statuses (the platform cannot observe the game, problem §11.F).
- **Anatomy (desktop):** a horizontal sequence of nodes: `Scheduled › Ready › In progress › Awaiting evidence › Processing › Under review › Verified › Published`. Current node: solid with label + elapsed time since entering; past nodes: check glyph; future nodes: outline. Side branches shown beneath only when active: `Delayed`, `Rescheduled`, `Interrupted → Restarted (Attempt 2)`, `Cancelled`, `Corrected v2`. Below: **Next action card** (single sentence + primary button), and a **Blockers list** (maximum 3 shown, "+2 more").
- **Data:** status from server; "Next action" text derived by the server/state (e.g., "Upload result screenshot for Match 3", "Resolve 2 unmatched players", "Publish verified results"). The UI never infers state transitions.
- **States:** each node state; *blocked* node (locked with reason); *stale* (data older than the polling interval shows "Last updated 14:42:10"); *offline* (strip dims and shows "Reconnecting…" text).
- **Responsive:** `sm` converts to vertical list showing only past (collapsed count), current, and next two nodes.
- **Distinct because:** it exposes failure branches and the verify/publish split as first-class nodes, with no percentage or ETA unless measured.
- **Source:** F9, F11, §13 match lifecycle, §12.2.

## 7.2 C36 OCR processing status and extraction summary

- **Anatomy:** one card per evidence item (thumbnail + filename + hash short) with the **job lifecycle** (§16.7): `Queued · Running · Succeeded · Partially succeeded · Failed · Timed out · Retrying (n of max) · Cancelled · Superseded`. Under a finished job: an **extraction summary** row, each with label and number:
  `Rows read: 46 · Rows expected: 48 · Resolved by name: 38 · Suggested: 5 · Needs a decision: 3 · Not on roster: 1 · Missing kills: 0` (illustrative numbers).
- **Never shows:** a percentage "complete" bar unless the system reports measurable progress; an overall "accuracy" number; success styling for "Succeeded" when rows need decisions. **"Succeeded"** displays as "Draft ready for review" (processing tone → warning tone if any flags), never as "Verified".
- **Actions:** `Open review` (primary), `Retry extraction` (failed/timed out; shows retries used), `Enter results manually` (always present, D5), `Cancel` (queued/running), `Upload a better screenshot`.
- **Failure presentation:** Failed/TimedOut cards show plain cause when known ("The service didn't respond in time"), what is preserved ("Your screenshot is saved"), and the two next steps (retry, manual entry). `Partially succeeded` shows which images/regions succeeded.
- **Unsupported layout:** "This screenshot doesn't look like a supported result screen. You can enter results manually or upload a different screenshot." (Q-01).
- **Responsive:** cards stack; summary becomes a 2-column definition list.
- **Source:** F13, FR-O1…O3, §16.7, ER-01R, ER-02R, EO-04…EO-07.

## 7.3 C14 Room credential panel

- **Two roles, one component.**
- **Participant view** (S14): states in order:
  1. *Not yet approved / not slotted:* locked state "Room details unlock when your team is approved and has a slot." with a link to S13.
  2. *Before release:* "Room details available at 14:50 IST" (absolute time + countdown text "in 21 min"); no placeholders that suggest the values exist client-side.
  3. *Released:* Room ID and Password in `type.mono-lg`, each with a **Copy** button; **password hidden by default** with `Show` toggle (shoulder-surfing precaution); line "Version 2 · updated 14:47 · this replaces the earlier details" when superseded; "Don't share these outside your team." text (cannot be technically enforced, Q-13).
  4. *Superseded notification:* an alert "Room details changed. Use the details below." and the old version listed as "Superseded", **not copyable**.
  5. *Denied (withdrawn/DQ/ineligible):* "You can't view room details for this match." with a link to S13; reason shown only to the extent permitted.
  6. *Server error:* "We couldn't load room details. Try again." (no stale value shown).
- **Admin view** (S29): confirmation summary row **"Match 3 · Map {name} · 15:00 IST"** (C45) that must be acknowledged before save; fields for Room ID/password (masked after save, reveal requires click), release time, **version history** (C44), **access log** table (who viewed which version, when), and actions `Rotate credentials`, `Edit release time`, `Revoke` (confirm dialog with reason).
- **Not shown anywhere:** public pages, notifications, logs, tooltips, page titles, or browser tab titles.
- **Backend dependency:** all eligibility, timing, and masking decisions are server-side; the UI only renders what the API returns (D10, BR-X3, EX-02).
- **Source:** F10, FR-C1, FR-C2, §15, ES-07, ES-10, P3.

## 7.4 C19 Screenshot-to-roster evidence workspace (viewer half)

- **Purpose:** the left/top half of S32. Shows the original screenshot with **numbered boxes** for each detected row, tied to the row list. Active row's box uses `ocr.box.active`; flagged rows `ocr.box.flagged` (dashed); rows with no box (manual rows) are labelled "Entered manually: no source region".
- **Behavior (static description):** selecting a row in C20 selects its box and scrolls/zooms the viewer to it; selecting a box selects the row. Raw OCR text is shown **next to** the crop, labelled "Detected text (unverified)".
- **Uncertainty:** an OCR field with a separate region (kills digit) shows its own box; if two extraction methods disagree [Validate FR-O4], both values appear with "Conflict" chip and a "Use this" button each.
- **Multi-image matches:** tabs/pager "Image 2 of 3" with row counts per image; rows keep their source image index.

## 7.5 C20 Extracted player row

- **Anatomy (desktop, 48-px min row):** `#` row index · **IGN crop** (cropped image of the source region, 160 × 32) · **Detected text** (C46, labelled unverified) · **Resolved player** (C46 of roster IGN + team mark + "Slot 7") or "-" · **Match status** (C08) · **Kills** (numeric input, shows detected value with source tag `OCR`/`Manual`) · **Flags** (icons with text on focus: Missing kills, Duplicate player, Outside roster, Conflict) · **Actions** (Confirm ✓, Choose…, Ignore…, Edit).
- **Row states:** unflagged-high (T1/T2, shown with "Suggested" ribbon; one-click `Confirm`) · suggested-fuzzy (T4/T5) · ambiguous (thick warning border; row sorted to top) · collision · unreadable (crop shown larger; free-text + roster select) · unknown player · confirmed (success tint on the identity cell only; kills cell remains editable until Verify) · ignored (strikethrough + reason) · "did not play" (kills 0 by explicit marking) · edited (pencil glyph + original OCR value on hover/focus) · invalid kills (danger border + message "Kills must be a whole number 0 or more") · stale-version conflict.
- **Sorting:** flagged rows first (by severity: collision, ambiguous, unknown, unreadable, conflict, missing, fuzzy), then by screenshot order. A "Screenshot order" toggle restores source order (problem §18.2: "rows sorted as in the screenshot; flagged rows sorted/colored first").
- **Bulk accept:** `Accept all unflagged high-confidence rows (31)` button; excludes any row with a flag or approximate roster IGN (§18.2). Shows the count and a confirm dialog listing nothing hidden.
- **Responsive:** below `lg`, each row becomes a stacked card with crop on top, then detected text, candidate, kills input, status; actions as a sticky row footer.
- **Source:** F14, F15, FR-V1, FR-I1, FR-I2, §16.5, §16.6, EO-01…EO-16.

## 7.6 C21 Candidate chooser (identity resolution)

- **Purpose:** resolve one uncertain row against the lobby's approved roster (the ~48-player closed set, A-07).
- **Anatomy:** header: IGN crop + detected text. Body: ranked list of **up to 5** candidates, each = roster IGN (C46), team mark + team name + slot, tier label + pips (C08), "why" line ("Matches after normalizing; 1 character differs: `0` vs `O`"), exactness badge (C07), UID if present (mono). Radio selection (single). Beneath the list: `None of these: map to another player…` (opens roster search limited to the lobby), `Not on roster: mark as outside player…` (reason required), `Can't read it: type the name…`. Footer: `Confirm {IGN}` primary (disabled until a candidate is selected), `Cancel`.
- **Collision case:** when two roster players normalize identically, a banner: "Two roster players have the same normalized name ({IGN A} · {IGN B}). Choose using the screenshot crop above." Both shown with their raw IGNs and **codepoint view open by default**; no default selection.
- **Approximate-IGN candidate:** badge "Roster name is approximate"; selecting it requires an explicit confirmation line "I checked this against the screenshot".
- **Learned alias [Validate FR-I3]:** after confirming, an optional checkbox "Remember this name for this tournament" (default off).
- **Never:** pre-select the top candidate when status is Ambiguous/Collision/Unknown; display "100%" or "Certain".
- **Placement:** inline popover under the row ≥ `lg`; right drawer (C32) `md`; full-screen sheet `sm` (S33).
- **Source:** F14, FR-I1, FR-I2, FR-I3, §17.5–17.7, EO-08…EO-10, EO-16.

## 7.7 C22 Result verification gate

- **Anatomy:** a checklist panel that mirrors §18.3 exactly: (1) every row resolved or ignored with reason, (2) every participating team has a unique valid placement, (3) kills are non-negative integers for resolved players, absent players explicitly marked, (4) sanity warnings (non-blocking, amber), (5) no unresolved ambiguity/conflict flags, (6) reviewer recorded **(and second-admin confirmation if the policy requires it, Open Q-17)**. Each item: pass ✓ / blocker ✕ / warning ! with a count and a **"Go to first"** link into the relevant row/team.
- **Blocker count vs. warning count** are separate numbers. **Override** (e.g., "ignore row") is available only via the row's own action with a reason; there is no global "Verify anyway".
- **State:** `Clear to verify` (success) · `{n} blockers` (danger-outline) · `Verified: locked` (success, dotted).
- **Source:** FR-V2, §18.3, BR-X2, BR-X10.

## 7.8 Match leaderboard and cumulative tournament table (C18)

Specified in §9.1–9.2. Distinct: maturity-aware (Draft/Verified/Published chips on every table instance), tie display, "as of Match N", and correction markers.

## 7.9 C38 Podium display (final standings)

- **Purpose:** announce the three winning teams only after finalization (FR-L3, BR-X6).
- **Anatomy:** ink panel (`bg.ink`), three stepped columns (2nd · 1st · 3rd on desktop; **vertical 1-2-3 list on `sm`**), each: ordinal text ("1st"), rank metal chip, team mark, team name (display-l), total points, kills, matches won (if configured). `brand.volt` rule under 1st. Beneath: "Final standings · Finalized {timestamp} · Ruleset v2" and a link "Full standings" to S05; **tie resolution note** if an admin resolved a podium tie ("Tie broken by: most first-place finishes").
- **States:** not final (the component **does not render**; S06 shows "Final results will appear when the tournament is finalized") · final · final-with-corrections (shows "Corrected {date}: see history") · tournament cancelled (no podium) · reopened (replaced by "Results under review").
- **Source:** F23, FR-L3, §20, EL-08, EL-10, EL-11.

## 7.10 Result banner preview (C25)

See C25. Distinct: always labelled with the snapshot version and drawn only from published data.


---

# 8. Screen catalog

## 8.0 How to read this catalog

Each screen uses one template: **Roles/access · Scope · Purpose · Entry → Exit · Layout · Content & copy · Components · Data and maturity · Actions, validation, permissions · States · Responsive · Accessibility · Source · Motion (IDs only)**.

To avoid repeating identical text, three **family defaults** apply unless a screen states otherwise.

| Family | Responsive default | Accessibility default | State handling default |
|---|---|---|---|
| **Public** (S01–S06) | `xl/lg` 12-col, `md` 8-col, `sm` single column with sticky section tabs | One `<h1>`, landmark regions, tables with captions, rank readable as text, all images have alt | Loading = C28 skeleton; empty = C27; error = C29 danger + retry; offline = global banner with the last-loaded data kept and labelled "Last updated {time}" |
| **Participant** (S09–S16) | Mobile-first single column; `md` two-column (content + status rail) | Form labels, error summary, 44-px targets, status as text | As above + permission-denied = S50; session expired = S53 with draft preserved where the form has local state |
| **Admin** (S20–S42) | `lg`+ sidebar + fluid content; `md` drawer nav and horizontally scrollable tables; `sm` is **supported for monitoring and urgent actions** (approve/verify/publish, review) but data-heavy configuration (S22, S23) is "best on a larger screen" with a notice | Keyboard-operable; focus order follows visual order; shortcuts documented in a `?` popover | Loading = skeleton; stale = "Last updated" text; conflict = stale-version banner; lifecycle-locked actions = Locked with reason |

Seed data in all examples is **illustrative** (§10.5). Times display in IST (assumed; **Open** §16).

## 8.1 Public

### S01 Home / discovery
- **Roles:** Public (all roles). **Scope:** Core (F1).
- **Purpose/task:** understand what's happening and open a tournament.
- **Entry → Exit:** direct/link → S02, S03, S05, S07.
- **Layout:**
```
[Top bar: logo · Tournaments · Sign in]
[Ink hero: H1 + 1-line + [Browse tournaments] + [How to participate]  (volt rule)]
[Live now]            -> up to 3 C10(live)  or C27 "No tournaments are live right now"
[Registration open]   -> C10(upcoming), capacity meter
[Latest official results] -> compact C18 (top 3 of the last published match), "Published Match 3 · {time}"
[How it works: 4 steps: Register team · Pay & get approved · Get your room · See official results]
[Footer]
```
- **Copy (examples):** H1 "Run your college Free Fire MAX tournament on verified results." (organizer-facing headline, **placeholder tagline pending brand**, **Open**); empty live state "No tournaments are live right now. Registration is open for 1 upcoming tournament."
- **Components:** C01-P, C02, C10, C18(compact), C27, C28. **Data:** published/public only; official maturity chip on every result.
- **Actions:** Browse, Open tournament, Sign in. **Permissions:** none; no private data.
- **States:** loading · empty (no live/upcoming) · error · offline (stale content labelled) · results pending ("Match 3 results are being verified": explicit pending, never blank, problem §9.1).
- **Responsive:** hero stacks; cards 1-col on `sm`. **Source:** F1, P1, §9.1, Meera persona (unvalidated). **Motion:** none beyond page entry (see animations.md §6.8).

### S02 Tournament listing
- **Roles:** Public. **Scope:** Core (F1).
- **Layout:** H1 "Tournaments"; segmented control [Live · Upcoming · Past]; filter row (game fixed to Free Fire MAX in Core, status, date); grid of C10.
- **Content:** each card shows capacity meter and entry fee ("₹100 per team", illustrative), registration state chip. Empty tab copy: "No upcoming tournaments yet. Check back soon." with the organizer contact link.
- **States:** loading (card skeletons) · empty per tab · no results for filters · error · archived (read-only badge). **Responsive:** 3-col `xl`, 2-col `md`, 1-col `sm` compact rows.
- **Source:** F1, FR-T3. **Motion:** M01 relevant only to admin creation; list uses standard list pattern.

### S03 Tournament detail (Overview · Rules & scoring · Schedule · Results)
- **Roles:** Public; participants see an extra "Your team" CTA block. **Scope:** Core.
- **Layout:** header (title in display, status chip, C11 lifecycle strip, dates, capacity meter, fee, "Register your team" or state-specific message) + C34 tabs.
  - *Overview:* format, game, eligibility, how to participate (steps), organizer contact, prize note (organizer text, **no platform payout claims**).
  - *Rules & scoring:* organizer rules text (F25) + **configured scoring summary table** ("1 point per kill; placement points: 1st 12 …" illustrative) with ruleset version chip; line "Scores are calculated by the platform from verified results using these rules."
  - *Schedule:* C12 list: Match number, map, time, status (public-safe; **no credentials**).
  - *Results:* list of published matches linking to S04, and overall standings (compact) linking to S05; unpublished matches show "Results pending".
- **CTA states:** registration open · closed ("Registration closed on {date}. Results will appear here.") · full ("All slots are taken. Waitlist **[Validate]**") · not yet open ("Opens {date}") · cancelled · archived (read-only banner) · completed (podium link S06).
- **Data:** published/public; private never. **Source:** F1, F3, F17 (display), F25, §9.1 failure paths.
- **States:** tournament not found → S51; archived renders read-only; loading/err as family default. **Motion:** none specific.

### S04 Match leaderboard (published)
- **Roles:** Public. **Scope:** Core (F18).
- **Layout:** title "Match 3 · {map} · Official results", maturity seal (published `v1` + timestamp), C45-public (read-only context), table (C18 `match`): Rank · Team · Kills · Kill pts · Placement · Placement pts · Penalty · Match pts. Row click (participants) opens their own breakdown (C17) if permitted (§19.6), otherwise public breakdown hides per-player kills when Q-19 says so.
- **Rules:** default sort = rank; ties shown per §9.4. If superseded: banner "This result was corrected on {date}. See current version." Dispute open: "Under review" chip (problem §20 provisional marker).
- **States:** unpublished ("Results for Match 3 are being verified. They'll appear here once published.") · loaded · corrected · disputed · error/loading/offline.
- **Responsive:** `sm` card list with Rank + Team + Match pts primary, detail disclosure for the rest (see §9.1).
- **Source:** F18, FR-L1, §20, P1, EL-04. **Motion:** M07 (admin-triggered; public sees plain update).

### S05 Overall standings (published)
- **Roles:** Public. **Scope:** Core (F19).
- **Layout:** title "Overall standings · as of Match 4 of 6", maturity seal ("Official · snapshot v4"), scope control (Overall · by match), table C18 `overall`: Rank · Team · Match 1…6 points (columns collapse on small screens) · Kills · Total pts. A "Pending" indicator column marker for matches not yet published.
- **Provisional marker:** if any dispute is open: chip "Pending review" + help popover "A result is under review. Standings may change."
- **States:** no matches published ("No official results yet") · partial · corrected snapshot (diff chips ▲▼ for last change) · final (links to S06) · loading/err.
- **Source:** F19, FR-L1, FR-L2, §20, EL-07…EL-09. **Motion:** M08.

### S06 Final podium and winners
- **Roles:** Public. **Scope:** Core (F23). **Layout:** C38 podium; below: final standings table; "Tie-break note"; archive state notice. Not final → "Final results will appear when the tournament is finalized" + link to S05.
- **States:** final · final with correction history · cancelled · reopened ("Results under review") · archived (read-only). **Source:** F23, FR-L3, BR-X6, BR-X7. **Motion:** M10.

## 8.2 Authentication and access

### S07 Sign in / Sign up
- **Roles:** Visitor. **Scope:** Core (F2); **method Open (T-03, A-05, Q-open)**.
- **Layout:** centered card, tabs [Sign in · Create account]. Fields depend on the chosen method; **this spec assumes a credential method with email/phone identity and does not fix OTP vs password**. Profile creation asks display name, contact, optional game ID (problem §9.1).
- **Validation:** inline field errors; rate-limit message "Too many attempts. Try again in {mm:ss}" (EX-xx anti-abuse). **States:** error (wrong credentials, non-enumerating wording "Check your details and try again"), locked, success redirect to intent (e.g., back to registration).
- **A11y:** autocomplete attributes, show-password toggle, no CAPTCHA specified (Open). **Source:** FR-R1, FR-AC1, F2.

### S08 Invitation / join landing **[Open: invites may be unnecessary, ideation F4 risk]**
- If invites are adopted: shows "{Captain} invited you to join {Team} for {Tournament}", the roster requirements, and `Accept & add my IGN` (→ S11). States: expired/invalid invite, already on another team in this tournament (BR-R2 error), signed-out → S07 then return.

## 8.3 Participant (captain / player)

### S09 My tournaments (participant dashboard)
- **Roles:** Player, Captain. **Scope:** Core. **Purpose:** one status panel per registration, answering "what's missing and who must act" (P1, P2).
- **Layout (per registration card):** team mark + name + tournament; **four-dimension status row**: Registration · Payment · Approval · Slot (each a C07 chip, in that fixed order); next-step line ("Payment proof rejected: upload a clearer image"); "Next match" mini (C12); credentials availability line ("Room details at 14:50 IST", no values); links to S13/S14/S15.
- **Empty:** "You haven't joined a tournament yet." + `Browse tournaments`.
- **States:** needs correction (warning, action) · waitlisted · disqualified (danger, reason) · withdrawn · cancelled tournament · loading/err.
- **Source:** F4, F7, F21, §14, Riya persona. **Motion:** none (status updates follow the standard pattern).

### S10 Registration wizard (team → roster → IGNs → payment → review/submit)
- **Roles:** Captain. **Scope:** Core (F4, F5, F6).
- **Layout:** C35 wizard (steps: 1 Team · 2 Players · 3 In-game names · 4 Payment · 5 Review & submit), live **completeness checklist** on the right rail (≥ `md`) or collapsed bar (`sm`): "3 of 4 players added · 2 names exact · payment proof missing".
- **Step content:** 1) team name (uniqueness check, case/Unicode-normalized comparison, BR-R3), team mark upload (optional); 2) players: invite or enter (per **Open** invite decision), substitutes if the tournament allows; 3) per player C05; 4) S12 content inline; 5) read-only summary + eligibility fields (configurable, Q-26) + terms acknowledgement.
- **Validation:** BR-R1 (complete roster with identifiers required to submit), BR-R2 (player already on another registration in this tournament), BR-R3 (duplicate team name). Blocked submit lists exactly what's missing.
- **Actions:** Save draft (always available), Next, Submit registration (primary on step 5). After submit: success page state shows status chips and "What happens next" (checklist owner labels).
- **States:** draft saved · incomplete · duplicate team name · player conflict · registration closed mid-flow (blocking banner; draft preserved read-only) · capacity full → waitlist **[Validate]** · session expired · offline (autosave paused).
- **Responsive:** one step per screen `sm`. **Source:** FR-R2, FR-R4, F4, F5, ER-01…ER-09, ES-02. **Motion:** none specific.

### S11 Roster & IGN management
- **Roles:** Captain (edit), Player (own IGN only). **Scope:** Core.
- **Layout:** list of roster member cards (C09) with C05 inline editing; header shows roster lock state: "Rosters lock when registration closes (Apr 12, 18:00 IST)" **[illustrative]**.
- **After lock:** fields read-only; `Request a change` opens C32 drawer (reason, proposed new IGN/player); request status chip (Pending admin approval). **Policy Open (Q-09).**
- **States:** editable · locked · change request pending/approved/rejected · IGN conflict · player removed (history row).
- **Source:** FR-R3, FR-R5, BR-L1, F4, F5. **Motion:** none.

### S12 Payment instructions and proof submission
- **Roles:** Captain. **Scope:** Core (F6). **No in-platform payment** (A-04).
- **Layout:** instruction card from organizer (UPI details/QR as organizer-supplied image; amount "₹100", **illustrative**), form: payer reference, amount paid, optional transaction ID (mono), proof upload (C06 `payment-proof`), privacy note "Only you and the organizers can see this."
- **Status panel:** `Pending` → `Proof submitted` → `Verified` / `Rejected` (reason displayed, "Upload new proof" action). History list of attempts (time, outcome).
- **States:** no proof · uploading · upload failed (retry) · submitted · duplicate flagged for admin (captain sees neutral "Under review", not the accusation; **Open** wording) · rejected · verified · waived · after close (late proof: admin discretion note, BR-L2).
- **Source:** FR-P1…P3, BR-P1, EP-01…EP-11. **Motion:** none.

### S13 Registration status detail
- **Roles:** Captain, Player. **Layout:** the four independent states as four rows (Registration, Payment, Approval, Slot) each with chip, plain explanation, who acts next, and timestamp; below: roster with exactness badges; messages from organizers (correction requests with reasons); `Withdraw registration` (destructive C31).
- **Rules:** shows "Payment verified" and "Approval pending" distinctly (BR-P2). **States:** every combination of §14 dimensions; disqualified shows reason and consequences per policy (Q-14 Open). **Source:** §14, F7, F8, FR-R6, P2.

### S14 My schedule and room details
- **Roles:** Player/Captain who is a roster member. **Scope:** Core (F9, F10).
- **Layout:** next match C12 (large), C14 participant view; below: all matches list (time, map, status); schedule-change notices (reschedule old→new time).
- **States:** all C14 states (§7.3), match rescheduled (credentials unchanged note), interrupted/restarted (new attempt note), match cancelled, no slot yet.
- **Source:** FR-C1, FR-C2, FR-M1, §15, P3, ES-07, ES-10. **Motion:** M03.

### S15 My results and score breakdown
- **Roles:** Player/Captain. **Layout:** per published match: team rank, points, C17 breakdown with own players' kills, evidence link (policy-dependent, Open) and `Report a problem` (opens C32 drawer, **[Validate]**, Q-16). Overall standings position.
- **States:** match unpublished ("Results pending"), corrected (banner + version), disputed (chip), no matches yet. **Source:** §19.6, F18, F22, FR-D1.

### S16 My disputes **[Validate]**
- **Roles:** Captain (Open Q-16: players too). **Layout:** list of own disputes (match, issue, status, last update); detail shows timeline (C26), admin explanation, outcome. Form (in C32): match select, issue category, description, optional own screenshot (C06). Window text: "You can report a problem until {time}" **(24 h is a temporary assumption)**.
- **States:** window closed (disabled with reason) · submitted · under investigation · upheld/corrected · rejected (explanation) · withdrawn. **Source:** FR-D1, §22.1, Q-16.

## 8.4 Tournament administrator

### S20 Admin overview (queues)
- **Roles:** Tournament admin, Platform admin. **Scope:** Core queues; timing metrics **[Validate]** (F24).
- **Purpose:** show what needs a decision now, not summary vanity numbers.
- **Layout:**
```
[Context bar: Inter-Department Showdown S1 · In progress · as of Match 3]
[Next match strip: C41 for the current/next match with Next action + countdown]
[Queues (C42 x up to 6): Payments to verify · Ready to approve · Rows unresolved · Results awaiting review · Job failures · Upcoming matches]
[Recent activity (C26 compact, 8 rows)]
```
- **Rules:** a queue card is omitted when its feature isn't active for the tournament's lifecycle stage (e.g., "Job failures" before any evidence exists). Counts link to filtered tables.
- **States:** all clear ("Nothing needs your attention. Next match at 15:00.") · many items · error loading a queue (per-card retry, others unaffected) · offline.
- **Responsive:** cards 3-col `lg`, 2-col `md`, 1-col `sm` in priority order. **Source:** F11, F24, P1, P6, ER-10R, ER-11R. **Motion:** none (counts update without rolling).

### S21 Admin tournaments (list and create)
- **Layout:** table (C16): Name · Status · Dates · Registrations · Matches · Actions; `Create tournament` (primary). States: empty ("No tournaments yet. Create your first tournament."), archived filter. **Source:** F3, FR-T1.

### S22 Tournament configuration (wizard)
- **Roles:** Tournament admin. **Scope:** Core (F3, F25).
- **Steps:** 1 Basics (name, game fixed to Free Fire MAX in Core, description, format) · 2 Teams (team size 4, substitutes allowed, capacity, eligibility fields) · 3 Money & registration (fee, payment instructions, window, roster-lock policy) · 4 Matches (count, planned time, map per match) · 5 Scoring (embeds S23) · 6 Rules & policies (rules text, dispute window, visibility, retention note) · 7 Review & publish.
- **Review step:** validation list from FR-T2 (non-overlapping matches, scoring present, capacity ≥ 2, end after start) with each failure linking to its step; `Save draft`, `Publish tournament` (disabled with reasons until valid). After publish: `Open registration` as a separate explicit action (lifecycle Published → RegistrationOpen).
- **States:** draft saved · validation errors · schedule overlap (names the two matches, ES-09) · publish success (M01) · concurrent edit · offline.
- **Responsive:** `sm` read-only summary with "Edit on a larger screen" for steps 4–5. **Source:** FR-T1, FR-T2, F3, F25, §11.A, EL-05.

### S23 Scoring ruleset editor
- **Layout:** C43 + version history (C44) + sample preview. **Banner at top when frozen:** "Rules used in Match 1 are frozen. Editing creates version 3 and requires a rescore." **Rescore flow:** `Rescore with version 3` → C37 impact preview → C31 with reason. **No default official table is presented** (Q-07); a neutral "Start from blank" and "Use organizer's table" only.
- **States:** blank · valid · invalid · frozen · new version draft · rescore preview · error. **Source:** F17, FR-SC1, BR-X4, §19.1–19.4, EL-02, EL-05, EL-06, Q-07, Q-10, Q-14.

### S24 Registration queue
- **Layout:** C16 table: Team · Captain · Roster (n/4 + exactness issues count) · Payment chip · Approval chip · Slot chip · Submitted · Flags (Duplicate proof, Amount mismatch, Approximate IGNs, Collision). Filters: "Roster incomplete", "Payment pending", "Ready to approve", "Needs correction". Row action opens S25.
- **Bulk actions:** none that approve (approval is individual and gated; **DR-08**); allowed bulk: "Send reminder" **[Validate]**.
- **States:** empty · no results · conflict · loading. **Source:** F6, F7, P1, P2, §12.1 step 2.

### S25 Registration review (C32 wide drawer or full page)
- **Layout:** left: roster with IGNs/exactness/collision warnings (C09 + C05 read-only + `Confirm IGN` for admin); center: payment (C15); right: **approval gate** panel mirroring §14.2: Roster complete ✓ · Payment verified ✓/✕ · Eligibility ✓ · Capacity ✓. Actions: `Approve` (disabled until the gate passes; Locked with the failing reasons), `Request correction…` (reason, visible to captain), `Reject…`, `Waitlist` **[Validate]**, `Disqualify…` (C31 danger, reason, policy text), `Waive payment…` (reason).
- **Conflict state:** if another admin acted: stale banner. **Waiver** is the **only** way to approve without verified payment, always with a reason (BR-A2).
- **Source:** FR-A1, FR-P3, FR-S1, BR-A1, BR-A2, BR-P1…P4, F6, F7, EP-06, EP-07, ES-04. **Motion:** none for approval (frequent).

### S26 Slots and participants
- **Layout:** C39 capacity meter + C13 slot assignment (grid/list) + participants table (Slot · Team · Players · Status) + waitlist section **[Validate Q-12]**.
- **States:** capacity full · slot released (withdrawal) · concurrent assignment conflict (ES-01) · locked after first match · empty ("No approved teams yet"). **Source:** F8, FR-S1, BR-S1…S3, ES-01…ES-05. **Motion:** M02.

### S27 Match schedule management
- **Layout:** C16 list of C12 rows + `Add match`. Row actions: Edit, Reschedule (shows old → new, notifies teams), Cancel (reason). Overlap validation. Participants column shows "12 teams".
- **States:** empty · overlap error · rescheduled · cancelled · attempt chips. **Source:** F9, FR-M1, FR-M2, ES-06, ES-08, ES-09.

### S28 Match operations board
- **Roles:** Tournament admin. **Scope:** Core (F11). **The time-critical screen.**
- **Layout:**
```
[C45 Context: Match 3 · {map} · 15:00 IST · Attempt 1]   [Countdown to next: T–08:30]
[C41 strip with Next action card:  "Upload result screenshot for Match 3"  [Upload evidence]]
[Left col: Checklist                         | Right col: Evidence & job status]
[ ✓ 12/12 teams slotted                       | C36 cards per image (or "No screenshot yet")
  ✓ Credentials set (v1) · released 14:50     |
  ○ Evidence received                         | Results status: Draft · not official
  ○ Draft reviewed                            |
  ○ Published                                 |
[Next match panel: Match 4 · credentials not set  [Prepare Match 4]]
```
- **Content rule:** the board shows only the next action and blockers (F11 risk: overloaded board). No charts.
- **Actions:** status transitions (Mark in progress / Mark ended / Mark interrupted… each Locked if invalid per §13), `Upload evidence` (S30), `Open review` (S32), `Enter results manually` (S34), `Prepare next match`.
- **States:** every match status (§4.5) · OCR down banner ("Extraction is unavailable. You can enter results manually.") · delayed · interrupted/restarted · blockers present · offline.
- **Source:** F9–F11, FR-M2, §12.2, P6, ER-10R, ER-11R. **Motion:** none for status changes beyond M04/M06/M07 where relevant.

### S29 Room credentials (admin)
- **Layout:** C45 + C14 admin view (§7.3) + C44 version history + access log (C16). **Wrong-match guard:** the confirmation summary row must be explicitly checked ("I confirm: Match 3 · {map} · 15:00") before `Save credentials`.
- **States:** not set · set · released · superseded · revoked · rotation confirm (C31 with reason + notifies eligible users) · leaked-credentials runbook link · offline. **Source:** F10, FR-C1, §15, ES-07, ES-10, EX-02, Q-13. **Motion:** M03 relates to participant release.

### S30 Evidence upload and evidence list
- **Layout:** C45 locked match context, C06 `match-screenshot`, guidelines panel (F25: "Capture the full results screen. Include all rows."), list of evidence items: thumbnail, filename, hash short, uploader, time, status chips (Uploaded · Extraction queued/…), `Replace` (creates new version, supersedes earlier job), `Re-link to another match…` (audited, reason).
- **Validation states:** unsupported type · too large · not decodable · low resolution warning · **duplicate by hash** ("Already uploaded for Match 3 at 15:28: open it") · wrong-match warning if roster mismatch is detected server-side (R8).
- **Uploader role:** only this screen and S27 (read-only). **Source:** F12, FR-E1, FR-E2, BR-X8, BR-X9, EM-06…EM-10, EO-05, EX-09. **Motion:** none specific; progress per C06 standard.

### S31 Results and processing queue
- **Layout:** C16 table of matches with results work: Match · Status chip · Evidence count · Job status (C36 compact) · Rows needing decisions · Maturity chip · Last editor · `Open`. Filter: "Needs my attention".
- **States:** empty · job failures highlighted · queue backlog ("Extraction is running slower than usual. Manual entry is available.", **no ETA unless measured**, ER-10R). **Source:** F13, FR-O1, §16.7, ER-10R.

### S32 Result review workspace **(critical)**
- **Roles:** Tournament admin, Platform admin (audited). **Scope:** Core (F15), identity parts Validate (F14).
- **Layout (≥ `lg`):**
```
[C45 Context bar · Draft v1 · Autosaved 15:31:08 · [Screenshots 2/2]     [Shortcuts ?]]
+-------------------------------+---------------------------------------------+
| C19 Screenshot viewer         | Tabs: [All rows 46] [Flagged 7] [Teams]      |
|  zoom/pan, numbered OCR boxes | C20 rows (flagged first), per row: crop ·    |
|  "Original · sha 3fa9…"       | detected · resolved player · status · kills  |
|                               | · actions                                    |
|  (active row's box highlighted)| C23 team panels (tab "Teams")              |
+-------------------------------+---------------------------------------------+
[C24 sticky bar: 41 of 48 rows resolved · 7 flagged · 3 blockers  | C22 gate ▸ | [Verify result] (locked)]
```
- **Content rules:** column header text "Detected text (unverified)" and "Resolved player (roster)". Team column is **derived** from the resolved Roster Entry and is **read-only**; to fix a roster mapping the admin uses `Edit roster mapping…` (separate audited action, flags the registration for later roster review, §18.2).
- **Keyboard shortcuts (documented in `?`):** `J/K` next/prev row · `Enter` confirm suggested · `E` edit kills · `C` open candidate chooser · `I` ignore row (reason) · `B` toggle boxes · `+/-/0` zoom · `Ctrl+Z` undo last edit (client-side within the draft; **Open**). Shortcuts never bypass confirmations for destructive actions.
- **Concurrency:** autosave with version token; stale write rejected → banner with `Refresh` and `Compare my edits`.
- **Manual option:** `Enter results manually` in the header menu (S34) preserving any rows already corrected.
- **States:** processing (rows area shows C36 "Extraction is running… You can start entering rows manually") · partially succeeded (rows from successful regions only + banner) · failed/timed out (empty table with C36 failure + manual entry) · draft ready (flags) · no extracted text ("No text was found in this image. Check that it's the results screen.") · unsupported layout · multiple evidence versions · gate clear · verified (locked, rows read-only, `Reopen for review` available if unpublished, BR) · conflict · permission-limited · offline (edits queue locally: **Open**; default: block with "Autosave paused").
- **Responsive:** `md` viewer on top collapsible (50% height) with the row list below; `sm` **tabbed**: [Screenshot] [Rows] [Teams] with the active row's crop always shown at the top of the Rows tab so the original evidence is visible beside each editable field; candidate chooser = full-screen sheet (S33).
- **A11y:** focus order viewer → row list → bar; live region announces "Row 12 confirmed as Ghost_47, Null Pointers"; each field has visible label; table equivalent for the boxes; the verify button's Locked reason is reachable by keyboard.
- **Source:** F13–F15, FR-V1, FR-V2, FR-I1, FR-I2, §16.5, §16.6, §18.2, §18.3, BR-X2, BR-X10, EO-*, EX-06, EX-07. **Motion:** M04, M05, M06.

### S33 Identity resolution (sheet / drawer)
- C21 presented as a full-screen sheet (`sm`) / drawer (`md`). Includes the screenshot crop at 2× display and the codepoint view for collisions. Exit returns to the same row in S32. **Source:** F14, §17.

### S34 Manual result entry (fallback)
- **Roles:** Tournament admin. **Scope:** Core (F16, built first per ideation §10).
- **Layout:** C45 + reason field "Why manual entry? (OCR unavailable / unsupported layout / entered to correct)" required; per-team C23 panels **pre-populated with the lobby's roster** (4 players each) with empty kills inputs and placement input; optional evidence viewer (C19 lite) if evidence exists; C24 bar. Option "Team totals only" **[Open: per-player data may be unavailable]** with a visible note "Per-player kills won't be recorded".
- **States:** empty sheet · partially filled (autosaved) · invalid kills · duplicate placement · gate clear/blocked · conflict. **Source:** F16, D5, §29.1, ER-01R, EM-06, ER-11R. **Motion:** none.

### S35 Verify and publish
- **Layout:** C45 + **Result summary**: ranked match table (C18 `admin`, maturity chip per state), "Calculated from verified data using Ruleset v2", C17 expandable per team, verification metadata (reviewer, time, evidence links), impact on overall standings preview (C37 compact: "Overall ranks change for 5 teams"). Steps are shown as two **separate** panels:
  1. **Verify** (if not yet verified): gate C22 + `Verify result`.
  2. **Publish** (enabled only when Verified): `Publish official results` → C31 listing consequences: public pages update, notifications sent, banner can be generated, overall standings recomputed.
- **Second-admin option (Open Q-17):** if enabled, a "Awaiting second approval by {admin}" state with Locked publish.
- **States:** gate blocked · verified (locked) · publishing (button loading; server pending) · **publish failed** (danger alert; nothing public changed; `Try again`) · published (success, seal "Official · v1 · 15:34", links to S36/S37/S40) · stale · permission-limited · offline.
- **Never:** show "Published" until the server confirms. **Source:** F15, F17–F19, FR-V2, FR-SC1, FR-L1, §18.4, BR-X1, BR-X5, EL-04. **Motion:** M06, M07, M08.

### S36 Match leaderboard (admin: draft · verified · published views)
- **Layout:** version selector (C44), maturity banner (§4.5), same table as S04 with admin columns (derived team kills, rule version, per-player expansion), banner tab link (S40).
- **States:** draft (hatched) · verified · published · corrected v2 (diff) · voided · superseded. **Source:** F18, FR-L1, FR-L2, §20.

### S37 Overall standings (admin) and correction entry
- **Layout:** snapshot selector (C44), table with per-match columns and rank-change markers vs previous snapshot, "pending" markers for unpublished matches, penalties list (+ `Add penalty…` with reason), `Rescore…` entry (S23), and `Correct a published result…` entry (S38). Snapshot history with diff.
- **Tie display:** tied teams share the rank number, show "T-3", and show the applied tie-break step (see §9.4); unresolved podium ties are a blocker on S42.
- **Source:** F17, F19, FR-L1, FR-L2, FR-SC2, §19.3, §19.4, §20.

### S38 Correction workflow (published result)
- **Layout:** C45 (shows "Correcting Result v1 → draft v2"), reason (required), edit surface = S32/S34 reused on a copy of the published data with "Original v1" side-by-side; then C37 impact preview → C31 "Publish correction" with reason echo. **Podium change** requires an additional typed confirmation line "I understand the podium changes" (EL-08).
- **Post-publish:** notifications to affected teams (FR-N1), banner regeneration prompt (S40), audit entry link.
- **States:** draft correction · impact preview · publishing · failed · published v2 (old marked Superseded, never deleted, BR-X5) · dispute-linked (shows dispute) · offline.
- **Source:** FR-L2, FR-AU1, FR-D1, §22.2, BR-X5, EL-07, EL-08, EX-05, EX-10, D11. **Motion:** M09.

### S39 Disputes queue **[Validate]**
- **Layout:** C16: Match · Team · Issue · Opened · Window · Status · Assignee; detail drawer: claim, captain's evidence, original evidence, compare drafts, response editor, outcomes (Uphold → S38, Reject with explanation). **Conflict-of-interest guard:** if the admin's own team is involved: Locked "You can't resolve a dispute involving your own team" (Open Q-17). **Source:** FR-D1, §22.1, F22.

### S40 Result banner preview and export **[Validate]**
- **Layout:** C45 + C25. Gated on published status. **States:** per C25. **Source:** F20, FR-B1, §21, ER-06R. **Motion:** M11.

### S41 Audit history
- **Layout:** C26 timeline + filters (actor, entity, action type, date); detail drawer with before/after diff and correlation ID. Export: **Open**. **States:** empty, filtered, loading older, tournament-scoped vs all (platform admin). **Source:** FR-AU1, §22.3, P8, D11.

### S42 Tournament finalization
- **Layout:** **Finalization checklist** mapped to BR-X6: all matches Completed/Cancelled ✓/✕, no results Under review/Unresolved ✓/✕, no blocking disputes ✓/✕, podium ties resolved ✓/✕ (tie-resolution form with required reason). `Finalize tournament` (primary, C31 listing consequences: podium becomes public, tournament becomes read-only after archive). Then `Archive tournament` as a separate action.
- **States:** blocked (each failing item links to its screen) · ready · finalizing · finalized · archived · failed. **Source:** FR-L3, FR-T5, BR-X6, BR-X7, F23, EL-10, EL-11. **Motion:** M10.

## 8.5 Shared and platform

### S43 Notifications
- **Layout:** list (C40 items), filter [All · Unread], mark-read, empty ("You're all caught up"). Event types per FR-N1. No credentials in text. **External channels [Validate Q-23].**

### S44 Profile and account
- Profile fields (display name, contact, game identifiers), theme toggle (Light/Dark/System), sign out, **data request note** (Open, Q-15). **Source:** FR-R1, F2.

### S45 Organizers and access **[Open: Q-20]**
- Platform-admin only. C16 of organizers/role grants (user, role, tournament scope, granted by/when), `Grant organizer access` / `Revoke` with reason; global defaults (retention, upload limits) read/write **only if** Q-20 resolves to a separate platform admin. If merged into a super-admin, this screen is deferred. **Source:** §9, Q-20, FR-AC1.

### S46 Reopen completed tournament (dialog flow)
- C31 destructive-style dialog reachable from S42/S06 admin view: reason (required), impact statement (podium withdrawn from public, status returns to Finalizing), second confirmation. **Platform admin only (Q-18 Open).** Shown as a dialog, not a page, because it is rare and has no navigable content. **Source:** §13, BR-X7, Q-18.

## 8.6 System and error pages

| ID | Screen | Static content | Actions |
|---|---|---|---|
| S50 | Access denied (403) | "You don't have access to this page." + one sentence on which role is required (never reveals whether the object exists when that would leak data) | Go to My tournaments / Home; Sign in as another user |
| S51 | Not found (404) | "We couldn't find that page." plus for tournaments: "This tournament may have been archived or removed." | Search-free: link to Tournaments |
| S52 | Server error (500) | "Something went wrong on our side. Your data wasn't changed." **Only when the failure guarantees that**; otherwise "We couldn't confirm your last action. Check {screen} before trying again." + correlation ID (mono, copy) | Retry; Go back; Contact organizer |
| S53 | Session expired | "Your session ended. Sign in to continue." Shows what was in progress (e.g., "Review of Match 3 is saved as a draft") | Sign in (returns to the page) |
| S54 | Maintenance | "Scheduled maintenance until {time}. Public results are still available." **only if** public pages are actually served read-only (§29.7) | Link to public standings; status contact |

**Other system states (not separate pages):** offline = global banner (§5.4); upload failure = C06 states; OCR failure and unsupported layout = C36; empty/loading = C27/C28; stale version = inline banner.

### Screens deliberately not made separate pages

| Candidate | Decision | Why |
|---|---|---|
| Payment review | Drawer/column in S25 | Needs roster + approval context side-by-side; avoids context loss (P2) |
| Dispute submission | C32 drawer from S15 | Short form tied to a specific match |
| Reopen tournament | Dialog S46 | Rare, no navigable content |
| Banner export | Page S40 plus tab link from S36 | Needs preview space; Validate scope |
| Roster change request | C32 drawer from S11 | Small form tied to current roster |
| Command palette / global search | Not included | Closed small data sets; not justified |
| Player public profile/lifetime stats | **Later** | problem §8.3; Q-19 unresolved; no screen designed |
| Platform-admin dashboard | **Open** | Q-20 |


---

# 9. Data visualization and scores

Standings are **tables first** (tech-stack §4.1: "Standings are tables first; charts are optional"). Charts are optional and always have an adjacent table or data summary.

## 9.1 Match leaderboard (C18 `match`)

| # | Column | Align | Format | Notes |
|---|---|---|---|---|
| 1 | Rank | Left/narrow | `1`…`12`, ties `T-3` | Plus podium metal chip only on S06; number always present |
| 2 | Team | Left | C09 team identity | Slot chip optional on admin |
| 3 | Kills | Right | integer | Team kills (sum of verified player kills) |
| 4 | Kill pts | Right | integer or 1 decimal if the ruleset uses fractions | `Kills × points per kill` |
| 5 | Placement | Right | `#4` | Team placement in the match |
| 6 | Placement pts | Right | integer | From configured table |
| 7 | Penalty | Right | `−2` with info glyph → reason popover | Hidden column if no penalties in this match |
| 8 | **Match pts** | Right, bold, display numerals | integer | Sort key |

- **Default sort:** by rank (match points desc, then the configured within-match ordering, e.g., placement then kills; Q-10). Server supplies rank; client never recomputes (D8).
- **Expansion:** row disclosure shows per-player kills (only where policy permits, Q-19) and rule version.
- **Mobile (`sm`):** card per team: Rank · Team · Match pts as the primary line, with Kills · Placement · Penalty as secondary text, and "Details" disclosure for kill pts / placement pts.
- **Maturity:** chip above the table (Draft / Verified / Published) per §4.5; Draft tables use the hatch band and watermark text "Draft · not official" and are **admin-only**.

## 9.2 Overall tournament leaderboard (C18 `overall`)

- Columns: Rank · Team · **per-match points (M1…M6)** · Penalties · Kills · Wins (first places, if tie-break uses it) · **Total pts**. Unpublished matches show `–` with a "Pending" caption in the column header, never `0`.
- "As of Match 4 of 6" in the title; last-snapshot rank change markers `▲2` `▼1` `–` with text alternative ("up 2 places since Match 3"). Markers refer to the **previous snapshot**, labelled in the legend.
- Default sort: rank (server-computed using the tie-break list, §19.3). A user-sortable per-column sort is allowed on public pages for reading only and shows "Sorted by Kills. Official rank is unchanged." when different from rank.
- **Mobile:** sticky Rank + Team; points columns scroll horizontally inside the table container or collapse into "Total + last match" with a disclosure of the per-match list.

## 9.3 Score breakdown (C17)

Per team: a table of **players × kills** (with IGN, C46), then a **calculation list**:
`Team kills 9 → Kill points 9 (1 pt per kill, illustrative) · Placement 1st → 12 pts (illustrative table) · Penalty 0 · Match points 21 · Running total 63 · Ruleset v2`.
The arithmetic is **displayed from server values**, not computed in the browser. Evidence link (permission-dependent). Corrected results show the previous value struck through beside the new.

## 9.4 Ties

Tied rank cells show `T-3` and a popover "Tied on 63 points. Ordered by: most first-place finishes (rule 2)". The applied tie-break step is named; an admin-decided tie (rule 5) shows "Decided by organizer. See reason" linking to the audit entry. A tie in a podium position blocks S42 until resolved.

## 9.5 Scores, deltas, corrections

- Correction diffs: `Before → After` with ▲/▼ and word deltas; corrected rows carry a `v2` chip; previous value struck through; history link to S41/S36.
- Verified-but-unpublished results never appear on any public or participant table (BR-X1).
- **"Under review" banner** on public tables if a dispute is open (problem §20).

## 9.6 Status summaries and OCR summaries (admin)

- Match/tournament status summaries are **lists of labelled counts** linking to filtered tables, not donut charts. Allowed chart uses (optional, **Validate**): a bar showing rows by match status in the extraction summary (labelled, with numbers), and processing duration per match (admin timing, F24 **Validate**) as a table with min/median/max, not a speedometer.
- OCR confidence/status summary: counts per status (Suggested / Needs decision / Not on roster / Missing kills) as in C36. **No overall accuracy %** shown (D14, §30).
- Processing duration/error reporting: "Upload → draft ready: 00:48" shown as an **observed** duration for that job only; labelled "this job", not a target or SLA.

## 9.7 Chart rules (if charts are added)

1. Every chart has an adjacent data table or `<details>` data view.
2. Series use distinct marker shapes, direct labels, and dash patterns, not just color (§4.5 chart tokens).
3. No 3D, no dual axes, no radial gauges.
4. Axis labels and units always visible; y-axis starts at 0 for bars.
5. A chart never presents unpublished data on public pages.

---

# 10. Content design and seed data

## 10.1 Voice and tone

| Context | Voice | Example |
|---|---|---|
| Public/participant | Clear, friendly, short; competitive but not hype-y; explains what happens next | "Payment verified. Waiting for organizers to approve your team." |
| Admin | Direct, operational, specific about the object and consequence; no cheerleading | "3 blockers remain: 2 rows need a player, 1 team has no placement." |
| Errors | Say what happened, what is safe, what to do | "We couldn't load room details. Nothing was shown or changed. Try again." |

Never use: "Oops", exclamation-mark success, "Something went wrong" without next step, jargon like "OCR job" in participant copy (admin may see "Extraction").

## 10.2 Action verb style

Verb + object, sentence case: `Verify payment`, `Approve team`, `Assign slot`, `Upload screenshot`, `Verify result`, `Publish official results`, `Publish correction`, `Rotate credentials`, `Request a change`, `Report a problem`. Avoid "Submit" alone, "OK", "Yes".

## 10.3 Status vocabulary (single source)

| Domain | Labels (exact) |
|---|---|
| Tournament | Draft · Published · Registration open · Registration closed · In progress · Finalizing · Completed · Archived · Cancelled |
| Registration | Draft · Submitted · Needs correction · Withdrawn · Cancelled |
| Payment | Not required · Pending · Proof submitted · Verified · Rejected · Waived |
| Approval | Unreviewed · Approved · Rejected · Waitlisted · Disqualified |
| Slot | Unassigned · Assigned · Released |
| Match | Scheduled · Ready · In progress · Awaiting evidence · Processing · Under review · Verified · Published · Corrected · Delayed · Rescheduled · Interrupted · Restarted · Cancelled |
| Extraction job (admin) | Queued · Running · Draft ready · Partially read · Failed · Timed out · Retrying · Cancelled · Superseded (**"Succeeded" is displayed as "Draft ready"**) |
| Identity row | Unmatched · Suggested · Confirmed · Overridden · Rejected · Ambiguous · Roster collision · Unreadable · Not on roster · Ignored |
| Result | Draft · In review · Verified · Published · Superseded · Voided |
| Room details | Not set · Set · Released · Superseded · Revoked |
| Dispute | Open · Under investigation · Upheld · Rejected · Withdrawn · Closed |

Participant-facing copy uses the same labels; no synonyms ("Accepted", "Done", "Live") are introduced.

## 10.4 Dates, times, numbers, credentials

- **Time zone:** show an explicit zone suffix ("15:00 IST") on every time; tournament time zone is configured per tournament (**assumption: IST**, Open). Absolute time first, relative second ("15:00 IST · in 8 min"). 24-hour clock in admin; 12-hour with am/pm allowed in public. Dates `12 Apr 2026`.
- **Scores/kills/ranks:** §4.6 formatting. **UID:** mono, grouped as received (no re-formatting), copyable. **Room ID/password:** mono, never truncated, never auto-linked, no zero-width characters, `O/0` and `l/1` disambiguation via the mono face's slashed zero (verify in the chosen font).
- **Unicode IGNs:** raw display via C46; copy yields the raw string; normalized forms visible only in admin codepoint/evidence views.
- **Privacy wording:** payment: "Private. Only you and the organizers can see this." Credentials: "For your team only. Don't share these." Evidence in admin: "Contains other players' names."

## 10.5 Seed data (illustrative; not real participants or measured results)

> Every name, number, map, and score below is **made up for mockups**. The platform has no official Free Fire MAX point table in the source documents; the placement table here is **hypothetical** and must be replaced by organizer-supplied values (Q-07).

**Tournaments (three states to cover the lifecycle):**

| Tournament | State | Notes |
|---|---|---|
| **Inter-Department Showdown S1** | In progress (after Match 3 of 6) | 12 teams × 4 players; entry ₹100/team; 6 matches; maps named "Map A–C" (placeholder; real map names to be organizer-supplied) |
| **Freshers' Cup** | Registration open | 9 of 12 slots filled; 2 teams pending approval; roster lock at close |
| **Winter Cup (previous year)** | Completed → Archived | Podium and final standings for S06 |

**Teams (12):** Null Pointers · Kernel Panic · Last Zone Standing · Drift Kings · Signal Lost · Cache Miss · Deadlock · Overclocked · Bit Reapers · Stack Smashers · Voltage Lab · Hot Fix.

**Players and IGN cases (Null Pointers, Slot 7, captain Riya; others invented):**

| Display name | Roster IGN as submitted (raw) | Exactness | Purpose |
|---|---|---|---|
| Riya | `Ghost_47` | Exact | Plain ASCII, T1 |
| Kabir | `Kabir FF` | **Approximate** (real in-game name uses decorative characters he can't type) | Approximate IGN case; any match capped at "Needs confirmation" |
| Sameer | `𝓢𝓪𝓶𝓮𝓮𝓻` | Exact | Math-script alphanumerics → T2 after normalizing |
| Tanvi | `ＴａｎｖｉＸ` | Exact | Full-width → T2 |

Other illustrative IGNs on other teams: `ᴋɪʟʟᴢᴏɴᴇ` (small-capital lookalikes; may not fold under normalization, Q-28) on **Drift Kings**; `R4ven` (Kernel Panic) vs `Raven` (Signal Lost) as a **near-collision**; `Ghost_41` (Drift Kings) as the competing candidate for the ambiguity below.

**OCR candidate ambiguity (Match 3 draft, row 17):** detected text `Gh0st_47` (zero for O) → candidates: **Ghost_47 · Null Pointers · Slot 7 · "Look-alike characters" (T3)** and **Ghost_41 · Drift Kings · Slot 4 · "Close match" (T4)**. Row status "Ambiguous: 2 candidates", **no preselection**; admin compares the crop and chooses.

**Unrecognized player (row 31):** detected `Zer0Cool` → no candidate above threshold → "Not on roster". Admin options: map to roster player, mark as outside player (reason: "Substitute not registered"), or hold the match.

**Unreadable row (row 22):** crop shows heavy ornament; detected text `▯▯▯ᴠ▯▯`; status Unreadable; admin selects from the lobby roster.

**Missing kills (row 40):** kills digit region unreadable → kills field empty, flagged, blocks verification.

**Match 3 scenario (the S32 score-review scenario):** 46 rows read of 48 expected; 38 resolved by name (T1/T2 suggested), 5 suggested fuzzy, 3 need decisions (1 ambiguous, 1 unreadable, 1 not on roster), 1 missing kills, 2 roster players absent from the screenshot (listed; admin marks "did not play" or uploads another screenshot). Team placements are entered by the admin for any team whose placement isn't established from the screenshot (placement may not be on the same screen, Q-03).

**Hypothetical scoring (illustrative):** 1 point per kill; placement points 1st 12 · 2nd 9 · 3rd 8 · 4th 7 · 5th 6 · 6th 5 · 7th 4 · 8th 3 · 9th 2 · 10th 1 · 11th–12th 0; tie-break: total points → first-place finishes → total kills → most recent match placement → admin decision. Example: Null Pointers, 9 kills + 1st → 9 + 12 = **21** (same arithmetic shape as problem §19.6; values hypothetical).

**Score-correction scenario:** After Match 2 was published, Kabir's kills were corrected from 3 to 5 following a dispute by the captain of Drift Kings; impact preview: Null Pointers +2 match points → overall rank 4th → 3rd; Overclocked 3rd → 4th; podium membership unchanged (only order within the top 4 shifts; if it changed the podium, the extra confirmation applies).

---

# 11. State matrix and edge cases

## 11.1 Coverage matrix

Legend: ● designed on this screen · ○ not applicable (reason in §11.3) · ◐ partially (see notes)
Columns: **E** initial/empty · **L** loading · **N** no results · **S** success · **V** validation error · **NW** network error · **D** access denied · **ST** stale/refreshed · **LK** disabled by lifecycle/role/status · **P** partial data · **CF** conflict/concurrent edit · **UP** upload in progress/failed/retryable · **OC** OCR queued/processing/done/failed/review · **ID** unmatched/ambiguous player · **ST+** missing/invalid statistic · **R** result draft/verified/published/corrected/disputed · **OFF** offline

| Screen | E | L | N | S | V | NW | D | ST | LK | P | CF | UP | OC | ID | ST+ | R | OFF |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 Home | ● | ● | ○ | ○ | ○ | ● | ○ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ◐ | ● |
| S02 Listing | ● | ● | ● | ○ | ○ | ● | ○ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| S03 Detail | ● | ● | ○ | ○ | ○ | ● | ○ | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ◐ | ● |
| S04 Match LB | ● | ● | ○ | ● | ○ | ● | ○ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ● | ● |
| S05 Overall | ● | ● | ○ | ● | ○ | ● | ○ | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ● | ● |
| S06 Podium | ● | ● | ○ | ● | ○ | ● | ○ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ● | ● |
| S07 Auth | ○ | ● | ○ | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| S09 My tournaments | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ◐ | ● |
| S10 Wizard | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ◐ | ○ | ○ | ● |
| S11 Roster/IGN | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ | ◐ | ○ | ○ | ● |
| S12 Payment | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ● |
| S13 Reg. status | ○ | ● | ○ | ● | ○ | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| S14 Schedule/room | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| S15 My results | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ○ | ◐ | ○ | ○ | ○ | ● | ● |
| S16 Disputes | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ○ | ◐ | ○ | ○ | ○ | ● | ● |
| S20 Overview | ● | ● | ○ | ○ | ○ | ● | ● | ● | ○ | ● | ○ | ○ | ◐ | ○ | ○ | ◐ | ● |
| S21 Admin tournaments | ● | ● | ● | ● | ○ | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ● |
| S22 Config wizard | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ | ○ | ○ | ○ | ● |
| S23 Scoring | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ◐ | ● |
| S24 Reg. queue | ● | ● | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ● |
| S25 Reg. review | ○ | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ | ◐ | ○ | ○ | ● |
| S26 Slots | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ● |
| S27 Matches | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ◐ | ● |
| S28 Operations | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● | ● | ◐ | ● | ◐ | ◐ | ● | ● |
| S29 Credentials | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ● |
| S30 Evidence | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ | ○ | ○ | ● |
| S31 Processing queue | ● | ● | ● | ● | ○ | ● | ● | ● | ○ | ● | ○ | ◐ | ● | ◐ | ◐ | ◐ | ● |
| S32 Review | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ● | ● | ● | ● | ● |
| S33 Identity sheet | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ● | ○ | ○ | ● |
| S34 Manual entry | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ | ◐ | ● | ● | ● |
| S35 Verify/publish | ○ | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ◐ | ● | ● | ● |
| S36 Admin match LB | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ● | ● |
| S37 Admin standings | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ● |
| S38 Correction | ○ | ● | ○ | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ○ | ◐ | ● | ● | ● |
| S39 Disputes queue | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ○ | ○ | ○ | ● | ● |
| S40 Banner | ● | ● | ○ | ● | ○ | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ● | ● |
| S41 Audit | ● | ● | ● | ● | ○ | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ◐ | ● |
| S42 Finalization | ○ | ● | ○ | ● | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ● | ● |
| S43 Notifications | ● | ● | ○ | ● | ○ | ● | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| S44 Profile | ○ | ● | ○ | ● | ● | ● | ● | ○ | ○ | ○ | ● | ○ | ○ | ○ | ○ | ○ | ● |
| S45 Organizers | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ | ● |
| S50–S54 | single-state pages; see §8.6 | | | | | | | | | | | | | | | | |

## 11.2 State behaviors (what the user sees, what stays available, what is blocked, recovery)

| State | User sees | Still available | Blocked | Recovery |
|---|---|---|---|---|
| **Initial/empty** | C27 with reason + one action | Navigation, create/browse | Dependent actions (shown Locked) | Perform the stated first action |
| **Loading** | C28 skeleton matching final layout; "Loading standings" for SR | Navigate away | Actions that need data | Auto-resolves; if > a bounded wait, replaced by error with Retry (threshold **Open**) |
| **No results** | "No registrations match these filters." + `Clear filters` | Change filters | n/a | Clear filters |
| **Validation error** | Inline per field + error summary at top; first error focused | Fix and resubmit; Save draft | Submit | Correct fields |
| **Network error** | C29 danger inline in the failing region with Retry; unaffected regions stay | Other regions; cached view labelled "Last updated" | The failing action | Retry; if persistent, S52 copy with correlation ID |
| **Offline** | Global banner (z 70): "You're offline…"; forms show "Autosave paused" | Read already-loaded data | All writes (buttons disabled with reason); **no optimistic success** | Reconnect: banner changes to "Back online. Sync check…" then clears after confirmation |
| **Access denied** | S50 or inline Locked with the reason; no object details leaked | Navigate elsewhere | The action | Sign in as correct user / ask an organizer |
| **Stale/refreshed** | "Last updated 14:42:10" + subtle "Updated" marker on changed rows | All | n/a | Manual refresh |
| **Disabled by lifecycle/role** | Control shown **Locked** with reason popover ("Locked: results can only be published after verification") | Everything else | That control | Satisfy the stated prerequisite |
| **Partial data** | Cell `–` with tooltip reason; banner "Some information couldn't be loaded" | Everything loaded | Actions needing missing data | Retry region |
| **Conflict / concurrent edit** | Banner: "This {object} changed (by {admin}, {time}). Refresh to continue." with `Refresh` and `Compare` | Read-only view of both versions | Saving over it (rejected server-side; BR-X10) | Refresh, re-apply edits |
| **Upload in progress** | C06 file row "Uploading…" (determinate only if measurable) | Cancel; other files | Starting extraction for that file | Wait/cancel |
| **Upload failed (retryable)** | File row danger chip + reason + `Retry` / `Remove` | Other files | Linking this file | Retry or choose another |
| **Upload checks failed** | Row warning/danger with cause (type, size, decode, low-res, duplicate) | Replace file | Extraction | Upload different file / open existing duplicate |
| **OCR queued** | C36 "Queued" (processing tone) + "Enter results manually" | Manual entry | Review table (no rows yet) | Wait or go manual |
| **OCR running** | C36 "Running"; no % unless measurable | Manual entry, cancel | Verify | Wait |
| **OCR draft ready** | "Draft ready for review: N rows need a decision" (warning tone when flags; processing/neutral when none) | Open review | Publish (not verified) | Review |
| **OCR failed / timed out** | C36 danger: cause + "Your screenshot is saved" | Retry (bounded count shown), manual entry, upload another | Review table | Retry or manual |
| **Partially read** | Rows only from successful parts; banner listing which part failed | Review, add rows manually | Verify until rows complete | Re-upload or manual completion |
| **Unsupported layout** | "This screenshot doesn't look like a supported result screen." | Manual entry, upload different | Extraction | Provide supported screenshot or manual |
| **No text found** | "No text was found. Check that this is the results screen." | Replace evidence | n/a | Upload again |
| **Unmatched player** | Row "Not on roster" (danger-outline), crop, options | Map/ignore/hold | Verify | Resolve row |
| **Ambiguous player** | Row "Ambiguous: n candidates", no preselect | Choose via C21 | Verify | Choose candidate or alternative |
| **Roster collision** | Banner in C21 + codepoint view | Choose using crop | Verify | Choose; roster-review flag raised |
| **Missing/invalid statistic** | Empty/danger-border field "Kills must be a whole number 0 or more" | Edit | Verify | Enter value |
| **Result draft** | Hatched "Draft · not official" | Edit, verify | Publish | Verify |
| **Result verified** | Dotted success "Verified · not yet published"; rows read-only | Publish, reopen for review (if unpublished) | Edits | Publish or reopen |
| **Result published** | Seal "Official · v1" | Correct (reason), view history | Direct overwrite | Correction workflow |
| **Result corrected** | v2 chip, previous struck through, "Corrected {date}" | History | n/a | n/a |
| **Result disputed** | "Under review" chip on public views | Admin investigates | Finalization if blocking policy | Resolve dispute |
| **Publish failed** | S35 danger alert: "Publishing didn't complete. Nothing was made public." | Retry | n/a | Retry; if repeated, S52 + correlation ID |
| **Banner failed** | C25 "Banner failed. Publication isn't affected." | Retry; publication stays | n/a | Retry |
| **Session expired** | Re-auth dialog; S53 fallback | Re-sign in | Writes | Sign in; draft preserved |

## 11.3 Notes on "○" cells (not applicable)
Public pages have no write paths so V/CF/UP are n/a; S43 has no results; S44 profile has no staleness other than conflict. Departures are recorded here, not silently dropped.

---

# 12. Accessibility, localization, responsive behavior

## 12.1 Accessibility requirements (working assumption: aim for WCAG 2.x AA-level behavior; actual target **T-10 undecided**)

- **Keyboard:** all functions operable without a pointer; logical focus order; no keyboard traps except modal dialogs (with Esc exit). S32 shortcuts (§8.4) are **optional accelerators** and can be disabled; single-key shortcuts must not fire inside text inputs.
- **Focus visibility:** `focus.ring` always visible (2 px + 2-px offset); never suppressed; focus stays on the logical element after actions (e.g., after "Confirm" on a row, focus moves to the next row's primary action).
- **Semantics:** one `<h1>` per page; headings nest; landmarks (header, nav, main, footer); tables use real table semantics with captions and `scope`; status chips contain text.
- **Forms:** visible labels; required/optional text; errors linked via `aria-describedby`; error summary focus on submit failure; autocomplete tokens on auth forms.
- **Announcements:** live regions (polite) for row confirmations, job status changes ("Extraction finished. 7 rows need a decision."), publish success, offline/online; assertive only for errors that block.
- **Contrast:** §4.8 (calculated). Check again with real organizer imagery and in the final font rendering.
- **Touch targets:** ≥ 44 × 44 px on touch; spacing ≥ 8 px between adjacent targets in dense rows.
- **Non-color signals:** every status has glyph + label; flagged rows have a glyph and the word; draft vs official differ by border style, hatch, label.
- **Table alternatives:** screenshot with boxes → adjacent text table; charts → data table; podium → ordered list.
- **Screenshots (evidence) text alternatives:** the detected text table is the text alternative; the image alt names the match and upload time.
- **Time-limited things:** none of the UI auto-expires except the session; the session expiry warning is a persistent dialog, not a toast.
- **Reduced motion:** honored per `animations.md`; no information is conveyed by movement alone (§14).

## 12.2 Localization

`problem.md`, `ideation.md`, `tech-stack.md` **do not require Marathi, Hindi, or other languages**. Localization is therefore **not designed**; it is recorded as an open consideration (§16). Design provisions that keep it feasible: all strings in a catalog, ≥ 30% text-expansion room in buttons/chips/tab labels, no text embedded in images (except the generated banner), numerals formatted via locale APIs, IGNs and team names never translated or re-scripted, font fallbacks for Devanagari (Noto Sans Devanagari) reserved in the stack **if** a language is added, status labels centralized in §10.3 so translated labels stay consistent.

## 12.3 Responsive behavior summary

| Element | `xl/lg` | `md` | `sm/xs` |
|---|---|---|---|
| Data tables (C16) | Full table, sticky header | Horizontal scroll in container, sticky first column | Row → card with same priority order |
| Screenshot + editable fields (S32) | Side by side (viewer ≈ 45%/55%) | Viewer on top (collapsible), rows below | Tabs [Screenshot][Rows][Teams]; row crop always shown above each row's fields |
| Candidate chooser (C21) | Inline popover | Drawer | Full-screen sheet |
| Room credentials (C14) | Panel in rail | Panel above schedule | Full-width card, large mono, big Copy buttons (≥ 48 px) |
| Filters | Toolbar chips | Toolbar chips (wrap) | Filter sheet with applied-count badge |
| Dialogs | Centered ≤ 560 px | Centered | Bottom sheet/full-screen for long content |
| Leaderboards | Table | Table with scroll | Card list |
| Admin review controls (verify bar) | Sticky bottom bar | Sticky bottom bar | Sticky bottom bar (compact: counts + one button) |
| Navigation | Sidebar | Drawer | Bottom tabs (participant) / menu sheet (admin) |

---

# 13. Component-library and tooling decisions

Only choices that affect UI delivery are listed; **no survey count is claimed**, versions are not pinned, and none of the "recommended" libraries has been verified for maintenance status in this session.

| Need | Choice | Status vs tech-stack | Use for | Build custom | A11y / maintenance notes | Verify before adoption |
|---|---|---|---|---|---|---|
| UI primitives | **shadcn/ui + Radix** | **Listed** (tech-stack §4.1) | Button, Dialog/AlertDialog, Sheet, Tabs, Popover, Tooltip, Select, Checkbox, Switch, Table shell | Domain components C05, C08, C14, C17–C25, C36, C41, C43, C46 | Radix provides focus management and ARIA patterns; shadcn is copied source (you own updates) | Component set matches needs; license of copied code |
| Forms | **React Hook Form + Zod resolvers** | **Listed** | All forms, shared schemas | Field-level wiring for IGN/UID | Error association must be done explicitly | none |
| Server state | **TanStack Query** | **Listed** | Polling job status, refetch after mutations, optimistic updates **never for scores/approval** | Stale-banner and version-conflict handling | Polling interval is an **Open** design parameter | none |
| Data tables | **TanStack Table** (headless) | **Not listed**: recommendation | C16 sorting/filtering/selection | Row card transform, sticky columns | Headless: ARIA/semantic markup is ours to implement | Fit vs plain shadcn Table for ≤ 50 rows (our sets are small; plain Table may suffice; **decision Open**) |
| Image viewing | **Zoom/pan component** (e.g., `react-zoom-pan-pinch` or a small custom transform layer) | Listed generically ("a zoom/pan component", §4.1); specific library **not decided** | C19 | Overlay boxes, row↔box linking, keyboard controls | Many pan/zoom libs lack keyboard support; we must add it | Keyboard support, touch pinch, overlay alignment under zoom |
| File upload | **react-dropzone** or native input + custom | Not listed: recommendation | C06 | Per-file status UI, server checks display | Must keep the native input accessible | Maintenance, multi-file, mobile camera behavior |
| Charts | **Recharts** *or none in Core* | "Lightweight library" **unspecified** | Optional §9.6/9.7 charts | n/a | SVG output needs text equivalents | Choose only if a chart is adopted; tables first |
| Toasts | shadcn `sonner` | via shadcn | C30 | none | Must not carry critical info | none |
| Icons | **Lucide** | via shadcn | all | none | Verify icon names in §4.5 exist | none |
| Fonts | Inter, Barlow Condensed, JetBrains Mono (+ Noto fallbacks) | Not in tech-stack | typography | none | Licenses and self-hosting not verified; bundle size to budget | Licenses; Unicode coverage against name census (Q-28) |
| Date/time | native inputs first; `date-fns` if needed | Not listed | C04 | Timezone label | Native pickers vary by browser | Need for custom picker |

**Conflicts with tech-stack:** none detected; where the stack says "unspecified" the table records a recommendation. **Banner rendering** (Satori/resvg) is backend (tech-stack §3.10) and only its preview (C25) is a frontend concern.

---

# 14. Explicit design rules and banned patterns

| ID | Rule |
|---|---|
| DR-01 | Color is never the only signal: every status has glyph + label + tone; ranks have numbers; charts have markers/labels. |
| DR-02 | No KPI/metric tile without a user decision it supports and a link to the worklist it counts (C42 only). No glow, no decorative gradients beyond §4.9. |
| DR-03 | Draft, Verified, Published are visually distinct by border style, label, and seal (§4.5). An unverified table never uses `maturity.published` styling. |
| DR-04 | No automatic certainty: ambiguous/collision/unknown rows have no preselected candidate and never show "100%" or "Certain". Only Confirmed uses success styling for identity. |
| DR-05 | No rank-based row tinting; team accents are identity marks only and never imply score. |
| DR-06 | No public exposure of payment proofs, room credentials, contact details, raw screenshots, or unpublished results; UI concealment is not authorization (backend enforces). |
| DR-07 | "Uploaded", "Queued", "Running", "Draft ready", "Verified", "Published" are different states with different words; no success styling because a request merely started. |
| DR-08 | No bulk approve/verify/publish. Bulk accept is limited to unflagged high-confidence rows (§18.2) and shows its count. |
| DR-09 | Toasts never carry the only record of a consequential outcome; publication/verification results persist in page state. |
| DR-10 | Verify and Publish are never the same button or adjacent in one control group. |
| DR-11 | Destructive or irreversible actions (disqualify, reject, revoke, rotate, publish, publish correction, finalize, reopen) use C31 with consequence text and, where required, a reason. |
| DR-12 | Dense tables use ≥ 14 px text, ≥ 40 px rows; captions 12 px only for non-essential metadata. |
| DR-13 | One icon set, one status vocabulary (§10.3), one spacing scale. |
| DR-14 | No placeholder copy ("Lorem", "Welcome back!"); seed data per §10.5 and marked illustrative. |
| DR-15 | No UI for unsupported capabilities: live game data, automated room creation, in-platform payments, wallets/payouts, anti-cheat, public per-player stats (until Q-19), custom OCR training. |
| DR-16 | No official Free Fire MAX scoring is hard-coded in the UI; scoring shown is the organizer's configured ruleset and server-computed values; the UI never computes scores or ranks (tech-stack §4.3 rule 2). |
| DR-17 | Every match-scoped admin action shows C45 with match, map, time, attempt, and result version. |
| DR-18 | The IGN is displayed and copied as raw; normalized forms are admin-evidence only. |
| DR-19 | The manual-entry path is visible wherever extraction is shown. |
| DR-20 | No percentage progress, accuracy figure, or ETA unless measured and defined. |
| DR-21 | No auto-dismissed errors; no modal for non-blocking information. |
| DR-22 | No motion is specified in this document; no content relies on motion (see animations.md). |

---

# 15. Traceability

Source IDs are exactly those in the attachments. "Backend" marks what the UI relies on but cannot itself guarantee.

| Source ID | Need | Screens | Components | States/edges handled | Notes / open / backend reliance |
|---|---|---|---|---|---|
| P1 fragmented info | Single status per team | S09, S13, S20, S24, S28 | C07, C35, C42 | Four-state row; queues | |
| P2 payment/approval ambiguity; FR-P1…P4, BR-P1…P4, FR-A1, BR-A1/A2 | Independent payment/approval; gated approval | S12, S13, S24, S25 | C15, C07, C22-style approval gate | Duplicate flag, mismatch, waiver reason | **Backend:** gating & duplicate detection (BR-P4) |
| P3 credential leakage; F10, FR-C1/C2, §15, BR-X3 | Gated, timed, versioned credentials | S14, S29 | C14, C44, C26 | Pre-release, superseded, denied | **Backend:** eligibility & release time; UI cannot protect leaks off-platform (Q-13) |
| P4 identity gap; F14, FR-I1/I2, §17 | Roster-limited candidates, no auto-confirm | S32, S33 | C08, C20, C21 | Ambiguous, collision, unknown, approximate | **Backend/OCR:** matching accuracy unvalidated (Q-08, Q-22) |
| P5 stylized names; F5, FR-R3, ER-07/08 | Raw preserved, exactness, copy | S10, S11, S32 | C05, C46 | Approximate, codepoint view | Q-06, Q-28 open |
| P6 time pressure; F11, §12.2 | Fast review, next action | S28, S32, S34 | C41, C20, C24 | Bulk accept, shortcuts | No 5-min claim; Validate |
| P7 silent errors; FR-V2, BR-X2, §18.3 | Gate and maturity states | S32, S35 | C22, C24, §4.5 tokens | Blockers, warnings | **Backend:** validation enforced server-side |
| P8 audit; FR-AU1, §22.3, BR-X5 | Visible correction history | S36–S38, S41 | C26, C37, C44 | v2, superseded | **Backend:** append-only store |
| P9 duplicate/stale; BR-X9, BR-X10, EX-06…08 | Stale/duplicate handling | S30, S32 | C06, C29 | Hash duplicate, stale banner, disabled during submit | **Backend:** idempotency/versions |
| FR-T1…T5, F3 | Config, validate, lifecycle, archive | S21, S22, S42 | C35, C04, C11 | Overlap errors, read-only archive | |
| FR-R1…R6, F2, F4 | Accounts, roster, withdraw | S07–S13 | C04, C05, C09, C35 | Duplicate team/player, lock | Q-09 open |
| FR-S1, BR-S1…S3, F8 | Slots, waitlist | S26 | C13, C39 | Conflict ES-01, capacity | Waitlist Validate (Q-12) |
| FR-M1/M2, F9, §13 | Match scheduling and statuses | S27, S28 | C12, C41 | Interrupted/restarted attempts | Q-27 open |
| FR-E1/E2, F12, BR-X8, BR-X9 | Evidence upload, immutability, dedupe | S30 | C06, C19 | Failed, duplicate, low-res | **Backend:** hash, sanitize, privacy |
| FR-O1…O4, F13, §16.7 | Job status, retry, manual fallback | S28, S31, S32 | C36 | Queued → timed out | Engine unknown (Q-08); FR-O4 Validate |
| FR-V1, F15, §18.2 | Review workspace | S32, S33 | C19–C24 | Flags, stale, bulk accept | Q-17 second admin |
| FR-SC1/SC2, F17, §19, BR-X4 | Config, preview, versions, penalties | S23, S37 | C43, C17, C44 | Frozen, rescore | Q-07, Q-10, Q-14; **Backend:** deterministic scoring |
| FR-L1…L3, F18, F19, F23, §20 | Leaderboards, finalization, podium | S04–S06, S35–S37, S42 | C18, C38, C37 | Ties, pending, final | Q-10, Q-18 |
| FR-B1, F20, §21 | Banner | S40 | C25 | Failed, superseded | **Validate**; backend rendering |
| FR-D1, F22, §22.1 | Disputes | S15, S16, S39 | C26, C37 | Window closed, conflict of interest | Validate; Q-16, Q-17 |
| FR-N1, F21 | Notifications | S43 + C40 | C40 | No credentials in text | External channels Q-23 |
| FR-AC1, §27 | Role-based UI | all | C01, §5.2 | Absent vs Locked | **Backend:** authz on every request |
| F24, §30 | Queues, timing | S20 | C42 | All clear | Timing dashboards Validate |
| F25 | Rules text, guidance | S03, S22, S30, C05 | C05 helper | Guidance content Open (Q-06) | |
| NFR accessibility | Keyboard, contrast | all | all | §12 | T-10 target undecided |
| D1–D14 | Principles | §2, §14 | | | Mapped in DR rules |

---

# 16. Assumptions, open questions, conflicts, handoff

## 16.1 Assumptions made in this document

1. Times shown in **IST** with explicit suffix (not specified in sources).
2. Light default + Dark theme (sources silent).
3. Admin works on laptop/tablet; phone supports monitoring and urgent actions, not full configuration (A-10 says mobile-first for **participants**; admin device mix is unvalidated).
4. A designated-uploader role exists with upload-only rights (ideation §5 **[PROPOSAL]**).
5. Participants see no per-player stats on public pages (Q-19 temporary assumption).
6. Fonts and Lucide icon names are working choices subject to license/coverage checks.
7. S05 shows per-match columns for up to 6 matches (the typical event, **[BRIEF]**); more matches use horizontal scroll.

## 16.2 Conflicts and tensions between documents

| Item | Tension | Provisional design | Needs |
|---|---|---|---|
| Admin mobile use | problem §9/10 personas say organizer uses "mobile + laptop"; tech-stack says admin screens "work on laptop and tablet" while participants are mobile-first | S32 provides a **usable `sm` tabbed layout** but S22/S23 are "best on a larger screen" | Admin device survey |
| Player stats visibility | ideation F18 shows per-player kills "where policy permits"; problem §20 leaves public/private (Q-19) | Public per-player kills hidden by default | Organizer decision |
| Platform admin | problem §9 lists the role; ideation §4 and Q-20 treat it as possibly merged | S45 marked **Open**, nothing else depends on it | Q-20 |
| Invites | ideation F4 risk: invite flow may be unnecessary | S08 marked Open; S10 supports direct entry | Owner decision |
| Banner/disputes | Marked Validate | Designed but flagged; can be dropped without breaking core | Owner priority |
| "Delayed" status | Listed in problem §11.F but absent from the §13 state diagram | Shown as a flag/chip alongside Scheduled/Ready | Confirm in business rules |

## 16.3 Open design questions

| # | Question | Resolves with |
|---|---|---|
| O-1 | Auth method (email/phone/OTP/SSO) → S07 fields | T-03, A-05 |
| O-2 | Accessibility target level | T-10 |
| O-3 | Whether Dark ships in v1 | Owner |
| O-4 | Real result-screen layouts, fields, UID visibility, multi-screenshot | Q-01…Q-05 |
| O-5 | Copy-IGN-in-game helper text | Q-06 (verify in game) |
| O-6 | Roster lock and post-lock change policy | Q-09 |
| O-7 | Tie-break display for admin decision; podium tie handling | Q-10 |
| O-8 | Dispute window and eligible disputers | Q-16 |
| O-9 | Second-admin approval UI | Q-17 |
| O-10 | Reopen policy | Q-18 |
| O-11 | Player stats public vs private | Q-19 |
| O-12 | Notification channels | Q-23 |
| O-13 | Retention and privacy-notice text, OCR provider disclosure | Q-15, Q-08 |
| O-14 | Polling interval and loading timeouts for admin status | Engineering test |
| O-15 | Whether candidate "similarity score" is shown at all | Q-22 calibration |
| O-16 | Offline editing behavior in S32 (block vs queue) | Engineering decision |
| O-17 | Banner format/aspect and template | Organizer; Validate |
| O-18 | Whether image contrast/rotate view tools are useful | Admin testing with real screenshots |
| O-19 | Localization (Marathi/Hindi) | Organizer; not in sources |
| O-20 | Hypothetical scoring table replaced by organizer's | Q-07 |

## 16.4 Handoff

This document hands the implementation phase: token tables (§4), shell and navigation (§5), component anatomy/states (§6–7), per-screen content/layout/states (§8), data table and score display rules (§9), copy, vocabulary, and seed data (§10), state matrix (§11), accessibility/responsive rules (§12), tooling constraints (§13), banned patterns (§14), and requirement traceability (§15). It deliberately contains no code, schemas, endpoints, or task lists. Backend contracts (OpenAPI) must exist before each vertical slice (tech-stack §4.4: "Do not ask the agent to invent endpoints").

## 16.5 Sources actually consulted

- `problem.md`, `ideation.md`, `tech-stack.md` (attachments), read in full where cited. Parts of problem.md §28 (edge-case catalogue) were not read line-by-line; edge-case IDs cited here are those named in ideation.md and tech-stack.md.
- Contrast ratios: computed in this session from the hex values (WCAG relative luminance); not browser- or device-tested.
- **Not verified:** font licenses and Unicode coverage, Lucide icon names, library maintenance status, any browser behavior.
