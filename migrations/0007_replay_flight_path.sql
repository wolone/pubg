ALTER TABLE player_match_analysis
  ADD COLUMN flight_path_json TEXT NOT NULL DEFAULT '[]';

-- Replay snapshots need regeneration so the new flight path is extracted from
-- the original telemetry asset instead of serving the previous schema.
UPDATE player_match_analysis
SET expires_at = '1970-01-01T00:00:00.000Z'
WHERE expires_at > '1970-01-01T00:00:00.000Z';
