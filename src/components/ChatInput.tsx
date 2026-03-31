/**
 * ChatInput — auto-wrapping, auto-expanding chat prompt input.
 *
 * Text wraps at row end automatically. Input area grows from 1 row
 * to maxRows, then scrolls. Enter sends. No explicit newlines.
 * Designed for chat/agent interfaces.
 *
 * Unlike TextInput (single-line, horizontal scroll), ChatInput wraps
 * visually and expands vertically. The value is a single continuous
 * string — wraps are visual only, no newline characters.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { ScrollView } from "./ScrollView.js";
import { useColors } from "../hooks/useColors.js";
import { stringWidth, charWidth, iterGraphemes } from "../core/unicode.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Max rows before scrolling (default 4) */
  maxRows?: number;
  /** Maximum characters allowed. Input is capped at this length. */
  maxLength?: number;
  width?: number | `${number}%`;
  flex?: number;
  /** @deprecated Use isFocused instead */
  focus?: boolean;
  /** Whether the input is focused. */
  isFocused?: boolean;
  color?: string | number;
  placeholderColor?: string | number;
  history?: string[];
  /** When true, Enter inserts newline; Ctrl+Enter/Cmd+Enter sends. When false, Enter sends (default). */
  multiline?: boolean;
  /** When true, input is non-interactive. */
  disabled?: boolean;
  /** Called when the text selection changes. */
  onSelectionChange?: (start: number, end: number) => void;
  /** Override prompt character (from personality.interaction.promptChar). */
  promptChar?: string;
  /** Override cursor style (from personality.interaction.cursorStyle). */
  cursorStyle?: "block" | "underline" | "bar";
  "aria-label"?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Wrap a single flat string into visual rows of at most `rowWidth` cells.
 * Newline characters (\n) are treated as forced line breaks.
 * Uses grapheme iteration for correct ZWJ emoji width. */
function wrapText(text: string, rowWidth: number): string[] {
  if (rowWidth <= 0 || text.length === 0) return [""];
  const rows: string[] = [];
  // Split on newlines first to handle forced breaks
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.length === 0) {
      rows.push("");
      continue;
    }
    let remaining = line;
    while (remaining.length > 0) {
      let fit = 0;
      let w = 0;
      for (const g of iterGraphemes(remaining)) {
        if (w + g.width > rowWidth) break;
        w += g.width;
        fit += g.text.length;
      }
      if (fit === 0) {
        // Always consume at least one grapheme
        const firstG = iterGraphemes(remaining).next();
        fit = firstG.done ? 1 : firstG.value.text.length;
      }
      rows.push(remaining.slice(0, fit));
      remaining = remaining.slice(fit);
    }
  }
  return rows;
}

/** Build a mapping from wrapped row index to the flat string offset where that row starts.
 *  Accounts for `\n` characters that are consumed in the flat string but absent from rows.
 *  `wrapText` splits on `\n` first (each `\n` produces a boundary between segments),
 *  then wraps each segment. So for N newline-separated segments we have N-1 `\n` chars
 *  that each occupy 1 position in the flat string. */
function buildRowOffsets(text: string, rows: string[]): number[] {
  const offsets: number[] = [];
  // Split the same way wrapText does: by \n first
  const segments = text.split("\n");
  let flatPos = 0;
  let rowIdx = 0;
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s]!;
    // Determine how many wrapped rows this segment produced.
    // An empty segment produces exactly 1 row (the empty string).
    if (seg.length === 0) {
      // One empty row for this segment
      if (rowIdx < rows.length) {
        offsets.push(flatPos);
        rowIdx++;
      }
    } else {
      // Walk through rows that belong to this segment
      let consumed = 0;
      while (consumed < seg.length && rowIdx < rows.length) {
        offsets.push(flatPos + consumed);
        consumed += rows[rowIdx]!.length;
        rowIdx++;
      }
    }
    flatPos += seg.length;
    // Account for the \n between segments (not after the last one)
    if (s < segments.length - 1) {
      flatPos += 1; // the \n character
    }
  }
  return offsets;
}

