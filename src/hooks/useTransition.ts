/**
 * useTransition -- declarative transition hook.
 *
 * Animates a numeric value between `from` and `to` with configurable
 * easing, duration, and delay. Uses the AnimationScheduler for frame
 * updates and requestRender() for the imperative update pattern.
 *
 * @example
 * ```tsx
 * function FadeIn() {
 *   const { value, isAnimating, start } = useTransition({
 *     from: 0, to: 1, duration: 300, easing: "easeOut",
 *   });
 *   // value animates 0 -> 1 on mount
 *   return <Box dim={value < 0.5}><Text>Hello</Text></Box>;
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

export interface TransitionConfig {
  /** Starting value. */
  from: number;
  /** Target value. */
  to: number;
  /** Duration in milliseconds (default: 200). */
  duration?: number;
  /** Easing function name (default: "easeOut"). */
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring";
  /** Delay in milliseconds before the animation starts (default: 0). */
  delay?: number;
  /** Called when the animation reaches its target value. */
  onComplete?: () => void;
}

export interface UseTransitionResult {
  /** Current animated value. */
  value: number;
  /** Whether the animation is currently in progress. */
  isAnimating: boolean;
  /** Start a new transition, optionally overriding parts of the config. */
  start: (override?: Partial<TransitionConfig>) => void;
  /** Stop the current animation at whatever value it has reached. */
  stop: () => void;
  /** Reset the value to the initial `from` and cancel any running animation. */
  reset: () => void;
}

/** Attempt a spring-like bounce via damped sine. */
const springEasing: EasingFn = (t: number): number => {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

function resolveEasing(name: TransitionConfig["easing"]): EasingFn {
  switch (name) {
    case "linear": return easings.linear;
    case "easeIn": return easings.easeIn;
    case "easeInOut": return easings.easeInOut;
    case "spring": return springEasing;
    case "easeOut":
    default:
      return easings.easeOut;
  }
}

export function useTransition(config: TransitionConfig): UseTransitionResult {
  const { renderContext, requestRender } = useTui();
  const scheduler = renderContext.animationScheduler;

  const configRef = useRef(config);
  configRef.current = config;

  const animRef = useRef<AnimationRef | null>(null);
  const currentRef = useRef(config.from);
  const animatingRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;
  const onCompleteRef = useRef(config.onComplete);
  onCompleteRef.current = config.onComplete;

  // ── Internal helpers ──────────────────────────────────────────

  const clearDelay = () => {
    if (delayTimerRef.current !== null) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  };

  const unsubScheduler = () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  };

  const beginAnimation = (from: number, to: number, duration: number, easingFn: EasingFn, onDone?: () => void) => {
    unsubScheduler();

    if (duration <= 0) {
      // Instant snap
      currentRef.current = to;
      animRef.current = null;
      animatingRef.current = false;
      requestRenderRef.current();
      onDone?.();
      return;
    }

    animRef.current = createAnimation(from, to, duration, easingFn);
    animatingRef.current = true;

    unsubRef.current = scheduler.add((_frameTime: number) => {
      const anim = animRef.current;
      if (!anim) return;

      const val = tickAnimation(anim);
      currentRef.current = val;

      if (anim.done) {
        unsubScheduler();
        animRef.current = null;
        animatingRef.current = false;
        onDone?.();
      }
    });
  };

  // ── Auto-start on first render ────────────────────────────────

  if (!initializedRef.current) {
    initializedRef.current = true;
    const { from, to, duration = 200, easing = "easeOut", delay = 0 } = config;

    if (from !== to) {
      const easingFn = resolveEasing(easing);
      if (delay > 0) {
        currentRef.current = from;
        animatingRef.current = true;
        delayTimerRef.current = setTimeout(() => {
          delayTimerRef.current = null;
          beginAnimation(from, to, duration, easingFn, () => onCompleteRef.current?.());
          requestRenderRef.current();
        }, delay);
      } else {
        beginAnimation(from, to, duration, easingFn, () => onCompleteRef.current?.());
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────

  const start = (override?: Partial<TransitionConfig>) => {
    clearDelay();
    unsubScheduler();

    const merged = { ...configRef.current, ...override };
    const from = merged.from ?? currentRef.current;
    const to = merged.to ?? configRef.current.to;
    const duration = merged.duration ?? 200;
    const easing = merged.easing ?? "easeOut";
    const delay = merged.delay ?? 0;
    const onDone = merged.onComplete ?? onCompleteRef.current;

    const easingFn = resolveEasing(easing);

    if (delay > 0) {
      currentRef.current = from;
      animatingRef.current = true;
      requestRenderRef.current();
      delayTimerRef.current = setTimeout(() => {
        delayTimerRef.current = null;
        beginAnimation(from, to, duration, easingFn, onDone);
        requestRenderRef.current();
      }, delay);
    } else {
      beginAnimation(from, to, duration, easingFn, onDone);
      requestRenderRef.current();
    }
  };

  const stop = () => {
    clearDelay();
    unsubScheduler();
    animRef.current = null;
    animatingRef.current = false;
    requestRenderRef.current();
  };

  const reset = () => {
    clearDelay();
    unsubScheduler();
    animRef.current = null;
    animatingRef.current = false;
    currentRef.current = configRef.current.from;
    requestRenderRef.current();
  };

  // ── Cleanup ───────────────────────────────────────────────────

  useCleanup(() => {
    clearDelay();
    unsubScheduler();
  });

  return {
    value: currentRef.current,
    isAnimating: animatingRef.current,
    start,
    stop,
    reset,
  };
}
