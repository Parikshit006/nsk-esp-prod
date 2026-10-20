ALTER TABLE match_credentials ADD COLUMN release_notified_at timestamptz;
CREATE INDEX match_credentials_due_alert ON match_credentials(release_at) WHERE status='Set' AND release_notified_at IS NULL;
UPDATE platform_metadata SET schema_version=27 WHERE singleton=true;
