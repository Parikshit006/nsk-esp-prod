ALTER TABLE standings_snapshots ALTER COLUMN source_result_version_id DROP NOT NULL;
ALTER TABLE standings_snapshots ADD COLUMN source_match_id uuid REFERENCES matches(id);
ALTER TABLE standings_snapshots ADD CONSTRAINT standings_snapshot_source CHECK ((source_result_version_id IS NOT NULL) <> (source_match_id IS NOT NULL));
UPDATE platform_metadata SET schema_version=11 WHERE singleton=true;
