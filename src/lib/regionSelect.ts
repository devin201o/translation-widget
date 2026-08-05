import { emit, listen } from "@tauri-apps/api/event";
import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  primaryMonitor,
  type Monitor,
} from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { RESULTS_WINDOW_LABEL } from "./resultsSync";

export const REGION_SELECT_WINDOW_LABEL = "region-select";

export const REGION_EVENTS = {
  selected: "region://selected",
  cancelled: "region://cancelled",
} as const;

export type GlassRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function monitorLogicalBounds(monitor: Monitor): GlassRegion {
  const pos = monitor.position.toLogical(monitor.scaleFactor);
  const size = monitor.size.toLogical(monitor.scaleFactor);
  return {
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
  };
}

async function virtualScreenBounds(): Promise<GlassRegion> {
  let monitors = await availableMonitors();
  if (monitors.length === 0) {
    const fallback = (await currentMonitor()) ?? (await primaryMonitor());
    if (!fallback) {
      return { x: 0, y: 0, width: 1280, height: 720 };
    }
    monitors = [fallback];
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const monitor of monitors) {
    const bounds = monitorLogicalBounds(monitor);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

async function closeRegionSelectWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(REGION_SELECT_WINDOW_LABEL);
  if (!existing) return;
  // Unblock input immediately in case native destroy lags behind the API.
  await existing.setIgnoreCursorEvents(true);
  await existing.hide();
  // close() can leave always-on-top overlays alive; destroy skips closeRequested.
  await existing.destroy();
}

export async function emitRegionSelected(region: GlassRegion): Promise<void> {
  await emit(REGION_EVENTS.selected, region);
}

export async function emitRegionCancelled(): Promise<void> {
  await emit(REGION_EVENTS.cancelled);
}

/**
 * Hide the main (and results) window, open a fullscreen picker, and resolve
 * with the selected glass region in logical screen coordinates — or null if
 * cancelled.
 */
export async function pickGlassRegion(): Promise<GlassRegion | null> {
  const main = getCurrentWindow();
  const results = await WebviewWindow.getByLabel(RESULTS_WINDOW_LABEL);

  await main.hide();
  if (results) {
    await results.hide();
  }

  await closeRegionSelectWindow();

  const bounds = await virtualScreenBounds();
  const overlay = new WebviewWindow(REGION_SELECT_WINDOW_LABEL, {
    url: "/?view=region-select",
    title: "Select region",
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    shadow: false,
    resizable: false,
    focus: true,
    skipTaskbar: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => resolve(), 3000);
    void overlay.once("tauri://created", () => {
      window.clearTimeout(timeout);
      resolve();
    });
    void overlay.once("tauri://error", (event) => {
      window.clearTimeout(timeout);
      reject(event);
    });
  });

  try {
    return await new Promise<GlassRegion | null>((resolve) => {
      let settled = false;
      const finish = (region: GlassRegion | null) => {
        if (settled) return;
        settled = true;
        void unlistenSelected.then((u) => u());
        void unlistenCancelled.then((u) => u());
        resolve(region);
      };

      const unlistenSelected = listen<GlassRegion>(
        REGION_EVENTS.selected,
        (event) => {
          finish(event.payload);
        },
      );
      const unlistenCancelled = listen(REGION_EVENTS.cancelled, () => {
        finish(null);
      });
    });
  } finally {
    await closeRegionSelectWindow();
  }
}
