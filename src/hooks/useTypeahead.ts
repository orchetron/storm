import { useRef } from "react";
import { useInput } from "./useInput.js";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseTypeaheadOptions {
  items: string[];
  onMatch: (index: number) => void;
  isActive?: boolean;
  resetMs?: number;
}

export interface UseTypeaheadResult {
  typed: string;
  reset: () => void;
}

export function useTypeahead(options: UseTypeaheadOptions): UseTypeaheadResult {
  const { items, onMatch, isActive = true, resetMs = 1000 } = options;
  const forceUpdate = useForceUpdate();

  const typedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const resetTyped = () => {
    typedRef.current = "";
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    forceUpdate();
  };

  useInput(
    (event) => {
      // Only accept printable single characters (not special keys)
      if (!event.char || event.ctrl || event.meta) return;
      if (event.key === "return" || event.key === "escape" || event.key === "tab" ||
          event.key === "backspace" || event.key === "delete" || event.key === "space") return;
      if (event.char.length !== 1) return;

      typedRef.current += event.char;
      const prefix = typedRef.current.toLowerCase();

      const currentItems = itemsRef.current;
      for (let i = 0; i < currentItems.length; i++) {
        if (currentItems[i]!.toLowerCase().startsWith(prefix)) {
          onMatchRef.current(i);
          break;
        }
      }

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        typedRef.current = "";
        timerRef.current = null;
        forceUpdate();
      }, resetMs);

      forceUpdate();
    },
    { isActive },
  );

  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  return {
    typed: typedRef.current,
    reset: resetTyped,
  };
}
