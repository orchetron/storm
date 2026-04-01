/**
 * Screen — terminal lifecycle and output management.
 *
 * Owns stdout, manages raw mode, alternate screen, mouse reporting,
 * resize events, and cleanup on exit/crash.
 */

import {
  CURSOR_HIDE,
  CURSOR_SHOW,
  CURSOR_SAVE,
  CURSOR_RESTORE,
  ALT_SCREEN_ENTER,
  ALT_SCREEN_EXIT,
  MOUSE_ENABLE,
  MOUSE_DISABLE,
  RESET,
  CLEAR_SCREEN,
  CLEAR_DOWN,
  cursorTo,
  cursorUp,
  setColorDepth,
  type ColorDepth,
} from "./ansi.js";
import { detectTerminal } from "./terminal-detect.js";
import { DiffRenderer, type DiffResult } from "./diff.js";
import { ScreenBuffer } from "./buffer.js";
import type { LinkRange, RenderContext } from "./render-context.js";

/** Allow forcing TTY behavior via STORM_FORCE_TTY=1 (for playground/WebSocket). */
const FORCE_TTY = process.env.STORM_FORCE_TTY === "1";

export interface ScreenOptions {
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  /** Use alternate screen buffer (default: true) */
  alternateScreen?: boolean;
  /** Enable mouse reporting (default: true). Disable for text selection/copy. */
  mouse?: boolean;
  /** Enable raw mode on stdin (default: true) */
  rawMode?: boolean;
}

export class Screen {
  readonly stdout: NodeJS.WriteStream;
  readonly stdin: NodeJS.ReadStream;
  private readonly useAltScreen: boolean;
  private readonly useMouse: boolean;
  private readonly useRawMode: boolean;
  private wasRaw: boolean;

  private diff: DiffRenderer;
  private buffer: ScreenBuffer;
  private _width: number;
  private _height: number;
  private active = false;
  private cleanedUp = false;
  private _signalsBound = false;

  // Before-cleanup callback — lets the render loop run user cleanups (useCleanup,
  // useAsyncCleanup, plugin teardown) before terminal state is restored.
  private onBeforeCleanup: (() => void) | null = null;

  // Cursor position management (for TextInput)
  private _cursorX = 0;
  private _cursorY = 0;
  private _cursorVisible = true;

  // Live section height tracking (for commitAbove in non-alt-screen mode)
  private _liveHeight = 0;

  /** Optional transform applied to ANSI output before writing to stdout. */
  private _outputTransform: ((output: string) => string) | null = null;

  // Resize handling
  private resizeListeners: Array<(w: number, h: number) => void> = [];
  private readonly onResize: () => void;

  // Cleanup handlers
  private readonly onExit: () => void;
  private readonly onSignal: (sig: string) => void;
  private readonly onUncaughtException: (err: Error) => void;
  private readonly onUnhandledRejection: (reason: unknown) => void;

  constructor(options: ScreenOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.stdin = options.stdin ?? process.stdin;
    this.useAltScreen = options.alternateScreen ?? true;
    this.useMouse = options.mouse ?? true;
    this.useRawMode = options.rawMode ?? true;
    this.wasRaw = false;

    this._width = Math.max(1, this.stdout.columns ?? 80);
    this._height = Math.max(1, this.stdout.rows ?? 24);

    this.diff = new DiffRenderer(this._width, this._height);
    this.buffer = new ScreenBuffer(this._width, this._height);

    this.onResize = () => {
      const w = Math.max(1, this.stdout.columns ?? 80);
      const h = Math.max(1, this.stdout.rows ?? 24);
      if (w !== this._width || h !== this._height) {
        this._width = w;
        this._height = h;
        // DON'T resize buffer or diff here — let the next paint handle it.
        // Replacing the buffer mid-paint causes a race condition where
        // paint() is still writing to the old buffer while we swap it out.
        // The DiffRenderer handles dimension changes in its render() method
        // (fullRedraw check), and repaint() already checks dimensions.
        // Just notify listeners who will trigger a new paint cycle.
        for (const listener of this.resizeListeners) {
          listener(w, h);
        }
      }
    };

    this.onExit = () => {
      this.runBeforeCleanup();
      this.cleanup();
    };
    this.onSignal = (sig: string) => {
      this.runBeforeCleanup();
      this.cleanup();
      process.kill(process.pid, sig);
    };
    this.onUncaughtException = (err: Error) => {
      this.runBeforeCleanup();
      this.cleanup();
      process.stderr.write(`Uncaught exception: ${err.stack ?? err.message}\n`);
      throw err;
    };
    this.onUnhandledRejection = (reason: unknown) => {
      this.runBeforeCleanup();
      this.cleanup();
      const msg =
        reason instanceof Error
          ? reason.stack ?? reason.message
          : String(reason);
      process.stderr.write(`Unhandled rejection: ${msg}\n`);
      process.exitCode = 1;
      process.exit(1);
    };
  }

