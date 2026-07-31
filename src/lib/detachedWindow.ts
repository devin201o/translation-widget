import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { RESULTS_WINDOW_LABEL } from "./resultsSync";

export async function openResultsWindow(
  width: number,
  height: number,
): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(RESULTS_WINDOW_LABEL);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return existing;
  }

  const main = getCurrentWindow();
  const factor = await main.scaleFactor();
  const outer = await main.outerPosition();
  const size = await main.outerSize();
  const x = outer.x / factor;
  const y = (outer.y + size.height) / factor + 8;

  const win = new WebviewWindow(RESULTS_WINDOW_LABEL, {
    url: "/?view=results",
    title: "Translation",
    width: Math.max(240, Math.round(width)),
    height: Math.max(120, Math.round(height)),
    minWidth: 220,
    minHeight: 96,
    x: Math.round(x),
    y: Math.round(y),
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    shadow: false,
    resizable: true,
    focus: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      resolve();
    }, 3000);
    void win.once("tauri://created", () => {
      window.clearTimeout(timeout);
      resolve();
    });
    void win.once("tauri://error", (event) => {
      window.clearTimeout(timeout);
      reject(event);
    });
  });

  return win;
}

export async function closeResultsWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(RESULTS_WINDOW_LABEL);
  if (existing) {
    await existing.close();
  }
}

export async function positionResultsNearMain(
  width: number,
  height: number,
): Promise<void> {
  const existing = await WebviewWindow.getByLabel(RESULTS_WINDOW_LABEL);
  if (!existing) return;

  const main = getCurrentWindow();
  const factor = await main.scaleFactor();
  const outer = await main.outerPosition();
  const size = await main.outerSize();
  await existing.setSize(
    new LogicalSize(Math.max(240, Math.round(width)), Math.max(120, Math.round(height))),
  );
  await existing.setPosition(
    new LogicalPosition(
      Math.round(outer.x / factor),
      Math.round((outer.y + size.height) / factor + 8),
    ),
  );
}
