ALTER TABLE accounts ADD COLUMN email_verified_at timestamptz;
UPDATE accounts SET email_verified_at=created_at WHERE email_verified_at IS NULL;
CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_account_open ON email_verification_tokens(account_id,expires_at) WHERE consumed_at IS NULL;
UPDATE platform_metadata SET schema_version=23 WHERE singleton=true;