  /**
   * Register a callback that runs user-level cleanups (useCleanup, useAsyncCleanup,
   * plugin teardown) before the terminal is restored. Called by the render loop.
   */
  setBeforeCleanup(fn: () => void): void {
    this.onBeforeCleanup = fn;
  }

  /** Run the before-cleanup callback exactly once (idempotent). */
  private runBeforeCleanup(): void {
    if (this.onBeforeCleanup) {
      const fn = this.onBeforeCleanup;
      this.onBeforeCleanup = null;
      try { fn(); } catch (err) { if (process.env.NODE_ENV !== 'production') process.stderr.write('[storm-tui] I/O error: ' + (err as Error).message + '\n'); }
    }
  }

  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  /** Start the screen — enter alt screen, enable mouse, raw mode.
   *  When stdout is not a TTY (piped, redirected), all terminal control
   *  sequences are skipped. The app still runs — components render, state
   *  updates — but no cursor/mouse/alt-screen escape codes are emitted. */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.cleanedUp = false;

    // Detect terminal color depth and configure ANSI output accordingly
    const caps = detectTerminal();
    let depth: ColorDepth = "basic";
    if (caps.trueColor) depth = "truecolor";
    else if (caps.color256) depth = "256";
    else if (caps.name !== "unknown") depth = "16";
    setColorDepth(depth);

    const isTTY = this.stdout.isTTY === true || FORCE_TTY;

    if (isTTY) {
      let init = "";

      if (this.useAltScreen) {
        init += ALT_SCREEN_ENTER;
        init += CLEAR_SCREEN;
        init += cursorTo(0, 0);
      }

      init += CURSOR_HIDE;

      if (this.useMouse) {
        init += MOUSE_ENABLE;
      }

      this.write(init);
    }

    if (this.useRawMode && this.stdin.isTTY) {
      this.wasRaw = this.stdin.isRaw ?? false;
      this.stdin.setRawMode(true);
    }

    // Listen for resize (only fires on TTYs, but harmless to register)
    this.stdout.on("resize", this.onResize);

    // Remove any previously registered handlers before re-registering
    // to prevent signal handler accumulation from repeated start()/stop() cycles.
    if (this._signalsBound) {
      process.removeListener("exit", this.onExit);
      process.removeListener("SIGINT", this.onSignal);
      process.removeListener("SIGTERM", this.onSignal);
      process.removeListener("SIGHUP", this.onSignal);
      process.removeListener("uncaughtException", this.onUncaughtException);
      process.removeListener("unhandledRejection", this.onUnhandledRejection);
    }

