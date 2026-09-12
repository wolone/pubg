import { fail, ok } from "@/api-response"
import { StatsRepository } from "@/lib/db/repository"
import { getMatch, getMatchAnalysis } from "@/lib/pubg/client"
import { PLATFORMS, type Platform } from "@/lib/pubg/types"
import { getRuntimeEnv } from "@/lib/runtime-env"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    const url = new URL(request.url)
    const platform = url.searchParams.get("platform")
    const playerId = url.searchParams.get("playerId")?.trim()
    if (!platform || !PLATFORMS.includes(platform as Platform)) {
      throw new Error("platform 必须是 steam、kakao、psn 或 xbox。")
    }
    if (!playerId) throw new Error("playerId 不能为空。")

    const repository = new StatsRepository((await getRuntimeEnv()).DB)
    const cached = await repository.getCachedAnalysis(
      platform as Platform,
      playerId,
      matchId
    )
    if (cached) return ok(cached)

    const match = await getMatch(platform as Platform, matchId, playerId)
    await repository.upsertMatch(match)
    const analysis = await getMatchAnalysis(
      platform as Platform,
      matchId,
      playerId
    )
    await repository.upsertAnalysis(platform as Platform, analysis)
    return ok(analysis)
  } catch (error) {
    return fail(error)
  }
}
