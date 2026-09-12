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
      "match-001",
      match.participants
    )
    expect(analysis.kills).toHaveLength(1)
    expect(analysis.trajectory).toHaveLength(2)
    expect(analysis.timeline).toHaveLength(1)
    expect(analysis.timeline[0]?.elapsedSeconds).toBe(180)
    expect(analysis.replayPlayers).toEqual([
      { id: "account.123", name: "TestPlayer" },
      { id: "account.456", name: "Opponent" },
    ])
    expect(analysis.replayFrames.at(-1)).toMatchObject({
      elapsedSeconds: 240,
    })
    expect(analysis.replayFrames.at(-1)?.players[0]).toEqual([
      0,
      180,
      300,
      "alive",
    ])
    expect(analysis.replayFrames.find((frame) => frame.zones)?.zones).toEqual({
      bluezone: { x: 400, y: 500, radius: 300 },
      safezone: { x: 410, y: 510, radius: 120 },
      redzone: { x: 600, y: 700, radius: 80 },
    })
  })

  it("uses match participant names when telemetry omits account ids", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          _D: "2026-09-12T10:01:00Z",
          character: {
            name: "TestPlayer",
            location: { x: 100, y: 200 },
          },
        },
        {
          _T: "LogPlayerKill",
          _D: "2026-09-12T10:02:00Z",
          attacker: { name: "TestPlayer", location: { x: 120, y: 240 } },
          victim: { name: "Opponent", location: { x: 125, y: 245 } },
        },
      ],
      "account.123",
      "match-name-fallback",
      [
        {
          id: "account.123",
          name: "TestPlayer",
          rank: 1,
          kills: 1,
          damage: 100,
          survivalTime: 120,
        },
        {
          id: "account.456",
          name: "Opponent",
          rank: 2,
          kills: 0,
          damage: 0,
          survivalTime: 60,
        },
      ]
    )

    expect(analysis.kills).toHaveLength(1)
    expect(analysis.replayPlayers).toEqual([
      { id: "account.123", name: "TestPlayer" },
      { id: "account.456", name: "Opponent" },
    ])
  })

  it("keeps knock and revive events in the replay timeline", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerMakeGroggy",
          _D: "2026-09-12T10:01:00Z",
          attacker: { accountId: "account.123" },
          victim: {
            accountId: "account.456",
            location: { x: 100, y: 200 },
          },
        },
        {
          _T: "LogPlayerRevive",
          _D: "2026-09-12T10:02:00Z",
          character: {
            accountId: "account.456",
            location: { x: 120, y: 220 },
          },
        },
      ],
      "account.123",
      "match-state-events"
    )

    expect(analysis.timeline.map((event) => event.type)).toEqual([
      "LogPlayerMakeGroggy",
      "LogPlayerRevive",
    ])
    expect(analysis.timeline[0]?.message).toContain("被击倒")
    expect(analysis.timeline[1]?.message).toContain("被救起")
    expect(analysis.replayFrames[0]?.players).toContainEqual([
      1,
      100,
      200,
      "knocked",
    ])
    expect(analysis.replayFrames.at(-1)?.players).toContainEqual([
      1,
      120,
      220,
      "alive",
    ])
  })
})
