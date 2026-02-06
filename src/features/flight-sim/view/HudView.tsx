import { HudState } from "@/features/flight-sim/types/flightTypes";

type Props = {
  hudState: HudState;
  isPaused: boolean;
};

export function HudView({ hudState, isPaused }: Props) {
  return (
    <div className="hud-layer" aria-live="polite">
      <div className="hud-panel hud-left">
        <p>SPD {hudState.speedMs.toFixed(1)} m/s</p>
        <p>ALT {hudState.altitudeMeters.toFixed(0)} m</p>
        <p>HDG {hudState.headingDeg.toFixed(0)} deg</p>
      </div>
      <div className="hud-panel hud-right">
        <p>PITCH {hudState.pitchDeg.toFixed(1)} deg</p>
        <p>ROLL {hudState.rollDeg.toFixed(1)} deg</p>
        <p>THR {hudState.throttlePercent}%</p>
      </div>
      <div className="hud-help">
        W/S:Throttle | Arrow:Pitch | A/D:Roll | Q/E:Yaw | Esc:Pause
      </div>
      {isPaused ? <div className="hud-pause">PAUSED</div> : null}
    </div>
  );
}
