import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";
import type { MouseEvent } from "../input/types.js";

export interface UseMouseOptions {
  isActive?: boolean;
}

export function useMouse(
  handler: (event: MouseEvent) => void,
  options: UseMouseOptions = {},
): void {
  const { input } = useTui();
  const isActive = options.isActive ?? true;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    unsubRef.current = input.onMouse((event) => {
      if (!activeRef.current) return;
      handlerRef.current(event);
    });
  }

  useCleanup(() => {
    unsubRef.current?.();
  });
}
