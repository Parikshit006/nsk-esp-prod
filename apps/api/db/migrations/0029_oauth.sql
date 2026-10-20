CREATE TABLE oauth_flows (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  browser_nonce_hash text NOT NULL CHECK (browser_nonce_hash ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider IN ('google','discord')),
  code_verifier text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login','link')),
  requested_role text NOT NULL CHECK (requested_role IN ('captain','member')),
  return_to text NOT NULL CHECK (return_to IN ('participate','join','admin')),
  account_id uuid REFERENCES accounts(id),
  session_id uuid REFERENCES sessions(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose='link')=(account_id IS NOT NULL AND session_id IS NOT NULL))
);
CREATE INDEX oauth_flows_expiry ON oauth_flows(expires_at);
CREATE TABLE oauth_identities (
  provider text NOT NULL CHECK (provider IN ('google','discord')),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  account_id uuid NOT NULL REFERENCES accounts(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,subject),
  UNIQUE(provider,account_id)
);
UPDATE platform_metadata SET schema_version=29 WHERE singleton=true;
