# Self-hosted launch plan (provisional)

The organizer chose an own server. This is an operator plan, not a declaration that the service is ready for public use. The current app still lacks dispute handling, retention deletion jobs, recovery drills, and production load checks. Do not accept real payments or personal data for a live tournament until those controls are complete.

## Server layout

- Use a supported Linux server with Docker Engine and Compose, persistent storage, and a separate encrypted backup destination. Pin the deployed commit and image digest.
- Terminate HTTPS in a maintained reverse proxy. Proxy only the public origin to the app's loopback-bound port 3000. Keep PostgreSQL on a private network; the provided Compose file binds its port to loopback for local administration. Restrict SSH and host firewall access.
- Use a unique high-entropy database password, readiness token, and 32-byte room-credential encryption key. Keep them outside Git in a root-readable environment file or secrets service. Back up the encryption key separately; losing it makes room details unreadable. Rotate compromised credentials and revoke sessions as part of an incident response.
- Deploy with `docker compose up --build -d` only after setting `POSTGRES_PASSWORD`, HTTPS `WEB_ORIGIN`, `READINESS_TOKEN`, and `CREDENTIAL_ENCRYPTION_KEY`. The app image runs forward-only, checksum-protected migrations before starting. Review each migration and take a recoverable backup before an upgrade.

## Backups and recovery

1. Take an encrypted PostgreSQL custom-format backup at least daily and before each deployment. The private payment and result images are stored in PostgreSQL, so they are included. Keep a separate encrypted off-server copy and a record of backup completion.
2. Keep a rolling 30-day backup set as a provisional operating choice. The final schedule must account for any longer legal hold and for the deletion policy below. Do not leave decrypted exports in shared folders.
3. Test a restore into an isolated database at least monthly. Verify migration level, row counts, a sample event's published result and podium, and decryption of a test room credential using the separately stored key. Record elapsed recovery time; choose an RTO from this measured result.
4. During an incident, stop writes, preserve the affected database and logs, restore to a clean environment, verify the private key and evidence hashes, then reopen traffic. Never restore an old dump over the only current copy.

For a Docker installation, a backup command run on the host can be `docker compose exec -T db pg_dump -U esp -d esp -Fc > /secure-backups/esp-YYYYMMDD.dump`. Protect and encrypt the output at rest and in transfer. Perform restores in a separately named database first; `pg_restore` must target that isolated database. Test these commands on the actual server before relying on them.

## Suggested evidence retention for organizer review

**Proposed policy to approve before launch:** retain private payment-proof images and original result screenshots for 12 months after the tournament closes, then erase image bytes and associated personal references unless a documented dispute, fraud investigation, or other applicable legal duty requires longer retention. Retain an integrity hash, minimal decision metadata, and an audit record only for as long as the approved purpose or law requires. Keep public final rankings separately under a published tournament-results policy. Delete expired copies from backups as their 30-day rolling set expires. Document any legal hold, its owner, and its release date.

This is a planning recommendation, not a statutory retention period for this product. India's [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) include a one-year minimum for covered processing data and logs in Rule 8(3), while [the commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) phases in the underlying Act. Rule 8 is scheduled to take effect eighteen months after the November 2025 publication. The [Act's erasure provision](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf) also allows retention where needed for a specified purpose or another law. Whether those provisions and any payment, tax, or gaming-specific rules apply to each record needs local legal review before real-event launch. The app has no automatic deletion workflow yet; the proposed dates must not be promised to users until one is implemented and tested.

## Launch checks still required

- Confirm the public domain, TLS certificate renewal, DNS, firewall, and monitoring/alert destination.
- Run the full automated checks and the production container against a staging database; confirm migrations, authenticated readiness, login, payment proof, result upload, room release, public standings, and restore drill.
- Set a backup recovery target and a support contact. Publish the actual privacy notice, dispute window, payment/refund terms, and evidence-retention policy chosen by the organizer.
- Review capacity and performance under expected team, screenshot, and spectator load. Until measured, there is no supported load or uptime claim.
