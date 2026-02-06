import {
  KeyAction,
  SimulatorSettings,
} from "@/features/flight-sim/types/flightTypes";

type Props = {
  isPaused: boolean;
  showSettings: boolean;
  showLicense: boolean;
  settings: SimulatorSettings;
  onResume: () => void;
  onToggleSettings: () => void;
  onToggleLicense: () => void;
  onUpdateSettings: (settings: SimulatorSettings) => void;
  onResetSettings: () => void;
  settingsErrorMessage: string | null;
};

const ACTION_LABELS: Record<KeyAction, string> = {
  pitchUp: "Pitch Up",
  pitchDown: "Pitch Down",
  rollLeft: "Roll Left",
  rollRight: "Roll Right",
  yawLeft: "Yaw Left",
  yawRight: "Yaw Right",
  throttleUp: "Throttle Up",
  throttleDown: "Throttle Down",
};

const ACTIONS = Object.keys(ACTION_LABELS) as KeyAction[];

export function PauseMenuView({
  isPaused,
  showSettings,
  showLicense,
  settings,
  onResume,
  onToggleSettings,
  onToggleLicense,
  onUpdateSettings,
  onResetSettings,
  settingsErrorMessage,
}: Props) {
  if (!isPaused) {
    return null;
  }

  return (
    <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="Pause menu">
      <div className="pause-panel">
        <h2>PAUSE MENU</h2>
        <div className="pause-actions">
          <button type="button" onClick={onResume}>
            RESUME
          </button>
          <button type="button" onClick={onToggleSettings}>
            {showSettings ? "HIDE SETTINGS" : "SETTINGS"}
          </button>
          <button type="button" onClick={onToggleLicense}>
            {showLicense ? "HIDE LICENSE" : "LICENSE"}
          </button>
        </div>

        {showSettings ? (
          <section className="pause-section">
            <h3>SETTINGS</h3>
            <label>
              Sensitivity: {settings.controlSensitivity.toFixed(2)}
              <input
                type="range"
                min="0.4"
                max="1.8"
                step="0.1"
                value={settings.controlSensitivity}
                onChange={(event) =>
                  onUpdateSettings({
                    ...settings,
                    controlSensitivity: Number(event.currentTarget.value),
                  })
                }
              />
            </label>

            <label>
              Graphics Quality
              <select
                value={settings.graphicsQuality}
                onChange={(event) =>
                  onUpdateSettings({
                    ...settings,
                    graphicsQuality: event.currentTarget.value as SimulatorSettings["graphicsQuality"],
                  })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <div className="settings-bindings">
              {ACTIONS.map((action) => (
                <label key={action}>
                  {ACTION_LABELS[action]}
                  <input
                    type="text"
                    value={settings.keyBindings[action]}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...settings,
                        keyBindings: {
                          ...settings.keyBindings,
                          [action]: event.currentTarget.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <button type="button" onClick={onResetSettings}>
              RESET DEFAULTS
            </button>
            {settingsErrorMessage ? <p className="settings-error">{settingsErrorMessage}</p> : null}
          </section>
        ) : null}

        {showLicense ? (
          <section className="pause-section">
            <h3>LICENSE</h3>
            <p>
              Data source: MLIT Project PLATEAU (Tokyo 23 wards, Minato-ku area)
            </p>
            <a
              href="https://www.geospatial.jp/ckan/dataset/plateau"
              target="_blank"
              rel="noreferrer"
            >
              https://www.geospatial.jp/ckan/dataset/plateau
            </a>
          </section>
        ) : null}
      </div>
    </div>
  );
}
