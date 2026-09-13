"use client"

import * as React from "react"
import { Maximize2Icon, MinusIcon, PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  MatchAnalysis,
  ReplayFrame,
  ReplayFramePlayer,
  ReplayPlayerStatus,
  ReplayCarePackageEvent,
  ReplayZone,
} from "@/lib/pubg/types"

export type ReplayMapLayer =
  "flightPath" | "trajectory" | "zones" | "events" | "eliminated"

export type ReplayTimelineLayer =
  "kills" | "damage" | "attacks" | "state" | "zones"

type MapPoint = { x: number; y: number; z?: number }
type MapBounds = { minX: number; minY: number; width: number; height: number }
type MapPan = { x: number; y: number }

const MAP_IMAGE_SIZE = 819
const MAP_ZOOM_MIN = 1
const MAP_ZOOM_MAX = 50
const MAP_ZOOM_FACTOR = 1.2

export const MAP_WORLD_SIZES: Record<string, number> = {
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

export const MAP_LABELS: Record<string, string> = {
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

export const MAP_ASSET_PATHS: Record<string, string> = {
  Baltic_Main: "/maps/Baltic_Main.jpg",
  Erangel_Main: "/maps/Erangel_Main.jpg",
  Desert_Main: "/maps/Desert_Main.jpg",
  Savage_Main: "/maps/Savage_Main.jpg",
  DihorOtok_Main: "/maps/DihorOtok_Main.jpg",
  Summerland_Main: "/maps/Summerland_Main.jpg",
  Chimera_Main: "/maps/Chimera_Main.jpg",
  Heaven_Main: "/maps/Heaven_Main.jpg",
  Tiger_Main: "/maps/Tiger_Main.jpg",
  Kiki_Main: "/maps/Kiki_Main.jpg",
  Neon_Main: "/maps/Neon_Main.jpg",
}

const CARE_PACKAGE_ASSET_PATHS = {
  flying: "/assets/care-package-flying.png",
  normal: "/assets/care-package-normal.png",
} as const

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

function formatTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`
}

function formatPhase(phase: number) {
  return String(Math.round(phase * 10) / 10)
}

function isEliminationEvent(event: MatchAnalysis["timeline"][number]) {
  return event.type.includes("Kill") || event.type.includes("Death")
}

function isReplayZoneActive(frame: ReplayFrame) {
  return frame.phase === undefined || frame.phase >= 1
}

function healthPercentage(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.min(100, Math.max(0, value))
}

function healthColor(value: number) {
  if (value <= 25) return "var(--destructive)"
  if (value <= 60) return "var(--chart-3)"
  return "var(--chart-2)"
}

function currentStates(frame: ReplayFrame | null) {
  return new Map(frame?.players.map((player) => [player[0], player]) ?? [])
}

export function activeCarePackagesAtTime(
  events: ReplayCarePackageEvent[],
  currentTime: number
) {
  const active: ReplayCarePackageEvent[] = []
  const orderedEvents = [...events]
    .filter((event) => event.elapsedSeconds <= currentTime)
    .sort(
      (left, right) =>
        left.elapsedSeconds - right.elapsedSeconds || left.key - right.key
    )

  for (const event of orderedEvents) {
    if (/Uaz_Armored_C/i.test(event.packageType ?? "")) continue
    if (event.state === "spawned") {
      active.push(event)
      continue
    }

    let matchIndex = -1
    let closestDistance = Number.POSITIVE_INFINITY
    for (const [index, candidate] of active.entries()) {
      if (candidate.state !== "spawned") continue
      const distance = Math.hypot(
        candidate.location.x - event.location.x,
        candidate.location.y - event.location.y
      )
      if (distance < closestDistance) {
        closestDistance = distance
        matchIndex = index
      }
    }

    if (matchIndex >= 0) {
      const spawned = active[matchIndex]!
      active[matchIndex] = {
        ...spawned,
        state: "landed",
        location: event.location,
        ...(event.items ? { items: event.items } : {}),
      }
    } else {
      active.push(event)
    }
  }

  return active
}

function pointsFromAnalysis(analysis: MatchAnalysis) {
  return [
    ...analysis.trajectory,
    ...analysis.flightPath,
    ...analysis.timeline.flatMap((event) => [
      ...(event.location ? [event.location] : []),
      ...(event.targetLocation ? [event.targetLocation] : []),
    ]),
    ...analysis.replayFrames.flatMap((frame) =>
      frame.players.map(([, x, y]) => ({ x, y }))
    ),
  ]
}

function fallbackBounds(analysis: MatchAnalysis): MapBounds {
  const points = pointsFromAnalysis(analysis)
  if (points.length === 0) {
    return { minX: 0, minY: 0, width: MAP_IMAGE_SIZE, height: MAP_IMAGE_SIZE }
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

function createMapModel(analysis: MatchAnalysis, mapName: string) {
  const worldSize = MAP_WORLD_SIZES[mapName]
  const mapAdjustment = worldSize === 816000 ? 0.99609375 : 1
  if (!worldSize) {
    const bounds = fallbackBounds(analysis)
    return {
      bounds,
      assetUrl: null,
      projectPoint: (point: MapPoint): MapPoint => point,
      projectRadius: (radius: number) => radius,
    }
  }

  const bounds: MapBounds = {
    minX: 0,
    minY: 0,
    width: MAP_IMAGE_SIZE,
    height: MAP_IMAGE_SIZE,
  }
  const projectPoint = (point: MapPoint): MapPoint => ({
    x: (point.x / worldSize) * MAP_IMAGE_SIZE * mapAdjustment,
    y: (point.y / worldSize) * MAP_IMAGE_SIZE * mapAdjustment,
    ...(point.z !== undefined ? { z: point.z } : {}),
  })

  return {
    bounds,
    assetUrl: MAP_ASSET_PATHS[mapName] ?? null,
    projectPoint,
    projectRadius: (radius: number) =>
      (radius / worldSize) * MAP_IMAGE_SIZE * mapAdjustment,
  }
}

function extendLineToBounds(
  start: MapPoint,
  end: MapPoint,
  bounds: MapBounds
): [MapPoint, MapPoint] | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return null
  const maxX = bounds.minX + bounds.width
  const maxY = bounds.minY + bounds.height
  const candidates: MapPoint[] = []
  const addCandidate = (t: number) => {
    if (!Number.isFinite(t)) return
    const point = { x: start.x + dx * t, y: start.y + dy * t }
    if (
      point.x >= bounds.minX - 0.001 &&
      point.x <= maxX + 0.001 &&
      point.y >= bounds.minY - 0.001 &&
      point.y <= maxY + 0.001
    ) {
      candidates.push(point)
    }
  }
  if (dx !== 0) {
    addCandidate((bounds.minX - start.x) / dx)
    addCandidate((maxX - start.x) / dx)
  }
  if (dy !== 0) {
    addCandidate((bounds.minY - start.y) / dy)
    addCandidate((maxY - start.y) / dy)
  }
  if (candidates.length < 2) return null
  return [candidates[0]!, candidates.at(-1)!]
}

function clampPan(pan: MapPan, scale: number, viewportSize: number): MapPan {
  const maximum = Math.max(0, (viewportSize * (scale - 1)) / 2)
  return {
    x: Math.min(Math.max(pan.x, -maximum), maximum),
    y: Math.min(Math.max(pan.y, -maximum), maximum),
  }
}

function markerRadius(
  screenPixels: number,
  scale: number,
  viewportSize: number,
  model: { bounds: MapBounds }
) {
  return (
    (screenPixels * model.bounds.width) /
    Math.max(viewportSize, 320) /
    Math.max(scale, MAP_ZOOM_MIN)
  )
}

function projectZone(
  zone: ReplayZone | null | undefined,
  model: ReturnType<typeof createMapModel>
) {
  if (!zone) return null
  const point = model.projectPoint(zone)
  return { ...point, radius: model.projectRadius(zone.radius) }
}

function MapEventButton({
  event,
  model,
  onSelect,
}: {
  event: MatchAnalysis["timeline"][number]
  model: ReturnType<typeof createMapModel>
  onSelect: (event: MatchAnalysis["timeline"][number]) => void
}) {
  if (!event.location) return null
  const point = model.projectPoint(event.location)
  const left = (point.x - model.bounds.minX) / model.bounds.width
  const top = (point.y - model.bounds.minY) / model.bounds.height
  if (left < 0 || left > 1 || top < 0 || top > 1) return null

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
      onClick={(clickEvent) => {
        clickEvent.stopPropagation()
        onSelect(event)
      }}
    >
      <span className="sr-only">{event.message}</span>
    </Button>
  )
}

export function ReplayMap({
  mapName,
  analysis,
  currentFrame,
  currentTime,
  selectedPlayerId,
  visibleTimelineLayers,
  visibleLayers,
  onVisibleLayersChange,
  onEventSelect,
  onPlayerSelect,
}: {
  mapName: string
  analysis: MatchAnalysis
  currentFrame: ReplayFrame | null
  currentTime: number
  selectedPlayerId: string
  visibleTimelineLayers: ReplayTimelineLayer[]
  visibleLayers: ReplayMapLayer[]
  onVisibleLayersChange: (layers: ReplayMapLayer[]) => void
  onEventSelect: (event: MatchAnalysis["timeline"][number]) => void
  onPlayerSelect: (playerId: string) => void
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const panRef = React.useRef<{
    startX: number
    startY: number
    pan: MapPan
  } | null>(null)
  const [viewportSize, setViewportSize] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const [mapScale, setMapScale] = React.useState(MAP_ZOOM_MIN)
  const [mapPan, setMapPan] = React.useState<MapPan>({ x: 0, y: 0 })
  const model = React.useMemo(
    () => createMapModel(analysis, mapName),
    [analysis, mapName]
  )
  const states = React.useMemo(
    () => currentStates(currentFrame),
    [currentFrame]
  )
  const vehicles = React.useMemo(
    () =>
      new Map(
        currentFrame?.vehicles?.map((vehicle) => [vehicle.playerIndex, vehicle]) ??
          []
      ),
    [currentFrame]
  )
  const targetIndex = analysis.replayPlayers.findIndex(
    (player) => player.id === analysis.playerId
  )
  const selectedIndex = analysis.replayPlayers.findIndex(
    (player) => player.id === selectedPlayerId
  )
  const targetTeamId = analysis.replayPlayers[targetIndex]?.teamId
  const trackedPlayer = analysis.replayPlayers[targetIndex]
  const showFlightPath = visibleLayers.includes("flightPath")
  const showTrajectory = visibleLayers.includes("trajectory")
  const showZones = visibleLayers.includes("zones")
  const showEvents = visibleLayers.includes("events")
  const showEliminated = visibleLayers.includes("eliminated")
  const showStateMarkers = visibleTimelineLayers.includes("state")
  const visibleTime = currentFrame?.elapsedSeconds ?? currentTime
  const firstReplayFrameTime = analysis.replayFrames[0]?.elapsedSeconds
  const beforeReplayData =
    firstReplayFrameTime !== undefined && currentTime < firstReplayFrameTime

  React.useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const updateSize = () => {
      const nextSize = Math.min(element.clientWidth, element.clientHeight)
      setViewportSize(nextSize)
      setMapPan((pan) => clampPan(pan, mapScale, nextSize))
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [mapScale])

  const screenToMap = React.useCallback(
    (pixels: number) => markerRadius(pixels, mapScale, viewportSize, model),
    [mapScale, model, viewportSize]
  )

  const zoomAt = React.useCallback(
    (direction: 1 | -1, anchor?: { x: number; y: number }) => {
      const previousScale = mapScale
      const nextScale = Math.min(
        MAP_ZOOM_MAX,
        Math.max(
          MAP_ZOOM_MIN,
          previousScale *
            (direction > 0 ? MAP_ZOOM_FACTOR : 1 / MAP_ZOOM_FACTOR)
        )
      )
      if (nextScale === previousScale) return
      const center = viewportSize / 2
      const focus = anchor ?? { x: center, y: center }
      const ratio = nextScale / previousScale
      setMapPan(
        clampPan(
          {
            x: mapPan.x + (focus.x - center) * (1 - ratio),
            y: mapPan.y + (focus.y - center) * (1 - ratio),
          },
          nextScale,
          viewportSize
        )
      )
      setMapScale(nextScale)
    },
    [mapPan, mapScale, viewportSize]
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (
      event.target instanceof Element &&
      event.target.closest("[data-map-event-marker], [data-map-control]")
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
    const nextPan = {
      x: panRef.current.pan.x + event.clientX - panRef.current.startX,
      y: panRef.current.pan.y + event.clientY - panRef.current.startY,
    }
    setMapPan(clampPan(nextPan, mapScale, viewportSize))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    panRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.deltaY === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    zoomAt(event.deltaY < 0 ? 1 : -1, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const flightPath = React.useMemo(() => {
    const points = analysis.flightPath.map(model.projectPoint)
    if (points.length < 2) return points
    return (
      extendLineToBounds(points[0]!, points.at(-1)!, model.bounds) ?? points
    )
  }, [analysis.flightPath, model])
  const flightPathString = flightPath
    .map((point) => `${point.x},${point.y}`)
    .join(" ")

  const trackedPath = React.useMemo(() => {
    if (targetIndex < 0) return ""
    const points: string[] = []
    for (const frame of analysis.replayFrames) {
      if (frame.elapsedSeconds > visibleTime) break
      const player = frame.players.find(
        ([playerIndex]) => playerIndex === targetIndex
      )
      if (!player) continue
      const point = model.projectPoint({ x: player[1], y: player[2] })
      const value = `${point.x},${point.y}`
      if (points.at(-1) !== value) points.push(value)
    }
    const currentPlayer = currentFrame?.players.find(
      ([playerIndex]) => playerIndex === targetIndex
    )
    if (currentPlayer) {
      const point = model.projectPoint({
        x: currentPlayer[1],
        y: currentPlayer[2],
      })
      const value = `${point.x},${point.y}`
      if (points.at(-1) !== value) points.push(value)
    }
    return points.join(" ")
  }, [analysis.replayFrames, currentFrame, model, targetIndex, visibleTime])

  const currentZones =
    currentFrame && isReplayZoneActive(currentFrame)
      ? currentFrame.zones
      : undefined
  const projectedZones = {
    bluezone: projectZone(currentZones?.bluezone, model),
    safezone: projectZone(currentZones?.safezone, model),
    redzone: projectZone(currentZones?.redzone, model),
    blackzone: projectZone(currentZones?.blackzone, model),
  }
  const firstZoneFrame = analysis.replayFrames.find(
    (frame) =>
      isReplayZoneActive(frame) &&
      Object.values(frame.zones ?? {}).some(Boolean)
  )
  const visibleKills = analysis.timeline.filter(
    (event) =>
      isEliminationEvent(event) &&
      (event.elapsedSeconds === undefined ||
        event.elapsedSeconds <= visibleTime)
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
  const visibleCarePackageEvents = analysis.timeline.filter(
    (event) =>
      event.type.includes("CarePackage") &&
      event.location &&
      (event.elapsedSeconds === undefined ||
        event.elapsedSeconds <= visibleTime)
  )
  const carePackageEvents = analysis.carePackages?.length
    ? analysis.carePackages
    : visibleCarePackageEvents.flatMap((event, index) => {
        if (!event.location || event.elapsedSeconds === undefined) return []
        const state =
          event.type === "LogCarePackageSpawn" ? "spawned" : "landed"
        return [
          {
            key: index,
            state,
            elapsedSeconds: event.elapsedSeconds,
            location: event.location,
            ...(event.items ? { items: event.items } : {}),
          } satisfies ReplayCarePackageEvent,
        ]
      })
  const activeCarePackages = activeCarePackagesAtTime(
    carePackageEvents,
    visibleTime
  )
  const activeTracers = analysis.timeline.filter(
    (event) =>
      visibleTimelineLayers.includes("damage") &&
      event.type.includes("Damage") &&
      event.location &&
      event.targetLocation &&
      event.elapsedSeconds !== undefined &&
      currentTime >= event.elapsedSeconds - 3.5 &&
      currentTime <= event.elapsedSeconds + 0.35
  )
  const mapEvents = [
    ...(visibleTimelineLayers.includes("kills") ? visibleKills : []),
    ...(visibleTimelineLayers.includes("damage") ? visibleDamage : []),
    ...(visibleTimelineLayers.includes("attacks") ? visibleAttacks : []),
    ...(visibleTimelineLayers.includes("state")
      ? visibleCarePackageEvents
      : []),
  ]
  const visiblePlayers = Array.from(states.entries())
    .map(([playerIndex, state]) => ({
      playerIndex,
      state,
      player: analysis.replayPlayers[playerIndex],
    }))
    .filter(
      (
        entry
      ): entry is {
        playerIndex: number
        state: ReplayFramePlayer
        player: NonNullable<MatchAnalysis["replayPlayers"][number]>
      } => Boolean(entry.player)
    )
    .sort((left, right) => {
      const rank = (entry: {
        playerIndex: number
        state: ReplayFramePlayer
        player: MatchAnalysis["replayPlayers"][number]
      }) =>
        entry.playerIndex === targetIndex
          ? 4
          : entry.playerIndex === selectedIndex
            ? 3
            : entry.player.teamId === targetTeamId
              ? 2
              : entry.state[3] === "dead"
                ? 0
                : 1
      return rank(left) - rank(right)
    })
  const hasCurrentZones = Object.values(projectedZones).some(Boolean)
  const mapLabel = MAP_LABELS[mapName] ?? mapName
  const mapTransform = `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapScale})`

  return (
    <div
      ref={viewportRef}
      className="relative aspect-square overflow-hidden rounded-xl border bg-muted/30"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: "none" }}
    >
      <div
        className="absolute inset-0 select-none"
        style={{
          transform: mapTransform,
          transformOrigin: "center",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <svg
          viewBox={`${model.bounds.minX} ${model.bounds.minY} ${model.bounds.width} ${model.bounds.height}`}
          className="absolute inset-0 size-full"
          role="img"
          aria-label={`${mapLabel}比赛回放地图`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="replay-flight-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
            <pattern
              id="replay-grid"
              width={model.bounds.width / 12}
              height={model.bounds.height / 12}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${model.bounds.width / 12} 0 L 0 0 0 ${model.bounds.height / 12}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.10"
                strokeWidth="0.7"
              />
            </pattern>
          </defs>
          {model.assetUrl ? (
            <image
              href={model.assetUrl}
              x={model.bounds.minX}
              y={model.bounds.minY}
              width={model.bounds.width}
              height={model.bounds.height}
              preserveAspectRatio="none"
              opacity="0.86"
            />
          ) : null}
          <rect
            x={model.bounds.minX}
            y={model.bounds.minY}
            width={model.bounds.width}
            height={model.bounds.height}
            fill="url(#replay-grid)"
          />
          <rect
            x={model.bounds.minX}
            y={model.bounds.minY}
            width={model.bounds.width}
            height={model.bounds.height}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
          {showFlightPath && flightPath.length > 1 ? (
            <g>
              <title>起始航线，已延伸到地图边界</title>
              <polyline
                points={flightPathString}
                fill="none"
                stroke="#f59e0b"
                strokeOpacity="0.95"
                strokeWidth={screenToMap(2.5)}
                strokeDasharray={`${screenToMap(10)} ${screenToMap(8)}`}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd="url(#replay-flight-arrow)"
              />
              <circle
                cx={flightPath[0]!.x}
                cy={flightPath[0]!.y}
                r={screenToMap(7)}
                fill="#f59e0b"
                stroke="var(--background)"
                strokeWidth={screenToMap(1.5)}
              />
              <circle
                cx={flightPath.at(-1)!.x}
                cy={flightPath.at(-1)!.y}
                r={screenToMap(7)}
                fill="var(--background)"
                stroke="#f59e0b"
                strokeWidth={screenToMap(2)}
              />
            </g>
          ) : null}
          {showZones && projectedZones.redzone ? (
            <circle
              cx={projectedZones.redzone.x}
              cy={projectedZones.redzone.y}
              r={projectedZones.redzone.radius}
              fill="none"
              stroke="#ef4444"
              strokeOpacity="0.9"
              strokeWidth={screenToMap(2)}
              strokeDasharray={`${screenToMap(7)} ${screenToMap(9)}`}
            >
              <title>红区</title>
            </circle>
          ) : null}
          {showZones && projectedZones.blackzone ? (
            <circle
              cx={projectedZones.blackzone.x}
              cy={projectedZones.blackzone.y}
              r={projectedZones.blackzone.radius}
              fill="none"
              stroke="#a855f7"
              strokeOpacity="0.9"
              strokeWidth={screenToMap(2)}
              strokeDasharray={`${screenToMap(5)} ${screenToMap(8)}`}
            >
              <title>特殊区</title>
            </circle>
          ) : null}
          {showZones && projectedZones.bluezone ? (
            <circle
              cx={projectedZones.bluezone.x}
              cy={projectedZones.bluezone.y}
              r={projectedZones.bluezone.radius}
              fill="none"
              stroke="#60a5fa"
              strokeOpacity="0.95"
              strokeWidth={screenToMap(2)}
            >
              <title>蓝圈</title>
            </circle>
          ) : null}
          {showZones && projectedZones.safezone ? (
            <g>
              <title>白圈</title>
              <circle
                cx={projectedZones.safezone.x}
                cy={projectedZones.safezone.y}
                r={projectedZones.safezone.radius}
                fill="none"
                stroke="var(--background)"
                strokeOpacity="0.85"
                strokeWidth={screenToMap(5)}
              />
              <circle
                cx={projectedZones.safezone.x}
                cy={projectedZones.safezone.y}
                r={projectedZones.safezone.radius}
                fill="none"
                stroke="white"
                strokeOpacity="0.98"
                strokeWidth={screenToMap(2.5)}
              />
            </g>
          ) : null}
          {showTrajectory && trackedPath ? (
            <polyline
              points={trackedPath}
              fill="none"
              stroke="#22d3ee"
              strokeOpacity="0.8"
              strokeWidth={screenToMap(2.5)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {showEvents && visibleTimelineLayers.includes("kills")
            ? visibleKills.map((event, index) => {
                if (!event.location) return null
                const point = model.projectPoint(event.location)
                const color =
                  event.actor === analysis.playerId
                    ? "var(--destructive)"
                    : "var(--chart-5)"
                return (
                  <g key={`kill-${event.timestamp}-${index}`}>
                    <title>{event.message}</title>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={screenToMap(13)}
                      fill={color}
                      fillOpacity="0.14"
                      stroke={color}
                      strokeWidth={screenToMap(1.5)}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={screenToMap(3.5)}
                      fill={color}
                    />
                  </g>
                )
              })
            : null}
          {showEvents && visibleTimelineLayers.includes("damage")
            ? visibleDamage.map((event, index) => {
                if (!event.location) return null
                const point = model.projectPoint(event.location)
                return (
                  <circle
                    key={`damage-${event.timestamp}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={screenToMap(3.5)}
                    fill="var(--chart-3)"
                    fillOpacity="0.85"
                    stroke="var(--background)"
                    strokeWidth={screenToMap(1)}
                  >
                    <title>{event.message}</title>
                  </circle>
                )
              })
            : null}
          {showEvents && visibleTimelineLayers.includes("attacks")
            ? visibleAttacks.map((event, index) => {
                if (!event.location) return null
                const point = model.projectPoint(event.location)
                const size = screenToMap(5)
                return (
                  <path
                    key={`attack-${event.timestamp}-${index}`}
                    d={`M ${point.x - size} ${point.y} H ${point.x + size} M ${point.x} ${point.y - size} V ${point.y + size}`}
                    stroke="var(--chart-1)"
                    strokeOpacity="0.9"
                    strokeWidth={screenToMap(1.5)}
                    strokeLinecap="round"
                  >
                    <title>{event.message}</title>
                  </path>
                )
              })
            : null}
          {showEvents
            ? activeTracers.map((event, index) => {
                if (
                  !event.location ||
                  !event.targetLocation ||
                  event.elapsedSeconds === undefined
                ) {
                  return null
                }
                const start = model.projectPoint(event.location)
                const end = model.projectPoint(event.targetLocation)
                const progress = Math.min(
                  1,
                  Math.max(0, (currentTime - event.elapsedSeconds + 3.5) / 3.5)
                )
                const tailProgress = Math.max(0, progress - 0.16)
                const from = {
                  x: start.x + (end.x - start.x) * tailProgress,
                  y: start.y + (end.y - start.y) * tailProgress,
                }
                const to = {
                  x: start.x + (end.x - start.x) * progress,
                  y: start.y + (end.y - start.y) * progress,
                }
                return (
                  <line
                    key={`tracer-${event.timestamp}-${index}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="white"
                    strokeOpacity="0.95"
                    strokeWidth={screenToMap(2.5)}
                    strokeLinecap="round"
                  />
                )
              })
            : null}
          {showEvents && visibleTimelineLayers.includes("state")
            ? activeCarePackages.map((carePackage) => {
                const point = model.projectPoint(carePackage.location)
                const isFlying = carePackage.state === "spawned"
                const width = screenToMap(18)
                const height = screenToMap(isFlying ? 32 : 17)
                const anchorOffset = screenToMap(isFlying ? 23 : 8)
                return (
                  <g key={`care-package-${carePackage.key}`}>
                    <title>
                      {isFlying ? "补给箱下降中" : "补给箱已落地"}
                    </title>
                    <image
                      href={
                        isFlying
                          ? CARE_PACKAGE_ASSET_PATHS.flying
                          : CARE_PACKAGE_ASSET_PATHS.normal
                      }
                      x={point.x - width / 2}
                      y={point.y - anchorOffset}
                      width={width}
                      height={height}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                )
              })
            : null}
          {visiblePlayers.map(({ playerIndex, state, player }) => {
            const isTarget = playerIndex === targetIndex
            const isSelected = playerIndex === selectedIndex
            const isTeammate =
              !isTarget &&
              targetTeamId !== undefined &&
              player.teamId === targetTeamId
            if (
              state[3] === "dead" &&
              !showEliminated &&
              !isTarget &&
              !isSelected
            ) {
              return null
            }
            const point = model.projectPoint({ x: state[1], y: state[2] })
            const vehicle = vehicles.get(playerIndex)
            const markerScale = Math.min(
              2.8,
              1 + Math.log2(Math.max(mapScale, 1)) * 0.32
            )
            const radius = markerRadius(
              (isTarget ? 13 : isSelected ? 11 : 9) * markerScale,
              mapScale,
              viewportSize,
              model
            )
            const health = healthPercentage(state[4])
            const healthRadius = radius * 1.22
            const circumference = 2 * Math.PI * healthRadius
            const healthArc =
              health === undefined ? 0 : circumference * (health / 100)
            const label =
              player.teamId === undefined ? "?" : String(player.teamId)
            const labelSize = markerRadius(
              isTarget || isSelected ? 10 : 8,
              mapScale,
              viewportSize,
              model
            )
            return (
              <g
                key={player.id}
                style={{ cursor: "pointer" }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onPlayerSelect(player.id)
                }}
              >
                <title>
                  {player.name} · 队 {label} · {statusLabels[state[3]]}
                </title>
                {isTarget || isSelected ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius * 1.8}
                    fill="none"
                    stroke={isTarget ? "var(--chart-1)" : "var(--chart-4)"}
                    strokeOpacity="0.75"
                    strokeWidth={markerRadius(2, mapScale, viewportSize, model)}
                  />
                ) : null}
                {isTeammate ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius * 1.65}
                    fill="none"
                    stroke="var(--chart-2)"
                    strokeOpacity="0.8"
                    strokeWidth={markerRadius(
                      1.5,
                      mapScale,
                      viewportSize,
                      model
                    )}
                    strokeDasharray={`${markerRadius(7, mapScale, viewportSize, model)} ${markerRadius(6, mapScale, viewportSize, model)}`}
                  />
                ) : null}
                {showStateMarkers && vehicle ? (
                  <rect
                    x={point.x - radius * 1.3}
                    y={point.y - radius * 1.3}
                    width={radius * 2.6}
                    height={radius * 2.6}
                    rx={radius * 0.3}
                    fill="none"
                    stroke={teamMarkerColor(player.teamId)}
                    strokeOpacity={state[3] === "dead" ? 0.35 : 0.95}
                    strokeWidth={markerRadius(
                      1.5,
                      mapScale,
                      viewportSize,
                      model
                    )}
                  >
                    <title>载具移动：{vehicle.vehicleType}</title>
                  </rect>
                ) : null}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={
                    player.teamId === undefined
                      ? statusColors[state[3]]
                      : teamMarkerColor(player.teamId)
                  }
                  fillOpacity={state[3] === "dead" ? 0.45 : 0.96}
                  stroke="var(--background)"
                  strokeWidth={markerRadius(1.5, mapScale, viewportSize, model)}
                />
                {health !== undefined ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={healthRadius}
                    fill="none"
                    stroke="var(--background)"
                    strokeOpacity="0.72"
                    strokeWidth={markerRadius(2, mapScale, viewportSize, model)}
                  />
                ) : null}
                {health !== undefined && healthArc > 0 ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={healthRadius}
                    fill="none"
                    stroke={healthColor(health)}
                    strokeWidth={markerRadius(2, mapScale, viewportSize, model)}
                    strokeDasharray={`${healthArc} ${circumference - healthArc}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${point.x} ${point.y})`}
                  />
                ) : null}
                <text
                  x={point.x}
                  y={point.y + labelSize * 0.35}
                  fill="var(--background)"
                  fontSize={labelSize}
                  fontWeight="700"
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="var(--foreground)"
                  strokeOpacity="0.55"
                  strokeWidth={markerRadius(0.8, mapScale, viewportSize, model)}
                >
                  {label}
                </text>
                {isTarget || isSelected ? (
                  <text
                    x={point.x}
                    y={point.y - radius * 2.1}
                    fill="currentColor"
                    fontSize={labelSize * 1.1}
                    fontWeight="600"
                    textAnchor="middle"
                    paintOrder="stroke"
                    stroke="var(--background)"
                    strokeWidth={markerRadius(2, mapScale, viewportSize, model)}
                  >
                    {player.name}
                  </text>
                ) : null}
              </g>
            )
          })}
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
                  model={model}
                  onSelect={onEventSelect}
                />
              ))
            : null}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <Badge variant="secondary" className="bg-background/85">
          {mapLabel} · 战术回放
        </Badge>
        <div className="flex flex-wrap justify-end gap-2">
          {trackedPlayer ? (
            <Badge variant="outline" className="bg-background/85">
              跟踪：{trackedPlayer.name}
            </Badge>
          ) : null}
          {analysis.flightPath.length > 1 ? (
            <Badge variant="outline" className="bg-background/85">
              航线贯穿地图
            </Badge>
          ) : null}
          {beforeReplayData ? (
            <Badge variant="outline" className="bg-background/85">
              位置数据从 T+{formatTime(firstReplayFrameTime!)} 开始
            </Badge>
          ) : trackedPath ? (
            <Badge variant="outline" className="bg-background/85">
              轨迹 {trackedPath.split(" ").length} 点
            </Badge>
          ) : null}
          <Badge variant="outline" className="bg-background/85">
            {hasCurrentZones
              ? `圈层 ${currentFrame?.phase ? formatPhase(currentFrame.phase) : "已加载"}`
              : firstZoneFrame
                ? `首个圈层 T+${formatTime(firstZoneFrame.elapsedSeconds)}`
                : "暂无圈层数据"}
          </Badge>
          <Badge variant="outline" className="bg-background/85">
            T+{formatTime(currentTime)} · {mapScale.toFixed(1)}x
          </Badge>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-12 flex items-center justify-between gap-2">
        <ToggleGroup
          multiple
          value={visibleLayers}
          onValueChange={(value) =>
            onVisibleLayersChange(value as ReplayMapLayer[])
          }
          variant="outline"
          size="sm"
          aria-label="切换回放地图图层"
          data-map-control="true"
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
          <ToggleGroupItem value="eliminated" aria-label="切换淘汰玩家">
            淘汰玩家
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div
        data-map-control="true"
        className="absolute right-3 bottom-12 flex flex-col gap-1"
      >
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="放大地图"
          onClick={() => zoomAt(1)}
        >
          <PlusIcon data-icon="inline-start" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="缩小地图"
          onClick={() => zoomAt(-1)}
        >
          <MinusIcon data-icon="inline-start" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          aria-label="重置地图缩放"
          onClick={() => {
            setMapScale(MAP_ZOOM_MIN)
            setMapPan({ x: 0, y: 0 })
          }}
        >
          <Maximize2Icon data-icon="inline-start" />
        </Button>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {analysis.flightPath.length > 1 ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/85 px-2 py-1">
            <span className="h-0 w-4 border-t-2 border-dashed border-amber-400" />
            起始航线（已延伸到边界）
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
        </span>
        <span className="rounded-md border bg-background/85 px-2 py-1">
          滚轮缩放 · 拖拽平移 · 人物数字=战队编号 · 颜色=战队
        </span>
      </div>
    </div>
  )
}
