# animations.md: Motion Specification

> **Product:** Evidence-first tournament operations platform (college Free Fire MAX).
> **Sequence:** 2 of 2. Written against `design.md` (Sxx screens, Cxx components). Every ID below resolves in `design.md`; `Mxx` IDs are defined **only here**.
> **Status:** Draft v1.0. All durations, curves, and budgets are **reasoned design targets to test**, not measured or validated values.
> **Scope:** when things move, how, how long, and the reduced-motion/low-performance fallback. **Not here:** colors, layouts, static state appearance, copy (see `design.md`). **No animation code is written.**

## Table of contents

1. Motion scope and honest constraints
2. Motion principles
3. Motion tokens and rules
4. Frequency tiers
5. Performance and accessibility
6. Universal interaction patterns
7. Component motion catalog
8. Screen-level motion catalog
9. Signature motion moments (M01–M11)
10. Data-visualization motion
11. Loading, empty, error, offline, recovery motion
12. Banned and required patterns
13. Implementation guidance (no code)
14. Motion budget per screen
15. Traceability
16. Handoff, assumptions, open questions, sources

---

# 1. Motion scope and honest constraints

- Motion in this product **reinforces state, continuity, hierarchy, and feedback**. It is not decoration. The core workflow is time-pressured (problem §1: an objective of reviewing results in a short inter-match gap; **not** a measured guarantee), so any motion on a repeated admin task must be fast, interruptible, and never block input.
- The product is a **React + Vite SPA with Tailwind** (tech-stack §4.1). `tech-stack.md` selects **no animation library**. This spec therefore defines motion in **library-neutral tokens** and recommends a **CSS-transition-first approach** (Tailwind + Radix `data-state` attributes), with an optional JS animation library **only** for list/layout reordering (leaderboards) and the podium. That is a **decision to confirm** (§16), not a fixed dependency.
- No promise of native-app physics. Behavior depends on browser, GPU, device load, and battery mode. Every animated element has a **no-animation fallback** that is functionally complete.
- Motion tells the truth: it must never imply a state the server has not confirmed (e.g., "published", "verified", "extraction finished").

---

# 2. Motion principles (enforceable)

| # | Principle | Grounding in this product |
|---|---|---|
| MP-1 | **Purposeful.** Every animation answers "what changed / where did it go / what can I do now?" | Status ladder draft → verified → published (D1) |
| MP-2 | **Fast for repeated admin tasks.** Row confirm, kills edit, candidate pick, sorting, queue open: instant or ≤ `t-micro`. | S32 may involve ~48 rows per match |
| MP-3 | **Never blocking.** UI is interactive from the first frame; pointer and keyboard input are accepted mid-animation and cancel/complete it. | Approve, verify, publish, correct, next match |
| MP-4 | **One vocabulary.** The same tokens and the same enter/exit pattern for the same kind of element. | §3, §6 |
| MP-5 | **Never hides status, error, or permission results.** The final state is a static text/icon state; motion only eases to it. | DR-01, DR-07 (design.md) |
| MP-6 | **No celebration for uncertain or unverified data.** Success emphasis only after server-confirmed *Verified/Published/Finalized*. Ambiguous ≠ success. | D3, BR-X1 |
| MP-7 | **Reserve signature moments** for consequential, server-confirmed events (M01–M11), each used once per event, not per refresh. | §9 |
| MP-8 | **Reduced-motion and low-performance fallbacks are first-class.** | §5 |
| MP-9 | **Truthful progress.** No percentage, ETA or "almost done" motion unless the system can measure it. | DR-20 |
| MP-10 | **Stale data is never animated in.** Responses arriving after the user left the route or changed context are dropped silently. | §13 |

---

# 3. Motion tokens and rules

All values are **proposals to be tested on a low-end mobile device and a mid laptop** (§5). Names are library-neutral.

## 3.1 Duration tokens

| Token | Value | Use |
|---|---|---|
| `t-instant` | 0 ms | Keyboard-driven row changes, table sort, column toggle, kills edit, focus moves |
| `t-micro` | 80 ms | Press/release, checkbox tick, chip swap, copy-confirmation text swap |
| `t-fast` | 120 ms | Hover/focus-adjacent feedback, tooltip, small popover, inline validation, row status change |
| `t-base` | 200 ms | Dialog/drawer/popover entry, tab content, toast, banner entry |
| `t-slow` | 320 ms | Page/route transition (content), sheet on mobile, signature **entry** of small results |
| `t-emph` | 500 ms | Signature moments M02, M06, M07 (single emphasis step) |
| `t-hero` | 800 ms | **Only** M10 (final podium) total sequence |

**Exit rule:** exits run at **~60–70% of the entry duration** of the same element (e.g., dialog in 200 ms, out 120 ms) and are skipped entirely on dismiss-by-error.

## 3.2 Easing (time-based)

| Token | Curve (cubic-bezier) | Use |
|---|---|---|
| `ease-out` | 0.2, 0, 0, 1 | Entries, reveals, things arriving |
| `ease-in` | 0.4, 0, 1, 1 | Exits, things leaving |
| `ease-move` | 0.4, 0, 0.2, 1 | Position changes within the layout (row reorder, panel resize) |
| `linear` | n/a | Determinate progress bars only (only when the progress is real) |

## 3.3 Spring presets (only if a spring-capable library is adopted)

| Token | Intent | Starting values (untested) |
|---|---|---|
| `spring-settle` | Row reorder, podium column rise | stiffness ≈ 300, damping ≈ 32, mass 1 (critically damped feel, no overshoot) |
| `spring-none` | Everything else | Use time-based easing |

No bounce/overshoot anywhere in operations screens. If no library is adopted, `spring-settle` is replaced by `t-slow` + `ease-move`.

## 3.4 Transform ranges

