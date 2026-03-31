/**
 * useStdout — access stdout and write to it.
 *
 * Access the stdout stream and write to it.
 */

import { useTui } from "../context/TuiContext.js";

export interface UseStdoutResult {
  stdout: NodeJS.WriteStream;
  write: (data: string) => void;
}

export function useStdout(): UseStdoutResult {
  const ctx = useTui();
  const { screen } = ctx;

  return {
    stdout: screen.stdout,
    write: (data: string) => {
      screen.write(data);
    },
  };
}
