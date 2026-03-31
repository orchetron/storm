/**
 * useInlinePrompt — lightweight inline yes/no/custom prompt.
 *
 * Uses useForceUpdate to trigger React re-render when state changes,
 * so the component reads the updated `selected` value.
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";
import type { KeyEvent } from "../input/types.js";

export interface UseInlinePromptOptions<T extends string = string> {
  choices: Record<string, T>;
  isActive?: boolean;
  timeoutMs?: number;
  timeoutChoice?: string;
}

export interface UseInlinePromptResult<T extends string = string> {
  selected: T | null;
  countdown: number | null;
  select: (key: string) => void;
  reset: () => void;
}

export function useInlinePrompt<T extends string = string>(
  options: UseInlinePromptOptions<T>,
): UseInlinePromptResult<T> {
  const { choices, isActive = true, timeoutMs, timeoutChoice } = options;
  const { input } = useTui();
  const forceUpdate = useForceUpdate();

  const selectedRef = useRef<T | null>(null);
  const countdownRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
  };

  const doSelect = (key: string) => {
    const c = choicesRef.current;
    const value = c[key];
    if (value !== undefined && selectedRef.current === null) {
      selectedRef.current = value;
      clearTimer();
      countdownRef.current = null;
      forceUpdate();
    }
  };

  const reset = () => {
    selectedRef.current = null;
    countdownRef.current = null;
    clearTimer();
    forceUpdate();
  };

  // Register ONCE on InputManager
  if (!registeredRef.current) {
    registeredRef.current = true;
    unsubRef.current = input.onKey((event: KeyEvent) => {
      if (!isActiveRef.current) return;
      if (selectedRef.current !== null) return;
      const ch = event.char;
      const k = event.key;
      if (ch && ch in choicesRef.current) {
        doSelect(ch);
      } else if (k && k in choicesRef.current) {
        doSelect(k);
      }
    });
  }

  // Timeout countdown
  if (
    timeoutMs !== undefined &&
    timeoutChoice !== undefined &&
    selectedRef.current === null &&
    isActive &&
    timerRef.current === null
  ) {
    startTimeRef.current = Date.now();
    countdownRef.current = Math.ceil(timeoutMs / 1000);
    timerRef.current = setInterval(() => {
      if (selectedRef.current !== null || startTimeRef.current === null) {
        clearTimer();
        return;
      }
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
      countdownRef.current = remaining;
      if (elapsed >= timeoutMs) {
        doSelect(timeoutChoice);
        clearTimer();
      }
      forceUpdate();
    }, 1000);
  }

  useCleanup(() => {
    clearTimer();
    unsubRef.current?.();
  });

  return {
    selected: selectedRef.current,
    countdown: countdownRef.current,
    select: doSelect,
    reset,
  };
}
