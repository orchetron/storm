/**
 * animate — easing/tween utility for terminal animations.
 *
 * Provides simple interpolation between numeric values with configurable
 * easing functions. Designed to work with the imperative requestRender()
 * pattern used throughout Storm TUI.
 */

export type EasingFn = (t: number) => number;

export const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
} as const;

export interface AnimationRef {
  start: number;
  duration: number;
  from: number;
  to: number;
  easing: EasingFn;
  current: number;
  done: boolean;
}

/**
 * Create a new animation reference that interpolates from `from` to `to`
 * over `durationMs` milliseconds using the given easing function.
 *
 * The animation starts at the current time (Date.now()).
 */
export function createAnimation(
  from: number,
  to: number,
  durationMs: number,
  easing: EasingFn = easings.easeOut,
): AnimationRef {
  return {
    start: Date.now(),
    duration: durationMs,
    from,
    to,
    easing,
    current: from,
    done: false,
  };
}

/**
 * Advance the animation to the current time and return the interpolated value.
 *
 * Once the animation completes, `anim.done` is set to true and the returned
 * value is clamped to `anim.to`.
 */
export function tickAnimation(anim: AnimationRef): number {
  if (anim.done) return anim.to;

  const elapsed = Date.now() - anim.start;
  if (elapsed >= anim.duration) {
    anim.current = anim.to;
    anim.done = true;
    return anim.to;
  }

  const t = elapsed / anim.duration;
  const easedT = anim.easing(t);
  anim.current = anim.from + (anim.to - anim.from) * easedT;
  return anim.current;
}
