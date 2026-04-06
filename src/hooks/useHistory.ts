import { useRef, useCallback } from "react";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseHistoryOptions<T> {
  initial: T;
  maxLength?: number;
}

export interface UseHistoryResult<T> {
  current: T;
  push: (entry: T) => void;
  back: () => T | null;
  forward: () => T | null;
  canGoBack: boolean;
  canGoForward: boolean;
  clear: () => void;
  entries: readonly T[];
  index: number;
}

export function useHistory<T>(options: UseHistoryOptions<T>): UseHistoryResult<T> {
  const { initial, maxLength = 50 } = options;
  const forceUpdate = useForceUpdate();

  const entriesRef = useRef<T[]>([initial]);
  const indexRef = useRef(0);

  const push = useCallback((entry: T) => {
    // Truncate forward entries
    entriesRef.current = entriesRef.current.slice(0, indexRef.current + 1);
    entriesRef.current.push(entry);

    // Enforce max length from the front
    if (entriesRef.current.length > maxLength) {
      const excess = entriesRef.current.length - maxLength;
      entriesRef.current = entriesRef.current.slice(excess);
    }

    indexRef.current = entriesRef.current.length - 1;
    forceUpdate();
  }, [maxLength, forceUpdate]);

  const back = useCallback((): T | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current--;
    forceUpdate();
    return entriesRef.current[indexRef.current] as T;
  }, [forceUpdate]);

  const forward = useCallback((): T | null => {
    if (indexRef.current >= entriesRef.current.length - 1) return null;
    indexRef.current++;
    forceUpdate();
    return entriesRef.current[indexRef.current] as T;
  }, [forceUpdate]);

  const clear = useCallback(() => {
    const current = entriesRef.current[indexRef.current] as T;
    entriesRef.current = [current];
    indexRef.current = 0;
    forceUpdate();
  }, [forceUpdate]);

  return {
    current: entriesRef.current[indexRef.current] as T,
    push,
    back,
    forward,
    canGoBack: indexRef.current > 0,
    canGoForward: indexRef.current < entriesRef.current.length - 1,
    clear,
    entries: entriesRef.current,
    index: indexRef.current,
  };
}
