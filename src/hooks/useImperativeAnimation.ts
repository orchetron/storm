import { useRef } from "react";
import type { HostTextNode } from "../reconciler/types.js";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export interface UseImperativeAnimationOptions {
  /** Whether the animation is currently active (default true). */
  active?: boolean;
  /** Interval in milliseconds between ticks. */
  intervalMs: number;
  /**
   * Called every tick. Mutate textNode.text (or any refs you own)
   * and the hook will call requestRender() automatically afterward.
   *
   * Return `false` to stop the timer (self-terminating animations).
   * Any other return value (including `undefined`) keeps the timer running.
   */
  onTick: () => boolean | void;
}

export interface UseImperativeAnimationResult {
  textNodeRef: React.RefObject<HostTextNode | null>;
  /** Stable ref to the latest requestRender — useful if the caller
   *  needs to trigger a render outside of the tick cycle. */
  requestRenderRef: React.RefObject<() => void>;
}

/**
 * Timer + requestRender() loop for animations that bypass React state.
 * Use this instead of useState + useEffect when you need 60fps text updates
 * (spinners, shimmer, streaming). Mutate the textNodeRef directly in onTick.
 */
export function useImperativeAnimation(
  options: UseImperativeAnimationOptions,
): UseImperativeAnimationResult {
  const { active = true, intervalMs, onTick } = options;

  const textNodeRef = useRef<HostTextNode | null>(null);
  const { requestRender } = useTui();

  // Keep latest callback & requestRender in refs to avoid stale closures
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalRef = useRef(intervalMs);

  // Stop timer when not active
  if (!active && timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // Start or restart timer when active and interval changes
  if (active && (timerRef.current === null || intervalRef.current !== intervalMs)) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    intervalRef.current = intervalMs;
    timerRef.current = setInterval(() => {
      const result = onTickRef.current();
      requestRenderRef.current();
      // Self-terminating: if onTick returns false, stop the timer
      if (result === false) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, intervalMs);
  }

  useCleanup(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  return { textNodeRef, requestRenderRef };
}
