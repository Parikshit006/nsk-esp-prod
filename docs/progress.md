# Delivery progress

19 October 2026. This checklist distinguishes verified code from the remaining specification; it does not declare launch readiness.

| Area | Current state | Evidence / remaining work |
|---|---|---|
| Documentation audit | Complete | Every supplied Markdown source and requirements CSV reviewed; see `audit-readiness.md`. |
| Foundation and security | Implemented slice | Validated config, migrations, strict CORS, security headers, revocable account sessions, CSRF, audit trail, password hashing, login rate limit. Write idempotency, password recovery, email verification and operations hardening remain. |
| Admin scoring rules | Implemented slice | Per-tournament immutable rule copies, reusable versioned templates, exact-decimal sample scoring, public rule disclosure. Further rule choices tied to match penalties/multipliers await result workflow. |
| Tournament setup | Implemented slice | Config, matches, overlap/window validation, publish and registration transitions, public discovery/detail. Guarded match ready/start/finish/interrupt/restart preserves attempt history and freezes rules on the first start. Rescheduling and cancellation handling across registrations remain. |
| Captain registration | Implemented slice | Signup, team creation, roster, owner checks, exact raw IGN, full-roster submission, separate status dimensions. Email-bound, one-time player invitations link individual accounts. Roster edits/locks and withdrawals remain. |
| Organizer review and slots | Implemented slice | Human IGN confirmation, eligibility, free-payment `NotRequired`, reasoned waiver, paid proof verification, approval gates, capacity and slot assignment. Slot release, notifications and post-lock changes remain. |
| Paid entry | Implemented slice | Per-event proof size limit and instructions; private decoded PNG/JPEG proof history, duplicate image/reference flags, amount check, human verify/reject/reverse, and a fresh review gate after reversing an approved team's payment. Payment is handled outside the platform; no payment processor or automatic settlement is claimed. Retention and refund handling remain. |
| Protected credentials | Implemented slice | AES-GCM encrypted room ID/password, release gate, linked-roster/approval/slot checks, version rotation and view audit. Key rotation, cancellation operations and notification delivery remain. |
| Manual match results | Implemented slice | Private immutable PNG/JPEG evidence, full-team/player manual drafts, human verify, exact-decimal scoring, explicit publication, versioned corrections and public match/overall standings snapshots. Disqualification, tie-break decisions, finalization and disputes remain. |
| OCR assistance | Not started | Labeled screenshots absent; no provider or thresholds claimed. |
| Launch operations | Not ready | Hosting, backups/recovery, retention and load targets unresolved. |

Verification: PostgreSQL integration tests, desktop/mobile browser flows, automated accessibility checks, type check, lint and production build run in CI. Local Docker engine was unavailable for an image runtime check. All test fixtures use isolated database schemas; browser teardown removes its schema.
