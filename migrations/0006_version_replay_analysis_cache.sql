-- Keep cached replay snapshots tied to the parser that produced them. This
-- allows future replay fixes to bypass stale D1 snapshots automatically.
ALTER TABLE player_match_analysis
  ADD COLUMN parser_version INTEGER NOT NULL DEFAULT 1;
