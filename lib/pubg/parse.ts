import type {
  GameMode,
  MatchParticipant,
  MatchSummary,
  Platform,
  ReplayFrame,
  ReplayFramePlayer,
  ReplayFrameVehicle,
  ReplayCarePackageEvent,
  ReplayPlayer,
  ReplayPlayerStatus,
  ReplayTrajectoryPoint,
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

const MAX_REPLAY_PLAYERS = 100
// Keep the normalized replay snapshot safely below D1's per-value limit while
// retaining enough frames for smooth interpolation between official events.
const MAX_REPLAY_PLAYER_FRAMES = 48 * 600
const MAX_REPLAY_FRAME_COUNT = 320

const REPLAY_ATTACK_EVENT_TYPES = new Set([
  "LogPlayerAttack",
  "LogPlayerUseThrowable",
])

const REPLAY_STATE_EVENT_PATTERN =
  /^(?:LogPlayer(?:Login|Create|MakeGroggy|Knock|Revive|Rescue|Redeploy)|LogCarePackage(?:Spawn|Land)|LogVehicle(?:Ride|Leave)|LogParachuteLanding|LogVaultStart|LogSwim(?:Start|End|Stop))$/i

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
  const teamId = optionalInteger(stats.groupId ?? stats.teamId)
  return {
    id: stringValue(stats.playerId, resource.id),
    name: stringValue(stats.name, resource.id),
    ...(teamId !== undefined ? { teamId } : {}),
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
  const z = numberValue(location.z, Number.NaN)
  return { x, y, ...(Number.isFinite(z) ? { z } : {}) }
}

const AIRBORNE_Z_THRESHOLD = 20_000

function isAirborneLocation(location: { z?: number }) {
  return location.z !== undefined && location.z > AIRBORNE_Z_THRESHOLD
}

function telemetryCharacter(event: Record<string, unknown>, key: string) {
  const character = event[key]
  return character && typeof character === "object"
    ? (character as Record<string, unknown>)
    : undefined
}

function carePackageItems(itemPackage: Record<string, unknown> | undefined) {
  if (!itemPackage || !Array.isArray(itemPackage.items)) return undefined
  const items = itemPackage.items
    .map((item): { itemId: string; stackCount?: number } | null => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>
      const itemId = stringValue(record.itemId, "")
      if (!itemId) return null
      const stackCount = optionalNonNegativeNumber(record.stackCount)
      return {
        itemId,
        ...(stackCount !== undefined && stackCount > 1
          ? { stackCount: Math.floor(stackCount) }
          : {}),
      }
    })
    .filter((item): item is { itemId: string; stackCount?: number } =>
      Boolean(item)
    )
    .slice(0, 12)
  return items.length ? items : undefined
}

