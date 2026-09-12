import type {
  GameMode,
  MatchParticipant,
  MatchSummary,
  Platform,
  SeasonStats,
  SeasonSummary,
  TelemetryEvent,
} from "@/lib/pubg/types"

export interface JsonApiResource {
  id: string
  type?: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, JsonApiRelationship>
}

export interface JsonApiRelationship {
  data?: JsonApiResource | JsonApiResource[] | null
  links?: { related?: string } | string
}

export interface JsonApiDocument {
  data?: JsonApiResource | JsonApiResource[] | null
  included?: JsonApiResource[]
}

const numberValue = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const stringValue = (value: unknown, fallback = "") =>
  typeof value === "string" && value.length > 0 ? value : fallback

export function relationshipIds(
  resource: JsonApiResource | undefined,
  name: string
): string[] {
  const data = resource?.relationships?.[name]?.data
  if (Array.isArray(data)) return data.map((item) => item.id)
  return data?.id ? [data.id] : []
}

export function parsePlayerDocument(
  document: JsonApiDocument,
  platform: Platform,
  shard: string,
  now = new Date().toISOString()
) {
  const resource = Array.isArray(document.data)
    ? document.data[0]
    : document.data
  if (!resource) return null

  const attributes = resource.attributes ?? {}
  return {
    id: resource.id,
    name: stringValue(attributes.name, resource.id),
    platform,
    shard,
    recentMatchIds: relationshipIds(resource, "matches"),
    lastQueriedAt: now,
  }
}

export function parseSeasons(
  document: JsonApiDocument,
  currentSeasonId?: string
): SeasonSummary[] {
  const resources = Array.isArray(document.data)
    ? document.data
    : document.data
      ? [document.data]
      : []

  return resources.map((resource) => {
    const attributes = resource.attributes ?? {}
    return {
      id: resource.id,
      displayName: stringValue(attributes.name, resource.id),
      isCurrent:
        Boolean(attributes.isCurrentSeason) || resource.id === currentSeasonId,
    }
  })
}

export function parseSeasonStats(
  document: JsonApiDocument,
  platform: Platform,
  playerId: string,
  seasonId: string,
  gameMode: GameMode,
  fetchedAt = new Date().toISOString(),
  source: "api" | "cache" = "api"
): SeasonStats {
  const resource = Array.isArray(document.data)
    ? document.data[0]
    : document.data
  const stats = (
    resource?.attributes?.gameModeStats as Record<string, unknown> | undefined
  )?.[gameMode] as Record<string, unknown> | undefined
  const values = stats ?? {}
  const rounds = numberValue(values.roundsPlayed)
  const kills = numberValue(values.kills)
  const deaths = numberValue(values.losses)

  return {
    platform,
    playerId,
    seasonId,
    gameMode,
    kills,
    deaths,
    wins: numberValue(values.wins),
    rounds,
    assists: numberValue(values.assists),
    damage: numberValue(values.damageDealt),
    headshotKills: numberValue(values.headshotKills),
    longestKill: numberValue(values.longestKill),
    timeSurvived: numberValue(values.timeSurvived),
    winRate: rounds > 0 ? numberValue(values.wins) / rounds : 0,
    kda: deaths > 0 ? (kills + numberValue(values.assists)) / deaths : kills,
    fetchedAt,
    source,
  }
}

function parseParticipant(resource: JsonApiResource): MatchParticipant {
  const stats = (resource.attributes?.stats ?? {}) as Record<string, unknown>
  return {
    id: stringValue(stats.playerId, resource.id),
    name: stringValue(stats.name, resource.id),
    rank: Number.isFinite(Number(stats.winPlace))
      ? Number(stats.winPlace)
      : null,
    kills: numberValue(stats.kills),
    damage: numberValue(stats.damageDealt),
    survivalTime: numberValue(stats.timeSurvived),
  }
}

