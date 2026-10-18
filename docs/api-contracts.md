# Implemented API contracts

All routes use `/api/v1`. This lists only routes that exist. The larger `implementation_reference.md` remains a specification.

| Route | Authorization | Behavior |
|---|---|---|
| GET `/health/live` | Public | Process liveness only. |
| GET `/health/ready` | Operator Bearer token | Verifies PostgreSQL and migration version 6. |
| GET `/meta/config` | Public | Safe development configuration; uploads disabled, registration available per event. |
| POST `/auth/register` | Public | Creates a captain account. |
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
| POST `/admin/registrations/:id/decision` | Admin session + CSRF | Approve, reject or request correction. Approval checks roster, identity flags, payment, eligibility and capacity. |
| GET `/admin/tournaments/:id/slots`, PUT `/admin/tournaments/:id/slots/:slot` | Admin session; PUT needs CSRF | List or assign capacity-bounded slots to approved teams. |

Scoring accepts non-negative decimal strings with up to three decimal places, a consecutive placement table, optional kill cap, ordered tie-break fields ending in an admin decision, disqualification policy and cancelled-match policy. The application has **no official or implied default points table**. Each template revision and tournament ruleset stores its own copy of configuration. PostgreSQL triggers prevent changing those copies or deleting audit events.

Errors carry a code, plain message and server-generated UUID `correlation_id`. Invalid rule fields include `details`. CORS accepts exactly `WEB_ORIGIN`; session cookies are HttpOnly and SameSite Strict, and HTTPS makes them Secure. Mutations require a CSRF token from the session. Request URLs, payloads, cookies, tokens and database strings are excluded from application logs. Unknown public API routes return JSON 404.

Current limits: payment proof intake/review, roster account invitations, room credentials, match results, standings, evidence/OCR and recovery operations remain pending. Paid entries can only advance through a reasoned waiver at present; no normal paid-event path is claimed. The operator readiness token is separate from account sessions and never sent to the browser.
