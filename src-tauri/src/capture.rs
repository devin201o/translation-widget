use base64::{engine::general_purpose::STANDARD, Engine};
use image::imageops::FilterType;
use image::{DynamicImage, ImageFormat};
use serde::Serialize;
use std::io::Cursor;
use tauri::{AppHandle, Manager, WebviewWindow};
use thiserror::Error;
use xcap::Monitor;

const MAX_WIDTH: u32 = 1280;

#[derive(Debug, Error)]
pub enum CaptureError {
    #[error("{0}")]
    Message(String),
}

impl Serialize for CaptureError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CaptureInsets {
    pub top: u32,
    pub bottom: u32,
    pub left: u32,
    pub right: u32,
}

#[derive(Debug, Serialize)]
pub struct CaptureResult {
    pub image_base64: String,
    pub mime: String,
    pub width: u32,
    pub height: u32,
}

#[cfg(windows)]
fn set_exclude_from_capture(window: &WebviewWindow, exclude: bool) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
    };

    let Ok(handle) = window.window_handle() else {
        return;
    };
    let RawWindowHandle::Win32(win32) = handle.as_raw() else {
        return;
    };

    let hwnd = HWND(win32.hwnd.get() as *mut _);
    let affinity = if exclude {
        WDA_EXCLUDEFROMCAPTURE
    } else {
        WDA_NONE
    };
    let _ = unsafe { SetWindowDisplayAffinity(hwnd, affinity) };
}

#[cfg(not(windows))]
fn set_exclude_from_capture(_window: &WebviewWindow, _exclude: bool) {}

pub fn exclude_window_from_capture(window: &WebviewWindow) {
    set_exclude_from_capture(window, true);
}

fn find_monitor_for_point(x: i32, y: i32) -> Result<Monitor, CaptureError> {
    Monitor::from_point(x, y).map_err(|e| CaptureError::Message(e.to_string()))
}

fn encode_jpeg(img: &DynamicImage) -> Result<(Vec<u8>, u32, u32), CaptureError> {
    let mut rgba = img.to_rgba8();
    let (mut w, mut h) = rgba.dimensions();

    if w > MAX_WIDTH {
        let scale = MAX_WIDTH as f32 / w as f32;
        let new_h = ((h as f32) * scale).round().max(1.0) as u32;
        let resized = image::imageops::resize(&rgba, MAX_WIDTH, new_h, FilterType::Triangle);
        rgba = resized;
        w = MAX_WIDTH;
        h = new_h;
    }

    let dyn_img = DynamicImage::ImageRgba8(rgba);
    let mut buf = Cursor::new(Vec::new());
    dyn_img
        .write_to(&mut buf, ImageFormat::Jpeg)
        .map_err(|e| CaptureError::Message(e.to_string()))?;
    Ok((buf.into_inner(), w, h))
}

pub fn capture_overlay_region(
    app: &AppHandle,
    insets: CaptureInsets,
) -> Result<CaptureResult, CaptureError> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| CaptureError::Message("Main window not found".into()))?;

    let position = window
        .outer_position()
        .map_err(|e| CaptureError::Message(e.to_string()))?;
    let size = window
        .outer_size()
        .map_err(|e| CaptureError::Message(e.to_string()))?;
    let scale = window
        .scale_factor()
        .map_err(|e| CaptureError::Message(e.to_string()))?;

    let top = ((insets.top as f64) * scale).round() as u32;
    let bottom = ((insets.bottom as f64) * scale).round() as u32;
    let left = ((insets.left as f64) * scale).round() as u32;
    let right = ((insets.right as f64) * scale).round() as u32;

    let capture_w = size.width.saturating_sub(left.saturating_add(right));
    let capture_h = size.height.saturating_sub(top.saturating_add(bottom));

    if capture_w < 8 || capture_h < 8 {
        return Err(CaptureError::Message(
            "Capture region is too small. Resize the window.".into(),
        ));
    }

    let abs_x = position.x + left as i32;
    let abs_y = position.y + top as i32;

    // Keep the overlay visible. On Windows we exclude it from capture APIs
    // so hide()/show() is unnecessary (and looks like the app crashed).
    set_exclude_from_capture(&window, true);
    std::thread::sleep(std::time::Duration::from_millis(16));

    let monitor = find_monitor_for_point(abs_x, abs_y)?;
    let mon_x = monitor
        .x()
        .map_err(|e| CaptureError::Message(e.to_string()))?;
    let mon_y = monitor
        .y()
        .map_err(|e| CaptureError::Message(e.to_string()))?;

    let rel_x = (abs_x - mon_x).max(0) as u32;
    let rel_y = (abs_y - mon_y).max(0) as u32;

    let rgba = monitor
        .capture_region(rel_x, rel_y, capture_w, capture_h)
        .map_err(|e| CaptureError::Message(e.to_string()))?;

    let dyn_img = DynamicImage::ImageRgba8(rgba);
    let (bytes, width, height) = encode_jpeg(&dyn_img)?;
    Ok(CaptureResult {
        image_base64: STANDARD.encode(bytes),
        mime: "image/jpeg".into(),
        width,
        height,
    })
}
