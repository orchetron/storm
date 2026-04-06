import React from "react";
import { useStyles } from "../../core/style-provider.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useTextInputBehavior } from "../../hooks/headless/useTextInputBehavior.js";

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

export const TextInput = React.memo(function TextInput(rawProps: TextInputProps): React.ReactElement {
  const props = usePluginProps("TextInput", rawProps);
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
    onSelectionChange,
    className,
    id,
    "aria-label": ariaLabel,
    ...layoutProps
  } = props;

  const focusProp = isFocused ?? focusPropRaw ?? autoFocus ?? true;

  const ssStates = new Set<string>();
  if (focusProp) ssStates.add("focused");
  if (disabled) ssStates.add("disabled");
  const ssStyles = useStyles("TextInput", className, id, ssStates);

  // Explicit color prop wins over stylesheet
  const color = colorProp ?? (ssStyles.color as string | number | undefined);

  const behavior = useTextInputBehavior({
    value,
    onChange,
    onSubmit,
    isFocused: focusProp,
    history,
    maxLength,
    disabled,
    onSelectionChange,
  });

  return React.createElement("tui-text-input", {
    role: "textbox",
    value,
    cursorOffset: behavior.cursorPosition,
    focus: behavior.isFocused,
    placeholder,
    color,
    placeholderColor,
    _hostPropsRef: behavior.hostPropsRef,
    _focusId: behavior.focusId,
    "aria-label": ariaLabel,
    ...(behavior.hasSelection ? { selectionStart: behavior.selectionStart, selectionEnd: behavior.selectionEnd, inverse: true } : {}),
    ...layoutProps,
    height: layoutProps.height ?? 1,
  });
});
