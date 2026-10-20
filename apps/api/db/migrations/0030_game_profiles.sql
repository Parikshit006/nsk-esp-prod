CREATE TABLE game_profiles (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  ign_raw text NOT NULL CHECK (length(trim(ign_raw)) BETWEEN 1 AND 80),
  game_uid text CHECK (game_uid IS NULL OR length(trim(game_uid)) BETWEEN 1 AND 80),
  updated_at timestamptz NOT NULL DEFAULT now()
);
UPDATE platform_metadata SET schema_version=30 WHERE singleton=true;
