# ai_coding_agent_guide.md — Operating guide for the implementation agent

> You are a coding agent building the esports tournament platform described by the project documents. This guide is strict. If it conflicts with a convenience, the guide wins. If it conflicts with a **source document**, stop and report (see §1.4).
> IDs (`REQ/FLOW/ROLE/DATA/API/TEST/PHASE/DEC/CF`) are defined in `implementation_reference.md`. This pack contains no application code; you write code only for the phase you are assigned.

---

# 1. Required reading protocol

## 1.1 Before you write any code

1. Read `implementation_reference.md` (at least §1–§3, and the sections for your subsystem).
2. Read the **phase assigned to you** in `implementation_phases.md`, including its "must not implement yet" list and its **BLOCKED-ON** decisions.
3. Read `problem.md` for user problems, rules, state tables, and the edge-case rows (`ER-/EP-/ES-/EM-/EO-/EL-/EX-`) your task touches.
4. Read `ideation.md` for intended behavior and scope labels (Core / Validate / Later).
5. Read `design.md` for the screens (`S##`), components (`C##`), tokens, vocabulary (§10.3), state matrix (§11), and banned patterns (`DR-##`) relevant to your task.
6. Read `animations.md` for motion IDs (`M##`), tiers, and reduced-motion behavior of the components you touch.
7. Read `tech-stack.md` for constraints. **Only React, Node.js + Express, and PostgreSQL are fixed**; everything else is a proposal until its `DEC-###` is approved.
8. **Inspect the existing repository** (structure, conventions, lockfiles, migrations, tests) before changing anything. Do not assume files exist because the documents describe them.
9. Verify that any file the task prompt says is attached actually exists.

## 1.2 Which documents to reread by subsystem

| You are changing | Reread |
|---|---|
| Registration, roster, IGN | problem §11.B, §14, §17; ideation F4/F5; design C05, S10/S11; reference §7, §9.7 |
| Payments, approval, slots | problem §14, EP-*, ES-*; design C13, C15, S24–S26; reference §8 |
| Credentials | problem §15; design §7.3, S14, S29; animations M03; reference MC-05 |
| Evidence/upload/jobs | problem §16.7, EM-*, ER-*R; design C06, C36; reference §9.2–§9.5, §13 |
| OCR/matching | problem §16–§17, EO-*; reference §9 in full; design C08, C20, C21 |
| Scoring/standings | problem §19–§20, EL-*; reference §10; design §9 |
| Review/verify/publish | problem §18; design S32–S35, C22–C24; animations M04–M07 |
| Corrections/finalization | problem §22, §25; design S37, S38, S42; animations M08–M10 |
| Authorization/security | problem §27; reference §3, §12; tech-stack §3.5 |
| Any screen | design §8 entry, §11 row, §12, §14; animations §7–§8 for its IDs |

## 1.3 What to report immediately

Report (do not silently work around): contradictions between documents (check reference §18 first), a missing decision that blocks the task (check §16), an endpoint the UI needs that is not in reference §8, a design element that conflicts with accessibility or an unresolved business rule, or a repository state that contradicts the pack.

## 1.4 Conflict and gap rules

- Two sources disagree: follow the precedence table (reference §1.2), find the `CF-###`, and state which resolution you used. Use a recommendation **only if** it is marked a pack default and the work cannot wait; log it in your completion report. Otherwise stop that part and escalate.
- Information is missing: look up `DEC-###`; use the **[PACK-DEFAULT]** behind configuration; never invent values (scoring tables, tie-breaks, upload limits, retention, thresholds, accuracy claims, official Free Fire rules).
- Never edit source documents to make them agree. Propose a change in your report.

---

# 2. Coding behavior (non-negotiable)

