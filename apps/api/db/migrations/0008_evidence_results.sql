CREATE TABLE match_evidence (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES matches(id),
  attempt_id uuid NOT NULL REFERENCES match_attempts(id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg')),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 10000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 10000),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 5242880),
  uploaded_by uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attempt_id,sha256)
);
CREATE TRIGGER match_evidence_immutable BEFORE UPDATE OR DELETE ON match_evidence FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TABLE match_result_versions (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES matches(id),
  attempt_id uuid NOT NULL REFERENCES match_attempts(id),
  version_no integer NOT NULL CHECK (version_no > 0),
  ruleset_id uuid NOT NULL REFERENCES tournament_rulesets(id),
  evidence_id uuid NOT NULL REFERENCES match_evidence(id),
  status text NOT NULL CHECK (status IN ('Draft','Verified','Published','Superseded')),
  source text NOT NULL CHECK (source='Manual'),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  created_by uuid NOT NULL REFERENCES accounts(id),
  verified_by uuid REFERENCES accounts(id),
  published_by uuid REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  published_at timestamptz,
  UNIQUE(match_id,version_no)
);
CREATE UNIQUE INDEX match_result_pending ON match_result_versions(match_id) WHERE status IN ('Draft','Verified');
CREATE UNIQUE INDEX match_result_published ON match_result_versions(match_id) WHERE status='Published';
CREATE TABLE match_result_rows (
  id uuid PRIMARY KEY,
  result_version_id uuid NOT NULL REFERENCES match_result_versions(id),
  registration_id uuid NOT NULL REFERENCES registrations(id),
  placement integer NOT NULL CHECK (placement > 0),
  player_kills jsonb NOT NULL,
  adjustment text NOT NULL,
  score_breakdown jsonb,
  UNIQUE(result_version_id,registration_id),
  UNIQUE(result_version_id,placement)
);
CREATE TABLE standings_snapshots (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  source_result_version_id uuid NOT NULL REFERENCES match_result_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id,sequence_no)
);
CREATE TABLE standings_rows (
  id uuid PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES standings_snapshots(id),
  registration_id uuid NOT NULL REFERENCES registrations(id),
  rank integer NOT NULL CHECK (rank > 0),
  tied boolean NOT NULL,
  total_points text NOT NULL,
  total_kills integer NOT NULL CHECK (total_kills >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  matches_played integer NOT NULL CHECK (matches_played >= 0),
  recent_placement integer,
  UNIQUE(snapshot_id,registration_id)
);
CREATE OR REPLACE FUNCTION guard_result_version_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'result versions cannot be deleted'; END IF;
  IF (to_jsonb(NEW) - 'status' - 'verified_by' - 'published_by' - 'verified_at' - 'published_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'verified_by' - 'published_by' - 'verified_at' - 'published_at') THEN
    RAISE EXCEPTION 'result version contents are immutable';
  END IF;
  IF NOT ((OLD.status IN ('Draft','Verified','Published') AND NEW.status='Superseded') OR
          (OLD.status='Draft' AND NEW.status='Verified') OR
          (OLD.status='Verified' AND NEW.status='Published')) THEN
    RAISE EXCEPTION 'invalid result version transition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER match_result_version_guard BEFORE UPDATE OR DELETE ON match_result_versions FOR EACH ROW EXECUTE FUNCTION guard_result_version_change();
CREATE OR REPLACE FUNCTION guard_result_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'result rows cannot be deleted'; END IF;
  IF OLD.score_breakdown IS NOT NULL OR NEW.score_breakdown IS NULL OR
     (to_jsonb(NEW) - 'score_breakdown') IS DISTINCT FROM (to_jsonb(OLD) - 'score_breakdown') OR
     NOT EXISTS (SELECT 1 FROM match_result_versions WHERE id=OLD.result_version_id AND status='Draft') THEN
    RAISE EXCEPTION 'result row contents are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER match_result_row_guard BEFORE UPDATE OR DELETE ON match_result_rows FOR EACH ROW EXECUTE FUNCTION guard_result_row_change();
CREATE TRIGGER standings_snapshot_immutable BEFORE UPDATE OR DELETE ON standings_snapshots FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE TRIGGER standings_row_immutable BEFORE UPDATE OR DELETE ON standings_rows FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
UPDATE platform_metadata SET schema_version=8 WHERE singleton=true;
