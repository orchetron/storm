/**
 * renderToString() — render a TUI component to a string without a TTY.
 *
 * Designed for testing, CI pipelines, and programmatic rendering where
 * no terminal is attached. Uses the same reconciler and renderer as render(),
 * but writes to a virtual buffer instead of stdout.
 *
 * Returns both plain text (ANSI stripped) and styled text (with ANSI codes).
 */

import React from "react";
import Reconciler from "react-reconciler";
import { hostConfig } from "./host.js";
import { createRoot, type TuiRoot } from "./types.js";
import { paint } from "./renderer.js";
import { RenderContext } from "../core/render-context.js";
import { ScreenBuffer } from "../core/buffer.js";
import { DEFAULT_COLOR, Attr } from "../core/types.js";
import { fullSgr, RESET } from "../core/ansi.js";
import { TuiProvider, type TuiContextValue } from "../context/TuiContext.js";
import { TestInputManager } from "../testing/index.js";

const TuiReconciler = Reconciler(hostConfig);

/**
 * Defensively call the private synchronous reconciler APIs.
 * See render.ts for the full rationale — these are private React internals
 * that can break on version bumps.
 */
function syncContainerUpdate(
  element: React.ReactElement,
  container: any,
): void {
  try {
    if (typeof (TuiReconciler as any).updateContainerSync === "function") {
      (TuiReconciler as any).updateContainerSync(element, container, null, null);
    } else {
      TuiReconciler.updateContainer(element, container, null, null);
    }
    if (typeof (TuiReconciler as any).flushSyncWork === "function") {
      (TuiReconciler as any).flushSyncWork();
    }
  } catch {
    // Fallback to public API if private APIs are removed/changed
    TuiReconciler.updateContainer(element, container, null, null);
  }
}

export interface RenderToStringOptions {
  /** Terminal width in columns (default: 80). */
  width?: number;
  /** Terminal height in rows (default: 24). */
  height?: number;
  /** Alias for width. */
  columns?: number;
  /** Alias for height. */
  rows?: number;
}

export interface RenderToStringResult {
  /** Plain text output with ANSI escape codes stripped. */
  output: string;
  /** Output with ANSI escape codes for styled rendering. */
  styledOutput: string;
  /** Plain text split into individual lines. */
  lines: string[];
  /** Unmount the React tree and clean up. */
  unmount: () => void;
  /** Re-render with a new element and return updated result. */
  rerender: (element: React.ReactElement) => RenderToStringResult;
  /** Mock input manager for simulating key/mouse events */
  input: TestInputManager;
}

/**
 * Render a React element to a string without requiring a TTY.
 *
 * This uses the same reconciler and layout engine as `render()`, but
 * paints into a buffer that is then converted to text. No terminal
 * setup, no raw mode, no alternate screen — works anywhere.
 *
 * @example
 * ```tsx
 * import { renderToString, Box, Text } from "@orchetron/tui";
 *
 * const result = renderToString(
 *   <Box flexDirection="column">
 *     <Text>Hello</Text>
 *     <Text bold>World</Text>
 *   </Box>,
 *   { width: 40, height: 5 },
 * );
 *
 * console.log(result.output);  // plain text
 * console.log(result.lines);   // ["Hello", "World", ...]
 * ```
 */
