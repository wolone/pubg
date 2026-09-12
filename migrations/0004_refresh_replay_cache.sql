-- Replay parsing now includes finisher attribution, team metadata, health,
-- phase changes, attacks, and compact vehicle state. Expire existing analysis
-- snapshots so the next request regenerates them from the current telemetry.
UPDATE player_match_analysis
SET expires_at = '1970-01-01T00:00:00.000Z'
WHERE expires_at > '1970-01-01T00:00:00.000Z';
