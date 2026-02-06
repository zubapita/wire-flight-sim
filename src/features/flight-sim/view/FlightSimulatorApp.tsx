"use client";

import { useFlightSimulatorController } from "@/features/flight-sim/controller/useFlightSimulatorController";
import { FlightSceneView } from "@/features/flight-sim/view/FlightSceneView";
import { HudView } from "@/features/flight-sim/view/HudView";
import { TerrainStatusOverlayView } from "@/features/flight-sim/view/TerrainStatusOverlayView";

type Props = {
  initialSafeMode: boolean;
};

export function FlightSimulatorApp({ initialSafeMode }: Props) {
  const {
    flightState,
    hudState,
    terrain,
    isPaused,
    safeModeActive,
    terrainLoadStatus,
    terrainLoadErrorMessage,
    retryTerrainLoad,
    enterSafeMode,
  } = useFlightSimulatorController(initialSafeMode);

  return (
    <main className="sim-shell">
      <FlightSceneView flightState={flightState} terrain={terrain} />
      <HudView hudState={hudState} isPaused={isPaused} />
      <TerrainStatusOverlayView
        safeModeActive={safeModeActive}
        status={terrainLoadStatus}
        errorMessage={terrainLoadErrorMessage}
        onRetry={retryTerrainLoad}
        onEnterSafeMode={enterSafeMode}
      />
    </main>
  );
}
