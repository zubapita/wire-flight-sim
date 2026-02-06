import { describe, expect, it } from "vitest";
import {
  createDefaultSettings,
  loadSettings,
  validateSettings,
} from "@/features/flight-sim/model/settingsModel";

function createStorage(seed?: string) {
  const state = new Map<string, string>();
  if (seed !== undefined) {
    state.set("wireframe-flight-settings-v1", seed);
  }
  return {
    getItem(key: string) {
      return state.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      state.set(key, value);
    },
  };
}

describe("settingsModel", () => {
  it("returns defaults for invalid payload", () => {
    expect(validateSettings(null)).toEqual(createDefaultSettings());
  });

  it("clamps sensitivity and keeps valid graphics quality", () => {
    const settings = validateSettings({
      controlSensitivity: 4,
      graphicsQuality: "high",
      keyBindings: { pitchUp: "KeyI" },
    });

    expect(settings.controlSensitivity).toBe(1.8);
    expect(settings.graphicsQuality).toBe("high");
    expect(settings.keyBindings.pitchUp).toBe("KeyI");
    expect(settings.keyBindings.pitchDown).toBe("ArrowDown");
  });

  it("recovers from broken json", () => {
    const { settings, recoveredFromError } = loadSettings(createStorage("{broken") as never);
    expect(recoveredFromError).toBe(true);
    expect(settings).toEqual(createDefaultSettings());
  });
});
