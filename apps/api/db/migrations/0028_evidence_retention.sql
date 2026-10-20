ALTER TABLE tournaments ADD COLUMN evidence_retention_due_at timestamptz;
ALTER TABLE tournaments ADD COLUMN evidence_hold_reason text CHECK (evidence_hold_reason IS NULL OR length(trim(evidence_hold_reason)) BETWEEN 10 AND 1000);
UPDATE tournaments t SET evidence_retention_due_at=closed.closed_at+interval '12 months'
FROM (SELECT entity_id,max(created_at) closed_at FROM audit_events WHERE entity_type='tournament' AND action IN ('tournament.cancel','tournament.finalized') GROUP BY entity_id) closed
WHERE t.id=closed.entity_id AND t.status IN ('Completed','Archived','Cancelled');
CREATE INDEX tournaments_evidence_retention_due ON tournaments(evidence_retention_due_at) WHERE evidence_retention_due_at IS NOT NULL;

ALTER TABLE match_evidence ALTER COLUMN content DROP NOT NULL;
ALTER TABLE match_evidence ADD COLUMN purged_at timestamptz;
ALTER TABLE match_evidence ADD CONSTRAINT match_evidence_purge_pair CHECK ((content IS NULL)=(purged_at IS NOT NULL));
DROP TRIGGER match_evidence_immutable ON match_evidence;
CREATE FUNCTION guard_immutable_image_purge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'image evidence cannot be deleted'; END IF;
  IF OLD.content IS NOT NULL AND NEW.content IS NULL AND OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL
     AND (to_jsonb(NEW)-'content'-'purged_at')=(to_jsonb(OLD)-'content'-'purged_at') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'image metadata is immutable and image bytes can only be purged once';
END;
$$;
CREATE TRIGGER match_evidence_immutable BEFORE UPDATE OR DELETE ON match_evidence FOR EACH ROW EXECUTE FUNCTION guard_immutable_image_purge();

ALTER TABLE result_dispute_evidence ALTER COLUMN content DROP NOT NULL;
ALTER TABLE result_dispute_evidence ADD COLUMN purged_at timestamptz;
ALTER TABLE result_dispute_evidence ADD CONSTRAINT result_dispute_evidence_purge_pair CHECK ((content IS NULL)=(purged_at IS NOT NULL));
DROP TRIGGER result_dispute_evidence_immutable ON result_dispute_evidence;
CREATE TRIGGER result_dispute_evidence_immutable BEFORE UPDATE OR DELETE ON result_dispute_evidence FOR EACH ROW EXECUTE FUNCTION guard_immutable_image_purge();

ALTER TABLE payment_proofs ALTER COLUMN content DROP NOT NULL;
ALTER TABLE payment_proofs ADD COLUMN purged_at timestamptz;
ALTER TABLE payment_proofs ADD CONSTRAINT payment_proofs_purge_pair CHECK ((content IS NULL)=(purged_at IS NOT NULL));
CREATE OR REPLACE FUNCTION guard_payment_proof_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'payment proofs cannot be deleted'; END IF;
  IF OLD.content IS NOT NULL AND NEW.content IS NULL AND OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL
     AND (to_jsonb(NEW)-'content'-'purged_at')=(to_jsonb(OLD)-'content'-'purged_at') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'status' - 'reviewed_by' - 'review_note' - 'reviewed_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'reviewed_by' - 'review_note' - 'reviewed_at') THEN
    RAISE EXCEPTION 'payment proof contents are immutable';
  END IF;
  IF NOT ((OLD.status='ProofSubmitted' AND NEW.status IN ('Verified','Rejected','Superseded')) OR
          (OLD.status='Verified' AND NEW.status='Rejected')) THEN
    RAISE EXCEPTION 'invalid payment proof transition';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE ocr_jobs ADD COLUMN purged_at timestamptz;
ALTER TABLE ocr_jobs DROP CONSTRAINT ocr_jobs_check;
ALTER TABLE ocr_jobs ADD CONSTRAINT ocr_jobs_output_guard CHECK ((status='Succeeded' AND (output IS NOT NULL OR purged_at IS NOT NULL)) OR (status<>'Succeeded' AND output IS NULL));
UPDATE platform_metadata SET schema_version=28 WHERE singleton=true;