export function parseTelemetry(
  raw: unknown,
  playerId: string,
  matchId: string,
  participants: MatchParticipant[] = [],
  matchDurationSeconds?: number
): {
  matchId: string
  playerId: string
  kills: TelemetryEvent[]
  timeline: TelemetryEvent[]
  trajectory: ReplayTrajectoryPoint[]
  flightPath: Array<{ x: number; y: number; z?: number }>
  carePackages: ReplayCarePackageEvent[]
  replayPlayers: ReplayPlayer[]
  replayFrames: ReplayFrame[]
  replayDurationSeconds: number
} {
  const events = Array.isArray(raw) ? raw : []
  const timeline: TelemetryEvent[] = []
  const trajectory: ReplayTrajectoryPoint[] = []
  const carePackages: ReplayCarePackageEvent[] = []
  const flightPathBuckets = new Map<
    number,
    { x: number; y: number; z: number; count: number }
  >()
  const replayChanges: ReplayChange[] = []
  const replayPlayersById = new Map<string, ReplayPlayer>()
  const positionCounts = new Map<string, number>()
  let lastSnapshotPhase: number | undefined
  const participantIdsByName = new Map(
    participants.map((participant) => [participant.name, participant.id])
  )
  const eventRecords = events.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
  )
  const eventTimes = eventRecords
    .map((event) => timestampOf(event))
    .filter((value): value is number => value !== null)
  const matchStartMs =
    eventRecords
      .filter(
        (event) =>
          stringValue(event._T, stringValue(event.type, "")) ===
          "LogMatchStart"
      )
      .map((event) => timestampOf(event))
      .find((value): value is number => value !== null) ?? null
  const replayStartMs =
    matchStartMs ?? (eventTimes.length ? Math.min(...eventTimes) : null)
  const replayLimitSeconds =
    typeof matchDurationSeconds === "number" &&
    Number.isFinite(matchDurationSeconds) &&
    matchDurationSeconds > 0
      ? matchDurationSeconds
      : null

  for (const participant of participants) {
    replayPlayersById.set(participant.id, {
      id: participant.id,
      name: participant.name,
      ...(participant.teamId !== undefined
        ? { teamId: participant.teamId }
        : {}),
    })
  }

  for (const [eventIndex, item] of events.entries()) {
    if (!item || typeof item !== "object") continue
    const event = item as Record<string, unknown>
    const eventTimestampMs = timestampOf(event)
    if (
      matchStartMs !== null &&
      eventTimestampMs !== null &&
      eventTimestampMs < matchStartMs
    ) {
      continue
    }
    const type = stringValue(
      event._T,
      stringValue(event.type, "TelemetryEvent")
    )
    const timestamp =
      stringValue(event._D, stringValue(event.timestamp, "")) || null
    const attacker =
      telemetryCharacter(event, "attacker") ??
      telemetryCharacter(event, "finisher") ??
      telemetryCharacter(event, "killer")
    const victim = telemetryCharacter(event, "victim")
    const character = telemetryCharacter(event, "character")
    const vehicle = telemetryCharacter(event, "vehicle")
    const itemPackage = telemetryCharacter(event, "itemPackage")
    const location =
      locationOf(character?.location) ??
      locationOf(attacker?.location) ??
      locationOf(itemPackage?.location) ??
      locationOf(event.location)
    const elapsedSeconds = elapsedTimeOf(event, replayStartMs, eventIndex)
    if (
      replayLimitSeconds !== null &&
      elapsedSeconds > replayLimitSeconds
    ) {
      continue
    }
    const characterName = stringValue(character?.name, "")
    const attackerName = stringValue(attacker?.name, "")
    const victimName = stringValue(victim?.name, "")
    const characterTeamId = optionalInteger(character?.teamId)
    const attackerTeamId = optionalInteger(attacker?.teamId)
    const victimTeamId = optionalInteger(victim?.teamId)
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
    const victimLocation = locationOf(victim?.location)
    const health = optionalPercentageNumber(
      character?.health ?? attacker?.health
    )
    const victimHealth = optionalPercentageNumber(victim?.health)
    const damage = optionalNonNegativeNumber(event.damage)
    const healAmount = optionalNonNegativeNumber(event.healamount)
    const eventAlivePlayers = optionalNonNegativeNumber(event.numAlivePlayers)
    const damageType = stringValue(event.damageTypeCategory, "") || undefined
    const replaySnapshot = parseReplaySnapshot(event)
    const items = type.includes("CarePackage")
      ? carePackageItems(itemPackage)
      : undefined
    const packageState =
      type === "LogCarePackageSpawn"
        ? "spawned"
        : type === "LogCarePackageLand"
          ? "landed"
          : undefined
    const packageLocation = locationOf(itemPackage?.location)
    if (packageState && packageLocation) {
      const packageType = stringValue(itemPackage?.itemPackageId, "")
      carePackages.push({
        key: eventIndex,
        state: packageState,
        elapsedSeconds,
        location: packageLocation,
        ...(packageType ? { packageType } : {}),
        ...(items ? { items } : {}),
      })
    }
    const phase = replayPhaseOf(event)
    const vehicleType = vehicleTypeOf(vehicle)
    const isFlightPosition =
      type === "LogPlayerPosition" && location && isTransportAircraft(vehicle)
    const isPlayerAirborne = location ? isAirborneLocation(location) : false

    if (isFlightPosition) {
      const bucket = Math.max(0, Math.round(elapsedSeconds))
      const current = flightPathBuckets.get(bucket)
      if (current) {
        current.x += location.x
        current.y += location.y
        current.z += location.z ?? 0
        current.count += 1
      } else {
        flightPathBuckets.set(bucket, {
          x: location.x,
          y: location.y,
          z: location.z ?? 0,
          count: 1,
        })
      }
    }
    const isVehicleLeave = /VehicleLeave|PlayerLeaveVehicle/i.test(type)
    const vehicleState =
      isVehicleLeave ||
      (Object.prototype.hasOwnProperty.call(event, "vehicle") &&
        event.vehicle === null)
        ? null
        : vehicleType

    if (characterId) {
      registerReplayPlayer(
        replayPlayersById,
        characterId,
        characterName || characterId,
        characterTeamId
      )
    }
    if (actor) {
      registerReplayPlayer(
        replayPlayersById,
        actor,
        attackerName || actor,
        attackerTeamId ?? characterTeamId
      )
    }
    if (target) {
      registerReplayPlayer(
        replayPlayersById,
        target,
        victimName || target,
        victimTeamId
      )
    }

    const snapshotPhaseChanged =
      replaySnapshot &&
      phase !== undefined &&
      phase !== lastSnapshotPhase
    if (replaySnapshot && phase !== undefined) {
      lastSnapshotPhase = phase
    }

    if (
      replaySnapshot ||
      eventAlivePlayers !== undefined ||
      phase !== undefined
    ) {
      replayChanges.push({
        elapsedSeconds,
        ...(replaySnapshot ?? {}),
        ...(eventAlivePlayers !== undefined
          ? { alivePlayers: eventAlivePlayers }
          : {}),
        phase,
        ...(snapshotPhaseChanged
          ? { framePriority: "critical" as const }
          : replaySnapshot
            ? { framePriority: "supporting" as const }
          : type === "LogPhaseChange"
              ? { framePriority: "critical" as const }
              : {}),
      })
    }

    const replayPlayerId = characterId ?? actor
    if (replayPlayerId) {
      const isReplayLocation =
        location &&
        !type.startsWith("LogItem") &&
        (type === "LogPlayerPosition" || !isPlayerAirborne)
      if (isReplayLocation) {
        replayChanges.push({
          elapsedSeconds,
          playerId: replayPlayerId,
          location,
          health,
          vehicleType: vehicleState,
          ...(isPlayerAirborne
            ? {
                framePriority:
                  replayPlayerId === playerId
                    ? ("critical" as const)
                    : ("supporting" as const),
              }
            : {}),
        })
        positionCounts.set(
          replayPlayerId,
          (positionCounts.get(replayPlayerId) ?? 0) + 1
        )
      }
      if (!location && vehicleState !== undefined) {
        replayChanges.push({
          elapsedSeconds,
          playerId: replayPlayerId,
          vehicleType: vehicleState,
        })
      }
    }

    if (target && victimLocation) {
      replayChanges.push({
        elapsedSeconds,
        playerId: target,
        location: victimLocation,
        health: victimHealth,
      })
      positionCounts.set(target, (positionCounts.get(target) ?? 0) + 1)
    }

    if (type.includes("Kill") && actor && target && actor !== target) {
      replayChanges.push({
        elapsedSeconds,
        playerId: actor,
        killsDelta: 1,
        framePriority: "critical",
      })
    }
    if (
      type.includes("Damage") &&
      actor &&
      target &&
      actor !== target &&
      damage !== undefined
    ) {
      replayChanges.push({
        elapsedSeconds,
        playerId: actor,
        damageDelta: damage,
      })
    }
    if (
      type.includes("Damage") &&
      target &&
      damage !== undefined &&
      victimHealth === undefined &&
      damage > 0
    ) {
      replayChanges.push({
        elapsedSeconds,
        playerId: target,
        healthDelta: -damage,
      })
    }
    if (damageType === "Damage_DBNO" && target) {
      replayChanges.push({
        elapsedSeconds,
        playerId: target,
        status: "knocked",
        ...(victimLocation ? { location: victimLocation } : {}),
        framePriority: "critical",
      })
    }
    if (type === "LogHeal" && characterId && healAmount !== undefined) {
      replayChanges.push({
        elapsedSeconds,
        playerId: characterId,
        healthDelta: healAmount,
      })
    }

    if (type.includes("Kill")) {
      if (target) {
        replayChanges.push({
          elapsedSeconds,
          playerId: target,
          status: "dead",
          location: victimLocation,
          health: 0,
          framePriority: "critical",
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
          health: 0,
          framePriority: "critical",
        })
      }
    } else if (/groggy|knock/i.test(type)) {
      const knockedPlayerId = target ?? characterId
      if (knockedPlayerId) {
        replayChanges.push({
          elapsedSeconds,
          playerId: knockedPlayerId,
          status: "knocked",
          framePriority: "critical",
        })
      }
    } else if (/revive|rescue/i.test(type)) {
      const revivedPlayerId = target ?? characterId
      if (revivedPlayerId) {
        replayChanges.push({
          elapsedSeconds,
          playerId: revivedPlayerId,
          status: "alive",
          framePriority: "critical",
        })
      }
    }

    if (
      actor === playerId &&
      location &&
      !isFlightPosition &&
      type === "LogPlayerPosition"
    ) {
      trajectory.push({ ...location, elapsedSeconds })
    }

    const isRelevant =
      type.includes("Kill") ||
      type.includes("Damage") ||
      REPLAY_ATTACK_EVENT_TYPES.has(type) ||
      type.includes("Death") ||
      REPLAY_STATE_EVENT_PATTERN.test(type) ||
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
      ...(victimLocation ? { targetLocation: victimLocation } : {}),
      ...(items ? { items } : {}),
      ...(damage !== undefined ? { damage } : {}),
      ...(damageType ? { damageType } : {}),
      message: timelineMessage(
        type,
        actor ? (replayPlayersById.get(actor)?.name ?? actor) : null,
        target ? (replayPlayersById.get(target)?.name ?? target) : null,
        damage,
        damageType
      ),
    })
  }

  const kills = timeline.filter(
    (event) =>
      event.type.includes("Kill") &&
      event.actor === playerId &&
      event.target !== playerId
  )
  const replayPlayerIds = Array.from(replayPlayersById.keys())
    .sort((left, right) => {
      if (left === playerId) return -1
      if (right === playerId) return 1
      return (positionCounts.get(right) ?? 0) - (positionCounts.get(left) ?? 0)
    })
    .filter((id) => id === playerId || (positionCounts.get(id) ?? 0) > 0)
    .slice(0, MAX_REPLAY_PLAYERS)
  const replayPlayers = replayPlayerIds
    .map((id) => replayPlayersById.get(id))
    .filter((player): player is ReplayPlayer => Boolean(player))
  const replay = buildReplay(replayChanges, replayPlayerIds)

  return {
    matchId,
    playerId,
    kills,
    timeline: compactTimeline(
      timeline.filter((event) => event.type !== "LogPlayerPosition"),
      120,
      playerId
    ),
    trajectory: downsampleTrajectory(trajectory, 240),
    flightPath: downsample(buildFlightPath(flightPathBuckets), 96),
    carePackages,
    replayPlayers,
    replayFrames: replay.frames,
    replayDurationSeconds: replay.durationSeconds,
  }
}

