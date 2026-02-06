import { FlightWarnings, HudState } from "@/features/flight-sim/types/flightTypes";

type Props = {
  hudState: HudState;
  warnings: FlightWarnings;
  isPaused: boolean;
  collisionBannerVisible: boolean;
};

export function HudView({
  hudState,
  warnings,
  isPaused,
  collisionBannerVisible,
}: Props) {
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
      {warnings.stallRisk ? <div className="hud-warning hud-warning-stall">STALL RISK</div> : null}
      {warnings.groundWarning ? (
        <div className="hud-warning hud-warning-ground">GROUND PROXIMITY</div>
      ) : null}
      {collisionBannerVisible ? <div className="hud-collision">COLLISION - RESPAWNED</div> : null}
      {isPaused ? <div className="hud-pause">PAUSED</div> : null}
    </div>
  );
}
