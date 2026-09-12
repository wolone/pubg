import type { D1Database } from "@cloudflare/workers-types"

export interface AppRuntimeEnv {
  DB?: D1Database
  PUBG_API_KEY?: string
}

export async function getRuntimeEnv(): Promise<AppRuntimeEnv> {
  try {
    const workers = await import(
      /* @vite-ignore */ /* webpackIgnore: true */ "cloudflare:workers"
    )
    return workers.env as AppRuntimeEnv
  } catch {
    if (typeof process !== "undefined") {
      return { PUBG_API_KEY: process.env.PUBG_API_KEY }
    }
    return {}
  }
}
