mod capture;
mod openrouter;
mod settings;

use capture::CaptureInsets;
use openrouter::TranslateResult;
use settings::AppSettings;
use tauri::{AppHandle, Manager};

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<AppSettings, settings::SettingsError> {
    settings::load_settings(&app)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), settings::SettingsError> {
    settings::save_settings(&app, &settings)
}

#[tauri::command]
fn capture_overlay_region(
    app: AppHandle,
    insets: CaptureInsets,
) -> Result<capture::CaptureResult, capture::CaptureError> {
    capture::capture_overlay_region(&app, insets)
}

#[tauri::command]
async fn ocr_translate(
    app: AppHandle,
    insets: CaptureInsets,
    source_lang: String,
    target_lang: String,
) -> Result<TranslateResult, String> {
    let app_settings = settings::load_settings(&app).map_err(|e| e.to_string())?;

    let captured = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || capture::capture_overlay_region(&app, insets)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    openrouter::ocr_and_translate(
        &app_settings.api_key,
        &app_settings.model,
        &source_lang,
        &target_lang,
        &captured.image_base64,
        &captured.mime,
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
                capture::exclude_window_from_capture(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            capture_overlay_region,
            ocr_translate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
