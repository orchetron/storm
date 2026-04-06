import { useRef } from "react";
import type { HostTextNode } from "../../reconciler/types.js";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../useCleanup.js";

export interface UseTextInputBehaviorOptions {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: ((value: string) => void) | undefined;
  /** Whether the input is focused. */
  isFocused?: boolean | undefined;
  history?: string[] | undefined;
  /** Maximum characters allowed. Input is capped at this length. */
  maxLength?: number | undefined;
  /** When true, input is non-interactive. */
  disabled?: boolean | undefined;
  /** Called when the text selection changes. */
  onSelectionChange?: ((start: number, end: number) => void) | undefined;
}

export interface UseTextInputBehaviorResult {
  /** Current cursor position within the value string. */
  cursorPosition: number;
  /** Whether a selection range is currently active. */
  hasSelection: boolean;
  /** Start of selection range (min of anchor/cursor), or null. */
  selectionStart: number | null;
  /** End of selection range (max of anchor/cursor), or null. */
  selectionEnd: number | null;
  /** Whether the input is currently focused. */
  isFocused: boolean;
  /** Ref to pass to the host element for imperative props mutation. */
  hostPropsRef: React.MutableRefObject<any>;
  /** Unique focus ID for this input instance. */
  focusId: string;
}

let inputCounter = 0;

