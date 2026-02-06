export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type FlightState = {
  position: Vec3;
  velocityMs: number;
  pitchDeg: number;
  rollDeg: number;
  yawDeg: number;
  throttle: number;
  altitudeMeters: number;
  headingDeg: number;
};

export type InputState = {
  pitchUp: boolean;
  pitchDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  throttleUp: boolean;
  throttleDown: boolean;
};

export type HudState = {
  speedMs: number;
  altitudeMeters: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  throttlePercent: number;
};
