/**
 * Monkey-patches console.log/warn/error so they don't corrupt the alt-screen buffer.
 * Without this, React dev warnings write raw text over the TUI. Restores originals on dispose.
 */

import type { Screen } from "../core/screen.js";

export interface ConsoleInterceptorOptions {
  /** When true, console.log/warn/error write through the TUI screen. */
  patchConsole?: boolean | undefined;
}

export class ConsoleInterceptor {
  private readonly origConsoleLog = console.log;
  private readonly origConsoleWarn = console.warn;
  private readonly origConsoleError = console.error;
  readonly suppressedWarnings: string[] = [];
  private readonly patchConsole: boolean;

  constructor(screen: Screen, options: ConsoleInterceptorOptions = {}) {
    this.patchConsole = options.patchConsole === true;

    // Always silence console.warn/error in alt screen mode to prevent React dev
    // warnings from corrupting the TUI display. console.log is only patched if
    // patchConsole is explicitly true.
    const silentWarn = (...args: unknown[]) => {
      this.suppressedWarnings.push(
        args.map(a => typeof a === "string" ? a : String(a)).join(" "),
      );
    };
    console.warn = silentWarn;
    console.error = silentWarn;

    if (this.patchConsole) {
      const writeThrough = (...args: unknown[]) => {
        const msg = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
        screen.write(msg + "\n");
      };
      console.log = writeThrough;
      console.warn = writeThrough;
      console.error = writeThrough;
    }
  }

  /** Restore original console methods and show suppressed warning count. */
  restore(): void {
    console.warn = this.origConsoleWarn;
    console.error = this.origConsoleError;
    if (this.patchConsole) {
      console.log = this.origConsoleLog;
    }
    // Show any suppressed warnings after TUI exits
    if (this.suppressedWarnings.length > 0 && process.env.NODE_ENV !== "production") {
      this.origConsoleWarn(
        `[storm] ${this.suppressedWarnings.length} console warnings were suppressed during TUI session.`,
      );
    }
  }
}
