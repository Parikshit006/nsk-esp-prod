ALTER TABLE tournaments ADD COLUMN payment_proof_max_bytes integer CHECK (payment_proof_max_bytes BETWEEN 65536 AND 10485760);
ALTER TABLE registrations ADD COLUMN payment_recheck_required boolean NOT NULL DEFAULT false;
CREATE TABLE payment_proofs (
  id uuid PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES registrations(id),
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  version_no integer NOT NULL CHECK (version_no > 0),
  reference text NOT NULL CHECK (length(trim(reference)) BETWEEN 3 AND 120),
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  transaction_id text CHECK (transaction_id IS NULL OR length(trim(transaction_id)) BETWEEN 3 AND 120),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg')),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 10000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 10000),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 10485760),
  status text NOT NULL CHECK (status IN ('ProofSubmitted','Verified','Rejected','Superseded')),
  submitted_by uuid NOT NULL REFERENCES accounts(id),
  reviewed_by uuid REFERENCES accounts(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(registration_id,version_no)
);
CREATE UNIQUE INDEX payment_proof_current ON payment_proofs(registration_id) WHERE status IN ('ProofSubmitted','Verified');
CREATE INDEX payment_proofs_duplicate_hash ON payment_proofs(tournament_id,sha256);
CREATE INDEX payment_proofs_duplicate_reference ON payment_proofs(tournament_id,lower(reference));
CREATE OR REPLACE FUNCTION guard_payment_proof_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'payment proofs cannot be deleted'; END IF;
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
CREATE TRIGGER payment_proof_guard BEFORE UPDATE OR DELETE ON payment_proofs FOR EACH ROW EXECUTE FUNCTION guard_payment_proof_change();
UPDATE platform_metadata SET schema_version=9 WHERE singleton=true;
