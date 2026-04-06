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

  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
  });
}
