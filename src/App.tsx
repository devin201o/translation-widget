import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LanguageBar } from "./components/LanguageBar";
import { GlassViewport } from "./components/GlassViewport";
import { ResultStrip } from "./components/ResultStrip";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAutoCapture } from "./hooks/useAutoCapture";
import {
  closeResultsWindow,
  openResultsWindow,
} from "./lib/detachedWindow";
import { pickScreenRegion } from "./lib/regionSelect";
import {
  emitResultsState,
  listenResultsAttach,
  listenResultsDismiss,
  listenResultsRequestState,
  listenResultsTextSize,
  RESULTS_WINDOW_LABEL,
  type ResultsStatePayload,
} from "./lib/resultsSync";
import { getSettings, ocrTranslate, saveSettings } from "./lib/tauri";
import {
  adjustWindowHeight,
  minWindowHeightForResult,
  setWindowForGlassRect,
} from "./lib/windowResize";
import {
  CHROME_INSETS,
  DEFAULT_SETTINGS,
  RESULT_HEIGHT_MAX,
  RESULT_HEIGHT_MIN,
  type AppSettings,
  type ResultTextSize,
  type ResultsPlacement,
} from "./lib/types";
import "./styles.css";

function clampResultHeight(height: number): number {
  return Math.min(
    RESULT_HEIGHT_MAX,
    Math.max(RESULT_HEIGHT_MIN, Math.round(height)),
  );
}

function normalizeTextSize(value: unknown): ResultTextSize {
  if (value === "sm" || value === "md" || value === "lg") return value;
  return DEFAULT_SETTINGS.resultTextSize;
}

