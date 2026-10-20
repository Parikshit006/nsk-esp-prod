# Implemented API contracts

## October 20 additions

- Roster writes preserve the raw in-game name and append a versioned Unicode search form; migration backfills existing players. Captain and organizer roster details include a boolean `possible_name_collision` when formatting-insensitive comparison finds a name on another active team in the event. No other team's name is returned, and the warning does not block registration or claim the players are identical.
- Manual result rows accept `player_kills[].did_not_play: true` only with zero kills and a 10–500 character `dnp_reason`. A plain zero kills entry means the player participated without eliminations. The marker and reason remain in the private versioned result draft for review and corrections.
- `pnpm ops:ocr-benchmark` reads the two local `refs` images and their user-provided labels. It reports only line-level coverage of names marked visible; it deliberately does not report placement or kill accuracy because the current OCR is unstructured. Images must be supplied locally and are not bundled into the repository.
- `POST /auth/request-password-reset`, `POST /auth/reset-password`: generic email request response with per-email/IP throttling; one-use 30-minute email link resets the password, consumes outstanding links and revokes all sessions. Production requires SMTP settings; no email is sent by the local tests.
- `POST /auth/verify-email`, `POST /auth/resend-verification`: one-use 24-hour email verification for new accounts, with throttled resend. Unverified captains and members can sign in to resend but cannot mutate tournament records or view protected room details. Local development without SMTP auto-verifies signups; production requires email delivery configuration.
- JSON POST/PUT/PATCH/DELETE under `/api/v1` may carry a 16–128 character `Idempotency-Key`. For authenticated writes with CSRF, the same account, role, path and body replay the saved 2xx response; a different request using that key returns 409. An in-progress first request returns 409 with `Retry-After`. Failed responses release the key. Completed responses become eligible for lazy cleanup after 24 hours on that account's next keyed write. Auth routes, raw uploads and roster invitation-link creation are excluded; a crashed in-progress JSON request needs operator reconciliation before a same-key retry can be trusted. The three screenshot upload routes recognize a repeat of the latest identical image and metadata, returning 200 with `Idempotency-Replayed: true` and the existing record instead of creating another.
- `GET /admin/organizers`, `POST /admin/organizers`, `POST /admin/organizers/:id/invite`, `POST /admin/organizers/:id/status`: super-admin organizer list, email activation, resend and reasoned enable/disable. An organizer cannot sign in before activation; disabling revokes sessions and open reset links.
- `GET/POST /registrations/:id/roster-change-requests`, `GET /admin/tournaments/:id/roster-change-requests`, `POST /admin/roster-change-requests/:id/decision`: captain requests a change after registration closes and before room release or match start; organizer approval applies it, invalidates affected player links and prior team/eligibility review, and triggers notices. Rejection preserves the live roster.
- `POST /admin/registrations/:id/release-slot`: reasoned organizer release before match operations, with an immutable slot history and notification. Existing slot assignment accepts a released registration for reassignment.
- `POST /disputes/:id/evidence`, `GET /disputes/:id/evidence`: owning captain may attach one immutable, sanitized PNG/JPEG screenshot of up to 5 MB while the report is open and within its filing window. Only that captain and admins can view it. Public disputes and standings never expose the image.
- `POST /auth/change-password`: signed-in user supplies current and new passwords with CSRF. Five attempts per 15 minutes; a successful change revokes all sessions and requires a fresh sign-in. `/auth/me` returns a stable CSRF token for the session so other open tabs do not invalidate forms.
- `GET /admin/tournaments/:id/finalization-history`: immutable finalization and reopening history for organizers.
- `POST /admin/tournaments/:id/reopen`: super admin only; Completed event, expected version and reason required. Withdraws the current public podium, preserves the former finalization, records an audit/reopening event and recomputes a review snapshot from frozen rules. The normal checklist and finalize path apply again.

## October 19 additions

- `POST /admin/evidence/:id/ocr`, `GET /admin/evidence/:id/ocr`: admin-only local reading queue and status. Duplicate requests reuse the same job; the worker has leases and three attempts. Output never modifies scores or confirms identities.
- `POST /registrations/:id/roster-edit`: owning captain supplies entry ID, current registration version, corrected fields and reason. Only unapproved Draft/NeedsCorrection registrations before the deadline. Clears identity/eligibility review and player account/invite links.
- `POST /admin/matches/:id/reschedule`: version, timezone-qualified start/end, reason. Future Scheduled/Ready rounds only, within event bounds and without overlap. Returns to Scheduled, versions any credential release and atomically creates in-app notices.
- `GET /me/notifications`, `POST /me/notifications/:id/read`: only the authenticated recipient; latest 100 notices. Read acknowledgement is idempotent. No room secrets or payment-proof contents in notices.
- Tournament `cancel` now cascades through registrations, slots, invitations, credentials, attempts and pending results; original evidence is retained. Open reports receive an explicit cancellation disposition. Previously published cancelled event details remain accessible by their existing URL; draft events remain private.
- `GET /admin/tournaments/:id/refund-reviews`, `POST /admin/refund-reviews/:id/decision`, `GET /me/refund-reviews`: cancellation proof review and audited off-platform outcome. An admin cannot decide their own team's refund; captains see only their own records. This records an organizer decision and does not move money. Resolved reviews cannot be overwritten.