type ReplayChange = {
  elapsedSeconds: number
  framePriority?: "critical" | "supporting"
  playerId?: string
  location?: { x: number; y: number; z?: number } | null
  status?: ReplayPlayerStatus
  health?: number
  healthDelta?: number
  vehicleType?: string | null
  killsDelta?: number
  damageDelta?: number
  zones?: ReplayZones
  alivePlayers?: number
  aliveTeams?: number
  phase?: number
}

type ReplayState = {
  x?: number
  y?: number
  status: ReplayPlayerStatus
  health?: number
  vehicleType?: string
  kills: number
  damage: number
}

function initialReplayState(): ReplayState {
  return {
    status: "alive",
    health: 100,
    kills: 0,
    damage: 0,
  }
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
  const explicitElapsed = numberValue(event.elapsedTime, Number.NaN)
  if (Number.isFinite(explicitElapsed) && explicitElapsed >= 0) {
    return explicitElapsed
  }
  const gameState = event.gameState
  if (gameState && typeof gameState === "object") {
    const gameStateElapsed = numberValue(
      (gameState as Record<string, unknown>).elapsedTime,
      Number.NaN
    )
    if (Number.isFinite(gameStateElapsed) && gameStateElapsed >= 0) {
      return gameStateElapsed
    }
  }
  const timestamp = timestampOf(event)
  if (timestamp === null || startMs === null) return fallbackIndex / 10
  return Math.max(0, (timestamp - startMs) / 1000)
}

