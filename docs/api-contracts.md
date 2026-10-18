# Implemented API contracts

All routes use `/api/v1`. This lists only routes that exist. The larger `implementation_reference.md` remains a specification.

| Route | Authorization | Behavior |
|---|---|---|
| GET `/health/live` | Public | Process liveness only. |
| GET `/health/ready` | Operator Bearer token | Verifies PostgreSQL and migration version 3. |
| GET `/meta/config` | Public | Safe setup-stage configuration. Registration and uploads remain disabled. |
| POST `/auth/login` | Public | Email/password login, generic failure, five attempts per 15-minute email/IP window, revocable 8-hour session cookie and CSRF token. |
| GET `/auth/me` | Admin session | Current admin and refreshed CSRF token. |
| POST `/auth/logout` | Admin session + CSRF | Revokes the session. |
| GET, POST `/admin/rule-templates` | Admin session; POST needs CSRF | List latest template revisions or save a validated new template. |
| POST `/admin/rule-templates/:id/revisions` | Admin session + CSRF | Save a new immutable revision with `expected_revision`. |
| GET, POST `/admin/tournaments` | Admin session; POST needs CSRF | List or create draft tournament shells. These cannot yet be published. |
| GET, POST `/admin/tournaments/:id/rulesets` | Admin session; POST needs CSRF | List immutable tournament ruleset versions; copy exact template revision or create from custom rules with `expected_version`. |
| POST `/admin/rulesets/:id/confirm` | Admin session + CSRF | Confirm only the latest draft version with `expected_version`. |
| POST `/admin/rulesets/:id/preview` | Admin session + CSRF | Server-calculated illustrative score breakdown; never stored as a result. |

Scoring accepts non-negative decimal strings with up to three decimal places, a consecutive placement table, optional kill cap, ordered tie-break fields ending in an admin decision, disqualification policy and cancelled-match policy. The application has **no official or implied default points table**. Each template revision and tournament ruleset stores its own copy of configuration. PostgreSQL triggers prevent changing those copies or deleting audit events.

Errors carry a code, plain message and server-generated UUID `correlation_id`. Invalid rule fields include `details`. CORS accepts exactly `WEB_ORIGIN`; session cookies are HttpOnly and SameSite Strict, and HTTPS makes them Secure. Mutations require a CSRF token from the session. Request URLs, payloads, cookies, tokens and database strings are excluded from application logs. Unknown public API routes return JSON 404.

Current limits: the admin area covers rule setup only. Draft tournaments lack schedule, registration, payment, match and publication workflows. These APIs must not be presented as a live-event system. The operator readiness token is separate from admin sessions and never sent to the browser.