1. **Build real end-to-end functionality**, not only attractive UI. A slice is done when frontend, API, database, and tests work together.
2. **No hard-coded mock data** outside clearly designated fixtures or demo seeds (labelled illustrative, disabled in production). No placeholder buttons, no fake success states, no optimistic "Published/Verified" before the server confirms (design DR-07, animations MP-5/MP-6).
3. **Follow the approved stack and existing code conventions.** Adding a dependency requires a stated reason and, for anything beyond the fixed three, an approved `DEC-###`.
4. **Secrets only via environment variables**; never commit, log, or ship them to the client; use placeholders in docs.
5. **Validate on the backend** every input even if the frontend validates it. **Enforce permissions on the server** with role/scope checks and object-level checks. Never rely on hidden UI.
6. **Never let the browser determine official scores, ranks, totals, eligibility, state, or authorization.** Reject or ignore client-supplied values for these. The UI displays server values only (DR-16, tech-stack §4.3).
7. **Schema changes only through migrations** (forward-only, reviewed). Integrity rules (unique/partial indexes, CHECKs, foreign keys, immutability) live in SQL, not only in application code. No destructive command or data-loss migration without explicit approval.
8. **Keep business logic out of UI components and route handlers.** Layering: routes → controllers → services → (domain, repositories, adapters). State machines, scoring, ranking, normalization, and matching tiers are **pure functions in `domain/`** with no Express/DB imports.
9. **Keep OCR, matching, scoring, and publication separate.** OCR reads text; matching suggests candidates; a human confirms; verification locks; scoring computes; publication releases. Do not collapse stages.
10. **Preserve raw data.** Never overwrite raw IGN, raw OCR output, or original evidence. Human corrections are separate, audited records. Evidence is retired, never deleted.
11. **Never silently auto-approve an ambiguous or low-confidence player match.** The system never sets `Confirmed/Overridden/Rejected/Ignored`. Ambiguous/Collision/Unknown/Unreadable rows block Verify until a human decides. Approximate roster IGNs require explicit acknowledgement.
12. **Official data flows only Draft → Verified → Published.** Verify and Publish are separate acts and never share a button group (DR-10). No bulk approve/verify/publish (DR-08).
13. **Handle loading, empty, success, failure, retry, offline, stale, and permission-denied states** for every screen per design §11, using the exact vocabulary in design §10.3 (single catalog; no synonyms).
14. **Follow design and animation documents exactly**; do not invent visual patterns, tokens, or motion. Respect accessibility and `prefers-reduced-motion`; every motion has a static equivalent and an announcement for outcomes. Animate `transform`/`opacity` only; never animate credentials, IGN text, scores arithmetic, or evidence.
15. **Audit every state-changing endpoint** in the same transaction. Use idempotency keys, optimistic `version` checks, and transactions with row locks where the reference requires them.
16. **Never expose** credentials, payment evidence, raw screenshots, contact details, or unpublished results to unauthorized users; never log credentials or tokens.
17. **Avoid unnecessary dependencies and over-engineering.** No microservices, Redis, queues, or extra infrastructure beyond what the approved decisions state.
18. **Do not claim** accuracy, speed, or accessibility conformance that has not been measured/tested (D14, DR-20).
19. **Do not implement items marked [VALIDATE]/COULD/OPEN** unless the phase and a decision explicitly include them.
20. **Do not put unrelated project content into this product.** Only the five source documents and this pack are inputs.

---

# 3. Task execution protocol

For every assigned task:

1. **State the objective and acceptance criteria** (phase ID, `REQ-###`, `TEST-###`).
2. **Identify source sections and dependencies** (documents, `DEC-###`, `CF-###`, other phases).
3. **Inspect related code and tests** in the repository.
4. **Check blockers.** If a needed decision is unresolved and has no safe default, stop and report.
5. **Implement the smallest complete vertical slice** (contract → backend → frontend → tests).
6. **Add or update tests** named with `TEST-###` and edge-case IDs; use a real PostgreSQL for integrity-critical tests; fakes for OCR/storage faults.
7. **Run the relevant checks** (lint, type-check, unit, integration, E2E as applicable) and record the **actual** commands and results.
8. **Check for regressions** and for permission, data-integrity, audit, and idempotency gaps (§2 items 5–16).
9. **Update documentation** if behavior or contracts changed (reference §8 contracts, decision log, runbooks).
10. **Summarize**: files changed, decisions made, tests run, remaining gaps.

