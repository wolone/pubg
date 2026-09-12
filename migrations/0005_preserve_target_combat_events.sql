-- Reserve timeline capacity for target-player attacks and damage events so
-- replay maps keep useful combat context after telemetry compaction.
UPDATE player_match_analysis
SET expires_at = '1970-01-01T00:00:00.000Z'
WHERE expires_at > '1970-01-01T00:00:00.000Z';
