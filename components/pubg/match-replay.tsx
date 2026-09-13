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
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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

const MAP_ASSET_PATHS: Record<string, string> = {
  Baltic_Main: "/maps/Baltic_Main.png",
  Erangel_Main: "/maps/Erangel_Main.png",
  Desert_Main: "/maps/Desert_Main.png",
  Savage_Main: "/maps/Savage_Main.png",
  DihorOtok_Main: "/maps/DihorOtok_Main.png",
  Summerland_Main: "/maps/Summerland_Main.png",
  Chimera_Main: "/maps/Chimera_Main.png",
  Heaven_Main: "/maps/Heaven_Main.png",
  Tiger_Main: "/maps/Tiger_Main.png",
  Kiki_Main: "/maps/Kiki_Main.png",
  Neon_Main: "/maps/Neon_Main.jpg",
}

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

function frameAtTime(frame: ReplayFrame, elapsedSeconds: number) {
  if (frame.elapsedSeconds === elapsedSeconds) return frame
  return { ...frame, elapsedSeconds }
}

function interpolateFrame(frames: ReplayFrame[], elapsedSeconds: number) {
  if (frames.length === 0) return null
  if (elapsedSeconds <= frames[0]!.elapsedSeconds) {
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

  const rightFrameActive = progress >= 0.5
  const alivePlayers = rightFrameActive
    ? (right.alivePlayers ?? left.alivePlayers)
    : (left.alivePlayers ?? right.alivePlayers)
  const aliveTeams = rightFrameActive
    ? (right.aliveTeams ?? left.aliveTeams)
    : (left.aliveTeams ?? right.aliveTeams)
  const phase = rightFrameActive
    ? (right.phase ?? left.phase)
    : (left.phase ?? right.phase)
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
    ...analysis.flightPath,
    ...analysis.timeline.flatMap((event) => [
      ...(event.location ? [event.location] : []),
      ...(event.targetLocation ? [event.targetLocation] : []),
    ]),
    ...analysis.replayFrames.flatMap((frame) => [
      ...frame.players.map(([, x, y]) => ({ x, y })),
      ...Object.values(frame.zones ?? {}).flatMap((zone) =>
        zone
          ? [
              { x: zone.x - zone.radius, y: zone.y - zone.radius },
              { x: zone.x + zone.radius, y: zone.y + zone.radius },
            ]
          : []
      ),
    ]),
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

type ReplayMapPoint = { x: number; y: number; z?: number }
type ReplayMapBounds = {
  minX: number
  minY: number
  width: number
  height: number
}

function extendRayToBounds(
  point: ReplayMapPoint,
  direction: { x: number; y: number },
  bounds: ReplayMapBounds,
  allowOpposite = true
) {
  const maxX = bounds.minX + bounds.width
  const maxY = bounds.minY + bounds.height
  const candidates: number[] = []
  const addCandidate = (distance: number) => {
    if (!Number.isFinite(distance) || distance < 0) return
    const x = point.x + direction.x * distance
    const y = point.y + direction.y * distance
    const epsilon = Math.max(bounds.width, bounds.height) * 1e-8
    if (
      x >= bounds.minX - epsilon &&
      x <= maxX + epsilon &&
      y >= bounds.minY - epsilon &&
      y <= maxY + epsilon
    ) {
      candidates.push(distance)
    }
  }

  if (direction.x !== 0) {
    addCandidate((maxX - point.x) / direction.x)
    addCandidate((bounds.minX - point.x) / direction.x)
  }
  if (direction.y !== 0) {
    addCandidate((maxY - point.y) / direction.y)
    addCandidate((bounds.minY - point.y) / direction.y)
  }

  const distance = Math.min(...candidates)
  if (!Number.isFinite(distance)) {
    if (allowOpposite) {
      return extendRayToBounds(
        point,
        { x: -direction.x, y: -direction.y },
        bounds,
        false
      )
    }
    return point
  }
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  }
}

function clipFlightSegmentToBounds(
  start: ReplayMapPoint,
  end: ReplayMapPoint,
  bounds: ReplayMapBounds
) {
  const maxX = bounds.minX + bounds.width
  const maxY = bounds.minY + bounds.height
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  let entry = 0
  let exit = 1

  const updateInterval = (coefficient: number, constant: number) => {
    if (coefficient === 0) return constant >= 0
    const value = constant / coefficient
    if (coefficient < 0) {
      entry = Math.max(entry, value)
    } else {
      exit = Math.min(exit, value)
    }
    return entry <= exit
  }

  if (
    !updateInterval(-deltaX, start.x - bounds.minX) ||
    !updateInterval(deltaX, maxX - start.x) ||
    !updateInterval(-deltaY, start.y - bounds.minY) ||
    !updateInterval(deltaY, maxY - start.y)
  ) {
    return null
  }

  const pointAt = (progress: number): ReplayMapPoint => ({
    x: start.x + deltaX * progress,
    y: start.y + deltaY * progress,
    ...(start.z !== undefined && end.z !== undefined
      ? { z: start.z + (end.z - start.z) * progress }
      : start.z !== undefined
        ? { z: start.z }
        : end.z !== undefined
          ? { z: end.z }
          : {}),
  })

  return [pointAt(entry), pointAt(exit)] as const
}

function clipFlightPathToBounds(
  points: ReplayMapPoint[],
  bounds: ReplayMapBounds
) {
  if (points.length === 0) return []
  if (points.length === 1) {
    const [point] = points
    const maxX = bounds.minX + bounds.width
    const maxY = bounds.minY + bounds.height
    return point &&
      point.x >= bounds.minX &&
      point.x <= maxX &&
      point.y >= bounds.minY &&
      point.y <= maxY
      ? [point]
      : []
  }
  const first = points[0]!
  const second = points[1]!
  const last = points.at(-1)!
  const previous = points.at(-2)!
  const extendedPoints = [
    {
      ...first,
      ...extendRayToBounds(
        first,
        { x: first.x - second.x, y: first.y - second.y },
        bounds
      ),
    },
    ...points.slice(1, -1),
    {
      ...last,
      ...extendRayToBounds(
        last,
        { x: last.x - previous.x, y: last.y - previous.y },
        bounds
      ),
    },
  ]
  const clipped: ReplayMapPoint[] = []
  const samePoint = (left: ReplayMapPoint, right: ReplayMapPoint) =>
    Math.abs(left.x - right.x) < 0.001 && Math.abs(left.y - right.y) < 0.001

  for (let index = 1; index < extendedPoints.length; index += 1) {
    const segment = clipFlightSegmentToBounds(
      extendedPoints[index - 1]!,
      extendedPoints[index]!,
      bounds
    )
    if (!segment) continue
    const [start, end] = segment
    if (!clipped.at(-1) || !samePoint(clipped.at(-1)!, start)) {
      clipped.push(start)
    }
    if (!clipped.at(-1) || !samePoint(clipped.at(-1)!, end)) {
      clipped.push(end)
    }
  }

  return clipped.length >= 2 ? clipped : []
}

function currentStates(frame: ReplayFrame | null) {
  return new Map(frame?.players.map((player) => [player[0], player]) ?? [])
}

type MapPan = { x: number; y: number }
type ReplayLayer = "flightPath" | "trajectory" | "zones" | "events"
type ReplayTimelineLayer = "kills" | "damage" | "attacks" | "state" | "zones"

function replayTimelineKind(
  event: MatchAnalysis["timeline"][number]
): Exclude<ReplayTimelineLayer, "zones"> | null {
  if (event.type.includes("Kill") || event.type.includes("Death")) {
    return "kills"
  }
  if (event.type.includes("Damage")) return "damage"
  if (event.type.includes("Attack")) return "attacks"
  if (
    /Login|Create|Groggy|Knock|Revive|Rescue|CarePackage|Vehicle/.test(
      event.type
    )
  ) {
    return "state"
  }
  return null
}

function MapEventMarker({ children }: { children: React.ReactNode }) {
  return <g>{children}</g>
}

function MapEventButton({
  event,
  bounds,
  onSelect,
}: {
  event: MatchAnalysis["timeline"][number]
  bounds: ReplayMapBounds
  onSelect: (event: MatchAnalysis["timeline"][number]) => void
}) {
  if (!event.location) return null
  const left = (event.location.x - bounds.minX) / bounds.width
  const top = (event.location.y - bounds.minY) / bounds.height

  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      data-map-event-marker="true"
      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-0 opacity-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
      aria-label={`打开事件 ${formatTime(event.elapsedSeconds ?? 0)}：${event.message}`}
      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
      onClick={(pointerEvent) => {
        pointerEvent.stopPropagation()
        onSelect(event)
      }}
    >
      <span className="sr-only">{event.message}</span>
    </Button>
  )
}

