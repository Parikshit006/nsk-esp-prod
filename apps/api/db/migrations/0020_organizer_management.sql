ALTER TABLE accounts ADD COLUMN disabled_at timestamptz;
ALTER TABLE accounts ADD COLUMN organizer_invited_at timestamptz;
ALTER TABLE accounts ADD COLUMN organizer_activated_at timestamptz;
UPDATE accounts SET organizer_activated_at=created_at WHERE role='organizer';
UPDATE platform_metadata SET schema_version=20 WHERE singleton=true;
