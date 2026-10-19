ALTER TABLE standings_snapshots ADD COLUMN source_reopen_event_id uuid REFERENCES tournament_reopen_events(id);
ALTER TABLE standings_snapshots DROP CONSTRAINT standings_snapshot_source;
ALTER TABLE standings_snapshots ADD CONSTRAINT standings_snapshot_source CHECK (
 (source_result_version_id IS NOT NULL)::int + (source_match_id IS NOT NULL)::int +
 (source_registration_id IS NOT NULL)::int + (source_reopen_event_id IS NOT NULL)::int = 1
);
UPDATE platform_metadata SET schema_version=18 WHERE singleton=true;
