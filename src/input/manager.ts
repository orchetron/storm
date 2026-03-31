/**
 * InputManager — unified stdin owner.
 *
 * The SINGLE point of contact for process.stdin. Parses raw data into
 * mouse events and key events. Mouse sequences are consumed BEFORE
 * keyboard parsing, preventing garbage text in the input.
 *
 * This prevents mouse escape sequences from reaching the keyboard parser:
 */

import { parseMouseEvent, isIncompleteMouseSequence } from "./mouse.js";
import { parseKeys } from "./keyboard.js";
import type { KeyEvent, MouseEvent, KeyHandler, MouseHandler, PasteEvent, PasteHandler } from "./types.js";

const MAX_BUFFER_SIZE = 4096;
const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";
const FOCUS_IN = "\x1b[I";
const FOCUS_OUT = "\x1b[O";

export interface PrioritizedKeyHandler {
  handler: KeyHandler;
  priority: number;
}

export class InputManager {
  private keyListeners: Set<KeyHandler> = new Set();
  private prioritizedKeyListeners: Set<PrioritizedKeyHandler> = new Set();
  private mouseListeners: Set<MouseHandler> = new Set();
  private pasteListeners: Set<PasteHandler> = new Set();
  private warnedMultipleHandlers = false;

  private mouseBuffer = "";
  private pasteBuffer: string | null = null; // non-null = inside paste
  private escBuffer = "";
  private escTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly dataHandler: (data: Buffer | string) => void;
  private stdin: NodeJS.ReadStream;
  private attached = false;

  constructor(stdin: NodeJS.ReadStream = process.stdin) {
    this.stdin = stdin;
    this.dataHandler = (data: Buffer | string) => this.handleData(
      typeof data === "string" ? data : data.toString("utf-8"),
    );
  }

  /** Start listening to stdin. */
  start(): void {
    if (this.attached) return;
    this.attached = true;
    this.stdin.on("data", this.dataHandler);
  }

  /** Stop listening to stdin. */
  stop(): void {
    if (!this.attached) return;
    this.attached = false;
    this.stdin.removeListener("data", this.dataHandler);
    this.mouseBuffer = "";
    this.pasteBuffer = null;
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    this.escBuffer = "";
  }

  // ── Subscription ────────────────────────────────────────────────

  onKey(handler: KeyHandler): () => void {
    this.keyListeners.add(handler);
    return () => { this.keyListeners.delete(handler); };
  }

  /**
   * Register a key handler with priority. Higher priority handlers run first.
   * If a prioritized handler exists, normal (non-prioritized) handlers are suppressed.
   */
  onKeyPrioritized(handler: KeyHandler, priority: number): () => void {
    const entry: PrioritizedKeyHandler = { handler, priority };
    this.prioritizedKeyListeners.add(entry);
    return () => { this.prioritizedKeyListeners.delete(entry); };
  }

  onMouse(handler: MouseHandler): () => void {
    this.mouseListeners.add(handler);
    return () => { this.mouseListeners.delete(handler); };
  }

  onPaste(handler: PasteHandler): () => void {
    this.pasteListeners.add(handler);
    return () => { this.pasteListeners.delete(handler); };
  }

  // ── Core data handler ───────────────────────────────────────────

  private handleData(raw: string): void {
    let data = raw;

    // Phase 1: Handle bracketed paste
    if (this.pasteBuffer !== null) {
      const endIdx = data.indexOf(PASTE_END);
      if (endIdx >= 0) {
        this.pasteBuffer += data.slice(0, endIdx);
        this.emitPaste({ text: this.pasteBuffer });
        this.pasteBuffer = null;
        data = data.slice(endIdx + PASTE_END.length);
        if (data.length === 0) return;
      } else {
        this.pasteBuffer += data;
        return;
      }
    }

    // Check for paste start
    const pasteStart = data.indexOf(PASTE_START);
    if (pasteStart >= 0) {
      // Process data before paste
      if (pasteStart > 0) {
        this.processInput(data.slice(0, pasteStart));
      }
      // Start paste buffering
      this.pasteBuffer = "";
      const afterStart = data.slice(pasteStart + PASTE_START.length);
      const endIdx = afterStart.indexOf(PASTE_END);
      if (endIdx >= 0) {
        this.pasteBuffer = null;
        this.emitPaste({ text: afterStart.slice(0, endIdx) });
        const rest = afterStart.slice(endIdx + PASTE_END.length);
        if (rest.length > 0) this.handleData(rest);
      } else {
        this.pasteBuffer = afterStart;
      }
      return;
    }

    this.processInput(data);
  }

