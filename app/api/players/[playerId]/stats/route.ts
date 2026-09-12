import { fail, ok } from "@/api-response"
import { StatsRepository } from "@/lib/db/repository"
import { getCurrentSeason, getSeasonStats, getSeasons } from "@/lib/pubg/client"
import {
  GAME_MODES,
  PLATFORMS,
  type GameMode,
  type Platform,
} from "@/lib/pubg/types"
import { getRuntimeEnv } from "@/lib/runtime-env"

function paramsFrom(request: Request) {
  const url = new URL(request.url)
  const platform = url.searchParams.get("platform")
  const gameMode = url.searchParams.get("gameMode") ?? "squad"
  if (!platform || !PLATFORMS.includes(platform as Platform)) {
    throw new Error("platform 必须是 steam、kakao、psn 或 xbox。")
  }
  if (!GAME_MODES.includes(gameMode as GameMode)) {
    throw new Error("gameMode 不是受支持的 PUBG 模式。")
  }
  return {
    platform: platform as Platform,
    season: url.searchParams.get("season") ?? "current",
    gameMode: gameMode as GameMode,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { platform, season, gameMode } = paramsFrom(request)
    const repository = new StatsRepository((await getRuntimeEnv()).DB)
    await repository.ensurePlayer(platform, playerId)
    let seasonId = season
    if (season === "current") {
      const current = getCurrentSeason(await getSeasons(platform))
      if (!current) throw new Error("PUBG API 没有返回可用赛季。")
      seasonId = current.id
    }

    const cached = await repository.getCachedStats(
      platform,
      playerId,
      seasonId,
      gameMode
    )
    if (cached) return ok(cached)

    const stats = await getSeasonStats(platform, playerId, seasonId, gameMode)
    await repository.upsertStats(stats)
    return ok(stats)
  } catch (error) {
    return fail(error)
  }
}
