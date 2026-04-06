import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export function usePaste(
  handler: (text: string) => void,
  options: { isActive?: boolean } = {},
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
    unsubRef.current = input.onPaste((event) => {
      if (!activeRef.current) return;
      handlerRef.current(event.text);
    });
  }

  useCleanup(() => {
    unsubRef.current?.();
  });
}