function ReplayMap({
  mapName,
  analysis,
  currentFrame,
  currentTime,
  duration,
  selectedPlayerId,
  visibleTimelineLayers,
  mapScale,
  mapPan,
  visibleLayers,
  onVisibleLayersChange,
  onPanChange,
  onZoom,
  onReset,
  onEventSelect,
}: {
  mapName: string
  analysis: MatchAnalysis
  currentFrame: ReplayFrame | null
  currentTime: number
  duration: number
  selectedPlayerId: string
  visibleTimelineLayers: ReplayTimelineLayer[]
  mapScale: number
  mapPan: MapPan
  visibleLayers: ReplayLayer[]
  onVisibleLayersChange: (layers: ReplayLayer[]) => void
  onPanChange: (pan: MapPan) => void
  onZoom: (delta: number) => void
  onReset: () => void
  onEventSelect: (event: MatchAnalysis["timeline"][number]) => void
}) {
  const showFlightPath = visibleLayers.includes("flightPath")
  const showTrajectory = visibleLayers.includes("trajectory")
  const showZones = visibleLayers.includes("zones")
  const showEvents = visibleLayers.includes("events")
  const showStateMarkers = visibleTimelineLayers.includes("state")
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
  const trackedPlayer = analysis.replayPlayers[targetIndex]
  const flightPathPoints = React.useMemo(
    () => clipFlightPathToBounds(analysis.flightPath, bounds),
    [analysis.flightPath, bounds]
  )
  const extendedFlightPath = flightPathPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ")
  const trackedPath = React.useMemo(() => {
    const framePath: string[] = []
    for (const frame of analysis.replayFrames) {
      if (frame.elapsedSeconds > visibleTime) continue
      const player = frame.players.find(
        ([playerIndex]) => playerIndex === targetIndex
      )
      if (!player) continue
      const point = `${player[1]},${player[2]}`
      if (framePath.at(-1) !== point) framePath.push(point)
    }
    const currentPlayer = currentFrame?.players.find(
      ([playerIndex]) => playerIndex === targetIndex
    )
    if (currentPlayer) {
      const currentPoint = `${currentPlayer[1]},${currentPlayer[2]}`
      if (framePath.at(-1) !== currentPoint) framePath.push(currentPoint)
    }
    if (framePath.length > 0) return framePath.join(" ")
    return analysis.replayFrames.length === 0 ? path : ""
  }, [analysis.replayFrames, currentFrame, path, targetIndex, visibleTime])
  const trackedPathPointCount = trackedPath ? trackedPath.split(" ").length : 0
  const hasCurrentZones = Object.values(currentFrame?.zones ?? {}).some(Boolean)
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
      visibleTimelineLayers.includes("damage") &&
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
  const mapEvents = [
    ...(visibleTimelineLayers.includes("kills") ? visibleKills : []),
    ...(visibleTimelineLayers.includes("damage") ? visibleDamage : []),
    ...(visibleTimelineLayers.includes("attacks") ? visibleAttacks : []),
    ...(visibleTimelineLayers.includes("state") ? visibleCarePackages : []),
  ]
  const mapAssetUrl = MAP_ASSET_PATHS[mapName] ?? null
  const panRef = React.useRef<{
    startX: number
    startY: number
    pan: MapPan
  } | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (
      event.target instanceof Element &&
      event.target.closest("[data-map-event-marker]")
    ) {
      return
    }
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
          className="pointer-events-auto absolute inset-0 size-full"
          role="img"
          aria-label="比赛回放地图"
        >
          <defs>
            <marker
              id="replay-flight-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
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
          {showFlightPath && flightPathPoints.length > 0 ? (
            <g>
              <title>起始航线</title>
              {flightPathPoints.length > 1 ? (
                <polyline
                  points={extendedFlightPath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeOpacity="0.9"
                  strokeWidth={3}
                  strokeDasharray={`${Math.max(bounds.width / 90000, 10)} ${Math.max(bounds.width / 70000, 8)}`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#replay-flight-arrow)"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <circle
                cx={flightPathPoints[0]!.x}
                cy={flightPathPoints[0]!.y}
                r={Math.max(bounds.width / 170, 8)}
                fill="#f59e0b"
                fillOpacity="0.95"
                stroke="var(--background)"
                strokeWidth={Math.max(bounds.width / 500000, 2)}
                vectorEffect="non-scaling-stroke"
              />
              {flightPathPoints.length > 1 ? (
                <circle
                  cx={flightPathPoints.at(-1)!.x}
                  cy={flightPathPoints.at(-1)!.y}
                  r={Math.max(bounds.width / 170, 8)}
                  fill="var(--background)"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </g>
          ) : null}
          {showZones && currentFrame?.zones?.redzone ? (
            <g>
              <title>红区</title>
              <circle
                cx={currentFrame.zones.redzone.x}
                cy={currentFrame.zones.redzone.y}
                r={currentFrame.zones.redzone.radius}
                fill="none"
                stroke="#ef4444"
                strokeOpacity="0.9"
                strokeWidth={2.5}
                strokeDasharray={`${Math.max(bounds.width / 100000, 6)} ${Math.max(bounds.width / 70000, 8)}`}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
          {showZones && currentFrame?.zones?.blackzone ? (
            <g>
              <title>特殊区</title>
              <circle
                cx={currentFrame.zones.blackzone.x}
                cy={currentFrame.zones.blackzone.y}
                r={currentFrame.zones.blackzone.radius}
                fill="none"
                stroke="#a855f7"
                strokeOpacity="0.85"
                strokeWidth={2.5}
                strokeDasharray={`${Math.max(bounds.width / 80000, 6)} ${Math.max(bounds.width / 50000, 10)}`}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
          {showZones && currentFrame?.zones?.bluezone ? (
            <g>
              <title>蓝圈</title>
              <circle
                cx={currentFrame.zones.bluezone.x}
                cy={currentFrame.zones.bluezone.y}
                r={currentFrame.zones.bluezone.radius}
                fill="none"
                stroke="#60a5fa"
                strokeOpacity="0.95"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
          {showZones && currentFrame?.zones?.safezone ? (
            <g>
              <title>白圈</title>
              <circle
                cx={currentFrame.zones.safezone.x}
                cy={currentFrame.zones.safezone.y}
                r={currentFrame.zones.safezone.radius}
                fill="none"
                stroke="#0f172a"
                strokeOpacity="0.7"
                strokeWidth={7}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={currentFrame.zones.safezone.x}
                cy={currentFrame.zones.safezone.y}
                r={currentFrame.zones.safezone.radius}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.98"
                strokeWidth={4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
          {showTrajectory && trackedPath ? (
            <polyline
              points={trackedPath}
              fill="none"
              stroke="#22d3ee"
              strokeOpacity="0.45"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${Math.max(bounds.width / 120000, 4)} ${Math.max(bounds.width / 180000, 6)}`}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {showEvents && visibleTimelineLayers.includes("kills")
            ? visibleKills.map((kill, index) =>
                kill.location ? (
                  <MapEventMarker key={`${kill.timestamp}-${index}`}>
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
                  </MapEventMarker>
                ) : null
              )
            : null}
          {showEvents && visibleTimelineLayers.includes("damage")
            ? visibleDamage.map((event, index) =>
                event.location ? (
                  <MapEventMarker key={`${event.timestamp}-${index}`}>
                    <circle
                      cx={event.location.x}
                      cy={event.location.y}
                      r={Math.max(bounds.width / 350, 4)}
                      fill="var(--chart-3)"
                      fillOpacity="0.7"
                      stroke="var(--background)"
                      strokeWidth={Math.max(bounds.width / 500000, 2)}
                    />
                  </MapEventMarker>
                ) : null
              )
            : null}
          {showEvents && visibleTimelineLayers.includes("attacks")
            ? visibleAttacks.map((event, index) =>
                event.location ? (
                  <MapEventMarker key={`attack-${event.timestamp}-${index}`}>
                    <title>{event.message}</title>
                    <path
                      d={`M ${event.location.x - Math.max(bounds.width / 260, 5)} ${event.location.y} H ${event.location.x + Math.max(bounds.width / 260, 5)} M ${event.location.x} ${event.location.y - Math.max(bounds.width / 260, 5)} V ${event.location.y + Math.max(bounds.width / 260, 5)}`}
                      stroke="var(--chart-1)"
                      strokeOpacity="0.8"
                      strokeWidth={Math.max(bounds.width / 500000, 2)}
                      strokeLinecap="round"
                    />
                  </MapEventMarker>
                ) : null
              )
            : null}
          {showEvents
            ? activeDamage.map((event, index) =>
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
              )
            : null}
          {showEvents && visibleTimelineLayers.includes("state")
            ? visibleCarePackages.map((event, index) =>
                event.location ? (
                  <MapEventMarker
                    key={`care-package-${event.timestamp}-${index}`}
                  >
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
                  </MapEventMarker>
                ) : null
              )
            : null}
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
                  {showStateMarkers && vehicleIndexes.has(playerIndex) ? (
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
        <div
          className="pointer-events-none absolute inset-0"
          aria-label="地图事件点击层"
        >
          {showEvents
            ? mapEvents.map((event, index) => (
                <MapEventButton
                  key={`map-event-${event.type}-${event.timestamp}-${index}`}
                  event={event}
                  bounds={bounds}
                  onSelect={onEventSelect}
                />
              ))
            : null}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <Badge variant="secondary" className="bg-background/85">
          {MAP_LABELS[mapName] ?? mapName} · 战术视图
        </Badge>
        <div className="flex flex-wrap justify-end gap-2">
          {trackedPlayer ? (
            <Badge variant="outline" className="bg-background/85">
              跟踪：{trackedPlayer.name}
            </Badge>
          ) : null}
          {flightPathPoints.length > 0 ? (
            <Badge variant="outline" className="bg-background/85">
              航线 {flightPathPoints.length} 点
            </Badge>
          ) : null}
          {trackedPathPointCount > 0 ? (
            <Badge variant="outline" className="bg-background/85">
              轨迹 {trackedPathPointCount} 点
            </Badge>
          ) : null}
          <Badge variant="outline" className="bg-background/85">
            {hasCurrentZones ? "圈层已加载" : "圈层等待"}
          </Badge>
          <Badge variant="outline" className="bg-background/85">
            {currentFrame
              ? `T+${formatTime(currentFrame.elapsedSeconds)}`
              : "无位置数据"}
          </Badge>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-12 flex items-center gap-2">
        <ToggleGroup
          multiple
          value={visibleLayers}
          onValueChange={(value) =>
            onVisibleLayersChange(value as ReplayLayer[])
          }
          variant="outline"
          size="sm"
          aria-label="切换回放地图图层"
          className="pointer-events-auto bg-background/85"
        >
          <ToggleGroupItem value="flightPath" aria-label="切换起始航线">
            航线
          </ToggleGroupItem>
          <ToggleGroupItem value="trajectory" aria-label="切换运动轨迹">
            轨迹
          </ToggleGroupItem>
          <ToggleGroupItem value="zones" aria-label="切换圈层">
            圈层
          </ToggleGroupItem>
          <ToggleGroupItem value="events" aria-label="切换事件标记">
            事件
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {flightPathPoints.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1">
            <span className="h-0 w-4 border-t-2 border-dashed border-amber-400" />
            起始航线
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1">
          <span className="h-0 w-4 border-t-2 border-cyan-400" />
          运动轨迹：{trackedPlayer?.name ?? "跟踪玩家"}
        </span>
        <span className="inline-flex items-center gap-2 rounded-md border bg-background/85 px-2 py-1">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full border-2 border-blue-400" />
            蓝圈
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full border-2 border-slate-100" />
            白圈
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full border-2 border-red-500" />
            红区
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full border-2 border-dashed border-purple-400" />
            特殊区
          </span>
        </span>
        {visibleCarePackages.length ? (
          <span className="rounded-md border bg-background/85 px-2 py-1">
            补给箱：{visibleCarePackages.length}
          </span>
        ) : null}
        <span className="rounded-md border bg-background/85 px-2 py-1">
          标记：击杀 / 伤害 / 开火 / 载具
        </span>
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
        {analysis.replayFrames.length ? (
          <p className="text-xs text-muted-foreground">
            列表状态表示各玩家最后一次遥测状态；官方存活人数以统计卡为准。
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

type TimelineFilter = "all" | "combat" | "state" | "selected"

function getReplayZoneMarkers(frames: ReplayFrame[]) {
  const minimumMarkerGapSeconds = 30
  const markers: ReplayFrame[] = []
  let previousPhaseKey: string | undefined
  let previousMarkerTime = Number.NEGATIVE_INFINITY

  for (const frame of frames) {
    if (!frame.zones) continue
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
              点击事件跳转到回放位置；上方事件开关同步控制地图标记和列表
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
  const markers = events
    .flatMap((event) => {
      const kind = replayTimelineKind(event)
      if (
        event.elapsedSeconds === undefined ||
        kind === null ||
        !visibleKinds.includes(kind)
      ) {
        return []
      }
      return [{ event, seconds: event.elapsedSeconds }]
    })
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
      laneEndTimes[resolvedLane] = marker.seconds
      return { ...marker, lane: resolvedLane }
    })
  if (duration <= 0 || markers.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-16">
      {markers.map(({ event, seconds, lane }, index) => {
        const position = Math.min(100, Math.max(0, (seconds / duration) * 100))
        return (
          <Button
            key={`${event.type}-${event.timestamp}-${index}`}
            type="button"
            size="icon-xs"
            variant={
              event.type.includes("Kill") || event.type.includes("Death")
                ? "destructive"
                : event.type.includes("Attack")
                  ? "secondary"
                  : "outline"
            }
            className={cn(
              "pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
              Math.abs(seconds - currentTime) <= 0.5 &&
                "ring-2 ring-ring ring-offset-1"
            )}
            style={{
              left: `${position}%`,
              top: `calc(50% + ${markerLaneOffsets[lane]}px)`,
            }}
            aria-current={
              Math.abs(seconds - currentTime) <= 0.5 ? "time" : undefined
            }
            aria-label={`跳转到 ${formatTime(seconds)}：${event.message}`}
            onPointerDown={(pointerEvent) => {
              pointerEvent.preventDefault()
              pointerEvent.stopPropagation()
            }}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              onSeek(seconds)
            }}
          >
            <span className="size-1.5 rounded-full bg-current" />
          </Button>
        )
      })}
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
  const activeMarkerIndex = markers.reduce(
    (result, frame, index) =>
      frame.elapsedSeconds <= currentTime ? index : result,
    -1
  )
  if (duration <= 0 || markers.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5">
      {markers.map((frame, index) => {
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
            style={{ left: `${position}%` }}
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
  const [currentTime, setCurrentTime] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState<number>(1)
  const [mapScale, setMapScale] = React.useState(1)
  const [mapPan, setMapPan] = React.useState<MapPan>({ x: 0, y: 0 })
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
              <ReplayMap
                mapName={match.mapName}
                analysis={analysis}
                currentFrame={currentFrame}
                currentTime={currentTime}
                duration={duration}
                selectedPlayerId={selectedPlayerId}
                visibleTimelineLayers={visibleTimelineLayers}
                mapScale={mapScale}
                mapPan={mapPan}
                visibleLayers={visibleLayers}
                onVisibleLayersChange={setVisibleLayers}
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
                          击杀/淘汰
                        </ToggleGroupItem>
                        <ToggleGroupItem value="damage">伤害</ToggleGroupItem>
                        <ToggleGroupItem value="attacks">开火</ToggleGroupItem>
                        <ToggleGroupItem value="state">
                          状态/载具
                        </ToggleGroupItem>
                        <ToggleGroupItem value="zones">
                          圈层阶段
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    <div className="relative pt-20 pb-5">
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
        {analysis.timeline.length ? (
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
                          selectedMapEvent.type.includes("Kill")
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
                    <dt className="text-xs text-muted-foreground">发生位置</dt>
                    <dd className="font-mono text-sm">
                      {formatEventLocation(selectedMapEvent.location)}
                    </dd>
                  </div>
                  {selectedMapEvent.targetLocation ? (
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">
                        目标位置
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