    // Cleanup on exit
    process.on("exit", this.onExit);
    process.on("SIGINT", this.onSignal);
    process.on("SIGTERM", this.onSignal);
    // SIGHUP for terminal close
    process.on("SIGHUP", this.onSignal);
    // Crash handlers — restore terminal before dying
    process.on("uncaughtException", this.onUncaughtException);
    process.on("unhandledRejection", this.onUnhandledRejection);
    this._signalsBound = true;
  }

  /** Stop the screen — restore terminal state. */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    if (this.stdout.isTTY === true || FORCE_TTY) {
      let restore = "";
      restore += "\x1b]111\x07"; // Reset terminal bg to original default (OSC 111)
      restore += RESET;
      restore += CURSOR_SHOW;

      if (this.useMouse) {
        restore += MOUSE_DISABLE;
      }

      if (this.useAltScreen) {
        restore += ALT_SCREEN_EXIT;
      }

      this.write(restore);
    }

    if (this.useRawMode && this.stdin.isTTY) {
      try {
        this.stdin.setRawMode(this.wasRaw);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') process.stderr.write('[storm-tui] I/O error: ' + (err as Error).message + '\n');
      }
    }

    this.stdout.removeListener("resize", this.onResize);
    process.removeListener("exit", this.onExit);
    process.removeListener("SIGINT", this.onSignal);
    process.removeListener("SIGTERM", this.onSignal);
    process.removeListener("SIGHUP", this.onSignal);
    process.removeListener("uncaughtException", this.onUncaughtException);
    process.removeListener("unhandledRejection", this.onUnhandledRejection);
  }

  /** Change the terminal's default background via OSC 11.
   *  This makes \x1b[2J, \x1b[0m, \x1b[49m all use this color.
   *  Pass null to reset to the terminal's original default.
   *  No-op when stdout is not a TTY. */
  setTerminalBg(hexColor: string | null): void {
    if (this.stdout.isTTY !== true && !FORCE_TTY) return;
    if (hexColor) {
      // OSC 11 ; rgb:RR/GG/BB BEL — set terminal default background
      const r = hexColor.slice(1, 3);
      const g = hexColor.slice(3, 5);
      const b = hexColor.slice(5, 7);
      this.write(`\x1b]11;rgb:${r}/${g}/${b}\x07`);
    } else {
      // OSC 111 BEL — reset to original default
      this.write(`\x1b]111\x07`);
    }
  }

  /** Get the current frame buffer. Paint into this, then call flush(). */
  getBuffer(): ScreenBuffer {
    return this.buffer;
  }

  /** Allocate a fresh buffer with current dimensions. */
  createBuffer(): ScreenBuffer {
    return new ScreenBuffer(this._width, this._height);
  }

  /**
   * Diff the given buffer against the previous frame and write changes.
   * This is the core render path — called once per React commit.
   * Returns the diff result with change statistics.
   */
  flush(nextBuffer?: ScreenBuffer, links?: LinkRange[], ctx?: RenderContext): DiffResult {
    const buf = nextBuffer ?? this.buffer;
    const result = this.diff.render(buf, links, ctx);

    let output = result.output;

    // Cursor visibility: always emit the correct state on every flush.
    // If cursor should be visible, position it and show it.
    // If not, explicitly hide it to stop the terminal's blinking hardware cursor.
    // Skip cursor control sequences when stdout is not a TTY.
    if (this.stdout.isTTY === true || FORCE_TTY) {
      if (this._cursorVisible) {
        output += cursorTo(this._cursorY, this._cursorX) + CURSOR_SHOW;
      } else {
        output += CURSOR_HIDE;
      }
    }

    // Apply output transform (used by middleware pipeline)
    if (this._outputTransform && output.length > 0) {
      output = this._outputTransform(output);
    }

    // Append pending graphics protocol image sequences AFTER the diff output.
    // These are queued by the Image component via paintBox -> RenderContext.
    // Writing them after the diff ensures the terminal renders the image
    // on top of the spacer box cells, not the other way around.
    if (ctx && ctx.pendingImageSequences.length > 0) {
      for (const img of ctx.pendingImageSequences) {
        // Position cursor at the image's layout coordinates, then emit the sequence
        output += cursorTo(img.row, img.col) + img.seq;
      }
      ctx.pendingImageSequences = [];
    }

    if (output.length > 0) {
      this.write(output);
    }

    return result;
  }

  /** Force full redraw on next flush. */
  invalidate(): void {
    this.diff.invalidate();
  }

  /** Enable or disable debug rainbow mode on the diff renderer. */
  setDebugRainbow(enabled: boolean): void {
    this.diff.setDebugRainbow(enabled);
  }

  /** Set an output transform applied to ANSI output before writing to stdout. */
  setOutputTransform(transform: ((output: string) => string) | null): void {
    this._outputTransform = transform;
  }

  /** Set cursor position (for TextInput). */
  setCursor(x: number, y: number): void {
    this._cursorX = x;
    this._cursorY = y;
  }

  setCursorVisible(visible: boolean): void {
    const wasVisible = this._cursorVisible;
    this._cursorVisible = visible;
    // When hiding cursor, emit CURSOR_HIDE immediately so the terminal
    // stops showing the blinking hardware cursor. Skip when not a TTY.
    if (wasVisible && !visible && this.stdout.isTTY === true) {
      this.stdout.write(CURSOR_HIDE);
    }
  }

  /** Register a resize listener. */
  onResizeEvent(fn: (w: number, h: number) => void): () => void {
    this.resizeListeners.push(fn);
    return () => {
      const idx = this.resizeListeners.indexOf(fn);
      if (idx >= 0) this.resizeListeners.splice(idx, 1);
    };
  }

  /** Raw write to stdout — use sparingly. */
  write(data: string): void {
    try {
      this.stdout.write(data);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') process.stderr.write('[storm-tui] I/O error: ' + (err as Error).message + '\n');
    }
  }

  /** Track how many lines the live section currently occupies. */
  get liveHeight(): number {
    return this._liveHeight;
  }

  setLiveHeight(h: number): void {
    this._liveHeight = h;
  }

  /**
   * Write committed content above the live render area.
   * In non-alternate-screen mode:
   *   1. Erase the live section (cursor up + clear)
   *   2. Write the committed text (becomes permanent scrollback)
   *   3. The caller is responsible for repainting the live section after.
   */
  commitAbove(text: string): void {
    if (this._liveHeight > 0) {
      // Move cursor up to the top of the live section, then clear down
      let seq = cursorUp(this._liveHeight);
      seq += "\r"; // Move to column 0
      seq += CLEAR_DOWN;
      this.write(seq);
    }
    // Write the committed text — this becomes terminal scrollback
    this.write(text);
  }

  get isActive(): boolean {
    return this.active;
  }
}
