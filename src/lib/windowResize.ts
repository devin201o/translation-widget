import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CHROME_INSETS } from "./types";

const MIN_GLASS_HEIGHT = 80;

export type HeightAnchor = "top" | "bottom";

export async function getLogicalInnerSize(): Promise<{
  width: number;
  height: number;
}> {
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

/**
 * Grow/shrink the OS window by a logical-pixel delta.
 * - anchor top: keep top edge fixed (grows/shrinks downward)
 * - anchor bottom: keep bottom edge fixed (grows/shrinks upward)
 */
export async function adjustWindowHeight(
  delta: number,
  minHeight: number,
  options: { anchor?: HeightAnchor } = {},
): Promise<number> {
  const anchor = options.anchor ?? "top";
  const win = getCurrentWindow();
  const factor = await win.scaleFactor();
  const size = await win.innerSize();
  const pos = await win.outerPosition();
  const height = size.height / factor;
  const width = size.width / factor;
  const next = Math.max(minHeight, height + delta);
  const applied = next - height;
  if (Math.abs(applied) < 0.5) return 0;

  if (anchor === "bottom") {
    const logicalX = pos.x / factor;
    const logicalY = pos.y / factor;
    await win.setPosition(
      new LogicalPosition(logicalX, Math.round(logicalY - applied)),
    );
  }

  await win.setSize(new LogicalSize(width, Math.round(next)));
  return applied;
}

export function minWindowHeightForResult(resultHeight: number): number {
  return CHROME_INSETS.top + MIN_GLASS_HEIGHT + resultHeight + 4;
}
