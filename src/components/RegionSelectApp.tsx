import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  emitRegionCancelled,
  emitRegionSelected,
} from "../lib/regionSelect";
import "../styles.css";

const MIN_DRAG_PX = 8;

type Point = { x: number; y: number };

type DragState = {
  start: Point;
  current: Point;
};

function normalizeRect(a: Point, b: Point) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { x, y, width, height };
}

export default function RegionSelectApp() {
  const [drag, setDrag] = useState<DragState | null>(null);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const finishedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const win = getCurrentWindow();
      const factor = await win.scaleFactor();
      const outer = await win.outerPosition();
      originRef.current = {
        x: outer.x / factor,
        y: outer.y / factor,
      };
      await win.setFocus();
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const teardownOverlay = async () => {
    const win = getCurrentWindow();
    try {
      await win.setIgnoreCursorEvents(true);
      await win.hide();
    } catch {
      // Window may already be tearing down from the parent.
    }
  };

  const cancel = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    await teardownOverlay();
    await emitRegionCancelled();
  };

  const complete = async (clientStart: Point, clientEnd: Point) => {
    if (finishedRef.current) return;
    const local = normalizeRect(clientStart, clientEnd);
    if (local.width < MIN_DRAG_PX || local.height < MIN_DRAG_PX) {
      await cancel();
      return;
    }
    finishedRef.current = true;
    const origin = originRef.current;
    const region = {
      x: origin.x + local.x,
      y: origin.y + local.y,
      width: local.width,
      height: local.height,
    };
    // Hide before emit so the dim cannot linger if parent destroy races.
    await teardownOverlay();
    await emitRegionSelected(region);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      e.preventDefault();
      void cancel();
      return;
    }
    if (e.button !== 0 || finishedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = { x: e.clientX, y: e.clientY };
    setDrag({ start: point, current: point });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || finishedRef.current) return;
    setDrag({ ...drag, current: { x: e.clientX, y: e.clientY } });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || finishedRef.current) return;
    if (e.button === 2) {
      void cancel();
      return;
    }
    const end = { x: e.clientX, y: e.clientY };
    setDrag(null);
    void complete(drag.start, end);
  };

  const selection = drag ? normalizeRect(drag.start, drag.current) : null;

  return (
    <div
      className="region-select"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        void cancel();
      }}
    >
      {!selection && <div className="region-select-dim" />}
      {selection && selection.width > 0 && selection.height > 0 && (
        <>
          <div
            className="region-select-rect"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height,
            }}
          />
          <div
            className="region-select-size"
            style={{
              left: selection.x + selection.width / 2,
              top: Math.max(8, selection.y - 28),
            }}
          >
            {Math.round(selection.width)} × {Math.round(selection.height)}
          </div>
        </>
      )}
      {!drag && (
        <div className="region-select-hint">
          Drag to set the glass region · Esc to cancel
        </div>
      )}
    </div>
  );
}
