CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_account_open ON password_reset_tokens(account_id,expires_at) WHERE consumed_at IS NULL;
UPDATE platform_metadata SET schema_version=19 WHERE singleton=true;
