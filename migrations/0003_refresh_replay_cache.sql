UPDATE player_match_analysis
SET expires_at = '1970-01-01T00:00:00.000Z'
WHERE replay_frames_json = '[]' AND trajectory_json <> '[]';
