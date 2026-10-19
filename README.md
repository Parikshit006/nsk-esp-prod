# Tournament operations

Evidence-first college Free Fire MAX tournament platform. **Current delivery: audited specifications, tournament publication, reusable scoring rules, free and paid-event registration, organizer review and slots, protected room details, manual evidence-backed results, configurable disqualification, result reports, public standings and final podium. This is not yet launch-ready.** Local OCR review assistance, an isolated recovery drill, controlled podium reopening, account recovery and organizer invitations are implemented; structured extraction, remaining event workflows, operational controls and hosting remain unfinished.

Read [audit and readiness](docs/audit-readiness.md), [working decisions](docs/decision-log.md), [delivery progress](docs/progress.md), [implemented API contracts](docs/api-contracts.md), and the [provisional self-hosting plan](docs/self-hosting.md). Original specifications are preserved at the repository root.

## Local development

Use Node 24.22.0 and pnpm 12.8.1. PostgreSQL 17 is required. Copy `.env.example` to `.env`; configure DATABASE_URL, WEB_ORIGIN, a random READINESS_TOKEN of at least 32 characters, and a random 32-byte hexadecimal CREDENTIAL_ENCRYPTION_KEY. Configure SMTP to test email verification, recovery and organizer invitations locally; SMTP settings are required in production. Local signups without SMTP are automatically verified for development. Keep the credential key backed up securely: losing it makes saved room details unreadable. Never commit `.env`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
# In another terminal:
pnpm dev:web
```

Open http://127.0.0.1:5173. The Vite server proxies `/api` to port 3000. Use the same origin in `WEB_ORIGIN`. The public page fetches real safe configuration and displays retryable failure states; no mock tournament data is presented as real.

To use the admin workspace, create the first super-admin after migration using `pnpm admin:create admin@example.com`. The command prompts for a password without echoing it. Then open http://127.0.0.1:5173/admin. An admin can save and reuse scoring templates, create and publish a tournament after configuration checks, open its registration window, review submitted teams, verify eligibility and unclear in-game names, approve a team, and assign a slot. No scoring values are preselected as official rules. Template revisions cannot alter rules already copied into tournaments.

Captains use http://127.0.0.1:5173/participate to create an account and team, enter the event roster, and submit registration when the event window is open. After submission, they can create one-time links to connect players to individual roster entries. Players use their link at `/join` with the invited email address. Paid events display the admin's payment instructions and accept a private PNG/JPEG proof with reference and paid amount. An admin reviews the proof, checks possible duplicate images or references, and verifies or rejects it before team approval. Payment itself takes place outside the platform. Reversing a verified payment closes an approved team's room access until a fresh review. An admin can set and rotate encrypted room details and choose an explicit release time; only linked members of approved, slotted teams with valid payment status can view them afterward. For a round with at least two approved, slotted teams, an admin checks readiness, starts and finishes the match, uploads the original PNG/JPEG result screenshot, enters placements and player kills, verifies scoring, then publishes match and overall standings. Corrections create new result and standings versions. An admin can cancel a match with a reason; standings then use that event's configured cancelled-match policy. After every match is settled, final review checks for pending work and unresolved podium ties. The admin records a reasoned order for any tie before publishing the immutable final podium. The optional screenshot assistant reads text locally with a bundled English model. Its output is review-only; admins must explicitly enter placements and kills, without prefilled scores. Use this locally for development and trials while the remaining launch operations are completed.

For database-only Docker use, set POSTGRES_PASSWORD and run `docker compose up -d db`. For the complete production container, also set an HTTPS WEB_ORIGIN, READINESS_TOKEN, credential key and SMTP settings, then run `docker compose up --build`. A reverse proxy must provide HTTPS; the container binds to loopback. Docker execution requires a running Docker engine. No public deployment has been performed.

## Verification

Create a **separate** database whose name ends in `_test`; set DATABASE_URL_TEST. Integration tests create a unique schema in it, apply migrations and remove only that schema afterwards. They fail if no test database is configured, rather than substituting a fake database.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests launch the API in a unique schema in `DATABASE_URL_TEST` and clean it up after the run. They exercise tournament creation and publication, free and paid registration and review, proof submission and verification, slot assignment, room release, a linked player's invitation, match lifecycle, screenshot upload, manual verification and public standings on desktop and mobile. Production output serves the SPA and API together with `pnpm start` after `pnpm build` and migration. SQL migrations are serialized with an advisory lock, transactionally applied and checksum-protected against edits after application.

## Architecture

- `apps/api/src`: Express, configuration, sessions, tournament setup, registration, review, slots, migrations and health routes.
- `apps/api/db/migrations`: forward-only PostgreSQL schema.
- `apps/web/src`: responsive React public event pages, admin and captain workspaces, and truthful system pages, specified light/ink tokens and self-hosted fonts.
- `packages/shared`: validated response contracts, pure exact-decimal preview scoring and exact status catalog.
- `tests`: unit/database integration and desktop/mobile browser acceptance checks.

Remaining phases include measured OCR assistance. Captains can attach private evidence to result reports, request post-lock roster corrections for organizer review and withdraw before matches begin. Organizers can release and reassign slots before match operations; an admin can archive a completed event while keeping its podium public. A super admin can reopen a completed event for correction while retaining prior finalization history. Idempotency and production operations remain required before launch. A labeled screenshot corpus, hosting, retention and recovery objectives are still needed. The admin chooses scoring rules and the result-reporting window per tournament; reusable scoring templates are available.
