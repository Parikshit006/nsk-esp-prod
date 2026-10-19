CREATE TABLE ocr_jobs (
 id uuid PRIMARY KEY,
 evidence_id uuid NOT NULL REFERENCES match_evidence(id),
 requested_by uuid NOT NULL REFERENCES accounts(id),
 status text NOT NULL DEFAULT 'Queued' CHECK(status IN ('Queued','Running','Succeeded','Failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease_id uuid,
 lease_until timestamptz,
 output jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(evidence_id),
 CHECK((status='Succeeded')=(output IS NOT NULL))
);
CREATE INDEX ocr_jobs_pending ON ocr_jobs(status,created_at);
UPDATE platform_metadata SET schema_version=14 WHERE singleton=true;
