/**
 * Storm TUI testing utilities.
 *
 * Provides fireEvent for simulating keyboard/mouse input,
 * enhanced renderToString for component testing, assertion helpers,
 * and snapshot utilities.
 */

import * as fs from "fs";
import * as path from "path";
import React from "react";
import type { KeyEvent, MouseEvent, PasteEvent } from "../input/types.js";
import { renderToString, type RenderToStringOptions } from "../reconciler/render-to-string.js";
import { renderToSvg, type SvgOptions } from "./svg-renderer.js";

export { renderToSvg, type SvgOptions } from "./svg-renderer.js";

/**
 * Create a mock InputManager that can receive simulated events.
 */
export class TestInputManager {
  private keyHandlers = new Set<(e: KeyEvent) => void>();
  private prioritizedKeyHandlers = new Set<{ handler: (e: KeyEvent) => void; priority: number }>();
  private mouseHandlers = new Set<(e: MouseEvent) => void>();
  private pasteHandlers = new Set<(e: PasteEvent) => void>();

  onKey(handler: (e: KeyEvent) => void): () => void {
    this.keyHandlers.add(handler);
    return () => { this.keyHandlers.delete(handler); };
  }

  /** Register a key handler with priority (mirrors InputManager). */
  onKeyPrioritized(handler: (e: KeyEvent) => void, priority: number): () => void {
    const entry = { handler, priority };
    this.prioritizedKeyHandlers.add(entry);
    return () => { this.prioritizedKeyHandlers.delete(entry); };
  }

  onMouse(handler: (e: MouseEvent) => void): () => void {
    this.mouseHandlers.add(handler);
    return () => { this.mouseHandlers.delete(handler); };
  }

  onPaste(handler: (e: PasteEvent) => void): () => void {
    this.pasteHandlers.add(handler);
    return () => { this.pasteHandlers.delete(handler); };
  }

  /** Simulate a key press */
  pressKey(key: string, options?: { ctrl?: boolean; shift?: boolean; meta?: boolean; char?: string }): void {
    const event: KeyEvent = {
      key,
      char: options?.char ?? (key.length === 1 ? key : ""),
      raw: key,
      ctrl: options?.ctrl ?? false,
      shift: options?.shift ?? false,
      meta: options?.meta ?? false,
    };
    if (this.prioritizedKeyHandlers.size > 0) {
      const sorted = [...this.prioritizedKeyHandlers].sort((a, b) => b.priority - a.priority);
      for (const entry of sorted) entry.handler(event);
    }
    for (const h of this.keyHandlers) h(event);
  }

  /** Simulate typing a string character by character */
  type(text: string): void {
    for (const char of text) {
      this.pressKey(char, { char });
    }
  }

  /** Simulate Enter key */
  pressEnter(): void {
    this.pressKey("return");
  }

  /** Simulate scroll */
  scroll(direction: "up" | "down", x = 0, y = 0): void {
    const event: MouseEvent = {
      button: direction === "up" ? "scroll-up" : "scroll-down",
      action: "press",
      x, y,
      shift: false, ctrl: false, meta: false,
      raw: "",
    };
    for (const h of this.mouseHandlers) h(event);
  }

  /** Simulate paste event */
  paste(text: string): void {
    const event: PasteEvent = { text };
    for (const h of this.pasteHandlers) h(event);
  }

  /** Release all handler references to prevent memory leaks. */
  dispose(): void {
    this.keyHandlers.clear();
    this.prioritizedKeyHandlers.clear();
    this.mouseHandlers.clear();
    this.pasteHandlers.clear();
  }

  get isAttached(): boolean { return true; }
  start(): void {}
  stop(): void {}
}

export { TestInputManager as MockInputManager };