| Property | Allowed range | Notes |
|---|---|---|
| Opacity | 0 → 1 | Primary property for appear/disappear |
| Translate (overlays/lists) | 4–8 px (lists), 8–16 px (dialogs, drawers, toasts), full width for mobile bottom sheets | Direction follows origin (see 3.6) |
| Scale | 0.98 → 1 (popovers/dialogs), 0.96 → 1 maximum anywhere | No scale on tables, rows, scores, screenshots |
| Rotation | none | Loading glyph only (§11) |
| Blur | **none** | Banned (cost + obscures data) |

## 3.5 Stagger and concurrency

- Stagger step ≤ **30 ms**, applied to **at most 8** items; items beyond the 8th appear with the 8th. Total stagger ≤ 240 ms.
- **Max simultaneous animated elements on one screen: see §14** (default ≤ 4). Staggers count as one group.
- Data tables are **never staggered** (S24, S31, S32, S37, S41); only first-load of S01/S02 card grids may stagger.

## 3.6 Entry/exit asymmetry and origin-aware overlays

- Entry is `ease-out`, exit `ease-in`, exit shorter (3.1).
- **Popovers/menus/tooltips** originate at their trigger (transform-origin at trigger edge; scale 0.98 → 1 + opacity).
- **Dialogs** fade + 8-px rise from center; **drawers** slide in from the right (`md`+) over `t-base`; **mobile sheets** slide up from the bottom over `t-slow`; the scrim fades in `t-base`.
- **Toasts** slide 8 px from their screen edge and fade.
- **Route changes:** content cross-fades (`t-slow`, opacity only); shell (top bar, sidebar, context bar C45) **does not animate**.

## 3.6b Rules for numbers, lists, progress, layered panels

- **Number changes:** no counting-up by default; value swaps with a `t-fast` opacity swap only where §10 allows.
- **List updates:** inserted rows fade in (`t-fast`); removed rows collapse instantly; reordered rows (leaderboards only) use `ease-move`/`spring-settle` per §10.
- **Progress:** only determinate (linear) if byte-level upload progress is measured; otherwise a static state + one small ring glyph rotation (§11).
- **Layered panels:** only the topmost layer animates; the layer beneath does not dim by animation beyond the scrim.

---

# 4. Frequency tiers

| Tier | Interactions | Allowed motion |
|---|---|---|
| **T0: continuous/keyboard** | S32 `J/K` next/prev row, `Enter` confirm suggested, `E` edit kills, `C` open candidate chooser; S34 kills entry; table sort and column toggle; S13/S26 inline selects; typing in forms | `t-instant`. State change is immediate. Focus moves immediately. A static "changed" marker (design.md) is sufficient |
| **T1: frequent** | Row confirm via click, candidate selection, bulk accept, copy room ID/password, approve/verify payment, assign slot, filter chips, tabs, checkbox/toggle, inline validation | `t-micro`–`t-fast`, opacity/color-only, no translation of data |
| **T2: structural** | Navigation, dialogs, drawers, sheets, toasts, banners, expand/collapse, upload dropzone events, job status card changes | `t-base`–`t-slow` |
| **T3: milestone (rare)** | M01–M11 | `t-emph`/`t-hero`, one clear emphasis step, always skippable and server-confirmed |

Application:
- **Roster editing (S10/S11):** T1 (row add/remove: opacity only).
- **Table sorting:** T0.
- **Screenshot review (S32):** viewer pan/zoom is direct manipulation and follows input exactly (no easing lag); box highlight on row select = T0.
- **Candidate selection (C21):** radio change T0; chooser open/close T1.
- **Score correction (S38):** T2 for the dialogs, T3 only M09 after server confirmation.
- **Approval/publish:** button loading state T1; consequence is M06/M07 (T3) after confirmation.
- **Repeated match operations (S28):** no motion on status transitions except the node state change (T1 opacity).

---

# 5. Performance and accessibility

## 5.1 Performance rules
1. Animate **`transform` and `opacity` only**. No animating `width/height/top/left/margin`, no layout-triggering animation, no `box-shadow` or `filter` animation, no backdrop blur.
2. Height-changing disclosures (expand/collapse) use **instant swap or a short opacity change** unless the container has a fixed height; **no height tweening** in tables (S32, S24, S31).
3. **No infinite decorative loops.** The only permitted repeating motion is the **processing ring** (§11), which stops as soon as the job state changes, is paused when the tab is hidden, and is absent in reduced-motion mode.
4. **No off-screen animation:** elements outside the viewport are not animated; list entries below the fold appear without animation.
5. Loading indicators occupy **reserved space** (C28 matches final layout) so nothing shifts.
6. **Engineering budget (to test, not a benchmark):** keep every interaction animation to a frame budget compatible with 60 fps on a mid-range phone; if the main thread is busy (long tasks), degrade (§5.3).
7. Test on low-performance mobile hardware (throttled CPU, battery saver) before release; record results; adjust tokens.

## 5.2 Reduced motion (`prefers-reduced-motion: reduce`)

| Normal behavior | Reduced behavior |
|---|---|
| Translate/scale entries | **Opacity cross-fade ≤ `t-fast`**, or instant |
| Drawer/sheet slide | Fade (`t-fast`) in place |
| Stagger | None (all at once) |
| Number animation/ranking movement | Final value shown immediately + static text delta |
| M01–M11 sequences | Replaced by the **text equivalent** (a static banner/status line + announcement) with at most a `t-fast` fade |
| Processing ring rotation | Static ring glyph + text "Processing" |
| Podium rise (M10) | Podium appears complete; names fade in together |

- Functionality is identical; direct manipulation (pan/zoom of C19, typing, selecting) is **unchanged**.
- **In-app setting:** `design.md` S44 currently lists theme only. **Recommendation (design change to confirm):** add a "Motion: Match system / Reduce" control to S44 that overrides the system value. Until added, the OS preference alone governs.

## 5.3 Low-performance fallback
When the client detects sustained dropped frames or low-power mode (detection method **Open**), switch to the reduced-motion table for everything except pan/zoom and typing. The switch is invisible to the user; no message is shown.

