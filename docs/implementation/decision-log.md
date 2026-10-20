# Working decisions

18 October 2026. Authority: the user's current instruction authorizes engineering choices, code, tests, commits and pushes; it supersedes the older manual-copy/Antigravity-only process. These are agent-selected working decisions under that authorization, not fabricated organizer approvals.

## Foundation

- DEC-001: TypeScript strict.
- DEC-002: PostgreSQL through `pg` and explicit forward-only SQL migrations (an option in tech-stack §3.3). This keeps partial indexes, transactions and triggers visible without ORM abstraction.
- DEC-003: email/password and PostgreSQL-backed revocable cookie sessions; memory-hard password hashing, CSRF and non-enumerating errors before account workflows ship.
- DEC-011: Node 24 LTS, verified against https://nodejs.org/en/download; use isolated runtime without replacing the user's global Node.
- DEC-012 / CF-002: agent implementation authorized by the current request, with integrity tests and explanations. No requirement for the user to manually paste backend files.
- Tooling: pnpm workspaces, Vite/React, TypeScript, Zod contracts, Vitest and Playwright, ESLint; `pg` for SQL, Express for HTTP, Helmet for headers. Add feature dependencies only when the slice needs them. Plain CSS using specified tokens avoids unnecessary UI libraries at foundation stage.
- Compatibility exception verified during installation: TypeScript 7.0.2 is latest but typescript-eslint 8.71.2 explicitly rejects it (supported range <6.1). Pin TypeScript 6.0.3 with Node 24 types; peer check then passes. Dependency versions are exact and locked. Permit only esbuild's required installation script. Fontsource bundles self-hosted Inter/Barlow under OFL; no external font requests.

## Conservative scope defaults

DEC-004/031/033/034: no real OCR engine or calibrated thresholds selected without corpus. DEC-005: local private storage for development; production undecided. DEC-006/020/048: hosting, retention and recovery objectives remain launch blockers. DEC-007: in-app only. DEC-008/009/017/036/037/039/040/046/047: defer banners, trigram shortlist, waitlist, uploader role, dark theme, JS motion library, motion preference setting, learned aliases and team-totals-only variant. DEC-010: target AA behavior, no conformance claim before testing.

DEC-013/014: blank organizer-configured rules/tie-breaks; illustrative values only in tests. DEC-015: post-lock changes require admin decision. DEC-016: refunds off-platform. DEC-018: support rotation as platform action without claims about game-side rotation. DEC-019: explicit tournament DQ policy; proposed keep-points/exclude-podium is not an approved event rule. DEC-021: freeze first match start. DEC-022/023: defer disputes and second-admin feature. DEC-024: controlled platform-admin reopen. DEC-025: team ranks public, individual data restricted. DEC-026: bootstrap super-admin, defer organizer-management screen. DEC-027: single organizer initial scope. DEC-028: manual proof review and reference text. DEC-029: tournament-configured eligibility. DEC-030: restart creates isolated attempt; partial-result policy unresolved. DEC-032: no invented in-game menu instructions. DEC-035/050: captain direct roster entry; credentials only for authenticated linked members. DEC-038: small-screen review/urgent actions; configuration optimized for desktop. DEC-041: mandatory configured upload limits before upload slice, no guessed corpus-derived limits. DEC-042: Asia/Kolkata default, explicit timezone display, per-tournament field. DEC-043: polling, no timing claims. DEC-044: roster-only submit, payment can follow. DEC-045: detailed §13 match states, delayed flag, completion derived from current published results/cancellation. DEC-049: block offline writes. DEC-051: PostgreSQL jobs, mechanism evaluated at job slice.

19 October 2026 — User decision for DEC-013/014 and Q-07/Q-10: each tournament's admin chooses all scoring and tie-break rules. Rules must be customizable per tournament, and an admin must be able to save and reuse a template. A template is copied into a tournament's own versioned ruleset; editing a template cannot silently change an existing tournament. No example Free Fire MAX table becomes a default or official rule.

20 October 2026 — The earlier DEC-026 screen deferral is superseded by the user's request to complete the remaining modules. The super admin can now invite, disable and reenable organizer accounts. Invites use one-use email links; the new organizer has no usable password until activation. SMTP service selection and actual delivery verification remain deployment tasks.

20 October 2026 — The organizer specified that result screenshots show placements 1–10; placements 11 and 12 are entered manually. OCR may suggest visible teams, names and kills, but uncertain values stay blank and an organizer must review, verify and publish. The suggested 12/9/8/7/6/5/4/3/2/1/0/0 plus one point per kill remains a configurable per-tournament default and reusable template, not a hard-coded scoring rule. Google and Discord were selected for the final OAuth integration, and deployment will use an AWS-hosted server rather than a non-AWS own server. The AWS account, region and domain are not yet available. Local Google and Discord credentials were configured on 20 October 2026; Google sign-in and Discord account linking were confirmed, while a fresh Discord sign-in remains to be checked.

Free events: `NotRequired` is the payment state for a zero-fee tournament and satisfies the approval payment gate. Paid events require `Verified` or a reasoned `Waived` decision. Captains upload a private proof of payment made outside the platform; an organizer checks the exact amount, reference, screenshot and possible duplicates before verification. A waiver is exceptional, never a fake verification. Captains may submit a complete roster before payment review. Reversing verification on an approved team requires a fresh recorded review before room access returns. Publishing is available for development and trials while remaining match-day and launch operations are built.

## Existing conflict register disposition

| Conflict | Working interpretation |
|---|---|
| CF-001/015 | Preserve fixed React/Express/PostgreSQL; TypeScript and explicit SQL; no Supabase-auth substitution. |
| CF-002 | Current request authorizes implementation (above). |
| CF-003 | Manual first, then safe OCR wiring; real provider selection awaits evidence. |
| CF-004 | DEC-045; add explicit manual transition before manual workflow. |
| CF-005 | Payment optional at submission, mandatory Verified/Waived at approval. |
| CF-006 | Stored problem enums, centralized design labels. |
| CF-007/008/009 | Use A-xx; retention/freeze split DEC-020/021; custom training reference means §8.3/8.4. |
| CF-010 | Immutable bytes, audited attachment changes. |
| CF-011/012/013 | Responsive review; uploader and app motion setting deferred. |
| CF-014 | Authenticated linked roster members only; no anonymous credentials. |
| CF-016/017/018 | Restricted player stats; bootstrap super-admin; similarity warning must not reveal another team's IGN. |
| CF-019 | Every identity confirmation requires a human. |
| CF-020 | At capacity block approval; waitlist deferred. |

Additional source discrepancies and acceptance consequences are recorded in audit-readiness.md. Original source documents remain unchanged; these addenda make interpretation reviewable.
