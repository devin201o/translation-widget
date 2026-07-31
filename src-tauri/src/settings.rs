use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use thiserror::Error;

const STORE_PATH: &str = "settings.json";

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("{0}")]
    Message(String),
}

impl Serialize for SettingsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub api_key: String,
    pub model: String,
    pub source_lang: String,
    pub target_lang: String,
    pub auto_capture: bool,
    #[serde(default = "default_result_height")]
    pub result_height: u32,
    #[serde(default = "default_result_text_size")]
    pub result_text_size: String,
}

fn default_result_height() -> u32 {
    120
}

fn default_result_text_size() -> String {
    "md".into()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "google/gemini-2.5-flash".into(),
            source_lang: "auto".into(),
            target_lang: "en".into(),
            auto_capture: true,
            result_height: default_result_height(),
            result_text_size: default_result_text_size(),
        }
    }
}

pub fn load_settings(app: &AppHandle) -> Result<AppSettings, SettingsError> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SettingsError::Message(e.to_string()))?;

    match store.get("settings") {
        Some(value) => Ok(serde_json::from_value(value.clone())
            .unwrap_or_else(|_| AppSettings::default())),
        None => Ok(AppSettings::default()),
    }
}

pub fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), SettingsError> {
    let store = app
        .store(STORE_PATH)
        .map_err(|e| SettingsError::Message(e.to_string()))?;

    let value = serde_json::to_value(settings)
        .map_err(|e| SettingsError::Message(e.to_string()))?;
    store.set("settings", value);
    store
        .save()
        .map_err(|e| SettingsError::Message(e.to_string()))?;
    Ok(())
}
