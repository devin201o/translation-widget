import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { GlassRegion } from "./regionSelect";
import { CHROME_INSETS } from "./types";

const MIN_GLASS_HEIGHT = 80;
const MIN_GLASS_WIDTH = 160;
const MIN_WINDOW_WIDTH = 200;

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

export type CaptureInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * Position and size the current window so its glass (inner area after insets)
 * matches the given logical screen rectangle.
 */
export async function setWindowForGlassRect(
  glass: GlassRegion,
  insets: CaptureInsets,
): Promise<void> {
  const glassW = Math.max(MIN_GLASS_WIDTH, Math.round(glass.width));
  const glassH = Math.max(MIN_GLASS_HEIGHT, Math.round(glass.height));
  const width = Math.max(
    MIN_WINDOW_WIDTH,
    glassW + insets.left + insets.right,
  );
  const height = Math.max(
    insets.top + MIN_GLASS_HEIGHT + insets.bottom,
    glassH + insets.top + insets.bottom,
  );

  // Keep the glass top-left anchored when clamping grows the rect.
  const x = Math.round(glass.x - insets.left);
  const y = Math.round(glass.y - insets.top);

  const win = getCurrentWindow();
  await win.setPosition(new LogicalPosition(x, y));
  await win.setSize(new LogicalSize(width, height));
}
