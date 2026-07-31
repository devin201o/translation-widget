import { useState } from "react";
import type { AppSettings } from "../lib/types";

type Props = {
  settings: AppSettings;
  onSave: (next: AppSettings) => void;
  onClose: () => void;
};

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(settings);

  return (
    <div className="settings-overlay" role="dialog" aria-label="Settings">
      <div className="settings-panel">
        <header className="settings-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <label className="field">
          <span>OpenRouter API key</span>
          <input
            type="password"
            value={draft.apiKey}
            autoComplete="off"
            placeholder="sk-or-…"
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Vision model</span>
          <input
            type="text"
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          />
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={draft.autoCapture}
            onChange={(e) =>
              setDraft({ ...draft, autoCapture: e.target.checked })
            }
          />
          <span>Auto-capture after window stops moving</span>
        </label>

        <div className="settings-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