function registerReplayPlayer(
  players: Map<string, ReplayPlayer>,
  id: string,
  name: string,
  teamId?: number
) {
  const existing = players.get(id)
  if (!existing) {
    players.set(id, {
      id,
      name,
      ...(teamId !== undefined ? { teamId } : {}),
    })
    return
  }
  if (existing.teamId === undefined && teamId !== undefined) {
    players.set(id, { ...existing, teamId })
  }
}

function optionalNonNegativeNumber(value: unknown) {
  const number = numberValue(value, Number.NaN)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function optionalInteger(value: unknown) {
  const number =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : numberValue(value, Number.NaN)
  return Number.isInteger(number) && number >= 0 ? number : undefined
}

function vehicleTypeOf(vehicle: Record<string, unknown> | undefined) {
  if (!vehicle) return undefined
  const vehicleType =
    stringValue(vehicle.vehicleType, stringValue(vehicle.vehicleId, "")) ||
    undefined
  if (!vehicleType || /transportaircraft/i.test(vehicleType)) return undefined
  return vehicleType
}

function isTransportAircraft(vehicle: Record<string, unknown> | undefined) {
  if (!vehicle) return false
  const vehicleType = stringValue(
    vehicle.vehicleType,
    stringValue(vehicle.vehicleId, "")
  )
  return /transportaircraft/i.test(vehicleType)
}

function buildFlightPath(
  buckets: Map<number, { x: number; y: number; z: number; count: number }>
) {
  const samples = Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([elapsedSeconds, point]) => ({
      elapsedSeconds,
      point: {
        x: point.x / point.count,
        y: point.y / point.count,
        z: point.z / point.count,
      },
    }))
  if (samples.length < 3) return samples.map(({ point }) => point)

  const distances = samples.slice(1).map(({ point }, index) => {
    const previous = samples[index]!.point
    return Math.hypot(point.x - previous.x, point.y - previous.y)
  })
  const sortedDistances = [...distances].sort((left, right) => left - right)
  const typicalDistance =
    sortedDistances[Math.floor(sortedDistances.length / 2)]!
  const maximumSegmentDistance = Math.max(100_000, typicalDistance * 6)
  const breakIndex = distances.findIndex((distance, index) => {
    const previous = samples[index]!.point
    const current = samples[index + 1]!.point
    return (
      distance > maximumSegmentDistance ||
      Math.abs(current.z - previous.z) > 20_000
    )
  })
  const coherentSamples =
    breakIndex === -1 ? samples : samples.slice(0, breakIndex + 1)
  return coherentSamples.map(({ point }) => point)
}

