import type { D1Database } from "@cloudflare/workers-types"

import type {
  MatchAnalysis,
  MatchSummary,
  Platform,
  PlayerSummary,
  SeasonStats,
  SeasonSummary,
} from "@/lib/pubg/types"

const CACHE_TTL_MS = 15 * 60 * 1000
const MATCH_TTL_MS = 14 * 24 * 60 * 60 * 1000
const REPLAY_PARSER_VERSION = 26

type StatsRow = {
  platform: Platform
  player_id: string
  season_id: string
  game_mode: SeasonStats["gameMode"]
  kills: number
  deaths: number
  wins: number
  rounds: number
  assists: number
  damage: number
  headshot_kills: number
  longest_kill: number
  time_survived: number
  fetched_at: string
  expires_at: string
}

type MatchRow = {
  match_id: string
  platform: Platform
  map_name: string | null
  game_mode: string | null
  started_at: string | null
  duration_seconds: number | null
  telemetry_url: string | null
  participants_json: string
  fetched_at: string
  expires_at: string
}

type AnalysisRow = {
  match_id: string
  player_id: string
  kills_json: string
  trajectory_json: string
  flight_path_json?: string
  care_packages_json?: string
  timeline_json: string
  replay_players_json?: string
  replay_frames_json?: string
  replay_duration_seconds?: number
  parser_version?: number
  generated_at: string
  expires_at: string
}