/** Map a flat cursor position to (row, col) in wrapped rows. */
function cursorToRowCol(cursor: number, rows: string[], text?: string): { row: number; col: number } {
  // If text is provided and contains newlines, use newline-aware mapping
  if (text !== undefined && text.includes("\n")) {
    const offsets = buildRowOffsets(text, rows);
    for (let r = rows.length - 1; r >= 0; r--) {
      const rowStart = offsets[r] ?? 0;
      if (cursor >= rowStart) {
        const col = Math.min(cursor - rowStart, rows[r]!.length);
        return { row: r, col };
      }
    }
    return { row: 0, col: 0 };
  }

  // Simple path: no newlines, rows are contiguous
  let pos = 0;
  for (let r = 0; r < rows.length; r++) {
    const rowLen = rows[r]!.length;
    if (cursor <= pos + rowLen) {
      return { row: r, col: cursor - pos };
    }
    pos += rowLen;
  }
  return { row: rows.length - 1, col: rows[rows.length - 1]?.length ?? 0 };
}

/** Map (row, col) back to a flat cursor position. */
function rowColToCursor(row: number, col: number, rows: string[], text?: string): number {
  // If text is provided and contains newlines, use newline-aware mapping
  if (text !== undefined && text.includes("\n")) {
    const offsets = buildRowOffsets(text, rows);
    const rowStart = offsets[row] ?? 0;
    return rowStart + Math.min(col, rows[row]?.length ?? 0);
  }

  // Simple path: no newlines
  let pos = 0;
  for (let r = 0; r < row && r < rows.length; r++) {
    pos += rows[r]!.length;
  }
  return pos + Math.min(col, rows[row]?.length ?? 0);
}

// ── Component ────────────────────────────────────────────────────────

let chatInputCounter = 0;

