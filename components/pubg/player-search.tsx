"use client"

import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Platform } from "@/lib/pubg/types"

const platforms: Array<{ value: Platform; label: string }> = [
  { value: "steam", label: "Steam" },
  { value: "kakao", label: "Kakao" },
  { value: "psn", label: "PlayStation" },
  { value: "xbox", label: "Xbox" },
]

export function PlayerSearch({
  name,
  platform,
  loading,
  onNameChange,
  onPlatformChange,
  onSubmit,
}: {
  name: string
  platform: Platform
  loading: boolean
  onNameChange: (value: string) => void
  onPlatformChange: (value: Platform) => void
  onSubmit: () => void
}) {
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="player-name">玩家名称</Label>
        <Input
          id="player-name"
          placeholder="输入 PUBG 游戏名，例如 Shroud"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2 sm:w-44">
        <Label htmlFor="platform">平台</Label>
        <Select
          value={platform}
          onValueChange={(value) =>
            value && onPlatformChange(value as Platform)
          }
        >
          <SelectTrigger id="platform" className="w-full">
            <SelectValue placeholder="选择平台" />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="sm:w-28">
        <SearchIcon data-icon="inline-start" />
        {loading ? "查询中…" : "查询战绩"}
      </Button>
    </form>
  )
}