## 5.4 Accessibility rules
- Motion never conveys information alone: each animated change has an **icon + text + status** equivalent already visible in the final state, and a **polite live-region announcement** for outcomes (published, verified, row confirmed, extraction finished/failed).
- Focus rings appear **instantly** (never animated); animations never move focus away from the user's current target; dialogs return focus to the trigger after exit.
- No flashing/strobing; no more than one motion emphasis visible at a time per region; nothing flashes above 3 times per second (the product has no flashing patterns).
- Standards (e.g., WCAG motion-related success criteria) apply, but the **target level is undecided (T-10)**; no conformance claim is made here, and no standard is cited as verified.

---

# 6. Universal interaction patterns

| Pattern | Trigger | Movement / property | Token | Reduced motion | Why it exists |
|---|---|---|---|---|---|
| **Hover** (hover-capable devices only; `@media (hover:hover)`) | Pointer over button, row, card | Background/border color shift; no movement | `t-fast` | Instant | Affordance, no layout change |
| **Press/release** | Button, chip, icon button | Background color shift to pressed token; optional scale ≥ 0.98 on **primary buttons only** | `t-micro` | Color only | Confirms input registered |
| **Focus / keyboard** | Tab, arrow keys | Ring appears instantly; no easing | `t-instant` | Same | Visible focus must not lag |
| **Selection / toggle** (checkbox, radio, switch) | Click, Space | Check glyph appears with opacity; switch thumb slides ≤ 12 px | `t-micro` | Instant | Confirms state |
| **Checkmark (row confirmed, C20)** | Confirm on a row | Identity cell tint + `user-check` glyph fade in | `t-fast` | Instant | Fast acknowledgement for repeated task |
| **Expand/collapse** (score breakdown, details) | Click disclosure | Chevron rotates 90°; content swaps (no height tween in tables) | `t-fast` | Instant | Shows direction without layout cost |
| **Dialog open/close** (C31) | Action / Esc / Cancel | Scrim fade + dialog fade and 8-px rise (center); exit shorter | `t-base` in / ~`t-fast` out | Fade only | Focus context shift |
| **Drawer** (C32) | Open row/registration | Slide from right (`md`+), bottom sheet (`sm`) | `t-base` / `t-slow` | Fade only | Spatial origin and dismissal |
| **Popover/menu/tooltip** (C33) | Click/focus (hover for tooltip on hover devices) | Opacity + scale 0.98→1 from trigger origin | `t-fast` | Opacity only | Anchors to source |
| **Toast** (C30) | Low-stakes action result | Slide 8 px + fade; auto-dismiss ≥ 4 s; pause on hover/focus | `t-base` | Fade only | Light confirmation |
| **Banner/alert** (C29) | Warning/error/info appears | **Inline: fades in place; no slide that moves content below** (space is reserved when predictable) | `t-base` | Instant | Persistent info should not startle |
| **Inline validation** (C04) | Blur/submit | Error text fades in; border color change | `t-fast` | Instant | Associates message with field |
| **List/table row change** | New/removed/updated row | New: fade `t-fast`; removed: instant; updated: a **static "Updated" marker** (design.md) that fades out after ~2 s | `t-fast` | Marker only, no fade | Show change without distracting |
| **Progress indicator** | Upload byte progress (measurable) | Linear fill | `linear` | Same (it is information) | Truthful progress |
| **Upload/processing** | Dropzone drag-over, file added, job state changes | Drop zone border/tint change (no movement); file row appears with fade; job status chip swaps | `t-fast` | Instant | See §11 |
| **Copy to clipboard** (room ID/password, IGN, UID) | Click Copy | Button label swaps "Copy" → "Copied" with check glyph for ~1.5 s; optional toast **not** used for credentials | `t-micro` | Same swap | Confirms copy without exposing value elsewhere |
| **Success/error state change** | Server response | Final state appears by cross-fade; error uses **no shake** | `t-fast`–`t-base` | Instant | Truth first, polish second |
| **Drag-and-drop** | **Not used** (design.md C13 uses selects/buttons) | n/a | n/a | n/a | Not justified; accessibility cost |

---

# 7. Component motion catalog

"No motion" is a deliberate decision where marked.

