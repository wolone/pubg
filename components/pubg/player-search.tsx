"use client"

import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
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
      className="flex w-full max-w-3xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Select
          value={platform}
          onValueChange={(value) => {
            if (value) onPlatformChange(value as Platform)
          }}
        >
          <SelectTrigger aria-label="选择平台" className="!h-11 w-full sm:w-36">
            <SelectValue placeholder="选择平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {platforms.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="grid min-w-0 flex-1 gap-2">
          <Label className="sr-only" htmlFor="player-name">
            玩家名称
          </Label>
          <Input
            id="player-name"
            className="h-11 bg-background px-4 text-base"
            placeholder="请输入绝地求生用户名"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="h-11 sm:px-8"
        >
          <SearchIcon data-icon="inline-start" />
          {loading ? "查询中…" : "搜索玩家"}
        </Button>
      </div>
    </form>
  )
}
