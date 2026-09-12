import type {
  GameMode,
  MatchParticipant,
  MatchSummary,
  Platform,
  ReplayFrame,
  ReplayPlayer,
  ReplayPlayerStatus,
  ReplayZones,
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

function seasonDisplayName(id: string): string {
  const numberedSeason = id.match(/pc-2018-(\d+)$/)?.[1]
  if (numberedSeason) return `第 ${Number(numberedSeason)} 赛季`

  const yearSeason = id.match(/(\d{4})-(\d+)$/)
  if (yearSeason) return `${yearSeason[1]} 第 ${Number(yearSeason[2])} 赛季`

  return id
}

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
    const attributeName = stringValue(attributes.name)
    return {
      id: resource.id,
      displayName:
        attributeName && !attributeName.startsWith("division.")
          ? attributeName
          : seasonDisplayName(resource.id),
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
  matchId: string,
  participants: MatchParticipant[] = []
): {
  matchId: string
  playerId: string
  kills: TelemetryEvent[]
  timeline: TelemetryEvent[]
  trajectory: Array<{ x: number; y: number; z?: number }>
  replayPlayers: ReplayPlayer[]
  replayFrames: ReplayFrame[]
  replayDurationSeconds: number
} {
  const events = Array.isArray(raw) ? raw : []
  const timeline: TelemetryEvent[] = []
  const trajectory: Array<{ x: number; y: number; z?: number }> = []
  const replayChanges: ReplayChange[] = []
  const replayPlayersById = new Map<string, ReplayPlayer>()
  const positionCounts = new Map<string, number>()
  const participantIdsByName = new Map(
    participants.map((participant) => [participant.name, participant.id])
  )
  const eventTimes = events
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
    )
    .map((event) => timestampOf(event))
    .filter((value): value is number => value !== null)
  const replayStartMs = eventTimes.length ? Math.min(...eventTimes) : null

  for (const participant of participants) {
    replayPlayersById.set(participant.id, {
      id: participant.id,
      name: participant.name,
    })
  }

  for (const [eventIndex, item] of events.entries()) {
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
    const location =
      locationOf(character?.location) ??
      locationOf(attacker?.location) ??
      locationOf(event.location)
    const elapsedSeconds = elapsedTimeOf(event, replayStartMs, eventIndex)
    const characterName = stringValue(character?.name, "")
    const attackerName = stringValue(attacker?.name, "")
    const victimName = stringValue(victim?.name, "")
    const characterId =
      stringValue(character?.accountId, "") ||
      participantIdsByName.get(characterName) ||
      null
    const actor =
      stringValue(attacker?.accountId, "") ||
      participantIdsByName.get(attackerName) ||
      characterId
    const target =
      stringValue(victim?.accountId, "") ||
      participantIdsByName.get(victimName) ||
      null
    const replayZones = parseReplayZones(event)

    if (characterId) {
      registerReplayPlayer(
        replayPlayersById,
        characterId,
        characterName || characterId
      )
    }
    if (actor) {
      registerReplayPlayer(replayPlayersById, actor, attackerName || actor)
    }
    if (target) {
      registerReplayPlayer(replayPlayersById, target, victimName || target)
    }

    if (replayZones) {
      replayChanges.push({ elapsedSeconds, zones: replayZones })
    }

    if (location && (characterId || actor)) {
      const replayPlayerId = characterId ?? actor
      if (replayPlayerId) {
        replayChanges.push({
          elapsedSeconds,
          playerId: replayPlayerId,
          location,
        })
        positionCounts.set(
          replayPlayerId,
          (positionCounts.get(replayPlayerId) ?? 0) + 1
        )
      }
    }

    const victimLocation = locationOf(victim?.location)
    if (target && victimLocation) {
      replayChanges.push({
        elapsedSeconds,
        playerId: target,
        location: victimLocation,
      })
      positionCounts.set(target, (positionCounts.get(target) ?? 0) + 1)
    }

    if (type.includes("Kill")) {
      if (target) {
        replayChanges.push({
          elapsedSeconds,
          playerId: target,
          status: "dead",
          location: victimLocation,
        })
        if (victimLocation) {
          positionCounts.set(target, (positionCounts.get(target) ?? 0) + 1)
        }
      }
    } else if (type.includes("Death")) {
      const deadPlayerId = target ?? actor
      if (deadPlayerId) {
        replayChanges.push({
          elapsedSeconds,
          playerId: deadPlayerId,
          status: "dead",
        })
      }
    } else if (/groggy|knock/i.test(type)) {
      const knockedPlayerId = target ?? characterId
      if (knockedPlayerId) {
        replayChanges.push({
          elapsedSeconds,
          playerId: knockedPlayerId,
          status: "knocked",
        })
      }
    } else if (/revive|rescue/i.test(type)) {
      const revivedPlayerId = target ?? characterId
      if (revivedPlayerId) {
        replayChanges.push({
          elapsedSeconds,
          playerId: revivedPlayerId,
          status: "alive",
        })
      }
    }

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
      /groggy|knock|revive|rescue/i.test(type) ||
      type === "LogPlayerPosition" ||
      type === "LogPlayerLogin" ||
      type === "LogPlayerCreate"
    if (!isRelevant) continue

    timeline.push({
      type,
      timestamp,
      elapsedSeconds,
      actor,
      target,
      location,
      message: timelineMessage(type, actor, target),
    })
  }

  const kills = timeline.filter(
    (event) => event.type.includes("Kill") && event.actor === playerId
  )
  const replayPlayerIds = Array.from(replayPlayersById.keys())
    .sort((left, right) => {
      if (left === playerId) return -1
      if (right === playerId) return 1
      return (positionCounts.get(right) ?? 0) - (positionCounts.get(left) ?? 0)
    })
    .filter((id) => id === playerId || (positionCounts.get(id) ?? 0) > 0)
    .slice(0, 64)
  const replayPlayers = replayPlayerIds
    .map((id) => replayPlayersById.get(id))
    .filter((player): player is ReplayPlayer => Boolean(player))
  const replay = buildReplay(replayChanges, replayPlayerIds)

  return {
    matchId,
    playerId,
    kills,
    timeline: timeline
      .filter((event) => event.type !== "LogPlayerPosition")
      .slice(-120),
    trajectory: downsample(trajectory, 240),
    replayPlayers,
    replayFrames: replay.frames,
    replayDurationSeconds: replay.durationSeconds,
  }
}

