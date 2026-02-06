"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialFlightState,
  updateFlightState,
} from "@/features/flight-sim/model/flightModel";
import {
  createBootstrapTerrain,
  loadTerrainFromUrl,
  TerrainMesh,
} from "@/features/flight-sim/model/terrainModel";
import {
  createDefaultSettings,
  loadSettings,
  saveSettings,
  validateSettings,
} from "@/features/flight-sim/model/settingsModel";
import {
  evaluateFlightSession,
  evaluateWarnings,
} from "@/features/flight-sim/model/sessionModel";
import {
  FlightState,
  FlightWarnings,
  HudState,
  InputState,
  SimulatorSettings,
} from "@/features/flight-sim/types/flightTypes";

const EMPTY_INPUT: InputState = {
  pitchUp: false,
  pitchDown: false,
  rollLeft: false,
  rollRight: false,
  yawLeft: false,
  yawRight: false,
  throttleUp: false,
  throttleDown: false,
};

const COLLISION_BANNER_MS = 3000;

export type FlightSimulatorController = {
  flightState: FlightState;
  hudState: HudState;
  warnings: FlightWarnings;
  terrain: TerrainMesh;
  isPaused: boolean;
  safeModeActive: boolean;
  terrainLoadStatus: "loading" | "ready" | "error";
  terrainLoadErrorMessage: string | null;
  settingsErrorMessage: string | null;
  settings: SimulatorSettings;
  showSettings: boolean;
  showLicense: boolean;
  collisionBannerVisible: boolean;
  togglePause: () => void;
  retryTerrainLoad: () => void;
  enterSafeMode: () => void;
  updateSettings: (nextSettings: SimulatorSettings) => void;
  resetSettings: () => void;
  toggleSettingsPanel: () => void;
  toggleLicensePanel: () => void;
};

function readInitialSettings(): {
  settings: SimulatorSettings;
  settingsErrorMessage: string | null;
} {
  if (typeof window === "undefined") {
    return {
      settings: createDefaultSettings(),
      settingsErrorMessage: null,
    };
  }

  const { settings, recoveredFromError } = loadSettings(window.localStorage);

  return {
    settings,
    settingsErrorMessage: recoveredFromError
      ? "E_SETTINGS_INVALID: 保存設定が不正だったためデフォルト設定で起動しました"
      : null,
  };
}

