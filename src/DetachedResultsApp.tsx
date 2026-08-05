import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  emitResultsAttach,
  emitResultsDismiss,
  emitResultsRequestState,
  emitResultsTextSize,
  listenResultsState,
  type ResultsStatePayload,
} from "./lib/resultsSync";
import {
  DEFAULT_SETTINGS,
  RESULT_TEXT_SIZES,
  type ResultTextSize,
} from "./lib/types";
import "./styles.css";

function normalizeTextSize(value: unknown): ResultTextSize {
  if (value === "sm" || value === "md" || value === "lg") return value;
  return DEFAULT_SETTINGS.resultTextSize;
}

export default function DetachedResultsApp() {
  const [state, setState] = useState<ResultsStatePayload>({
    sourceText: "",
    translation: "",
    textSize: DEFAULT_SETTINGS.resultTextSize,
    error: null,
  });
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    void listenResultsState((payload) => {
      setState({
        ...payload,
        textSize: normalizeTextSize(payload.textSize),
      });
    }).then((u) => {
      unsubs.push(u);
      // Request only after the listener is registered so the reply is not missed.
      void emitResultsRequestState();
    });
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!sizeMenuOpen) return;
    const onPointerDown = () => setSizeMenuOpen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSizeMenuOpen(false);
    };
    // Defer so the opening click doesn't immediately close.
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sizeMenuOpen]);

  const startDrag = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='menu']")) return;
    void getCurrentWindow().startDragging();
  };

  const empty = !state.error && !state.sourceText && !state.translation;

  return (
    <div className={`detached-results text-size-${state.textSize}`}>
      <header
        className="detached-chrome"
        data-tauri-drag-region
        onPointerDown={startDrag}
      >
        <span className="detached-title" data-tauri-drag-region>
          Translation
        </span>
        <div className="result-actions detached-actions">
          <div className="text-size-control">
            <button
              type="button"
              className={`icon-btn text-size-btn ${sizeMenuOpen ? "active" : ""}`}
              onClick={() => setSizeMenuOpen((open) => !open)}
              title="Text size"
              aria-label="Text size"
              aria-expanded={sizeMenuOpen}
            >
              aA
            </button>
            {sizeMenuOpen && (
              <div
                className="text-size-menu"
                role="menu"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {RESULT_TEXT_SIZES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={state.textSize === option.id}
                    className={`text-size-option size-${option.id} ${
                      state.textSize === option.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      setState((prev) => ({ ...prev, textSize: option.id }));
                      void emitResultsTextSize(option.id);
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
            className="icon-btn detach-btn active"
            onClick={() => void emitResultsAttach()}
            title="Reattach to main window"
            aria-label="Reattach to main window"
          >
            ⧉
          </button>
          <button
            type="button"
            className="icon-btn dismiss-btn"
            onClick={() => {
              void (async () => {
                // Notify main if alive; always destroy locally so X works after glass closes.
                try {
                  await emitResultsDismiss();
                } catch {
                  // Main may already be gone.
                }
                await getCurrentWindow().destroy();
              })();
            }}
            title="Dismiss"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </header>

      <div className="detached-body">
        {empty ? (
          <p className="detached-empty">No translation yet.</p>
        ) : state.error ? (
          <p className="result-error">{state.error}</p>
        ) : (
          <div className="result-body">
            <div className="result-block">
              <span className="result-label">
                Source{state.sourceLang ? ` · ${state.sourceLang}` : ""}
              </span>
              <p>{state.sourceText || "—"}</p>
            </div>
            <div className="result-block">
              <span className="result-label">Translation</span>
              <p className="translation">{state.translation || "—"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
