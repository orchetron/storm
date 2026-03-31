/**
 * useTimer — countdown/stopwatch with formatted display.
 *
 * Uses useRef + forceUpdate() + setInterval + useCleanup.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseTimerOptions {
  mode: "countdown" | "stopwatch";
  durationMs?: number;
  onComplete?: () => void;
  autoStart?: boolean;
}

export interface UseTimerResult {
  elapsedMs: number;
  remainingMs: number;
  formatted: string;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

const TICK_INTERVAL = 100;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export function useTimer(options: UseTimerOptions): UseTimerResult {
  const { mode, durationMs = 0, onComplete, autoStart = true } = options;
  const forceUpdate = useForceUpdate();

  const elapsedRef = useRef(0);
  const isRunningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0); // elapsed before last pause
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const initializedRef = useRef(false);

  const stopInterval = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const tick = () => {
    if (startTimeRef.current === null) return;
    const now = Date.now();
    elapsedRef.current = accumulatedRef.current + (now - startTimeRef.current);

    // Check countdown completion
    if (mode === "countdown" && durationMs > 0 && !completedRef.current) {
      if (elapsedRef.current >= durationMs) {
        elapsedRef.current = durationMs;
        completedRef.current = true;
        isRunningRef.current = false;
        stopInterval();
        onCompleteRef.current?.();
      }
    }

    forceUpdate();
  };

  const startTimer = () => {
    if (isRunningRef.current) return;
    if (mode === "countdown" && completedRef.current) return;

    isRunningRef.current = true;
    startTimeRef.current = Date.now();
    stopInterval();
    intervalRef.current = setInterval(tick, TICK_INTERVAL);
    forceUpdate();
  };

  const pause = () => {
    if (!isRunningRef.current) return;
    isRunningRef.current = false;
    // Accumulate elapsed time
    if (startTimeRef.current !== null) {
      accumulatedRef.current += Date.now() - startTimeRef.current;
      startTimeRef.current = null;
    }
    elapsedRef.current = accumulatedRef.current;
    stopInterval();
    forceUpdate();
  };

  const reset = () => {
    isRunningRef.current = false;
    elapsedRef.current = 0;
    accumulatedRef.current = 0;
    startTimeRef.current = null;
    completedRef.current = false;
    stopInterval();
    forceUpdate();
  };

  // Auto-start on first render
  if (!initializedRef.current) {
    initializedRef.current = true;
    if (autoStart) {
      isRunningRef.current = true;
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(tick, TICK_INTERVAL);
    }
  }

  useCleanup(() => {
    stopInterval();
  });

  const elapsed = elapsedRef.current;
  const remaining = mode === "countdown" ? Math.max(0, durationMs - elapsed) : 0;
  const displayMs = mode === "countdown" ? remaining : elapsed;

  return {
    elapsedMs: elapsed,
    remainingMs: remaining,
    formatted: formatTime(displayMs),
    isRunning: isRunningRef.current,
    start: startTimer,
    pause,
    reset,
  };
}
