"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { SeasonStats } from "@/lib/pubg/types"

const chartConfig = {
  value: { label: "数值", color: "var(--chart-1)" },
} satisfies ChartConfig

export function StatsChart({ stats }: { stats: SeasonStats }) {
  const data = [
    { metric: "击杀", value: stats.kills },
    { metric: "胜场", value: stats.wins },
    { metric: "助攻", value: stats.assists },
    { metric: "场次", value: stats.rounds },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>赛季核心数据</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ left: -20, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="metric"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
