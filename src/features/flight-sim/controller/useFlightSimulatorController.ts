"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialFlightState,
  updateFlightState,
} from "@/features/flight-sim/model/flightModel";
import { createBootstrapTerrain, loadTerrainFromUrl, TerrainMesh } from "@/features/flight-sim/model/terrainModel";
import { FlightState, HudState, InputState } from "@/features/flight-sim/types/flightTypes";

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

const KEY_BINDINGS: Record<string, keyof InputState> = {
  ArrowUp: "pitchUp",
  ArrowDown: "pitchDown",
  KeyA: "rollLeft",
  KeyD: "rollRight",
  KeyQ: "yawLeft",
  KeyE: "yawRight",
  KeyW: "throttleUp",
  KeyS: "throttleDown",
};

export type FlightSimulatorController = {
  flightState: FlightState;
  hudState: HudState;
  terrain: TerrainMesh;
  isPaused: boolean;
  terrainLoadStatus: "loading" | "ready" | "error";
  terrainLoadErrorMessage: string | null;
  togglePause: () => void;
  retryTerrainLoad: () => void;
};

export function useFlightSimulatorController(): FlightSimulatorController {
  const [flightState, setFlightState] = useState<FlightState>(createInitialFlightState);
  const [isPaused, setIsPaused] = useState(false);
  const inputRef = useRef<InputState>(EMPTY_INPUT);
  const previousFrameMsRef = useRef<number>(0);

  const fallbackTerrain = useMemo(() => createBootstrapTerrain(), []);
  const [terrain, setTerrain] = useState<TerrainMesh>(fallbackTerrain);
  const [terrainLoadStatus, setTerrainLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [terrainLoadErrorMessage, setTerrainLoadErrorMessage] = useState<string | null>(null);
  const terrainRequestSeqRef = useRef(0);

  const startTerrainLoad = useCallback((requestId: number) => {
    loadTerrainFromUrl("/terrain/sample_tokyo_wireframe.json")
      .then((loadedTerrain) => {
        if (terrainRequestSeqRef.current !== requestId) {
          return;
        }
        setTerrain(loadedTerrain);
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

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === "Escape") {
        event.preventDefault();
        setIsPaused((prev) => !prev);
        return;
      }

      const action = KEY_BINDINGS[event.code];
      if (!action) {
        return;
      }
      event.preventDefault();
      inputRef.current = { ...inputRef.current, [action]: true };
    }

    function onKeyUp(event: KeyboardEvent): void {
      const action = KEY_BINDINGS[event.code];
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
  }, []);

  const retryTerrainLoad = useCallback(() => {
    const requestId = terrainRequestSeqRef.current + 1;
    terrainRequestSeqRef.current = requestId;

    setTerrainLoadStatus("loading");
    setTerrainLoadErrorMessage(null);
    startTerrainLoad(requestId);
  }, [startTerrainLoad]);

  useEffect(() => {
    const requestId = terrainRequestSeqRef.current + 1;
    terrainRequestSeqRef.current = requestId;
    startTerrainLoad(requestId);
  }, [startTerrainLoad]);

  useEffect(() => {
    let rafId = 0;

    function onFrame(nowMs: number): void {
      if (previousFrameMsRef.current === 0) {
        previousFrameMsRef.current = nowMs;
      }

      const deltaSec = Math.min((nowMs - previousFrameMsRef.current) / 1000, 1 / 20);
      previousFrameMsRef.current = nowMs;

      if (!isPaused) {
        setFlightState((prev) => updateFlightState(prev, inputRef.current, deltaSec));
      }

      rafId = window.requestAnimationFrame(onFrame);
    }

    rafId = window.requestAnimationFrame(onFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPaused]);

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
    terrain,
    isPaused,
    terrainLoadStatus,
    terrainLoadErrorMessage,
    togglePause,
    retryTerrainLoad,
  };
}