function replayPhaseOf(event: Record<string, unknown>) {
  const common = event.common
  if (common && typeof common === "object") {
    const commonPhase = optionalNonNegativeNumber(
      (common as Record<string, unknown>).isGame
    )
    if (commonPhase !== undefined) return commonPhase
  }
  const value = event.gameState
  if (value && typeof value === "object") {
    const gameState = value as Record<string, unknown>
    const gameStatePhase = optionalNonNegativeNumber(
      gameState.isGame ?? gameState.phase
    )
    if (gameStatePhase !== undefined) return gameStatePhase
  }
  return optionalNonNegativeNumber(event.phase)
}

function optionalPercentageNumber(value: unknown) {
  const number = numberValue(value, Number.NaN)
  return Number.isFinite(number) && number >= 0 && number <= 100
    ? number
    : undefined
}

function parseReplaySnapshot(event: Record<string, unknown>) {
  const value = event.gameState
  if (!value || typeof value !== "object") return null
  const gameState = value as Record<string, unknown>
  const zones = parseReplayZones(event)
  const alivePlayers = optionalNonNegativeNumber(gameState.numAlivePlayers)
  const aliveTeams = optionalNonNegativeNumber(gameState.numAliveTeams)
  if (!zones && alivePlayers === undefined && aliveTeams === undefined) {
    return null
  }
  return { zones: zones ?? undefined, alivePlayers, aliveTeams }
}

function parseReplayZones(event: Record<string, unknown>): ReplayZones | null {
  const value = event.gameState
  if (!value || typeof value !== "object") return null
  const gameState = value as Record<string, unknown>
  const safetyRadius = numberValue(gameState.safetyZoneRadius, Number.NaN)
  const warningRadius = numberValue(
    gameState.poisonGasWarningRadius,
    Number.NaN
  )
  // PUBG telemetry names the current outer blue zone as safetyZone and the
  // next playable white zone as poisonGasWarning. Keep the normalized names
  // aligned with the official client and map legend.
  const bluezone = replayZoneOf(gameState.safetyZonePosition, safetyRadius)
  const safezone = replayZoneOf(
    gameState.poisonGasWarningPosition,
    normalizeWarningRadius(safetyRadius, warningRadius)
  )
  const redzone = replayZoneOf(
    gameState.redZonePosition,
    gameState.redZoneRadius
  )
  const blackzone = replayZoneOf(
    gameState.blackZonePosition,
    gameState.blackZoneRadius
  )
  if (!bluezone && !safezone && !redzone && !blackzone) return null
  return { bluezone, safezone, redzone, blackzone }
}

function normalizeWarningRadius(safetyRadius: number, warningRadius: number) {
  if (
    Number.isFinite(safetyRadius) &&
    Number.isFinite(warningRadius) &&
    warningRadius > 0 &&
    safetyRadius / warningRadius >= 100
  ) {
    return warningRadius * 1000
  }
  return warningRadius
}

function replayZoneOf(position: unknown, radius: unknown) {
  const location = locationOf(position)
  const size = numberValue(radius, Number.NaN)
  if (!location || !Number.isFinite(size) || size <= 0) return null
  return { x: location.x, y: location.y, radius: size }
}

function sampleFrameTimes(values: number[], count: number) {
  if (values.length <= count) return values
  return Array.from({ length: count }, (_, index) => {
    const position = Math.round((index * (values.length - 1)) / (count - 1))
    return values[position]!
  })
}

