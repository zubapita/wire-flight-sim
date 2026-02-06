"use client";

import { useFlightSimulatorController } from "@/features/flight-sim/controller/useFlightSimulatorController";
import { FlightSceneView } from "@/features/flight-sim/view/FlightSceneView";
import { HudView } from "@/features/flight-sim/view/HudView";
import { TerrainStatusOverlayView } from "@/features/flight-sim/view/TerrainStatusOverlayView";

export function FlightSimulatorApp() {
  const { flightState, hudState, terrain, isPaused, terrainLoadStatus, terrainLoadErrorMessage, retryTerrainLoad } =
    useFlightSimulatorController();

  return (
    <main className="sim-shell">
      <FlightSceneView flightState={flightState} terrain={terrain} />
      <HudView hudState={hudState} isPaused={isPaused} />
      <TerrainStatusOverlayView
        status={terrainLoadStatus}
        errorMessage={terrainLoadErrorMessage}
        onRetry={retryTerrainLoad}
      />
    </main>
  );
}