  private processInput(data: string): void {
    // Phase 2: Extract and consume mouse sequences
    let remaining = this.extractMouse(data);

    // Phase 3: Filter focus events (use replaceAll for multiple occurrences)
    remaining = remaining.replaceAll(FOCUS_IN, "").replaceAll(FOCUS_OUT, "");

    // Phase 4: Handle ESC split across stdin chunks.
    // If we have a held ESC from a previous chunk, prepend it.
    if (this.escBuffer.length > 0 && remaining.length > 0) {
      if (this.escTimer) { clearTimeout(this.escTimer); this.escTimer = null; }
      remaining = this.escBuffer + remaining;
      this.escBuffer = "";
    }

    // If remaining ends with a bare ESC, hold it — it might be the
    // start of an escape sequence split across chunks.
    if (remaining.endsWith("\x1b")) {
      this.escBuffer = "\x1b";
      remaining = remaining.slice(0, -1);
      this.escTimer = setTimeout(() => {
        this.escTimer = null;
        const keys = parseKeys(this.escBuffer);
        this.escBuffer = "";
        for (const k of keys) this.emitKey(k);
      }, 50);
    }

    // Phase 5: Parse keyboard events from what's left
    if (remaining.length > 0) {
      const keyEvents = parseKeys(remaining);
      for (const evt of keyEvents) {
        this.emitKey(evt);
      }
    }
  }

  /**
   * Extract and dispatch mouse events from the data.
   * Returns the remaining data with mouse sequences stripped.
   */
  private extractMouse(data: string): string {
    // Early size check before concatenation to prevent DoS
    if (this.mouseBuffer.length + data.length > MAX_BUFFER_SIZE) {
      this.mouseBuffer = ""; // Reset instead of growing indefinitely
    }

    this.mouseBuffer += data;

    let keyboard = "";
    let i = 0;

    while (i < this.mouseBuffer.length) {
      const slice = this.mouseBuffer.slice(i);

      // Try to parse a mouse event
      const result = parseMouseEvent(slice);
      if (result) {
        this.emitMouse(result.event);
        i += result.consumed;
        continue;
      }

      // Check if this could be the start of a mouse sequence
      if (isIncompleteMouseSequence(slice)) {
        // Wait for more data — keep in buffer
        this.mouseBuffer = slice;
        return keyboard;
      }

      // Not a mouse sequence — pass through to keyboard
      // But be careful: only pass one character/sequence at a time
      if (slice.startsWith("\x1b") && slice.length > 1) {
        // This is an ESC sequence but not a mouse one
        // Find the end of this sequence and pass it all
        let seqEnd = 1;
        if (slice[1] === "[") {
          // CSI sequence — find terminating byte
          seqEnd = 2;
          while (seqEnd < slice.length) {
            const c = slice.charCodeAt(seqEnd);
            if (c >= 0x40 && c <= 0x7e) {
              seqEnd++;
              break;
            }
            seqEnd++;
          }
        } else if (slice[1] === "O") {
          seqEnd = 3; // SS3 + 1 byte
        } else {
          seqEnd = 2; // Alt+char
        }
        keyboard += slice.slice(0, seqEnd);
        i += seqEnd;
      } else {
        keyboard += slice[0]!;
        i++;
      }
    }

    this.mouseBuffer = "";
    return keyboard;
  }

  // ── Event emission ──────────────────────────────────────────────

  private emitKey(event: KeyEvent): void {
    // If prioritized handlers exist, only fire the highest-priority ones (focus trap)
    if (this.prioritizedKeyListeners.size > 0) {
      let maxPriority = -Infinity;
      for (const entry of this.prioritizedKeyListeners) {
        if (entry.priority > maxPriority) maxPriority = entry.priority;
      }
      let countAtMax = 0;
      for (const entry of this.prioritizedKeyListeners) {
        if (entry.priority === maxPriority) {
          countAtMax++;
          entry.handler(event);
        }
      }
      // Dev warning: multiple handlers at the same priority receive input simultaneously
      if (process.env.NODE_ENV !== "production" && !this.warnedMultipleHandlers && countAtMax > 1) {
        this.warnedMultipleHandlers = true;
        process.stderr.write("[storm-tui] Warning: Multiple components are receiving keyboard input simultaneously. This usually means multiple isFocused={true} props on sibling components. Use a focus state to control which component is active. See docs/pitfalls.md#7\n");
      }
      return; // Suppress normal listeners
    }
    // Dev warning: multiple non-prioritized handlers receive input simultaneously
    if (process.env.NODE_ENV !== "production" && !this.warnedMultipleHandlers && this.keyListeners.size > 1) {
      this.warnedMultipleHandlers = true;
      process.stderr.write("[storm-tui] Warning: Multiple components are receiving keyboard input simultaneously. This usually means multiple isFocused={true} props on sibling components. Use a focus state to control which component is active. See docs/pitfalls.md#7\n");
    }
    for (const handler of this.keyListeners) {
      handler(event);
    }
  }

  private emitMouse(event: MouseEvent): void {
    for (const handler of this.mouseListeners) {
      handler(event);
    }
  }

  private emitPaste(event: PasteEvent): void {
    for (const handler of this.pasteListeners) {
      handler(event);
    }
  }

  get isAttached(): boolean {
    return this.attached;
  }
}
