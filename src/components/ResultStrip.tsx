import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  adjustWindowHeight,
  minWindowHeightForResult,
  type HeightAnchor,
} from "../lib/windowResize";
import {
  RESULT_HEIGHT_MAX,
  RESULT_HEIGHT_MIN,
  RESULT_TEXT_SIZES,
  type ResultTextSize,
  type ResultsPlacement,
} from "../lib/types";

type Props = {
  sourceText: string;
  translation: string;
  sourceLang?: string;
  error?: string | null;
  height: number;
  placement: ResultsPlacement;
  textSize: ResultTextSize;
  onHeightChange: (height: number) => void;
  onHeightCommit: (height: number) => void;
  onTextSizeChange: (size: ResultTextSize) => void;
  onFlip: () => void;
  onDetach: () => void;
  onDismiss: () => void;
};

type DragMode = "split" | "extend";

type DragState = {
  mode: DragMode;
  startY: number;
  startHeight: number;
  lastY: number;
  liveHeight: number;
  busy: boolean;
  placement: ResultsPlacement;
};

function clampResultHeight(height: number): number {
  return Math.min(
    RESULT_HEIGHT_MAX,
    Math.max(RESULT_HEIGHT_MIN, Math.round(height)),
  );
}

function heightAnchor(placement: ResultsPlacement): HeightAnchor {
  return placement === "above" ? "bottom" : "top";
}

export function ResultStrip({
  sourceText,
  translation,
  sourceLang,
  error,
  height,
  placement,
  textSize,
  onHeightChange,
  onHeightCommit,
  onTextSizeChange,
  onFlip,
  onDetach,
  onDismiss,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const placementRef = useRef(placement);
  const menuRef = useRef<HTMLDivElement>(null);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  placementRef.current = placement;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.busy) return;
      const anchor = heightAnchor(drag.placement);

      if (drag.mode === "extend") {
        const signed =
          drag.placement === "above"
            ? drag.startY - e.clientY
            : e.clientY - drag.startY;
        const next = clampResultHeight(drag.startHeight + signed);
        const delta = next - drag.liveHeight;
        if (delta === 0) return;

        drag.busy = true;
        void adjustWindowHeight(delta, minWindowHeightForResult(next), {
          anchor,
        })
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

      const rawStep = e.clientY - drag.lastY;
      if (Math.abs(rawStep) < 1) return;
      drag.lastY = e.clientY;
      const step = drag.placement === "above" ? -rawStep : rawStep;
      drag.busy = true;
      void adjustWindowHeight(step, minWindowHeightForResult(drag.liveHeight), {
        anchor,
      }).finally(() => {
        if (dragRef.current === drag) drag.busy = false;
      });
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.classList.remove("resizing-result");
      if (drag.mode === "extend") {
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

  useEffect(() => {
    if (!sizeMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setSizeMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSizeMenuOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sizeMenuOpen]);

  if (!error && !sourceText && !translation) return null;

  const beginDrag = (mode: DragMode, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSizeMenuOpen(false);
    dragRef.current = {
      mode,
      startY: e.clientY,
      startHeight: height,
      lastY: e.clientY,
      liveHeight: height,
      busy: false,
      placement: placementRef.current,
    };
    document.body.classList.add("resizing-result");
  };

  const splitOnTop = placement === "below";
  const extendOnTop = placement === "above";

  return (
    <footer
      className={`result-strip placement-${placement} text-size-${textSize}`}
      style={{ height }}
    >
      <div
        className={`result-resize-handle ${
          splitOnTop ? "result-split-handle" : "result-extend-handle"
        }`}
        role="separator"
        aria-orientation="horizontal"
        aria-label={
          splitOnTop
            ? "Resize window capture area"
            : "Resize translation panel"
        }
        title={
          splitOnTop
            ? "Drag to resize the transparent area"
            : "Drag to resize the translation panel"
        }
        aria-valuemin={extendOnTop ? RESULT_HEIGHT_MIN : undefined}
        aria-valuemax={extendOnTop ? RESULT_HEIGHT_MAX : undefined}
        aria-valuenow={extendOnTop ? height : undefined}
        onPointerDown={(e) => beginDrag(splitOnTop ? "split" : "extend", e)}
      />

      <div className="result-actions" ref={menuRef}>
        <div className="text-size-control">
          <button
            type="button"
            className={`icon-btn text-size-btn ${sizeMenuOpen ? "active" : ""}`}
            onClick={() => setSizeMenuOpen((open) => !open)}
            title="Text size"
            aria-label="Text size"
            aria-expanded={sizeMenuOpen}
            aria-haspopup="menu"
          >
            aA
          </button>
          {sizeMenuOpen && (
            <div className="text-size-menu" role="menu" aria-label="Text size">
              {RESULT_TEXT_SIZES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={textSize === option.id}
                  className={`text-size-option size-${option.id} ${
                    textSize === option.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    onTextSizeChange(option.id);
                    setSizeMenuOpen(false);
                  }}
                >
                  <span className="text-size-sample">{option.sample}</span>
                  <span className="text-size-label">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="icon-btn detach-btn"
          onClick={onDetach}
          title="Detach response window"
          aria-label="Detach response window"
        >
          ⧉
        </button>
        <button
          type="button"
          className="icon-btn flip-btn"
          onClick={onFlip}
          title={
            placement === "below"
              ? "Move results above the glass"
              : "Move results below the glass"
          }
          aria-label={
            placement === "below"
              ? "Move results above the glass"
              : "Move results below the glass"
          }
        >
          ⇅
        </button>
        <button
          type="button"
          className="icon-btn dismiss-btn"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

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
        className={`result-resize-handle ${
          splitOnTop ? "result-extend-handle" : "result-split-handle"
        }`}
        role="separator"
        aria-orientation="horizontal"
        aria-label={
          splitOnTop
            ? "Resize translation panel"
            : "Resize window capture area"
        }
        title={
          splitOnTop
            ? "Drag to resize the translation panel"
            : "Drag to resize the transparent area"
        }
        aria-valuemin={splitOnTop ? RESULT_HEIGHT_MIN : undefined}
        aria-valuemax={splitOnTop ? RESULT_HEIGHT_MAX : undefined}
        aria-valuenow={splitOnTop ? height : undefined}
        onPointerDown={(e) => beginDrag(splitOnTop ? "extend" : "split", e)}
      />
    </footer>
  );
}