| Component ID | Component | Trigger | Motion behavior | Timing/token | Reduced-motion fallback | Notes |
|---|---|---|---|---|---|---|
| C01 | App shell/nav | Route change; mobile menu open | Shell static. Mobile admin menu sheet slides up; sidebar collapse is **instant** | `t-slow` (sheet only) | Fade | Sidebar collapse is frequent: no motion |
| C03 | Button | Press; loading starts | Color shift; loading spinner replaces icon (width stable) | `t-micro` | Static "Loading…" text | No layout shift |
| C04 | Form fields | Error/warning appears | Message fades in | `t-fast` | Instant | |
| C05 | IGN field | Toggle "I can't type my exact name" | Label text swap + badge swap | `t-micro` | Instant | |
| C06 | File drop zone | Drag-over; file added; per-file status | Border/tint change; file row fades in; status chip swaps; determinate bar only if measured | `t-fast`; `linear` for bar | Instant | "Uploaded" ≠ extracted: chip text says "Uploaded" |
| C07 | Status badge | State changes | Cross-fade of label/glyph/tone | `t-fast` | Instant | Final state static |
| C08 | Confidence indicator | Candidate/tier changes | None | n/a | n/a | **No motion**: certainty must never be "performed" |
| C09 | Team/player rows | Add/remove roster member | Fade in; removal instant | `t-fast` | Instant | |
| C10 | Tournament card | List first load | Optional stagger-in (max 8, 30 ms step); hover color only | `t-base` | None | S01/S02 only |
| C11 | Lifecycle strip | Tournament status changes | Step marker fills with opacity; no slide | `t-fast` | Instant | |
| C12 | Match row | Status change; reschedule | Chip cross-fade; changed time gets static "Updated" marker | `t-fast` | Marker only | |
| C13 | Slot assignment | Assign/release slot | Cell content cross-fades; **M02** on confirmation | `t-fast`; M02 | Instant | No drag |
| C14 | Room credential panel | Release at time; credential version change; Copy; show/hide password | Locked → released content cross-fade (**M03**); copy label swap; password reveal by instant swap | `t-base` (M03); `t-micro` | Instant swap | Never animate the credential characters |
| C15 | Payment evidence | Verify/reject | Status chip swap; actions bar re-renders | `t-fast` | Instant | Frequent; no emphasis |
| C16 | Data table | Sort, filter, page, select | **No motion** on rows; selection bar appears with fade | `t-instant`; bar `t-fast` | Instant | Includes S24/S31/S41 |
| C17 | Score breakdown | Expand | Chevron rotate + swap | `t-fast` | Instant | Never animate arithmetic |
| C18 | Leaderboard row/table | Publish/correction update | Per §10; reordering only for M08/M09 | `t-slow` max | Final order immediately | Rank text + delta marker always present |
| C19 | Screenshot viewer | Pan/zoom; box select; image switch | Pan/zoom follows pointer **directly, no easing**; box highlight swap instant; scroll-to-row **instant** | `t-instant` | Same | Direct manipulation is unchanged under reduced motion |
| C20 | Extracted player row | Confirm; edit; flags change | Identity cell tint fade (`user-check`); flagged marker fade; **M05** only for admin-resolved ambiguity | `t-fast`; M05 | Instant | Row order does not animate |
| C21 | Candidate chooser | Open/close; radio select; confirm | Popover/drawer per §6; radio instant | `t-fast` | Opacity | Confirm triggers M05 on the row, not in the chooser |
| C22 | Verification gate | Blockers change | Count text swaps; item icon swaps (✕ → ✓) | `t-fast` | Instant | When last blocker clears, the status line text changes; no celebration |
| C23 | Team result panel | Completeness changes | Counter text swap ("3/4" → "4/4"); check glyph appears | `t-fast` | Instant | |
| C24 | Verification bar | Gate clears; Verify pressed | Button Locked → enabled by color change; loading state; **M06** on server confirmation | `t-fast`; M06 | Instant + text | Verify never waits for an animation |
| C25 | Banner preview | Generating → ready; superseded | Skeleton → image cross-fade; superseded band appears | `t-base` | Instant | **M11** |
| C26 | Audit/timeline | New entries loaded | Entries fade in; no motion on pagination | `t-fast` | Instant | |
| C27 | Empty state | Appears | Fade | `t-fast` | Instant | |
| C28 | Skeleton | Loading | **Static placeholders**; optional very slow opacity pulse is **not specified**: default none | n/a | None | Avoid shimmer |
| C29 | Alert/banner | Appears/dismisses | Fade in place; global connection banner fades; dismiss instant | `t-base` | Instant | Errors don't auto-dismiss |
| C30 | Toast | Appears | Slide 8 px + fade; exit fade | `t-base` | Fade | |
| C31 | Confirm dialog | Open/close | Scrim fade + 8-px rise | `t-base` / `t-fast` | Fade | Destructive: no extra emphasis |
| C32 | Drawer/sheet | Open/close | Slide in from right / bottom | `t-base`/`t-slow` | Fade | |
| C33 | Tooltip/popover | Open | Fade + scale 0.98→1 from trigger | `t-fast` | Fade | Hover only on hover devices |
| C34 | Tabs | Switch | Underline/indicator **instant**; content cross-fade | `t-fast` | Instant | Not slide |
| C35 | Wizard/checklist | Step change; item completes | Step content cross-fade; tick glyph fades | `t-fast`–`t-base` | Instant | |
| C36 | OCR job status | State changes (Queued → Running → Draft ready/Failed) | Chip swap; ring rotation only while Running; no progress % | `t-fast`; ring | Static ring + text | **M04** when draft ready (quiet) |
| C37 | Impact preview | Opens in dialog; rows expand | Dialog per C31; unchanged-rows disclosure instant | `t-base` | Fade | Changes are text, not motion |
| C38 | Podium | Finalization | **M10** only | `t-hero` | Appears complete | Requires finalized state |
| C39 | Capacity meter | Count changes | Segment fill swaps | `t-fast` | Instant | |
| C40 | Notification menu | New notification | Badge number swaps; **no pulsing/wiggle** | `t-fast` | Instant | |
| C41 | Match operations strip | Status transitions | Node state changes by fill/glyph swap; Next-action card cross-fades | `t-fast`/`t-base` | Instant | Does not animate on every poll, only on actual transitions |
| C42 | Operations queue card | Count changes | Number swaps; no counting animation | `t-fast` | Instant | |
| C43 | Scoring table editor | Row add/remove; validation | Fade in/instant out; error fade | `t-fast` | Instant | |
| C44 | Version/diff list | New version | Fade in new row | `t-fast` | Instant | |
| C45 | Match context bar | Route change | **No motion** | n/a | n/a | Must always be stable/legible |
| C46 | IGN text | Show characters toggle | Instant swap | `t-instant` | Same | Never animate the text itself |
| C02 | Public footer | n/a | No motion | n/a | n/a | |

Components not listed (C02 other than above, C13 details) have no motion. IDs C01–C46 all exist in `design.md`.

---

# 8. Screen-level motion catalog

Common rule: route transitions are **opacity cross-fade of the content region only** (`t-slow`), no shell motion; data arriving later is shown via C28 skeleton → content cross-fade (`t-fast`).

