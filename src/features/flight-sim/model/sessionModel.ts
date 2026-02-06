import { TerrainMesh } from "@/features/flight-sim/model/terrainModel";
import { FlightState, FlightWarnings } from "@/features/flight-sim/types/flightTypes";

const COLLISION_MARGIN_METERS = 14;
const GROUND_WARNING_MARGIN_METERS = 120;
const STALL_WARNING_THRESHOLD_MS = 27;

export type FlightSessionResult = {
  collided: boolean;
  terrainHeightMeters: number;
};

export function estimateTerrainHeight(terrain: TerrainMesh, x: number, z: number): number {
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  let nearestHeight = 0;

  for (const vertex of terrain.vertices) {
    const dx = vertex.x - x;
    const dz = vertex.z - z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestHeight = vertex.y;
    }
  }

  return nearestHeight;
}

export function evaluateFlightSession(flightState: FlightState, terrain: TerrainMesh): FlightSessionResult {
  const terrainHeightMeters = estimateTerrainHeight(
    terrain,
    flightState.position.x,
    flightState.position.z,
  );

  return {
    collided: flightState.position.y <= terrainHeightMeters + COLLISION_MARGIN_METERS,
    terrainHeightMeters,
  };
}

export function evaluateWarnings(
  flightState: FlightState,
  terrainHeightMeters: number,
): FlightWarnings {
  const altitudeAboveGround = flightState.position.y - terrainHeightMeters;

  return {
    stallRisk: flightState.velocityMs <= STALL_WARNING_THRESHOLD_MS,
    groundWarning: altitudeAboveGround <= GROUND_WARNING_MARGIN_METERS,
  };
}