const json = <T>(value: string, fallback: T) => {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export class StatsRepository {
  constructor(private readonly db?: D1Database) {}

  async ensurePlayer(platform: Platform, playerId: string) {
    if (!this.db) return
    const now = new Date().toISOString()
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO players
         (platform, player_id, player_name, shard, last_queried_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(platform, playerId, playerId, platform, now)
      .run()
  }

  async upsertPlayer(player: PlayerSummary) {
    if (!this.db) return
    await this.db
      .prepare(
        `INSERT INTO players (platform, player_id, player_name, shard, last_queried_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(platform, player_id) DO UPDATE SET
           player_name = excluded.player_name,
           shard = excluded.shard,
           last_queried_at = excluded.last_queried_at`
      )
      .bind(
        player.platform,
        player.id,
        player.name,
        player.shard,
        player.lastQueriedAt
      )
      .run()
  }

  async upsertSeasons(
    platform: Platform,
    seasons: SeasonSummary[],
    fetchedAt = new Date()
  ) {
    if (!this.db || seasons.length === 0) return
    const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS).toISOString()
    for (const season of seasons) {
      await this.db
        .prepare(
          `INSERT INTO seasons (platform, season_id, is_current, display_name, fetched_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(platform, season_id) DO UPDATE SET
             is_current = excluded.is_current,
             display_name = excluded.display_name,
             fetched_at = excluded.fetched_at,
             expires_at = excluded.expires_at`
        )
        .bind(
          platform,
          season.id,
          season.isCurrent ? 1 : 0,
          season.displayName,
          fetchedAt.toISOString(),
          expiresAt
        )
        .run()
    }
  }

  async getCachedStats(
    platform: Platform,
    playerId: string,
    seasonId: string,
    gameMode: SeasonStats["gameMode"]
  ): Promise<SeasonStats | null> {
    if (!this.db) return null
    const row = await this.db
      .prepare(
        `SELECT * FROM player_season_stats
         WHERE platform = ? AND player_id = ? AND season_id = ? AND game_mode = ? AND expires_at > ?`
      )
      .bind(platform, playerId, seasonId, gameMode, new Date().toISOString())
      .first<StatsRow>()
    if (!row) {
      await this.db
        .prepare(
          `DELETE FROM player_season_stats
           WHERE platform = ? AND player_id = ? AND season_id = ? AND game_mode = ? AND expires_at <= ?`
        )
        .bind(platform, playerId, seasonId, gameMode, new Date().toISOString())
        .run()
      return null
    }
    return {
      platform: row.platform,
      playerId: row.player_id,
      seasonId: row.season_id,
      gameMode: row.game_mode,
      kills: row.kills,
      deaths: row.deaths,
      wins: row.wins,
      rounds: row.rounds,
      assists: row.assists,
      damage: row.damage,
      headshotKills: row.headshot_kills,
      longestKill: row.longest_kill,
      timeSurvived: row.time_survived,
      winRate: row.rounds > 0 ? row.wins / row.rounds : 0,
      kda: row.deaths > 0 ? (row.kills + row.assists) / row.deaths : row.kills,
      fetchedAt: row.fetched_at,
      source: "cache",
    }
  }

  async upsertStats(stats: SeasonStats, fetchedAt = new Date()) {
    if (!this.db) return
    const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS).toISOString()
    await this.db
      .prepare(
        `INSERT INTO player_season_stats
         (platform, player_id, season_id, game_mode, kills, deaths, wins, rounds, assists, damage,
          headshot_kills, longest_kill, time_survived, fetched_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, player_id, season_id, game_mode) DO UPDATE SET
           kills = excluded.kills, deaths = excluded.deaths, wins = excluded.wins,
           rounds = excluded.rounds, assists = excluded.assists, damage = excluded.damage,
           headshot_kills = excluded.headshot_kills, longest_kill = excluded.longest_kill,
           time_survived = excluded.time_survived, fetched_at = excluded.fetched_at,
           expires_at = excluded.expires_at`
      )
      .bind(
        stats.platform,
        stats.playerId,
        stats.seasonId,
        stats.gameMode,
        stats.kills,
        stats.deaths,
        stats.wins,
        stats.rounds,
        stats.assists,
        stats.damage,
        stats.headshotKills,
        stats.longestKill,
        stats.timeSurvived,
        fetchedAt.toISOString(),
        expiresAt
      )
      .run()
  }

  async getCachedMatch(
    matchId: string,
    targetPlayerId?: string
  ): Promise<MatchSummary | null> {
    if (!this.db) return null
    const row = await this.db
      .prepare(`SELECT * FROM matches WHERE match_id = ? AND expires_at > ?`)
      .bind(matchId, new Date().toISOString())
      .first<MatchRow>()
    if (!row) {
      await this.db
        .prepare(`DELETE FROM matches WHERE match_id = ? AND expires_at <= ?`)
        .bind(matchId, new Date().toISOString())
        .run()
      return null
    }
    const participants = json<MatchSummary["participants"]>(
      row.participants_json,
      []
    )
    const target = participants.find(
      (participant) => participant.id === targetPlayerId
    )
    return {
      id: row.match_id,
      platform: row.platform,
      mapName: row.map_name ?? "未知地图",
      gameMode: row.game_mode ?? "未知模式",
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds ?? 0,
      participantCount: participants.length,
      targetPlayerRank: target?.rank ?? null,
      targetPlayerKills: target?.kills ?? 0,
      telemetryAvailable: Boolean(row.telemetry_url),
      participants,
      source: "cache",
    }
  }

  async upsertMatch(
    match: MatchSummary & { telemetryUrl?: string | null },
    fetchedAt = new Date()
  ) {
    if (!this.db) return
    const expiresAt = new Date(fetchedAt.getTime() + MATCH_TTL_MS).toISOString()
    await this.db
      .prepare(
        `INSERT INTO matches
         (match_id, platform, map_name, game_mode, started_at, duration_seconds, title_id,
          telemetry_url, participants_json, fetched_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(match_id) DO UPDATE SET
           platform = excluded.platform, map_name = excluded.map_name,
           game_mode = excluded.game_mode, started_at = excluded.started_at,
           duration_seconds = excluded.duration_seconds, telemetry_url = excluded.telemetry_url,
           participants_json = excluded.participants_json, fetched_at = excluded.fetched_at,
           expires_at = excluded.expires_at`
      )
      .bind(
        match.id,
        match.platform,
        match.mapName,
        match.gameMode,
        match.startedAt,
        match.durationSeconds,
        null,
        match.telemetryUrl ?? null,
        JSON.stringify(match.participants),
        fetchedAt.toISOString(),
        expiresAt
      )
      .run()
  }

  async getCachedAnalysis(
    platform: Platform,
    playerId: string,
    matchId: string
  ): Promise<MatchAnalysis | null> {
    if (!this.db) return null
    const row = await this.db
      .prepare(
        `SELECT * FROM player_match_analysis
         WHERE platform = ? AND player_id = ? AND match_id = ?
           AND parser_version = ? AND expires_at > ?`
      )
      .bind(
        platform,
        playerId,
        matchId,
        REPLAY_PARSER_VERSION,
        new Date().toISOString()
      )
      .first<AnalysisRow>()
    if (!row) {
      await this.db
        .prepare(
          `DELETE FROM player_match_analysis
           WHERE platform = ? AND player_id = ? AND match_id = ? AND expires_at <= ?`
        )
        .bind(platform, playerId, matchId, new Date().toISOString())
        .run()
      return null
    }
    return {
      matchId: row.match_id,
      playerId: row.player_id,
      kills: json<MatchAnalysis["kills"]>(row.kills_json, []),
      timeline: json<MatchAnalysis["timeline"]>(row.timeline_json, []),
      trajectory: json<MatchAnalysis["trajectory"]>(row.trajectory_json, []),
      flightPath: json<MatchAnalysis["flightPath"]>(
        row.flight_path_json ?? "[]",
        []
      ),
      carePackages: json<MatchAnalysis["carePackages"]>(
        row.care_packages_json ?? "[]",
        []
      ),
      replayPlayers: json<MatchAnalysis["replayPlayers"]>(
        row.replay_players_json ?? "[]",
        []
      ),
      replayFrames: json<MatchAnalysis["replayFrames"]>(
        row.replay_frames_json ?? "[]",
        []
      ),
      replayDurationSeconds: row.replay_duration_seconds ?? 0,
      source: "cache",
    }
  }

  async upsertAnalysis(
    platform: Platform,
    analysis: MatchAnalysis,
    generatedAt = new Date()
  ) {
    if (!this.db) return
    const expiresAt = new Date(
      generatedAt.getTime() + MATCH_TTL_MS
    ).toISOString()
    await this.db
      .prepare(
        `INSERT INTO player_match_analysis
         (platform, player_id, match_id, kills_json, trajectory_json, timeline_json,
          flight_path_json, care_packages_json, replay_players_json, replay_frames_json, replay_duration_seconds, parser_version,
          generated_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, player_id, match_id) DO UPDATE SET
           kills_json = excluded.kills_json, trajectory_json = excluded.trajectory_json,
           flight_path_json = excluded.flight_path_json,
           care_packages_json = excluded.care_packages_json,
           timeline_json = excluded.timeline_json, replay_players_json = excluded.replay_players_json,
           replay_frames_json = excluded.replay_frames_json,
           replay_duration_seconds = excluded.replay_duration_seconds,
           parser_version = excluded.parser_version,
           generated_at = excluded.generated_at, expires_at = excluded.expires_at`
      )
      .bind(
        platform,
        analysis.playerId,
        analysis.matchId,
        JSON.stringify(analysis.kills),
        JSON.stringify(analysis.trajectory),
        JSON.stringify(analysis.timeline),
        JSON.stringify(analysis.flightPath),
        JSON.stringify(analysis.carePackages),
        JSON.stringify(analysis.replayPlayers),
        JSON.stringify(analysis.replayFrames),
        analysis.replayDurationSeconds,
        REPLAY_PARSER_VERSION,
        generatedAt.toISOString(),
        expiresAt
      )
      .run()
  }
}
