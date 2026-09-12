import { errorFromUpstream, PubgApiError } from "@/lib/pubg/errors"
import {
  parseMatchDocument,
  parsePlayerDocument,
  parseSeasonStats,
  parseSeasons,
  parseTelemetry,
  type JsonApiDocument,
} from "@/lib/pubg/parse"
import type {
  GameMode,
  MatchAnalysis,
  MatchSummary,
  Platform,
  PlayerSummary,
  SeasonStats,
  SeasonSummary,
} from "@/lib/pubg/types"
import { getRuntimeEnv } from "@/lib/runtime-env"

const API_ROOT = "https://api.pubg.com"

export const PLATFORM_SHARDS: Record<Platform, string> = {
  steam: "steam",
  kakao: "kakao",
  psn: "psn",
  xbox: "xbox",
}

function shard(platform: Platform) {
  return PLATFORM_SHARDS[platform]
}

async function request<T>(
  url: string,
  notFoundCode: "player_not_found" | "match_not_found" = "player_not_found"
): Promise<T> {
  const apiKey = (await getRuntimeEnv()).PUBG_API_KEY
  if (!apiKey) {
    throw new PubgApiError(
      "missing_api_key",
      "服务端尚未配置 PUBG_API_KEY，请先执行 wrangler secret put PUBG_API_KEY。",
      503
    )
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    })
  } catch {
    throw new PubgApiError("upstream_error", "无法连接 PUBG API。", 502)
  }

  if (!response.ok) {
    const error = errorFromUpstream(response)
    if (response.status === 404) {
      throw new PubgApiError(
        notFoundCode,
        notFoundCode === "match_not_found"
          ? "没有找到这场比赛，或比赛已不在 PUBG API 保留期内。"
          : error.message,
        404
      )
    }
    throw error
  }
  return (await response.json()) as T
}

export async function searchPlayer(
  platform: Platform,
  name: string
): Promise<PlayerSummary> {
  const url = new URL(`${API_ROOT}/shards/${shard(platform)}/players`)
  url.searchParams.set("filter[playerNames]", name)
  const document = await request<JsonApiDocument>(url.toString())
  const player = parsePlayerDocument(document, platform, shard(platform))
  if (!player) {
    throw new PubgApiError("player_not_found", "没有找到这个 PUBG 玩家。", 404)
  }
  return player
}

export async function getSeasons(platform: Platform): Promise<SeasonSummary[]> {
  const document = await request<JsonApiDocument>(
    `${API_ROOT}/shards/${shard(platform)}/seasons`
  )
  return parseSeasons(document)
}

export async function getSeasonStats(
  platform: Platform,
  playerId: string,
  seasonId: string,
  gameMode: GameMode
): Promise<SeasonStats> {
  const document = await request<JsonApiDocument>(
    `${API_ROOT}/shards/${shard(platform)}/players/${encodeURIComponent(playerId)}/seasons/${encodeURIComponent(seasonId)}`
  )
  return parseSeasonStats(document, platform, playerId, seasonId, gameMode)
}

export async function getMatch(
  platform: Platform,
  matchId: string,
  targetPlayerId?: string
): Promise<MatchSummary & { telemetryUrl: string | null }> {
  const document = await request<JsonApiDocument>(
    `${API_ROOT}/shards/${shard(platform)}/matches/${encodeURIComponent(matchId)}`,
    "match_not_found"
  )
  const match = parseMatchDocument(document, platform, targetPlayerId)
  assertMatchFresh(match.startedAt)
  return match
}

export async function getMatchAnalysis(
  platform: Platform,
  matchId: string,
  playerId: string
): Promise<MatchAnalysis> {
  const document = await request<JsonApiDocument>(
    `${API_ROOT}/shards/${shard(platform)}/matches/${encodeURIComponent(matchId)}`,
    "match_not_found"
  )
  const match = parseMatchDocument(document, platform, playerId)
  assertMatchFresh(match.startedAt)

  if (!match.telemetryUrl) {
    throw new PubgApiError(
      "telemetry_unavailable",
      "这场比赛没有可用的遥测数据。",
      404
    )
  }

  let telemetryResponse: Response
  try {
    telemetryResponse = await fetch(match.telemetryUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
  } catch {
    throw new PubgApiError(
      "telemetry_unavailable",
      "无法连接比赛遥测服务。",
      502
    )
  }
  if (!telemetryResponse.ok) {
    throw new PubgApiError(
      "telemetry_unavailable",
      "这场比赛的遥测数据暂时不可用。",
      502
    )
  }
  const telemetry = (await telemetryResponse.json()) as unknown
  return { ...parseTelemetry(telemetry, playerId, matchId), source: "api" }
}

export function getCurrentSeason(seasons: SeasonSummary[]) {
  return seasons.find((season) => season.isCurrent) ?? seasons[0]
}

function assertMatchFresh(startedAt: string | null) {
  if (!startedAt) return
  const ageMs = Date.now() - new Date(startedAt).getTime()
  if (Number.isFinite(ageMs) && ageMs > 14 * 24 * 60 * 60 * 1000) {
    throw new PubgApiError(
      "match_expired",
      "PUBG 比赛数据仅保留 14 天，这场比赛已经过期。",
      410
    )
  }
}
