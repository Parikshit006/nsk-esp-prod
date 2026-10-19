ALTER TABLE tournament_finalizations DROP CONSTRAINT tournament_finalizations_tournament_id_key;
ALTER TABLE tournaments ADD COLUMN current_finalization_id uuid REFERENCES tournament_finalizations(id);
UPDATE tournaments t SET current_finalization_id=f.id FROM tournament_finalizations f WHERE f.tournament_id=t.id;
CREATE TABLE tournament_reopen_events (
 id uuid PRIMARY KEY,
 tournament_id uuid NOT NULL REFERENCES tournaments(id),
 previous_finalization_id uuid NOT NULL UNIQUE REFERENCES tournament_finalizations(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
 reopened_by uuid NOT NULL REFERENCES accounts(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER reopen_events_immutable BEFORE UPDATE OR DELETE ON tournament_reopen_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change();
CREATE INDEX finalizations_event_history ON tournament_finalizations(tournament_id,completed_at DESC);
UPDATE platform_metadata SET schema_version=17 WHERE singleton=true;