export function useTextInputBehavior(options: UseTextInputBehaviorOptions): UseTextInputBehaviorResult {
  const {
    value,
    onChange,
    onSubmit,
    isFocused: focusProp = true,
    history = [],
    maxLength,
    disabled = false,
    onSelectionChange,
  } = options;

  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const { input, focus, requestRender } = useTui();
  const cursorRef = useRef(value.length);
  const historyIndexRef = useRef(-1);
  const historyDraftRef = useRef("");
  const hostPropsRef = useRef<HostTextNode | null>(null);
  const idRef = useRef(`textinput-${inputCounter++}`);
  const undoStackRef = useRef<Array<{value: string, cursor: number}>>([]);
  const redoStackRef = useRef<Array<{value: string, cursor: number}>>([]);
  const selectionStartRef = useRef<number | null>(null);
  const selectionEndRef = useRef<number | null>(null);
  const unsubKeyRef = useRef<(() => void) | null>(null);
  const unsubPasteRef = useRef<(() => void) | null>(null);

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
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

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

    // Helper: delete selected text, returns {val, cursor}
    const deleteSelection = (val: string): { val: string; cursor: number } => {
      const s = Math.min(selectionStartRef.current!, selectionEndRef.current!);
      const e = Math.max(selectionStartRef.current!, selectionEndRef.current!);
      clearSelection();
      return { val: val.slice(0, s) + val.slice(e), cursor: s };
    };

    // Helper: update selection and notify
    const setSelection = (start: number, end: number) => {
      selectionStartRef.current = start;
      selectionEndRef.current = end;
      onSelectionChangeRef.current?.(Math.min(start, end), Math.max(start, end));
    };

    // Helper: commit cursor and value to host props, trigger onChange + render
    const commitState = (cursor: number, val: string) => {
      cursorRef.current = cursor;
      if (hostPropsRef.current) {
        hostPropsRef.current.cursorOffset = cursor;
        hostPropsRef.current.value = val;
      }
      if (val !== valueRef.current) onChangeRef.current(val);
      requestRender();
    };

    // Helper: push undo state (capped at 100 entries), clear redo stack
    const pushUndo = (prevState: { value: string; cursor: number }) => {
      undoStackRef.current.push(prevState);
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current.length = 0;
    };

    // Helper: initialize selection anchor at current cursor if not started
    const ensureSelectionAnchor = () => {
      if (selectionStartRef.current === null) {
        selectionStartRef.current = cursorRef.current;
        selectionEndRef.current = cursorRef.current;
      }
    };

    // Helper: move cursor word-left
    const wordLeft = (cursor: number, val: string): number => {
      while (cursor > 0 && val[cursor - 1] === " ") cursor--;
      while (cursor > 0 && val[cursor - 1] !== " ") cursor--;
      return cursor;
    };

    // Helper: move cursor word-right
    const wordRight = (cursor: number, val: string): number => {
      while (cursor < val.length && val[cursor] !== " ") cursor++;
      while (cursor < val.length && val[cursor] === " ") cursor++;
      return cursor;
    };

    /**
     * handleEditKeys — Backspace, Delete, Ctrl+Backspace/Delete (word-level),
     * undo (Ctrl+Z), redo (Ctrl+Shift+Z / Ctrl+Y), character input, return.
     * Returns true if the event was handled.
     */
    const handleEditKeys = (event: any): boolean => {
      // Redo: Ctrl+Shift+Z or Ctrl+Y — must check BEFORE undo to avoid
      // Ctrl+Shift+Z being caught by the undo (Ctrl+Z) branch.
      if ((event.ctrl && event.key === "y") || (event.ctrl && event.shift && event.key === "z")) {
        clearSelection();
        const redoStack = redoStackRef.current;
        if (redoStack.length === 0) return true;
        const currentState = { value: valueRef.current, cursor: cursorRef.current };
        undoStackRef.current.push(currentState);
        const next = redoStack.pop()!;
        commitState(next.cursor, next.value);
        return true;
      }

      // Undo: Ctrl+Z (without shift — shift case handled above)
      if (event.ctrl && event.key === "z") {
        clearSelection();
        const undoStack = undoStackRef.current;
        if (undoStack.length === 0) return true;
        const currentState = { value: valueRef.current, cursor: cursorRef.current };
        redoStackRef.current.push(currentState);
        const prev = undoStack.pop()!;
        commitState(prev.cursor, prev.value);
        return true;
      }

      // Ctrl+Backspace / Ctrl+Delete — word-level deletion
      if ((event.ctrl || event.meta) && (event.key === "backspace" || event.key === "delete")) {
        let cursor = cursorRef.current;
        let val = valueRef.current;
        const prevState = { value: val, cursor };

        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
          pushUndo(prevState);
          commitState(cursor, val);
          return true;
        }

        clearSelection();

        if (event.key === "backspace") {
          const newCursor = wordLeft(cursor, val);
          val = val.slice(0, newCursor) + val.slice(cursor);
          cursor = newCursor;
        } else {
          const end = wordRight(cursor, val);
          val = val.slice(0, cursor) + val.slice(end);
        }

        if (val !== prevState.value) pushUndo(prevState);
        commitState(cursor, val);
        return true;
      }

      // Return / Enter
      if (event.key === "return") {
        clearSelection();
        onSubmitRef.current?.(valueRef.current);
        cursorRef.current = 0;
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = 0;
        requestRender();
        return true;
      }

      // Plain Backspace
      if (event.key === "backspace" && !event.ctrl && !event.meta) {
        let cursor = cursorRef.current;
        let val = valueRef.current;
        const prevState = { value: val, cursor };
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        } else if (cursor > 0) {
          val = val.slice(0, cursor - 1) + val.slice(cursor); cursor--;
        } else return true;
        if (val !== prevState.value) pushUndo(prevState);
        commitState(cursor, val);
        return true;
      }

      // Plain Delete
      if (event.key === "delete" && !event.ctrl && !event.meta) {
        let cursor = cursorRef.current;
        let val = valueRef.current;
        const prevState = { value: val, cursor };
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        } else if (cursor < val.length) {
          val = val.slice(0, cursor) + val.slice(cursor + 1);
        } else return true;
        if (val !== prevState.value) pushUndo(prevState);
        commitState(cursor, val);
        return true;
      }

      // Regular character input
      if (event.char && !event.ctrl && !event.meta) {
        let cursor = cursorRef.current;
        let val = valueRef.current;
        const prevState = { value: val, cursor };
        // If selection exists, typing replaces it
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        }
        // Enforce maxLength — reject input if at capacity
        const ml = maxLengthRef.current;
        if (ml !== undefined && val.length >= ml) return true;
        val = val.slice(0, cursor) + event.char + val.slice(cursor);
        cursor += event.char.length;
        // Truncate if over maxLength (e.g., multi-char input)
        if (ml !== undefined && val.length > ml) {
          val = val.slice(0, ml);
          cursor = Math.min(cursor, ml);
        }
        if (val !== prevState.value) pushUndo(prevState);
        commitState(cursor, val);
        return true;
      }

      return false;
    };

    /**
     * handleSelectionKeys — Shift+arrow, Shift+Home/End, Ctrl+Shift+arrow
     * (word-level selection extension).
     * Returns true if the event was handled.
     */
    const handleSelectionKeys = (event: any): boolean => {
      // Shift+Ctrl/Meta word-level selection extension
      if (event.shift && (event.ctrl || event.meta)) {
        if (event.key !== "left" && event.key !== "right") return false;

        let cursor = cursorRef.current;
        const val = valueRef.current;
        ensureSelectionAnchor();

        if (event.key === "left") {
          cursor = wordLeft(cursor, val);
        } else {
          cursor = wordRight(cursor, val);
        }

        cursorRef.current = cursor;
        setSelection(selectionStartRef.current!, cursor);
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = cursor;
        requestRender();
        return true;
      }

      // Shift+arrow/home/end extends selection
      if (event.shift && (event.key === "left" || event.key === "right" || event.key === "home" || event.key === "end")) {
        let cursor = cursorRef.current;
        ensureSelectionAnchor();

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
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = cursor;
        requestRender();
        return true;
      }

      return false;
    };

    /**
     * handleNavigationKeys — arrow keys, Home/End, Ctrl+A (select all),
     * Ctrl+Left/Right (word navigation).
     * Returns true if the event was handled.
     */
    const handleNavigationKeys = (event: any): boolean => {
      // Ctrl+A selects all
      if (event.ctrl && event.key === "a") {
        setSelection(0, valueRef.current.length);
        cursorRef.current = valueRef.current.length;
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = valueRef.current.length;
        requestRender();
        return true;
      }

      // Ctrl+Left/Right — word-level navigation
      if ((event.ctrl || event.meta) && (event.key === "left" || event.key === "right")) {
        let cursor = cursorRef.current;
        const val = valueRef.current;
        clearSelection();

        if (event.key === "left") {
          cursor = wordLeft(cursor, val);
        } else {
          cursor = wordRight(cursor, val);
        }

        cursorRef.current = cursor;
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = cursor;
        requestRender();
        return true;
      }

      // Plain arrow keys, Home, End
      if (event.key === "left" || event.key === "right" || event.key === "home" || event.key === "end") {
        let cursor = cursorRef.current;
        clearSelection();

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
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = cursor;
        requestRender();
        return true;
      }

      return false;
    };

    /**
     * handleHistoryKeys — Up/Down for history navigation.
     * Returns true if the event was handled.
     */
    const handleHistoryKeys = (event: any): boolean => {
      const hist = historyRef.current;

      if (event.key === "up" && !event.shift && hist.length > 0) {
        clearSelection();
        const val = valueRef.current;
        if (historyIndexRef.current === -1 && val.length === 0) return true;
        if (historyIndexRef.current === -1) historyDraftRef.current = val;
        const idx = Math.min(hist.length - 1, historyIndexRef.current + 1);
        historyIndexRef.current = idx;
        const newVal = hist[hist.length - 1 - idx]!;
        commitState(newVal.length, newVal);
        return true;
      }

      if (event.key === "down" && !event.shift) {
        clearSelection();
        if (historyIndexRef.current < 0) return true;
        let newVal: string;
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          newVal = historyRef.current[historyRef.current.length - 1 - historyIndexRef.current]!;
        } else if (historyIndexRef.current === 0) {
          historyIndexRef.current = -1;
          newVal = historyDraftRef.current;
        } else {
          return true;
        }
        commitState(newVal.length, newVal);
        return true;
      }

      return false;
    };

    unsubKeyRef.current = input.onKey((event) => {
      if (!focusPropRef.current) return;
      if (disabledRef.current) return;

      if (handleEditKeys(event)) return;
      if (handleSelectionKeys(event)) return;
      if (handleNavigationKeys(event)) return;
      if (handleHistoryKeys(event)) return;
    });

    // Paste — also registered once
    unsubPasteRef.current = input.onPaste((event) => {
      if (!focusPropRef.current) return;
      let text = event.text.replace(/\n/g, " ");
      let val = valueRef.current;
      let cursor = cursorRef.current;
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
      if (hostPropsRef.current) {
        hostPropsRef.current.cursorOffset = cursorRef.current;
        hostPropsRef.current.value = val;
      }
      onChangeRef.current(val);
      requestRender();
    });

  }

  useCleanup(() => { unsubKeyRef.current?.(); unsubPasteRef.current?.(); });

  const selStart = selectionStartRef.current;
  const selEnd = selectionEndRef.current;
  const hasSelectionNow = selStart !== null && selEnd !== null && selStart !== selEnd;

  return {
    cursorPosition: cursorRef.current,
    hasSelection: hasSelectionNow,
    selectionStart: hasSelectionNow ? Math.min(selStart!, selEnd!) : null,
    selectionEnd: hasSelectionNow ? Math.max(selStart!, selEnd!) : null,
    isFocused: focusPropRef.current,
    hostPropsRef,
    focusId: idRef.current,
  };
}
