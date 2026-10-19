CREATE TABLE disqualifications (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  registration_id uuid NOT NULL UNIQUE REFERENCES registrations(id),
  policy text NOT NULL CHECK (policy IN ('keep_points_exclude_podium','void_all_results','void_from_disqualification')),
  effective_match_no integer CHECK (effective_match_no > 0),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  decided_by uuid NOT NULL REFERENCES accounts(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((policy='void_from_disqualification') = (effective_match_no IS NOT NULL))
);
CREATE TRIGGER disqualification_immutable BEFORE UPDATE OR DELETE ON disqualifications FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
ALTER TABLE standings_snapshots DROP CONSTRAINT standings_snapshot_source;
ALTER TABLE standings_snapshots ADD COLUMN source_registration_id uuid REFERENCES registrations(id);
ALTER TABLE standings_snapshots ADD CONSTRAINT standings_snapshot_source CHECK (
  (source_result_version_id IS NOT NULL)::int + (source_match_id IS NOT NULL)::int + (source_registration_id IS NOT NULL)::int = 1
);
ALTER TABLE standings_rows ADD COLUMN disqualified boolean NOT NULL DEFAULT false;
UPDATE platform_metadata SET schema_version=12 WHERE singleton=true;
