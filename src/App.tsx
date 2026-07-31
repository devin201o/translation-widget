import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LanguageBar } from "./components/LanguageBar";
import { GlassViewport } from "./components/GlassViewport";
import { ResultStrip } from "./components/ResultStrip";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAutoCapture } from "./hooks/useAutoCapture";
import { getSettings, ocrTranslate, saveSettings } from "./lib/tauri";
import {
  CHROME_INSETS,
  DEFAULT_SETTINGS,
  RESULT_HEIGHT_MAX,
  RESULT_HEIGHT_MIN,
  type AppSettings,
} from "./lib/types";
import "./styles.css";

function clampResultHeight(height: number): number {
  return Math.min(
    RESULT_HEIGHT_MAX,
    Math.max(RESULT_HEIGHT_MIN, Math.round(height)),
  );
}

function buildInsets(resultHeight: number | null) {
  return {
    top: CHROME_INSETS.top,
    bottom: resultHeight ?? CHROME_INSETS.bottom,
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

  const busyRef = useRef(false);
  const requestIdRef = useRef(0);
  const settingsRef = useRef(settings);
  const resultHeightRef = useRef(resultHeight);
  const hasResultRef = useRef(false);

  settingsRef.current = settings;
  resultHeightRef.current = resultHeight;
  hasResultRef.current =
    Boolean(error) || Boolean(sourceText) || Boolean(translation);

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

  const persist = useCallback(async (next: AppSettings) => {
    const normalized = {
      ...next,
      resultHeight: clampResultHeight(next.resultHeight),
    };
    setSettings(normalized);
    setResultHeight(normalized.resultHeight);
    try {
      await saveSettings(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

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
      const result = await ocrTranslate(
        buildInsets(
          hasResultRef.current ? resultHeightRef.current : null,
        ),
        current.sourceLang,
        current.targetLang,
      );

      if (id !== requestIdRef.current) return;

      setSourceText(result.text);
      setTranslation(result.translation);
      setDetectedLang(result.source_lang);
      if (!result.text && !result.translation) {
        setError("No readable text found in the glass region.");
      }
    } catch (e) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === requestIdRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, []);

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

  const onMinimize = async () => {
    await getCurrentWindow().minimize();
  };

  const onClose = async () => {
    await getCurrentWindow().close();
  };

  if (!loaded) {
    return <div className="app loading-shell" />;
  }

  return (
    <div className="app">
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

      <GlassViewport busy={busy} />

      <ResultStrip
        sourceText={sourceText}
        translation={translation}
        sourceLang={detectedLang}
        error={error}
        height={resultHeight}
        onHeightChange={setResultHeight}
        onHeightCommit={(height) => {
          void persist({ ...settings, resultHeight: height });
        }}
        onDismiss={() => {
          setSourceText("");
          setTranslation("");
          setDetectedLang(undefined);
          setError(null);
        }}
      />

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
