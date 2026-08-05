import { DrawRegionIcon } from "./DrawRegionIcon";

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
        <DrawRegionIcon />
      </button>
      <div className="glass-hint" aria-hidden={busy}>
        {busy ? "Reading…" : "Drag this glass over text, then Translate"}
      </div>
    </div>
  );
}