| Screen | Entry/exit | State-change motion | Notes (what is deliberately still) |
|---|---|---|---|
| **S01 Home** | Content cross-fade; hero static; C10 cards may stagger once (≤ 8) | Result tiles update with fade | No hero animation, no carousel, no parallax |
| **S02 Listing** | Cross-fade; cards stagger once on first load only | Tab switch cross-fade (`t-fast`) | Filter results appear instantly |
| **S03 Detail** | Cross-fade; tab content cross-fade | Registration CTA state swap `t-fast` | Scoring summary table static |
| **S04 Match LB** | Cross-fade | Corrected/disputed marker appears by fade; no reorder animation for a visitor opening the page | M07/M09 are *admin/publication* moments; the public page after load is static |
| **S05 Overall** | Cross-fade | Rank-change markers visible statically; **M08 style reorder only if the user is on the page when a new snapshot arrives and only for ≤ 12 rows** (§10) | Initial load never animates ranks |
| **S06 Podium** | Cross-fade | **M10** only on first view after finalization (per session); subsequent visits static | Never before finalization |
| **S07 Auth** | Cross-fade | Error text fade; no shake | |
| **S09 My tournaments** | Cross-fade | Status chip swaps when polled change arrives | No push-style animations |
| **S10 Registration wizard** | Step content cross-fade `t-fast` | Checklist ticks; error fade | No progress "celebration" on submit (submit confirmation is static text) |
| **S11 Roster/IGN** | Cross-fade | Add/remove rows fade; badge swap | Typing never animates |
| **S12 Payment** | Cross-fade | File row states; status panel chip swap | Verified result shows a static state change, no confetti |
| **S13 Status detail** | Cross-fade | Chip swaps | |
| **S14 Schedule/room** | Cross-fade | **M03** credential release; version-change alert fades; copy label swap | Credential text never animated |
| **S15 My results** | Cross-fade | Breakdown expand | |
| **S16 Disputes** | Cross-fade | Status chip swaps; drawer open | |
| **S20 Overview** | Cross-fade | Queue counts swap (no rolling) | No dashboard "live" motion |
| **S21 Admin tournaments** | Cross-fade | Created row fades in; **M01** after publish | |
| **S22 Config wizard** | Step cross-fade | Validation list fades; publish confirmation **M01** | |
| **S23 Scoring editor** | Cross-fade | Row add/remove fade; rescore impact preview in dialog | Preview values appear without counting |
| **S24 Registration queue** | Cross-fade | **No row motion** | High frequency |
| **S25 Registration review** | Drawer slide in | Gate items icon swap; status chip swap | Approve: static state change only |
| **S26 Slots/participants** | Cross-fade | **M02** on slot assign confirmed | No drag |
| **S27 Matches** | Cross-fade | Row status fade; rescheduled marker | |
| **S28 Operations board** | Cross-fade | C41 node transitions; C36 card state changes; Next-action card cross-fade | Countdown text ticks without animation; no pulsing |
| **S29 Credentials (admin)** | Cross-fade | Save confirmation by chip swap; rotate dialog | |
| **S30 Evidence upload** | Cross-fade | Per-file states per C06; **no** celebration when upload completes | |
| **S31 Processing queue** | Cross-fade | Job status chips swap; **no row motion** | |
| **S32 Review workspace** | Cross-fade | Row confirm tint (`t-fast`); gate icon swaps; verification **M06**; M04 on first load of a "Draft ready" result (quiet); M05 on resolved ambiguity | **Everything else instant**: row order, selection, kills edits, box highlight, shortcuts |
| **S33 Identity sheet** | Drawer/sheet per C32 | Radio instant; Confirm closes sheet | |
| **S34 Manual entry** | Cross-fade | Counters swap | No motion on entry |
| **S35 Verify & publish** | Cross-fade | **M06**, **M07**; publish failed alert fades in place | No celebration for Verified beyond M06's minimal treatment |
| **S36 Admin match LB** | Cross-fade | Version switch cross-fade; maturity banner swap | |
| **S37 Admin standings** | Cross-fade | **M08/M09** reorder rules per §10; snapshot switch cross-fade | |
| **S38 Correction** | Cross-fade | C37 in dialog; **M09** after confirmed correction | Podium-change line is static text |
| **S39 Disputes queue** | Drawer | Status chip swaps | |
| **S40 Banner** | Cross-fade | **M11** | |
| **S41 Audit** | Cross-fade | New entries fade in | |
| **S42 Finalization** | Cross-fade | Checklist icon swaps; **M10 triggered on S06**, not here; here only a static "Finalized" state | |
| **S43–S46** | Cross-fade/dialog | Standard | |
| **S50–S54** | Cross-fade | None | System pages are static |

---

# 9. Signature motion moments

Eleven moments, each triggered **only by server-confirmed state**, each skippable by any input, each with a static equivalent already present in `design.md`. A moment never runs twice for the same event (dedupe by event/version ID).

### M01: Tournament created/published
- **Trigger/preconditions:** S22 → `Publish tournament` returns success (server: Published). Not for Save draft.
- **Start → end:** Review step → "Published" success state with links (Open registration / View public page).
- **Moves:** the validation checklist collapses (instant) and a "Published" status chip cross-fades in; the C11 lifecycle strip marks "Published".
- **Still:** form, layout, page shell.
- **Sequence/timing:** one cross-fade `t-base`.
- **Reduced:** instant swap. **Failure/duplicate:** publish error → danger alert, no moment; repeat events ignored.
- **A11y:** live region "Tournament published." **Why:** gentle confirmation of a rare, consequential action.

### M02: Slot assignment confirmed
- **Trigger:** server confirms slot assigned (S26/C13).
- **Moves:** the destination cell's content cross-fades from "Open" to team mark+name; the team row leaves the "unassigned" list with an instant removal.
- **Timing:** `t-emph` (500 ms) window is available but use `t-base` (200 ms) cross-fade; the cell border emphasis fades after 1 s.
- **Reduced:** instant. **Failure:** conflict (ES-01) → cell stays open, stale banner; **no** motion. **Reversal:** release slot: instant.
- **A11y:** "Team Null Pointers assigned to slot 7." **Why:** assignment is quick, repeated; emphasis stays small.

### M03: Room credentials released
- **Trigger/preconditions:** release time reached server-side and the user is eligible (S14/C14) or admin saves credentials (S29).
- **Start → end:** "Available at 14:50 IST" locked state → released state with Room ID and Password.
- **Moves:** locked content fades out, released content fades in (no slide). Password remains **hidden** until user toggles Show (instant).
- **Still:** credential characters; no typewriter/scramble effects.
- **Timing:** `t-base`. **Reduced:** instant.
- **Failure/duplicate:** a new credential version → the old block is marked Superseded **statically**, and a persistent alert fades in (`t-base`); repeated polling does not re-trigger. Denied/error states appear with no transition drama.
- **A11y:** polite live region "Room details are now available." **Why:** release is time-gated; a quiet cue helps a user watching the page.

