import { describe, it, expect, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { InputManager } from "../input/manager.js";
import type { MouseEvent, KeyEvent } from "../input/types.js";

/**
 * Fake stdin that emits "data" events synchronously via .push().
 */
function makeFakeStdin() {
  const ee = new EventEmitter();
  const stdin = {
    on: (event: string, handler: (...args: unknown[]) => void) =>
      ee.on(event, handler),
    removeListener: (event: string, handler: (...args: unknown[]) => void) =>
      ee.removeListener(event, handler),
    push: (data: string) => ee.emit("data", data),
  } as unknown as NodeJS.ReadStream & { push: (data: string) => void };
  return stdin;
}

function scroll(cb: number, x: number, y: number, release = false): string {
  return `\x1b[<${cb};${x};${y}${release ? "m" : "M"}`;
}

function attach(im: InputManager) {
  const mouse: MouseEvent[] = [];
  const keys: KeyEvent[] = [];
  im.onMouse((e) => mouse.push(e));
  im.onKey((e) => keys.push(e));
  return { mouse, keys };
}

describe("InputManager mouse parsing", () => {
  let stdin: ReturnType<typeof makeFakeStdin>;
  let im: InputManager;

  beforeEach(() => {
    stdin = makeFakeStdin();
    im = new InputManager(stdin);
    im.start();
  });

  it("consumes a single SGR scroll-up event without leaking to keyboard", () => {
    const { mouse, keys } = attach(im);
    stdin.push(scroll(64, 10, 5));
    expect(mouse).toHaveLength(1);
    expect(mouse[0]!.button).toBe("scroll-up");
    expect(keys).toHaveLength(0);
  });

  it("consumes rapid scroll bursts (many events, one chunk) with zero keyboard leak", () => {
    const { mouse, keys } = attach(im);
    let buf = "";
    for (let i = 0; i < 40; i++) buf += scroll(65, 20, 10);
    stdin.push(buf);
    expect(mouse).toHaveLength(40);
    expect(mouse.every((e) => e.button === "scroll-down")).toBe(true);
    expect(keys).toHaveLength(0);
  });

  it("handles SGR sequence split across chunks without leaking", () => {
    const { mouse, keys } = attach(im);
    const seq = scroll(64, 10, 5);
    // Split mid-sequence
    stdin.push(seq.slice(0, 6));
    stdin.push(seq.slice(6));
    expect(mouse).toHaveLength(1);
    expect(keys).toHaveLength(0);
  });

  it("handles a held mouse buffer larger than 50 bytes without falling through to keyboard", () => {
    const { mouse, keys } = attach(im);
    // Arrive as many tiny fragments that never individually complete a
    // sequence — this simulates a terminal dribbling bytes.
    const seq = scroll(64, 999, 999);
    for (const ch of seq) stdin.push(ch);
    expect(mouse).toHaveLength(1);
    expect(keys).toHaveLength(0);
  });

  it("does not leak SGR-mouse bytes to keyboard even if regex fails to match", () => {
    const { keys } = attach(im);
    // Simulate a malformed SGR sequence with an unexpected terminator.
    // The implementation should not forward `\x1b[<...X` characters as
    // individual key events — that is the leak that surfaces on screen.
    stdin.push("\x1b[<64;10;5X");
    // It's acceptable for this to emit 0 or 1 "escape"-type key events,
    // but NOT individual character events for the digits/semicolons.
    const chars = keys.map((k) => k.char).filter((c) => /[0-9;<]/.test(c));
    expect(chars).toEqual([]);
  });

  it("does not leak bytes after buffer overflow resets", () => {
    const { keys } = attach(im);
    // Fill buffer with an unterminated `\x1b[<` followed by digits to
    // exceed MAX_BUFFER_SIZE=4096 — the manager must not spill digits to
    // keyboard when it trims.
    stdin.push("\x1b[<" + "9".repeat(5000));
    // Now send a clean completing mouse event.
    stdin.push(scroll(64, 1, 1));
    const digitChars = keys.map((k) => k.char).filter((c) => c === "9");
    expect(digitChars).toEqual([]);
  });
});

describe("InputManager bare Escape", () => {
  let stdin: ReturnType<typeof makeFakeStdin>;
  let im: InputManager;

  beforeEach(() => {
    stdin = makeFakeStdin();
    im = new InputManager(stdin);
    im.start();
  });

  it("emits an escape key event when a bare ESC byte is received", async () => {
    const { keys } = attach(im);
    stdin.push("\x1b");
    // The mouse extractor was previously holding bare \x1b as a possible
    // mouse prefix and never releasing it. The keyboard ESC-hold timer
    // fires after 50ms; wait a bit longer and confirm we got an escape.
    await new Promise((r) => setTimeout(r, 80));
    const escapes = keys.filter((k) => k.key === "escape");
    expect(escapes.length).toBe(1);
  });

  it("still buffers \\x1b[ as a potentially-mouse-starting CSI", async () => {
    const { mouse } = attach(im);
    // Split a valid SGR mouse event across two chunks with the prefix
    // `\x1b[` in the first and the rest in the second.
    stdin.push("\x1b[");
    stdin.push("<64;10;5M");
    // Give the keyboard ESC-hold timer plenty of time too.
    await new Promise((r) => setTimeout(r, 80));
    expect(mouse.length).toBe(1);
    expect(mouse[0]!.button).toBe("scroll-up");
  });
});
