ALTER TABLE admin_users RENAME TO accounts;
ALTER TABLE admin_sessions RENAME TO sessions;
ALTER TABLE accounts DROP CONSTRAINT admin_users_role_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK (role IN ('super_admin','organizer','captain','member'));
ALTER TABLE accounts ADD COLUMN display_name text;
ALTER TABLE tournaments ADD COLUMN currency text CHECK (currency ~ '^[A-Z]{3}$');
CREATE TABLE teams (
  id uuid PRIMARY KEY,
  captain_id uuid NOT NULL REFERENCES accounts(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE registrations (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  team_id uuid NOT NULL REFERENCES teams(id),
  name_key text NOT NULL,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','NeedsCorrection','Withdrawn','Cancelled')),
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('NotRequired','Pending','ProofSubmitted','Verified','Rejected','Waived')),
  approval_status text NOT NULL DEFAULT 'Unreviewed' CHECK (approval_status IN ('Unreviewed','Approved','Rejected','Waitlisted','Disqualified')),
  slot_status text NOT NULL DEFAULT 'Unassigned' CHECK (slot_status IN ('Unassigned','Assigned','Released')),
  eligibility_note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX registrations_active_team ON registrations(tournament_id,team_id) WHERE status NOT IN ('Withdrawn','Cancelled');
CREATE UNIQUE INDEX registrations_active_name ON registrations(tournament_id,name_key) WHERE status NOT IN ('Withdrawn','Cancelled');
CREATE TABLE roster_entries (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  registration_id uuid NOT NULL REFERENCES registrations(id),
  account_id uuid REFERENCES accounts(id),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 80),
  ign_raw text NOT NULL CHECK (length(ign_raw) BETWEEN 1 AND 80),
  ign_exact boolean NOT NULL,
  game_uid text,
  role text NOT NULL CHECK (role IN ('Captain','Player')),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Removed')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roster_active_account ON roster_entries(tournament_id,account_id) WHERE account_id IS NOT NULL AND status='Active';
CREATE UNIQUE INDEX roster_active_captain ON roster_entries(registration_id) WHERE role='Captain' AND status='Active';
CREATE INDEX roster_registration ON roster_entries(registration_id) WHERE status='Active';
UPDATE platform_metadata SET schema_version=5 WHERE singleton=true;
