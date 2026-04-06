import { useTui } from "../context/TuiContext.js";

export interface UseAppResult {
  exit: (error?: Error) => void;
  rerender: () => void;
  clear: () => void;
}

export function useApp(): UseAppResult {
  const ctx = useTui();

  return {
    exit: (error?: Error) => {
      ctx.exit(error);
    },
    rerender: () => {
      ctx.requestRender();
    },
    clear: () => {
      ctx.clear();
    },
  };
}
