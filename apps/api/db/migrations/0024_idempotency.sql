CREATE TABLE idempotency_requests (
  account_id uuid NOT NULL REFERENCES accounts(id),
  actor_role text NOT NULL CHECK (actor_role IN ('super_admin','organizer','captain','member')),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 16 AND 128),
  method text NOT NULL,
  path text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY(account_id,request_key),
  CHECK ((completed_at IS NULL AND response_status IS NULL AND response_body IS NULL) OR (completed_at IS NOT NULL AND response_status BETWEEN 200 AND 299 AND response_body IS NOT NULL))
);
CREATE INDEX idempotency_completed_age ON idempotency_requests(completed_at) WHERE completed_at IS NOT NULL;
UPDATE platform_metadata SET schema_version=24 WHERE singleton=true;
