ALTER TABLE tournaments ADD COLUMN cancellation_reason text;
CREATE TABLE refund_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL REFERENCES tournaments(id),
 registration_id uuid NOT NULL UNIQUE REFERENCES registrations(id),
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Resolved')),
 resolution text CHECK(resolution IN ('Refunded','PartiallyRefunded','NoRefundDue')),
 amount_minor integer CHECK(amount_minor IS NULL OR amount_minor>=0),
 note text,
 reviewed_by uuid REFERENCES accounts(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='Pending' AND resolution IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND amount_minor IS NULL AND note IS NULL)
 OR (status='Resolved' AND resolution IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND amount_minor IS NOT NULL AND note IS NOT NULL AND length(trim(note)) BETWEEN 10 AND 1000))
);
CREATE INDEX refund_reviews_event_status ON refund_reviews(tournament_id,status);
UPDATE platform_metadata SET schema_version=16 WHERE singleton=true;