function selectFrameTimes(
  regularTimes: number[],
  criticalTimes: number[],
  supportingTimes: number[],
  count: number
) {
  const allTimes = Array.from(
    new Set([...regularTimes, ...criticalTimes, ...supportingTimes])
  ).sort((left, right) => left - right)
  if (allTimes.length <= count) return allTimes

  const selected = new Set<number>()
  const firstTime = allTimes[0]
  const lastTime = allTimes.at(-1)
  if (firstTime !== undefined) selected.add(firstTime)
  if (lastTime !== undefined) selected.add(lastTime)

  const add = (times: number[], budget: number) => {
    if (budget <= 0) return
    for (const time of sampleFrameTimes(times, budget)) {
      selected.add(time)
    }
  }

  const availableAfterBounds = Math.max(0, count - selected.size)
  if (criticalTimes.length > availableAfterBounds) {
    add(criticalTimes, availableAfterBounds)
  } else {
    add(criticalTimes, criticalTimes.length)
    const remainingAfterCritical = Math.max(0, count - selected.size)
    add(supportingTimes, remainingAfterCritical)
    const remainingAfterSupporting = Math.max(0, count - selected.size)
    add(regularTimes, remainingAfterSupporting)
  }

  if (selected.size < count) {
    add(
      allTimes.filter((time) => !selected.has(time)),
      count - selected.size
    )
  }

  return Array.from(selected).sort((left, right) => left - right)
}

