"use client";

import { useFlightSimulatorController } from "@/features/flight-sim/controller/useFlightSimulatorController";
import { FlightSceneView } from "@/features/flight-sim/view/FlightSceneView";
import { HudView } from "@/features/flight-sim/view/HudView";
import { LicensePanelView } from "@/features/flight-sim/view/LicensePanelView";
import { PauseMenuView } from "@/features/flight-sim/view/PauseMenuView";
import { TerrainStatusOverlayView } from "@/features/flight-sim/view/TerrainStatusOverlayView";

type Props = {
  initialSafeMode: boolean;
};

export function FlightSimulatorApp({ initialSafeMode }: Props) {
  const {
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
  } = useFlightSimulatorController(initialSafeMode);

  return (
    <main className="sim-shell">
      <FlightSceneView
        flightState={flightState}
        terrain={terrain}
        graphicsQuality={settings.graphicsQuality}
      />
      <HudView
        hudState={hudState}
        warnings={warnings}
        isPaused={isPaused}
        collisionBannerVisible={collisionBannerVisible}
      />
      <PauseMenuView
        isPaused={isPaused}
        showSettings={showSettings}
        showLicense={showLicense}
        settings={settings}
        onResume={togglePause}
        onToggleSettings={toggleSettingsPanel}
        onToggleLicense={toggleLicensePanel}
        onUpdateSettings={updateSettings}
        onResetSettings={resetSettings}
        settingsErrorMessage={settingsErrorMessage}
      />
      <LicensePanelView open={showLicense} onToggle={toggleLicensePanel} />
      <TerrainStatusOverlayView
        safeModeActive={safeModeActive}
        status={terrainLoadStatus}
        errorMessage={terrainLoadErrorMessage}
        onRetry={retryTerrainLoad}
        onEnterSafeMode={enterSafeMode}
      />
    </main>
  );
}
