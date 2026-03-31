/**
 * useForceUpdate — trigger a React re-render from imperative code.
 *
 * Returns a function that, when called, forces the component to re-render
 * by incrementing a dummy state counter via flushSync. This is the bridge
 * between imperative ref mutations and React's render cycle.
 *
 * Use this in hooks that store state in refs but need the component to
 * re-read those refs (e.g., useInlinePrompt, useModeCycler).
 */

import { useState } from "react";
import { useTui } from "../context/TuiContext.js";

export function useForceUpdate(): () => void {
  const { flushSync } = useTui();
  const [, setTick] = useState(0);

  return () => {
    flushSync(() => setTick((t) => t + 1));
  };
}
