import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { FOCUS_CHARS } from "../../utils/focus-chars.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface CheckboxProps extends StormLayoutStyleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Whether this checkbox captures keyboard input (default true). */
  isFocused?: boolean;
  /** When true, shows [-] indeterminate state instead of checked/unchecked. */
  indeterminate?: boolean;
  /** Description text rendered as dim text below the label. */
  description?: string;
  /** Custom render for the checkbox indicator. */
  renderIndicator?: (state: { checked: boolean; indeterminate: boolean; focused: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

export const Checkbox = React.memo(function Checkbox(rawProps: CheckboxProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Checkbox", rawProps);
  const personality = usePersonality();
  const {
    checked,
    onChange,
    label,
    color = colors.brand.primary,
    bold: boldProp,
    dim: dimProp,
    disabled = false,
    isFocused = true,
    indeterminate = false,
    description,
  } = props;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const checkedRef = useRef(checked);
  checkedRef.current = checked;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const handleInput = useCallback((event: KeyEvent) => {
    if (disabledRef.current) return;
    const cb = onChangeRef.current;
    if (!cb) return;
    // Checkbox toggles on Space only, not Enter
    if (event.char === " ") {
      cb(!checkedRef.current);
    }
  }, []);

  const hasHandler = onChange !== undefined;
  useInput(handleInput, { isActive: hasHandler && isFocused && !disabled });

  const checkMark = indeterminate ? "-" : checked ? "\u2713" : " "; // [-] or [✓] or [ ]
  const boxColor = disabled ? colors.text.disabled : color;

  // Top row: focus indicator + checkbox + label
  const rowChildren: React.ReactElement[] = [];

  // Focus indicator prefix — style from personality
  const focusChar = FOCUS_CHARS[personality.interaction.focusIndicator] ?? "> ";
  if (isFocused && !disabled) {
    rowChildren.push(
      React.createElement("tui-text", { key: "focus", bold: true }, focusChar),
    );
  } else {
    rowChildren.push(
      React.createElement("tui-text", { key: "focus" }, " ".repeat(focusChar.length)),
    );
  }

  if (props.renderIndicator) {
    rowChildren.push(
      React.createElement(React.Fragment, { key: "box" }, props.renderIndicator({ checked, indeterminate, focused: isFocused && !disabled })),
    );
  } else {
    rowChildren.push(
      React.createElement(
        "tui-text",
        { key: "box", color: boxColor, ...(boldProp !== undefined ? { bold: boldProp } : {}), ...(dimProp !== undefined ? { dim: dimProp } : {}) },
        `[${checkMark}]`,
      ),
    );
  }

  if (label !== undefined) {
    const labelProps: Record<string, unknown> = { key: "label" };
    if (disabled) labelProps["dim"] = true;
    rowChildren.push(
      React.createElement("tui-text", labelProps, ` ${label}`),
    );
  }

  const outerBoxProps: Record<string, unknown> = {
    role: "checkbox",
    flexDirection: "column",
    "aria-label": props["aria-label"],
    ...pickLayoutProps(props),
  };

  const outerChildren: React.ReactElement[] = [];

  outerChildren.push(
    React.createElement("tui-box", { key: "row", flexDirection: "row" }, ...rowChildren),
  );

  if (description !== undefined) {
    outerChildren.push(
      React.createElement("tui-text", { key: "desc", dim: true, color: colors.text.dim }, `     ${description}`),
    );
  }

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...outerChildren,
  );
});
