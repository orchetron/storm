/**
 * useCleanup — register a cleanup function that runs when the app unmounts.
 *
 * Since useEffect cleanup doesn't fire in our custom reconciler, this is
 * the only way to clean up timers, listeners, etc.
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";

let cleanupId = 0;

const MAX_CLEANUPS = 10000;
let _cleanupLeakWarned = false;

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

  // Diagnostic: warn if cleanup map grows suspiciously large
  if (!_cleanupLeakWarned && renderContext.cleanups.size > MAX_CLEANUPS) {
    _cleanupLeakWarned = true;
    process.stderr.write(
      `[storm-tui] Warning: cleanup map has ${renderContext.cleanups.size} entries, possible leak\n`,
    );
  }
}