**Honesty rule:** never state that tests passed unless you ran them and they passed. If you could not run a check, say so and why. Do not paper over failures; report them with the output.

---

# 4. Completion report template

```
## Completion report
Task / Phase:            <PHASE-### and task title>
Requirements addressed:  <REQ-### list>   Source sections: <doc §>
Files created/changed:   <paths + one-line purpose each>
Database changes:        <migration filenames; constraints/indexes added>
API changes:             <API-### added/changed; request/response/error changes; contract file updated?>
Tests added/updated:     <TEST-### + files>
Tests run and outcomes:  <exact commands> -> <exact results (pass/fail counts)>; not run: <what and why>
Manual verification:     <steps performed and observed results; devices/viewports>
Defaults used:           <DEC-### / CF-### pack defaults relied on>
Known limitations:       <honest list>
Open decisions:          <new or still-blocking DEC-###>
Security review:         <authz, validation, audit, secrets, privacy checks performed>
Accessibility review:    <keyboard, focus, contrast, live regions, reduced motion>
Documentation updated:   <files>
Next safe task:          <what can proceed without further decisions>
```

---

# 5. Agent boundaries and handoffs (multiple agents)

1. **Ownership by module/file boundary.** Each agent owns whole modules (reference §6.2) or screens. No two agents edit the same file in the same phase.
2. **Shared contracts have one owner.** `packages/shared` (schemas, enums, status types, error codes), the OpenAPI output, routing configuration, the status-vocabulary catalog, and the design/motion token files are edited by a single designated owner per phase; others request changes.
3. **Agree schemas and interfaces before parallel implementation.** Frontend and backend slices start only after the `API-###` contract and shared schemas for that slice are frozen and merged. Never invent endpoints; add them to the reference first.
4. **Migrations are sequential.** One agent owns migrations per phase; never edit an applied migration; rebase/renumber conflicts rather than merging concurrently.
5. **Integration tests after every merge** of work that crosses modules; run the full CI suite; fix regressions before continuing. Integration checkpoints IC-1/IC-2/IC-3 (phases doc) are mandatory gates.
6. **Disagreements** are resolved by: (a) the source documents per the precedence table, (b) the Open Decisions Register and conflict register, (c) escalation to the Owner. Do not resolve by preference or by whichever change merges first.
7. **Handoff notes** use the completion-report template plus: branch/commit reference, contract changes, and what the next agent must not touch.
8. **Learning-mode modules (`CF-002`/`DEC-012`).** Unless the Owner states otherwise, for integrity-critical modules (state-transition tables, scoring functions, authorization checks, slot-assignment transaction, normalization/matching tiers) work in propose-and-explain mode: write tests first, explain the design in the report, and expect human review before merge.

---

# 6. Quick prohibitions checklist (read before every commit)

- [ ] No score/rank/total computed or trusted from the client
- [ ] No endpoint without role/scope policy, schema validation, error codes, and audit
- [ ] No Confirmed identity set by the system; no preselected Ambiguous/Collision/Unknown candidate
- [ ] No Draft/Verified/unpublished data on any public or participant response
- [ ] No credentials, payment proofs, or raw screenshots outside authorized, logged, short-lived access
- [ ] No raw IGN / raw OCR / evidence overwritten or deleted
- [ ] No hard-coded scoring table, tie-break, upload limit, retention period, or threshold presented as approved
- [ ] No unapproved dependency; no secrets in the repository or logs
- [ ] No fake success states; no motion that blocks or hides status; reduced-motion equivalent present
- [ ] Vocabulary from the single catalog; screens follow design.md and animations.md
- [ ] Tests actually run; results reported honestly