### M04: Screenshot processed: draft ready for review
- **Trigger:** job state becomes Succeeded/Partially succeeded (C36), draft exists.
- **Start → end:** "Running" card → "Draft ready for review: N rows need a decision."
- **Moves:** the status chip swaps (processing → warning tone if flags, neutral/processing if none); the summary counts fade in. **No success-styled animation**, no check burst.
- **Still:** everything else; review table not auto-opened and does not shift.
- **Timing:** `t-fast`. **Reduced:** instant.
- **Failure:** Failed/TimedOut → chip swap to danger with the two next steps; no moment.
- **A11y:** "Extraction finished. 7 rows need a decision." **Why:** the single moment an admin waits for; it must be noticed, not celebrated; "ready" ≠ "correct".

### M05: Ambiguous identity resolved
- **Trigger:** admin confirms a candidate in C21 and the server accepts (row status → Confirmed/Overridden).
- **Start → end:** row Ambiguous (thick warning border) → Confirmed (success tint on identity cell, `user-check`).
- **Moves:** warning border fades out, identity cell tint fades in; the blockers count in C22/C24 decrements by text swap. The row **does not re-sort** under the user's cursor until the next explicit re-sort or focus move.
- **Timing:** `t-fast`. **Reduced:** instant. **Failure:** stale/validation error → row stays ambiguous with an inline error.
- **A11y:** "Row 17 confirmed as Ghost_47, Null Pointers." **Why:** the main repeated review action needs faster feedback, not emphasis; contrasted with the *absence* of any success treatment while ambiguous.

### M06: Match results verified
- **Trigger:** server returns Verified for the result (S32/S35) after the gate passes.
- **Moves:** the maturity chip cross-fades from "Under review" to "Verified · not yet published" (dotted success); rows lock (inputs become read-only by instant swap); the verification bar's `Verify` button is replaced by `Publish…` entry.
- **Still:** table, screenshot, scroll position.
- **Timing:** one `t-emph` cross-fade of the maturity chip; everything else `t-fast`.
- **Reduced:** instant. **Failure:** validation fails server-side → danger alert; no moment.
- **A11y:** "Results verified. Not yet published." **Why:** marks the lock, **explicitly not** a publication celebration (DR-10).

### M07: Match results published
- **Trigger:** server confirms publication (S35); not on click.
- **Start → end:** Verified → "Official · v1 · {time}" seal; the leaderboard table gets the published maturity styling.
- **Moves:** the seal fades in over the draft/verified banner; the Publish panel collapses into links (View public page, Generate banner). Leaderboard **does not reorder** (it is already ranked).
- **Timing:** `t-emph` for the seal; `t-fast` for the rest. **Reduced:** instant.
- **Failure/cancel:** publish failed → danger alert; the page state stays "Verified"; nothing animates as success. Duplicate events (retries) are idempotent: ignore if version already shown.
- **A11y:** "Match 3 results published." **Why:** the pivotal, trust-bearing state change must be unmistakable but calm.

### M08: Overall standings recalculated
- **Trigger:** a new standings snapshot arrives after publication/correction **while the user is viewing S05/S37**.
- **Moves:** rows that changed rank re-order using `ease-move` over `t-slow` (or `spring-settle` if adopted); the ▲/▼ deltas fade in; non-changing rows stay still. A static line "Updated after Match 3: 4 teams changed rank" appears above the table.
- **Rules:** only if ≤ 12 rows are involved and the tab is visible; otherwise swap instantly. Never animate while the user is mid-interaction with a row (menu open, text selection); apply after.
- **Reduced:** instant order + static deltas. **Failure:** snapshot superseded mid-animation → jump to the latest final order.
- **A11y:** polite "Standings updated. Null Pointers moved from 4th to 3rd." **Why:** helps users track a change without hunting for it.

### M09: Score correction published
- **Trigger:** server confirms a correction (S38) and creates version v2.
- **Moves:** corrected values replace the old by cross-fade with the old value remaining **visible struck through** (static); `v2` chip fades in; affected rows reorder via the M08 rules. Podium-impacting corrections add a static "Podium changed" chip.
- **Timing:** `t-slow` max. **Reduced:** instant.
- **Failure:** correction fails → danger alert; previous version remains current. **Cancel:** confirm dialog dismissed → no state change.
- **A11y:** "Correction published. Match 2 result is now version 2. 4 teams changed rank." **Why:** corrections must be conspicuous and auditable, never hidden by movement.

### M10: Final podium revealed
- **Trigger/preconditions:** tournament status is **Completed (finalized)** per server and the user opens S06 (first view this session).
- **Start → end:** empty ink panel → 3 columns with names, points.
- **Sequence:** (1) panel base visible (0 ms); (2) 3rd place column rises 24 px + fades (`t-slow`, 0 ms delay); (3) 2nd place column (`t-slow`, +160 ms); (4) 1st place column (`t-slow`, +320 ms); (5) volt rule under 1st draws via opacity (`t-base`, +640 ms). **Total ≤ `t-hero` (800 ms)**.
- **Still:** standings table beneath (present immediately); no confetti, particles, sound, haptics (none on web by default).
- **Interrupt:** any click/key/scroll completes it instantly.
- **Reduced:** podium shown complete; names fade together `t-fast`.
- **Failure/duplicate:** reopened tournament → podium removed by instant swap to "Results under review" (no reverse animation); revisits show static podium.
- **A11y:** the podium is an ordered list; live region on first reveal "Final results: 1st Null Pointers, 2nd …".
- **Why:** the one consequential public celebration, limited to authoritative finalized state; the only use of `t-hero`.

### M11: Result banner ready
- **Trigger:** banner job completes (S40/C25) from a published snapshot.
- **Moves:** skeleton → image cross-fade; "Generated from Match 3 snapshot v1" label static. Superseded banner: a static diagonal "Superseded" band appears with a fade.
- **Timing:** `t-base`. **Reduced:** instant. **Failure:** "Banner failed. Publication isn't affected." with no motion; retry restarts the skeleton.
- **A11y:** "Banner ready." **Why:** avoids a pop-in of a large image.

