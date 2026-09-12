import { PubgApiError } from "@/lib/pubg/errors"
import type { ApiError } from "@/lib/pubg/types"

export function ok<T>(data: T, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  })
}

export function fail(error: unknown) {
  const apiError =
    error instanceof PubgApiError
      ? error
      : error instanceof Error
        ? new PubgApiError("invalid_request", error.message, 400)
        : new PubgApiError(
            "upstream_error",
            "服务暂时不可用，请稍后重试。",
            500
          )
  const body: ApiError = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.retryAfterSeconds
        ? { retryAfterSeconds: apiError.retryAfterSeconds }
        : {}),
    },
  }
  return Response.json(body, {
    status: apiError.status,
    headers: {
      "cache-control": "no-store",
      ...(apiError.retryAfterSeconds
        ? { "retry-after": String(apiError.retryAfterSeconds) }
        : {}),
    },
  })
}
