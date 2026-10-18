# Tournament operations

Evidence-first college Free Fire MAX tournament platform. **Current delivery: audited specifications and PHASE-001 foundation. This is not yet a functional tournament MVP.** No registration, payment, credentials, scoring, publication or OCR workflow is claimed complete.

Read [audit and readiness](docs/audit-readiness.md), [working decisions](docs/decision-log.md), and [implemented API contracts](docs/api-contracts.md). Original specifications are preserved at the repository root.

## Local development

Use Node 24.22.0 and pnpm 12.8.1. PostgreSQL 17 is required. Copy `.env.example` to `.env`; configure DATABASE_URL, WEB_ORIGIN and a random READINESS_TOKEN of at least 32 characters. Never commit `.env`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
# In another terminal:
pnpm dev:web
```

Open http://127.0.0.1:5173. The Vite server proxies `/api` to port 3000. The preview fetches real safe configuration and displays retryable failure states; no mock tournament data is presented as real.

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

Browser tests launch the API and frontend using the supplied environment. Production output serves the SPA and API together with `pnpm start` after `pnpm build` and migration. SQL migrations are serialized with an advisory lock, transactionally applied and checksum-protected against edits after application.

## Architecture

- `apps/api/src`: Express, configuration, migrations and health routes.
- `apps/api/db/migrations`: forward-only PostgreSQL schema.
- `apps/web/src`: responsive React foundation and truthful system pages, specified light/ink tokens and self-hosted fonts.
- `packages/shared`: validated response contracts and exact status catalog.
- `tests`: unit/database integration and desktop/mobile browser acceptance checks.

Next phases: authentication/audit/idempotency → tournament configuration → registration/payment/slots → credentials → manual results and corrections → evidence and measured OCR assistance. Organizer rules, screenshot corpus, hosting, retention and recovery objectives are still needed before real-event launch.