export function renderToString(
  element: React.ReactElement,
  options?: RenderToStringOptions,
): RenderToStringResult {
  const width = options?.columns ?? options?.width ?? 80;
  const height = options?.rows ?? options?.height ?? 24;
  const renderCtx = new RenderContext();
  const testInput = new TestInputManager();

  // Build a mock TuiContextValue so components using useTui() don't crash
  const mockContext: TuiContextValue = {
    screen: {
      width,
      height,
      stdout: process.stdout,
      stdin: process.stdin,
      write: () => {},
      start: () => {},
      stop: () => {},
      flush: () => {},
      getBuffer: () => new ScreenBuffer(width, height),
      createBuffer: () => new ScreenBuffer(width, height),
      invalidate: () => {},
      setDebugRainbow: () => {},
      setCursor: () => {},
      setCursorVisible: () => {},
      onResizeEvent: () => () => {},
      isActive: false,
    } as unknown as TuiContextValue["screen"],
    input: testInput as unknown as TuiContextValue["input"],
    focus: renderCtx.focus,
    renderContext: renderCtx,
    exit: () => {},
    requestRender: () => {},
    flushSync: (fn: () => void) => { fn(); },
    clear: () => {},
    commitText: () => {},
  };

  let currentElement = element;
  const errors: Error[] = [];

  // Create root — onCommit is a no-op since we paint synchronously
  const root: TuiRoot = createRoot(() => {
    renderCtx.invalidateLayout();
  });

  const container = TuiReconciler.createContainer(
    root, 0, null, false, null, "",
    (error: Error) => {
      errors.push(error);
    },
    null,
  );

  function doRender(el: React.ReactElement): RenderToStringResult {
    currentElement = el;

    // Wrap element with TuiProvider so useTui() works
    const wrapped = React.createElement(TuiProvider, { value: mockContext }, el);

    // Synchronously update the React tree — must use updateContainerSync +
    // flushSyncWork to ensure React processes ALL state updates before returning.
    // Plain updateContainer queues the update async, causing paint to see an empty tree.
    syncContainerUpdate(wrapped, container);

    // Throw if any errors were collected during rendering
    if (errors.length > 0) {
      const err = errors[0]!;
      errors.length = 0;
      throw err;
    }

    // Force layout invalidation and paint
    renderCtx.invalidateLayout();
    const result = paint(root, width, height, renderCtx);

    // Convert buffer to plain text and styled text
    const plainLines = bufferToPlainLines(result.buffer);
    const styledLines = bufferToStyledLines(result.buffer);

    // Trim trailing empty lines for cleaner output
    const trimmedPlain = trimTrailingEmptyLines(plainLines);
    const trimmedStyled = trimTrailingEmptyLines(styledLines);

    return {
      output: trimmedPlain.join("\n"),
      styledOutput: trimmedStyled.join("\n"),
      lines: trimmedPlain,
      unmount,
      rerender: (newElement: React.ReactElement) => doRender(newElement),
      input: testInput,
    };
  }

  function unmount(): void {
    TuiReconciler.updateContainer(null, container, null, null);
  }

  return doRender(element);
}

/**
 * Convert a ScreenBuffer to plain text lines (no ANSI codes).
 * Each line is right-trimmed to remove trailing spaces.
 */
function bufferToPlainLines(buffer: ScreenBuffer): string[] {
  const lines: string[] = [];
  for (let y = 0; y < buffer.height; y++) {
    let line = "";
    for (let x = 0; x < buffer.width; x++) {
      line += buffer.getChar(x, y);
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines;
}

/**
 * Convert a ScreenBuffer to styled text lines (with ANSI escape codes).
 * Each line is right-trimmed to remove trailing default-styled spaces.
 */
function bufferToStyledLines(buffer: ScreenBuffer): string[] {
  const lines: string[] = [];
  for (let y = 0; y < buffer.height; y++) {
    // Find last non-default cell
    let lastNonDefault = -1;
    for (let x = buffer.width - 1; x >= 0; x--) {
      if (buffer.getChar(x, y) !== " " || buffer.getFg(x, y) !== DEFAULT_COLOR || buffer.getBg(x, y) !== DEFAULT_COLOR || buffer.getAttrs(x, y) !== Attr.NONE) {
        lastNonDefault = x;
        break;
      }
    }

    if (lastNonDefault < 0) {
      lines.push("");
      continue;
    }

    let line = "";
    let curFg: number = DEFAULT_COLOR;
    let curBg: number = DEFAULT_COLOR;
    let curAttrs: number = Attr.NONE;

    for (let x = 0; x <= lastNonDefault; x++) {
      const cFg = buffer.getFg(x, y);
      const cBg = buffer.getBg(x, y);
      const cAttrs = buffer.getAttrs(x, y);

      if (cFg !== curFg || cBg !== curBg || cAttrs !== curAttrs) {
        line += fullSgr(cFg, cBg, cAttrs);
        curFg = cFg;
        curBg = cBg;
        curAttrs = cAttrs;
      }

      line += buffer.getChar(x, y);
    }

    if (curFg !== DEFAULT_COLOR || curBg !== DEFAULT_COLOR || curAttrs !== Attr.NONE) {
      line += RESET;
    }

    lines.push(line);
  }
  return lines;
}

/** Remove trailing empty strings from an array of lines. */
function trimTrailingEmptyLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") {
    end--;
  }
  return lines.slice(0, end);
}
