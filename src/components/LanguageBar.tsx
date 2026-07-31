import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LANGUAGES } from "../lib/types";

type Props = {
  sourceLang: string;
  targetLang: string;
  autoCapture: boolean;
  busy: boolean;
  onSourceChange: (code: string) => void;
  onTargetChange: (code: string) => void;
  onSwap: () => void;
  onToggleAuto: () => void;
  onTranslate: () => void;
  onOpenSettings: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

/** full: everything · medium: langs + mode action · compact: mode action + close */
type Density = "full" | "medium" | "compact";

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("button, select, input, textarea, a, label, option"),
  );
}

function densityForWidth(width: number): Density {
  if (width < 300) return "compact";
  if (width < 400) return "medium";
  return "full";
}

export function LanguageBar({
  sourceLang,
  targetLang,
  autoCapture,
  busy,
  onSourceChange,
  onTargetChange,
  onSwap,
  onToggleAuto,
  onTranslate,
  onOpenSettings,
  onMinimize,
  onClose,
}: Props) {
  const chromeRef = useRef<HTMLElement>(null);
  const [density, setDensity] = useState<Density>("full");
  const targetOptions = LANGUAGES.filter((l) => l.code !== "auto");

  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return;

    const update = (width: number) => setDensity(densityForWidth(width));
    update(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      update(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const startWindowDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    void getCurrentWindow().startDragging();
  };

  // compact: Auto+X or Translate+X
  // medium: languages + that mode action + X
  // full: everything
  const showLanguages = density !== "compact";
  const showSwap = density === "full";
  const showSettings = density === "full";
  // Compact: Auto+X (auto on) or Translate+X (auto off).
  // Medium: also languages; keep Auto visible when off so it can be re-enabled.
  const showAuto = autoCapture || density !== "compact";
  const showTranslate = !autoCapture || density === "full";

  return (
    <header
      ref={chromeRef}
      className={`chrome density-${density}`}
      data-tauri-drag-region
      onPointerDown={startWindowDrag}
    >
      {showLanguages && (
        <div className="lang-group" data-tauri-drag-region>
          <label className="sr-only" htmlFor="source-lang">
            Source language
          </label>
          <select
            id="source-lang"
            className="lang-select"
            value={sourceLang}
            onChange={(e) => onSourceChange(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          {showSwap && (
            <button
              type="button"
              className="icon-btn swap-btn"
              onClick={onSwap}
              title="Swap languages"
              aria-label="Swap languages"
              disabled={sourceLang === "auto"}
            >
              ⇄
            </button>
          )}

          <label className="sr-only" htmlFor="target-lang">
            Target language
          </label>
          <select
            id="target-lang"
            className="lang-select"
            value={targetLang}
            onChange={(e) => onTargetChange(e.target.value)}
          >
            {targetOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!showLanguages && <div className="chrome-spacer" data-tauri-drag-region />}

      <div className="chrome-actions" data-tauri-drag-region>
        {showAuto && (
          <button
            type="button"
            className={`pill-btn ${autoCapture ? "active" : ""}`}
            onClick={onToggleAuto}
            title="Auto-capture when window stops moving"
          >
            Auto
          </button>
        )}
        {showTranslate && (
          <button
            type="button"
            className="primary-btn"
            onClick={onTranslate}
            disabled={busy}
          >
            {busy ? "…" : "Translate"}
          </button>
        )}
        {showSettings && (
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>
        )}
      </div>

      <div className="window-controls">
        <button
          type="button"
          className="icon-btn minimize-btn"
          onClick={onMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          ─
        </button>
        <button
          type="button"
          className="icon-btn close-btn"
          onClick={onClose}
          title="Close window"
          aria-label="Close window"
        >
          ×
        </button>
      </div>
    </header>
  );
}
