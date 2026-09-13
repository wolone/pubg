ALTER TABLE player_match_analysis
  ADD COLUMN care_packages_json TEXT NOT NULL DEFAULT '[]';

-- Preserve every official care-package spawn/land event separately from the
-- compact human-readable timeline so map state can be reconstructed exactly.
UPDATE player_match_analysis
SET expires_at = '1970-01-01T00:00:00.000Z'
WHERE expires_at > '1970-01-01T00:00:00.000Z';
