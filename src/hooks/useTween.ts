/**
 * useTween — animates a numeric value toward a target using easing.
 *
 * Uses the AnimationScheduler + requestRender() pattern for frame updates.
 * Automatically starts a new animation when the target changes.
 * Cleans up via useCleanup.
 *
 * @example
 * ```tsx
 * function AnimatedBar({ progress }: { progress: number }) {
 *   const { value, animating } = useTween(progress, 200);
 *   const width = Math.round(value * 50);
 *   return <Text>{"█".repeat(width)}</Text>;
 * }
 * ```
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";
import {
  createAnimation,
  tickAnimation,
  easings,
  type AnimationRef,
  type EasingFn,
} from "../utils/animate.js";

export interface UseTweenResult {
  /** Current interpolated value. */
  value: number;
  /** True while the animation is in progress. */
  animating: boolean;
}

/**
 * Animate a numeric value toward `target` over `durationMs` milliseconds.
 *
 * When `target` changes, a new animation is started from the current
 * interpolated position to the new target. If reduced motion is preferred
 * by the user's accessibility settings, the value snaps instantly.
 */
export function useTween(
  target: number,
  durationMs: number = 150,
  easing: EasingFn = easings.easeOut,
): UseTweenResult {
  const { renderContext } = useTui();
  const scheduler = renderContext.animationScheduler;

  const animRef = useRef<AnimationRef | null>(null);
  const currentRef = useRef(target);
  const prevTargetRef = useRef(target);
  const unsubRef = useRef<(() => void) | null>(null);

  // Detect target change and start a new animation
  if (target !== prevTargetRef.current) {
    const from = currentRef.current;
    prevTargetRef.current = target;

    // Remove previous scheduler callback if still running
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    animRef.current = createAnimation(from, target, durationMs, easing);

    // Register with the animation scheduler for frame updates
    unsubRef.current = scheduler.add((_frameTime: number) => {
      const anim = animRef.current;
      if (!anim) return;

      const val = tickAnimation(anim);
      currentRef.current = val;

      if (anim.done) {
        // Animation complete — unsubscribe
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        animRef.current = null;
      }
    });
  }

  // Cleanup on unmount
  useCleanup(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  });

  const anim = animRef.current;
  const animating = anim !== null && !anim.done;

  return {
    value: currentRef.current,
    animating,
  };
}
