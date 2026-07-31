type Props = {
  busy: boolean;
};

export function GlassViewport({ busy }: Props) {
  return (
    <div className={`glass ${busy ? "busy" : ""}`}>
      <div className="glass-frame" />
      <div className="glass-hint" aria-hidden={busy}>
        {busy ? "Reading…" : "Drag this glass over text, then Translate"}
      </div>
    </div>
  );
}
