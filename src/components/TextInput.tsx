/**
 * TextInput — single-line text input with cursor and focus.
 *
 * All handlers registered ONCE eagerly. Uses refs for latest props.
 * No useEffect for event handlers (cleanup doesn't fire in our reconciler).
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { useStyles } from "../core/style-provider.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** @deprecated Use isFocused instead */
  focus?: boolean;
  /** Whether the input is focused. */
  isFocused?: boolean;
  /** Alias for `focus`. When both are provided, `focus` takes precedence. */
  autoFocus?: boolean;
  color?: string | number;
  placeholderColor?: string | number;
  history?: string[];
  /** Maximum characters allowed. Input is capped at this length. */
  maxLength?: number;
  /** When true, input is non-interactive. */
  disabled?: boolean;
  /** Called when the text selection changes. */
  onSelectionChange?: (start: number, end: number) => void;
  width?: number | `${number}%`;
  height?: number;
  flex?: number;
  /** CSS-like class name(s) for StyleSheet matching (space-separated). */
  className?: string;
  /** CSS-like ID for StyleSheet matching (without the '#' prefix). */
  id?: string;
  "aria-label"?: string;
}

let inputCounter = 0;

export const TextInput = React.memo(function TextInput(rawProps: TextInputProps): React.ReactElement {
  const props = usePluginProps("TextInput", rawProps as unknown as Record<string, unknown>) as unknown as TextInputProps;
  const {
    value,
    onChange,
    onSubmit,
    placeholder,
    focus: focusPropRaw,
    isFocused,
    autoFocus,
    color: colorProp,
    placeholderColor,
    history = [],
    maxLength,
    disabled = false,
    className,
    id,
    "aria-label": ariaLabel,
    ...layoutProps
  } = props;

  const focusProp = isFocused ?? focusPropRaw ?? autoFocus ?? true;

  // Resolve stylesheet styles
  const ssStates = new Set<string>();
  if (focusProp) ssStates.add("focused");
  if (disabled) ssStates.add("disabled");
  const ssStyles = useStyles("TextInput", className, id, ssStates);

  // Explicit color prop wins over stylesheet
  const color = colorProp ?? (ssStyles.color as string | number | undefined);

  const maxLengthRef = useRef(maxLength);
  maxLengthRef.current = maxLength;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const { input, focus, requestRender } = useTui();
  const cursorRef = useRef(value.length);
  const historyIndexRef = useRef(-1);
  const historyDraftRef = useRef("");
  const hostPropsRef = useRef<any>(null);
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

    unsubKeyRef.current = input.onKey((event) => {
      if (!focusPropRef.current) return;
      if (disabledRef.current) return;

      // Ctrl+A selects all
      if (event.ctrl && event.key === "a") {
        setSelection(0, valueRef.current.length);
        cursorRef.current = valueRef.current.length;
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = valueRef.current.length;
        requestRender();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y — must check BEFORE undo to avoid
      // Ctrl+Shift+Z being caught by the undo (Ctrl+Z) branch.
      if ((event.ctrl && event.key === "y") || (event.ctrl && event.shift && event.key === "z")) {
        clearSelection();
        const redoStack = redoStackRef.current;
        if (redoStack.length === 0) return;
        const currentState = { value: valueRef.current, cursor: cursorRef.current };
        undoStackRef.current.push(currentState);
        const next = redoStack.pop()!;
        cursorRef.current = next.cursor;
        if (hostPropsRef.current) {
          hostPropsRef.current.cursorOffset = next.cursor;
          hostPropsRef.current.value = next.value;
        }
        if (next.value !== valueRef.current) onChangeRef.current(next.value);
        requestRender();
        return;
      }

      // Undo: Ctrl+Z (without shift — shift case handled above)
      if (event.ctrl && event.key === "z") {
        clearSelection();
        const undoStack = undoStackRef.current;
        if (undoStack.length === 0) return;
        const currentState = { value: valueRef.current, cursor: cursorRef.current };
        redoStackRef.current.push(currentState);
        const prev = undoStack.pop()!;
        cursorRef.current = prev.cursor;
        if (hostPropsRef.current) {
          hostPropsRef.current.cursorOffset = prev.cursor;
          hostPropsRef.current.value = prev.value;
        }
        if (prev.value !== valueRef.current) onChangeRef.current(prev.value);
        requestRender();
        return;
      }

      // Shift+Ctrl/Meta word-level selection extension
      if (event.shift && (event.ctrl || event.meta)) {
        let cursor = cursorRef.current;
        const val = valueRef.current;

        // Initialize selection anchor if not yet started
        if (selectionStartRef.current === null) {
          selectionStartRef.current = cursor;
          selectionEndRef.current = cursor;
        }

        if (event.key === "left") {
          // Extend selection word left
          while (cursor > 0 && val[cursor - 1] === " ") cursor--;
          while (cursor > 0 && val[cursor - 1] !== " ") cursor--;
        } else if (event.key === "right") {
          // Extend selection word right
          while (cursor < val.length && val[cursor] !== " ") cursor++;
          while (cursor < val.length && val[cursor] === " ") cursor++;
        } else {
          return;
        }

        cursorRef.current = cursor;
        setSelection(selectionStartRef.current!, cursor);
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = cursor;
        requestRender();
        return;
      }

      // Word-level navigation: Ctrl+Left, Ctrl+Right, Ctrl+Backspace, Ctrl+Delete
      if (event.ctrl || event.meta) {
        let cursor = cursorRef.current;
        let val = valueRef.current;
        const prevState = { value: val, cursor };

        // Delete selection first if applicable for destructive ops
        if (hasSelection() && (event.key === "backspace" || event.key === "delete")) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
          undoStackRef.current.push(prevState);
          if (undoStackRef.current.length > 100) undoStackRef.current.shift();
          redoStackRef.current.length = 0;
          cursorRef.current = cursor;
          if (hostPropsRef.current) {
            hostPropsRef.current.cursorOffset = cursor;
            hostPropsRef.current.value = val;
          }
          if (val !== valueRef.current) onChangeRef.current(val);
          requestRender();
          return;
        }

        clearSelection();

        if (event.key === "left") {
          // Jump word left: skip whitespace then word chars
          while (cursor > 0 && val[cursor - 1] === " ") cursor--;
          while (cursor > 0 && val[cursor - 1] !== " ") cursor--;
        } else if (event.key === "right") {
          // Jump word right: skip word chars then whitespace
          while (cursor < val.length && val[cursor] !== " ") cursor++;
          while (cursor < val.length && val[cursor] === " ") cursor++;
        } else if (event.key === "backspace") {
          // Delete word left
          let newCursor = cursor;
          while (newCursor > 0 && val[newCursor - 1] === " ") newCursor--;
          while (newCursor > 0 && val[newCursor - 1] !== " ") newCursor--;
          val = val.slice(0, newCursor) + val.slice(cursor);
          cursor = newCursor;
        } else if (event.key === "delete") {
          // Delete word right
          let end = cursor;
          while (end < val.length && val[end] !== " ") end++;
          while (end < val.length && val[end] === " ") end++;
          val = val.slice(0, cursor) + val.slice(end);
        } else {
          // Unknown ctrl/meta combo — ignore
          return;
        }

        // Push undo state if value changed
        if (val !== prevState.value) {
          undoStackRef.current.push(prevState);
          if (undoStackRef.current.length > 100) undoStackRef.current.shift();
          redoStackRef.current.length = 0;
        }

        cursorRef.current = cursor;
        if (hostPropsRef.current) {
          hostPropsRef.current.cursorOffset = cursor;
          hostPropsRef.current.value = val;
        }
        if (val !== valueRef.current) onChangeRef.current(val);
        requestRender();
        return;
      }

      // Shift+arrow/home/end extends selection
      if (event.shift && (event.key === "left" || event.key === "right" || event.key === "home" || event.key === "end")) {
        let cursor = cursorRef.current;

        // Initialize selection anchor if not yet started
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
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = cursor;
        requestRender();
        return;
      }

      let cursor = cursorRef.current;
      let val = valueRef.current;
      const hist = historyRef.current;
      const prevState = { value: val, cursor };

      if (event.key === "return") {
        clearSelection();
        onSubmitRef.current?.(val);
        cursorRef.current = 0;
        if (hostPropsRef.current) hostPropsRef.current.cursorOffset = 0;
        requestRender();
        return;
      }

      if (event.key === "backspace") {
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        } else if (cursor > 0) {
          val = val.slice(0, cursor - 1) + val.slice(cursor); cursor--;
        } else return;
      } else if (event.key === "delete") {
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        } else if (cursor < val.length) {
          val = val.slice(0, cursor) + val.slice(cursor + 1);
        } else return;
      } else if (event.key === "left") {
        clearSelection();
        cursor = Math.max(0, cursor - 1);
      } else if (event.key === "right") {
        clearSelection();
        cursor = Math.min(val.length, cursor + 1);
      } else if (event.key === "home") {
        clearSelection();
        cursor = 0;
      } else if (event.key === "end") {
        clearSelection();
        cursor = val.length;
      } else if (event.key === "up" && !event.shift && hist.length > 0) {
        clearSelection();
        if (historyIndexRef.current === -1 && val.length === 0) return;
        if (historyIndexRef.current === -1) historyDraftRef.current = val;
        const idx = Math.min(hist.length - 1, historyIndexRef.current + 1);
        historyIndexRef.current = idx;
        val = hist[hist.length - 1 - idx]!;
        cursor = val.length;
      } else if (event.key === "down" && !event.shift) {
        clearSelection();
        if (historyIndexRef.current < 0) return;
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          val = hist[hist.length - 1 - historyIndexRef.current]!;
          cursor = val.length;
        } else if (historyIndexRef.current === 0) {
          historyIndexRef.current = -1;
          val = historyDraftRef.current;
          cursor = val.length;
        } else return;
      } else if (event.char) {
        // If selection exists, typing replaces it
        if (hasSelection()) {
          const result = deleteSelection(val);
          val = result.val;
          cursor = result.cursor;
        }
        // Enforce maxLength — reject input if at capacity
        const ml = maxLengthRef.current;
        if (ml !== undefined && val.length >= ml) return;
        val = val.slice(0, cursor) + event.char + val.slice(cursor);
        cursor += event.char.length;
        // Truncate if over maxLength (e.g., multi-char input)
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
      if (hostPropsRef.current) {
        hostPropsRef.current.cursorOffset = cursor;
        hostPropsRef.current.value = val;
      }
      if (val !== valueRef.current) onChangeRef.current(val);
      requestRender();
    });

    // Paste — also registered once
    unsubPasteRef.current = input.onPaste((event) => {
      if (!focusPropRef.current) return;
      let text = event.text.replace(/\n/g, " ");
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
      if (hostPropsRef.current) {
        hostPropsRef.current.cursorOffset = cursorRef.current;
        hostPropsRef.current.value = val;
      }
      onChangeRef.current(val);
      requestRender();
    });

  }

  useCleanup(() => { unsubKeyRef.current?.(); unsubPasteRef.current?.(); });

  // Compute selection range for render
  const selStart = selectionStartRef.current;
  const selEnd = selectionEndRef.current;
  const hasSelectionNow = selStart !== null && selEnd !== null && selStart !== selEnd;

  return React.createElement("tui-text-input", {
    role: "textbox",
    value,
    cursorOffset: cursorRef.current,
    focus: focusPropRef.current,
    placeholder,
    color,
    placeholderColor,
    _hostPropsRef: hostPropsRef,
    _focusId: idRef.current,
    "aria-label": ariaLabel,
    ...(hasSelectionNow ? { selectionStart: Math.min(selStart!, selEnd!), selectionEnd: Math.max(selStart!, selEnd!), inverse: true } : {}),
    ...layoutProps,
    height: layoutProps.height ?? 1,
  });
});
