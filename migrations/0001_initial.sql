CREATE TABLE IF NOT EXISTS players (
  platform TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  shard TEXT NOT NULL,
  last_queried_at TEXT NOT NULL,
  PRIMARY KEY (platform, player_id)
);

CREATE TABLE IF NOT EXISTS seasons (
  platform TEXT NOT NULL,
  season_id TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (platform, season_id)
);

CREATE TABLE IF NOT EXISTS player_season_stats (
  platform TEXT NOT NULL,
  player_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  game_mode TEXT NOT NULL,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  rounds INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  damage REAL NOT NULL DEFAULT 0,
  headshot_kills INTEGER NOT NULL DEFAULT 0,
  longest_kill REAL NOT NULL DEFAULT 0,
  time_survived REAL NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (platform, player_id, season_id, game_mode),
  FOREIGN KEY (platform, player_id) REFERENCES players(platform, player_id)
);

CREATE TABLE IF NOT EXISTS matches (
  match_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  map_name TEXT,
  game_mode TEXT,
  started_at TEXT,
  duration_seconds INTEGER,
  title_id TEXT,
  telemetry_url TEXT,
  participants_json TEXT NOT NULL DEFAULT '[]',
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_match_analysis (
  platform TEXT NOT NULL,
  player_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  kills_json TEXT NOT NULL DEFAULT '[]',
  trajectory_json TEXT NOT NULL DEFAULT '[]',
  timeline_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (platform, player_id, match_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_expiry
  ON player_season_stats(expires_at);

CREATE INDEX IF NOT EXISTS idx_matches_expiry
  ON matches(expires_at);
