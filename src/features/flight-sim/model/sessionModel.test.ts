import { describe, expect, it } from "vitest";
import {
  estimateTerrainHeight,
  evaluateFlightSession,
  evaluateWarnings,
} from "@/features/flight-sim/model/sessionModel";
import { TerrainMesh } from "@/features/flight-sim/model/terrainModel";
import { FlightState } from "@/features/flight-sim/types/flightTypes";

const terrain: TerrainMesh = {
  vertices: [
    { x: 0, y: 10, z: 0 },
    { x: 100, y: 90, z: 0 },
    { x: 0, y: 40, z: 100 },
  ],
  edges: [],
  faces: [],
  layers: [],
};

const baseFlightState: FlightState = {
  position: { x: 0, y: 200, z: 0 },
  velocityMs: 30,
  pitchDeg: 0,
  rollDeg: 0,
  yawDeg: 0,
  throttle: 0.5,
  altitudeMeters: 200,
  headingDeg: 0,
};

describe("sessionModel", () => {
  it("uses nearest vertex as terrain height", () => {
    const height = estimateTerrainHeight(terrain, 90, 0);
    expect(height).toBe(90);
  });

  it("flags collision near terrain", () => {
    const session = evaluateFlightSession(
      {
        ...baseFlightState,
        position: { x: 90, y: 100, z: 0 },
      },
      terrain,
    );

    expect(session.collided).toBe(true);
  });

  it("creates stall and ground warnings", () => {
    const warnings = evaluateWarnings(
      {
        ...baseFlightState,
        velocityMs: 25,
        position: { x: 0, y: 100, z: 0 },
      },
      10,
    );

    expect(warnings.stallRisk).toBe(true);
    expect(warnings.groundWarning).toBe(true);
  });
});
