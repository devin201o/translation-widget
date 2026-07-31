import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, CaptureInsets, TranslateResult } from "./types";

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function ocrTranslate(
  insets: CaptureInsets,
  sourceLang: string,
  targetLang: string,
): Promise<TranslateResult> {
  return invoke<TranslateResult>("ocr_translate", {
    insets,
    sourceLang,
    targetLang,
  });
}
