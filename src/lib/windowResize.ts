import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CHROME_INSETS } from "./types";

const MIN_GLASS_HEIGHT = 80;

export async function getLogicalInnerSize(): Promise<{ width: number; height: number }> {
  const win = getCurrentWindow();
  const factor = await win.scaleFactor();
  const size = await win.innerSize();
  return {
    width: size.width / factor,
    height: size.height / factor,
  };
}

export async function setLogicalInnerHeight(height: number): Promise<void> {
  const win = getCurrentWindow();
  const { width } = await getLogicalInnerSize();
  await win.setSize(new LogicalSize(width, Math.round(height)));
}

/** Grow/shrink the OS window by a logical-pixel delta. Returns applied delta. */
export async function adjustWindowHeight(
  delta: number,
  minHeight: number,
): Promise<number> {
  const { height } = await getLogicalInnerSize();
  const next = Math.max(minHeight, height + delta);
  const applied = next - height;
  if (Math.abs(applied) < 0.5) return 0;
  await setLogicalInnerHeight(next);
  return applied;
}

export function minWindowHeightForResult(resultHeight: number): number {
  return CHROME_INSETS.top + MIN_GLASS_HEIGHT + resultHeight + 4;
}
