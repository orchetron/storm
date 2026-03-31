/**
 * useTextCycler — cycles through an array of texts at an interval.
 *
 * Supports sequential, random, and shuffle ordering.
 * Uses useRef + forceUpdate() + setInterval + useCleanup.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseTextCyclerOptions {
  texts: string[];
  intervalMs?: number;
  order?: "sequential" | "random" | "shuffle";
  active?: boolean;
}

export interface UseTextCyclerResult {
  text: string;
  index: number;
  next: () => void;
  reset: () => void;
}

function shuffleArray(arr: number[]): number[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i]!, result[j]!] = [result[j]!, result[i]!];
  }
  return result;
}

export function useTextCycler(options: UseTextCyclerOptions): UseTextCyclerResult {
  const { texts, intervalMs = 2000, order = "random", active = true } = options;
  const forceUpdate = useForceUpdate();

  const indexRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Track texts identity for reset on change
  const prevTextsRef = useRef(texts);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shuffle state: a permutation of indices + position within it
  const shuffleOrderRef = useRef<number[]>([]);
  const shufflePosRef = useRef(0);

  // Reset when texts array changes (by reference)
  if (prevTextsRef.current !== texts) {
    prevTextsRef.current = texts;
    indexRef.current = 0;
    shuffleOrderRef.current = [];
    shufflePosRef.current = 0;
    // Clear existing interval so it restarts
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const advance = () => {
    if (texts.length === 0) return;

    if (order === "sequential") {
      indexRef.current = (indexRef.current + 1) % texts.length;
    } else if (order === "random") {
      if (texts.length <= 1) {
        indexRef.current = 0;
      } else {
        let next: number;
        do {
          next = Math.floor(Math.random() * texts.length);
        } while (next === indexRef.current && texts.length > 1);
        indexRef.current = next;
      }
    } else {
      // shuffle
      if (shuffleOrderRef.current.length === 0 || shufflePosRef.current >= shuffleOrderRef.current.length) {
        shuffleOrderRef.current = shuffleArray(
          Array.from({ length: texts.length }, (_, i) => i),
        );
        shufflePosRef.current = 0;
      }
      indexRef.current = shuffleOrderRef.current[shufflePosRef.current]!;
      shufflePosRef.current++;
    }

    forceUpdate();
  };

  const next = () => {
    advance();
  };

  const reset = () => {
    indexRef.current = 0;
    shuffleOrderRef.current = [];
    shufflePosRef.current = 0;
    forceUpdate();
  };

  // Start/stop interval based on active state
  const registeredRef = useRef(false);

  if (active && texts.length > 0 && intervalRef.current === null) {
    intervalRef.current = setInterval(() => {
      if (!activeRef.current) return;
      advance();
    }, intervalMs);
    registeredRef.current = true;
  } else if ((!active || texts.length === 0) && intervalRef.current !== null) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    registeredRef.current = false;
  }

  useCleanup(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  });

  const safeIndex = texts.length > 0 ? indexRef.current % texts.length : 0;

  return {
    text: texts.length > 0 ? texts[safeIndex]! : "",
    index: safeIndex,
    next,
    reset,
  };
}