export const ChatInput = React.memo(function ChatInput(rawProps: ChatInputProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ChatInput", rawProps as unknown as Record<string, unknown>) as unknown as ChatInputProps;
  const personality = usePersonality();

  const {
    value,
    onChange,
    onSubmit,
    placeholder,
    maxRows = 4,
    maxLength,
    focus: focusPropRaw,
    isFocused,
    color,
    placeholderColor,
    history = [],
    multiline = false,
    disabled = false,
    promptChar: _promptChar = personality.interaction.promptChar,
    cursorStyle: _cursorStyle = personality.interaction.cursorStyle,
    "aria-label": ariaLabel,
    ...layoutProps
  } = props;

  const focusProp = isFocused ?? focusPropRaw ?? true;

  const { input, focus, requestRender, screen } = useTui();
  const cursorRef = useRef(value.length);
  const historyIndexRef = useRef(-1);
  const historyDraftRef = useRef("");
  const idRef = useRef(`chatinput-${chatInputCounter++}`);
  const scrollTopRef = useRef(0);
  const undoStackRef = useRef<Array<{value: string, cursor: number}>>([]);
  const redoStackRef = useRef<Array<{value: string, cursor: number}>>([]);
  const selectionStartRef = useRef<number | null>(null);
  const selectionEndRef = useRef<number | null>(null);

  // Refs for latest prop values — handlers read these, not stale closures
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const historyRef = useRef(history);
  historyRef.current = history;
  const focusPropRef = useRef(focusProp);
  focusPropRef.current = focusProp;
  const maxRowsRef = useRef(maxRows);
  maxRowsRef.current = maxRows;
  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;
  const multilineRef = useRef(multiline);
  multilineRef.current = multiline;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onSelectionChangeRef = useRef(props.onSelectionChange);
  onSelectionChangeRef.current = props.onSelectionChange;

  // Keep cursor within bounds
  if (cursorRef.current > value.length) {
    cursorRef.current = value.length;
  }

  // Register focus — eagerly, once
  const focusRegistered = useRef(false);
  if (!focusRegistered.current) {
    focusRegistered.current = true;
    focus.register({
      id: idRef.current,
      type: "input",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
    if (focusProp) focus.focus(idRef.current);
  }

  // Key handler — registered ONCE, uses refs for all values
  const keyRegistered = useRef(false);
  const unsubKeyRef = useRef<(() => void) | null>(null);
  const unsubPasteRef = useRef<(() => void) | null>(null);
  if (!keyRegistered.current) {
    keyRegistered.current = true;

    // Helper: check if selection is active
    const hasSelection = () => selectionStartRef.current !== null && selectionEndRef.current !== null && selectionStartRef.current !== selectionEndRef.current;

    // Helper: clear selection and notify
    const clearSelection = () => {
      if (selectionStartRef.current !== null || selectionEndRef.current !== null) {
        selectionStartRef.current = null;
        selectionEndRef.current = null;
        onSelectionChangeRef.current?.(0, 0);
      }
    };

    // Helper: delete selected text
    const deleteSelection = (val: string): { val: string; cursor: number } => {
      const s = Math.min(selectionStartRef.current!, selectionEndRef.current!);
      const e = Math.max(selectionStartRef.current!, selectionEndRef.current!);
      clearSelection();
      return { val: val.slice(0, s) + val.slice(e), cursor: s };
    };

    // Helper: set selection and notify
    const setSelection = (start: number, end: number) => {
      selectionStartRef.current = start;
      selectionEndRef.current = end;
      onSelectionChangeRef.current?.(Math.min(start, end), Math.max(start, end));
    };

    unsubKeyRef.current = input.onKey((event) => {
      if (!focusPropRef.current) return;
      if (disabledRef.current) return;

      // Ctrl+A selects all
      if (event.ctrl && event.key === "a") {
        setSelection(0, valueRef.current.length);
        cursorRef.current = valueRef.current.length;
        requestRender();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y — check before undo
      if ((event.ctrl && event.key === "y") || (event.ctrl && event.shift && event.key === "z")) {
        clearSelection();
        const redoStack = redoStackRef.current;
        if (redoStack.length === 0) return;
        const currentState = { value: valueRef.current, cursor: cursorRef.current };
        undoStackRef.current.push(currentState);
        const next = redoStack.pop()!;
        cursorRef.current = next.cursor;
        if (next.value !== valueRef.current) onChangeRef.current(next.value);
        requestRender();
        return;
      }

      // Undo: Ctrl+Z
      if (event.ctrl && event.key === "z") {
        clearSelection();
        const undoStack = undoStackRef.current;
        if (undoStack.length === 0) return;
        const currentState = { value: valueRef.current, cursor: cursorRef.current };
        redoStackRef.current.push(currentState);
        const prev = undoStack.pop()!;
        cursorRef.current = prev.cursor;
        if (prev.value !== valueRef.current) onChangeRef.current(prev.value);
        requestRender();
        return;
      }

      // Multiline: Ctrl+Enter or Cmd+Enter sends in multiline mode
      if (multilineRef.current && (event.ctrl || event.meta) && event.key === "return") {
        clearSelection();
        onSubmitRef.current?.(valueRef.current);
        cursorRef.current = 0;
        scrollTopRef.current = 0;
        requestRender();
        return;
      }

      // Shift+Ctrl/Meta word-level selection extension
      if (event.shift && (event.ctrl || event.meta)) {
        let cursor = cursorRef.current;
        const val = valueRef.current;

        if (selectionStartRef.current === null) {
          selectionStartRef.current = cursor;
          selectionEndRef.current = cursor;
        }

        if (event.key === "left") {
          while (cursor > 0 && val[cursor - 1] === " ") cursor--;
          while (cursor > 0 && val[cursor - 1] !== " ") cursor--;
        } else if (event.key === "right") {
          while (cursor < val.length && val[cursor] !== " ") cursor++;
          while (cursor < val.length && val[cursor] === " ") cursor++;
        } else {
          return;
        }

        cursorRef.current = cursor;
        setSelection(selectionStartRef.current!, cursor);
        requestRender();
        return;
      }

      // Word-level navigation: Ctrl+Left, Ctrl+Right, Ctrl+Backspace, Ctrl+Delete
      if (event.ctrl || event.meta) {
        let cursor = cursorRef.current;
        let val = valueRef.current;
        const prevState = { value: val, cursor };

        if (hasSelection() && (event.key === "backspace" || event.key === "delete")) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
          undoStackRef.current.push(prevState);
          if (undoStackRef.current.length > 100) undoStackRef.current.shift();
          redoStackRef.current.length = 0;
          cursorRef.current = cursor;
          if (val !== valueRef.current) onChangeRef.current(val);
          requestRender();
          return;
        }

        clearSelection();

        if (event.key === "left") {
          while (cursor > 0 && val[cursor - 1] === " ") cursor--;
          while (cursor > 0 && val[cursor - 1] !== " ") cursor--;
        } else if (event.key === "right") {
          while (cursor < val.length && val[cursor] !== " ") cursor++;
          while (cursor < val.length && val[cursor] === " ") cursor++;
        } else if (event.key === "backspace") {
          let newCursor = cursor;
          while (newCursor > 0 && val[newCursor - 1] === " ") newCursor--;
          while (newCursor > 0 && val[newCursor - 1] !== " ") newCursor--;
          val = val.slice(0, newCursor) + val.slice(cursor);
          cursor = newCursor;
        } else if (event.key === "delete") {
          let end = cursor;
          while (end < val.length && val[end] !== " ") end++;
          while (end < val.length && val[end] === " ") end++;
          val = val.slice(0, cursor) + val.slice(end);
        } else {
          return;
        }

        if (val !== prevState.value) {
          undoStackRef.current.push(prevState);
          if (undoStackRef.current.length > 100) undoStackRef.current.shift();
          redoStackRef.current.length = 0;
        }

        cursorRef.current = cursor;
        if (val !== valueRef.current) onChangeRef.current(val);
        requestRender();
        return;
      }

      // Shift+arrow extends selection
      if (event.shift && (event.key === "left" || event.key === "right" || event.key === "home" || event.key === "end")) {
        let cursor = cursorRef.current;

        if (selectionStartRef.current === null) {
          selectionStartRef.current = cursor;
          selectionEndRef.current = cursor;
        }

        if (event.key === "left") {
          cursor = Math.max(0, cursor - 1);
        } else if (event.key === "right") {
          cursor = Math.min(valueRef.current.length, cursor + 1);
        } else if (event.key === "home") {
          cursor = 0;
        } else if (event.key === "end") {
          cursor = valueRef.current.length;
        }

        cursorRef.current = cursor;
        setSelection(selectionStartRef.current!, cursor);
        requestRender();
        return;
      }

      let cursor = cursorRef.current;
      let val = valueRef.current;
      const hist = historyRef.current;
      const mr = maxRowsRef.current;
      const prevState = { value: val, cursor };

      if (event.key === "return") {
        if (multilineRef.current) {
          // In multiline mode, Enter inserts newline
          if (hasSelection()) {
            const result = deleteSelection(val);
            val = result.val;
            cursor = result.cursor;
          }
          val = val.slice(0, cursor) + "\n" + val.slice(cursor);
          cursor++;
        } else {
          clearSelection();
          onSubmitRef.current?.(val);
          cursorRef.current = 0;
          scrollTopRef.current = 0;
          requestRender();
          return;
        }
      } else if (event.key === "backspace") {
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        } else if (cursor > 0) {
          val = val.slice(0, cursor - 1) + val.slice(cursor);
          cursor--;
        } else {
          return;
        }
      } else if (event.key === "delete") {
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        } else if (cursor < val.length) {
          val = val.slice(0, cursor) + val.slice(cursor + 1);
        } else {
          return;
        }
      } else if (event.key === "left") {
        clearSelection();
        cursor = Math.max(0, cursor - 1);
      } else if (event.key === "right") {
        clearSelection();
        cursor = Math.min(val.length, cursor + 1);
      } else if (event.key === "home") {
        clearSelection();
        const rows = wrapText(val, widthRef.current || 40);
        const { row } = cursorToRowCol(cursor, rows, val);
        cursor = rowColToCursor(row, 0, rows, val);
      } else if (event.key === "end") {
        clearSelection();
        const rows = wrapText(val, widthRef.current || 40);
        const { row } = cursorToRowCol(cursor, rows, val);
        cursor = rowColToCursor(row, rows[row]!.length, rows, val);
      } else if (event.key === "up" && !event.shift) {
        clearSelection();
        const rows = wrapText(val, widthRef.current || 40);
        const { row, col } = cursorToRowCol(cursor, rows, val);
        if (row > 0) {
          cursor = rowColToCursor(row - 1, Math.min(col, rows[row - 1]!.length), rows, val);
        } else if (hist.length > 0) {
          if (historyIndexRef.current === -1 && val.length === 0) return;
          if (historyIndexRef.current === -1) historyDraftRef.current = val;
          const idx = Math.min(hist.length - 1, historyIndexRef.current + 1);
          historyIndexRef.current = idx;
          val = hist[hist.length - 1 - idx]!;
          cursor = val.length;
        } else {
          return;
        }
      } else if (event.key === "down" && !event.shift) {
        clearSelection();
        const rows = wrapText(val, widthRef.current || 40);
        const { row, col } = cursorToRowCol(cursor, rows, val);
        if (row < rows.length - 1) {
          cursor = rowColToCursor(row + 1, Math.min(col, rows[row + 1]!.length), rows, val);
        } else if (historyIndexRef.current >= 0) {
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            val = hist[hist.length - 1 - historyIndexRef.current]!;
            cursor = val.length;
          } else if (historyIndexRef.current === 0) {
            historyIndexRef.current = -1;
            val = historyDraftRef.current;
            cursor = val.length;
          } else {
            return;
          }
        } else {
          return;
        }
      } else if (event.char) {
        // If selection exists, typing replaces it
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        }
        const ml = maxLengthRef.current;
        if (ml !== undefined && val.length >= ml) return;
        val = val.slice(0, cursor) + event.char + val.slice(cursor);
        cursor += event.char.length;
        if (ml !== undefined && val.length > ml) {
          val = val.slice(0, ml);
          cursor = Math.min(cursor, ml);
        }
      } else {
        return;
      }

      // Push undo state if value changed
      if (val !== prevState.value) {
        undoStackRef.current.push(prevState);
        if (undoStackRef.current.length > 100) undoStackRef.current.shift();
        redoStackRef.current.length = 0;
      }

      cursorRef.current = cursor;

      // Adjust scroll so cursor row is visible
      const rows = wrapText(val, widthRef.current || 40);
      const { row: cursorRow } = cursorToRowCol(cursor, rows, val);
      if (cursorRow < scrollTopRef.current) {
        scrollTopRef.current = cursorRow;
      } else if (cursorRow >= scrollTopRef.current + mr) {
        scrollTopRef.current = cursorRow - mr + 1;
      }

      if (val !== valueRef.current) onChangeRef.current(val);
      requestRender();
    });

    // Paste — also registered once
    unsubPasteRef.current = input.onPaste((event) => {
      if (!focusPropRef.current) return;
      if (disabledRef.current) return;
      // In multiline mode, preserve newlines; otherwise strip them
      let text = multilineRef.current ? event.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : event.text.replace(/[\r\n]/g, " ");
      let val = valueRef.current;
      let cursor = cursorRef.current;
      // Push undo state before paste
      undoStackRef.current.push({ value: val, cursor });
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current.length = 0;
      // Replace selection if active
      if (hasSelection()) {
        const result = deleteSelection(val);
        val = result.val;
        cursor = result.cursor;
      }
      const ml = maxLengthRef.current;
      // Truncate paste to fit maxLength
      if (ml !== undefined) {
        const remaining = ml - val.length;
        if (remaining <= 0) return;
        text = text.slice(0, remaining);
      }
      val = val.slice(0, cursor) + text + val.slice(cursor);
      cursorRef.current = cursor + text.length;
      onChangeRef.current(val);
      requestRender();
    });

  }

  // Cleanup key/paste subscriptions on unmount (unconditional hook call)
  useCleanup(() => { unsubKeyRef.current?.(); unsubPasteRef.current?.(); });

  // Track available width for key handler calculations
  const widthRef = useRef(40);

  // ── Rendering ────────────────────────────────────────────────────

  // Compute available width from layout props.
  // We render a tui-box and let the layout engine resolve the width.
  // The tui-text children fill each wrapped row.
  // For width calculation, we use a best-effort approach: flex=1 means
  // the component will take available space, but we don't know it at
  // render time. We use a default of 80 and the key handler uses widthRef
  // which gets updated when we can measure.

  // Use explicit width prop for wrap calculation. If not provided, fall back to screen estimate.
  const estimatedWidth = typeof layoutProps.width === "number" ? layoutProps.width
    : typeof layoutProps.flex === "number" ? Math.max(20, screen.width - 20)
    : 80;
  widthRef.current = estimatedWidth;

  const showPlaceholder = value.length === 0;
  const displayRows = value.length > 0 ? wrapText(value, estimatedWidth) : [""];
  const visibleHeight = Math.min(maxRows, Math.max(1, displayRows.length));

  // Adjust scroll for render
  const cursor = cursorRef.current;
  const { row: cursorRow, col: cursorCol } = cursorToRowCol(cursor, displayRows, value);
  if (cursorRow < scrollTopRef.current) {
    scrollTopRef.current = cursorRow;
  } else if (cursorRow >= scrollTopRef.current + maxRows) {
    scrollTopRef.current = cursorRow - maxRows + 1;
  }
  const scrollTop = scrollTopRef.current;

  // Build row elements — render ALL rows when using ScrollView, visible window otherwise
  const rowElements: React.ReactElement[] = [];
  const needsScroll = displayRows.length > maxRows;
  const renderStart = needsScroll ? 0 : scrollTop;
  const renderEnd = needsScroll ? displayRows.length : Math.min(scrollTop + visibleHeight, displayRows.length);

  // Compute selection range for render
  const selStart = selectionStartRef.current;
  const selEnd = selectionEndRef.current;
  const hasSelectionNow = selStart !== null && selEnd !== null && selStart !== selEnd;
  const selMin = hasSelectionNow ? Math.min(selStart!, selEnd!) : -1;
  const selMax = hasSelectionNow ? Math.max(selStart!, selEnd!) : -1;

  // Helper to compute flat offset for start of a wrapped row
  // Uses newline-aware mapping when the value contains \n
  const rowOffsets = value.includes("\n") ? buildRowOffsets(value, displayRows) : null;
  const rowStartOffset = (rowIdx: number): number => {
    if (rowOffsets) {
      return rowOffsets[rowIdx] ?? 0;
    }
    let off = 0;
    for (let r = 0; r < rowIdx && r < displayRows.length; r++) {
      off += displayRows[r]!.length;
    }
    return off;
  };

  if (showPlaceholder) {
    rowElements.push(
      React.createElement("tui-text", {
        key: "placeholder",
        color: placeholderColor ?? colors.text.disabled,
        dim: true,
      }, placeholder ?? ""),
    );
  } else {
    for (let i = renderStart; i < renderEnd; i++) {
      const rowText = displayRows[i]!;
      const rowOff = rowStartOffset(i);

      if (focusProp && !disabled) {
        // Build segments: normal text, selected text (inverse), cursor (inverse)
        const rowChars = Array.from(rowText);
        const segments: React.ReactElement[] = [];
        let segBuf = "";
        let segInverse = false;
        let segIdx = 0;

        const flushSeg = () => {
          if (segBuf.length > 0) {
            segments.push(
              React.createElement("tui-text", { key: `s${segIdx}`, color, ...(segInverse ? { inverse: true } : {}) }, segBuf),
            );
            segIdx++;
            segBuf = "";
          }
        };

        for (let c = 0; c < rowChars.length; c++) {
          const flatPos = rowOff + c;
          const isCursor = i === cursorRow && c === cursorCol;
          const isSelected = hasSelectionNow && flatPos >= selMin && flatPos < selMax;
          const shouldInverse = isCursor || isSelected;

          if (shouldInverse !== segInverse) {
            flushSeg();
            segInverse = shouldInverse;
          }
          segBuf += rowChars[c]!;
        }

        // Cursor at end of row
        if (i === cursorRow && cursorCol >= rowChars.length) {
          flushSeg();
          segments.push(
            React.createElement("tui-text", { key: `cursor-end`, color, inverse: true }, " "),
          );
        } else {
          flushSeg();
        }

        rowElements.push(
          React.createElement("tui-box", {
            key: `row-${i}`,
            flexDirection: "row",
            height: 1,
          }, ...segments),
        );
      } else {
        rowElements.push(
          React.createElement("tui-text", {
            key: `row-${i}`,
            color,
            ...(disabled ? { dim: true } : {}),
          }, rowText),
        );
      }
    }
  }

  if (needsScroll) {
    return React.createElement(ScrollView, {
      height: maxRows,
      scrollSpeed: 1,
      stickToBottom: false,
      ...(layoutProps.flex !== undefined ? { flex: layoutProps.flex } : {}),
      ...(layoutProps.width !== undefined ? { width: layoutProps.width } : {}),
    },
      React.createElement("tui-box", { flexDirection: "column" }, ...rowElements),
    );
  }

  return React.createElement("tui-box", {
    flexDirection: "column",
    height: visibleHeight,
    role: "textbox",
    "aria-label": ariaLabel,
    ...layoutProps,
  }, ...rowElements);
});
