import { fail, ok } from "@/api-response"
import { StatsRepository } from "@/lib/db/repository"
import { getSeasons } from "@/lib/pubg/client"
import { PLATFORMS, type Platform } from "@/lib/pubg/types"
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
    const platform = platformFrom(request)
    const seasons = await getSeasons(platform)
    const runtimeEnv = await getRuntimeEnv()
    await new StatsRepository(runtimeEnv.DB).upsertSeasons(platform, seasons)
    return ok({ platform, seasons })
  } catch (error) {
    return fail(error)
  }
}
