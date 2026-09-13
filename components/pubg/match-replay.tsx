"use client"

import * as React from "react"
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CrosshairIcon,
  Maximize2Icon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
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
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { StatCard } from "@/components/pubg/stat-card"
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
} from "@/lib/pubg/types"

const SPEEDS = [0.5, 1, 2, 4] as const

const MAP_SIZES: Record<string, number> = {
  Baltic_Main: 816000,
  Erangel_Main: 816000,
  Desert_Main: 816000,
  Savage_Main: 408000,
  DihorOtok_Main: 816000,
  Summerland_Main: 204000,
  Chimera_Main: 306000,
  Heaven_Main: 102000,
  Tiger_Main: 816000,
  Kiki_Main: 816000,
  Neon_Main: 816000,
}

const MAP_LABELS: Record<string, string> = {
  Baltic_Main: "Erangel",
  Erangel_Main: "Erangel",
  Desert_Main: "Miramar",
  Savage_Main: "Sanhok",
  DihorOtok_Main: "Vikendi",
  Summerland_Main: "Karakin",
  Chimera_Main: "Paramo",
  Heaven_Main: "Haven",
  Tiger_Main: "Taego",
  Kiki_Main: "Deston",
  Neon_Main: "Rondo",
}

const MAP_ASSET_BASE =
  "https://raw.githubusercontent.com/pubgsh/client/master/src/assets"

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

const eventTypeLabels: Record<string, string> = {
  LogPlayerAttack: "开火",
  LogPlayerCreate: "玩家创建",
  LogPlayerDeath: "死亡",
  LogPlayerKill: "淘汰",
  LogPlayerKillV2: "淘汰",
  LogPlayerLogin: "玩家加入",
  LogPlayerMakeGroggy: "击倒",
  LogPlayerRevive: "救起",
  LogPlayerTakeDamage: "伤害",
  LogCarePackageLand: "补给箱落地",
  LogCarePackageSpawn: "补给箱生成",
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

function interpolateFrame(frames: ReplayFrame[], elapsedSeconds: number) {
  if (frames.length === 0) return null
  if (elapsedSeconds <= frames[0]!.elapsedSeconds) return frames[0]!
  if (elapsedSeconds >= frames.at(-1)!.elapsedSeconds) return frames.at(-1)!

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
    const nextPlayer: ReplayFramePlayer = [
      playerIndex,
      leftPlayer && rightPlayer
        ? leftPlayer[1] + (rightPlayer[1] - leftPlayer[1]) * progress
        : player[1],
      leftPlayer && rightPlayer
        ? leftPlayer[2] + (rightPlayer[2] - leftPlayer[2]) * progress
        : player[2],
      progress < 0.5
        ? (leftPlayer?.[3] ?? rightPlayer?.[3] ?? "alive")
        : (rightPlayer?.[3] ?? leftPlayer?.[3] ?? "alive"),
    ]
    if (leftPlayer?.[4] !== undefined || rightPlayer?.[4] !== undefined) {
      nextPlayer[4] =
        leftPlayer?.[4] !== undefined && rightPlayer?.[4] !== undefined
          ? leftPlayer[4] + (rightPlayer[4] - leftPlayer[4]) * progress
          : (leftPlayer?.[4] ?? rightPlayer?.[4])
    }
    return [nextPlayer]
  })

  const alivePlayers = left.alivePlayers ?? right.alivePlayers
  const aliveTeams = left.aliveTeams ?? right.aliveTeams
  const phase = left.phase ?? right.phase
  const vehicles = progress < 0.5 ? left.vehicles : right.vehicles
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

function getBounds(analysis: MatchAnalysis, mapName: string) {
  const mapSize = MAP_SIZES[mapName]
  if (mapSize) {
    return { minX: 0, minY: 0, width: mapSize, height: mapSize }
  }

  const points = [
    ...analysis.trajectory,
    ...analysis.replayFrames.flatMap((frame) =>
      frame.players.map(([, x, y]) => ({ x, y }))
    ),
  ]
  if (points.length === 0) {
    return { minX: 0, minY: 0, width: 1000, height: 1000 }
  }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  const padding = Math.max(maxX - minX, maxY - minY, 1000) * 0.08

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(maxX - minX + padding * 2, 1000),
    height: Math.max(maxY - minY + padding * 2, 1000),
  }
}

