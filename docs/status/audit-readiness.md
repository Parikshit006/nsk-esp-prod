# Documentation audit and implementation readiness

This is a historical audit from the project bootstrap. The supplied documents it describes were later moved, unchanged, to [`docs/source/`](../source/) and the visual references to `refs/design/`. Use [delivery progress](progress.md) for the current implementation state.

Audit date: 18 October 2026. Status: source audit complete; application implementation not yet complete.

## Repository evidence

The supplied workspace initially contained eight Markdown documents, a traceability CSV, and two reference JPGs. It had no `.git`, application source, manifests, migrations, tests, or deployment configuration. `git ls-remote` succeeded but returned no refs for the supplied GitHub remote; there is no existing branch/history to preserve. Bootstrap `main` rather than pretending an existing implementation was inspected. Preserve all supplied files unchanged.

## Complete reading checklist

Every line of the following files was inspected, including tables, code blocks, footnotes and appendices. Large files were read in contiguous sections; truncated output was reread in smaller sections.

| Source | Lines | Complete | Governing requirements and consequences |
|---|---:|---|---|
| ai_coding_agent_guide.md | 141 | Yes | Contract-first slices, layered API, pure domain logic, SQL integrity, same-transaction audit, actual test results; references all sources and phase gates. |
| implementation_phases.md | 417 | Yes | PHASE-000–017; manual results before OCR; IC-1 credentials, IC-2 manual tournament, IC-3 assisted tournament; conditional work stays deferred. |
| implementation_reference.md | 1572 | Yes | 108 REQs, 110 TESTs, 51 DEC items, 20 conflicts; role/object policies, provisional API contracts, 35 entities, security MC-01–20 and deployed MVP acceptance. |
| problem.md | 1202 | Yes | Authoritative behavior, independent registration/payment/approval/slot states, immutable evidence, versioned corrections, private credentials, all ER/EP/ES/EM/EO/EL/EX cases. |
| ideation.md | 501 | Yes | Scope, F1–26, manual fallback, closed-roster identity matching, measured OCR quality, no wallets/live game integration or speculative expansion. |
| tech-stack.md | 412 | Yes | React, Express/Node and PostgreSQL fixed; other libraries proposals; routes→controllers→services→repositories, pure domain, real PostgreSQL integration testing. |
| design.md | 1441 | Yes | All S/C IDs, tokens, full state matrix, exact vocabulary, light slate/cobalt operations, ink public hero, keyboard/mobile behavior, no client scoring or fabricated success. |
| animations.md | 563 | Yes | All M01–11, motion tiers, reduced-motion equivalents, server-confirmed events, static tables and evidence, no blocking motion. |

Also read the entire 108-row `requirements_traceability.csv`. Both JPG references were visually inspected: sports-team editorial posters, not result-screen evidence. They are not an OCR corpus. No rights to republish their logos/photography are established; retain them as supplied references, use typographic fallbacks in the product.

Internal references were checked against the inventory. PRD, workflow.md, business-rules.md, architecture.md, database-design.md, api-specification.md, ocr-design.md, scoring-design.md, ui-ux-design.md, security.md, testing-strategy.md and deployment.md are proposed downstream artifacts, not supplied files. No README or AGENTS.md existed. No accessible supplied Markdown remains unread.

## Product and cross-document findings

The product serves college Free Fire MAX organizers, captains, linked players and spectators. Its critical value is reliable registration-to-podium operation under match-day time pressure. OCR is fallible assistance; evidence→draft→review→verification→publication is the invariant. Human roster identity precedes attribution; all arithmetic and authorization belong on the server.

Behavior precedence: problem.md; scope: ideation.md; appearance/vocabulary: design.md; motion: animations.md; fixed stack: tech-stack.md. The implementation pack supplies contracts and ordering but cannot silently override these sources. Every existing CF-001–020 was examined; working resolutions are in decision-log.md.

Additional discrepancies requiring explicit treatment:

