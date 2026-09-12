"use client"

import * as React from "react"
import {
  ActivityIcon,
  CrosshairIcon,
  Gamepad2Icon,
  ShieldCheckIcon,
  TrophyIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MatchTable } from "@/components/pubg/match-table"
import { PlayerSearch } from "@/components/pubg/player-search"
import { StatCard } from "@/components/pubg/stat-card"
import { StatsChart } from "@/components/pubg/stats-chart"
import type {
  ApiError,
  GameMode,
  MatchSummary,
  Platform,
  PlayerSummary,
  SeasonSummary,
  SeasonStats,
} from "@/lib/pubg/types"

const modes: Array<{ value: GameMode; label: string }> = [
  { value: "solo", label: "单排" },
  { value: "solo-fpp", label: "单排 FPP" },
  { value: "duo", label: "双排" },
  { value: "duo-fpp", label: "双排 FPP" },
  { value: "squad", label: "四排" },
  { value: "squad-fpp", label: "四排 FPP" },
]

function apiErrorFrom(cause: unknown): ApiError["error"] {
  return typeof cause === "object" && cause && "code" in cause
    ? (cause as ApiError["error"])
    : { code: "upstream_error", message: "服务暂时不可用，请稍后再试。" }
}

export function PubgDashboard() {
  const [name, setName] = React.useState("")
  const [platform, setPlatform] = React.useState<Platform>("steam")
  const [gameMode, setGameMode] = React.useState<GameMode>("squad")
  const [player, setPlayer] = React.useState<PlayerSummary | null>(null)
  const [stats, setStats] = React.useState<SeasonStats | null>(null)
  const [matches, setMatches] = React.useState<MatchSummary[]>([])
  const [seasons, setSeasons] = React.useState<SeasonSummary[]>([])
  const [error, setError] = React.useState<ApiError["error"] | null>(null)
  const [loading, setLoading] = React.useState(false)

  const loadStats = React.useCallback(
    async (playerId: string, mode: GameMode, season = "current") => {
      try {
        const statsResponse = await fetch(
          `/api/players/${encodeURIComponent(playerId)}/stats?platform=${platform}&season=${encodeURIComponent(season)}&gameMode=${mode}`,
          { cache: "no-store" }
        )
        const statsPayload = (await statsResponse.json()) as
          SeasonStats | ApiError
        if (!statsResponse.ok || "error" in statsPayload) {
          throw "error" in statsPayload
            ? statsPayload.error
            : { code: "upstream_error", message: "统计查询失败。" }
        }
        setStats(statsPayload)
      } catch (cause) {
        setStats(null)
        setError(apiErrorFrom(cause))
      }
    },
    [platform]
  )

  const query = React.useCallback(async () => {
    if (name.trim().length < 2) {
      setError({
        code: "invalid_request",
        message: "请输入至少 2 个字符的玩家名称。",
      })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const playerResponse = await fetch(
        `/api/players?platform=${platform}&name=${encodeURIComponent(name.trim())}`,
        { cache: "no-store" }
      )
      const playerPayload = (await playerResponse.json()) as {
        player?: PlayerSummary
        recentMatches?: MatchSummary[]
        error?: ApiError["error"]
      }
      if (!playerResponse.ok || !playerPayload.player) {
        throw (
          playerPayload.error ?? {
            code: "upstream_error",
            message: "玩家查询失败。",
          }
        )
      }
      setPlayer(playerPayload.player)
      setMatches(playerPayload.recentMatches ?? [])

      const seasonsResponse = await fetch(`/api/seasons?platform=${platform}`, {
        cache: "no-store",
      })
      const seasonsPayload = (await seasonsResponse.json()) as {
        seasons?: SeasonSummary[]
        error?: ApiError["error"]
      }
      if (!seasonsResponse.ok || !seasonsPayload.seasons?.length) {
        throw (
          seasonsPayload.error ?? {
            code: "upstream_error",
            message: "赛季查询失败。",
          }
        )
      }
      setSeasons(seasonsPayload.seasons)
      const currentSeason =
        seasonsPayload.seasons.find((season) => season.isCurrent) ??
        seasonsPayload.seasons[0]
      await loadStats(playerPayload.player.id, gameMode, currentSeason.id)
    } catch (cause) {
      setStats(null)
      setMatches([])
      setError(apiErrorFrom(cause))
    } finally {
      setLoading(false)
    }
  }, [gameMode, loadStats, name, platform])

  const activeSeasonName =
    seasons.find((season) => season.id === stats?.seasonId)?.displayName ??
    stats?.seasonId

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col bg-muted/20">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:p-6">
            <section id="overview" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    PUBG 战绩查询
                  </h2>
                  <Badge variant="outline">官方 API</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  输入玩家名称，查看赛季表现并复盘最近比赛。
                </p>
              </div>
              <PlayerSearch
                name={name}
                platform={platform}
                loading={loading}
                onNameChange={setName}
                onPlatformChange={setPlatform}
                onSubmit={() => void query()}
              />
            </section>

            {error ? (
              <Alert variant="destructive">
                <ActivityIcon />
                <AlertTitle>查询未完成</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : player && stats ? (
              <>
                <section className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{player.name}</h3>
                        <Badge variant="secondary">
                          {platform.toUpperCase()}
                        </Badge>
                        {stats.source === "cache" ? (
                          <Badge variant="outline">D1 缓存</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        赛季 {activeSeasonName} · {stats.gameMode}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <Select
                        value={stats.seasonId}
                        onValueChange={(value) => {
                          if (value) {
                            setError(null)
                            setLoading(true)
                            void loadStats(player.id, gameMode, value).finally(
                              () => setLoading(false)
                            )
                          }
                        }}
                      >
                        <SelectTrigger
                          aria-label="选择赛季"
                          className="w-full sm:w-52"
                        >
                          <SelectValue placeholder="选择赛季" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {seasons.slice(0, 5).map((season) => (
                              <SelectItem key={season.id} value={season.id}>
                                {season.displayName}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <ToggleGroup
                        multiple={false}
                        value={[gameMode]}
                        onValueChange={(value) => {
                          if (value[0]) {
                            setError(null)
                            setLoading(true)
                            setGameMode(value[0] as GameMode)
                            void loadStats(
                              player.id,
                              value[0] as GameMode,
                              stats.seasonId
                            ).finally(() => setLoading(false))
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-wrap justify-start"
                      >
                        {modes.map((mode) => (
                          <ToggleGroupItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="胜场"
                      value={stats.wins.toLocaleString()}
                      detail={`胜率 ${(stats.winRate * 100).toFixed(1)}%`}
                      icon={TrophyIcon}
                    />
                    <StatCard
                      label="击杀"
                      value={stats.kills.toLocaleString()}
                      detail={`K/D ${stats.deaths ? (stats.kills / stats.deaths).toFixed(2) : "∞"}`}
                      icon={CrosshairIcon}
                    />
                    <StatCard
                      label="场均伤害"
                      value={
                        stats.rounds
                          ? (stats.damage / stats.rounds).toFixed(0)
                          : "0"
                      }
                      detail={`总伤害 ${stats.damage.toLocaleString()}`}
                      icon={ActivityIcon}
                    />
                    <StatCard
                      label="KDA"
                      value={stats.kda.toFixed(2)}
                      detail={`${stats.assists.toLocaleString()} 次助攻`}
                      icon={ShieldCheckIcon}
                    />
                  </div>
                </section>
                <StatsChart stats={stats} />
                <MatchTable
                  matches={matches}
                  platform={platform}
                  playerId={player.id}
                />
              </>
            ) : (
              <Empty className="min-h-[360px] border bg-card">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Gamepad2Icon className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>准备开始查询</EmptyTitle>
                  <EmptyDescription>
                    选择平台并输入玩家名称，开始读取 PUBG 官方战绩。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
