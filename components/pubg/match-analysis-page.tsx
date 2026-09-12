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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MatchReplay } from "@/components/pubg/match-replay"
import { SiteHeader } from "@/components/site-header"
import type {
  ApiError,
  MatchAnalysis,
  MatchSummary,
  Platform,
} from "@/lib/pubg/types"

export function MatchAnalysisPage({
  matchId,
  initialPlatform,
  initialPlayerId,
}: {
  matchId: string
  initialPlatform: Platform
  initialPlayerId: string
}) {
  const platform = initialPlatform
  const playerId = initialPlayerId
  const [match, setMatch] = React.useState<MatchSummary | null>(null)
  const [analysis, setAnalysis] = React.useState<MatchAnalysis | null>(null)
  const [error, setError] = React.useState<ApiError["error"] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [retryToken, setRetryToken] = React.useState(0)

  React.useEffect(() => {
    if (!playerId) {
      return
    }
    let cancelled = false
    async function load() {
      setMatch(null)
      setAnalysis(null)
      setError(null)
      setLoading(true)
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
        if (cancelled) return
        setMatch(matchPayload)
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
  }, [matchId, platform, playerId, retryToken])

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader title="比赛回放" active="replay" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-6">
        <Button variant="ghost" className="w-fit" render={<Link href="/" />}>
          <ArrowLeftIcon data-icon="inline-start" /> 返回战绩查询
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">比赛回放</p>
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
            <AlertTitle>
              {match ? "回放遥测加载失败" : "比赛回放不可用"}
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{error.message}</span>
              {match ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => setRetryToken((value) => value + 1)}
                >
                  重试回放
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {match ? (
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
                  {analysis ? (
                    <>
                      {analysis.kills.length}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        / {analysis.timeline.length}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-normal text-muted-foreground">
                      暂无遥测
                    </span>
                  )}
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
            {analysis ? (
              <MatchReplay key={match.id} match={match} analysis={analysis} />
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>参赛者成绩</CardTitle>
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
          </>
        ) : null}
        {!error && !playerId ? (
          <Alert>
            <AlertTitle>缺少目标玩家</AlertTitle>
            <AlertDescription>
              请从战绩查询中的近期比赛进入回放页面。
            </AlertDescription>
          </Alert>
        ) : null}
      </main>
    </div>
  )
}
