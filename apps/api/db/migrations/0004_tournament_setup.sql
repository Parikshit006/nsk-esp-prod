ALTER TABLE tournaments DROP CONSTRAINT tournaments_status_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check CHECK (status IN ('Draft','Published','RegistrationOpen','RegistrationClosed','InProgress','Finalizing','Completed','Archived','Cancelled'));
ALTER TABLE tournaments ADD COLUMN format text,
  ADD COLUMN team_size integer CHECK (team_size BETWEEN 1 AND 8),
  ADD COLUMN fee_minor integer CHECK (fee_minor >= 0),
  ADD COLUMN registration_open_at timestamptz,
  ADD COLUMN registration_close_at timestamptz,
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN ends_at timestamptz,
  ADD COLUMN rules_text text,
  ADD COLUMN eligibility_text text,
  ADD COLUMN payment_instructions text;
ALTER TABLE tournaments ADD CONSTRAINT tournament_config_dates CHECK (
  registration_open_at IS NULL OR registration_close_at IS NULL OR starts_at IS NULL OR ends_at IS NULL OR
  (registration_open_at < registration_close_at AND registration_close_at <= starts_at AND starts_at < ends_at)
);
CREATE TABLE matches (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  match_no integer NOT NULL CHECK (match_no > 0),
  map text NOT NULL CHECK (length(trim(map)) BETWEEN 2 AND 80),
  scheduled_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status='Scheduled'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id,match_no),
  CHECK (scheduled_at < ends_at)
);
CREATE INDEX matches_tournament_time ON matches(tournament_id,scheduled_at);
UPDATE platform_metadata SET schema_version=4 WHERE singleton=true;
