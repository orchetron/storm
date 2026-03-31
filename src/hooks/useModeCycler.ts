/**
 * useModeCycler — cycles through an enum of modes on a specific key press.
 *
 * Uses useRef + useInput + forceUpdate().
 */

import { useRef } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseModeCyclerOptions<T> {
  modes: T[];
  cycleKey: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean };
  reverseCycleKey?: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean };
  initial?: T;
  isActive?: boolean;
  onChange?: (mode: T, prevMode: T) => void;
}

export interface UseModeCyclerResult<T> {
  mode: T;
  index: number;
  setMode: (mode: T) => void;
}

function matchesKey(
  event: { key: string; ctrl: boolean; shift: boolean; meta: boolean },
  spec: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean },
): boolean {
  if (event.key !== spec.key) return false;
  if (spec.ctrl && !event.ctrl) return false;
  if (!spec.ctrl && event.ctrl) return false;
  if (spec.shift && !event.shift) return false;
  if (!spec.shift && event.shift) return false;
  if (spec.meta && !event.meta) return false;
  if (!spec.meta && event.meta) return false;
  return true;
}

export function useModeCycler<T>(options: UseModeCyclerOptions<T>): UseModeCyclerResult<T> {
  const {
    modes,
    cycleKey,
    reverseCycleKey,
    isActive = true,
    onChange,
  } = options;
  const forceUpdate = useForceUpdate();

  const indexRef = useRef(
    options.initial !== undefined ? Math.max(0, modes.indexOf(options.initial)) : 0,
  );
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setMode = (mode: T) => {
    const newIndex = modes.indexOf(mode);
    if (newIndex >= 0 && newIndex !== indexRef.current) {
      const prevMode = modes[indexRef.current]!;
      indexRef.current = newIndex;
      onChangeRef.current?.(mode, prevMode);
      forceUpdate();
    }
  };

  useInput(
    (event) => {
      if (modes.length === 0) return;

      if (matchesKey(event, cycleKey)) {
        const prevIndex = indexRef.current;
        const prevMode = modes[prevIndex]!;
        indexRef.current = (prevIndex + 1) % modes.length;
        const newMode = modes[indexRef.current]!;
        onChangeRef.current?.(newMode, prevMode);
        forceUpdate();
        return;
      }

      if (reverseCycleKey && matchesKey(event, reverseCycleKey)) {
        const prevIndex = indexRef.current;
        const prevMode = modes[prevIndex]!;
        indexRef.current = (prevIndex - 1 + modes.length) % modes.length;
        const newMode = modes[indexRef.current]!;
        onChangeRef.current?.(newMode, prevMode);
        forceUpdate();
      }
    },
    { isActive },
  );

  const safeIndex = modes.length > 0 ? indexRef.current % modes.length : 0;

  return {
    mode: modes.length > 0 ? modes[safeIndex]! : (undefined as unknown as T),
    index: safeIndex,
    setMode,
  };
}
