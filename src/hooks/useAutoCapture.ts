import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const DEBOUNCE_MS = 500;
/** Ignore move/resize noise right after enabling (e.g. settings close). */
const ARM_MS = 800;

type Options = {
  enabled: boolean;
  onStill: () => void;
};

export function useAutoCapture({ enabled, onStill }: Options) {
  const onStillRef = useRef(onStill);
  onStillRef.current = onStill;

  useEffect(() => {
    if (!enabled) return;

    const window = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let armed = false;
    const armTimer = setTimeout(() => {
      armed = true;
    }, ARM_MS);

    const schedule = () => {
      if (!armed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onStillRef.current();
      }, DEBOUNCE_MS);
    };

    const unsubs: Array<() => void> = [];

    void window.onMoved(() => schedule()).then((u) => unsubs.push(u));
    void window.onResized(() => schedule()).then((u) => unsubs.push(u));

    return () => {
      clearTimeout(armTimer);
      if (timer) clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [enabled]);
}
