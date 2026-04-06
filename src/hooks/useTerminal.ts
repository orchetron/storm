import { useState, useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export interface TerminalInfo {
  width: number;
  height: number;
  exit: () => void;
}

export function useTerminal(): TerminalInfo {
  const { screen, exit } = useTui();
  const [size, setSize] = useState({ width: screen.width, height: screen.height });

  // Register resize listener eagerly — not in useEffect
  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    unsubRef.current = screen.onResizeEvent((w, h) => {
      setSize({ width: w, height: h });
    });
  }

  useCleanup(() => {
    unsubRef.current?.();
  });

  return { width: size.width, height: size.height, exit };
}
