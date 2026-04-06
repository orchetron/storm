import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseEasedIntervalOptions {
  durations: number[];
  onTick: (frameIndex: number) => void;
  active?: boolean;
}

export interface UseEasedIntervalResult {
  frame: number;
  restart: () => void;
  pause: () => void;
  resume: () => void;
}

export function useEasedInterval(options: UseEasedIntervalOptions): UseEasedIntervalResult {
  const { durations, onTick, active = true } = options;
  const forceUpdate = useForceUpdate();

  const frameRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(!active);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;
  const runningRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = () => {
    if (pausedRef.current || durationsRef.current.length === 0) return;

    const durationIndex = frameRef.current % durationsRef.current.length;
    const ms = durationsRef.current[durationIndex]!;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (pausedRef.current) return;

      onTickRef.current(frameRef.current);
      frameRef.current++;
      forceUpdate();
      scheduleNext();
    }, ms);
  };

  const restart = () => {
    clearTimer();
    frameRef.current = 0;
    pausedRef.current = false;
    runningRef.current = true;
    forceUpdate();
    scheduleNext();
  };

  const pause = () => {
    if (!pausedRef.current) {
      pausedRef.current = true;
      clearTimer();
      forceUpdate();
    }
  };

  const resume = () => {
    if (pausedRef.current) {
      pausedRef.current = false;
      forceUpdate();
      scheduleNext();
    }
  };

  // Auto-start on first render when active
  if (active && !runningRef.current && durations.length > 0) {
    runningRef.current = true;
    pausedRef.current = false;
    scheduleNext();
  } else if (!active && runningRef.current) {
    pause();
    runningRef.current = false;
  }

  useCleanup(() => {
    clearTimer();
  });

  return {
    frame: frameRef.current,
    restart,
    pause,
    resume,
  };
}
