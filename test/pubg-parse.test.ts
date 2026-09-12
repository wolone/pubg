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

  it("carries participant group ids into replay players", () => {
    const match = parseMatchDocument(
      {
        data: { type: "match", id: "match-team" },
        included: [
          {
            type: "participant",
            id: "participant-team",
            attributes: {
              stats: {
                playerId: "account.team-player",
                name: "TeamPlayer",
                groupId: 7,
              },
            },
          },
        ],
      },
      "steam",
      "account.team-player"
    )
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          elapsedTime: 0,
          character: {
            accountId: "account.team-player",
            name: "TeamPlayer",
            teamId: 7,
            location: { x: 10, y: 20 },
          },
        },
      ],
      "account.team-player",
      "match-team"
    )

    expect(match.participants[0]?.teamId).toBe(7)
    expect(analysis.replayPlayers[0]).toEqual({
      id: "account.team-player",
      name: "TeamPlayer",
      teamId: 7,
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
          common: { isGame: 2 },
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

  it("describes incoming damage without inventing an attacker", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerTakeDamage",
          _D: "2026-09-12T10:01:00Z",
          damage: 12.34,
          victim: {
            accountId: "account.123",
            name: "TestPlayer",
            location: { x: 100, y: 200 },
          },
        },
      ],
      "account.123",
      "match-incoming-damage"
    )

    expect(analysis.timeline[0]?.message).toBe("TestPlayer 受到 12.3 点伤害")
  })

  it("keeps downed-state damage neutral when telemetry repeats the victim", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerTakeDamage",
          _D: "2026-09-12T10:01:00Z",
          damage: 0,
          damageTypeCategory: "Damage_DBNO",
          character: {
            accountId: "account.123",
            name: "TestPlayer",
          },
          victim: {
            accountId: "account.123",
            name: "TestPlayer",
          },
        },
      ],
      "account.123",
      "match-dbno"
    )

    expect(analysis.timeline[0]?.message).toBe("TestPlayer 处于倒地状态")
  })

  it("does not describe zero damage as effective damage", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerTakeDamage",
          _D: "2026-09-12T10:01:00Z",
          damage: 0,
          damageTypeCategory: "Damage_Gun",
          attacker: { accountId: "account.123", name: "TestPlayer" },
          victim: { accountId: "account.456", name: "Opponent" },
        },
      ],
      "account.123",
      "match-zero-damage"
    )

    expect(analysis.timeline[0]?.message).toBe(
      "TestPlayer 对 Opponent 未造成有效伤害"
    )
  })

  it("does not claim that an incomplete kill event is a self-elimination", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerKill",
          _D: "2026-09-12T10:01:00Z",
          killer: { accountId: "account.123", name: "TestPlayer" },
          victim: { accountId: "account.123", name: "TestPlayer" },
        },
      ],
      "account.other",
      "match-self-kill"
    )

    expect(analysis.timeline[0]?.message).toBe("TestPlayer 被淘汰")
    expect(analysis.kills).toHaveLength(0)
  })

  it("does not expose the transport aircraft as a player vehicle", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          elapsedTime: 0,
          character: {
            accountId: "account.123",
            name: "TestPlayer",
            location: { x: 200, y: 300 },
          },
          vehicle: { vehicleType: "TransportAircraft" },
        },
        {
          _T: "LogPlayerPosition",
          elapsedTime: 10,
          character: {
            accountId: "account.123",
            name: "TestPlayer",
            location: { x: 250, y: 350 },
          },
          vehicle: { vehicleType: "Dacia" },
        },
      ],
      "account.123",
      "match-transport-aircraft"
    )

    expect(analysis.replayFrames[0]?.vehicles).toBeUndefined()
    expect(analysis.replayFrames.at(-1)?.vehicles).toEqual([
      { playerIndex: 0, vehicleType: "Dacia" },
    ])
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
    expect(
      analysis.timeline.some((event) => event.type === "LogPlayerTakeDamage")
    ).toBe(true)
  })

  it("attributes LogPlayerKillV2 to the final finisher", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerKillV2",
          elapsedTime: 12,
          killer: {
            accountId: "account.knocker",
            name: "Knocker",
            location: { x: 100, y: 100 },
          },
          finisher: {
            accountId: "account.finisher",
            name: "Finisher",
            location: { x: 120, y: 120 },
          },
          victim: {
            accountId: "account.victim",
            name: "Victim",
            location: { x: 130, y: 130 },
          },
        },
      ],
      "account.finisher",
      "match-kill-v2"
    )

    expect(analysis.kills[0]).toMatchObject({
      actor: "account.finisher",
      target: "account.victim",
      location: { x: 120, y: 120 },
    })
    expect(analysis.kills[0]?.message).toBe("Finisher 淘汰了 Victim")
  })

  it("keeps player attack events as compact combat timeline entries", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerAttack",
          elapsedTime: 18,
          attacker: {
            accountId: "account.123",
            name: "TestPlayer",
            location: { x: 200, y: 300 },
          },
          attackType: "Weapon",
        },
      ],
      "account.123",
      "match-attack"
    )

    expect(analysis.timeline[0]).toMatchObject({
      type: "LogPlayerAttack",
      actor: "account.123",
      location: { x: 200, y: 300 },
      message: "TestPlayer 开火",
    })
    expect(analysis.trajectory).toEqual([{ x: 200, y: 300, z: 0 }])
  })

  it("tracks vehicle state without retaining raw vehicle telemetry", () => {
    const analysis = parseTelemetry(
      [
        {
          _T: "LogPlayerPosition",
          elapsedTime: 0,
          character: {
            accountId: "account.123",
            name: "TestPlayer",
            location: { x: 200, y: 300 },
          },
          vehicle: { vehicleType: "Dacia" },
        },
        {
          _T: "LogVehicleLeave",
          elapsedTime: 5,
          character: {
            accountId: "account.123",
            name: "TestPlayer",
            location: { x: 250, y: 350 },
          },
          vehicle: { vehicleType: "Dacia" },
        },
      ],
      "account.123",
      "match-vehicle"
    )

    expect(analysis.timeline.map((event) => event.message)).toEqual([
      "TestPlayer 离开载具",
    ])
    expect(analysis.replayFrames[0]?.vehicles).toEqual([
      { playerIndex: 0, vehicleType: "Dacia" },
    ])
    expect(analysis.replayFrames.at(-1)?.vehicles).toBeUndefined()
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
