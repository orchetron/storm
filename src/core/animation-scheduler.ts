/**
 * AnimationScheduler — single-loop animation coordinator.
 *
 * Instead of 100 independent setInterval timers (one per Spinner/animation),
 * all animations register with a single scheduler that ticks at a fixed rate.
 * This prevents timer thrashing and ensures consistent frame timing.
 */

export type AnimationCallback = (frameTime: number) => void;

export class AnimationScheduler {
  private callbacks = new Set<AnimationCallback>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;
  private requestRender: (() => void) | null = null;

  constructor(intervalMs: number = 80) {
    this.intervalMs = intervalMs;
  }

  /** Set the render trigger function */
  setRenderTrigger(fn: () => void): void {
    this.requestRender = fn;
  }

  /** Register an animation callback. Returns unsubscribe function. */
  add(callback: AnimationCallback): () => void {
    this.callbacks.add(callback);
    this.ensureRunning();
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) this.stop();
    };
  }

  /** Number of active animations */
  get count(): number {
    return this.callbacks.size;
  }

  /** Start the single timer if not running */
  private ensureRunning(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const cb of this.callbacks) {
        cb(now);
      }
      this.requestRender?.();
    }, this.intervalMs);
  }

  /** Stop the timer when no animations are active */
  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Clean up everything */
  destroy(): void {
    this.stop();
    this.callbacks.clear();
    this.requestRender = null;
  }
}
