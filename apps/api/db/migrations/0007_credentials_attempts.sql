ALTER TABLE matches DROP CONSTRAINT matches_status_check;
ALTER TABLE matches ADD CONSTRAINT matches_status_check CHECK (status IN ('Scheduled','Ready','InProgress','AwaitingEvidence','UnderReview','Verified','Published','Interrupted','Cancelled'));
CREATE TABLE match_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id),
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Interrupted','Superseded','Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id,attempt_no)
);
ALTER TABLE matches ADD COLUMN current_attempt_id uuid;
INSERT INTO match_attempts(match_id,attempt_no) SELECT id,1 FROM matches;
UPDATE matches m SET current_attempt_id=a.id FROM match_attempts a WHERE a.match_id=m.id AND a.attempt_no=1;
ALTER TABLE matches ALTER COLUMN current_attempt_id SET NOT NULL;
ALTER TABLE matches ADD CONSTRAINT matches_current_attempt_fk FOREIGN KEY (current_attempt_id) REFERENCES match_attempts(id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE roster_invitations (
  id uuid PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES registrations(id),
  roster_entry_id uuid NOT NULL REFERENCES roster_entries(id),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE match_credentials (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES matches(id),
  version_no integer NOT NULL CHECK (version_no > 0),
  iv bytea NOT NULL,
  ciphertext bytea NOT NULL,
  auth_tag bytea NOT NULL,
  release_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('Set','Superseded','Revoked')),
  created_by uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id,version_no)
);
CREATE UNIQUE INDEX match_credentials_current ON match_credentials(match_id) WHERE status='Set';
UPDATE platform_metadata SET schema_version=7 WHERE singleton=true;
