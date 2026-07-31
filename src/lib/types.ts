export type AppSettings = {
  apiKey: string;
  model: string;
  sourceLang: string;
  targetLang: string;
  autoCapture: boolean;
  resultHeight: number;
};

export type CaptureInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type TranslateResult = {
  source_lang: string;
  text: string;
  translation: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: "google/gemini-2.5-flash",
  sourceLang: "auto",
  targetLang: "en",
  autoCapture: true,
  resultHeight: 120,
};

export const LANGUAGES = [
  { code: "auto", label: "Detect language" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Indonesian" },
] as const;

/** Logical CSS px insets matching LanguageBar height / borders. */
export const CHROME_INSETS = {
  top: 44,
  bottom: 0,
  left: 2,
  right: 2,
} as const;

export const RESULT_HEIGHT_MIN = 72;
export const RESULT_HEIGHT_MAX = 320;
