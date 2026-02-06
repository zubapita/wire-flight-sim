"use client";

import { useFlightSimulatorController } from "@/features/flight-sim/controller/useFlightSimulatorController";
import { FlightSceneView } from "@/features/flight-sim/view/FlightSceneView";
import { HudView } from "@/features/flight-sim/view/HudView";

export function FlightSimulatorApp() {
  const { flightState, hudState, terrain, isPaused } = useFlightSimulatorController();

  return (
    <main className="sim-shell">
      <FlightSceneView flightState={flightState} terrain={terrain} />
      <HudView hudState={hudState} isPaused={isPaused} />
    </main>
  );
}
