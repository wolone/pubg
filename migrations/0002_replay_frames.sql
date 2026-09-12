ALTER TABLE player_match_analysis
  ADD COLUMN replay_players_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE player_match_analysis
  ADD COLUMN replay_frames_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE player_match_analysis
  ADD COLUMN replay_duration_seconds INTEGER NOT NULL DEFAULT 0;
