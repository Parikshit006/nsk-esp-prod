CREATE TABLE result_dispute_evidence (
  id uuid PRIMARY KEY,
  dispute_id uuid NOT NULL UNIQUE REFERENCES result_disputes(id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg')),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 10000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 10000),
  content bytea NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER result_dispute_evidence_immutable BEFORE UPDATE OR DELETE ON result_dispute_evidence FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
UPDATE platform_metadata SET schema_version=22 WHERE singleton=true;
