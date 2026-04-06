export type AnimationCallback = (frameTime: number) => void;

export class AnimationScheduler {
  private callbacks = new Set<AnimationCallback>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalMs: number;
  private maxIdleMs: number;
  private requestRender: (() => void) | null = null;

  constructor(intervalMs: number = 80, maxIdleMs: number = 5000) {
    this.intervalMs = intervalMs;
    this.maxIdleMs = maxIdleMs;
  }

  /** Set the render trigger function */
  setRenderTrigger(fn: () => void): void {
    this.requestRender = fn;
  }

  /** Register an animation callback. Returns unsubscribe function. */
  add(callback: AnimationCallback): () => void {
    this.callbacks.add(callback);
    // A callback was added — cancel any pending idle shutdown
    this.clearIdleTimer();
    this.ensureRunning();
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        // Start idle timer — if no new callbacks arrive in maxIdleMs, stop
        this.startIdleTimer();
      }
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

  /** Stop the animation timer */
  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Start idle shutdown timer */
  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.callbacks.size === 0) {
        this.stop();
      }
    }, this.maxIdleMs);
  }

  /** Cancel pending idle shutdown */
  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /** Clean up everything */
  destroy(): void {
    this.clearIdleTimer();
    this.stop();
    this.callbacks.clear();
    this.requestRender = null;
  }
}