**Moments intentionally not created:** payment verified / team approved (frequent; static chip only), upload completed (not an outcome), OCR accuracy/progress, verified-with-warnings, dispute opened.

---

# 10. Data-visualization motion

| Element | Behavior | Rules |
|---|---|---|
| **Score numbers** (match points, totals) | Swap in place with `t-fast` opacity change only when a new snapshot/correction arrives; **no counting-up** | Scores are information; rolling digits hurt scanning and could hide corrections |
| **Leaderboard ranking changes** | Reorder only for M08/M09 (§9); otherwise instant | Always accompanied by text + ▲/▼ + "Updated" line; skip reordering if the user is interacting |
| **Frequent refresh** (polling) | **No animation** unless data changed; changed cells get a static marker for ~2 s (fade-out `t-fast`) | Avoid re-animating identical data |
| **Charts (optional)** | **No draw-in**; values render final; hover tooltips `t-fast` | Table alternative remains |
| **Progress indicators** | Only determinate if measured (upload bytes); otherwise static state + ring in C36 | No fake percentages |
| **Status counts** (S20, S28, C36 summary) | Number swap | No rolling |
| **Reduced motion** | Final values, no reordering transitions | Static deltas remain |

---

# 11. Loading, empty, error, offline, and recovery motion

| Situation | Behavior | Rules |
|---|---|---|
| **Initial page load** | C28 skeleton (static shapes) → content cross-fade `t-fast` | Same dimensions; no layout shift; no shimmer |
| **Table refresh** | Existing rows stay; a small "Refreshing…" text + timestamp; changed rows get the static marker | No full-table fade-out |
| **Screenshot upload progress** | Determinate bar only when byte progress is measured; else text "Uploading…" | Error replaces bar with danger chip + Retry |
| **OCR processing** | Queued: static chip; Running: ring glyph rotates (continuous, stops on state change, paused when tab hidden) | No percentage, no "almost done" text; "Draft ready" arrives as M04 |
| **OCR timeout/failure & retry** | Chip swaps to danger; Retry restarts the ring; the retry count text updates ("Retry 2 of 3") | Failure never hidden by the ring |
| **No extracted text** | Static message fade `t-fast` | |
| **Unmatched/ambiguous players** | Static flagged styles; no attention-seeking motion | Blocker counts swap |
| **Network interruption** | Global banner fades in `t-base`; data dims **by color token swap**, not animation | Reconnect: text changes to "Back online. Checking for updates…" then banner fades out after confirmation |
| **Publication success** | M07 | |
| **Publication failure** | Danger alert fades in place; buttons re-enable; no shake/flash | |
| **Banner export** | Button loading state; download starts without motion; failure = static alert | |
| **Session expiry** | Dialog per C31 | |

---

# 12. Banned and required motion patterns

## 12.1 Banned
1. Any animation that **blocks or delays** approve, verify, publish, correct, finalize, copy credentials, or move to the next match.
2. Endless decorative background/hero motion; parallax; carousels auto-advancing.
3. Shimmer on large areas; skeleton pulses (default none).
4. Flashing, strobing, or repeated attention pulses (bell wiggle, pulsing "live" dots).
5. Screen shakes, bounce/overshoot, and elastic effects.
6. Any motion that **obscures scores, IGN crops, or source evidence**.
7. Ranking animation that implies an **unpublished or unverified** result is final.
8. Success styling (check bursts, green flashes) when validation fails, data is ambiguous, or the server has not confirmed.
9. Layout shift during loading or on status changes.
10. Information conveyed by movement or color alone.
11. Counting-up numbers on every refresh; table-row staggering; blur.
12. Animating credential text (typewriter, scramble) or IGN text.
13. Auto-playing sound or haptics.

## 12.2 Required
1. Every animation has a **final static state** matching `design.md`.
2. Every consequential outcome has a **live-region announcement** and persistent visible state.
3. Reduced-motion + low-performance fallbacks work for **every** entry in §7–§9.
4. Moments fire only on **server-confirmed** state and dedupe by event/version.
5. Interruptible: any input completes or cancels the animation.
6. Reserved space for loading and banners where predictable.
7. Hover effects gated to hover-capable devices.

---

# 13. Implementation guidance (no code)

- **Mapping tokens:** define the durations/easings as design tokens (CSS variables in Tailwind config) so the same names are used in CSS and, if adopted, in a JS animation library. Prefer **CSS transitions and Radix `data-state`** for overlays (dialog, popover, tooltip, tabs, sheet). Adopt a JS library **only** for (a) leaderboard re-ordering (M08/M09) and (b) the podium sequence (M10); if skipped, use `t-slow` + `ease-move` transform transitions with measured row positions or fall back to instant reorder.
- **Shared-element/layout animation:** only leaderboard rows (identity by team id) and nothing else. Do not use layout animation in editable tables (S32/S34).
- **Stay instant:** all T0 interactions (§4), table sorting, row focus, kills inputs, viewer pan/zoom.
- **Interruption and repeated events:** keyed by `eventId/version`; if a newer update arrives mid-animation, jump to the latest final state. Collapse bursts of updates (e.g., multiple row confirmations in 1 s) into one marker update.
- **Stale data after route change:** abort pending animations on unmount; ignore responses whose route/match/attempt context no longer matches (TanStack Query keys include tournament, match, attempt, version).
- **Reduced-motion testing:** automated checks in Playwright with `prefers-reduced-motion: reduce` emulated; assert that moments produce their **text/state equivalents** and no transforms remain; manually verify at the OS level on at least one phone and one desktop.
- **Non-blocking input:** animations must not capture pointer events (non-interactive overlays use pointer-events: none during animation) and must not defer focus; dialogs trap focus immediately at the start of the entry animation.
- **No dependency silently added:** any animation library is a **proposal needing owner sign-off** (tech-stack §10 style decision).
- **Testing on low-end devices:** include a throttled-CPU profile in the checklist before each vertical slice (tech-stack §4.4).

