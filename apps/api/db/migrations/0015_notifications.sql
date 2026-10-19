CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES accounts(id),
 tournament_id uuid NOT NULL REFERENCES tournaments(id),
 title text NOT NULL,
 message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX notifications_account ON notifications(account_id,created_at DESC);
UPDATE platform_metadata SET schema_version=15 WHERE singleton=true;
