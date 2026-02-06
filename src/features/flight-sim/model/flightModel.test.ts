import { describe, expect, it } from "vitest";
import {
  createInitialFlightState,
  updateFlightState,
} from "@/features/flight-sim/model/flightModel";
import { InputState } from "@/features/flight-sim/types/flightTypes";

const NO_INPUT: InputState = {
  pitchUp: false,
  pitchDown: false,
  rollLeft: false,
  rollRight: false,
  yawLeft: false,
  yawRight: false,
  throttleUp: false,
  throttleDown: false,
};

describe("flightModel", () => {
  it("advances forward with no input", () => {
    const prev = createInitialFlightState();
    const next = updateFlightState(prev, NO_INPUT, 0.016);

    expect(next.position.z).not.toBe(prev.position.z);
    expect(next.velocityMs).toBeGreaterThan(0);
  });

  it("applies control sensitivity", () => {
    const prev = createInitialFlightState();
    const input = { ...NO_INPUT, pitchUp: true };

    const low = updateFlightState(prev, input, 0.5, 0.5);
    const high = updateFlightState(prev, input, 0.5, 1.8);

    expect(Math.abs(high.pitchDeg - prev.pitchDeg)).toBeGreaterThan(
      Math.abs(low.pitchDeg - prev.pitchDeg),
    );
  });
});
