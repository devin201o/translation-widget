# OCR Translate Overlay

Lightweight always-on-top glass window that OCR-captures on-screen text and translates it via OpenRouter vision models.

## Share with someone else (Windows)

They do **not** need Node, Rust, or this source code.

### Build the installer (on your PC)

```bash
npm install
npm run tauri build
```

When it finishes, the installer is here:

`src-tauri/target/release/bundle/nsis/OCR Translate_0.1.0_x64-setup.exe`

Send that one file (email, USB drive, etc.).

### On their PC

1. Double-click the setup `.exe` and install (current-user install, no admin needed in most cases).
2. Open **OCR Translate** from the Start menu.
3. Click the gear, paste an [OpenRouter API key](https://openrouter.ai/keys), and Save.
4. Drag the glass over text and press **Translate** (or leave **Auto** on).

Notes for older Windows PCs:

- Needs **Windows 10/11** (64-bit).
- Uses Microsoft **WebView2** (usually already installed). If missing, the installer can download it.

### Portable exe (optional)

After building, a raw app binary is also at:

`src-tauri/target/release/OCR Translate.exe`

The **setup installer** is usually easier for non-technical users.

## Develop locally

1. Install [Rust](https://www.rust-lang.org/tools/install) and a Node LTS.
2. From this folder:

```bash
npm install
npm run tauri dev
```

## Notes

- Source language supports **Detect language**.
- Default model: `google/gemini-2.5-flash` (change in Settings).
- API key and preferences persist locally via `tauri-plugin-store`.
