/**
 * useStdin — access stdin and raw mode control.
 *
 * Access the stdin stream and raw mode control.
 */

import { useTui } from "../context/TuiContext.js";

export interface UseStdinResult {
  stdin: NodeJS.ReadStream;
  setRawMode: (value: boolean) => void;
  isRawModeSupported: boolean;
}

export function useStdin(): UseStdinResult {
  const ctx = useTui();
  const { stdin } = ctx.screen;

  return {
    stdin,
    setRawMode: (value: boolean) => {
      if (stdin.isTTY) {
        stdin.setRawMode(value);
      }
    },
    isRawModeSupported: Boolean(stdin.isTTY),
  };
}
