type Props = {
  safeModeActive: boolean;
  status: "loading" | "ready" | "error";
  errorMessage: string | null;
  onRetry: () => void;
  onEnterSafeMode: () => void;
};

export function TerrainStatusOverlayView({ safeModeActive, status, errorMessage, onRetry, onEnterSafeMode }: Props) {
  if (safeModeActive) {
    return (
      <div className="terrain-status-banner terrain-status-banner-safe">
        SAFE MODE: TERRAIN DISABLED
        <button type="button" className="terrain-inline-button" onClick={onRetry}>
          TRY TERRAIN MODE
        </button>
      </div>
    );
  }

  if (status === "ready") {
    return null;
  }

  if (status === "loading") {
    return <div className="terrain-status-banner">LOADING TERRAIN...</div>;
  }

  return (
    <div className="terrain-error-overlay" role="alert" aria-live="assertive">
      <p className="terrain-error-title">TERRAIN LOAD FAILED</p>
      <p className="terrain-error-message">{errorMessage ?? "Unknown error"}</p>
      <div className="terrain-error-actions">
        <button type="button" className="terrain-retry-button" onClick={onRetry}>
          RETRY
        </button>
        <button type="button" className="terrain-safe-button" onClick={onEnterSafeMode}>
          SAFE MODE
        </button>
      </div>
    </div>
  );
}