export interface RenderResult {
  /** Plain text output (no ANSI) */
  output: string;
  /** Output lines */
  lines: string[];
  /** ANSI-styled output */
  styledOutput: string;
  /** Width of render area */
  width: number;
  /** Height of render area */
  height: number;
  /** Fire a key event */
  fireKey: (key: string, options?: { ctrl?: boolean; meta?: boolean; shift?: boolean }) => void;
  /** Type a string (fires individual key events) */
  type: (text: string) => void;
  /** Fire enter */
  pressEnter: () => void;
  /** Fire escape */
  pressEscape: () => void;
  /** Fire tab */
  pressTab: () => void;
  /** Fire arrow keys */
  pressUp: () => void;
  pressDown: () => void;
  pressLeft: () => void;
  pressRight: () => void;
  /** Fire mouse scroll */
  scroll: (direction: "up" | "down", x?: number, y?: number) => void;
  /** Fire paste event */
  paste: (text: string) => void;
  /** Re-render with new props */
  rerender: (element: React.ReactElement) => void;
  /** Get text at specific line */
  getLine: (lineNumber: number) => string;
  /** Check if output contains text */
  hasText: (text: string) => boolean;
  /** Get all text matching a pattern */
  findText: (pattern: RegExp) => string[];
  /** Unmount and cleanup */
  unmount: () => void;
}

/**
 * Render a React element for testing with convenience helpers.
 *
 * Wraps renderToString() with input simulation, text queries, and
 * mutable state that updates on rerender.
 *
 * @example
 * ```tsx
 * const result = renderForTest(<Text>Hello</Text>, { width: 40, height: 5 });
 * expect(result.hasText("Hello")).toBe(true);
 * result.pressEnter();
 * ```
 */
