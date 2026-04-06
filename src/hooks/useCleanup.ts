import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";

let cleanupId = 0;

const MAX_CLEANUPS = 10000;
let _cleanupLeakWarned = false;

/**
 * Register a cleanup that fires on unmount AND app exit (signals, crashes).
 * useEffect cleanup does NOT fire reliably in Storm's reconciler. Use this instead.
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
      `[storm] Warning: cleanup map has ${renderContext.cleanups.size} entries, possible leak\n`,
    );
  }
}
