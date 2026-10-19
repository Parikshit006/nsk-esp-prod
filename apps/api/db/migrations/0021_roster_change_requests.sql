CREATE TABLE roster_change_requests (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  registration_id uuid NOT NULL REFERENCES registrations(id),
  roster_entry_id uuid NOT NULL REFERENCES roster_entries(id),
  expected_registration_version integer NOT NULL CHECK (expected_registration_version > 0),
  proposed_display_name text NOT NULL CHECK (length(trim(proposed_display_name)) BETWEEN 2 AND 80),
  proposed_ign_raw text NOT NULL CHECK (length(proposed_ign_raw) BETWEEN 1 AND 80),
  proposed_ign_exact boolean NOT NULL,
  proposed_game_uid text,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  requested_by uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES accounts(id),
  decided_at timestamptz,
  decision_note text,
  CHECK ((status='Pending' AND decided_by IS NULL AND decided_at IS NULL) OR (status<>'Pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX roster_change_one_pending ON roster_change_requests(registration_id) WHERE status='Pending';
CREATE INDEX roster_change_tournament_queue ON roster_change_requests(tournament_id,created_at DESC);
UPDATE platform_metadata SET schema_version=21 WHERE singleton=true;
