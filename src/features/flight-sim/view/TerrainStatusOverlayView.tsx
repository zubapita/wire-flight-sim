type Props = {
  status: "loading" | "ready" | "error";
  errorMessage: string | null;
  onRetry: () => void;
};

export function TerrainStatusOverlayView({ status, errorMessage, onRetry }: Props) {
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
      <button type="button" className="terrain-retry-button" onClick={onRetry}>
        RETRY
      </button>
    </div>
  );
}
