import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ResultTextSize } from "./types";

export const RESULTS_WINDOW_LABEL = "results";

export const RESULTS_EVENTS = {
  state: "results://state",
  requestState: "results://request-state",
  attach: "results://attach",
  dismiss: "results://dismiss",
  textSize: "results://text-size",
} as const;

export type ResultsStatePayload = {
  sourceText: string;
  translation: string;
  sourceLang?: string;
  error?: string | null;
  textSize: ResultTextSize;
};

export async function emitResultsState(
  payload: ResultsStatePayload,
): Promise<void> {
  await emit(RESULTS_EVENTS.state, payload);
}

export async function emitResultsRequestState(): Promise<void> {
  await emit(RESULTS_EVENTS.requestState);
}

export async function emitResultsAttach(): Promise<void> {
  await emit(RESULTS_EVENTS.attach);
}

export async function emitResultsDismiss(): Promise<void> {
  await emit(RESULTS_EVENTS.dismiss);
}

export async function emitResultsTextSize(size: ResultTextSize): Promise<void> {
  await emit(RESULTS_EVENTS.textSize, size);
}

export function listenResultsState(
  handler: (payload: ResultsStatePayload) => void,
): Promise<UnlistenFn> {
  return listen<ResultsStatePayload>(RESULTS_EVENTS.state, (event) => {
    handler(event.payload);
  });
}

export function listenResultsRequestState(
  handler: () => void,
): Promise<UnlistenFn> {
  return listen(RESULTS_EVENTS.requestState, () => {
    handler();
  });
}

export function listenResultsAttach(handler: () => void): Promise<UnlistenFn> {
  return listen(RESULTS_EVENTS.attach, () => {
    handler();
  });
}

export function listenResultsDismiss(handler: () => void): Promise<UnlistenFn> {
  return listen(RESULTS_EVENTS.dismiss, () => {
    handler();
  });
}

export function listenResultsTextSize(
  handler: (size: ResultTextSize) => void,
): Promise<UnlistenFn> {
  return listen<ResultTextSize>(RESULTS_EVENTS.textSize, (event) => {
    handler(event.payload);
  });
}