All routes use `/api/v1`. This lists only routes that exist. The larger `implementation_reference.md` remains a specification.

| Route | Authorization | Behavior |
|---|---|---|
| GET `/health/live` | Public | Process liveness only. |
| GET `/health/ready` | Operator Bearer token | Verifies PostgreSQL and migration version 24. |
| GET `/meta/config` | Public | Safe configuration; private evidence and payment-proof uploads available, registration available per event. |
| POST `/auth/register` | Public | Creates a captain or member account (`account_type`, captain by default). |
| POST `/auth/login` | Public | Email/password login, generic failure, five attempts per 15-minute email/IP window, revocable 8-hour session cookie and CSRF token. |
| GET `/auth/me` | Account session | Current account and refreshed CSRF token. |
| POST `/auth/logout` | Account session + CSRF | Revokes the session. |
| GET, POST `/admin/rule-templates` | Admin session; POST needs CSRF | List latest template revisions or save a validated new template. |
| POST `/admin/rule-templates/:id/revisions` | Admin session + CSRF | Save a new immutable revision with `expected_revision`. |
| GET, POST `/admin/tournaments` | Admin session; POST needs CSRF | List or create draft tournaments. |
| GET, PATCH `/admin/tournaments/:id` | Admin session; PATCH needs CSRF | Read event setup or edit draft config with `expected_version`. |
| POST `/admin/tournaments/:id/matches` | Admin session + CSRF | Add a draft match after overlap and version checks. |
| POST `/admin/tournaments/:id/validate` | Admin session + CSRF | Publication blocker report. |
| POST `/admin/tournaments/:id/transition` | Admin session + CSRF | Publish, open/close registration, or cancel through guarded transitions. |
| GET, POST `/admin/tournaments/:id/rulesets` | Admin session; POST needs CSRF | List immutable tournament ruleset versions; copy exact template revision or create from custom rules with `expected_version`. |
| POST `/admin/rulesets/:id/confirm` | Admin session + CSRF | Confirm only the latest draft version with `expected_version`. |
| POST `/admin/rulesets/:id/preview` | Admin session + CSRF | Server-calculated illustrative score breakdown; never stored as a result. |
| GET `/tournaments`, GET `/tournaments/:id` | Public | Published event list/detail, schedule and confirmed scoring rules. No private registration fields. |
| POST `/teams`, GET `/me/teams` | Captain session; POST needs CSRF | Create or list own teams. |
| GET `/me/registrations` | Account session | Own registration summaries. |
| POST `/tournaments/:id/registrations` | Captain session + CSRF | Create a draft during an open registration window. |
| GET `/registrations/:id` | Captain owner | Own registration and raw roster. |
| POST `/registrations/:id/roster`, POST `/registrations/:id/submit` | Captain owner + CSRF | Add a player, then submit a complete roster with optimistic version checks. |
| GET `/admin/tournaments/:id/registrations`, GET `/admin/registrations/:id` | Admin session | Review queue and detail. |
| POST `/admin/roster-entries/:id/confirm-ign` | Admin session + CSRF | Human confirmation of an unclear IGN, with note and audit. |
| POST `/admin/registrations/:id/eligibility` | Admin session + CSRF | Verify or reject eligibility with recorded note. |
| POST `/admin/registrations/:id/payment-waiver` | Admin session + CSRF | Exception for a paid entry with recorded reason. |
| POST `/registrations/:id/payment-proofs`, GET `/registrations/:id/payment-proofs` | Captain owner; POST needs CSRF | Submit a PNG/JPEG proof with reference, paid amount and optional transaction ID, or list own private proof history. The tournament sets its maximum upload size (64 KB–10 MB). Submitted files are decoded and re-encoded without image metadata; proof bytes and history are immutable. |
| GET `/admin/registrations/:id/payment-proofs` | Admin session | Private proof metadata and possible same-image/reference flags within the tournament. |
| GET `/payment-proofs/:id/image` | Proof owner or admin | View private sanitized image. |
| POST `/admin/payment-proofs/:id/decision` | Admin session + CSRF | Human verify, reject or reverse with note and optimistic version. Verification requires exact fee amount and explicit acknowledgement of possible duplicates. |
| POST `/admin/registrations/:id/payment-recheck` | Admin session + CSRF | Record a fresh check after reversal of an approved team's payment; gated room access remains closed until then. |
| POST `/admin/registrations/:id/decision` | Admin session + CSRF | Approve, reject or request correction. Approval checks roster, identity flags, payment, eligibility and capacity. |
| GET `/admin/tournaments/:id/slots`, PUT `/admin/tournaments/:id/slots/:slot` | Admin session; PUT needs CSRF | List or assign capacity-bounded slots to approved teams. |
| POST `/registrations/:id/roster/:entry/invitations` | Captain owner + CSRF | Create an email-bound, one-time, 48-hour player invitation; returns its private link once. |
| POST `/invitations/accept` | Invited account + CSRF | Bind an active roster entry to the matching account; rejects expired, revoked or already-used tokens. |
| GET `/me/linked-matches` | Account session | List non-cancelled matches for linked members of approved, slotted teams. |
| POST `/registrations/:id/withdraw` | Captain session + CSRF | Reasoned withdrawal before any match attempt in an open or closed registration phase. Requires expected version; releases an assigned slot, revokes pending invitations and room access, and retires active roster links. Refunds remain outside the platform. |
| GET, POST `/admin/matches/:id/credentials` | Admin session; POST needs CSRF | Read metadata only or encrypt and rotate match room details with optimistic version and release time. |
| GET `/matches/:id/credentials` | Linked approved/slotted roster account | Return active decrypted details only after release; every successful view is audited. |
| GET `/admin/matches/:id`, POST `/admin/matches/:id/transition` | Admin session; POST needs CSRF | Read attempt history; guarded ready/start/finish/interrupt/restart/cancel with version checks and reason for interruption, restart or cancellation. Starting freezes the confirmed rule set. Cancellation revokes current room details and updates standings according to configured policy. |
| GET, POST `/admin/matches/:id/evidence` | Admin session; POST needs CSRF | List metadata or upload a decoded PNG/JPEG screenshot up to 5 MB, hashed and immutable per attempt. |
| GET `/admin/evidence/:id/image` | Admin session | View original private evidence. |
| GET, POST `/admin/matches/:id/results` | Admin session; POST needs CSRF | List version metadata or save a complete manual draft linked to current-attempt evidence and frozen rules. |
| GET `/admin/results/:id`, POST `/admin/results/:id/verify`, POST `/admin/results/:id/publish` | Admin session; POST needs CSRF | Inspect draft; score with configured rules after verification; publish atomically with a new standings snapshot. |
| GET `/matches/:id/results`, GET `/tournaments/:id/standings` | Public | Only published match versions and standings snapshots; pending drafts stay private. |
| POST `/admin/registrations/:id/disqualify` | Admin session + CSRF | Record a reasoned, immutable disqualification of an approved, slotted team in an active event. Requires expected registration version; the tournament's frozen policy governs retained or voided points and placement shifts. For `void_from_disqualification`, the admin selects an effective scheduled match number. Recomputes published standings and removes the team from podium eligibility. |
| GET `/me/dispute-options`, GET `/me/disputes`, POST `/matches/:id/disputes` | Captain session; POST needs CSRF | List eligible published matches within the tournament's configured reporting window; a captain may submit one text issue per team and match and track the organizer response. Zero hours disables new reports. |
| GET `/admin/tournaments/:id/disputes`, POST `/admin/disputes/:id/decision` | Admin session; POST needs CSRF | Review reports, reject with an explanation or uphold after a newer published result correction. Decisions and status changes are audited; an admin cannot decide a dispute involving their own team. |
| GET `/admin/tournaments/:id/finalization-checklist` | Admin session | Match/result blockers, latest immutable standings snapshot, unresolved podium tie groups and recorded decisions. |
| PUT `/admin/tournaments/:id/tie-resolution` | Admin session + CSRF | Order every team in an unresolved podium tie for the current snapshot, with reason and optimistic tournament version. |
| POST `/admin/tournaments/:id/finalize` | Admin session + CSRF | Complete only after all matches and results are settled and podium ties are decided; store immutable podium from the reviewed snapshot. |
| POST `/admin/tournaments/:id/transition` (`archive`) | Admin session + CSRF | Require the completed event's current version and an archive reason; keep its final podium publicly readable. |
| GET `/tournaments/:id/podium` | Public | Final podium only for Completed or Archived tournaments. |

Scoring accepts non-negative decimal strings with up to three decimal places, a consecutive placement table, optional kill cap, ordered tie-break fields ending in an admin decision, disqualification policy and cancelled-match policy. The application has **no official or implied default points table**. Each template revision and tournament ruleset stores its own copy of configuration. PostgreSQL triggers prevent changing those copies or deleting audit events.

Errors carry a code, plain message and server-generated UUID `correlation_id`. Invalid rule fields include `details`. CORS accepts exactly `WEB_ORIGIN`; session cookies are HttpOnly and SameSite Strict, and HTTPS makes them Secure. Mutations require a CSRF token from the session. Request URLs, payloads, cookies, tokens and database strings are excluded from application logs. Unknown public API routes return JSON 404.

Current limits: OCR is review-only; structured screenshot extraction remains pending. Manual result entry is available with original screenshots; the system does not claim reliable image extraction. Paid entry verifies an externally made payment from submitted evidence and an organizer decision; it does not collect or settle money. The operator readiness token is separate from account sessions and never sent to the browser.
