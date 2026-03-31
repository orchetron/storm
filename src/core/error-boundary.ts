/**
 * Render Error Boundary — catches and tracks errors during render phases,
 * preventing cascading failures and providing structured error reporting.
 *
 * @module
 */

/** Describes an error that occurred during a specific render phase. */
export interface RenderError {
  phase: "layout" | "paint" | "diff" | "flush" | "input";
  error: Error;
  component?: string;
  timestamp: number;
}

/** Configuration for the error boundary. */
export interface ErrorBoundaryOptions {
  /** Called when a render error occurs. */
  onError?: (error: RenderError) => void;
  /** Maximum consecutive errors before auto-exit (default 10). */
  maxConsecutiveErrors?: number;
  /** Show error overlay in terminal (default true). */
  showOverlay?: boolean;
}

const DEFAULT_MAX_CONSECUTIVE_ERRORS = 10;
const MAX_STORED_ERRORS = 100;

/**
 * Tracks and manages errors across render phases. Wraps phase functions
 * in try/catch, counts consecutive failures, and triggers exit when
 * the failure threshold is exceeded.
 */
export class RenderErrorBoundary {
  private consecutiveErrors = 0;
  private errors: RenderError[] = [];
  private readonly options: Required<ErrorBoundaryOptions>;

  constructor(options?: ErrorBoundaryOptions) {
    this.options = {
      onError: options?.onError ?? (() => {}),
      maxConsecutiveErrors:
        options?.maxConsecutiveErrors ?? DEFAULT_MAX_CONSECUTIVE_ERRORS,
      showOverlay: options?.showOverlay ?? true,
    };
  }

  /**
   * Wrap a function in error protection. If the function throws,
   * the error is recorded and `undefined` is returned.
   */
  protect<T>(phase: RenderError["phase"], fn: () => T): T | undefined {
    try {
      const result = fn();
      // Successful execution — reset the consecutive counter.
      this.resetCount();
      return result;
    } catch (raw: unknown) {
      const error: RenderError = {
        phase,
        error: raw instanceof Error ? raw : new Error(String(raw)),
        timestamp: Date.now(),
      };
      this.recordError(error);
      return undefined;
    }
  }

  /** Record an error, notify the callback, and bump the consecutive counter. */
  recordError(error: RenderError): void {
    this.consecutiveErrors++;
    this.errors.push(error);

    // Cap stored errors to avoid unbounded memory growth.
    if (this.errors.length > MAX_STORED_ERRORS) {
      this.errors = this.errors.slice(-MAX_STORED_ERRORS);
    }

    this.options.onError(error);
  }

  /** Reset the consecutive-error counter (call after a successful render). */
  resetCount(): void {
    this.consecutiveErrors = 0;
  }

  /** Return a read-only view of recent errors. */
  getErrors(): readonly RenderError[] {
    return this.errors;
  }

  /** True when consecutive failures have exceeded the configured threshold. */
  shouldExit(): boolean {
    return this.consecutiveErrors >= this.options.maxConsecutiveErrors;
  }

  /** Format a RenderError into a human-readable terminal string. */
  formatError(error: RenderError): string {
    const ts = new Date(error.timestamp).toISOString();
    const comp = error.component ? ` in <${error.component}>` : "";
    const header = `[Storm Error] ${error.phase}${comp} @ ${ts}`;
    const message = error.error.message;
    const stack = error.error.stack
      ? "\n" + error.error.stack.split("\n").slice(1).join("\n")
      : "";
    return `${header}\n  ${message}${stack}`;
  }
}
