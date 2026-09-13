"use client"

import * as React from "react"
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CrosshairIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkullIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ReplayMap as ReplayMapV2,
  type ReplayMapLayer,
  type ReplayTimelineLayer,
} from "@/components/pubg/replay-map"
import { StatCard } from "@/components/pubg/stat-card"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  MatchAnalysis,
  MatchSummary,
  ReplayFrame,
  ReplayFramePlayer,
  ReplayPlayerStatus,
  ReplayZone,
  ReplayZones,
  TelemetryItem,
} from "@/lib/pubg/types"

const SPEEDS = [0.5, 1, 2, 4] as const

const statusLabels: Record<ReplayPlayerStatus, string> = {
  alive: "存活",
  knocked: "倒地",
  dead: "淘汰",
}

const statusColors: Record<ReplayPlayerStatus, string> = {
  alive: "var(--chart-2)",
  knocked: "var(--chart-3)",
  dead: "var(--muted-foreground)",
}

function teamMarkerColor(teamId: number | undefined) {
  if (teamId === undefined) return "var(--muted-foreground)"
  const hue = (((teamId * 137.508) % 360) + 360) % 360
  return `hsl(${hue.toFixed(1)} 78% 52%)`
}

function healthPercentage(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.min(100, Math.max(0, value))
}

const eventTypeLabels: Record<string, string> = {
  LogPlayerAttack: "开火",
  LogPlayerCreate: "玩家创建",
  LogPlayerDeath: "死亡",
  LogPlayerKill: "淘汰",
  LogPlayerKillV2: "淘汰",
  LogPlayerLogin: "玩家加入",
  LogPlayerMakeGroggy: "击倒",
  LogPlayerRedeploy: "重新部署",
  LogPlayerRevive: "救起",
  LogPlayerTakeDamage: "伤害",
  LogPlayerUseThrowable: "投掷物",
  LogCarePackageLand: "补给箱落地",
  LogCarePackageSpawn: "补给箱生成",
  LogParachuteLanding: "着陆",
  LogSwimEnd: "离开水面",
  LogSwimStart: "开始游泳",
  LogVaultStart: "翻越",
  LogVehicleLeave: "离开载具",
  LogVehicleRide: "乘上载具",
}

const damageTypeLabels: Record<string, string> = {
  Damage_BlueZone: "蓝区",
  Damage_BlueZoneGrenade: "蓝区手雷",
  Damage_DBNO: "倒地状态",
  Damage_Explosion_Grenade: "爆炸物",
  Damage_Gun: "枪械",
  Damage_InstantFall: "坠落",
  Damage_Melee: "近战",
  Damage_VehicleCrash: "载具碰撞",
}

function formatEventType(type: string) {
  return eventTypeLabels[type] ?? type.replace(/^LogPlayer/, "玩家")
}

function formatDamageType(type: string) {
  return damageTypeLabels[type] ?? type.replace(/^Damage_/, "")
}

function formatTimelineEventType(event: MatchAnalysis["timeline"][number]) {
  if (event.type === "LogPlayerAttack") return "开火"
  if (event.type === "LogPlayerUseThrowable") return "投掷物"
  if (event.type.includes("Damage") && event.damageType) {
    return formatDamageType(event.damageType)
  }
  return formatEventType(event.type)
}

function formatTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`
}

function formatEventTimestamp(timestamp: string | null) {
  if (!timestamp) return "未知时间"
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("zh-CN")
    : timestamp
}

function formatEventLocation(
  location: { x: number; y: number; z?: number } | null
) {
  if (!location) return "无位置数据"
  const coordinates = [location.x, location.y]
  if (location.z !== undefined) coordinates.push(location.z)
  return coordinates.map((value) => Math.round(value)).join(", ")
}

function formatItemId(itemId: string) {
  return itemId
    .replace(/^Item_/, "")
    .replace(/_C$/, "")
    .replaceAll("_", " ")
}

function formatItems(items: TelemetryItem[]) {
  return items
    .map(
      (item) =>
        `${formatItemId(item.itemId)}${item.stackCount && item.stackCount > 1 ? ` ×${item.stackCount}` : ""}`
    )
    .join(" · ")
}

function formatDamage(damage: number) {
  return String(Math.round(damage * 10) / 10)
}

function formatPhase(phase: number) {
  return String(Math.round(phase * 10) / 10)
}

function interpolateZone(
  left: ReplayZone | null | undefined,
  right: ReplayZone | null | undefined,
  progress: number
) {
  if (!left && !right) return null
  if (!left) return right ?? null
  if (!right) return left
  return {
    x: left.x + (right.x - left.x) * progress,
    y: left.y + (right.y - left.y) * progress,
    radius: left.radius + (right.radius - left.radius) * progress,
  }
}

function interpolateZones(
  left: ReplayZones | undefined,
  right: ReplayZones | undefined,
  progress: number
): ReplayZones | undefined {
  if (!left && !right) return undefined
  if (!left) return progress >= 1 ? right : undefined
  if (!right) return left
  const leftZones = left
  const rightZones = right
  return {
    bluezone: interpolateZone(
      leftZones.bluezone,
      rightZones.bluezone,
      progress
    ),
    safezone: interpolateZone(
      leftZones.safezone,
      rightZones.safezone,
      progress
    ),
    redzone: interpolateZone(leftZones.redzone, rightZones.redzone, progress),
    blackzone: interpolateZone(
      leftZones.blackzone,
      rightZones.blackzone,
      progress
    ),
  }
}

function isReplayZoneActive(frame: ReplayFrame) {
  return frame.phase === undefined || frame.phase >= 1
}

function frameAtTime(frame: ReplayFrame, elapsedSeconds: number) {
  if (frame.elapsedSeconds === elapsedSeconds) return frame
  return { ...frame, elapsedSeconds }
}

export function interpolateFrame(frames: ReplayFrame[], elapsedSeconds: number) {
  if (frames.length === 0) return null
  if (elapsedSeconds < frames[0]!.elapsedSeconds) {
    return null
  }
  if (elapsedSeconds === frames[0]!.elapsedSeconds) {
    return frameAtTime(frames[0]!, elapsedSeconds)
  }
  if (elapsedSeconds >= frames.at(-1)!.elapsedSeconds) {
    return frameAtTime(frames.at(-1)!, elapsedSeconds)
  }

  let rightIndex = 1
  while (
    rightIndex < frames.length &&
    frames[rightIndex]!.elapsedSeconds < elapsedSeconds
  ) {
    rightIndex += 1
  }
  const left = frames[rightIndex - 1]!
  const right = frames[rightIndex]!
  const range = Math.max(right.elapsedSeconds - left.elapsedSeconds, 0.001)
  const progress = (elapsedSeconds - left.elapsedSeconds) / range
  const leftStates = currentStates(left)
  const rightStates = currentStates(right)
  const playerIndexes = new Set([...leftStates.keys(), ...rightStates.keys()])
  const players = Array.from(playerIndexes).flatMap((playerIndex) => {
    const leftPlayer = leftStates.get(playerIndex)
    const rightPlayer = rightStates.get(playerIndex)
    const player = rightPlayer ?? leftPlayer
    if (!player) return []
    if (!leftPlayer && rightPlayer && progress < 1) return []
    const rightFrameActive = progress >= 1
    const discretePlayer = rightFrameActive
      ? (rightPlayer ?? leftPlayer)
      : (leftPlayer ?? rightPlayer)
    if (!discretePlayer) return []
    const nextPlayer: ReplayFramePlayer = [
      playerIndex,
      leftPlayer && rightPlayer
        ? leftPlayer[1] + (rightPlayer[1] - leftPlayer[1]) * progress
        : player[1],
      leftPlayer && rightPlayer
        ? leftPlayer[2] + (rightPlayer[2] - leftPlayer[2]) * progress
        : player[2],
      discretePlayer[3],
    ]
    if (leftPlayer?.[4] !== undefined || rightPlayer?.[4] !== undefined) {
      nextPlayer[4] = discretePlayer[4]
    }
    const kills = rightFrameActive
      ? (rightPlayer?.[5] ?? leftPlayer?.[5])
      : (leftPlayer?.[5] ?? rightPlayer?.[5])
    const damage = rightFrameActive
      ? (rightPlayer?.[6] ?? leftPlayer?.[6])
      : (leftPlayer?.[6] ?? rightPlayer?.[6])
    if (kills !== undefined) nextPlayer[5] = kills
    if (damage !== undefined) nextPlayer[6] = damage
    return [nextPlayer]
  })

  const rightFrameActive = progress >= 1
  const alivePlayers = rightFrameActive
    ? (right.alivePlayers ?? left.alivePlayers)
    : (left.alivePlayers ?? right.alivePlayers)
  const aliveTeams = rightFrameActive
    ? (right.aliveTeams ?? left.aliveTeams)
    : (left.aliveTeams ?? right.aliveTeams)
  const phase = rightFrameActive
    ? (right.phase ?? left.phase)
    : (left.phase ?? right.phase)
  const vehicles = rightFrameActive ? right.vehicles : left.vehicles
  const frame: ReplayFrame = {
    elapsedSeconds,
    players,
    zones: interpolateZones(left.zones, right.zones, progress),
  }
  if (vehicles?.length) frame.vehicles = vehicles
  if (alivePlayers !== undefined) frame.alivePlayers = alivePlayers
  if (aliveTeams !== undefined) frame.aliveTeams = aliveTeams
  if (phase !== undefined) frame.phase = phase
  return frame
}

function currentStates(frame: ReplayFrame | null) {
  return new Map(frame?.players.map((player) => [player[0], player]) ?? [])
}

type ReplayLayer = ReplayMapLayer

function replayTimelineKind(
  event: MatchAnalysis["timeline"][number]
): Exclude<ReplayTimelineLayer, "zones"> | null {
  if (isEliminationEvent(event)) {
    return "kills"
  }
  if (event.type.includes("Damage")) return "damage"
  if (event.type.includes("Attack") || event.type === "LogPlayerUseThrowable") {
    return "attacks"
  }
  if (
    /Login|Create|Groggy|Knock|Revive|Rescue|CarePackage|Vehicle|ParachuteLanding|Redeploy|Vault|Swim/i.test(
      event.type
    )
  ) {
    return "state"
  }
  return null
}

function isEliminationEvent(event: MatchAnalysis["timeline"][number]) {
  return event.type.includes("Kill") || event.type.includes("Death")
}

type RosterFilter = "all" | ReplayPlayerStatus | "unknown"

type RosterPlayer = {
  participant: MatchSummary["participants"][number] | undefined
  player: MatchAnalysis["replayPlayers"][number]
}

type RosterTeam = {
  key: string
  teamId: number | undefined
  players: RosterPlayer[]
}

const rosterFilterLabels: Record<RosterFilter, string> = {
  all: "全部",
  alive: "存活",
  knocked: "倒地",
  dead: "淘汰",
  unknown: "未定位",
}

function matchesRosterFilter(
  state: ReplayFramePlayer | undefined,
  filter: RosterFilter
) {
  if (filter === "all") return true
  if (filter === "unknown") return state === undefined
  return state?.[3] === filter
}

function getRosterTeamKey(teamId: number | undefined) {
  return teamId === undefined ? "unknown" : String(teamId)
}

function rosterTeamLabel(teamId: number | undefined) {
  return teamId === undefined ? "未分组" : "队 " + teamId
}

function rosterTeamStateSummary(
  players: RosterPlayer[],
  indexById: Map<string, number>,
  states: Map<number, ReplayFramePlayer>
) {
  const counts = {
    alive: 0,
    knocked: 0,
    dead: 0,
    unknown: 0,
  }
  for (const { player } of players) {
    const playerIndex = indexById.get(player.id)
    const state =
      playerIndex === undefined ? undefined : states.get(playerIndex)
    if (!state) {
      counts.unknown += 1
    } else {
      counts[state[3]] += 1
    }
  }
  const summary = [
    counts.alive ? counts.alive + " 存活" : null,
    counts.knocked ? counts.knocked + " 倒地" : null,
    counts.dead ? counts.dead + " 淘汰" : null,
    counts.unknown ? counts.unknown + " 未定位" : null,
  ].filter(Boolean)
  return summary.length ? summary.join(" · ") : "等待状态"
}

function Roster({
  match,
  analysis,
  currentFrame,
  selectedPlayerId,
  onSelect,
}: {
  match: MatchSummary
  analysis: MatchAnalysis
  currentFrame: ReplayFrame | null
  selectedPlayerId: string
  onSelect: (playerId: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<RosterFilter>("all")
  const states = currentStates(currentFrame)
  const vehicles = new Map(
    currentFrame?.vehicles?.map((vehicle) => [vehicle.playerIndex, vehicle]) ??
      []
  )
  const indexById = new Map(
    analysis.replayPlayers.map((player, index) => [player.id, index])
  )
  const replayPlayersById = new Map(
    analysis.replayPlayers.map((player) => [player.id, player])
  )
  const participantsById = new Map(
    match.participants.map((participant) => [participant.id, participant])
  )
  const visiblePlayers: RosterPlayer[] = [
    ...match.participants.map((participant) => ({
      participant,
      player: {
        ...(replayPlayersById.get(participant.id) ?? {}),
        id: participant.id,
        name: replayPlayersById.get(participant.id)?.name ?? participant.name,
        ...(replayPlayersById.get(participant.id)?.teamId !== undefined
          ? { teamId: replayPlayersById.get(participant.id)?.teamId }
          : participant.teamId !== undefined
            ? { teamId: participant.teamId }
            : {}),
      },
    })),
    ...analysis.replayPlayers
      .filter((player) => !participantsById.has(player.id))
      .map((player) => ({ player, participant: undefined })),
  ].sort((left, right) => {
    if (left.player.id === analysis.playerId) return -1
    if (right.player.id === analysis.playerId) return 1
    return (left.participant?.rank ?? 999) - (right.participant?.rank ?? 999)
  })
  const targetTeamId = visiblePlayers.find(
    ({ player }) => player.id === analysis.playerId
  )?.player.teamId
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredPlayers = visiblePlayers.filter(({ player }) => {
    if (
      normalizedQuery &&
      !player.name.toLocaleLowerCase().includes(normalizedQuery)
    ) {
      return false
    }
    const playerIndex = indexById.get(player.id)
    const state =
      playerIndex === undefined ? undefined : states.get(playerIndex)
    return matchesRosterFilter(state, filter)
  })
  const telemetryOnlyCount = visiblePlayers.filter(
    ({ participant }) => participant === undefined
  ).length
  const rosterTeams = filteredPlayers.reduce<RosterTeam[]>((groups, entry) => {
    const teamId = entry.player.teamId
    const key = getRosterTeamKey(teamId)
    const group = groups.find((candidate) => candidate.key === key)
    if (group) {
      group.players.push(entry)
    } else {
      groups.push({ key, teamId, players: [entry] })
    }
    return groups
  }, [])
  rosterTeams.sort((left, right) => {
    const leftHasTarget = left.players.some(
      ({ player }) => player.id === analysis.playerId
    )
    const rightHasTarget = right.players.some(
      ({ player }) => player.id === analysis.playerId
    )
    if (leftHasTarget !== rightHasTarget) return leftHasTarget ? -1 : 1
    const leftRank = Math.min(
      ...left.players.map(({ participant }) => participant?.rank ?? 999)
    )
    const rightRank = Math.min(
      ...right.players.map(({ participant }) => participant?.rank ?? 999)
    )
    if (leftRank !== rightRank) return leftRank - rightRank
    return (left.teamId ?? 999) - (right.teamId ?? 999)
  })
  const [collapsedTeams, setCollapsedTeams] = React.useState<Set<string>>(
    () => new Set()
  )

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">参赛者</h3>
            <p className="text-xs text-muted-foreground">
              官方摘要 {match.participantCount} 人 · 回放识别{" "}
              {analysis.replayPlayers.length} 人
            </p>
          </div>
          <UsersIcon className="size-4 text-muted-foreground" />
        </div>
        {telemetryOnlyCount ? (
          <p className="text-xs text-muted-foreground">
            含 {telemetryOnlyCount} 名仅在官方遥测中识别的玩家
          </p>
        ) : null}
        {analysis.replayFrames.length ? (
          <p className="text-xs text-muted-foreground">
            成员击杀和伤害按当前回放时间累计；没有位置数据的玩家显示官方最终摘要。
          </p>
        ) : null}
        <Input
          value={query}
          placeholder="搜索玩家名称"
          aria-label="搜索参赛者"
          onChange={(event) => setQuery(event.target.value)}
        />
        <ToggleGroup
          multiple={false}
          value={[filter]}
          onValueChange={(value) => {
            if (value[0]) setFilter(value[0] as RosterFilter)
          }}
          variant="outline"
          size="sm"
          className="max-w-full flex-wrap justify-start"
          aria-label="筛选参赛者状态"
        >
          {Object.entries(rosterFilterLabels).map(([value, label]) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          显示 {filteredPlayers.length} / {visiblePlayers.length} 名玩家 ·{" "}
          {rosterTeams.length} 个战队
        </p>
      </div>
      <div className="max-h-[25rem] overflow-y-auto p-2">
        {rosterTeams.length ? (
          rosterTeams.map((team) => {
            const isCollapsed = collapsedTeams.has(team.key)
            const teamKills = team.players.reduce(
              (total, { player, participant }) => {
                const playerIndex = indexById.get(player.id)
                const state =
                  playerIndex === undefined
                    ? undefined
                    : states.get(playerIndex)
                return (
                  total + (state ? (state[5] ?? 0) : (participant?.kills ?? 0))
                )
              },
              0
            )
            const teamDamage = team.players.reduce(
              (total, { player, participant }) => {
                const playerIndex = indexById.get(player.id)
                const state =
                  playerIndex === undefined
                    ? undefined
                    : states.get(playerIndex)
                return (
                  total + (state ? (state[6] ?? 0) : (participant?.damage ?? 0))
                )
              },
              0
            )
            return (
              <section
                key={team.key}
                className="mb-2 overflow-hidden rounded-lg border last:mb-0"
                data-roster-team={team.key}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 rounded-none px-2 py-2 text-left"
                  aria-expanded={!isCollapsed}
                  aria-label={"切换" + rosterTeamLabel(team.teamId) + "成员"}
                  onClick={() =>
                    setCollapsedTeams((current) => {
                      const next = new Set(current)
                      if (next.has(team.key)) next.delete(team.key)
                      else next.add(team.key)
                      return next
                    })
                  }
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: teamMarkerColor(team.teamId),
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {rosterTeamLabel(team.teamId)}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {team.players.length} 人 ·{" "}
                      {rosterTeamStateSummary(team.players, indexById, states)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span title="战队击杀">K {teamKills}</span>
                    <span title="战队伤害">D {Math.round(teamDamage)}</span>
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 shrink-0 transition-transform",
                      isCollapsed ? "-rotate-90" : ""
                    )}
                  />
                </Button>
                {!isCollapsed ? (
                  <div className="border-t p-1">
                    {team.players.map(({ player, participant }) => {
                      const playerIndex = indexById.get(player.id)
                      const state =
                        playerIndex === undefined
                          ? undefined
                          : states.get(playerIndex)
                      const vehicle =
                        playerIndex === undefined
                          ? undefined
                          : vehicles.get(playerIndex)
                      const isTarget = player.id === analysis.playerId
                      const isSelected = player.id === selectedPlayerId
                      const isTelemetryOnly = participant === undefined
                      const health = healthPercentage(state?.[4])
                      const currentKills = state
                        ? (state[5] ?? 0)
                        : participant?.kills
                      const currentDamage = state
                        ? (state[6] ?? 0)
                        : participant?.damage
                      return (
                        <Button
                          key={player.id}
                          type="button"
                          variant={isSelected ? "secondary" : "ghost"}
                          className="h-auto w-full justify-start gap-2 rounded-lg px-2 py-2 text-sm"
                          aria-pressed={isSelected}
                          onClick={() => onSelect(player.id)}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: state
                                ? player.teamId === undefined
                                  ? statusColors[state[3]]
                                  : teamMarkerColor(player.teamId)
                                : player.teamId === undefined
                                  ? "var(--muted-foreground)"
                                  : teamMarkerColor(player.teamId),
                            }}
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate font-medium">
                              {player.name}
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {currentKills !== undefined
                                ? currentKills +
                                  " 击杀 · " +
                                  Math.round(currentDamage ?? 0) +
                                  " 伤害"
                                : "仅遥测玩家"}
                              {health !== undefined
                                ? " · " + Math.round(health) + "% 生命"
                                : ""}
                            </span>
                          </span>
                          {isTarget ? (
                            <Badge variant="secondary">目标</Badge>
                          ) : null}
                          {isTelemetryOnly ? (
                            <Badge variant="outline">仅遥测</Badge>
                          ) : null}
                          {player.teamId !== undefined ? (
                            <Badge
                              variant={
                                player.teamId === targetTeamId
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              队 {player.teamId}
                            </Badge>
                          ) : null}
                          {vehicle ? (
                            <Badge
                              variant="outline"
                              title={vehicle.vehicleType}
                            >
                              载具
                            </Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {state
                              ? statusLabels[state[3]]
                              : playerIndex !== undefined
                                ? "等待定位"
                                : participant?.rank
                                  ? `第 ${participant.rank} 名`
                                  : "无位置数据"}
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })
        ) : (
          <Empty className="border-0 px-2 py-8">
            <EmptyHeader>
              <EmptyTitle>
                {visiblePlayers.length
                  ? "没有匹配的参赛者"
                  : "官方接口没有返回参赛者摘要"}
              </EmptyTitle>
              <EmptyDescription>
                {visiblePlayers.length
                  ? "调整搜索关键词或状态筛选后重试。"
                  : "仍可通过地图和事件时间线查看遥测数据。"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  )
}

type TimelineFilter = "all" | "combat" | "state" | "selected"

function getReplayZoneMarkers(frames: ReplayFrame[]) {
  const minimumMarkerGapSeconds = 30
  const markers: ReplayFrame[] = []
  let previousPhaseKey: string | undefined
  let previousMarkerTime = Number.NEGATIVE_INFINITY

  for (const frame of frames) {
    if (!frame.zones) continue
    if (!isReplayZoneActive(frame)) continue
    const phaseKey = frame.phase === undefined ? "unknown" : String(frame.phase)
    if (
      phaseKey === previousPhaseKey ||
      frame.elapsedSeconds - previousMarkerTime < minimumMarkerGapSeconds
    ) {
      continue
    }
    markers.push(frame)
    previousPhaseKey = phaseKey
    previousMarkerTime = frame.elapsedSeconds
  }

  return markers
}

function matchesTimelineFilter(
  event: MatchAnalysis["timeline"][number],
  filter: TimelineFilter,
  selectedPlayerId: string
) {
  if (filter === "all") return true
  if (filter === "selected") {
    return event.actor === selectedPlayerId || event.target === selectedPlayerId
  }
  if (filter === "combat") {
    return /Kill|Damage|Death|Attack|Throwable/.test(event.type)
  }
  return /Login|Create|Groggy|Knock|Revive|Rescue|CarePackage|Vehicle|ParachuteLanding|Redeploy|Vault|Swim/i.test(
    event.type
  )
}

type ReplayNavigationNode =
  { kind: "event"; seconds: number } | { kind: "zone"; seconds: number }

function getReplayNavigationNodes(
  events: MatchAnalysis["timeline"],
  zoneMarkers: ReplayFrame[],
  showZones: boolean
) {
  const nodes: ReplayNavigationNode[] = events.flatMap((event) =>
    event.elapsedSeconds === undefined
      ? []
      : [{ kind: "event" as const, seconds: event.elapsedSeconds }]
  )
  if (showZones) {
    nodes.push(
      ...zoneMarkers.map((frame) => ({
        kind: "zone" as const,
        seconds: frame.elapsedSeconds,
      }))
    )
  }
  return nodes.sort((left, right) => left.seconds - right.seconds)
}

function ReplayTimeline({
  events,
  currentTime,
  onSeek,
  playerNames,
  selectedPlayerId,
  visibleKinds,
  zoneFrames,
}: {
  events: MatchAnalysis["timeline"]
  currentTime: number
  onSeek: (seconds: number) => void
  playerNames: Map<string, string>
  selectedPlayerId: string
  visibleKinds: ReplayTimelineLayer[]
  zoneFrames: ReplayFrame[]
}) {
  const [filter, setFilter] = React.useState<TimelineFilter>("all")
  const [selectedEvent, setSelectedEvent] = React.useState<
    MatchAnalysis["timeline"][number] | null
  >(null)
  const layerEvents = events.filter((event) => {
    const kind = replayTimelineKind(event)
    return kind !== null && visibleKinds.includes(kind)
  })
  const filteredEvents = layerEvents.filter((event) =>
    matchesTimelineFilter(event, filter, selectedPlayerId)
  )
  const zoneMarkers = getReplayZoneMarkers(zoneFrames)
  const activeZoneIndex = zoneMarkers.reduce(
    (result, frame, index) =>
      frame.elapsedSeconds <= currentTime ? index : result,
    -1
  )
  const activeIndex = filteredEvents.reduce(
    (result, event, index) =>
      event.elapsedSeconds !== undefined && event.elapsedSeconds <= currentTime
        ? index
        : result,
    -1
  )
  const activeEventRef = React.useRef<HTMLButtonElement | null>(null)
  React.useEffect(() => {
    activeEventRef.current?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])
  const navigationNodes = getReplayNavigationNodes(
    filteredEvents,
    zoneMarkers,
    visibleKinds.includes("zones")
  )
  const nextNode = navigationNodes.find(
    (node) => node.seconds > currentTime + 0.05
  )
  const previousNode = [...navigationNodes]
    .reverse()
    .find((node) => node.seconds < currentTime - 0.05)

  return (
    <>
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">事件时间线</h3>
            <p className="text-xs text-muted-foreground">
              点击事件跳转到回放位置；密集同类事件会合并标记，完整记录仍保留在下方列表
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              multiple={false}
              value={[filter]}
              onValueChange={(value) => {
                if (value[0]) setFilter(value[0] as TimelineFilter)
              }}
              variant="outline"
              size="sm"
              aria-label="筛选回放事件"
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              <ToggleGroupItem value="combat">战斗</ToggleGroupItem>
              <ToggleGroupItem value="state">状态</ToggleGroupItem>
              <ToggleGroupItem value="selected">当前玩家</ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              variant="outline"
              disabled={!previousNode}
              onClick={() => onSeek(previousNode?.seconds ?? 0)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              上一节点
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!nextNode}
              onClick={() => onSeek(nextNode?.seconds ?? 0)}
            >
              下一节点
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Badge variant="outline">
              {filteredEvents.length === events.length
                ? `可见事件 ${events.length}`
                : `可见事件 ${filteredEvents.length} / ${events.length}`}
              {visibleKinds.includes("zones") && zoneMarkers.length
                ? ` · ${zoneMarkers.length} 个圈层节点`
                : ""}
            </Badge>
          </div>
        </div>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto p-2">
          {filteredEvents.length ? (
            filteredEvents.map((event, index) => {
              const elapsedSeconds = event.elapsedSeconds ?? 0
              return (
                <Button
                  key={`${event.type}-${event.timestamp}-${index}`}
                  ref={index === activeIndex ? activeEventRef : undefined}
                  variant={index === activeIndex ? "secondary" : "ghost"}
                  className="h-auto min-h-12 justify-start gap-3 px-2 py-2 text-left"
                  aria-current={index === activeIndex ? "time" : undefined}
                  onClick={() => {
                    onSeek(elapsedSeconds)
                    setSelectedEvent(event)
                  }}
                >
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                    {formatTime(elapsedSeconds)}
                  </span>
                  <Badge
                    variant={isEliminationEvent(event) ? "default" : "outline"}
                  >
                    {formatTimelineEventType(event)}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {event.message}
                  </span>
                </Button>
              )
            })
          ) : (
            <Empty className="border-0 px-2 py-8">
              <EmptyHeader>
                <EmptyTitle>当前筛选没有匹配事件</EmptyTitle>
                <EmptyDescription>
                  切换筛选条件后可以继续查看其他遥测事件。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
        {visibleKinds.includes("zones") && zoneMarkers.length ? (
          <div>
            <Separator />
            <div className="px-4 py-3">
              <h4 className="text-sm font-semibold">圈层阶段</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                点击阶段跳转到对应时间，地图仅显示圈线。
              </p>
            </div>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto px-2 pb-2 sm:grid-cols-3">
              {zoneMarkers.map((frame, index) => {
                const phaseLabel =
                  frame.phase === undefined
                    ? "圈层开始"
                    : `阶段 ${formatPhase(frame.phase)}`
                const zoneLabel = [
                  frame.zones?.bluezone ? "蓝圈" : null,
                  frame.zones?.safezone ? "白圈" : null,
                  frame.zones?.redzone ? "红区" : null,
                  frame.zones?.blackzone ? "特殊区" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <Button
                    key={`${frame.elapsedSeconds}-${index}`}
                    type="button"
                    variant={index === activeZoneIndex ? "secondary" : "ghost"}
                    className="h-auto min-h-12 justify-start gap-2 px-2 py-2 text-left"
                    aria-current={
                      index === activeZoneIndex ? "time" : undefined
                    }
                    aria-label={`跳转到 ${formatTime(frame.elapsedSeconds)}：${phaseLabel}`}
                    onClick={() => onSeek(frame.elapsedSeconds)}
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                      {formatTime(frame.elapsedSeconds)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {phaseLabel}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {zoneLabel || "圈层数据"}
                      </span>
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
      <Dialog
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedEvent ? (
            <>
              <DialogHeader>
                <DialogTitle>事件详情</DialogTitle>
                <DialogDescription>{selectedEvent.message}</DialogDescription>
              </DialogHeader>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">事件类型</dt>
                  <dd>
                    <Badge
                      variant={
                        isEliminationEvent(selectedEvent)
                          ? "default"
                          : "outline"
                      }
                    >
                      {formatEventType(selectedEvent.type)}
                    </Badge>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">回放时间</dt>
                  <dd className="font-mono text-sm">
                    T+{formatTime(selectedEvent.elapsedSeconds ?? 0)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">发生时间</dt>
                  <dd className="text-sm">
                    {formatEventTimestamp(selectedEvent.timestamp)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">
                    {selectedEvent.type.includes("Damage")
                      ? "来源坐标"
                      : "位置坐标"}
                  </dt>
                  <dd className="font-mono text-sm">
                    {formatEventLocation(selectedEvent.location)}
                  </dd>
                </div>
                {selectedEvent.targetLocation ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">
                      {selectedEvent.type.includes("Damage")
                        ? "受击坐标"
                        : "目标坐标"}
                    </dt>
                    <dd className="font-mono text-sm">
                      {formatEventLocation(selectedEvent.targetLocation)}
                    </dd>
                  </div>
                ) : null}
                {selectedEvent.damage !== undefined ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">伤害</dt>
                    <dd className="text-sm">
                      {formatDamage(selectedEvent.damage)} 点
                    </dd>
                  </div>
                ) : null}
                {selectedEvent.damageType ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">伤害类型</dt>
                    <dd className="text-sm">
                      {formatDamageType(selectedEvent.damageType)}
                    </dd>
                  </div>
                ) : null}
                {selectedEvent.items?.length ? (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">补给箱内容</dt>
                    <dd className="text-sm">
                      {formatItems(selectedEvent.items)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">发起玩家</dt>
                  <dd className="truncate text-sm">
                    {selectedEvent.actor
                      ? (playerNames.get(selectedEvent.actor) ??
                        selectedEvent.actor)
                      : "未知玩家"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">目标玩家</dt>
                  <dd className="truncate text-sm">
                    {selectedEvent.target
                      ? (playerNames.get(selectedEvent.target) ??
                        selectedEvent.target)
                      : "无目标玩家"}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReplayHud({
  analysis,
  officialTargetKills,
  participantCount,
  currentFrame,
  currentTime,
}: {
  analysis: MatchAnalysis
  officialTargetKills: number
  participantCount: number
  currentFrame: ReplayFrame | null
  currentTime: number
}) {
  const states = currentStates(currentFrame)
  const stateValues = Array.from(states.values())
  const activePlayers = stateValues.filter((state) => state[3] !== "dead")
  const eliminatedPlayers = stateValues.filter((state) => state[3] === "dead")
  const targetIndex = analysis.replayPlayers.findIndex(
    (player) => player.id === analysis.playerId
  )
  const targetState = targetIndex === -1 ? undefined : states.get(targetIndex)
  const currentAliveTeams = currentFrame?.aliveTeams
  const currentPhase = currentFrame?.phase
  const targetHealth = targetState?.[4]
  const targetVehicle = currentFrame?.vehicles?.find(
    (vehicle) => vehicle.playerIndex === targetIndex
  )
  const hasFullPositionCoverage =
    participantCount === 0 || analysis.replayPlayers.length >= participantCount
  const estimatedAlivePlayers = hasFullPositionCoverage
    ? Math.min(
        activePlayers.length,
        participantCount > 0 ? participantCount : activePlayers.length
      )
    : undefined
  const reliableAlivePlayers =
    currentFrame?.alivePlayers ?? estimatedAlivePlayers
  const currentKills = analysis.kills.filter(
    (event) =>
      event.elapsedSeconds === undefined || event.elapsedSeconds <= currentTime
  ).length
  const displayPhase =
    currentPhase !== undefined && currentPhase >= 1 ? currentPhase : undefined

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="当前存活玩家"
        value={
          reliableAlivePlayers === undefined
            ? "—"
            : String(reliableAlivePlayers)
        }
        detail={
          currentAliveTeams !== undefined
            ? `${currentAliveTeams} 个队伍`
            : currentFrame?.alivePlayers !== undefined
              ? "官方遥测"
              : reliableAlivePlayers !== undefined
                ? "根据位置帧估算"
                : "等待官方存活数据"
        }
        icon={UsersIcon}
      />
      <StatCard
        label="已识别玩家"
        value={String(stateValues.length)}
        detail={`${eliminatedPlayers.length} 名已标记淘汰`}
        icon={SkullIcon}
      />
      <StatCard
        label="目标玩家状态"
        value={targetState ? statusLabels[targetState[3]] : "未知"}
        detail={`${targetHealth !== undefined ? `${Math.round(targetHealth)}% 生命 · ` : ""}${targetVehicle ? "载具移动 · " : ""}${displayPhase !== undefined ? `阶段 ${formatPhase(displayPhase)} · ` : ""}T+${formatTime(currentTime)}`}
        icon={ActivityIcon}
      />
      <StatCard
        label="目标玩家击杀（回放）"
        value={String(currentKills)}
        detail={`${analysis.kills.length} 次遥测事件 · 官方战绩 ${officialTargetKills} 次`}
        icon={CrosshairIcon}
      />
    </div>
  )
}

function ReplayEventMarkers({
  events,
  duration,
  currentTime,
  visibleKinds,
  onSeek,
}: {
  events: MatchAnalysis["timeline"]
  duration: number
  currentTime: number
  visibleKinds: ReplayTimelineLayer[]
  onSeek: (seconds: number) => void
}) {
  const markerLaneOffsets = [-24, 0, 24]
  const minimumMarkerGapSeconds = Math.max(8, duration / 40)
  const laneEndTimes = markerLaneOffsets.map(() => Number.NEGATIVE_INFINITY)
  const groupedMarkers = new Map<
    Exclude<ReplayTimelineLayer, "zones">,
    Array<{
      event: MatchAnalysis["timeline"][number]
      seconds: number
      endSeconds: number
      count: number
    }>
  >()
  const groupingGapSeconds = Math.max(8, duration / 80)
  for (const event of events) {
    const kind = replayTimelineKind(event)
    if (
      event.elapsedSeconds === undefined ||
      kind === null ||
      !visibleKinds.includes(kind)
    ) {
      continue
    }
    const kindMarkers = groupedMarkers.get(kind) ?? []
    const previous = kindMarkers.at(-1)
    if (
      previous &&
      event.elapsedSeconds - previous.endSeconds < groupingGapSeconds
    ) {
      previous.count += 1
      previous.endSeconds = event.elapsedSeconds
    } else {
      kindMarkers.push({
        event,
        seconds: event.elapsedSeconds,
        endSeconds: event.elapsedSeconds,
        count: 1,
      })
    }
    groupedMarkers.set(kind, kindMarkers)
  }
  const markers = Array.from(groupedMarkers.entries())
    .flatMap(([kind, kindMarkers]) =>
      kindMarkers.map((marker) => ({ ...marker, kind }))
    )
    .sort((left, right) => left.seconds - right.seconds)
    .map((marker) => {
      const lane =
        laneEndTimes.findIndex(
          (lastTime) => marker.seconds - lastTime >= minimumMarkerGapSeconds
        ) ?? -1
      const resolvedLane =
        lane >= 0
          ? lane
          : laneEndTimes.reduce(
              (leastBusyLane, lastTime, index) =>
                lastTime < laneEndTimes[leastBusyLane]! ? index : leastBusyLane,
              0
            )
      laneEndTimes[resolvedLane] = marker.endSeconds
      return { ...marker, lane: resolvedLane }
    })
  if (duration <= 0 || markers.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-16">
      {markers.map(
        ({ event, seconds, endSeconds, lane, count, kind }, index) => {
          const position = Math.min(
            100,
            Math.max(0, (seconds / duration) * 100)
          )
          const isActive =
            currentTime >= seconds - 0.5 && currentTime <= endSeconds + 0.5
          return (
            <Button
              key={`${event.type}-${event.timestamp}-${index}`}
              type="button"
              size="icon-xs"
              variant={
                kind === "kills"
                  ? "destructive"
                  : kind === "attacks"
                    ? "secondary"
                    : "outline"
              }
              className={cn(
                "pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                isActive && "ring-2 ring-ring ring-offset-1"
              )}
              style={{
                left: `${position}%`,
                top: `calc(50% + ${markerLaneOffsets[lane]}px)`,
              }}
              aria-current={isActive ? "time" : undefined}
              aria-label={
                count > 1
                  ? `跳转到 ${formatTime(seconds)}：${event.message}，另有 ${count - 1} 个相近事件`
                  : `跳转到 ${formatTime(seconds)}：${event.message}`
              }
              onPointerDown={(pointerEvent) => {
                pointerEvent.preventDefault()
                pointerEvent.stopPropagation()
              }}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onSeek(seconds)
              }}
            >
              {count > 1 ? (
                <span className="rounded-full bg-current px-0.5 text-[9px] leading-3 text-background">
                  {count > 9 ? "9+" : count}
                </span>
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </Button>
          )
        }
      )}
    </div>
  )
}

function ReplayZoneMarkers({
  frames,
  duration,
  currentTime,
  onSeek,
}: {
  frames: ReplayFrame[]
  duration: number
  currentTime: number
  onSeek: (seconds: number) => void
}) {
  const markers = getReplayZoneMarkers(frames)
  const markerLaneOffsets = [-12, 12]
  const minimumMarkerGapSeconds = Math.max(30, duration / 40)
  const laneEndTimes = markerLaneOffsets.map(() => Number.NEGATIVE_INFINITY)
  const positionedMarkers = markers.map((frame) => {
    const lane = laneEndTimes.findIndex(
      (lastTime) => frame.elapsedSeconds - lastTime >= minimumMarkerGapSeconds
    )
    const resolvedLane =
      lane >= 0
        ? lane
        : laneEndTimes.reduce(
            (leastBusyLane, lastTime, index) =>
              lastTime < laneEndTimes[leastBusyLane]! ? index : leastBusyLane,
            0
          )
    laneEndTimes[resolvedLane] = frame.elapsedSeconds
    return { frame, lane: resolvedLane }
  })
  const activeMarkerIndex = markers.reduce(
    (result, frame, index) =>
      frame.elapsedSeconds <= currentTime ? index : result,
    -1
  )
  if (duration <= 0 || markers.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10">
      {positionedMarkers.map(({ frame, lane }, index) => {
        const position = Math.min(
          100,
          Math.max(0, (frame.elapsedSeconds / duration) * 100)
        )
        const phaseLabel =
          frame.phase === undefined
            ? "圈层开始"
            : `圈层阶段 ${formatPhase(frame.phase)}`
        return (
          <Button
            key={`${frame.elapsedSeconds}-${index}`}
            type="button"
            size="icon-xs"
            variant={index === activeMarkerIndex ? "secondary" : "outline"}
            className="pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border-blue-500 bg-background"
            style={{
              left: `${position}%`,
              top: `calc(50% + ${markerLaneOffsets[lane]}px)`,
            }}
            aria-current={index === activeMarkerIndex ? "time" : undefined}
            aria-label={`跳转到 ${formatTime(frame.elapsedSeconds)}：${phaseLabel}`}
            onPointerDown={(pointerEvent) => {
              pointerEvent.preventDefault()
              pointerEvent.stopPropagation()
            }}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              onSeek(frame.elapsedSeconds)
            }}
          >
            <span className="size-1.5 rotate-45 rounded-[1px] bg-blue-500" />
          </Button>
        )
      })}
    </div>
  )
}

export function MatchReplay({
  match,
  analysis,
}: {
  match: MatchSummary
  analysis: MatchAnalysis
}) {
  const timelineDuration = analysis.timeline.reduce(
    (latest, event) => Math.max(latest, event.elapsedSeconds ?? 0),
    0
  )
  const playerNames = React.useMemo(() => {
    const names = new Map(
      match.participants.map((participant) => [
        participant.id,
        participant.name,
      ])
    )
    for (const player of analysis.replayPlayers) {
      if (!names.has(player.id)) names.set(player.id, player.name)
    }
    return names
  }, [analysis.replayPlayers, match.participants])
  const duration = Math.max(
    match.durationSeconds,
    analysis.replayDurationSeconds,
    analysis.replayFrames.at(-1)?.elapsedSeconds ?? 0,
    timelineDuration
  )
  const hasReplayFrames = analysis.replayFrames.length > 0
  const hasStaticTrajectory = analysis.trajectory.length > 0
  const hasTimelineData =
    analysis.timeline.length > 0 ||
    analysis.replayFrames.some(
      (frame) => isReplayZoneActive(frame) && Boolean(frame.zones)
    )
  const targetTeamId = analysis.replayPlayers.find(
    (player) => player.id === analysis.playerId
  )?.teamId
  const timelineLayerCounts = React.useMemo(() => {
    const counts: Record<ReplayTimelineLayer, number> = {
      kills: 0,
      damage: 0,
      attacks: 0,
      state: 0,
      zones: getReplayZoneMarkers(analysis.replayFrames).length,
    }
    for (const event of analysis.timeline) {
      const kind = replayTimelineKind(event)
      if (kind) counts[kind] += 1
    }
    return counts
  }, [analysis.replayFrames, analysis.timeline])
  const [currentTime, setCurrentTime] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState<number>(1)
  const [visibleLayers, setVisibleLayers] = React.useState<ReplayLayer[]>([
    "flightPath",
    "trajectory",
    "zones",
    "events",
  ])
  const [visibleTimelineLayers, setVisibleTimelineLayers] = React.useState<
    ReplayTimelineLayer[]
  >(["kills", "zones"])
  const [selectedPlayerId, setSelectedPlayerId] = React.useState(
    analysis.playerId
  )
  const [selectedMapEvent, setSelectedMapEvent] = React.useState<
    MatchAnalysis["timeline"][number] | null
  >(null)
  const currentTimeRef = React.useRef(0)

  React.useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  React.useEffect(() => {
    if (!playing || duration <= 0) return
    let animationFrame = 0
    let previousTime = performance.now()

    const tick = (now: number) => {
      const elapsed = ((now - previousTime) / 1000) * speed
      previousTime = now
      const nextTime = Math.min(duration, currentTimeRef.current + elapsed)
      currentTimeRef.current = nextTime
      setCurrentTime(nextTime)
      if (nextTime >= duration) {
        setPlaying(false)
        return
      }
      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [duration, playing, speed])

  const currentFrame = React.useMemo(
    () => interpolateFrame(analysis.replayFrames, currentTime),
    [analysis.replayFrames, currentTime]
  )

  const setTime = React.useCallback(
    (value: number) => {
      const nextTime = Math.min(Math.max(value, 0), duration)
      currentTimeRef.current = nextTime
      setCurrentTime(nextTime)
    },
    [duration]
  )

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName)
      ) {
        return
      }
      if (event.code === "Space") {
        event.preventDefault()
        if (currentTime >= duration) setTime(0)
        setPlaying((value) => !value)
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        setPlaying(false)
        setTime(currentTime - 5)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        setPlaying(false)
        setTime(currentTime + 5)
      } else if (event.key === "Home") {
        event.preventDefault()
        setPlaying(false)
        setTime(0)
      } else if (event.key === "End") {
        event.preventDefault()
        setPlaying(false)
        setTime(duration)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentTime, duration, setTime])

  return (
    <Card id="replay">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>比赛回放</CardTitle>
            <CardDescription>
              按时间查看目标玩家移动轨迹、击杀标记和遥测中可识别的参赛者。
            </CardDescription>
          </div>
          <Badge variant="outline">
            {analysis.replayFrames.length
              ? `${analysis.replayFrames.length} 个压缩时间帧`
              : "暂无时间帧"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasReplayFrames || hasStaticTrajectory ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <ReplayMapV2
                mapName={match.mapName}
                analysis={analysis}
                currentFrame={currentFrame}
                currentTime={currentTime}
                selectedPlayerId={selectedPlayerId}
                visibleTimelineLayers={visibleTimelineLayers}
                visibleLayers={visibleLayers}
                onVisibleLayersChange={setVisibleLayers}
                onPlayerSelect={setSelectedPlayerId}
                onEventSelect={(event) => {
                  setPlaying(false)
                  setTime(event.elapsedSeconds ?? 0)
                  setSelectedMapEvent(event)
                }}
              />
              {analysis.replayPlayers.length ? (
                <Roster
                  match={match}
                  analysis={analysis}
                  currentFrame={currentFrame}
                  selectedPlayerId={selectedPlayerId}
                  onSelect={setSelectedPlayerId}
                />
              ) : null}
            </div>
            {hasReplayFrames ? (
              <>
                <ReplayHud
                  analysis={analysis}
                  officialTargetKills={match.targetPlayerKills}
                  participantCount={match.participantCount}
                  currentFrame={currentFrame}
                  currentTime={currentTime}
                />
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={playing ? "暂停回放" : "播放回放"}
                          onClick={() => {
                            if (currentTime >= duration) setTime(0)
                            setPlaying((value) => !value)
                          }}
                        >
                          {playing ? <PauseIcon /> : <PlayIcon />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="重新开始"
                          onClick={() => {
                            setPlaying(false)
                            setTime(0)
                          }}
                        >
                          <RotateCcwIcon />
                        </Button>
                        <span className="font-mono text-sm tabular-nums">
                          {formatTime(currentTime)}
                          <span className="text-muted-foreground">
                            {` / ${formatTime(duration)}`}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          播放速度
                        </span>
                        <Select
                          value={String(speed)}
                          onValueChange={(value) => {
                            if (value) setSpeed(Number(value))
                          }}
                        >
                          <SelectTrigger
                            aria-label="选择播放速度"
                            className="h-8 w-20"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {SPEEDS.map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                  {value}x
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        时间轴标记
                      </span>
                      <ToggleGroup
                        multiple
                        value={visibleTimelineLayers}
                        onValueChange={(value) =>
                          setVisibleTimelineLayers(
                            value as ReplayTimelineLayer[]
                          )
                        }
                        variant="outline"
                        size="sm"
                        aria-label="切换时间轴标记"
                      >
                        <ToggleGroupItem value="kills">
                          击杀/淘汰 ({timelineLayerCounts.kills})
                        </ToggleGroupItem>
                        <ToggleGroupItem value="damage">
                          伤害 ({timelineLayerCounts.damage})
                        </ToggleGroupItem>
                        <ToggleGroupItem value="attacks">
                          开火 ({timelineLayerCounts.attacks})
                        </ToggleGroupItem>
                        <ToggleGroupItem value="state">
                          状态/载具 ({timelineLayerCounts.state})
                        </ToggleGroupItem>
                        <ToggleGroupItem value="zones">
                          圈层阶段 ({timelineLayerCounts.zones})
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="relative pt-20 pb-16">
                      <div
                        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/70"
                        style={{
                          left: `${Math.min(100, Math.max(0, (currentTime / Math.max(duration, 1)) * 100))}%`,
                        }}
                        aria-hidden="true"
                      />
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={Math.max(duration, 1)}
                        step={0.1}
                        aria-label="回放时间"
                        onValueChange={(value) =>
                          setTime(
                            typeof value === "number" ? value : (value[0] ?? 0)
                          )
                        }
                      />
                      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                          <span key={ratio}>
                            {formatTime(duration * ratio)}
                          </span>
                        ))}
                      </div>
                      {visibleTimelineLayers.some(
                        (layer) =>
                          layer === "kills" ||
                          layer === "damage" ||
                          layer === "attacks" ||
                          layer === "state"
                      ) ? (
                        <ReplayEventMarkers
                          events={analysis.timeline}
                          duration={duration}
                          currentTime={currentTime}
                          visibleKinds={visibleTimelineLayers}
                          onSeek={(seconds) => {
                            setPlaying(false)
                            setTime(seconds)
                          }}
                        />
                      ) : null}
                      {visibleTimelineLayers.includes("zones") ? (
                        <ReplayZoneMarkers
                          frames={analysis.replayFrames}
                          duration={duration}
                          currentTime={currentTime}
                          onSeek={(seconds) => {
                            setPlaying(false)
                            setTime(seconds)
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor: teamMarkerColor(targetTeamId),
                          }}
                        />{" "}
                        目标队伍
                        {targetTeamId !== undefined
                          ? `（队 ${targetTeamId}）`
                          : ""}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full border border-foreground/60" />{" "}
                        颜色与数字代表战队
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full border-2 border-dashed border-chart-2" />{" "}
                        同队辅助标记
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-destructive" />{" "}
                        击杀事件
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-chart-3" />{" "}
                        伤害位置
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full border border-chart-1" />{" "}
                        开火位置
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-sm bg-chart-4" /> 补给箱
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-sm border border-chart-4" />{" "}
                        载具移动
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rotate-45 rounded-[1px] bg-blue-500" />{" "}
                        圈层阶段
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1.5">
                        <CrosshairIcon className="size-3.5" />
                        位置帧已降采样，仅保留紧凑回放数据
                      </span>
                      <span className="basis-full text-right sm:basis-auto">
                        空格播放/暂停 · ←/→ 前后 5 秒
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed bg-card px-4 py-5 text-sm text-muted-foreground">
                当前遥测只包含目标玩家静态轨迹，暂时无法进行逐帧播放；事件时间线仍可用于定位比赛节点。
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed px-6 py-16 text-center">
            <CrosshairIcon className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">这场比赛没有可播放的位置数据</p>
            <p className="mt-1 text-sm text-muted-foreground">
              仍可查看下方的参赛者摘要和事件时间线。
            </p>
          </div>
        )}
        {hasTimelineData ? (
          <ReplayTimeline
            events={analysis.timeline}
            currentTime={currentTime}
            playerNames={playerNames}
            selectedPlayerId={selectedPlayerId}
            visibleKinds={visibleTimelineLayers}
            zoneFrames={analysis.replayFrames}
            onSeek={(seconds) => {
              setPlaying(false)
              setTime(seconds)
            }}
          />
        ) : null}
        <Dialog
          open={selectedMapEvent !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedMapEvent(null)
          }}
        >
          <DialogContent className="sm:max-w-lg">
            {selectedMapEvent ? (
              <>
                <DialogHeader>
                  <DialogTitle>地图事件</DialogTitle>
                  <DialogDescription>
                    {selectedMapEvent.message}
                  </DialogDescription>
                </DialogHeader>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">事件类型</dt>
                    <dd>
                      <Badge
                        variant={
                          isEliminationEvent(selectedMapEvent)
                            ? "default"
                            : "outline"
                        }
                      >
                        {formatTimelineEventType(selectedMapEvent)}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">回放时间</dt>
                    <dd className="font-mono text-sm">
                      T+{formatTime(selectedMapEvent.elapsedSeconds ?? 0)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">
                      {selectedMapEvent.type.includes("Damage")
                        ? "攻击者位置"
                        : "发生位置"}
                    </dt>
                    <dd className="font-mono text-sm">
                      {formatEventLocation(selectedMapEvent.location)}
                    </dd>
                  </div>
                  {selectedMapEvent.targetLocation ? (
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">
                        {selectedMapEvent.type.includes("Damage")
                          ? "受击位置"
                          : "目标位置"}
                      </dt>
                      <dd className="font-mono text-sm">
                        {formatEventLocation(selectedMapEvent.targetLocation)}
                      </dd>
                    </div>
                  ) : null}
                  {selectedMapEvent.damage !== undefined ? (
                    <div className="flex flex-col gap-1">
                      <dt className="text-xs text-muted-foreground">伤害</dt>
                      <dd className="text-sm">
                        {formatDamage(selectedMapEvent.damage)} 点
                      </dd>
                    </div>
                  ) : null}
                  {selectedMapEvent.items?.length ? (
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">
                        补给箱内容
                      </dt>
                      <dd className="text-sm">
                        {formatItems(selectedMapEvent.items)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">发起玩家</dt>
                    <dd className="truncate text-sm">
                      {selectedMapEvent.actor
                        ? (playerNames.get(selectedMapEvent.actor) ??
                          selectedMapEvent.actor)
                        : "未知玩家"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">目标玩家</dt>
                    <dd className="truncate text-sm">
                      {selectedMapEvent.target
                        ? (playerNames.get(selectedMapEvent.target) ??
                          selectedMapEvent.target)
                        : "无目标玩家"}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  已跳转到该事件；下方事件时间线可查看完整遥测信息。
                </p>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
