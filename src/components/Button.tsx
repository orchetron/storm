/**
 * Button — pressable button with label.
 *
 * Renders [ Label ] with styling based on focus/disabled state.
 * Enter/Space triggers onPress.
 */

import React, { useRef, useCallback } from "react";
import { useInput } from "../hooks/useInput.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { useTui } from "../context/TuiContext.js";
import type { KeyEvent } from "../input/types.js";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { useStyles } from "../core/style-provider.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends StormLayoutStyleProps {
  label: string;
  onPress?: () => void;
  isFocused?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Visual variant (default "primary") */
  variant?: ButtonVariant;
  /** Size: sm = [Label], md = [ Label ] (default), lg = [  Label  ] */
  size?: ButtonSize;
  /** Shortcut key label displayed next to the button label */
  shortcut?: string;
  /** Override the border style used around the button (from personality.borders.default). */
  borderStyle?: string;
  /** Override the focus indicator style (from personality.interaction.focusIndicator). */
  focusIndicator?: "border" | "highlight" | "arrow" | "bar";
  /** Custom render for the button label. */
  renderLabel?: (label: string, state: { isFocused: boolean; disabled: boolean; loading: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

export const Button = React.memo(function Button(rawProps: ButtonProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Button", rawProps as unknown as Record<string, unknown>) as unknown as ButtonProps;
  const personality = usePersonality();

  const {
    label,
    onPress,
    color: colorProp,
    bold: boldProp,
    dim: dimProp,
    width,
    height,
    margin,
    marginX,
    marginY,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    minWidth,
    maxWidth,
    isFocused = true,
    disabled = false,
    loading = false,
    variant = "primary",
    size = "md",
    shortcut,
    borderStyle: _borderStyle = personality.borders.default,
    focusIndicator: _focusIndicator = personality.interaction.focusIndicator,
    className,
    id,
  } = props;

  // Resolve stylesheet styles — pseudo-classes map component state
  const ssStates = new Set<string>();
  if (isFocused) ssStates.add("focused");
  if (disabled) ssStates.add("disabled");
  const ssStyles = useStyles("Button", className, id, ssStates);

  // Explicit color prop wins over stylesheet, then personality colors
  const color = colorProp ?? (ssStyles.color as string | undefined) ?? personality.colors.brand.primary;

  const { requestRender } = useTui();
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const spinnerFrameRef = useRef(0);
  const spinnerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop spinner timer based on loading state.
  // Always clear first when loading becomes false (or was true and changed)
  // to ensure no stale timers remain.
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

  // Clean up timer on unmount
  useCleanup(() => {
    if (spinnerTimerRef.current !== null) {
      clearInterval(spinnerTimerRef.current);
      spinnerTimerRef.current = null;
    }
  });

  const handleInput = useCallback((event: KeyEvent) => {
    if (disabledRef.current) return;
    if (loadingRef.current) return;
    const cb = onPressRef.current;
    if (!cb) return;
    if (event.key === "return" || event.char === " ") {
      cb();
    }
  }, []);

  const hasHandler = onPress !== undefined;
  useInput(handleInput, { isActive: hasHandler && isFocused && !disabled && !loading });

  // Determine styling based on variant
  let textProps: Record<string, unknown>;
  if (disabled || loading) {
    textProps = { color: colors.text.disabled, dim: true };
  } else if (variant === "primary") {
    textProps = isFocused
      ? { color, bold: true, inverse: true }
      : { dim: true };
  } else if (variant === "secondary") {
    textProps = isFocused
      ? { color, dim: true, bold: true }
      : { dim: true };
  } else if (variant === "outline") {
    textProps = isFocused
      ? { color, bold: true }
      : { dim: true };
  } else if (variant === "ghost") {
    textProps = isFocused
      ? { bold: true }
      : {};
  } else if (variant === "danger") {
    textProps = isFocused
      ? { color: "red", bold: true, inverse: true }
      : { color: "red", dim: true };
  } else {
    textProps = { dim: true };
  }

  const displayLabel = loading
    ? `${SPINNER_FRAMES[spinnerFrameRef.current]} ${label}`
    : label;

  // Merge stylesheet styles, then explicit prop overrides (explicit wins)
  if (ssStyles.bold !== undefined) textProps["bold"] = ssStyles.bold;
  if (ssStyles.dim !== undefined) textProps["dim"] = ssStyles.dim;
  if (ssStyles.inverse !== undefined) textProps["inverse"] = ssStyles.inverse;
  if (boldProp !== undefined) textProps["bold"] = boldProp;
  if (dimProp !== undefined) textProps["dim"] = dimProp;

  // Size padding
  const pad = size === "sm" ? "" : size === "lg" ? "  " : " ";

  // Build inner label text
  const shortcutSuffix = shortcut ? `  ${shortcut}` : "";
  let labelText: string;
  if (variant === "ghost") {
    labelText = `${pad}${displayLabel}${shortcutSuffix}${pad}`;
  } else {
    labelText = `[${pad}${displayLabel}${shortcutSuffix}${pad}]`;
  }

  const boxProps: Record<string, unknown> = {
    role: "button",
    flexDirection: "row",
    "aria-label": props["aria-label"],
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(margin !== undefined ? { margin } : {}),
    ...(marginX !== undefined ? { marginX } : {}),
    ...(marginY !== undefined ? { marginY } : {}),
    ...(marginTop !== undefined ? { marginTop } : {}),
    ...(marginBottom !== undefined ? { marginBottom } : {}),
    ...(marginLeft !== undefined ? { marginLeft } : {}),
    ...(marginRight !== undefined ? { marginRight } : {}),
    ...(minWidth !== undefined ? { minWidth } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
  };

  return React.createElement(
    "tui-box",
    boxProps,
    props.renderLabel
      ? props.renderLabel(label, { isFocused, disabled, loading })
      : React.createElement(
          "tui-text",
          textProps,
          labelText,
        ),
  );
});
