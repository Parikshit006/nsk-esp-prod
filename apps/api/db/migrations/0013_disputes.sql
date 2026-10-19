ALTER TABLE tournaments ADD COLUMN dispute_window_hours integer CHECK (dispute_window_hours BETWEEN 0 AND 168);
CREATE TABLE result_disputes (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  match_id uuid NOT NULL REFERENCES matches(id),
  registration_id uuid NOT NULL REFERENCES registrations(id),
  reported_result_version_id uuid NOT NULL REFERENCES match_result_versions(id),
  opened_by uuid NOT NULL REFERENCES accounts(id),
  issue text NOT NULL CHECK (length(trim(issue)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Rejected','Upheld')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES accounts(id),
  reviewed_at timestamptz,
  response text CHECK (response IS NULL OR length(trim(response)) BETWEEN 10 AND 2000),
  correction_result_version_id uuid REFERENCES match_result_versions(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((status='Open' AND reviewed_by IS NULL AND reviewed_at IS NULL AND response IS NULL AND correction_result_version_id IS NULL)
    OR (status='Rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND response IS NOT NULL AND correction_result_version_id IS NULL)
    OR (status='Upheld' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND response IS NOT NULL AND correction_result_version_id IS NOT NULL))
);
CREATE UNIQUE INDEX result_disputes_one_team_match ON result_disputes(match_id,registration_id);
CREATE INDEX result_disputes_tournament_status ON result_disputes(tournament_id,status);
CREATE TABLE result_dispute_events (
  id uuid PRIMARY KEY,
  dispute_id uuid NOT NULL REFERENCES result_disputes(id),
  actor_id uuid NOT NULL REFERENCES accounts(id),
  action text NOT NULL CHECK (action IN ('Opened','Rejected','Upheld')),
  detail jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER result_dispute_events_immutable BEFORE UPDATE OR DELETE ON result_dispute_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
UPDATE platform_metadata SET schema_version=13 WHERE singleton=true;
