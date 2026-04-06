import React, { useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface MaskedInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  mask: string;
  placeholder?: string;
  color?: string | number;
  /** @deprecated Use isFocused instead */
  focus?: boolean;
  /** Whether the input is focused. */
  isFocused?: boolean;
  disabled?: boolean;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  flex?: number;
  /** Custom render for the formatted display. */
  renderDisplay?: (formatted: string, cursor: number) => React.ReactNode;
  "aria-label"?: string;
}

let maskedInputCounter = 0;

/**
 * Check if a character matches the mask slot at the given position.
 * # = digit, A = letter, * = any printable character.
 */
function matchesMaskSlot(maskChar: string, inputChar: string): boolean {
  if (maskChar === "#") return /\d/.test(inputChar);
  if (maskChar === "A") return /[a-zA-Z]/.test(inputChar);
  if (maskChar === "*") return inputChar.length === 1;
  return false;
}

function isLiteralSlot(maskChar: string): boolean {
  return maskChar !== "#" && maskChar !== "A" && maskChar !== "*";
}

function formatWithMask(raw: string, mask: string): string {
  let result = "";
  let rawIdx = 0;
  for (let m = 0; m < mask.length && rawIdx < raw.length; m++) {
    const mc = mask[m]!;
    if (isLiteralSlot(mc)) {
      result += mc;
    } else {
      result += raw[rawIdx]!;
      rawIdx++;
    }
  }
  return result;
}

function rawCursorToFormatted(rawCursor: number, mask: string): number {
  let rawCount = 0;
  for (let m = 0; m < mask.length; m++) {
    if (rawCount === rawCursor) return m;
    if (!isLiteralSlot(mask[m]!)) rawCount++;
  }
  // Cursor is at or past end of mask input slots
  return mask.length;
}

