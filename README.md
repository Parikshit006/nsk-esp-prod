# Tournament operations

Evidence-first college Free Fire MAX tournament platform. **Current delivery: audited specifications, tournament publication, reusable scoring rules, free-event registration, organizer review and slots. This is not yet a complete tournament MVP.** Payment proof, protected room credentials, real match results, standings and OCR remain unfinished.

Read [audit and readiness](docs/audit-readiness.md), [working decisions](docs/decision-log.md), [delivery progress](docs/progress.md), and [implemented API contracts](docs/api-contracts.md). Original specifications are preserved at the repository root.

## Local development

Use Node 24.22.0 and pnpm 12.8.1. PostgreSQL 17 is required. Copy `.env.example` to `.env`; configure DATABASE_URL, WEB_ORIGIN and a random READINESS_TOKEN of at least 32 characters. Never commit `.env`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
# In another terminal:
pnpm dev:web
```

Open http://127.0.0.1:5173. The Vite server proxies `/api` to port 3000. Use the same origin in `WEB_ORIGIN`. The public page fetches real safe configuration and displays retryable failure states; no mock tournament data is presented as real.

To use the admin workspace, create the first super-admin after migration using `pnpm admin:create admin@example.com`. The command prompts for a password without echoing it. Then open http://127.0.0.1:5173/admin. An admin can save and reuse scoring templates, create and publish a tournament after configuration checks, open its registration window, review submitted teams, verify eligibility and unclear in-game names, approve a team, and assign a slot. No scoring values are preselected as official rules. Template revisions cannot alter rules already copied into tournaments.

Captains use http://127.0.0.1:5173/participate to create an account and team, enter the event roster, and submit registration when the event window is open. Free events have a complete registration-to-slot path. For paid events, the proof upload and review path is not complete; an admin can record an exceptional waiver with a reason, but that is not a substitute for a normal paid-event workflow. Publishing and registration should therefore be used only for development or free-event trials until the remaining operations are implemented.

For database-only Docker use, set POSTGRES_PASSWORD and run `docker compose up -d db`. For the complete production container, also set an HTTPS WEB_ORIGIN and READINESS_TOKEN, then run `docker compose up --build`. A reverse proxy must provide HTTPS; the container binds to loopback. Docker execution requires a running Docker engine. No public deployment has been performed.

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

Browser tests launch the API in a unique schema in `DATABASE_URL_TEST` and clean it up after the run. They exercise tournament creation and publication, captain registration, organizer review and slot assignment on desktop and mobile. Production output serves the SPA and API together with `pnpm start` after `pnpm build` and migration. SQL migrations are serialized with an advisory lock, transactionally applied and checksum-protected against edits after application.

## Architecture

- `apps/api/src`: Express, configuration, sessions, tournament setup, registration, review, slots, migrations and health routes.
- `apps/api/db/migrations`: forward-only PostgreSQL schema.
- `apps/web/src`: responsive React public event pages, admin and captain workspaces, and truthful system pages, specified light/ink tokens and self-hosted fonts.
- `packages/shared`: validated response contracts, pure exact-decimal preview scoring and exact status catalog.
- `tests`: unit/database integration and desktop/mobile browser acceptance checks.

Next phases: payment proofs and review, linked roster members, credentials, manual results and corrections, standings, then measured OCR assistance. Idempotency and production operations remain required before launch. A labeled screenshot corpus, hosting, retention and recovery objectives are still needed. The admin chooses scoring rules per tournament; reusable templates are available.
