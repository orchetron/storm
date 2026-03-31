/**
 * useAsyncCleanup — register an async cleanup function that runs when the app unmounts.
 *
 * Similar to useCleanup, but for async operations (closing connections, flushing
 * buffers, saving state). Async cleanups run in parallel after all sync cleanups,
 * and complete before the exit promise resolves.
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";

let asyncCleanupId = 0;

/**
 * Register an async cleanup function that runs when the app unmounts.
 * Async cleanups run after sync cleanups and complete before `waitUntilExit()` resolves.
 */
export function useAsyncCleanup(fn: () => Promise<void>): void {
  const { renderContext } = useTui();
  const idRef = useRef(`async-cleanup-${asyncCleanupId++}`);
  // Always update to latest cleanup function
  renderContext.asyncCleanups.set(idRef.current, fn);
}
