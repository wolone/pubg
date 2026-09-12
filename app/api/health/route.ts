import { ok, fail } from "@/api-response"
import { getRuntimeEnv } from "@/lib/runtime-env"

export async function GET() {
  try {
    const runtimeEnv = await getRuntimeEnv()
    const database = runtimeEnv.DB
    let databaseStatus: "connected" | "not_configured" = "not_configured"
    if (database) {
      await database.prepare("SELECT 1 AS ok").first()
      databaseStatus = "connected"
    }
    return ok({
      status: "ok",
      service: "pubg-stats",
      database: databaseStatus,
      apiKeyConfigured: Boolean(runtimeEnv.PUBG_API_KEY),
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    return fail(error)
  }
}
