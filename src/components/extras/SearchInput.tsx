import React, { useRef, useCallback } from "react";
import { useColors } from "../../hooks/useColors.js";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { TextInput } from "../core/TextInput.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

const SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

export interface SearchInputProps extends StormLayoutStyleProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** Called when Escape is pressed to clear the input */
  onClear?: () => void;
  placeholder?: string;
  /** @deprecated Use isFocused instead */
  focus?: boolean;
  /** Whether the input is focused. */
  isFocused?: boolean;
  /** Shows a spinner indicator when true */
  loading?: boolean;
  /** Debounce delay in ms before calling onChange. 0 = immediate (default). */
  debounceMs?: number;
  /** Shows result count next to the input. Number or "N of M" string. */
  resultCount?: number | string;
  /** Custom render for the search icon area. */
  renderIcon?: (state: { loading: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

export const SearchInput = React.memo(function SearchInput(rawProps: SearchInputProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("SearchInput", rawProps);
  const {
    value,
    onChange,
    onSubmit,
    onClear,
    placeholder = "Search...",
    color,
    focus: focusPropRaw,
    isFocused,
    loading = false,
    debounceMs = 0,
    resultCount,
  } = props;

  const focus = isFocused ?? focusPropRaw ?? true;

  const { requestRender } = useTui();

  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceMsRef = useRef(debounceMs);
  debounceMsRef.current = debounceMs;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced onChange wrapper
  const debouncedOnChange = useCallback((newValue: string) => {
    const delay = debounceMsRef.current;
    if (delay <= 0) {
      onChangeRef.current(newValue);
      return;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      onChangeRef.current(newValue);
    }, delay);
  }, []);

  // Spinner animation timer
  const spinnerFrameRef = useRef(0);
  const spinnerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!loading && spinnerTimerRef.current !== null) {
    clearInterval(spinnerTimerRef.current);
    spinnerTimerRef.current = null;
    spinnerFrameRef.current = 0;
  } else if (loading && spinnerTimerRef.current === null) {
    spinnerTimerRef.current = setInterval(() => {
      spinnerFrameRef.current = (spinnerFrameRef.current + 1) % SPINNER_FRAMES.length;
      requestRender();
    }, 80);
  }

  useCleanup(() => {
    if (spinnerTimerRef.current !== null) {
      clearInterval(spinnerTimerRef.current);
      spinnerTimerRef.current = null;
    }
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  });

  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape") {
      onChangeRef.current("");
      onClearRef.current?.();
    }
  }, []);

  useInput(handleInput, { isActive: focus });

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "row",
    role: "search",
    "aria-label": props["aria-label"],
    ...pickLayoutProps(props),
  };

  const iconText = loading
    ? SPINNER_FRAMES[spinnerFrameRef.current % SPINNER_FRAMES.length] + " "
    : "\uD83D\uDD0D ";

  const children: React.ReactElement[] = [];

  if (props.renderIcon) {
    children.push(
      React.createElement(React.Fragment, { key: "icon" }, props.renderIcon({ loading })),
    );
  } else {
    children.push(
      React.createElement(
        "tui-text",
        { key: "icon", color: colors.text.dim },
        iconText,
      ),
    );
  }

  children.push(
    React.createElement(TextInput, {
      key: "input",
      value,
      onChange: debouncedOnChange,
      ...(onSubmit ? { onSubmit } : {}),
      placeholder,
      ...(color !== undefined ? { color } : {}),
      focus,
      flex: 1,
    }),
  );

  // Show dim "x" clear indicator when there is content
  if (value.length > 0) {
    children.push(
      React.createElement(
        "tui-text",
        { key: "clear", color: colors.text.dim, dim: true },
        " \u00D7",
      ),
    );
  }

  // Show result count
  if (resultCount !== undefined) {
    const countText = typeof resultCount === "number"
      ? ` ${resultCount} result${resultCount !== 1 ? "s" : ""}`
      : ` ${resultCount}`;
    children.push(
      React.createElement(
        "tui-text",
        { key: "count", color: colors.text.dim, dim: true },
        countText,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...children,
  );
});
