CREATE TABLE roster_ign_derivations (
  roster_entry_id uuid NOT NULL REFERENCES roster_entries(id),
  roster_version integer NOT NULL CHECK (roster_version > 0),
  algorithm_version text NOT NULL,
  raw_value text NOT NULL,
  match_key text NOT NULL,
  skeleton_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(roster_entry_id,roster_version)
);
CREATE TRIGGER roster_ign_derivations_immutable BEFORE UPDATE OR DELETE ON roster_ign_derivations FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
UPDATE platform_metadata SET schema_version=25 WHERE singleton=true;
