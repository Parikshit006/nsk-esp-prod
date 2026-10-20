# Tournament operations

Evidence-first college Free Fire MAX tournament platform. **Current delivery: audited specifications, tournament publication, reusable scoring rules, free and paid-event registration, organizer review and slots, protected room details, manual evidence-backed results, configurable disqualification, result reports, public standings and final podium. This is not yet launch-ready.** Local OCR review assistance, an isolated recovery drill, controlled podium reopening, account recovery and organizer invitations are implemented; broader OCR validation, operational controls and hosting remain unfinished.

Read [audit and readiness](docs/audit-readiness.md), [working decisions](docs/decision-log.md), [delivery progress](docs/progress.md), [implemented API contracts](docs/api-contracts.md), and the [provisional AWS server plan](docs/self-hosting.md). Original specifications are preserved at the repository root.

## Local development

Use Node 24.22.0 and pnpm 12.8.1. PostgreSQL 17 is required. Copy `.env.example` to `.env`; configure DATABASE_URL, WEB_ORIGIN, a random READINESS_TOKEN of at least 32 characters, and a random 32-byte hexadecimal CREDENTIAL_ENCRYPTION_KEY. Configure SMTP to test email verification, recovery and organizer invitations locally; SMTP settings are required in production. Local signups without SMTP are automatically verified for development. Google and Discord OAuth are optional until their application credentials and exact callback URLs are configured; see `docs/self-hosting.md`. Keep the credential key backed up securely: losing it makes saved room details unreadable. A maintenance-window rotation procedure is documented in `docs/self-hosting.md`. Never commit `.env`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
# In another terminal:
pnpm dev:web
```

Open http://127.0.0.1:5173. The Vite server proxies `/api` to port 3000. Use the same origin in `WEB_ORIGIN`. The public page fetches real safe configuration and displays retryable failure states; no mock tournament data is presented as real.

To use the admin workspace, create the first super-admin after migration using `pnpm admin:create admin@example.com`. The command prompts for a password without echoing it. Then open http://127.0.0.1:5173/admin. An admin can save and reuse scoring templates, create and publish a tournament after configuration checks, open its registration window, review submitted teams, verify eligibility and unclear in-game names, approve a team, and assign a slot. The suggested scoring values in the editor become official only when the admin confirms that tournament's rule version. Template revisions cannot alter rules already copied into tournaments.

Captains use http://127.0.0.1:5173/participate to create an account and team, save an optional reusable game profile, enter the event roster, and submit registration when the event window is open. They can create one-time links for individual players while the roster is still a draft. Players use their link at `/join` with the invited email address and can save their own game profile. Existing drafts may still be submitted before every player accepts; linked-account progress is shown to the captain. Paid events display the admin's payment instructions and accept a private PNG/JPEG proof with reference and paid amount. An admin reviews the proof, checks possible duplicate images or references, and verifies or rejects it before team approval. Payment itself takes place outside the platform. Reversing a verified payment closes an approved team's room access until a fresh review. An admin can set and rotate encrypted room details and choose an explicit release time; only linked members of approved, slotted teams with valid payment status can view them afterward. For a round with at least two approved, slotted teams, an admin checks readiness, starts and finishes the match, uploads the original PNG/JPEG result screenshot, reviews suggested OCR fields for the ten visible placements, manually completes the hidden placements and unclear values, verifies scoring, then publishes match and overall standings. Corrections create new result and standings versions. An admin can cancel a match with a reason; standings then use that event's configured cancelled-match policy. After every match is settled, final review checks for pending work and unresolved podium ties. The admin records a reasoned order for any tie before publishing the immutable final podium. The optional screenshot assistant reads text locally with a bundled English model. Its suggested fields require explicit organizer action and review; they do not publish scores. Use this locally for development and trials while the remaining launch operations are completed.

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

Captains can attach private evidence to result reports, request post-lock roster corrections for organizer review and withdraw before matches begin. Paid-entry withdrawals with a proof open a private organizer refund review, as cancellations do; the actual payment or refund remains outside the platform. Organizers can release and reassign slots before match operations; an admin can move a published, unstarted event with all its rounds and room-release times, or archive a completed event while keeping its podium public. A super admin can reopen a completed event for correction while retaining prior finalization history. Versioned player-name search forms and private possible-collision warnings help manual identity review without asserting a match. Manual results allow reasoned did-not-play marking and a zoomable screenshot review. The OCR assistant recognizes two supplied two-column screenshot variants and creates review rows for their ten visible placements. The organizer may copy uniquely matched teams and readable kill hints into the result form, must enter hidden placements 11 and 12 and all uncertain values manually, and must verify every official result. JSON writes support optional idempotency keys, and identical match, dispute and payment screenshot uploads can be retried without duplicate records. Production operations remain required before launch. Initial user-provided screenshot labels are in `refs/result-labels.json`; a broader, independently labeled sample is needed to estimate OCR accuracy. The 12-month private-evidence deletion workflow is implemented; hosting, server recovery measurements and remaining operational targets still need verification. The admin chooses scoring rules and the result-reporting window per tournament; reusable scoring templates are available. The rule editor starts with the suggested 12/9/8/7/6/5/4/3/2/1/0/0 placement points and one point per kill, and admins can change these per event.
