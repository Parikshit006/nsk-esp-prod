CREATE TABLE admin_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 254),
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin','organizer')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES admin_users(id),
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_user_active ON admin_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE login_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts >= 0),
  window_started_at timestamptz NOT NULL
);
CREATE TABLE rule_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 3 AND 100),
  created_by uuid NOT NULL REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rule_template_revisions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES rule_templates(id),
  revision integer NOT NULL CHECK (revision > 0),
  config jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id,revision)
);
CREATE TABLE tournaments (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
  game text NOT NULL DEFAULT 'Free Fire MAX' CHECK (game='Free Fire MAX'),
  capacity integer NOT NULL CHECK (capacity BETWEEN 2 AND 100),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  status text NOT NULL DEFAULT 'Draft' CHECK (status='Draft'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tournament_rulesets (
  id uuid PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id),
  version_no integer NOT NULL CHECK (version_no > 0),
  config jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft','Confirmed','Frozen')),
  source_template_revision_id uuid REFERENCES rule_template_revisions(id),
  created_by uuid NOT NULL REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE(tournament_id,version_no)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events are append-only'; END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
UPDATE platform_metadata SET schema_version=2 WHERE singleton=true;