function buildReplay(changes: ReplayChange[], playerIds: string[]) {
  if (changes.length === 0) {
    return { frames: [] as ReplayFrame[], durationSeconds: 0 }
  }

  const sortedChanges = changes
    .filter((change) => !change.playerId || playerIds.includes(change.playerId))
    .sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
  const durationSeconds = Math.max(0, sortedChanges.at(-1)?.elapsedSeconds ?? 0)
  const maxFrameCount = Math.min(
    MAX_REPLAY_FRAME_COUNT,
    Math.max(
      180,
      Math.floor(MAX_REPLAY_PLAYER_FRAMES / Math.max(playerIds.length, 1))
    )
  )
  const stepSeconds = Math.max(1, Math.ceil(durationSeconds / maxFrameCount))
  const criticalFrameTimes = Array.from(
    new Set(
      sortedChanges
        .filter((change) => change.framePriority === "critical")
        .map((change) => change.elapsedSeconds)
    )
  ).sort((left, right) => left - right)
  const supportingFrameTimes = Array.from(
    new Set(
      sortedChanges
        .filter((change) => change.framePriority === "supporting")
        .map((change) => change.elapsedSeconds)
    )
  ).sort((left, right) => left - right)
  const regularFrameTimes = new Set<number>()
  for (
    let elapsedSeconds = 0;
    elapsedSeconds <= durationSeconds;
    elapsedSeconds += stepSeconds
  ) {
    regularFrameTimes.add(elapsedSeconds)
  }
  regularFrameTimes.add(durationSeconds)
  const frameTimes = selectFrameTimes(
    Array.from(regularFrameTimes),
    criticalFrameTimes,
    supportingFrameTimes,
    maxFrameCount
  )
  const exactFrameTimes = new Set([
    ...criticalFrameTimes,
    ...supportingFrameTimes,
  ])
  const playerIndexById = new Map(playerIds.map((id, index) => [id, index]))
  const states = new Map<string, ReplayState>()
  const frames: ReplayFrame[] = []
  let zones: ReplayZones | undefined
  let alivePlayers: number | undefined
  let aliveTeams: number | undefined
  let phase: number | undefined
  let changeIndex = 0

  for (const elapsedSeconds of frameTimes) {
    while (
      changeIndex < sortedChanges.length &&
      sortedChanges[changeIndex]!.elapsedSeconds <= elapsedSeconds
    ) {
      const change = sortedChanges[changeIndex]!
      if (change.zones) zones = change.zones
      if (change.alivePlayers !== undefined) alivePlayers = change.alivePlayers
      if (change.aliveTeams !== undefined) aliveTeams = change.aliveTeams
      if (
        change.phase !== undefined &&
        (phase === undefined || change.phase >= phase)
      ) {
        phase = change.phase
      }
      if (change.playerId) {
        const previous = states.get(change.playerId)
        const base = previous ?? initialReplayState()
        if (change.location) {
          states.set(change.playerId, {
            ...base,
            x: Math.round(change.location.x),
            y: Math.round(change.location.y),
            status: change.status ?? base.status,
            health: change.health ?? base.health,
            ...(change.vehicleType !== undefined
              ? { vehicleType: change.vehicleType ?? undefined }
              : previous?.vehicleType
                ? { vehicleType: previous.vehicleType }
                : {}),
          })
        } else if (
          change.status !== undefined ||
          change.health !== undefined ||
          change.healthDelta !== undefined ||
          change.vehicleType !== undefined ||
          change.killsDelta !== undefined ||
          change.damageDelta !== undefined
        ) {
          states.set(change.playerId, {
            ...base,
            ...(change.status ? { status: change.status } : {}),
            ...(change.health !== undefined
              ? { health: change.health }
              : change.healthDelta !== undefined
                ? {
                    health: Math.min(
                      100,
                      Math.max(0, (base.health ?? 100) + change.healthDelta)
                    ),
                  }
                : {}),
            ...(change.killsDelta !== undefined
              ? { kills: base.kills + change.killsDelta }
              : {}),
            ...(change.damageDelta !== undefined
              ? { damage: base.damage + change.damageDelta }
              : {}),
            ...(change.vehicleType !== undefined
              ? change.vehicleType === null
                ? { vehicleType: undefined }
                : { vehicleType: change.vehicleType }
              : {}),
          })
        }
      }
      changeIndex += 1
    }

    const framePlayers = Array.from(states.entries())
      .map(([id, state]) => {
        const playerIndex = playerIndexById.get(id)
        if (
          playerIndex === undefined ||
          state.x === undefined ||
          state.y === undefined
        ) {
          return null
        }
        const player: ReplayFramePlayer = [
          playerIndex,
          state.x,
          state.y,
          state.status,
        ]
        if (state.health !== undefined) player[4] = state.health
        if (state.kills > 0) player[5] = state.kills
        if (state.damage > 0) {
          player[6] = Math.round(state.damage * 10) / 10
        }
        return player
      })
      .filter((player): player is ReplayFrame["players"][number] =>
        Boolean(player)
      )
    const frameVehicles: ReplayFrameVehicle[] = Array.from(states.entries())
      .map(([id, state]) => {
        const playerIndex = playerIndexById.get(id)
        if (playerIndex === undefined || !state.vehicleType) return null
        return { playerIndex, vehicleType: state.vehicleType }
      })
      .filter((vehicle): vehicle is ReplayFrameVehicle => Boolean(vehicle))
    if (
      framePlayers.length ||
      frameVehicles.length ||
      zones ||
      alivePlayers !== undefined ||
      aliveTeams !== undefined ||
      phase !== undefined
    ) {
      const frame: ReplayFrame = {
        elapsedSeconds: exactFrameTimes.has(elapsedSeconds)
          ? elapsedSeconds
          : Math.round(elapsedSeconds * 10) / 10,
        players: framePlayers,
      }
      if (frameVehicles.length) frame.vehicles = frameVehicles
      if (zones) frame.zones = zones
      if (alivePlayers !== undefined) frame.alivePlayers = alivePlayers
      if (aliveTeams !== undefined) frame.aliveTeams = aliveTeams
      if (phase !== undefined) frame.phase = phase
      frames.push(frame)
    }
  }

  return { frames, durationSeconds }
}

function timelineMessage(
  type: string,
  actor: string | null,
  target: string | null,
  damage?: number,
  damageType?: string
) {
  if (type.includes("Kill")) {
    if (actor && target && actor === target) return `${target} 被淘汰`
    return `${actor ?? "玩家"} 淘汰了 ${target ?? "对手"}`
  }
  if (type.includes("Damage")) {
    if (damageType === "Damage_DBNO" && target) {
      return `${target} 处于倒地状态`
    }
    if (damage === undefined) {
      return target && !actor
        ? `${target} 受到了一次伤害`
        : `${actor ?? "玩家"} 造成了一次伤害`
    }
    if (!actor && target) {
      return damage === 0
        ? `${target} 未受到有效伤害`
        : `${target} 受到 ${formatDamage(damage)} 点伤害`
    }
    if (actor && target && actor === target) {
      return damage === 0
        ? `${target} 未受到有效伤害`
        : `${target} 受到 ${formatDamage(damage)} 点伤害`
    }
    if (damage === 0) {
      return `${actor ?? "玩家"} 对 ${target ?? "目标"} 未造成有效伤害`
    }
    return `${actor ?? "玩家"} 对 ${target ?? "目标"} 造成 ${formatDamage(damage)} 点伤害`
  }
  if (type === "LogPlayerAttack") return `${actor ?? "玩家"} 开火`
  if (type === "LogPlayerUseThrowable") return `${actor ?? "玩家"} 使用投掷物`
  if (/groggy|knock/i.test(type)) return `${target ?? actor ?? "玩家"} 被击倒`
  if (/revive|rescue/i.test(type)) return `${target ?? actor ?? "玩家"} 被救起`
  if (type.includes("Death")) return `${target ?? actor ?? "玩家"} 被淘汰`
  if (type.includes("CarePackage")) {
    return type.includes("Land") ? "补给箱已落地" : "补给箱已生成"
  }
  if (type.includes("VehicleRide")) return `${actor ?? "玩家"} 进入载具`
  if (type.includes("VehicleLeave")) return `${actor ?? "玩家"} 离开载具`
  if (type === "LogVehicleDamage") return `${actor ?? "载具"} 受到伤害`
  if (type === "LogPlayerLogin") return "玩家加入比赛"
  if (type === "LogPlayerCreate") return "玩家进入战场"
  if (type === "LogParachuteLanding") return `${actor ?? "玩家"} 着陆`
  if (type === "LogPlayerRedeploy") return `${actor ?? "玩家"} 重新部署`
  if (type === "LogVaultStart") return `${actor ?? "玩家"} 翻越障碍物`
  if (type === "LogSwimStart") return `${actor ?? "玩家"} 开始游泳`
  if (/SwimEnd|SwimStop/i.test(type)) return `${actor ?? "玩家"} 离开水面`
  return type
}

