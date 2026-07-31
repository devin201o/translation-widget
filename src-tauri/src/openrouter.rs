use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum OpenRouterError {
    #[error("{0}")]
    Message(String),
}

impl Serialize for OpenRouterError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize)]
pub struct TranslateResult {
    pub source_lang: String,
    pub text: String,
    pub translation: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OcrJson {
    source_lang: String,
    text: String,
    translation: String,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    error: Option<ApiErrorDetail>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorDetail {
    message: Option<String>,
}

fn language_label(code: &str) -> String {
    match code {
        "auto" => "auto-detect".into(),
        "en" => "English".into(),
        "es" => "Spanish".into(),
        "fr" => "French".into(),
        "de" => "German".into(),
        "it" => "Italian".into(),
        "pt" => "Portuguese".into(),
        "ru" => "Russian".into(),
        "zh" => "Chinese".into(),
        "ja" => "Japanese".into(),
        "ko" => "Korean".into(),
        "ar" => "Arabic".into(),
        "hi" => "Hindi".into(),
        "nl" => "Dutch".into(),
        "pl" => "Polish".into(),
        "tr" => "Turkish".into(),
        "vi" => "Vietnamese".into(),
        "th" => "Thai".into(),
        "id" => "Indonesian".into(),
        other => other.to_string(),
    }
}

fn build_prompt(source_lang: &str, target_lang: &str) -> String {
    let source = if source_lang == "auto" {
        "Auto-detect the source language".to_string()
    } else {
        format!("Source language is {}", language_label(source_lang))
    };

    format!(
        "You are an OCR and translation engine. Read ONLY the text visible in the image.\n\
         {source}. Translate the extracted text into {target}.\n\
         Ignore UI chrome, watermarks, and non-text graphics.\n\
         Respond with JSON only, no markdown, no code fences, exact shape:\n\
         {{\"source_lang\":\"<iso639-1 or detected name>\",\"text\":\"<exact OCR text>\",\"translation\":\"<translated text>\"}}\n\
         If there is no readable text, return empty strings for text and translation.",
        target = language_label(target_lang)
    )
}

fn extract_json(content: &str) -> Result<OcrJson, OpenRouterError> {
    let trimmed = content.trim();
    if let Ok(parsed) = serde_json::from_str::<OcrJson>(trimmed) {
        return Ok(parsed);
    }

    let start = trimmed
        .find('{')
        .ok_or_else(|| OpenRouterError::Message("Model did not return JSON".into()))?;
    let end = trimmed
        .rfind('}')
        .ok_or_else(|| OpenRouterError::Message("Model did not return JSON".into()))?;
    let slice = &trimmed[start..=end];
    serde_json::from_str(slice)
        .map_err(|e| OpenRouterError::Message(format!("Failed to parse model JSON: {e}")))
}

pub async fn ocr_and_translate(
    api_key: &str,
    model: &str,
    source_lang: &str,
    target_lang: &str,
    image_base64: &str,
    mime: &str,
) -> Result<TranslateResult, OpenRouterError> {
    if api_key.trim().is_empty() {
        return Err(OpenRouterError::Message(
            "OpenRouter API key is missing. Open settings to add one.".into(),
        ));
    }

    let prompt = build_prompt(source_lang, target_lang);
    let data_url = format!("data:{mime};base64,{image_base64}");

    let body = serde_json::json!({
        "model": model,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": [
                    { "type": "text", "text": prompt },
                    {
                        "type": "image_url",
                        "image_url": { "url": data_url }
                    }
                ]
            }
        ]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://github.com/translation-widget")
        .header("X-Title", "OCR Translate Overlay")
        .json(&body)
        .send()
        .await
        .map_err(|e| OpenRouterError::Message(format!("Network error: {e}")))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| OpenRouterError::Message(format!("Failed reading response: {e}")))?;

    if !status.is_success() {
        let detail = serde_json::from_str::<ApiErrorBody>(&text)
            .ok()
            .and_then(|b| b.error)
            .and_then(|e| e.message)
            .unwrap_or(text);
        return Err(OpenRouterError::Message(format!(
            "OpenRouter error ({status}): {detail}"
        )));
    }

    let parsed: ChatCompletionResponse = serde_json::from_str(&text)
        .map_err(|e| OpenRouterError::Message(format!("Invalid OpenRouter response: {e}")))?;

    let content = parsed
        .choices
        .first()
        .and_then(|c| c.message.content.as_ref())
        .ok_or_else(|| OpenRouterError::Message("Empty model response".into()))?;

    let ocr = extract_json(content)?;
    Ok(TranslateResult {
        source_lang: ocr.source_lang,
        text: ocr.text,
        translation: ocr.translation,
    })
}
