import { fail, ok } from "@/api-response"
import { StatsRepository } from "@/lib/db/repository"
import { getMatch } from "@/lib/pubg/client"
import { PLATFORMS, type Platform } from "@/lib/pubg/types"
import { getRuntimeEnv } from "@/lib/runtime-env"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    const platform = new URL(request.url).searchParams.get("platform")
    const playerId =
      new URL(request.url).searchParams.get("playerId") ?? undefined
    if (!platform || !PLATFORMS.includes(platform as Platform)) {
      throw new Error("platform 必须是 steam、kakao、psn 或 xbox。")
    }
    const repository = new StatsRepository((await getRuntimeEnv()).DB)
    const cached = await repository.getCachedMatch(matchId, playerId)
    if (cached) return ok(cached)

    const match = await getMatch(platform as Platform, matchId, playerId)
    await repository.upsertMatch(match)
    return ok(match)
  } catch (error) {
    return fail(error)
  }
}