export function renderForTest(
  element: React.ReactElement,
  options?: { width?: number; height?: number },
): RenderResult {
  const width = options?.width ?? 80;
  const height = options?.height ?? 24;

  const renderOpts: RenderToStringOptions = { width, height };
  let inner = renderToString(element, renderOpts);

  function refresh(): void {
    // Re-render the current element to pick up state changes triggered by events
    inner = inner.rerender(element);
  }

  const result: RenderResult = {
    get output() { return inner.output; },
    get lines() { return inner.lines; },
    get styledOutput() { return inner.styledOutput; },
    width,
    height,

    fireKey(key: string, opts?: { ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
      inner.input.pressKey(key, opts);
    },

    type(text: string): void {
      inner.input.type(text);
    },

    pressEnter(): void {
      inner.input.pressEnter();
    },

    pressEscape(): void {
      inner.input.pressKey("escape");
    },

    pressTab(): void {
      inner.input.pressKey("tab");
    },

    pressUp(): void {
      inner.input.pressKey("up");
    },

    pressDown(): void {
      inner.input.pressKey("down");
    },

    pressLeft(): void {
      inner.input.pressKey("left");
    },

    pressRight(): void {
      inner.input.pressKey("right");
    },

    scroll(direction: "up" | "down", x?: number, y?: number): void {
      inner.input.scroll(direction, x, y);
    },

    paste(text: string): void {
      inner.input.paste(text);
    },

    rerender(el: React.ReactElement): void {
      element = el;
      inner = inner.rerender(el);
    },

    getLine(lineNumber: number): string {
      return inner.lines[lineNumber] ?? "";
    },

    hasText(text: string): boolean {
      return inner.output.includes(text);
    },

    findText(pattern: RegExp): string[] {
      const matches: string[] = [];
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      let match: RegExpExecArray | null;
      while ((match = globalPattern.exec(inner.output)) !== null) {
        matches.push(match[0]);
      }
      return matches;
    },

    unmount(): void {
      inner.unmount();
    },
  };

  return result;
}

export interface LineAssertions {
  toContain(text: string): void;
  toEqual(text: string): void;
  toBeEmpty(): void;
}

export interface OutputAssertions {
  toContainText(text: string): void;
  toNotContainText(text: string): void;
  toHaveLineCount(count: number): void;
  toMatchSnapshot(name: string): void;
  lineAt(n: number): LineAssertions;
}

/**
 * Create fluent assertion helpers for a RenderResult.
 *
 * Throws descriptive errors on assertion failure, making test output
 * easy to diagnose without framework-specific matchers.
 *
 * @example
 * ```tsx
 * const result = renderForTest(<Text>hello</Text>);
 * expectOutput(result).toContainText("hello");
 * expectOutput(result).lineAt(0).toContain("hello");
 * ```
 */
export function expectOutput(result: RenderResult): OutputAssertions {
  return {
    toContainText(text: string): void {
      if (!result.output.includes(text)) {
        throw new Error(
          `Expected output to contain "${text}" but it did not.\n\nActual output:\n${result.output}`,
        );
      }
    },

    toNotContainText(text: string): void {
      if (result.output.includes(text)) {
        throw new Error(
          `Expected output to NOT contain "${text}" but it did.\n\nActual output:\n${result.output}`,
        );
      }
    },

    toHaveLineCount(count: number): void {
      if (result.lines.length !== count) {
        throw new Error(
          `Expected ${count} lines but got ${result.lines.length}.\n\nLines:\n${result.lines.map((l, i) => `  ${i}: "${l}"`).join("\n")}`,
        );
      }
    },

    toMatchSnapshot(name: string): void {
      const { match, diff } = compareSnapshot(result.output, name);
      if (!match) {
        throw new Error(
          `Snapshot "${name}" mismatch.\n\n${diff ?? "No existing snapshot found. Call createSnapshot() first to establish the baseline."}`,
        );
      }
    },

    lineAt(n: number): LineAssertions {
      const line = result.lines[n] ?? "";
      return {
        toContain(text: string): void {
          if (!line.includes(text)) {
            throw new Error(
              `Expected line ${n} to contain "${text}" but it did not.\n\nLine ${n}: "${line}"`,
            );
          }
        },

        toEqual(text: string): void {
          if (line !== text) {
            throw new Error(
              `Expected line ${n} to equal "${text}" but got "${line}".`,
            );
          }
        },

        toBeEmpty(): void {
          if (line !== "") {
            throw new Error(
              `Expected line ${n} to be empty but got "${line}".`,
            );
          }
        },
      };
    },
  };
}

/** In-memory snapshot store for test runs. */
const snapshotStore = new Map<string, string>();

/**
 * Store a snapshot with the given name.
 * Returns the snapshot string for inspection.
 */
export function createSnapshot(output: string, name: string): string {
  snapshotStore.set(name, output);
  return output;
}

/**
 * Compare output against a stored snapshot.
 * Returns match status and a human-readable diff on mismatch.
 */
export function compareSnapshot(
  output: string,
  name: string,
): { match: boolean; diff?: string } {
  const stored = snapshotStore.get(name);

  if (stored === undefined) {
    return {
      match: false,
      diff: `No snapshot found with name "${name}". Use createSnapshot() to create one.`,
    };
  }

  if (stored === output) {
    return { match: true };
  }

  const expectedLines = stored.split("\n");
  const actualLines = output.split("\n");
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  const diffLines: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const expected = expectedLines[i];
    const actual = actualLines[i];

    if (expected === actual) {
      diffLines.push(`  ${i}: "${expected ?? ""}"`);
    } else {
      if (expected !== undefined) {
        diffLines.push(`- ${i}: "${expected}"`);
      }
      if (actual !== undefined) {
        diffLines.push(`+ ${i}: "${actual}"`);
      }
    }
  }

  return {
    match: false,
    diff: `Expected (-)  vs  Actual (+):\n${diffLines.join("\n")}`,
  };
}

/**
 * Clear all stored snapshots. Useful in test teardown.
 */
export function clearSnapshots(): void {
  snapshotStore.clear();
}

/**
 * Save a snapshot to a file.
 * Creates parent directories if they do not exist.
 */
export function saveSnapshot(output: string, filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, output, "utf-8");
}

/**
 * Load and compare a snapshot from a file.
 * Returns match status, whether the snapshot is new, and a diff on mismatch.
 */