function currentStates(frame: ReplayFrame | null) {
  return new Map(frame?.players.map((player) => [player[0], player]) ?? [])
}

type MapPan = { x: number; y: number }

function ReplayMap({
  mapName,
  analysis,
  currentFrame,
  currentTime,
  duration,
  selectedPlayerId,
  mapScale,
  mapPan,
  onPanChange,
  onZoom,
  onReset,
}: {
  mapName: string
  analysis: MatchAnalysis
  currentFrame: ReplayFrame | null
  currentTime: number
  duration: number
  selectedPlayerId: string
  mapScale: number
  mapPan: MapPan
  onPanChange: (pan: MapPan) => void
  onZoom: (delta: number) => void
  onReset: () => void
}) {
  const bounds = React.useMemo(
    () => getBounds(analysis, mapName),
    [analysis, mapName]
  )
  const states = React.useMemo(
    () => currentStates(currentFrame),
    [currentFrame]
  )
  const vehicleIndexes = React.useMemo(
    () =>
      new Map(
        currentFrame?.vehicles?.map((vehicle) => [
          vehicle.playerIndex,
          vehicle,
        ]) ?? []
      ),
    [currentFrame]
  )
  const path = analysis.trajectory
    .map((point) => `${point.x},${point.y}`)
    .join(" ")
  const targetIndex = analysis.replayPlayers.findIndex(
    (player) => player.id === analysis.playerId
  )
  const targetTeamId = analysis.replayPlayers[targetIndex]?.teamId
  const selectedIndex = analysis.replayPlayers.findIndex(
    (player) => player.id === selectedPlayerId
  )
  const visibleTime = currentFrame?.elapsedSeconds ?? duration
  const selectedPlayer = analysis.replayPlayers[selectedIndex]
  const selectedPath = React.useMemo(() => {
    const framePath = analysis.replayFrames.flatMap((frame) => {
      if (frame.elapsedSeconds > visibleTime) return []
      const player = frame.players.find(
        ([playerIndex]) => playerIndex === selectedIndex
      )
      return player ? [`${player[1]},${player[2]}`] : []
    })
    const currentPlayer = currentFrame?.players.find(
      ([playerIndex]) => playerIndex === selectedIndex
    )
    if (currentPlayer) {
      const currentPoint = `${currentPlayer[1]},${currentPlayer[2]}`
      if (framePath.at(-1) !== currentPoint) framePath.push(currentPoint)
    }
    if (framePath.length > 0) return framePath.join(" ")
    return analysis.replayFrames.length === 0 &&
      selectedPlayerId === analysis.playerId
      ? path
      : ""
  }, [
    analysis.playerId,
    analysis.replayFrames,
    currentFrame,
    path,
    selectedIndex,
    selectedPlayerId,
    visibleTime,
  ])
  const visibleKills = analysis.timeline.filter(
    (kill) =>
      kill.type.includes("Kill") &&
      (kill.elapsedSeconds === undefined || kill.elapsedSeconds <= visibleTime)
  )
  const visibleDamage = analysis.timeline.filter(
    (event) =>
      event.type.includes("Damage") &&
      event.location &&
      (event.elapsedSeconds === undefined ||
        event.elapsedSeconds <= visibleTime)
  )
  const visibleAttacks = analysis.timeline.filter(
    (event) =>
      event.type === "LogPlayerAttack" &&
      event.location &&
      (event.elapsedSeconds === undefined ||
        event.elapsedSeconds <= visibleTime)
  )
  const activeDamage = analysis.timeline.filter(
    (event) =>
      event.type.includes("Damage") &&
      event.location &&
      event.targetLocation &&
      event.elapsedSeconds !== undefined &&
      Math.abs(event.elapsedSeconds - currentTime) <= 1
  )
  const visibleCarePackages = analysis.timeline.filter(
    (event) =>
      event.type.includes("CarePackage") &&
      event.location &&
      (event.elapsedSeconds === undefined ||
        event.elapsedSeconds <= visibleTime)
  )
  const mapAssetUrl = MAP_SIZES[mapName]
    ? `${MAP_ASSET_BASE}/${mapName}.jpg`
    : null
  const panRef = React.useRef<{
    startX: number
    startY: number
    pan: MapPan
  } | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      pan: mapPan,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return
    onPanChange({
      x: panRef.current.pan.x + event.clientX - panRef.current.startX,
      y: panRef.current.pan.y + event.clientY - panRef.current.startY,
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    panRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/30">
      <div
        className="absolute inset-0 touch-none select-none"
        style={{
          transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapScale})`,
          transformOrigin: "center",
          cursor: dragging ? "grabbing" : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {mapAssetUrl ? (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-70"
            style={{ backgroundImage: `url(${mapAssetUrl})` }}
            aria-hidden="true"
          />
        ) : null}
        <svg
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          className="pointer-events-none absolute inset-0 size-full"
          role="img"
          aria-label="比赛回放地图"
        >
          <defs>
            <pattern
              id="replay-grid"
              width={bounds.width / 12}
              height={bounds.height / 12}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${bounds.width / 12} 0 L 0 0 0 ${bounds.height / 12}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth={Math.max(bounds.width / 816000, 1)}
              />
            </pattern>
          </defs>
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.width}
            height={bounds.height}
            fill="url(#replay-grid)"
          />
          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.width}
            height={bounds.height}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth={Math.max(bounds.width / 816000, 1)}
          />
          {currentFrame?.zones?.redzone ? (
            <circle
              cx={currentFrame.zones.redzone.x}
              cy={currentFrame.zones.redzone.y}
              r={currentFrame.zones.redzone.radius}
              fill="var(--destructive)"
              fillOpacity="0.08"
              stroke="var(--destructive)"
              strokeOpacity="0.65"
              strokeWidth={Math.max(bounds.width / 300000, 2)}
              strokeDasharray={`${Math.max(bounds.width / 100000, 6)} ${Math.max(bounds.width / 70000, 8)}`}
            />
          ) : null}
          {currentFrame?.zones?.blackzone ? (
            <circle
              cx={currentFrame.zones.blackzone.x}
              cy={currentFrame.zones.blackzone.y}
              r={currentFrame.zones.blackzone.radius}
              fill="var(--foreground)"
              fillOpacity="0.08"
              stroke="var(--foreground)"
              strokeOpacity="0.55"
              strokeWidth={Math.max(bounds.width / 300000, 2)}
              strokeDasharray={`${Math.max(bounds.width / 80000, 6)} ${Math.max(bounds.width / 50000, 10)}`}
            />
          ) : null}
          {currentFrame?.zones?.bluezone ? (
            <circle
              cx={currentFrame.zones.bluezone.x}
              cy={currentFrame.zones.bluezone.y}
              r={currentFrame.zones.bluezone.radius}
              fill="var(--chart-2)"
              fillOpacity="0.06"
              stroke="var(--chart-2)"
              strokeOpacity="0.75"
              strokeWidth={Math.max(bounds.width / 320000, 2)}
            />
          ) : null}
          {currentFrame?.zones?.safezone ? (
            <circle
              cx={currentFrame.zones.safezone.x}
              cy={currentFrame.zones.safezone.y}
              r={currentFrame.zones.safezone.radius}
              fill="none"
              stroke="var(--foreground)"
              strokeOpacity="0.8"
              strokeWidth={Math.max(bounds.width / 320000, 2)}
              strokeDasharray={`${Math.max(bounds.width / 90000, 8)} ${Math.max(bounds.width / 60000, 10)}`}
            />
          ) : null}
          {selectedPath ? (
            <polyline
              points={selectedPath}
              fill="none"
              stroke={
                selectedPlayerId === analysis.playerId
                  ? "var(--chart-1)"
                  : "var(--chart-4)"
              }
              strokeOpacity="0.45"
              strokeWidth={Math.max(bounds.width / 240000, 2)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${Math.max(bounds.width / 120000, 4)} ${Math.max(bounds.width / 180000, 6)}`}
            />
          ) : null}
          {visibleKills.map((kill, index) =>
            kill.location ? (
              <g key={`${kill.timestamp}-${index}`}>
                <title>{kill.message}</title>
                <circle
                  cx={kill.location.x}
                  cy={kill.location.y}
                  r={Math.max(bounds.width / 100, 8)}
                  fill={
                    kill.actor === analysis.playerId
                      ? "var(--destructive)"
                      : "var(--chart-5)"
                  }
                  fillOpacity="0.15"
                  stroke={
                    kill.actor === analysis.playerId
                      ? "var(--destructive)"
                      : "var(--chart-5)"
                  }
                  strokeWidth={Math.max(bounds.width / 400000, 2)}
                />
                <circle
                  cx={kill.location.x}
                  cy={kill.location.y}
                  r={Math.max(bounds.width / 260, 4)}
                  fill={
                    kill.actor === analysis.playerId
                      ? "var(--destructive)"
                      : "var(--chart-5)"
                  }
                />
              </g>
            ) : null
          )}
          {visibleDamage.map((event, index) =>
            event.location ? (
              <circle
                key={`${event.timestamp}-${index}`}
                cx={event.location.x}
                cy={event.location.y}
                r={Math.max(bounds.width / 350, 4)}
                fill="var(--chart-3)"
                fillOpacity="0.7"
                stroke="var(--background)"
                strokeWidth={Math.max(bounds.width / 500000, 2)}
              />
            ) : null
          )}
          {visibleAttacks.map((event, index) =>
            event.location ? (
              <g key={`attack-${event.timestamp}-${index}`}>
                <title>{event.message}</title>
                <path
                  d={`M ${event.location.x - Math.max(bounds.width / 260, 5)} ${event.location.y} H ${event.location.x + Math.max(bounds.width / 260, 5)} M ${event.location.x} ${event.location.y - Math.max(bounds.width / 260, 5)} V ${event.location.y + Math.max(bounds.width / 260, 5)}`}
                  stroke="var(--chart-1)"
                  strokeOpacity="0.8"
                  strokeWidth={Math.max(bounds.width / 500000, 2)}
                  strokeLinecap="round"
                />
              </g>
            ) : null
          )}
          {activeDamage.map((event, index) =>
            event.location && event.targetLocation ? (
              <line
                key={`tracer-${event.timestamp}-${index}`}
                x1={event.location.x}
                y1={event.location.y}
                x2={event.targetLocation.x}
                y2={event.targetLocation.y}
                stroke="var(--chart-3)"
                strokeOpacity="0.8"
                strokeWidth={Math.max(bounds.width / 180000, 3)}
                strokeDasharray={`${Math.max(bounds.width / 70000, 8)} ${Math.max(bounds.width / 90000, 10)}`}
                strokeLinecap="round"
              />
            ) : null
          )}
          {visibleCarePackages.map((event, index) =>
            event.location ? (
              <g key={`care-package-${event.timestamp}-${index}`}>
                <rect
                  x={event.location.x - Math.max(bounds.width / 170, 8)}
                  y={event.location.y - Math.max(bounds.width / 170, 8)}
                  width={Math.max(bounds.width / 85, 16)}
                  height={Math.max(bounds.width / 85, 16)}
                  rx={Math.max(bounds.width / 300, 4)}
                  fill="var(--chart-4)"
                  fillOpacity="0.9"
                  stroke="var(--background)"
                  strokeWidth={Math.max(bounds.width / 500000, 2)}
                />
                <path
                  d={`M ${event.location.x - Math.max(bounds.width / 230, 6)} ${event.location.y} H ${event.location.x + Math.max(bounds.width / 230, 6)} M ${event.location.x} ${event.location.y - Math.max(bounds.width / 230, 6)} V ${event.location.y + Math.max(bounds.width / 230, 6)}`}
                  stroke="var(--background)"
                  strokeWidth={Math.max(bounds.width / 500000, 2)}
                  strokeLinecap="round"
                />
              </g>
            ) : null
          )}
          {Array.from(states.entries()).map(
            ([playerIndex, [, x, y, status]]) => {
              const player = analysis.replayPlayers[playerIndex]
              if (!player) return null
              const isTarget = playerIndex === targetIndex
              const isSelected = playerIndex === selectedIndex
              const isTeammate =
                !isTarget &&
                targetTeamId !== undefined &&
                player.teamId === targetTeamId
              const radius = Math.max(bounds.width / (isTarget ? 90 : 180), 7)
              return (
                <g key={player.id}>
                  {isTarget ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius * 1.8}
                      fill="none"
                      stroke="var(--chart-1)"
                      strokeOpacity="0.35"
                      strokeWidth={Math.max(bounds.width / 300000, 2)}
                    />
                  ) : null}
                  {isSelected && !isTarget ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius * 1.8}
                      fill="none"
                      stroke="var(--chart-4)"
                      strokeOpacity="0.55"
                      strokeWidth={Math.max(bounds.width / 300000, 2)}
                    />
                  ) : null}
                  {isTeammate ? (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius * 1.65}
                      fill="none"
                      stroke="var(--chart-2)"
                      strokeOpacity="0.65"
                      strokeWidth={Math.max(bounds.width / 300000, 2)}
                      strokeDasharray={`${Math.max(bounds.width / 90000, 8)} ${Math.max(bounds.width / 70000, 8)}`}
                    />
                  ) : null}
                  {vehicleIndexes.has(playerIndex) ? (
                    <rect
                      x={x - radius * 1.25}
                      y={y - radius * 1.25}
                      width={radius * 2.5}
                      height={radius * 2.5}
                      rx={radius * 0.35}
                      fill="none"
                      stroke="var(--chart-4)"
                      strokeOpacity="0.9"
                      strokeWidth={Math.max(bounds.width / 320000, 2)}
                    />
                  ) : null}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={
                      isTarget
                        ? "var(--chart-1)"
                        : isSelected
                          ? "var(--chart-4)"
                          : statusColors[status]
                    }
                    fillOpacity={status === "dead" ? 0.45 : 0.95}
                    stroke="var(--background)"
                    strokeWidth={Math.max(bounds.width / 500000, 2)}
                  />
                  {isTarget || isSelected ? (
                    <text
                      x={x}
                      y={y - radius * 2}
                      fill="currentColor"
                      fontSize={Math.max(bounds.width / 45, 12)}
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {player.name}
                    </text>
                  ) : null}
                </g>
              )
            }
          )}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <Badge variant="secondary" className="bg-background/85">
          {MAP_LABELS[mapName] ?? mapName} · 战术视图
        </Badge>
        <div className="flex flex-wrap justify-end gap-2">
          {selectedPlayer ? (
            <Badge variant="outline" className="bg-background/85">
              跟踪：{selectedPlayer.name}
            </Badge>
          ) : null}
          <Badge variant="outline" className="bg-background/85">
            {currentFrame
              ? `T+${formatTime(currentFrame.elapsedSeconds)}`
              : "无位置数据"}
          </Badge>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-md border bg-background/85 px-2 py-1">
          轨迹：{selectedPlayer?.name ?? "已选玩家"}
        </span>
        <span className="rounded-md border bg-background/85 px-2 py-1">
          标记：击杀 / 伤害 / 开火 / 载具
        </span>
        {visibleCarePackages.length ? (
          <span className="rounded-md border bg-background/85 px-2 py-1">
            补给箱：{visibleCarePackages.length}
          </span>
        ) : null}
        {currentFrame?.zones?.bluezone ? (
          <span className="rounded-md border bg-background/85 px-2 py-1">
            蓝圈 / 白圈 / 红区 / 特殊区
          </span>
        ) : null}
      </div>
      <div className="absolute right-3 bottom-12 flex flex-col gap-1">
        <Button
          size="icon-sm"
          variant="secondary"
          aria-label="放大地图"
          onClick={() => onZoom(0.2)}
        >
          <PlusIcon data-icon="inline-start" />
        </Button>
        <Button
          size="icon-sm"
          variant="secondary"
          aria-label="缩小地图"
          onClick={() => onZoom(-0.2)}
        >
          <MinusIcon data-icon="inline-start" />
        </Button>
        <Button
          size="icon-sm"
          variant="secondary"
          aria-label="重置地图缩放"
          onClick={onReset}
        >
          <Maximize2Icon data-icon="inline-start" />
        </Button>
      </div>
    </div>
  )
}