1. **Manual path transition gap:** the match diagram enters UnderReview through OCR processing only. Manual draft creation must be able to move an ended match from AwaitingEvidence into UnderReview, without claiming extraction occurred. Tests must exercise OCR outage and absent evidence.
2. **Free tournament payment gap:** NotRequired exists, but BR-A1/A2 only permit Verified/Waived. Until clarified, keep the strict gate and require an explicit audited waiver even for a zero-fee event; do not silently broaden approval eligibility.
3. **Participant scope discrepancy:** DATA-015 says match_id, whereas its ER diagram and matching/restart requirements say attempt. Use attempt-scoped participants to preserve restart isolation.
4. **Podium example error:** design §10.5 moves teams between 3rd and 4th while saying podium membership is unchanged. Membership changes; compute the impact on the server and require acknowledgement.
5. **Schedule contract gap:** API-081 provides only scheduled_at but requires overlap validation. Add a bounded end time/duration contract before implementing scheduling; equal-start checks alone are insufficient.
6. **Missing mutation contracts:** roster mapping edits, account linking and some recovery actions have UI intent without complete contracts. Document contracts before those slices; never expose placeholder buttons.
7. **Privacy copy:** C15 says proof is visible to “you and the submitting captain only” although other scoped admins can access it. Use “the submitting captain and authorized organizers.”
8. **Motion conflicts:** animations permits color transitions/chevron rotation while its global rule limits animation to opacity/transform. Prefer instantaneous color changes and transform/opacity only. S50–54 motion budget says none; keep those pages static.
9. **M06 navigation:** Publish entry replacing Verify must navigate to the separate publication panel, never make verification publish or combine the buttons.
10. **Requirement severity drift:** roster-change requests and invariant checks are SHOULD in traceability but required by authoritative behavior/mandatory operational acceptance. Keep the stronger acceptance requirement for core delivery.

## Readiness and prioritized plan

There is no existing functional baseline to regress. The entire implementation is missing. Do not label foundational work a completed MVP.

| Order | Work | Dependency / acceptance |
|---|---|---|
| 1 | Decisions, source preservation, Git bootstrap | Audit complete; default choices and unresolved real-world inputs recorded. |
| 2 | PHASE-001: workspace, configuration, contracts, migrations, health API, system UI, CI | TEST-078/087/094; real database readiness; no secret leakage; production build. |
| 3 | PHASE-002: accounts, sessions, CSRF, scoped roles, audit, versions/idempotency | TEST-069–078/109; denied object access and replay/concurrent writes. |
| 4 | PHASE-003–006: real tournament/registration/payment/slot/match spine | Published-only public reads; payment ≠ approval; concurrent slot test; IC-1 timed credential matrix. |
| 5 | PHASE-007–010: exact scoring, manual review/verify/publish/corrections/finalize | IC-2; deterministic fixture arithmetic; pending ≠ zero; history and podium-impact checks. |
| 6 | PHASE-011–014: private evidence/jobs/fake OCR/identity review; measured provider selection | IC-3; no system confirmation; outage fallback; real corpus required for provider claims. |
| 7 | PHASE-016–017: security/a11y/responsiveness/recovery/staging trial | All mandatory tests; actual restore; organizer trial; no unsupported conformance/accuracy claims. |

Every two or three coherent tasks: inspect diff/status, verify appropriate tests/typecheck/lint/build, commit intended paths and push without force. Never stage environment files, secrets, local databases or generated build output.

## External prerequisites and limitations

Organizer-supplied scoring/tie-break values, screenshot corpus/labels, retention policy, production hosting/storage and backup recovery targets remain unavailable. These block real-event launch and real OCR evaluation, not local foundational engineering. The installed Node was 23.3.0 (not selected production LTS); PostgreSQL 17 binaries exist; Docker engine was initially unavailable. Use an isolated test database, not an unknown existing user database. Record actual verification as work proceeds.