export function compareFileSnapshot(
  output: string,
  filePath: string,
): { match: boolean; isNew: boolean; diff?: string } {
  if (!fs.existsSync(filePath)) {
    return { match: false, isNew: true, diff: `No snapshot file found at "${filePath}". Use saveSnapshot() to create one.` };
  }

  const stored = fs.readFileSync(filePath, "utf-8");

  if (stored === output) {
    return { match: true, isNew: false };
  }

  const expectedLines = stored.split("\n");
  const actualLines = output.split("\n");
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  const diffLines: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const expected = expectedLines[i];
    const actual = actualLines[i];

    if (expected === actual) {
      diffLines.push(`  ${i}: "${expected ?? ""}"`);
    } else {
      if (expected !== undefined) {
        diffLines.push(`- ${i}: "${expected}"`);
      }
      if (actual !== undefined) {
        diffLines.push(`+ ${i}: "${actual}"`);
      }
    }
  }

  return {
    match: false,
    isNew: false,
    diff: `Expected (-)  vs  Actual (+):\n${diffLines.join("\n")}`,
  };
}

/**
 * Save an SVG snapshot to a file.
 * Renders the RenderResult to SVG and writes it to the given path.
 */
export function saveSvgSnapshot(
  result: RenderResult,
  filePath: string,
  options?: SvgOptions,
): void {
  const svg = renderToSvg(result.lines, result.styledOutput, result.width, result.height, options);
  saveSnapshot(svg, filePath);
}

/**
 * Compare an SVG snapshot against a file.
 * Renders the RenderResult to SVG and compares against the stored file.
 */
export function compareSvgSnapshot(
  result: RenderResult,
  filePath: string,
  options?: SvgOptions,
): { match: boolean; isNew: boolean; diff?: string } {
  const svg = renderToSvg(result.lines, result.styledOutput, result.width, result.height, options);
  return compareFileSnapshot(svg, filePath);
}

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

/**
 * Create custom matchers for jest/vitest.
 *
 * Usage with vitest:
 * ```ts
 * import { createStormMatchers } from "@orchetron/storm";
 * expect.extend(createStormMatchers());
 * ```
 *
 * Provided matchers:
 * - `toMatchStormSnapshot(result, snapshotName)` — compare against in-memory snapshot
 * - `toContainStormText(result, text)` — check if output contains text
 * - `toHaveStormLines(result, count)` — check line count
 */
export function createStormMatchers(): Record<string, (...args: unknown[]) => MatcherResult> {
  return {
    toMatchStormSnapshot(received: unknown, snapshotName: unknown): MatcherResult {
      const result = received as RenderResult;
      const name = snapshotName as string;
      const { match, diff } = compareSnapshot(result.output, name);

      return {
        pass: match,
        message: () =>
          match
            ? `Expected output NOT to match snapshot "${name}", but it did.`
            : `Snapshot "${name}" mismatch.\n\n${diff ?? "No existing snapshot found. Call createSnapshot() first."}`,
      };
    },

    toContainStormText(received: unknown, text: unknown): MatcherResult {
      const result = received as RenderResult;
      const searchText = text as string;
      const pass = result.output.includes(searchText);

      return {
        pass,
        message: () =>
          pass
            ? `Expected output NOT to contain "${searchText}", but it did.\n\nActual output:\n${result.output}`
            : `Expected output to contain "${searchText}" but it did not.\n\nActual output:\n${result.output}`,
      };
    },

    toHaveStormLines(received: unknown, count: unknown): MatcherResult {
      const result = received as RenderResult;
      const expected = count as number;
      const pass = result.lines.length === expected;

      return {
        pass,
        message: () =>
          pass
            ? `Expected output NOT to have ${expected} lines, but it did.`
            : `Expected ${expected} lines but got ${result.lines.length}.\n\nLines:\n${result.lines.map((l, i) => `  ${i}: "${l}"`).join("\n")}`,
      };
    },
  };
}
