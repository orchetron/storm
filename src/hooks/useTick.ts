/**
 * useTick — the safe animation/polling hook.
 *
 * Calls your callback every `intervalMs` with an incrementing tick count.
 * Two modes controlled by `reactive` (default: true):
 *
 * **Reactive mode** (default) — triggers a React re-render after each
 * tick so computed values in JSX update naturally. Use for live metrics,
 * polling, streaming text, or any interval ≥ ~50ms:
 *
 * ```tsx
 * useTick(500, () => {
 *   dataRef.current.push(fetchLatest());
 * });
 * const latest = dataRef.current.at(-1); // updates every tick
 * return <Text>{latest}</Text>;
 * ```
 *
 * **Imperative mode** (`reactive: false`) — calls `requestRender()`
 * for a cell-level repaint with zero React reconciliation. Use for
 * high-frequency animation (spinners, frame cycling):
 *
 * ```tsx
 * useTick(80, (tick) => {
 *   spinnerRef.current.text = FRAMES[tick % FRAMES.length];
 * }, { reactive: false });
 * ```
 *
 * Returns the current tick count.
 */

import { useRef, useState } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export interface UseTickOptions {
  /** When false, the timer pauses. Default: true. */
  active?: boolean;
  /**
   * When true (default), triggers a React re-render after each tick so
   * computed values in JSX update. Set to false for pure imperative
   * animation where you only mutate text nodes via refs.
   */
  reactive?: boolean;
}

export function useTick(
  intervalMs: number,
  callback: (tick: number) => void,
  options: UseTickOptions = {},
): number {
  const { requestRender } = useTui();
  const active = options.active ?? true;
  const reactive = options.reactive ?? true;

  const tickRef = useRef(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const activeRef = useRef(active);
  activeRef.current = active;

  // State counter forces React to re-render so computed values
  // derived from refs update in JSX. Always called (rules of hooks).
  const [, setRenderCount] = useState(0);
  const reactiveRef = useRef(reactive);
  reactiveRef.current = reactive;

  const registeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!registeredRef.current) {
    registeredRef.current = true;
    timerRef.current = setInterval(() => {
      if (!activeRef.current) return;
      tickRef.current++;
      callbackRef.current(tickRef.current);
      if (reactiveRef.current) {
        setRenderCount((c) => c + 1);
      } else {
        requestRender();
      }
    }, intervalMs);
  }

  useCleanup(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  return tickRef.current;
}
