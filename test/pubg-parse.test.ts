import { describe, expect, it } from "vitest"

import playerDocument from "@/test/fixtures/player.json"
import seasonsDocument from "@/test/fixtures/seasons.json"
import statsDocument from "@/test/fixtures/stats.json"
import matchDocument from "@/test/fixtures/match.json"
import telemetryDocument from "@/test/fixtures/telemetry.json"
import { PLATFORM_SHARDS } from "@/lib/pubg/client"
import {
  parseMatchDocument,
  parsePlayerDocument,
  parseSeasonStats,
  parseSeasons,
  parseTelemetry,
} from "@/lib/pubg/parse"

describe("PUBG JSON:API parser", () => {
  it("maps all supported platforms to the official shards", () => {
    expect(PLATFORM_SHARDS).toEqual({
      steam: "steam",
      kakao: "kakao",
      psn: "psn",
      xbox: "xbox",
    })
  })

  it("normalizes player and match relationships", () => {
    const player = parsePlayerDocument(playerDocument, "steam", "steam")
    expect(player).toMatchObject({
      id: "account.123",
      name: "TestPlayer",
      recentMatchIds: ["match-001", "match-002"],
    })
  })

  it("detects the current season and calculates season metrics", () => {
    const seasons = parseSeasons(seasonsDocument)
    expect(seasons[0]).toMatchObject({
      id: "division.bro.official.2026-09",
      isCurrent: true,
    })
    const stats = parseSeasonStats(
      statsDocument,
      "steam",
      "account.123",
      seasons[0]!.id,
      "squad"
    )
    expect(stats).toMatchObject({
      kills: 18,
      wins: 2,
      rounds: 10,
      damage: 1840.5,
    })
    expect(stats.winRate).toBe(0.2)
  })

  it("creates readable labels for legacy PUBG season ids", () => {
    const seasons = parseSeasons({
      data: [
        {
          type: "season",
          id: "division.bro.official.pc-2018-43",
          attributes: {},
        },
      ],
    })

    expect(seasons[0]).toMatchObject({
      id: "division.bro.official.pc-2018-43",
      displayName: "第 43 赛季",
    })
  })

  it("normalizes match participants and telemetry analysis", () => {
    const match = parseMatchDocument(matchDocument, "steam", "account.123")
    expect(match).toMatchObject({
      id: "match-001",
      mapName: "Baltic_Main",
      targetPlayerRank: 3,
      targetPlayerKills: 4,
      telemetryAvailable: true,
    })
    const analysis = parseTelemetry(
      telemetryDocument,
      "account.123",
      "match-001"
    )
    expect(analysis.kills).toHaveLength(1)
    expect(analysis.trajectory).toHaveLength(2)
    expect(analysis.timeline).toHaveLength(1)
  })
})