function buildInsets(
  resultHeight: number | null,
  placement: ResultsPlacement,
  detached: boolean,
) {
  if (resultHeight == null || detached) {
    return {
      top: CHROME_INSETS.top,
      bottom: CHROME_INSETS.bottom,
      left: CHROME_INSETS.left,
      right: CHROME_INSETS.right,
    };
  }

  if (placement === "above") {
    return {
      top: CHROME_INSETS.top + resultHeight,
      bottom: CHROME_INSETS.left,
      left: CHROME_INSETS.left,
      right: CHROME_INSETS.right,
    };
  }

  return {
    top: CHROME_INSETS.top,
    bottom: resultHeight,
    left: CHROME_INSETS.left,
    right: CHROME_INSETS.right,
  };
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [translation, setTranslation] = useState("");
  const [detectedLang, setDetectedLang] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [resultHeight, setResultHeight] = useState(DEFAULT_SETTINGS.resultHeight);
  const [resultsPlacement, setResultsPlacement] =
    useState<ResultsPlacement>("below");
  const [resultsDetached, setResultsDetached] = useState(false);

  const busyRef = useRef(false);
  const requestIdRef = useRef(0);
  const settingsRef = useRef(settings);
  const resultHeightRef = useRef(resultHeight);
  const hasResultRef = useRef(false);
  const placementRef = useRef<ResultsPlacement>("below");
  const detachedRef = useRef(false);
  /** True when the main window height already includes space for an attached result strip. */
  const expandedForResultsRef = useRef(false);
  const pickingRegionRef = useRef(false);

  settingsRef.current = settings;
  resultHeightRef.current = resultHeight;
  placementRef.current = resultsPlacement;
  detachedRef.current = resultsDetached;
  hasResultRef.current =
    Boolean(error) || Boolean(sourceText) || Boolean(translation);

  const ensureWindowSpaceForResults = useCallback(async (expand: boolean) => {
    if (expand === expandedForResultsRef.current) return;
    const height = resultHeightRef.current;
    const anchor = placementRef.current === "above" ? "bottom" : "top";
    if (expand) {
      await adjustWindowHeight(height, minWindowHeightForResult(height), {
        anchor,
      });
    } else {
      await adjustWindowHeight(-height, CHROME_INSETS.top + 80 + 4, {
        anchor,
      });
    }
    expandedForResultsRef.current = expand;
  }, []);

  const buildStatePayload = useCallback((): ResultsStatePayload => {
    return {
      sourceText,
      translation,
      sourceLang: detectedLang,
      error,
      textSize: settings.resultTextSize,
    };
  }, [sourceText, translation, detectedLang, error, settings.resultTextSize]);

  const syncDetachedState = useCallback(async () => {
    if (!detachedRef.current) return;
    await emitResultsState(buildStatePayload());
  }, [buildStatePayload]);

  useEffect(() => {
    void (async () => {
      try {
        const loadedSettings = await getSettings();
        const normalized = {
          ...DEFAULT_SETTINGS,
          ...loadedSettings,
          resultHeight: clampResultHeight(
            loadedSettings.resultHeight ?? DEFAULT_SETTINGS.resultHeight,
          ),
          resultTextSize: normalizeTextSize(loadedSettings.resultTextSize),
        };
        setSettings(normalized);
        setResultHeight(normalized.resultHeight);
        if (!normalized.apiKey) {
          setSettingsOpen(true);
        }
      } catch {
        setSettings(DEFAULT_SETTINGS);
        setResultHeight(DEFAULT_SETTINGS.resultHeight);
        setSettingsOpen(true);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    void syncDetachedState();
  }, [syncDetachedState]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    void listenResultsRequestState(() => {
      void syncDetachedState();
    }).then((u) => unsubs.push(u));

    void listenResultsAttach(() => {
      void (async () => {
        await closeResultsWindow();
        detachedRef.current = false;
        setResultsDetached(false);
        await ensureWindowSpaceForResults(true);
      })();
    }).then((u) => unsubs.push(u));

    void listenResultsDismiss(() => {
      void (async () => {
        await closeResultsWindow();
        detachedRef.current = false;
        setResultsDetached(false);
        await ensureWindowSpaceForResults(false);
        setSourceText("");
        setTranslation("");
        setDetectedLang(undefined);
        setError(null);
      })();
    }).then((u) => unsubs.push(u));

    void listenResultsTextSize((size) => {
      void persistRef.current({
        ...settingsRef.current,
        resultTextSize: normalizeTextSize(size),
      });
    }).then((u) => unsubs.push(u));

    return () => unsubs.forEach((u) => u());
  }, [syncDetachedState, ensureWindowSpaceForResults]);

  // If the detached window is closed externally, treat as reattach.
  useEffect(() => {
    if (!resultsDetached) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void WebviewWindow.getByLabel(RESULTS_WINDOW_LABEL).then((win) => {
      if (!win || cancelled) return;
      void win.onCloseRequested(async () => {
        detachedRef.current = false;
        setResultsDetached(false);
        await ensureWindowSpaceForResults(true);
      }).then((u) => {
        unlisten = u;
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [resultsDetached, ensureWindowSpaceForResults]);

  const persistRef = useRef(async (_next: AppSettings) => {});
  const persist = useCallback(async (next: AppSettings) => {
    const normalized = {
      ...next,
      resultHeight: clampResultHeight(next.resultHeight),
      resultTextSize: normalizeTextSize(next.resultTextSize),
    };
    setSettings(normalized);
    setResultHeight(normalized.resultHeight);
    try {
      await saveSettings(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  persistRef.current = persist;

  const runTranslate = useCallback(async () => {
    if (busyRef.current) return;

    const current = settingsRef.current;
    if (!current.apiKey.trim()) {
      setError("Add your OpenRouter API key in settings.");
      setSettingsOpen(true);
      return;
    }

    const id = ++requestIdRef.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      const attachedResults = hasResultRef.current && !detachedRef.current;
      const result = await ocrTranslate(
        buildInsets(
          attachedResults ? resultHeightRef.current : null,
          placementRef.current,
          detachedRef.current,
        ),
        current.sourceLang,
        current.targetLang,
      );

      if (id !== requestIdRef.current) return;

      // Grow the window before mounting the result strip so the glass
      // keeps its size instead of collapsing to zero.
      if (!detachedRef.current) {
        await ensureWindowSpaceForResults(true);
      }

      setSourceText(result.text);
      setTranslation(result.translation);
      setDetectedLang(result.source_lang);
      if (!result.text && !result.translation) {
        setError("No readable text found in the glass region.");
      }
    } catch (e) {
      if (id !== requestIdRef.current) return;
      if (!detachedRef.current) {
        await ensureWindowSpaceForResults(true);
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === requestIdRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [ensureWindowSpaceForResults]);

  useAutoCapture({
    enabled: loaded && settings.autoCapture && !settingsOpen,
    onStill: () => {
      void runTranslate();
    },
  });

  const onSwap = () => {
    if (settings.sourceLang === "auto") return;
    void persist({
      ...settings,
      sourceLang: settings.targetLang,
      targetLang: settings.sourceLang,
    });
  };

  const onFlipPlacement = () => {
    setResultsPlacement((prev) => {
      const next = prev === "below" ? "above" : "below";
      placementRef.current = next;
      return next;
    });
  };

  const onDetach = async () => {
    if (resultsDetached) {
      await closeResultsWindow();
      detachedRef.current = false;
      setResultsDetached(false);
      await ensureWindowSpaceForResults(true);
      return;
    }

    const main = getCurrentWindow();
    const factor = await main.scaleFactor();
    const size = await main.outerSize();
    const width = size.width / factor;
    await openResultsWindow(width, Math.max(140, resultHeight + 40));
    await ensureWindowSpaceForResults(false);
    detachedRef.current = true;
    setResultsDetached(true);
    await emitResultsState(buildStatePayload());
  };

  const onMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const onClose = async () => {
    await closeResultsWindow();
    await getCurrentWindow().close();
  };

  const onResizeRegion = async () => {
    if (busyRef.current || pickingRegionRef.current) return;
    pickingRegionRef.current = true;

    const main = getCurrentWindow();
    const attachedResults = hasResultRef.current && !detachedRef.current;
    const insets = buildInsets(
      attachedResults ? resultHeightRef.current : null,
      placementRef.current,
      detachedRef.current,
    );

    try {
      const region = await pickScreenRegion();
      if (region) {
        await setWindowForGlassRect(region, insets);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      pickingRegionRef.current = false;
      await main.show();
      await main.setFocus();
      if (detachedRef.current) {
        const results = await WebviewWindow.getByLabel(RESULTS_WINDOW_LABEL);
        if (results) {
          // Keep detached results where the user left them; only unhide.
          await results.show();
        }
      }
    }
  };

  const hasResult =
    Boolean(error) || Boolean(sourceText) || Boolean(translation);
  const showAttachedResults = hasResult && !resultsDetached;

  if (!loaded) {
    return <div className="app loading-shell" />;
  }

  const resultStrip = (
    <ResultStrip
      sourceText={sourceText}
      translation={translation}
      sourceLang={detectedLang}
      error={error}
      height={resultHeight}
      placement={resultsPlacement}
      onHeightChange={setResultHeight}
      onHeightCommit={(height) => {
        void persist({ ...settings, resultHeight: height });
      }}
      textSize={settings.resultTextSize}
      onTextSizeChange={(resultTextSize) => {
        void persist({ ...settings, resultTextSize });
      }}
      onFlip={onFlipPlacement}
      onDetach={() => void onDetach()}
      onDismiss={() => {
        void (async () => {
          await ensureWindowSpaceForResults(false);
          setSourceText("");
          setTranslation("");
          setDetectedLang(undefined);
          setError(null);
        })();
      }}
    />
  );

  return (
    <div
      className={`app ${
        showAttachedResults ? `results-${resultsPlacement}` : "results-none"
      }`}
    >
      <LanguageBar
        sourceLang={settings.sourceLang}
        targetLang={settings.targetLang}
        autoCapture={settings.autoCapture}
        busy={busy}
        onSourceChange={(sourceLang) => void persist({ ...settings, sourceLang })}
        onTargetChange={(targetLang) => void persist({ ...settings, targetLang })}
        onSwap={onSwap}
        onToggleAuto={() =>
          void persist({ ...settings, autoCapture: !settings.autoCapture })
        }
        onTranslate={() => void runTranslate()}
        onOpenSettings={() => setSettingsOpen(true)}
        onMinimize={() => void onMinimize()}
        onClose={() => void onClose()}
      />

      {showAttachedResults && resultsPlacement === "above" && resultStrip}

      <GlassViewport
        busy={busy}
        onResizeRegion={() => void onResizeRegion()}
      />

      {showAttachedResults && resultsPlacement === "below" && resultStrip}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            void persist({ ...next, resultHeight }).then(() =>
              setSettingsOpen(false),
            );
          }}
        />
      )}
    </div>
  );
}
