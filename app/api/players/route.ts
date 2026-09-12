import { fail, ok } from "@/api-response"
import { StatsRepository } from "@/lib/db/repository"
import { getMatch, searchPlayer } from "@/lib/pubg/client"
import { PLATFORMS, type MatchSummary, type Platform } from "@/lib/pubg/types"
import { getRuntimeEnv } from "@/lib/runtime-env"

function platformFrom(request: Request): Platform {
  const platform = new URL(request.url).searchParams.get("platform")
  if (!platform || !PLATFORMS.includes(platform as Platform)) {
    throw new Error("platform 必须是 steam、kakao、psn 或 xbox。")
  }
  return platform as Platform
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const platform = platformFrom(request)
    const name = url.searchParams.get("name")?.trim() ?? ""
    if (name.length < 2 || name.length > 64) {
      return fail(new Error("玩家名称长度需要在 2 到 64 个字符之间。"))
    }

    const player = await searchPlayer(platform, name)
    const repository = new StatsRepository((await getRuntimeEnv()).DB)
    await repository.upsertPlayer(player)

    const recentMatches: MatchSummary[] = []
    for (const matchId of player.recentMatchIds.slice(0, 5)) {
      try {
        const match = await getMatch(platform, matchId, player.id)
        await repository.upsertMatch(match)
        recentMatches.push(match)
      } catch {
        // A single expired match should not hide the player's remaining history.
      }
    }

    return ok({ player, recentMatches })
  } catch (error) {
    return fail(error)
  }
}