export const MaskedInput = React.memo(function MaskedInput(rawProps: MaskedInputProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("MaskedInput", rawProps);
  const {
    value,
    onChange,
    onSubmit,
    mask,
    placeholder,
    color = colors.text.primary,
    focus: focusPropRaw,
    isFocused,
    disabled = false,
    width,
    height,
    flex,
  } = props;

  const focusProp = isFocused ?? focusPropRaw ?? true;

  const { input, focus, requestRender } = useTui();
  const idRef = useRef(`maskedinput-${maskedInputCounter++}`);
  const cursorRef = useRef(0);
  const undoStackRef = useRef<Array<{value: string, cursor: number}>>([]);
  const redoStackRef = useRef<Array<{value: string, cursor: number}>>([]);
  const unsubKeyRef = useRef<(() => void) | null>(null);
  const unsubPasteRef = useRef<(() => void) | null>(null);

  // Refs for latest prop values
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const maskRef = useRef(mask);
  maskRef.current = mask;
  const focusPropRef = useRef(focusProp);
  focusPropRef.current = focusProp;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Keep cursor within bounds
  if (cursorRef.current > value.length) {
    cursorRef.current = value.length;
  }

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

    // Helper: count max input slots in mask
    const maxRawLength = (m: string) => {
      let count = 0;
      for (let i = 0; i < m.length; i++) {
        if (!isLiteralSlot(m[i]!)) count++;
      }
      return count;
    };

    unsubKeyRef.current = input.onKey((event) => {
      if (!focusPropRef.current) return;
      if (disabledRef.current) return;

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((event.ctrl && event.key === "y") || (event.ctrl && event.shift && event.key === "z")) {
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

      if (event.ctrl || event.meta) return;

      let val = valueRef.current;
      const m = maskRef.current;
      let cursor = cursorRef.current;
      const prevState = { value: val, cursor };

      if (event.key === "return") {
        onSubmitRef.current?.(val);
        return;
      }

      if (event.key === "left") {
        cursor = Math.max(0, cursor - 1);
        cursorRef.current = cursor;
        requestRender();
        return;
      }

      if (event.key === "right") {
        cursor = Math.min(val.length, cursor + 1);
        cursorRef.current = cursor;
        requestRender();
        return;
      }

      if (event.key === "home") {
        cursorRef.current = 0;
        requestRender();
        return;
      }

      if (event.key === "end") {
        cursorRef.current = val.length;
        requestRender();
        return;
      }

      if (event.key === "backspace") {
        if (cursor > 0) {
          val = val.slice(0, cursor - 1) + val.slice(cursor);
          cursor--;
        } else {
          return;
        }
      } else if (event.key === "delete") {
        if (cursor < val.length) {
          val = val.slice(0, cursor) + val.slice(cursor + 1);
        } else {
          return;
        }
      } else if (event.char && event.char.length === 1) {
        let rawCount = 0;
        let nextMaskPos = -1;
        for (let i = 0; i < m.length; i++) {
          if (isLiteralSlot(m[i]!)) continue;
          if (rawCount === cursor) {
            nextMaskPos = i;
            break;
          }
          rawCount++;
        }

        if (nextMaskPos === -1) return; // mask is full at cursor position

        const mc = m[nextMaskPos]!;
        if (!matchesMaskSlot(mc, event.char)) return; // doesn't match pattern

        val = val.slice(0, cursor) + event.char + val.slice(cursor);
        cursor++;
      } else {
        return;
      }

      if (val !== prevState.value) {
        undoStackRef.current.push(prevState);
        if (undoStackRef.current.length > 100) undoStackRef.current.shift();
        redoStackRef.current.length = 0;
      }

      cursorRef.current = cursor;
      if (val !== valueRef.current) {
        onChangeRef.current(val);
      }
      requestRender();
    });

    // Paste handler — filter pasted text through mask slots
    unsubPasteRef.current = input.onPaste((event) => {
      if (!focusPropRef.current) return;
      if (disabledRef.current) return;
      const m = maskRef.current;
      let val = valueRef.current;
      let cursor = cursorRef.current;
      const prevState = { value: val, cursor };

      // Filter pasted text: only accept characters that match upcoming mask slots
      let filtered = "";
      let tempCursor = cursor;
      for (const ch of event.text) {
        let rawCount = 0;
        let nextMaskPos = -1;
        for (let i = 0; i < m.length; i++) {
          if (isLiteralSlot(m[i]!)) continue;
          if (rawCount === tempCursor) {
            nextMaskPos = i;
            break;
          }
          rawCount++;
        }
        if (nextMaskPos === -1) break; // no more slots
        const mc = m[nextMaskPos]!;
        if (matchesMaskSlot(mc, ch)) {
          filtered += ch;
          tempCursor++;
        }
      }

      if (filtered.length === 0) return;

      undoStackRef.current.push(prevState);
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current.length = 0;

      val = val.slice(0, cursor) + filtered + val.slice(cursor);
      // Cap at max raw length
      const maxRaw = maxRawLength(m);
      if (val.length > maxRaw) val = val.slice(0, maxRaw);
      cursorRef.current = Math.min(cursor + filtered.length, val.length);
      onChangeRef.current(val);
      requestRender();
    });

  }

  useCleanup(() => { unsubKeyRef.current?.(); unsubPasteRef.current?.(); });

  const formatted = formatWithMask(value, mask);
  const showPlaceholder = formatted.length === 0;
  const displayText = showPlaceholder
    ? placeholder ?? mask.replace(/#/g, "_").replace(/A/g, "_").replace(/\*/g, "_")
    : formatted;
  const displayColor = showPlaceholder ? colors.text.dim : color;

  const layoutProps: Record<string, unknown> = {
    flexDirection: "row",
    role: "textbox",
    "aria-label": props["aria-label"],
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(flex !== undefined ? { flex } : {}),
  };

  // Custom render delegate
  if (props.renderDisplay) {
    return React.createElement(
      "tui-box",
      layoutProps,
      props.renderDisplay(formatted, cursorRef.current),
    );
  }

  if (focusProp && !disabled) {
    const formattedCursorPos = showPlaceholder
      ? 0
      : rawCursorToFormatted(cursorRef.current, mask);
    const textToSplit = displayText;
    const before = textToSplit.slice(0, formattedCursorPos);
    const cursorChar = formattedCursorPos < textToSplit.length
      ? textToSplit[formattedCursorPos]!
      : " ";
    const after = formattedCursorPos < textToSplit.length
      ? textToSplit.slice(formattedCursorPos + 1)
      : "";

    return React.createElement(
      "tui-box",
      layoutProps,
      before.length > 0
        ? React.createElement("tui-text", { key: "before", color: displayColor }, before)
        : null,
      React.createElement("tui-text", { key: "cursor", color: displayColor, inverse: true }, cursorChar),
      after.length > 0
        ? React.createElement("tui-text", { key: "after", color: displayColor }, after)
        : null,
    );
  }

  return React.createElement(
    "tui-box",
    layoutProps,
    React.createElement("tui-text", { color: displayColor }, displayText),
  );
});
