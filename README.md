# OCR Translate Overlay

Lightweight always-on-top glass window that OCR-captures on-screen text and translates it via OpenRouter vision models.

## Stack

- Tauri 2 + React + Vite + TypeScript
- Rust screen capture (`xcap`) + OpenRouter chat completions (vision)

## Setup

1. Install [Rust](https://www.rust-lang.org/tools/install) and a Node LTS.
2. On Windows, install WebView2 (usually already present).
3. From this folder:

```bash
npm install
npm run tauri dev
```

4. Open **Settings** (gear) and paste your [OpenRouter API key](https://openrouter.ai/keys).
5. Drag the glass over text. With **Auto** on, capture runs ~500ms after the window stops moving. Or press **Translate**.

## Notes

- Source language supports **Detect language**.
- Default model: `google/gemini-2.5-flash` (change in Settings).
- API key and preferences persist locally via `tauri-plugin-store`.
