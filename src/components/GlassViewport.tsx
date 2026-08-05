type Props = {
  busy: boolean;
  onResizeRegion: () => void;
};

export function GlassViewport({ busy, onResizeRegion }: Props) {
  return (
    <div className={`glass ${busy ? "busy" : ""}`}>
      <div className="glass-frame" />
      <button
        type="button"
        className="glass-resize-btn"
        onClick={onResizeRegion}
        disabled={busy}
        title="Draw glass region"
        aria-label="Draw glass region"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2.5"
            y="2.5"
            width="11"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <path
            d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div className="glass-hint" aria-hidden={busy}>
        {busy ? "Reading…" : "Drag this glass over text, then Translate"}
      </div>
    </div>
  );
}
