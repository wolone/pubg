import { describe, expect, it } from "vitest"

import { interpolateFrame } from "@/components/pubg/match-replay"
import { activeCarePackagesAtTime } from "@/components/pubg/replay-map"

describe("replay frame synchronization", () => {
  it("keeps active care packages and pairs landings with the nearest drop", () => {
    const events = [
      {
        key: 1,
        state: "spawned" as const,
        elapsedSeconds: 10,
        location: { x: 100, y: 100, z: 30000 },
        packageType: "Carapackage_SmallPackage_C",
      },
      {
        key: 2,
        state: "spawned" as const,
        elapsedSeconds: 11,
        location: { x: 500, y: 500, z: 30000 },
        packageType: "Carapackage_SmallPackage_C",
      },
      {
        key: 3,
        state: "landed" as const,
        elapsedSeconds: 20,
        location: { x: 505, y: 500, z: 4000 },
        packageType: "Carapackage_SmallPackage_C",
      },
      {
        key: 4,
        state: "landed" as const,
        elapsedSeconds: 21,
        location: { x: 105, y: 100, z: 4000 },
        packageType: "Carapackage_SmallPackage_C",
      },
    ]

    expect(activeCarePackagesAtTime(events, 15)).toHaveLength(2)
    expect(activeCarePackagesAtTime(events, 20)).toMatchObject([
      { key: 1, state: "spawned" },
      { key: 2, state: "landed", location: { x: 505, y: 500 } },
    ])
    expect(activeCarePackagesAtTime(events, 30)).toMatchObject([
      { key: 1, state: "landed", location: { x: 105, y: 100 } },
      { key: 2, state: "landed", location: { x: 505, y: 500 } },
    ])
  })

  it("does not render a future first frame before its official timestamp", () => {
    const frames = [
      {
        elapsedSeconds: 120,
        players: [[0, 100, 200, "alive" as const]] as [
          number,
          number,
          number,
          "alive"
        ][],
        vehicles: [{ playerIndex: 0, vehicleType: "WheeledVehicle" }],
      },
    ]

    expect(interpolateFrame(frames, 0)).toBeNull()
    expect(interpolateFrame(frames, 119)).toBeNull()
    expect(interpolateFrame(frames, 120)?.vehicles).toEqual([
      { playerIndex: 0, vehicleType: "WheeledVehicle" },
    ])
  })

  it("applies discrete player and vehicle states at the next frame time", () => {
    const frames = [
      {
        elapsedSeconds: 10,
        players: [[0, 100, 200, "alive" as const, 100]] as [
          number,
          number,
          number,
          "alive",
          number
        ][],
        vehicles: [{ playerIndex: 0, vehicleType: "WheeledVehicle" }],
      },
      {
        elapsedSeconds: 20,
        players: [[0, 200, 300, "dead" as const, 0]] as [
          number,
          number,
          number,
          "dead",
          number
        ][],
      },
    ]

    expect(interpolateFrame(frames, 19)?.players[0]).toEqual([
      0,
      190,
      290,
      "alive",
      100,
    ])
    expect(interpolateFrame(frames, 20)?.players[0]).toEqual([
      0,
      200,
      300,
      "dead",
      0,
    ])
    expect(interpolateFrame(frames, 19)?.vehicles).toEqual([
      { playerIndex: 0, vehicleType: "WheeledVehicle" },
    ])
    expect(interpolateFrame(frames, 20)?.vehicles).toBeUndefined()
  })
})
