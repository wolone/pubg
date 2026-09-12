export const PLATFORMS = ["steam", "kakao", "psn", "xbox"] as const
export type Platform = (typeof PLATFORMS)[number]

export const GAME_MODES = [
  "solo",
  "solo-fpp",
  "duo",
  "duo-fpp",
  "squad",
  "squad-fpp",
] as const
export type GameMode = (typeof GAME_MODES)[number]

export interface PlayerSummary {
  id: string
  name: string
  platform: Platform
  shard: string
  recentMatchIds: string[]
  lastQueriedAt: string
}

export interface SeasonSummary {
  id: string
  displayName: string
  isCurrent: boolean
}

export interface SeasonStats {
  platform: Platform
  playerId: string
  seasonId: string
  gameMode: GameMode
  kills: number
  deaths: number
  wins: number
  rounds: number
  assists: number
  damage: number
  headshotKills: number
  longestKill: number
  timeSurvived: number
  winRate: number
  kda: number
  fetchedAt: string
  source: "api" | "cache"
}

export interface MatchParticipant {
  id: string
  name: string
  rank: number | null
  kills: number
  damage: number
  survivalTime: number
}

export interface MatchSummary {
  id: string
  platform: Platform
  mapName: string
  gameMode: string
  startedAt: string | null
  durationSeconds: number
  participantCount: number
  targetPlayerRank: number | null
  targetPlayerKills: number
  telemetryAvailable: boolean
  participants: MatchParticipant[]
  source: "api" | "cache"
}

export interface TelemetryEvent {
  type: string
  timestamp: string | null
  elapsedSeconds?: number
  actor: string | null
  target: string | null
  location: { x: number; y: number; z?: number } | null
  message: string
}

export type ReplayPlayerStatus = "alive" | "knocked" | "dead"

export interface ReplayPlayer {
  id: string
  name: string
}

export interface ReplayZone {
  x: number
  y: number
  radius: number
}

export interface ReplayZones {
  bluezone: ReplayZone | null
  safezone: ReplayZone | null
  redzone: ReplayZone | null
}

export type ReplayFramePlayer = [
  playerIndex: number,
  x: number,
  y: number,
  status: ReplayPlayerStatus,
]

export interface ReplayFrame {
  elapsedSeconds: number
  players: ReplayFramePlayer[]
  zones?: ReplayZones
}

export interface MatchAnalysis {
  matchId: string
  playerId: string
  kills: TelemetryEvent[]
  timeline: TelemetryEvent[]
  trajectory: Array<{ x: number; y: number; z?: number }>
  replayPlayers: ReplayPlayer[]
  replayFrames: ReplayFrame[]
  replayDurationSeconds: number
  source: "api" | "cache"
}

export type ApiErrorCode =
  | "invalid_request"
  | "missing_api_key"
  | "player_not_found"
  | "match_not_found"
  | "match_expired"
  | "rate_limited"
  | "upstream_error"
  | "telemetry_unavailable"
  | "database_error"

export interface ApiError {
  error: {
    code: ApiErrorCode
    message: string
    retryAfterSeconds?: number
  }
}
