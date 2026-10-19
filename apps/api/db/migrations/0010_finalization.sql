CREATE TABLE standings_tie_resolutions (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  snapshot_id uuid NOT NULL REFERENCES standings_snapshots(id),
  tied_rank integer NOT NULL CHECK (tied_rank > 0),
  ordered_registration_ids jsonb NOT NULL CHECK (jsonb_typeof(ordered_registration_ids)='array'),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  decided_by uuid NOT NULL REFERENCES accounts(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id,tied_rank)
);
CREATE TRIGGER tie_resolution_immutable BEFORE UPDATE OR DELETE ON standings_tie_resolutions FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE tournament_finalizations (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL UNIQUE REFERENCES tournaments(id),
  snapshot_id uuid NOT NULL REFERENCES standings_snapshots(id),
  podium jsonb NOT NULL CHECK (jsonb_typeof(podium)='array'),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  completed_by uuid NOT NULL REFERENCES accounts(id),
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER finalization_immutable BEFORE UPDATE OR DELETE ON tournament_finalizations FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
UPDATE platform_metadata SET schema_version=10 WHERE singleton=true;