---

# 14. Motion budget per screen

Design targets to test. "Max simultaneous" counts independently animating elements (a stagger group counts as 1).

| Screen(s) | Allowed tier | Max simultaneous | Notes |
|---|---|---|---|
| S01, S02 | T2 (+ optional card stagger once) | 3 | Hero static |
| S03–S05 | T2 | 2 | Public tables static after load; M08 only if viewing during update |
| S06 | T3 (M10) | 4 (podium columns + rule) | Once per session |
| S07–S13 | T1–T2 | 2 | Forms: fades only |
| S14 | T1–T3 (M03) | 2 | |
| S20 | T1 | 2 | Queues update by swap |
| S21–S23 | T1–T2; M01 | 2 | |
| S24, S31, S41 (tables) | T0–T1 | 1 | No row motion |
| S25, S26, S27, S29 | T1–T2; M02 on S26 | 2 | |
| S28 | T1–T2 | 3 (C41 node, C36 chip, next-action card) | Ring only while Running |
| S30 | T1–T2 | 2 | |
| S32 | T0–T1 (+M04, M05, M06) | 2 | Highest-pressure screen: almost everything instant |
| S33–S34 | T0–T1 | 1 | |
| S35 | T1 + M06/M07 | 2 | |
| S36–S38 | T2 + M08/M09 | 4 | Reorder only ≤ 12 rows |
| S39, S40 | T1–T2; M11 | 2 | |
| S42 | T1–T2 | 2 | M10 lives on S06 |
| S43–S46 | T1–T2 | 1 | |
| S50–S54 | none | 0 | |

---

# 15. Traceability

Source IDs are those in the attachments (`F#`, `FR-`, `BR-`, `P#`, `D#`, `Q-`, `EL-`, `ES-`, etc.).

| Moment / animation | Screens | Components | Features | Problem/requirements |
|---|---|---|---|---|
| M01 Tournament published | S22, S21 | C35, C11, C07 | F3 | FR-T1, FR-T2, FR-T3 |
| M02 Slot assigned | S26 | C13, C39 | F8 | FR-S1, BR-S1, ES-01 |
| M03 Credentials released | S14, S29 | C14, C44 | F10 | FR-C1, FR-C2, §15, P3, BR-X3 |
| M04 Draft ready | S28, S31, S32 | C36 | F13 | FR-O1, FR-O2, §16.7, ER-01R |
| M05 Identity resolved | S32, S33 | C20, C21, C22 | F14, F15 | FR-I1, FR-I2, BR-X2, EO-08…EO-10 |
| M06 Verified | S32, S35 | C24, C22, C07 | F15 | FR-V2, §18.3, BR-X2 |
| M07 Published | S35, S36 | C18, C07, C24 | F18 | FR-L1, BR-X1, §18.4 |
| M08 Standings recalculated | S05, S37 | C18 | F19 | FR-L1, FR-L2, EL-07 |
| M09 Correction published | S38, S36, S37 | C37, C18, C44 | F22 | FR-L2, FR-AU1, BR-X5, EL-08 |
| M10 Podium | S06 | C38 | F23 | FR-L3, BR-X6, EL-10 |
| M11 Banner ready | S40 | C25 | F20 | FR-B1, ER-06R |
| Row confirm/edit (T0/T1) | S32, S34 | C20, C23 | F15, F16 | P6, D5 |
| Upload/processing states | S28, S30, S31 | C06, C36 | F12, F13 | FR-E1, FR-O1, EM-09, EM-10 |
| Offline/stale banners | all | C29 | n/a | BR-X10, EX-06…EX-07, NFR Reliability |

**Intentionally unanimated (too frequent, data-sensitive, or time-critical):** C08 confidence; C16 tables (sort/filter/rows); C17 arithmetic; C19 viewer pan/zoom (direct manipulation); C45 context bar; credential text; payment approval; upload completion; OCR progress; polling refreshes.

---

# 16. Handoff, assumptions, open questions, and sources

## 16.1 Assumptions
1. Event payloads carry an `eventId/version` so moments can be deduped (backend contract not yet defined).
2. Status transitions are observed via TanStack Query polling/refetch (tech-stack §4.1 mentions polling job status); no websockets assumed, so M03/M04/M08 are shown on the **next successful poll**, not instantly.
3. Token values are untested starting points.

## 16.2 Open decisions
| # | Decision | Resolve with |
|---|---|---|
| MO-1 | Adopt a JS animation library for M08/M09/M10, or use CSS + instant reorder | Owner + prototype performance test (tech-stack silent) |
| MO-2 | Add "Motion: Match system / Reduce" control to S44 | Design review (cross-doc change to `design.md`) |
| MO-3 | Low-performance detection method | Engineering spike |
| MO-4 | Polling interval for job/status (affects perceived timing of M03/M04) | Engineering + admin testing |
| MO-5 | Whether M10 plays only first-visit-per-session or per-device | Organizer preference |
| MO-6 | Realtime transport (poll vs push) | Architecture (not in sources) |
| MO-7 | Accessibility target (T-10) and what it requires for motion | Owner |
| MO-8 | Whether any optional chart (design.md §9.7) is adopted | Design review |

## 16.3 Dependencies on design.md
Screen IDs S01–S54 and component IDs C01–C46 used here must remain stable; any renumbering in `design.md` requires an update here. Static states referenced (maturity chips, status tokens) are defined in `design.md` §4–§6.

## 16.4 Browser/device limitations
Behavior may vary by browser GPU, OS power mode, and page visibility; the reduced-motion fallbacks guarantee a complete experience. Pan/zoom smoothness on large screenshots depends on device memory and has not been measured.

## 16.5 Sources
- `problem.md`, `ideation.md`, `tech-stack.md` (attachments).
- No external motion/accessibility standard documents were consulted in this session; no standard is cited as verified. All durations and budgets are **engineering proposals to be tested**.