export function useFlightSimulatorController(
  initialSafeMode: boolean,
): FlightSimulatorController {
  const [flightState, setFlightState] = useState<FlightState>(createInitialFlightState);
  const [warnings, setWarnings] = useState<FlightWarnings>({
    stallRisk: false,
    groundWarning: false,
  });
  const [collisionBannerVisible, setCollisionBannerVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  const [settingsBootstrap] = useState(readInitialSettings);
  const [settings, setSettings] = useState<SimulatorSettings>(settingsBootstrap.settings);
  const [settingsErrorMessage, setSettingsErrorMessage] = useState<string | null>(
    settingsBootstrap.settingsErrorMessage,
  );

  const inputRef = useRef<InputState>(EMPTY_INPUT);
  const previousFrameMsRef = useRef<number>(0);
  const collisionTimerRef = useRef<number | null>(null);

  const fallbackTerrain = useMemo(() => createBootstrapTerrain(), []);
  const [terrain, setTerrain] = useState<TerrainMesh>(fallbackTerrain);
  const [safeModeActive, setSafeModeActive] = useState(initialSafeMode);
  const [terrainLoadStatus, setTerrainLoadStatus] = useState<"loading" | "ready" | "error">(
    initialSafeMode ? "ready" : "loading",
  );
  const [terrainLoadErrorMessage, setTerrainLoadErrorMessage] = useState<string | null>(null);
  const terrainRequestSeqRef = useRef(0);

  const updateSettings = useCallback((nextSettings: SimulatorSettings) => {
    const validated = validateSettings(nextSettings);
    setSettings(validated);
    if (typeof window !== "undefined") {
      saveSettings(window.localStorage, validated);
    }
    setSettingsErrorMessage(null);
  }, []);

  const resetSettings = useCallback(() => {
    const defaults = createDefaultSettings();
    setSettings(defaults);
    if (typeof window !== "undefined") {
      saveSettings(window.localStorage, defaults);
    }
    setSettingsErrorMessage(null);
  }, []);

  const startTerrainLoad = useCallback((requestId: number) => {
    loadTerrainFromUrl("/terrain/sample_tokyo_wireframe.json")
      .then((loadedTerrain) => {
        if (terrainRequestSeqRef.current !== requestId) {
          return;
        }
        setTerrain(loadedTerrain);
        setSafeModeActive(false);
        setTerrainLoadStatus("ready");
      })
      .catch((error: unknown) => {
        if (terrainRequestSeqRef.current !== requestId) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unknown terrain load failure";
        setTerrainLoadStatus("error");
        setTerrainLoadErrorMessage(message);
        console.error("Failed to load terrain data:", error);
      });
  }, []);

  const enterSafeMode = useCallback(() => {
    terrainRequestSeqRef.current += 1;
    setSafeModeActive(true);
    setTerrain(fallbackTerrain);
    setTerrainLoadStatus("ready");
    setTerrainLoadErrorMessage(null);
  }, [fallbackTerrain]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (prev) {
        setShowSettings(false);
      }
      return !prev;
    });
  }, []);

  const toggleSettingsPanel = useCallback(() => {
    setShowLicense(false);
    setShowSettings((prev) => !prev);
  }, []);

  const toggleLicensePanel = useCallback(() => {
    setShowSettings(false);
    setShowLicense((prev) => !prev);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === "Escape") {
        event.preventDefault();
        setIsPaused((prev) => !prev);
        return;
      }

      const action = (Object.entries(settings.keyBindings).find(
        ([, code]) => code === event.code,
      )?.[0] ?? null) as keyof InputState | null;

      if (!action) {
        return;
      }
      event.preventDefault();
      inputRef.current = { ...inputRef.current, [action]: true };
    }

    function onKeyUp(event: KeyboardEvent): void {
      const action = (Object.entries(settings.keyBindings).find(
        ([, code]) => code === event.code,
      )?.[0] ?? null) as keyof InputState | null;
      if (!action) {
        return;
      }
      event.preventDefault();
      inputRef.current = { ...inputRef.current, [action]: false };
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [settings.keyBindings]);

  const retryTerrainLoad = useCallback(() => {
    const requestId = terrainRequestSeqRef.current + 1;
    terrainRequestSeqRef.current = requestId;

    setSafeModeActive(false);
    setTerrainLoadStatus("loading");
    setTerrainLoadErrorMessage(null);
    startTerrainLoad(requestId);
  }, [startTerrainLoad]);

  useEffect(() => {
    if (safeModeActive) {
      return;
    }
    const requestId = terrainRequestSeqRef.current + 1;
    terrainRequestSeqRef.current = requestId;
    startTerrainLoad(requestId);
  }, [safeModeActive, startTerrainLoad]);

  useEffect(() => {
    let rafId = 0;

    function onFrame(nowMs: number): void {
      if (previousFrameMsRef.current === 0) {
        previousFrameMsRef.current = nowMs;
      }

      const deltaSec = Math.min((nowMs - previousFrameMsRef.current) / 1000, 1 / 20);
      previousFrameMsRef.current = nowMs;

      if (!isPaused) {
        setFlightState((prev) => {
          const next = updateFlightState(
            prev,
            inputRef.current,
            deltaSec,
            settings.controlSensitivity,
          );

          const session = evaluateFlightSession(next, terrain);
          setWarnings(evaluateWarnings(next, session.terrainHeightMeters));

          if (session.collided) {
            if (collisionTimerRef.current !== null) {
              window.clearTimeout(collisionTimerRef.current);
            }
            setCollisionBannerVisible(true);
            collisionTimerRef.current = window.setTimeout(() => {
              setCollisionBannerVisible(false);
            }, COLLISION_BANNER_MS);
            return createInitialFlightState();
          }

          return next;
        });
      }

      rafId = window.requestAnimationFrame(onFrame);
    }

    rafId = window.requestAnimationFrame(onFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPaused, settings.controlSensitivity, terrain]);

  useEffect(() => {
    return () => {
      if (collisionTimerRef.current !== null) {
        window.clearTimeout(collisionTimerRef.current);
      }
    };
  }, []);

  const hudState: HudState = {
    speedMs: flightState.velocityMs,
    altitudeMeters: flightState.altitudeMeters,
    headingDeg: flightState.headingDeg,
    pitchDeg: flightState.pitchDeg,
    rollDeg: flightState.rollDeg,
    throttlePercent: Math.round(flightState.throttle * 100),
  };

  return {
    flightState,
    hudState,
    warnings,
    terrain,
    isPaused,
    safeModeActive,
    terrainLoadStatus,
    terrainLoadErrorMessage,
    settingsErrorMessage,
    settings,
    showSettings,
    showLicense,
    collisionBannerVisible,
    togglePause,
    retryTerrainLoad,
    enterSafeMode,
    updateSettings,
    resetSettings,
    toggleSettingsPanel,
    toggleLicensePanel,
  };
}
