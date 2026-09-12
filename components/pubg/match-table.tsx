import Link from "next/link"
import { ArrowUpRightIcon, CrosshairIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MatchSummary, Platform } from "@/lib/pubg/types"

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export function MatchTable({
  matches,
  platform,
  playerId,
}: {
  matches: MatchSummary[]
  platform: Platform
  playerId: string
}) {
  return (
    <Card id="matches">
      <CardHeader>
        <CardTitle>近期比赛</CardTitle>
        <CardDescription>
          选择一场比赛进入独立回放，按时间查看移动轨迹与事件。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            暂无可用的近期比赛。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>地图 / 模式</TableHead>
                <TableHead>排名</TableHead>
                <TableHead>击杀</TableHead>
                <TableHead>遥测</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {match.startedAt
                      ? dateFormatter.format(new Date(match.startedAt))
                      : "未知"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{match.mapName}</div>
                    <div className="text-xs text-muted-foreground">
                      {match.gameMode}
                    </div>
                  </TableCell>
                  <TableCell>
                    {match.targetPlayerRank
                      ? `#${match.targetPlayerRank}`
                      : "-"}
                  </TableCell>
                  <TableCell>{match.targetPlayerKills}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        match.telemetryAvailable ? "secondary" : "outline"
                      }
                    >
                      {match.telemetryAvailable ? "可分析" : "无遥测"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link
                          href={`/matches/${match.id}?platform=${platform}&playerId=${encodeURIComponent(playerId)}`}
                        />
                      }
                    >
                      进入回放 <ArrowUpRightIcon data-icon="inline-end" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CrosshairIcon className="size-3.5" />
          <span>比赛数据受 PUBG 官方 14 天保留期限制。</span>
        </div>
      </CardContent>
    </Card>
  )
}
