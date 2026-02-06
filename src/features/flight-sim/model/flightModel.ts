import { FlightState, InputState } from "@/features/flight-sim/types/flightTypes";

const CRUISE_SPEED_MS = 55;
const STALL_SPEED_MS = 24;
const MAX_BANK_DEG = 60;
const MAX_PITCH_DEG = 30;
const MIN_ALTITUDE_METERS = 40;

const PITCH_RATE_DEG_PER_SEC = 20;
const ROLL_RATE_DEG_PER_SEC = 35;
const YAW_RATE_DEG_PER_SEC = 25;
const THROTTLE_RATE_PER_SEC = 0.35;
const AUTO_STABILITY_GAIN = 0.12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapHeading(deg: number): number {
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function createInitialFlightState(): FlightState {
  return {
    position: { x: -1200, y: 320, z: -900 },
    velocityMs: 43,
    pitchDeg: -6,
    rollDeg: 0,
    yawDeg: 53,
    throttle: 0.55,
    altitudeMeters: 320,
    headingDeg: 53,
  };
}

export function updateFlightState(
  prev: FlightState,
  input: InputState,
  deltaSec: number,
): FlightState {
  const pitchInput = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  const rollInput = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
  const yawInput = (input.yawRight ? 1 : 0) - (input.yawLeft ? 1 : 0);
  const throttleInput = (input.throttleUp ? 1 : 0) - (input.throttleDown ? 1 : 0);

  const nextThrottle = clamp(prev.throttle + throttleInput * THROTTLE_RATE_PER_SEC * deltaSec, 0, 1);

  const targetSpeed = STALL_SPEED_MS + (CRUISE_SPEED_MS - STALL_SPEED_MS) * nextThrottle;
  const speedBlend = 1 - Math.exp(-deltaSec * 2);
  const nextVelocity = prev.velocityMs + (targetSpeed - prev.velocityMs) * speedBlend;

  const pitchDelta = pitchInput * PITCH_RATE_DEG_PER_SEC * deltaSec;
  const rollDelta = rollInput * ROLL_RATE_DEG_PER_SEC * deltaSec;
  const yawDelta = yawInput * YAW_RATE_DEG_PER_SEC * deltaSec;

  const stabilizedPitch = prev.pitchDeg * (1 - AUTO_STABILITY_GAIN * deltaSec);
  const stabilizedRoll = prev.rollDeg * (1 - AUTO_STABILITY_GAIN * deltaSec);

  const nextPitch = clamp(stabilizedPitch + pitchDelta, -MAX_PITCH_DEG, MAX_PITCH_DEG);
  const nextRoll = clamp(stabilizedRoll + rollDelta, -MAX_BANK_DEG, MAX_BANK_DEG);
  const nextYaw = wrapHeading(prev.yawDeg + yawDelta + nextRoll * 0.08 * deltaSec);

  const pitchRad = (nextPitch * Math.PI) / 180;
  const yawRad = (nextYaw * Math.PI) / 180;

  const horizontalSpeed = Math.cos(pitchRad) * nextVelocity;
  const verticalSpeed = Math.sin(pitchRad) * nextVelocity;

  const nextX = prev.position.x + Math.sin(yawRad) * horizontalSpeed * deltaSec;
  const nextZ = prev.position.z + Math.cos(yawRad) * horizontalSpeed * deltaSec;
  const nextY = Math.max(MIN_ALTITUDE_METERS, prev.position.y + verticalSpeed * deltaSec);

  return {
    position: { x: nextX, y: nextY, z: nextZ },
    velocityMs: nextVelocity,
    pitchDeg: nextPitch,
    rollDeg: nextRoll,
    yawDeg: nextYaw,
    throttle: nextThrottle,
    altitudeMeters: nextY,
    headingDeg: nextYaw,
  };
}
