# Implemented foundation contracts

All routes use `/api/v1`. This document records the subset actually implemented; the larger reference remains a specification, not a claim of implementation.

| ID | Route | Authorization | Response |
|---|---|---|---|
| API-190 | GET /health/live | Public | `{data:{status:"alive"}}`; does not imply database readiness. |
| API-191 | GET /health/ready | Operator Bearer token from READINESS_TOKEN | Checks database connectivity and migrated schema; 200 ready or 503 unavailable. No provider claims before those modules exist. |
| API-194 | GET /meta/config | Public | Safe config validated by shared Zod schema; timezone, foundation stage, registration/uploads disabled. |

Errors carry code, plain message and server-generated UUID correlation_id. No request URLs, payloads, cookies, tokens or database strings enter logs. CORS accepts the configured origin only. Readiness token is timing-safe compared and never shipped to the browser. This temporary internal-operator policy precedes platform-admin auth.

GETs do not mutate business state and need no write audit. Unknown API routes return JSON 404 even in production. There are no public tournament-data endpoints yet: the preview explicitly reports that workflows are under construction.
