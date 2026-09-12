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
    expect(analysis.timeline[0]?.targetLocation).toMatchObject({
      x: 125,
      y: 245,
    })
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
      blackzone: null,
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
    expect(analysis.timeline[0]?.message).toBe("TestPlayer 淘汰了 Opponent")
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

  it("uses official elapsed time fields for replay synchronization", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          _D: "2026-09-12T10:00:00Z",
          elapsedTime: 12,
          character: {
            accountId: "account.123",
            location: { x: 100, y: 200 },
          },
        },
        {
          _T: "LogGameStatePeriodic",
          _D: "2026-09-12T10:05:00Z",
          gameState: {
            elapsedTime: 45,
            safetyZonePosition: { x: 400, y: 500 },
            safetyZoneRadius: 300,
          },
        },
        {
          _T: "LogPlayerKill",
          _D: "2026-09-12T10:10:00Z",
          elapsedTime: 60,
          killer: { accountId: "account.123", location: { x: 120, y: 240 } },
          victim: { accountId: "account.456", location: { x: 125, y: 245 } },
        },
      ],
      "account.123",
      "match-elapsed-time"
    )

    expect(analysis.timeline[0]?.elapsedSeconds).toBe(60)
    expect(
      analysis.replayFrames.find((frame) => frame.zones)?.elapsedSeconds
    ).toBe(45)
    expect(analysis.replayFrames.at(-1)?.elapsedSeconds).toBe(60)
  })

  it("carries official alive counts and phase changes into replay frames", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          elapsedTime: 0,
          character: {
            accountId: "account.123",
            location: { x: 100, y: 200 },
          },
        },
        {
          _T: "LogGameStatePeriodic",
          gameState: {
            elapsedTime: 30,
            numAlivePlayers: 47,
            numAliveTeams: 18,
            blackZonePosition: { x: 50, y: 60 },
            blackZoneRadius: 25,
          },
        },
        {
          _T: "LogPhaseChange",
          elapsedTime: 45,
          phase: 2,
        },
      ],
      "account.123",
      "match-replay-stats"
    )

    expect(analysis.replayFrames).toContainEqual(
      expect.objectContaining({
        elapsedSeconds: 30,
        alivePlayers: 47,
        aliveTeams: 18,
        zones: expect.objectContaining({
          blackzone: { x: 50, y: 60, radius: 25 },
        }),
      })
    )
    expect(analysis.replayFrames.at(-1)).toMatchObject({
      elapsedSeconds: 45,
      phase: 2,
    })
  })

  it("adds care package events to the replay timeline with map locations", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogCarePackageSpawn",
          _D: "2026-09-12T10:01:00Z",
          itemPackage: {
            itemPackageId: "package-1",
            location: { x: 300, y: 400, z: 20 },
          },
        },
        {
          _T: "LogCarePackageLand",
          _D: "2026-09-12T10:02:00Z",
          itemPackage: {
            itemPackageId: "package-1",
            location: { x: 320, y: 420, z: 20 },
          },
        },
      ],
      "account.123",
      "match-care-package"
    )

    expect(analysis.timeline.map((event) => event.type)).toEqual([
      "LogCarePackageSpawn",
      "LogCarePackageLand",
    ])
    expect(analysis.timeline[0]?.location).toMatchObject({ x: 300, y: 400 })
    expect(analysis.timeline[1]?.message).toBe("补给箱已落地")
  })

  it("keeps damage amount and category for combat analysis", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerTakeDamage",
          _D: "2026-09-12T10:01:00Z",
          damage: 34.5,
          damageTypeCategory: "Damage_Gun",
          attacker: {
            accountId: "account.123",
            location: { x: 100, y: 200 },
          },
          victim: {
            accountId: "account.456",
            location: { x: 120, y: 220 },
          },
        },
      ],
      "account.123",
      "match-damage"
    )

    expect(analysis.timeline[0]).toMatchObject({
      damage: 34.5,
      damageType: "Damage_Gun",
      targetLocation: { x: 120, y: 220 },
    })
    expect(analysis.timeline[0]?.message).toContain("34.5 点伤害")
  })

  it("preserves key events when the timeline needs compacting", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerKill",
          elapsedTime: 1,
          killer: { accountId: "account.123" },
          victim: { accountId: "account.456" },
        },
        ...Array.from({ length: 130 }, (_, index) => ({
          _T: "LogPlayerTakeDamage",
          elapsedTime: index + 2,
          damage: 1,
          attacker: { accountId: "account.123" },
          victim: { accountId: "account.456" },
        })),
        {
          _T: "LogPlayerDeath",
          elapsedTime: 200,
          character: { accountId: "account.456" },
        },
      ],
      "account.123",
      "match-compact-timeline"
    )

    expect(analysis.timeline).toHaveLength(120)
    expect(
      analysis.timeline.some((event) => event.type === "LogPlayerKill")
    ).toBe(true)
    expect(
      analysis.timeline.some((event) => event.type === "LogPlayerDeath")
    ).toBe(true)
  })

  it("carries player health through replay frames", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          elapsedTime: 0,
          character: {
            accountId: "account.123",
            health: 100,
            location: { x: 100, y: 200 },
          },
        },
        {
          _T: "LogPlayerPosition",
          elapsedTime: 5,
          character: {
            accountId: "account.123",
            health: 72.5,
            location: { x: 120, y: 220 },
          },
        },
      ],
      "account.123",
      "match-health"
    )

    expect(analysis.replayFrames.at(-1)?.players[0]).toEqual([
      0,
      120,
      220,
      "alive",
      72.5,
    ])
  })
})
