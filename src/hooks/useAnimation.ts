import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export interface UseAnimationOptions {
  /** Frame rate in ms (default: 80) */
  interval?: number;
  /** Only animate when true (default: true) */
  active?: boolean;
  /** Starting frame index (default: 0). Useful for offsetting multiple
   *  spinners so they don't animate in lockstep. */
  initialFrame?: number;
}

export interface UseAnimationResult {
  /** Current frame index (0-based, wraps automatically) */
  frame: number;
  /** Ref to a text node — set its .text for imperative updates */
  textRef: React.RefObject<any>;
  /** Manually advance one frame */
  tick: () => void;
}

/**
 * useAnimation — reusable animation hook.
 *
 * Registers with the global AnimationScheduler instead of creating its own
 * setInterval. The scheduler ticks all animations on a single timer and
 * calls requestRender() once per tick, preventing timer thrashing.
 *
 * @example
 * const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
 * function MySpinner() {
 *   const { frame, textRef } = useAnimation({ interval: 80 });
 *   return <tui-text _textNodeRef={textRef}>{FRAMES[frame % FRAMES.length]}</tui-text>;
 * }
 */
export function useAnimation(options: UseAnimationOptions = {}): UseAnimationResult {
  const { active = true, initialFrame = 0 } = options;
  const { renderContext, requestRender } = useTui();

  const frameRef = useRef(initialFrame);
  const textRef = useRef<any>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const scheduler = renderContext.animationScheduler;

  // Start/stop based on active state
  if (active && !unsubRef.current) {
    unsubRef.current = scheduler.add((_frameTime: number) => {
      if (!activeRef.current) return;
      frameRef.current++;
      // No need to call requestRender — scheduler does it
    });
  } else if (!active && unsubRef.current) {
    unsubRef.current();
    unsubRef.current = null;
  }

  // Cleanup on unmount
  useCleanup(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  });

  const tick = () => {
    frameRef.current++;
    requestRender();
  };

  return {
    frame: frameRef.current,
    textRef,
    tick,
  };
}
