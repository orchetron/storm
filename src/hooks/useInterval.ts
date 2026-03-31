/**
 * useInterval — repeating timer hook.
 *
 * Calls the callback at the given interval. Uses eager registration
 * (not useEffect) and refs for the latest callback. Cleaned up on unmount.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";

export function useInterval(
  callback: () => void,
  delayMs: number,
  options: { active?: boolean } = {},
): void {
  const active = options.active ?? true;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Start ONCE eagerly
  const registeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    timerRef.current = setInterval(() => {
      if (!activeRef.current) return;
      callbackRef.current();
    }, delayMs);
  }

  // Cleanup on unmount
  useCleanup(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
  });
}
