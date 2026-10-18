ALTER TABLE registrations ADD COLUMN eligibility_status text NOT NULL DEFAULT 'Pending' CHECK (eligibility_status IN ('Pending','Verified','Rejected')),
  ADD COLUMN eligibility_reviewed_by uuid REFERENCES accounts(id),
  ADD COLUMN eligibility_reviewed_at timestamptz,
  ADD COLUMN eligibility_review_note text,
  ADD COLUMN payment_waiver_reason text,
  ADD COLUMN payment_waived_by uuid REFERENCES accounts(id),
  ADD COLUMN payment_waived_at timestamptz,
  ADD COLUMN approval_decided_by uuid REFERENCES accounts(id),
  ADD COLUMN approval_decided_at timestamptz,
  ADD COLUMN approval_reason text;
ALTER TABLE roster_entries ADD COLUMN ign_admin_confirmed_by uuid REFERENCES accounts(id),
  ADD COLUMN ign_admin_confirmed_at timestamptz,
  ADD COLUMN ign_admin_note text;
CREATE TABLE slots (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  slot_no integer NOT NULL CHECK (slot_no > 0),
  registration_id uuid NOT NULL REFERENCES registrations(id),
  status text NOT NULL DEFAULT 'Assigned' CHECK (status IN ('Assigned','Released')),
  assigned_by uuid NOT NULL REFERENCES accounts(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid REFERENCES accounts(id),
  released_at timestamptz,
  release_reason text
);
CREATE UNIQUE INDEX slots_active_slot ON slots(tournament_id,slot_no) WHERE status='Assigned';
CREATE UNIQUE INDEX slots_active_registration ON slots(registration_id) WHERE status='Assigned';
UPDATE platform_metadata SET schema_version=6 WHERE singleton=true;
