import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  adjustWindowHeight,
  minWindowHeightForResult,
} from "../lib/windowResize";
import { RESULT_HEIGHT_MAX, RESULT_HEIGHT_MIN } from "../lib/types";

type Props = {
  sourceText: string;
  translation: string;
  sourceLang?: string;
  error?: string | null;
  height: number;
  onHeightChange: (height: number) => void;
  onHeightCommit: (height: number) => void;
  onDismiss: () => void;
};

type DragMode = "split" | "bottom";

type DragState = {
  mode: DragMode;
  startY: number;
  startHeight: number;
  lastY: number;
  /** Latest result height applied during this drag. */
  liveHeight: number;
  busy: boolean;
};

function clampResultHeight(height: number): number {
  return Math.min(RESULT_HEIGHT_MAX, Math.max(RESULT_HEIGHT_MIN, Math.round(height)));
}

export function ResultStrip({
  sourceText,
  translation,
  sourceLang,
  error,
  height,
  onHeightChange,
  onHeightCommit,
  onDismiss,
}: Props) {
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.busy) return;

      if (drag.mode === "bottom") {
        // Bottom edge: extend/shrink results; window follows so glass stays the same.
        const next = clampResultHeight(drag.startHeight + (e.clientY - drag.startY));
        const delta = next - drag.liveHeight;
        if (delta === 0) return;

        drag.busy = true;
        void adjustWindowHeight(delta, minWindowHeightForResult(next))
          .then((applied) => {
            if (!dragRef.current || dragRef.current !== drag) return;
            if (applied !== 0 || delta < 0) {
              drag.liveHeight = next;
              onHeightChange(next);
            }
          })
          .finally(() => {
            if (dragRef.current === drag) drag.busy = false;
          });
        return;
      }

      // Split handle: resize the OS window / glass. Result height stays fixed.
      const step = e.clientY - drag.lastY;
      if (Math.abs(step) < 1) return;
      drag.lastY = e.clientY;
      drag.busy = true;
      void adjustWindowHeight(step, minWindowHeightForResult(drag.liveHeight)).finally(
        () => {
          if (dragRef.current === drag) drag.busy = false;
        },
      );
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.classList.remove("resizing-result");
      if (drag.mode === "bottom") {
        onHeightCommit(drag.liveHeight);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onHeightChange, onHeightCommit]);

  if (!error && !sourceText && !translation) return null;

  const beginDrag = (mode: DragMode, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      startY: e.clientY,
      startHeight: height,
      lastY: e.clientY,
      liveHeight: height,
      busy: false,
    };
    document.body.classList.add("resizing-result");
  };

  return (
    <footer className="result-strip" style={{ height }}>
      <div
        className="result-resize-handle result-split-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize window capture area"
        title="Drag to resize the transparent area"
        onPointerDown={(e) => beginDrag("split", e)}
      />

      <button
        type="button"
        className="icon-btn dismiss-btn"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>

      {error ? (
        <p className="result-error">{error}</p>
      ) : (
        <div className="result-body">
          <div className="result-block">
            <span className="result-label">
              Source{sourceLang ? ` · ${sourceLang}` : ""}
            </span>
            <p>{sourceText || "—"}</p>
          </div>
          <div className="result-block">
            <span className="result-label">Translation</span>
            <p className="translation">{translation || "—"}</p>
          </div>
        </div>
      )}

      <div
        className="result-resize-handle result-bottom-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize translation panel"
        aria-valuemin={RESULT_HEIGHT_MIN}
        aria-valuemax={RESULT_HEIGHT_MAX}
        aria-valuenow={height}
        title="Drag to resize the translation panel"
        onPointerDown={(e) => beginDrag("bottom", e)}
      />
    </footer>
  );
}