type ReplayChange = {
  elapsedSeconds: number
  playerId?: string
  location?: { x: number; y: number; z?: number } | null
  status?: ReplayPlayerStatus
  zones?: ReplayZones
}

type ReplayState = {
  x: number
  y: number
  status: ReplayPlayerStatus
}

function timestampOf(event: Record<string, unknown>): number | null {
  const timestamp = stringValue(event._D, stringValue(event.timestamp, ""))
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function elapsedTimeOf(
  event: Record<string, unknown>,
  startMs: number | null,
  fallbackIndex: number
) {
  const timestamp = timestampOf(event)
  if (timestamp === null || startMs === null) return fallbackIndex / 10
  return Math.max(0, (timestamp - startMs) / 1000)
}

function registerReplayPlayer(
  players: Map<string, ReplayPlayer>,
  id: string,
  name: string
) {
  if (!players.has(id)) players.set(id, { id, name })
}

function parseReplayZones(event: Record<string, unknown>): ReplayZones | null {
  const value = event.gameState
  if (!value || typeof value !== "object") return null
  const gameState = value as Record<string, unknown>
  const bluezone = replayZoneOf(
    gameState.safetyZonePosition,
    gameState.safetyZoneRadius
  )
  const safezone = replayZoneOf(
    gameState.poisonGasWarningPosition,
    gameState.poisonGasWarningRadius
  )
  const redzone = replayZoneOf(
    gameState.redZonePosition,
    gameState.redZoneRadius
  )
  if (!bluezone && !safezone && !redzone) return null
  return { bluezone, safezone, redzone }
}

function replayZoneOf(position: unknown, radius: unknown) {
  const location = locationOf(position)
  const size = numberValue(radius, Number.NaN)
  if (!location || !Number.isFinite(size) || size <= 0) return null
  return { x: location.x, y: location.y, radius: size }
}

function buildReplay(changes: ReplayChange[], playerIds: string[]) {
  if (changes.length === 0) {
    return { frames: [] as ReplayFrame[], durationSeconds: 0 }
  }

  const sortedChanges = changes
    .filter((change) => !change.playerId || playerIds.includes(change.playerId))
    .sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
  const durationSeconds = Math.max(0, sortedChanges.at(-1)?.elapsedSeconds ?? 0)
  const stepSeconds = Math.max(1, Math.ceil(durationSeconds / 600))
  const playerIndexById = new Map(playerIds.map((id, index) => [id, index]))
  const states = new Map<string, ReplayState>()
  const frames: ReplayFrame[] = []
  let zones: ReplayZones | undefined
  let changeIndex = 0

  for (
    let elapsedSeconds = 0;
    elapsedSeconds <= durationSeconds;
    elapsedSeconds += stepSeconds
  ) {
    while (
      changeIndex < sortedChanges.length &&
      sortedChanges[changeIndex]!.elapsedSeconds <= elapsedSeconds
    ) {
      const change = sortedChanges[changeIndex]!
      if (change.zones) zones = change.zones
      if (change.playerId) {
        const previous = states.get(change.playerId)
        if (change.location) {
          states.set(change.playerId, {
            x: change.location.x,
            y: change.location.y,
            status: change.status ?? previous?.status ?? "alive",
          })
        } else if (previous && change.status) {
          states.set(change.playerId, { ...previous, status: change.status })
        }
      }
      changeIndex += 1
    }

    const framePlayers = Array.from(states.entries())
      .map(([id, state]) => {
        const playerIndex = playerIndexById.get(id)
        return playerIndex === undefined
          ? null
          : ([playerIndex, state.x, state.y, state.status] as const)
      })
      .filter((player): player is ReplayFrame["players"][number] =>
        Boolean(player)
      )
    if (framePlayers.length || zones) {
      const frame: ReplayFrame = {
        elapsedSeconds: Math.round(elapsedSeconds * 10) / 10,
        players: framePlayers,
      }
      if (zones) frame.zones = zones
      frames.push(frame)
    }
  }

  return { frames, durationSeconds }
}

function timelineMessage(
  type: string,
  actor: string | null,
  target: string | null
) {
  if (type.includes("Kill"))
    return `${actor ?? "玩家"} 淘汰了 ${target ?? "对手"}`
  if (type.includes("Damage")) return `${actor ?? "玩家"} 造成了一次伤害`
  if (/groggy|knock/i.test(type)) return `${target ?? actor ?? "玩家"} 被击倒`
  if (/revive|rescue/i.test(type)) return `${target ?? actor ?? "玩家"} 被救起`
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