export function parseMatchDocument(
  document: JsonApiDocument,
  platform: Platform,
  targetPlayerId?: string,
  source: "api" | "cache" = "api"
): MatchSummary & { telemetryUrl: string | null } {
  const resource = Array.isArray(document.data)
    ? document.data[0]
    : document.data
  const attributes = resource?.attributes ?? {}
  const participants = (document.included ?? [])
    .filter((item) => item.type === "participant")
    .map(parseParticipant)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
  const target = targetPlayerId
    ? participants.find((participant) => participant.id === targetPlayerId)
    : undefined
  const assetId = relationshipIds(resource ?? undefined, "assets")[0]
  const asset = document.included?.find(
    (item) => item.id === assetId && item.type === "asset"
  )
  const telemetryUrl = stringValue(asset?.attributes?.URL, "") || null

  return {
    id: resource?.id ?? "",
    platform,
    mapName: stringValue(attributes.mapName, "未知地图"),
    gameMode: stringValue(attributes.gameMode, "未知模式"),
    startedAt: stringValue(attributes.createdAt, "") || null,
    durationSeconds: numberValue(attributes.duration),
    participantCount: participants.length,
    targetPlayerRank: target?.rank ?? null,
    targetPlayerKills: target?.kills ?? 0,
    telemetryAvailable: Boolean(telemetryUrl),
    participants,
    source,
    telemetryUrl,
  }
}

function locationOf(value: unknown) {
  if (!value || typeof value !== "object") return null
  const location = value as Record<string, unknown>
  const x = numberValue(location.x, Number.NaN)
  const y = numberValue(location.y, Number.NaN)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y, z: numberValue(location.z) }
}

function telemetryCharacter(event: Record<string, unknown>, key: string) {
  const character = event[key]
  return character && typeof character === "object"
    ? (character as Record<string, unknown>)
    : undefined
}

export function parseTelemetry(
  raw: unknown,
  playerId: string,
  matchId: string
): {
  matchId: string
  playerId: string
  kills: TelemetryEvent[]
  timeline: TelemetryEvent[]
  trajectory: Array<{ x: number; y: number; z?: number }>
} {
  const events = Array.isArray(raw) ? raw : []
  const timeline: TelemetryEvent[] = []
  const trajectory: Array<{ x: number; y: number; z?: number }> = []

  for (const item of events) {
    if (!item || typeof item !== "object") continue
    const event = item as Record<string, unknown>
    const type = stringValue(
      event._T,
      stringValue(event.type, "TelemetryEvent")
    )
    const timestamp =
      stringValue(event._D, stringValue(event.timestamp, "")) || null
    const attacker =
      telemetryCharacter(event, "attacker") ??
      telemetryCharacter(event, "killer")
    const victim = telemetryCharacter(event, "victim")
    const character = telemetryCharacter(event, "character")
    const actor =
      stringValue(attacker?.accountId, stringValue(character?.accountId, "")) ||
      null
    const target = stringValue(victim?.accountId, "") || null
    const location =
      locationOf(character?.location) ??
      locationOf(attacker?.location) ??
      locationOf(event.location)

    if (
      actor === playerId &&
      location &&
      (type === "LogPlayerPosition" || type === "LogPlayerAttack")
    ) {
      trajectory.push(location)
    }

    const isRelevant =
      type.includes("Kill") ||
      type.includes("Damage") ||
      type.includes("Death") ||
      type === "LogPlayerPosition" ||
      type === "LogPlayerLogin" ||
      type === "LogPlayerCreate"
    if (!isRelevant) continue

    timeline.push({
      type,
      timestamp,
      actor,
      target,
      location,
      message: timelineMessage(type, actor, target),
    })
  }

  const kills = timeline.filter(
    (event) => event.type.includes("Kill") && event.actor === playerId
  )

  return {
    matchId,
    playerId,
    kills,
    timeline: timeline
      .filter((event) => event.type !== "LogPlayerPosition")
      .slice(-120),
    trajectory: downsample(trajectory, 240),
  }
}

function timelineMessage(
  type: string,
  actor: string | null,
  target: string | null
) {
  if (type.includes("Kill"))
    return `${actor ?? "玩家"} 淘汰了 ${target ?? "对手"}`
  if (type.includes("Damage")) return `${actor ?? "玩家"} 造成了一次伤害`
  if (type.includes("Death")) return `${target ?? actor ?? "玩家"} 被淘汰`
  if (type === "LogPlayerLogin") return "玩家加入比赛"
  if (type === "LogPlayerCreate") return "玩家进入战场"
  return type
}

function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  const step = (items.length - 1) / (max - 1)
  return Array.from(
    { length: max },
    (_, index) => items[Math.round(index * step)]
  )
}