function formatDamage(damage: number) {
  return String(Math.round(damage * 10) / 10)
}

function compactTimeline(
  events: TelemetryEvent[],
  max: number,
  focusPlayerId?: string
) {
  if (events.length <= max) return events

  const critical = events.filter((event) =>
    /Kill|Death|Groggy|Knock|Revive|Rescue/.test(event.type)
  )
  const carePackages = events.filter((event) =>
    event.type.includes("CarePackage")
  )
  const movementEvents = events.filter((event) =>
    /ParachuteLanding|Redeploy|Vault|Swim/i.test(event.type)
  )
  const focusedCombat = events.filter(
    (event) =>
      (event.type.includes("Damage") || REPLAY_ATTACK_EVENT_TYPES.has(event.type)) &&
      focusPlayerId !== undefined &&
      (event.actor === focusPlayerId || event.target === focusPlayerId)
  )
  const selected: TelemetryEvent[] = []
  const selectedSet = new Set<TelemetryEvent>()
  const add = (items: TelemetryEvent[], budget: number) => {
    for (const event of downsample(items, budget)) {
      if (selectedSet.has(event)) continue
      selectedSet.add(event)
      selected.push(event)
      if (selected.length >= max) return
    }
  }

  add(focusedCombat, Math.min(32, max))
  add(critical, Math.min(60, Math.max(0, max - selected.length)))
  add(carePackages, Math.min(8, Math.max(0, max - selected.length)))
  add(movementEvents, Math.min(20, Math.max(0, max - selected.length)))
  add(
    events.filter((event) => !selectedSet.has(event)),
    Math.max(0, max - selected.length)
  )

  return selected.sort((left, right) => {
    if (left.elapsedSeconds === undefined) return 1
    if (right.elapsedSeconds === undefined) return -1
    return left.elapsedSeconds - right.elapsedSeconds
  })
}

function downsample<T>(items: T[], max: number): T[] {
  if (max <= 0) return []
  if (items.length <= max) return items
  if (max === 1) return [items[Math.floor(items.length / 2)]!]
  const step = (items.length - 1) / (max - 1)
  return Array.from(
    { length: max },
    (_, index) => items[Math.round(index * step)]
  )
}

function downsampleTrajectory(
  points: ReplayTrajectoryPoint[],
  max: number
): ReplayTrajectoryPoint[] {
  if (max <= 0) return []
  const ordered = [...points].sort(
    (left, right) =>
      (left.elapsedSeconds ?? Number.POSITIVE_INFINITY) -
      (right.elapsedSeconds ?? Number.POSITIVE_INFINITY)
  )
  if (ordered.length <= max) return ordered

  const critical = ordered.filter(
    (point, index) =>
      index === 0 || index === ordered.length - 1 || isAirborneLocation(point)
  )
  if (critical.length >= max) return downsample(critical, max)

  const criticalSet = new Set(critical)
  const regular = ordered.filter((point) => !criticalSet.has(point))
  return [...critical, ...downsample(regular, max - critical.length)].sort(
    (left, right) =>
      (left.elapsedSeconds ?? Number.POSITIVE_INFINITY) -
      (right.elapsedSeconds ?? Number.POSITIVE_INFINITY)
  )
}
