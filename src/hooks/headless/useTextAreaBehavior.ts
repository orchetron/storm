import { useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../useCleanup.js";

/** A 2D cursor position within the text area. */
export interface TextAreaPos {
  row: number;
  col: number;
}

/** Selection range expressed as two 2D positions. */
export interface TextAreaSelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface UseTextAreaBehaviorOptions {
  /** Current text value (controlled). */
  value: string;
  /** Called on every text change with the full new value. */
  onChange: (value: string) => void;
  /** Called when the submit key is pressed. */
  onSubmit?: ((value: string) => void) | undefined;
  /** Key combo that triggers onSubmit. @default "ctrl+enter" */
  submitKey?: ("ctrl+enter" | "meta+enter" | "ctrl+s") | undefined;
  /** Whether the component is focused. @default true */
  isFocused?: boolean | undefined;
  /** Read-only mode — cursor moves but text cannot be edited. */
  readOnly?: boolean | undefined;
  /** When true, input is non-interactive (no cursor, no key handling). */
  disabled?: boolean | undefined;
  /** Number of spaces inserted for Tab key. @default 2 */
  tabSize?: number | undefined;
  /** Maximum visible lines before scrolling. When undefined, grows unbounded. */
  maxLines?: number | undefined;
  /** Maximum character count. */
  maxLength?: number | undefined;
  /** Called when text selection changes. */
  onSelectionChange?: ((startRow: number, startCol: number, endRow: number, endCol: number) => void) | undefined;
}

export interface UseTextAreaBehaviorResult {
  /** The text split into lines. */
  lines: string[];
  /** Current cursor row. */
  cursorRow: number;
  /** Current cursor column. */
  cursorCol: number;
  /** Whether a selection is active. */
  hasSelection: boolean;
  /** Normalized selection range, or null if no selection. */
  selectionRange: TextAreaSelectionRange | null;
  /** Current scroll offset (first visible line index). */
  scrollOffset: number;
  /** Whether the input is currently focused. */
  isFocused: boolean;
  /** Unique focus ID for this textarea instance. */
  focusId: string;
}

// ── Pure utility functions ────────────────────────────────────────

interface Pos {
  row: number;
  col: number;
}

function splitLines(text: string): string[] {
  const lines = text.split("\n");
  return lines.length === 0 ? [""] : lines;
}

function joinLines(lines: string[]): string {
  return lines.join("\n");
}

/** Clamp a position to valid bounds within the given lines array. */
function clampPos(pos: Pos, lines: string[]): Pos {
  const row = Math.max(0, Math.min(pos.row, lines.length - 1));
  const col = Math.max(0, Math.min(pos.col, lines[row]!.length));
  return { row, col };
}

/** Compare two positions. Returns <0 if a before b, 0 if equal, >0 if a after b. */
function comparePos(a: Pos, b: Pos): number {
  if (a.row !== b.row) return a.row - b.row;
  return a.col - b.col;
}

/** Return the earlier and later of two positions (selection-order independent). */
function orderedSelection(a: Pos, b: Pos): { start: Pos; end: Pos } {
  return comparePos(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
}

/** Find the start of the current word (for ctrl+left). */
function wordLeft(line: string, col: number): number {
  let c = col;
  while (c > 0 && /\s/.test(line[c - 1]!)) c--;
  while (c > 0 && !/\s/.test(line[c - 1]!)) c--;
  return c;
}

/** Find the end of the current word (for ctrl+right). */
function wordRight(line: string, col: number): number {
  let c = col;
  while (c < line.length && !/\s/.test(line[c]!)) c++;
  while (c < line.length && /\s/.test(line[c]!)) c++;
  return c;
}

let textAreaCounter = 0;

export function useTextAreaBehavior(options: UseTextAreaBehaviorOptions): UseTextAreaBehaviorResult {
  const {
    value,
    onChange,
    onSubmit,
    submitKey = "ctrl+enter",
    isFocused: isFocusedProp = true,
    readOnly = false,
    disabled = false,
    tabSize = 2,
    maxLines,
    maxLength,
    onSelectionChange,
  } = options;

  const { input, focus, requestRender } = useTui();

  // ── Refs for mutable state ─────────────────────────────────────

  const linesRef = useRef<string[]>(splitLines(value));
  const cursorRef = useRef<Pos>({ row: 0, col: 0 });
  const scrollOffsetRef = useRef(0);
  const selAnchorRef = useRef<Pos | null>(null);
  const selEndRef = useRef<Pos | null>(null);
  const undoStackRef = useRef<Array<{ lines: string[]; cursor: Pos }>>([]);
  const redoStackRef = useRef<Array<{ lines: string[]; cursor: Pos }>>([]);
  const idRef = useRef(`textarea-${textAreaCounter++}`);
  const unsubKeyRef = useRef<(() => void) | null>(null);
  const unsubPasteRef = useRef<(() => void) | null>(null);
  const stickyColRef = useRef<number | null>(null);

  // ── Refs for latest prop values ────────────────────────────────

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const isFocusedRef = useRef(isFocusedProp);
  isFocusedRef.current = isFocusedProp;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const tabSizeRef = useRef(tabSize);
  tabSizeRef.current = tabSize;
  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;
  const maxLinesRef = useRef(maxLines);
  maxLinesRef.current = maxLines;
  const submitKeyRef = useRef(submitKey);
  submitKeyRef.current = submitKey;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  // ── Sync lines from value prop ─────────────────────────────────

  const newLines = splitLines(value);
  linesRef.current = newLines;

  // Clamp cursor to valid position if value changed externally
  const cursor = cursorRef.current;
  if (cursor.row >= newLines.length || cursor.col > (newLines[cursor.row]?.length ?? 0)) {
    cursorRef.current = clampPos(cursor, newLines);
  }

  // ── Focus registration ─────────────────────────────────────────

  const focusRegistered = useRef(false);
  if (!focusRegistered.current) {
    focusRegistered.current = true;
    focus.register({
      id: idRef.current,
      type: "input",
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
    if (isFocusedProp) focus.focus(idRef.current);
  }

  // ── Key handler (registered ONCE) ──────────────────────────────

  const keyRegistered = useRef(false);
  if (!keyRegistered.current) {
    keyRegistered.current = true;

    // ── Selection helpers ───────────────────────────────────────

    const hasSelection = (): boolean => {
      const a = selAnchorRef.current;
      const e = selEndRef.current;
      return a !== null && e !== null && comparePos(a, e) !== 0;
    };

    const clearSelection = () => {
      if (selAnchorRef.current !== null || selEndRef.current !== null) {
        selAnchorRef.current = null;
        selEndRef.current = null;
        onSelectionChangeRef.current?.(0, 0, 0, 0);
      }
    };

    const setSelection = (anchor: Pos, end: Pos) => {
      selAnchorRef.current = { ...anchor };
      selEndRef.current = { ...end };
      const { start, end: e } = orderedSelection(anchor, end);
      onSelectionChangeRef.current?.(start.row, start.col, e.row, e.col);
    };

    const deleteSelection = (lines: string[]): { lines: string[]; cursor: Pos } => {
      const { start, end } = orderedSelection(selAnchorRef.current!, selEndRef.current!);
      clearSelection();
      const before = lines[start.row]!.slice(0, start.col);
      const after = lines[end.row]!.slice(end.col);
      const newLines = [
        ...lines.slice(0, start.row),
        before + after,
        ...lines.slice(end.row + 1),
      ];
      return { lines: newLines, cursor: { ...start } };
    };

    const getSelectedText = (lines: string[]): string => {
      if (!hasSelection()) return "";
      const { start, end } = orderedSelection(selAnchorRef.current!, selEndRef.current!);
      if (start.row === end.row) {
        return lines[start.row]!.slice(start.col, end.col);
      }
      const parts: string[] = [];
      parts.push(lines[start.row]!.slice(start.col));
      for (let r = start.row + 1; r < end.row; r++) {
        parts.push(lines[r]!);
      }
      parts.push(lines[end.row]!.slice(0, end.col));
      return parts.join("\n");
    };

    // ── Undo/redo helpers ──────────────────────────────────────

    const pushUndo = (lines: string[], cursor: Pos) => {
      undoStackRef.current.push({ lines: [...lines], cursor: { ...cursor } });
      if (undoStackRef.current.length > 200) undoStackRef.current.shift();
      redoStackRef.current.length = 0;
    };

    // ── Emit change ────────────────────────────────────────────

    const emitChange = (lines: string[]) => {
      const newVal = joinLines(lines);
      if (newVal !== valueRef.current) {
        linesRef.current = lines;
        onChangeRef.current(newVal);
      }
    };

    // ── Scroll adjustment ──────────────────────────────────────

    const ensureCursorVisible = (cursorRow: number) => {
      const ml = maxLinesRef.current;
      if (ml === undefined) {
        scrollOffsetRef.current = 0;
        return;
      }
      if (cursorRow < scrollOffsetRef.current) {
        scrollOffsetRef.current = cursorRow;
      } else if (cursorRow >= scrollOffsetRef.current + ml) {
        scrollOffsetRef.current = cursorRow - ml + 1;
      }
    };

    // ── Submit check ───────────────────────────────────────────

    const isSubmitKey = (event: any): boolean => {
      const sk = submitKeyRef.current;
      if (sk === "ctrl+enter" && event.ctrl && event.key === "return") return true;
      if (sk === "meta+enter" && event.meta && event.key === "return") return true;
      if (sk === "ctrl+s" && event.ctrl && event.key === "s") return true;
      return false;
    };

    // ── Main key handler ───────────────────────────────────────

    unsubKeyRef.current = input.onKey((event) => {
      if (!isFocusedRef.current) return;
      if (disabledRef.current) return;

      let lines = linesRef.current;
      let cur = { ...cursorRef.current };
      const prevLines = lines;
      const prevCursor = { ...cur };

      // Submit key
      if (isSubmitKey(event)) {
        clearSelection();
        onSubmitRef.current?.(joinLines(lines));
        requestRender();
        return;
      }

      // Ctrl+A — select all
      if (event.ctrl && event.key === "a") {
        const lastRow = lines.length - 1;
        setSelection({ row: 0, col: 0 }, { row: lastRow, col: lines[lastRow]!.length });
        cursorRef.current = { row: lastRow, col: lines[lastRow]!.length };
        stickyColRef.current = null;
        requestRender();
        return;
      }

      // Ctrl+C — copy
      if (event.ctrl && event.key === "c") {
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y (check BEFORE undo)
      if ((event.ctrl && event.key === "y") || (event.ctrl && event.shift && event.key === "z")) {
        if (readOnlyRef.current) return;
        clearSelection();
        const stack = redoStackRef.current;
        if (stack.length === 0) return;
        undoStackRef.current.push({ lines: [...lines], cursor: { ...cur } });
        const state = stack.pop()!;
        linesRef.current = state.lines;
        cursorRef.current = { ...state.cursor };
        stickyColRef.current = null;
        ensureCursorVisible(state.cursor.row);
        emitChange(state.lines);
        requestRender();
        return;
      }

      // Undo: Ctrl+Z
      if (event.ctrl && event.key === "z") {
        if (readOnlyRef.current) return;
        clearSelection();
        const stack = undoStackRef.current;
        if (stack.length === 0) return;
        redoStackRef.current.push({ lines: [...lines], cursor: { ...cur } });
        const state = stack.pop()!;
        linesRef.current = state.lines;
        cursorRef.current = { ...state.cursor };
        stickyColRef.current = null;
        ensureCursorVisible(state.cursor.row);
        emitChange(state.lines);
        requestRender();
        return;
      }

      // ── Shift+Ctrl word-level selection extension ──────────

      if (event.shift && (event.ctrl || event.meta)) {
        if (selAnchorRef.current === null) {
          selAnchorRef.current = { ...cur };
          selEndRef.current = { ...cur };
        }

        if (event.key === "left") {
          cur.col = wordLeft(lines[cur.row]!, cur.col);
          if (cur.col === 0 && prevCursor.col === 0 && cur.row > 0) {
            cur.row--;
            cur.col = lines[cur.row]!.length;
          }
        } else if (event.key === "right") {
          const lineLen = lines[cur.row]!.length;
          cur.col = wordRight(lines[cur.row]!, cur.col);
          if (cur.col === lineLen && prevCursor.col === lineLen && cur.row < lines.length - 1) {
            cur.row++;
            cur.col = 0;
          }
        } else if (event.key === "up") {
          cur = { row: 0, col: 0 };
        } else if (event.key === "down") {
          const lastRow = lines.length - 1;
          cur = { row: lastRow, col: lines[lastRow]!.length };
        } else if (event.key === "home") {
          cur = { row: 0, col: 0 };
        } else if (event.key === "end") {
          const lastRow = lines.length - 1;
          cur = { row: lastRow, col: lines[lastRow]!.length };
        } else {
          return;
        }

        cursorRef.current = cur;
        stickyColRef.current = null;
        setSelection(selAnchorRef.current!, cur);
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      // ── Ctrl/Meta word-level navigation & deletion ─────────

      if (event.ctrl || event.meta) {
        if (hasSelection() && (event.key === "backspace" || event.key === "delete")) {
          if (readOnlyRef.current) return;
          pushUndo(lines, prevCursor);
          const result = deleteSelection(lines);
          lines = result.lines;
          cur = result.cursor;
          cursorRef.current = cur;
          stickyColRef.current = null;
          ensureCursorVisible(cur.row);
          emitChange(lines);
          requestRender();
          return;
        }

        clearSelection();

        if (event.key === "left") {
          cur.col = wordLeft(lines[cur.row]!, cur.col);
          if (cur.col === 0 && prevCursor.col === 0 && cur.row > 0) {
            cur.row--;
            cur.col = lines[cur.row]!.length;
          }
        } else if (event.key === "right") {
          const lineLen = lines[cur.row]!.length;
          cur.col = wordRight(lines[cur.row]!, cur.col);
          if (cur.col === lineLen && prevCursor.col === lineLen && cur.row < lines.length - 1) {
            cur.row++;
            cur.col = 0;
          }
        } else if (event.key === "backspace") {
          if (readOnlyRef.current) return;
          pushUndo(lines, prevCursor);
          const newCol = wordLeft(lines[cur.row]!, cur.col);
          if (newCol < cur.col) {
            const line = lines[cur.row]!;
            lines = [...lines];
            lines[cur.row] = line.slice(0, newCol) + line.slice(cur.col);
            cur.col = newCol;
          } else if (cur.row > 0) {
            const prevLen = lines[cur.row - 1]!.length;
            lines = [...lines];
            lines[cur.row - 1] = lines[cur.row - 1]! + lines[cur.row]!;
            lines.splice(cur.row, 1);
            cur.row--;
            cur.col = prevLen;
          } else {
            return;
          }
          cursorRef.current = cur;
          stickyColRef.current = null;
          ensureCursorVisible(cur.row);
          emitChange(lines);
          requestRender();
          return;
        } else if (event.key === "delete") {
          if (readOnlyRef.current) return;
          pushUndo(lines, prevCursor);
          const newCol = wordRight(lines[cur.row]!, cur.col);
          if (newCol > cur.col) {
            const line = lines[cur.row]!;
            lines = [...lines];
            lines[cur.row] = line.slice(0, cur.col) + line.slice(newCol);
          } else if (cur.row < lines.length - 1) {
            lines = [...lines];
            lines[cur.row] = lines[cur.row]! + lines[cur.row + 1]!;
            lines.splice(cur.row + 1, 1);
          } else {
            return;
          }
          cursorRef.current = cur;
          stickyColRef.current = null;
          emitChange(lines);
          requestRender();
          return;
        } else if (event.key === "home") {
          cur = { row: 0, col: 0 };
        } else if (event.key === "end") {
          const lastRow = lines.length - 1;
          cur = { row: lastRow, col: lines[lastRow]!.length };
        } else {
          return;
        }

        cursorRef.current = cur;
        stickyColRef.current = null;
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      // ── Shift+arrow extends selection ──────────────────────

      if (event.shift && (event.key === "left" || event.key === "right" ||
          event.key === "up" || event.key === "down" ||
          event.key === "home" || event.key === "end")) {
        if (selAnchorRef.current === null) {
          selAnchorRef.current = { ...cur };
          selEndRef.current = { ...cur };
        }

        if (event.key === "left") {
          if (cur.col > 0) {
            cur.col--;
          } else if (cur.row > 0) {
            cur.row--;
            cur.col = lines[cur.row]!.length;
          }
          stickyColRef.current = null;
        } else if (event.key === "right") {
          if (cur.col < lines[cur.row]!.length) {
            cur.col++;
          } else if (cur.row < lines.length - 1) {
            cur.row++;
            cur.col = 0;
          }
          stickyColRef.current = null;
        } else if (event.key === "up") {
          if (cur.row > 0) {
            if (stickyColRef.current === null) stickyColRef.current = cur.col;
            cur.row--;
            cur.col = Math.min(stickyColRef.current, lines[cur.row]!.length);
          }
        } else if (event.key === "down") {
          if (cur.row < lines.length - 1) {
            if (stickyColRef.current === null) stickyColRef.current = cur.col;
            cur.row++;
            cur.col = Math.min(stickyColRef.current, lines[cur.row]!.length);
          }
        } else if (event.key === "home") {
          cur.col = 0;
          stickyColRef.current = null;
        } else if (event.key === "end") {
          cur.col = lines[cur.row]!.length;
          stickyColRef.current = null;
        }

        cursorRef.current = cur;
        setSelection(selAnchorRef.current!, cur);
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      // ── Navigation keys ────────────────────────────────────

      if (event.key === "left") {
        if (hasSelection()) {
          const { start } = orderedSelection(selAnchorRef.current!, selEndRef.current!);
          cur = { ...start };
          clearSelection();
        } else if (cur.col > 0) {
          cur.col--;
        } else if (cur.row > 0) {
          cur.row--;
          cur.col = lines[cur.row]!.length;
        }
        stickyColRef.current = null;
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      if (event.key === "right") {
        if (hasSelection()) {
          const { end } = orderedSelection(selAnchorRef.current!, selEndRef.current!);
          cur = { ...end };
          clearSelection();
        } else if (cur.col < lines[cur.row]!.length) {
          cur.col++;
        } else if (cur.row < lines.length - 1) {
          cur.row++;
          cur.col = 0;
        }
        stickyColRef.current = null;
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      if (event.key === "up") {
        clearSelection();
        if (cur.row > 0) {
          if (stickyColRef.current === null) stickyColRef.current = cur.col;
          cur.row--;
          cur.col = Math.min(stickyColRef.current, lines[cur.row]!.length);
          cursorRef.current = cur;
          ensureCursorVisible(cur.row);
          requestRender();
        }
        return;
      }

      if (event.key === "down") {
        clearSelection();
        if (cur.row < lines.length - 1) {
          if (stickyColRef.current === null) stickyColRef.current = cur.col;
          cur.row++;
          cur.col = Math.min(stickyColRef.current, lines[cur.row]!.length);
          cursorRef.current = cur;
          ensureCursorVisible(cur.row);
          requestRender();
        }
        return;
      }

      if (event.key === "home") {
        clearSelection();
        cur.col = 0;
        stickyColRef.current = null;
        cursorRef.current = cur;
        requestRender();
        return;
      }

      if (event.key === "end") {
        clearSelection();
        cur.col = lines[cur.row]!.length;
        stickyColRef.current = null;
        cursorRef.current = cur;
        requestRender();
        return;
      }

      if (event.key === "pageup") {
        clearSelection();
        const jump = maxLinesRef.current ?? 10;
        cur.row = Math.max(0, cur.row - jump);
        cur.col = Math.min(cur.col, lines[cur.row]!.length);
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      if (event.key === "pagedown") {
        clearSelection();
        const jump = maxLinesRef.current ?? 10;
        cur.row = Math.min(lines.length - 1, cur.row + jump);
        cur.col = Math.min(cur.col, lines[cur.row]!.length);
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        requestRender();
        return;
      }

      // ── Editing keys (blocked in readOnly mode) ────────────

      if (event.key === "return") {
        if (readOnlyRef.current) return;
        if (hasSelection()) {
          pushUndo(lines, prevCursor);
          const result = deleteSelection(lines);
          lines = result.lines;
          cur = result.cursor;
        } else {
          pushUndo(lines, prevCursor);
        }
        const ml = maxLengthRef.current;
        if (ml !== undefined && joinLines(lines).length >= ml) return;
        const before = lines[cur.row]!.slice(0, cur.col);
        const after = lines[cur.row]!.slice(cur.col);
        lines = [...lines];
        lines.splice(cur.row, 1, before, after);
        cur.row++;
        cur.col = 0;
        stickyColRef.current = null;
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        emitChange(lines);
        requestRender();
        return;
      }

      if (event.key === "backspace") {
        if (readOnlyRef.current) return;
        if (hasSelection()) {
          pushUndo(lines, prevCursor);
          const result = deleteSelection(lines);
          lines = result.lines;
          cur = result.cursor;
        } else if (cur.col > 0) {
          pushUndo(lines, prevCursor);
          const line = lines[cur.row]!;
          lines = [...lines];
          lines[cur.row] = line.slice(0, cur.col - 1) + line.slice(cur.col);
          cur.col--;
        } else if (cur.row > 0) {
          pushUndo(lines, prevCursor);
          const prevLen = lines[cur.row - 1]!.length;
          lines = [...lines];
          lines[cur.row - 1] = lines[cur.row - 1]! + lines[cur.row]!;
          lines.splice(cur.row, 1);
          cur.row--;
          cur.col = prevLen;
        } else {
          return;
        }
        stickyColRef.current = null;
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        emitChange(lines);
        requestRender();
        return;
      }

      if (event.key === "delete") {
        if (readOnlyRef.current) return;
        if (hasSelection()) {
          pushUndo(lines, prevCursor);
          const result = deleteSelection(lines);
          lines = result.lines;
          cur = result.cursor;
        } else if (cur.col < lines[cur.row]!.length) {
          pushUndo(lines, prevCursor);
          const line = lines[cur.row]!;
          lines = [...lines];
          lines[cur.row] = line.slice(0, cur.col) + line.slice(cur.col + 1);
        } else if (cur.row < lines.length - 1) {
          pushUndo(lines, prevCursor);
          lines = [...lines];
          lines[cur.row] = lines[cur.row]! + lines[cur.row + 1]!;
          lines.splice(cur.row + 1, 1);
        } else {
          return;
        }
        stickyColRef.current = null;
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        emitChange(lines);
        requestRender();
        return;
      }

      if (event.key === "tab") {
        if (readOnlyRef.current) return;
        const spaces = " ".repeat(tabSizeRef.current);
        if (hasSelection()) {
          pushUndo(lines, prevCursor);
          const result = deleteSelection(lines);
          lines = result.lines;
          cur = result.cursor;
        } else {
          pushUndo(lines, prevCursor);
        }
        const ml = maxLengthRef.current;
        const currentLen = joinLines(lines).length;
        if (ml !== undefined && currentLen + spaces.length > ml) return;
        const line = lines[cur.row]!;
        lines = [...lines];
        lines[cur.row] = line.slice(0, cur.col) + spaces + line.slice(cur.col);
        cur.col += spaces.length;
        stickyColRef.current = null;
        cursorRef.current = cur;
        emitChange(lines);
        requestRender();
        return;
      }

      // ── Character input ────────────────────────────────────

      if (event.char) {
        if (readOnlyRef.current) return;
        if (hasSelection()) {
          pushUndo(lines, prevCursor);
          const result = deleteSelection(lines);
          lines = result.lines;
          cur = result.cursor;
        } else {
          pushUndo(lines, prevCursor);
        }
        const ml = maxLengthRef.current;
        if (ml !== undefined && joinLines(lines).length >= ml) return;
        const line = lines[cur.row]!;
        lines = [...lines];
        lines[cur.row] = line.slice(0, cur.col) + event.char + line.slice(cur.col);
        cur.col += event.char.length;
        if (ml !== undefined) {
          const joined = joinLines(lines);
          if (joined.length > ml) {
            lines = splitLines(joined.slice(0, ml));
            cur = clampPos(cur, lines);
          }
        }
        stickyColRef.current = null;
        cursorRef.current = cur;
        ensureCursorVisible(cur.row);
        emitChange(lines);
        requestRender();
        return;
      }
    });

    // ── Paste handler ──────────────────────────────────────────

    unsubPasteRef.current = input.onPaste((event) => {
      if (!isFocusedRef.current) return;
      if (disabledRef.current) return;
      if (readOnlyRef.current) return;

      let text = event.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      let lines = linesRef.current;
      let cur = { ...cursorRef.current };

      pushUndo(lines, cur);

      if (hasSelection()) {
        const result = deleteSelection(lines);
        lines = result.lines;
        cur = result.cursor;
      }

      const ml = maxLengthRef.current;
      if (ml !== undefined) {
        const remaining = ml - joinLines(lines).length;
        if (remaining <= 0) return;
        text = text.slice(0, remaining);
      }

      const pastedLines = text.split("\n");
      const lineAfterCursor = lines[cur.row]!.slice(cur.col);
      const lineBeforeCursor = lines[cur.row]!.slice(0, cur.col);

      lines = [...lines];

      if (pastedLines.length === 1) {
        lines[cur.row] = lineBeforeCursor + pastedLines[0]! + lineAfterCursor;
        cur.col += pastedLines[0]!.length;
      } else {
        const newLines: string[] = [];
        newLines.push(lineBeforeCursor + pastedLines[0]!);
        for (let i = 1; i < pastedLines.length - 1; i++) {
          newLines.push(pastedLines[i]!);
        }
        const lastPasted = pastedLines[pastedLines.length - 1]!;
        newLines.push(lastPasted + lineAfterCursor);
        lines.splice(cur.row, 1, ...newLines);
        cur.row += pastedLines.length - 1;
        cur.col = lastPasted.length;
      }

      stickyColRef.current = null;
      cursorRef.current = cur;
      linesRef.current = lines;
      ensureCursorVisible(cur.row);
      emitChange(lines);
      requestRender();
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────

  useCleanup(() => {
    unsubKeyRef.current?.();
    unsubPasteRef.current?.();
  });

  // ── Build result ───────────────────────────────────────────────

  const lines = linesRef.current;
  const curPos = cursorRef.current;

  const selA = selAnchorRef.current;
  const selE = selEndRef.current;
  const hasSel = selA !== null && selE !== null && comparePos(selA, selE) !== 0;

  let selectionRange: TextAreaSelectionRange | null = null;
  if (hasSel) {
    const { start, end } = orderedSelection(selA!, selE!);
    selectionRange = {
      startRow: start.row,
      startCol: start.col,
      endRow: end.row,
      endCol: end.col,
    };
  }

  return {
    lines,
    cursorRow: curPos.row,
    cursorCol: curPos.col,
    hasSelection: hasSel,
    selectionRange,
    scrollOffset: scrollOffsetRef.current,
    isFocused: isFocusedRef.current,
    focusId: idRef.current,
  };
}
