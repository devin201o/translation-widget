export type ResultTextSize = "sm" | "md" | "lg";

export type AppSettings = {
  apiKey: string;
  model: string;
  sourceLang: string;
  targetLang: string;
  autoCapture: boolean;
  resultHeight: number;
  resultTextSize: ResultTextSize;
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

/** Where the result strip sits relative to the glass. Manual toggle only. */
export type ResultsPlacement = "above" | "below";

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  model: "google/gemini-2.5-flash",
  sourceLang: "auto",
  targetLang: "en",
  autoCapture: true,
  resultHeight: 120,
  resultTextSize: "md",
};

export const RESULT_TEXT_SIZES: {
  id: ResultTextSize;
  label: string;
  sample: string;
}[] = [
  { id: "sm", label: "Small", sample: "A" },
  { id: "md", label: "Medium", sample: "A" },
  { id: "lg", label: "Large", sample: "A" },
];

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
