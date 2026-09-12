"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  Clock3Icon,
  CrosshairIcon,
  UsersIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TrajectoryCard } from "@/components/pubg/trajectory-card"
import type {
  ApiError,
  MatchAnalysis,
  MatchSummary,
  Platform,
} from "@/lib/pubg/types"

export function MatchAnalysisPage({ matchId }: { matchId: string }) {
  const [{ platform, playerId }] = React.useState(() => {
    if (typeof window === "undefined")
      return { platform: "steam" as Platform, playerId: "" }
    const params = new URLSearchParams(window.location.search)
    const nextPlatform = params.get("platform")
    return {
      platform:
        nextPlatform === "steam" ||
        nextPlatform === "kakao" ||
        nextPlatform === "psn" ||
        nextPlatform === "xbox"
          ? nextPlatform
          : ("steam" as Platform),
      playerId: params.get("playerId") ?? "",
    }
  })
  const [match, setMatch] = React.useState<MatchSummary | null>(null)
  const [analysis, setAnalysis] = React.useState<MatchAnalysis | null>(null)
  const [error, setError] = React.useState<ApiError["error"] | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!playerId) {
      return
    }
    let cancelled = false
    async function load() {
      setError(null)
      try {
        const matchResponse = await fetch(
          `/api/matches/${encodeURIComponent(matchId)}?platform=${platform}&playerId=${encodeURIComponent(playerId)}`,
          { cache: "no-store" }
        )
        const matchPayload = (await matchResponse.json()) as
          MatchSummary | ApiError
        if (!matchResponse.ok || "error" in matchPayload) {
          throw "error" in matchPayload
            ? matchPayload.error
            : { code: "match_not_found", message: "比赛不存在。" }
        }
        const telemetryResponse = await fetch(
          `/api/matches/${encodeURIComponent(matchId)}/telemetry?platform=${platform}&playerId=${encodeURIComponent(playerId)}`,
          { cache: "no-store" }
        )
        const telemetryPayload = (await telemetryResponse.json()) as
          MatchAnalysis | ApiError
        if (!telemetryResponse.ok || "error" in telemetryPayload) {
          throw "error" in telemetryPayload
            ? telemetryPayload.error
            : { code: "telemetry_unavailable", message: "遥测不可用。" }
        }
        if (!cancelled) {
          setMatch(matchPayload)
          setAnalysis(telemetryPayload)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            typeof cause === "object" && cause && "code" in cause
              ? (cause as ApiError["error"])
              : { code: "upstream_error", message: "比赛加载失败。" }
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [matchId, platform, playerId])

  return (
    <div className="min-h-svh bg-muted/20 p-4 lg:p-8">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Button variant="ghost" className="w-fit" render={<Link href="/" />}>
          <ArrowLeftIcon data-icon="inline-start" /> 返回战绩概览
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">比赛分析</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {match?.mapName ?? "比赛详情"}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {matchId}
          </p>
        </div>
        {playerId && loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <CrosshairIcon />
            <AlertTitle>比赛分析不可用</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        {match && analysis ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    比赛结果
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {match.targetPlayerRank
                    ? `第 ${match.targetPlayerRank} 名`
                    : "-"}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    击杀 / 事件
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {analysis.kills.length}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {analysis.timeline.length}
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    比赛信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <Clock3Icon data-icon="inline-start" />{" "}
                    {Math.round(match.durationSeconds / 60)} 分钟
                  </Badge>
                  <Badge variant="outline">
                    <UsersIcon data-icon="inline-start" />{" "}
                    {match.participantCount} 人
                  </Badge>
                </CardContent>
              </Card>
            </div>
            <TrajectoryCard analysis={analysis} />
            <Card>
              <CardHeader>
                <CardTitle>参赛者</CardTitle>
              </CardHeader>
              <CardContent>
                {match.participants.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>排名</TableHead>
                        <TableHead>玩家</TableHead>
                        <TableHead>击杀</TableHead>
                        <TableHead>伤害</TableHead>
                        <TableHead>生存时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {match.participants.map((participant) => (
                        <TableRow key={participant.id}>
                          <TableCell>
                            {participant.rank ? `#${participant.rank}` : "-"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {participant.name}
                          </TableCell>
                          <TableCell>{participant.kills}</TableCell>
                          <TableCell>{participant.damage.toFixed(0)}</TableCell>
                          <TableCell>
                            {Math.round(participant.survivalTime / 60)} 分钟
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>没有参赛者摘要</EmptyTitle>
                      <EmptyDescription>
                        官方接口没有返回可展示的参赛者信息。
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>事件时间线</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.timeline.length ? (
                  <div className="space-y-0">
                    {analysis.timeline.map((event, index) => (
                      <React.Fragment
                        key={`${event.type}-${event.timestamp}-${index}`}
                      >
                        <div className="flex gap-3 py-3">
                          <Badge
                            variant={
                              event.type.includes("Kill")
                                ? "default"
                                : "outline"
                            }
                          >
                            {event.type.replace("LogPlayer", "")}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">{event.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {event.timestamp
                                ? new Date(event.timestamp).toLocaleTimeString(
                                    "zh-CN"
                                  )
                                : "未知时间"}
                            </p>
                          </div>
                        </div>
                        {index < analysis.timeline.length - 1 ? (
                          <Separator />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    没有可展示的事件。
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
        {!loading && !error && !playerId ? (
          <Alert>
            <AlertTitle>缺少目标玩家</AlertTitle>
            <AlertDescription>
              请从战绩概览中的近期比赛进入分析页面。
            </AlertDescription>
          </Alert>
        ) : null}
      </main>
    </div>
  )
}
