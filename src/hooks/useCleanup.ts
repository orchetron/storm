/**
 * useCleanup — register a cleanup function that runs when the app unmounts.
 *
 * Since useEffect cleanup doesn't fire in our custom reconciler, this is
 * the only way to clean up timers, listeners, etc.
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";

let cleanupId = 0;

/**
 * Register a cleanup function that runs when the app unmounts.
 * Since useEffect cleanup doesn't fire in our reconciler, this is
 * the only way to clean up timers, listeners, etc.
 */
export function useCleanup(fn: () => void): void {
  const { renderContext } = useTui();
  const idRef = useRef(`cleanup-${cleanupId++}`);
  // Always update to latest cleanup function
  renderContext.cleanups.set(idRef.current, fn);
}
