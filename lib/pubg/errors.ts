import type { ApiErrorCode } from "@/lib/pubg/types"

export class PubgApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 500,
    public readonly retryAfterSeconds?: number
  ) {
    super(message)
    this.name = "PubgApiError"
  }
}

export function errorFromUpstream(response: Response): PubgApiError {
  if (response.status === 401 || response.status === 403) {
    return new PubgApiError(
      "missing_api_key",
      "PUBG API Key 无效或未授权，请在 Worker Secret 中配置。",
      response.status
    )
  }

  if (response.status === 404) {
    return new PubgApiError(
      "player_not_found",
      "PUBG API 中没有找到对应资源。",
      404
    )
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"))
    return new PubgApiError(
      "rate_limited",
      "PUBG API 请求频率已达上限，请稍后再试。",
      429,
      Number.isFinite(retryAfter) ? retryAfter : undefined
    )
  }

  return new PubgApiError(
    "upstream_error",
    `PUBG API 暂时不可用（HTTP ${response.status}）。`,
    502
  )
}
