/**
 * useTimeout — one-shot timer hook.
 *
 * Calls the callback after the given delay. Uses eager registration
 * (not useEffect) and refs for the latest callback. Cleaned up on unmount.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";

export function useTimeout(
  callback: () => void,
  delayMs: number,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Start ONCE eagerly
  const registeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, delayMs);
  }

  // Cleanup on unmount
  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
  });
}