type RosterFilter = "all" | ReplayPlayerStatus | "unknown"

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
  const visiblePlayers = [
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
          显示 {filteredPlayers.length} / {visiblePlayers.length} 名玩家
        </p>
      </div>
      <div className="max-h-[25rem] overflow-y-auto p-2">
        {filteredPlayers.length ? (
          filteredPlayers.map(({ player, participant }) => {
            const playerIndex = indexById.get(player.id)
            const state =
              playerIndex === undefined ? undefined : states.get(playerIndex)
            const vehicle =
              playerIndex === undefined ? undefined : vehicles.get(playerIndex)
            const isTarget = player.id === analysis.playerId
            const isSelected = player.id === selectedPlayerId
            const isTelemetryOnly = participant === undefined
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
                      ? isTarget
                        ? "var(--chart-1)"
                        : statusColors[state[3]]
                      : "var(--muted-foreground)",
                  }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {player.name}
                </span>
                {isTarget ? <Badge variant="secondary">目标</Badge> : null}
                {isTelemetryOnly ? (
                  <Badge variant="outline">仅遥测</Badge>
                ) : null}
                {player.teamId !== undefined ? (
                  <Badge
                    variant={
                      player.teamId === targetTeamId ? "secondary" : "outline"
                    }
                  >
                    队 {player.teamId}
                  </Badge>
                ) : null}
                {vehicle ? (
                  <Badge variant="outline" title={vehicle.vehicleType}>
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

type TimelineFilter = "all" | "combat" | "state"

function matchesTimelineFilter(
  event: MatchAnalysis["timeline"][number],
  filter: TimelineFilter
) {
  if (filter === "all") return true
  if (filter === "combat") {
    return /Kill|Damage|Death|Attack/.test(event.type)
  }
  return /Login|Create|Groggy|Knock|Revive|Rescue|CarePackage|Vehicle/.test(
    event.type
  )
}

function ReplayTimeline({
  events,
  currentTime,
  onSeek,
  playerNames,
}: {
  events: MatchAnalysis["timeline"]
  currentTime: number
  onSeek: (seconds: number) => void
  playerNames: Map<string, string>
}) {
  const [filter, setFilter] = React.useState<TimelineFilter>("all")
  const [selectedEvent, setSelectedEvent] = React.useState<
    MatchAnalysis["timeline"][number] | null
  >(null)
  const filteredEvents = events.filter((event) =>
    matchesTimelineFilter(event, filter)
  )
  const activeIndex = filteredEvents.reduce(
    (result, event, index) =>
      event.elapsedSeconds !== undefined && event.elapsedSeconds <= currentTime
        ? index
        : result,
    -1
  )
  const nextEvent = filteredEvents.find(
    (event) => (event.elapsedSeconds ?? 0) > currentTime + 0.05
  )
  const previousEvent = [...filteredEvents]
    .reverse()
    .find((event) => (event.elapsedSeconds ?? 0) < currentTime - 0.05)

  return (
    <>
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">事件时间线</h3>
            <p className="text-xs text-muted-foreground">
              点击事件跳转到回放位置
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
            </ToggleGroup>
            <Button
              size="sm"
              variant="outline"
              disabled={!previousEvent}
              onClick={() => onSeek(previousEvent?.elapsedSeconds ?? 0)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              上一事件
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!nextEvent}
              onClick={() => onSeek(nextEvent?.elapsedSeconds ?? 0)}
            >
              下一事件
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Badge variant="outline">
              {filteredEvents.length === events.length
                ? `${events.length} 个事件`
                : `${filteredEvents.length} / ${events.length} 个事件`}
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
                  variant={index === activeIndex ? "secondary" : "ghost"}
                  className="h-auto min-h-12 justify-start gap-3 px-2 py-2 text-left"
                  onClick={() => {
                    onSeek(elapsedSeconds)
                    setSelectedEvent(event)
                  }}
                >
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                    {formatTime(elapsedSeconds)}
                  </span>
                  <Badge
                    variant={
                      event.type.includes("Kill") ? "default" : "outline"
                    }
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
                        selectedEvent.type.includes("Kill")
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
                  <dt className="text-xs text-muted-foreground">位置坐标</dt>
                  <dd className="font-mono text-sm">
                    {formatEventLocation(selectedEvent.location)}
                  </dd>
                </div>
                {selectedEvent.targetLocation ? (
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">目标坐标</dt>
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
  participantCount,
  currentFrame,
  currentTime,
}: {
  analysis: MatchAnalysis
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
    ? activePlayers.length
    : undefined
  const reliableAlivePlayers =
    currentFrame?.alivePlayers ?? estimatedAlivePlayers
  const currentKills = analysis.kills.filter(
    (event) =>
      event.elapsedSeconds === undefined || event.elapsedSeconds <= currentTime
  ).length

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
                ? "根据完整位置帧估算"
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
        detail={`${targetHealth !== undefined ? `${Math.round(targetHealth)}% 生命 · ` : ""}${targetVehicle ? "载具移动 · " : ""}${currentPhase !== undefined ? `阶段 ${formatPhase(currentPhase)} · ` : ""}T+${formatTime(currentTime)}`}
        icon={ActivityIcon}
      />
      <StatCard
        label="目标玩家击杀"
        value={String(currentKills)}
        detail={`${analysis.kills.length} 次总计`}
        icon={CrosshairIcon}
      />
    </div>
  )
}

function ReplayEventMarkers({
  events,
  duration,
  onSeek,
}: {
  events: MatchAnalysis["timeline"]
  duration: number
  onSeek: (seconds: number) => void
}) {
  const markers = events.filter(
    (event) =>
      event.elapsedSeconds !== undefined && /Kill|Death|Attack/.test(event.type)
  )
  if (duration <= 0 || markers.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-6 -translate-y-1/2">
      {markers.map((event, index) => {
        const seconds = event.elapsedSeconds ?? 0
        const position = Math.min(100, Math.max(0, (seconds / duration) * 100))
        return (
          <Button
            key={`${event.type}-${event.timestamp}-${index}`}
            type="button"
            size="icon-xs"
            variant={
              event.type.includes("Attack") ? "secondary" : "destructive"
            }
            className="pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${position}%` }}
            aria-label={`跳转到 ${formatTime(seconds)}：${event.message}`}
            onClick={() => onSeek(seconds)}
          >
            <span className="size-1.5 rounded-full bg-current" />
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
  const [currentTime, setCurrentTime] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState<number>(1)
  const [mapScale, setMapScale] = React.useState(1)
  const [mapPan, setMapPan] = React.useState<MapPan>({ x: 0, y: 0 })
  const [selectedPlayerId, setSelectedPlayerId] = React.useState(
    analysis.playerId
  )
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
              <ReplayMap
                mapName={match.mapName}
                analysis={analysis}
                currentFrame={currentFrame}
                currentTime={currentTime}
                duration={duration}
                selectedPlayerId={selectedPlayerId}
                mapScale={mapScale}
                mapPan={mapPan}
                onPanChange={setMapPan}
                onZoom={(delta) =>
                  setMapScale((value) =>
                    delta === 0 ? 1 : Math.min(Math.max(value + delta, 1), 3)
                  )
                }
                onReset={() => {
                  setMapScale(1)
                  setMapPan({ x: 0, y: 0 })
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
                    <div className="relative">
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
                      <ReplayEventMarkers
                        events={analysis.timeline}
                        duration={duration}
                        onSeek={(seconds) => {
                          setPlaying(false)
                          setTime(seconds)
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-chart-1" />{" "}
                        目标玩家
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-chart-2" />{" "}
                        其他玩家状态
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full border-2 border-dashed border-chart-2" />{" "}
                        同队玩家
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
        {analysis.timeline.length ? (
          <ReplayTimeline
            events={analysis.timeline}
            currentTime={currentTime}
            playerNames={playerNames}
            onSeek={(seconds) => {
              setPlaying(false)
              setTime(seconds)
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
