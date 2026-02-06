import {
  GraphicsQuality,
  KeyAction,
  SimulatorSettings,
} from "@/features/flight-sim/types/flightTypes";

export const SETTINGS_STORAGE_KEY = "wireframe-flight-settings-v1";

const ACTIONS: KeyAction[] = [
  "pitchUp",
  "pitchDown",
  "rollLeft",
  "rollRight",
  "yawLeft",
  "yawRight",
  "throttleUp",
  "throttleDown",
];

const DEFAULT_BINDINGS: Record<KeyAction, string> = {
  pitchUp: "ArrowUp",
  pitchDown: "ArrowDown",
  rollLeft: "KeyA",
  rollRight: "KeyD",
  yawLeft: "KeyE",
  yawRight: "KeyQ",
  throttleUp: "KeyW",
  throttleDown: "KeyS",
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === "low" || value === "medium" || value === "high";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeBindings(value: unknown): Record<KeyAction, string> {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_BINDINGS };
  }

  const result = { ...DEFAULT_BINDINGS };
  for (const action of ACTIONS) {
    const raw = (value as Record<string, unknown>)[action];
    if (typeof raw === "string" && raw.length > 0) {
      result[action] = raw;
    }
  }

  return result;
}

export function createDefaultSettings(): SimulatorSettings {
  return {
    controlSensitivity: 1,
    graphicsQuality: "medium",
    keyBindings: { ...DEFAULT_BINDINGS },
  };
}

export function validateSettings(input: unknown): SimulatorSettings {
  const defaults = createDefaultSettings();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const record = input as Record<string, unknown>;
  const sensitivity = isFiniteNumber(record.controlSensitivity)
    ? Math.min(1.8, Math.max(0.4, record.controlSensitivity))
    : defaults.controlSensitivity;

  const graphicsQuality = isGraphicsQuality(record.graphicsQuality)
    ? record.graphicsQuality
    : defaults.graphicsQuality;

  return {
    controlSensitivity: sensitivity,
    graphicsQuality,
    keyBindings: normalizeBindings(record.keyBindings),
  };
}

export function loadSettings(storage?: StorageLike): { settings: SimulatorSettings; recoveredFromError: boolean } {
  if (!storage) {
    return { settings: createDefaultSettings(), recoveredFromError: false };
  }

  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { settings: createDefaultSettings(), recoveredFromError: false };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return { settings: validateSettings(parsed), recoveredFromError: false };
  } catch {
    return { settings: createDefaultSettings(), recoveredFromError: true };
  }
}

export function saveSettings(storage: StorageLike | undefined, settings: SimulatorSettings): void {
  if (!storage) {
    return;
  }
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
