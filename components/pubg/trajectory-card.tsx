import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MatchAnalysis } from "@/lib/pubg/types"

export function TrajectoryCard({ analysis }: { analysis: MatchAnalysis }) {
  const points = analysis.trajectory
  const maxX = Math.max(...points.map((point) => point.x), 1)
  const minX = Math.min(...points.map((point) => point.x), 0)
  const maxY = Math.max(...points.map((point) => point.y), 1)
  const minY = Math.min(...points.map((point) => point.y), 0)
  const rangeX = Math.max(maxX - minX, 1)
  const rangeY = Math.max(maxY - minY, 1)
  const svgPoints = points
    .map((point) => {
      const x = 12 + ((point.x - minX) / rangeX) * 376
      const y = 188 - ((point.y - minY) / rangeY) * 176
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  const first = svgPoints.split(" ")[0]?.split(",")
  const last = svgPoints.split(" ").at(-1)?.split(",")

  return (
    <Card id="analysis">
      <CardHeader>
        <CardTitle>移动轨迹</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length > 1 ? (
          <div className="rounded-lg border bg-muted/20 p-2">
            <svg
              viewBox="0 0 400 200"
              className="h-64 w-full"
              role="img"
              aria-label="玩家移动轨迹"
            >
              <path
                d="M12 188H388M12 12V188"
                stroke="currentColor"
                strokeOpacity="0.12"
              />
              <polyline
                points={svgPoints}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={first?.[0]}
                cy={first?.[1]}
                r="4"
                fill="var(--chart-2)"
              />
              <circle
                cx={last?.[0]}
                cy={last?.[1]}
                r="4"
                fill="var(--chart-1)"
              />
            </svg>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            没有足够的遥测位置点来绘制轨迹。
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          轨迹已降采样保存，仅用于比赛复盘，不保留原始遥测。
        </p>
      </CardContent>
    </Card>
  )
}
