type Props = {
  open: boolean;
  onToggle: () => void;
};

export function LicensePanelView({ open, onToggle }: Props) {
  return (
    <div className="license-layer">
      <button type="button" className="license-fab" onClick={onToggle}>
        {open ? "CLOSE LICENSE" : "LICENSE"}
      </button>
      {open ? (
        <section className="license-panel" aria-label="Data license information">
          <h3>DATA LICENSE</h3>
          <p>
            Source: MLIT Project PLATEAU, Tokyo 23 wards (Minato-ku area), 2023 release.
          </p>
          <a href="https://www.geospatial.jp/ckan/dataset/plateau" target="_blank" rel="noreferrer">
            PLATEAU Dataset Portal
          </a>
          <p>
            Local asset: <code>public/terrain/sample_tokyo_wireframe.json</code>
          </p>
        </section>
      ) : null}
    </div>
  );
}
