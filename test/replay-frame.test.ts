import { describe, expect, it } from "vitest"

import { interpolateFrame } from "@/components/pubg/match-replay"

describe("replay frame synchronization", () => {
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
