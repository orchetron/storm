/**
 * Tag — colored label chip/tag.
 *
 * Renders a label in filled or outlined style. If onRemove is provided,
 * appends a dismiss indicator that triggers on 'x' or 'backspace' key.
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import { useInput } from "../hooks/useInput.js";
import type { KeyEvent } from "../input/types.js";
import type { StormTextStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface TagProps extends StormTextStyleProps {
  label: string;
  variant?: "filled" | "outlined";
  onRemove?: () => void;
  isFocused?: boolean;
  /** Custom render for the tag label. */
  renderLabel?: (label: string, variant: string) => React.ReactNode;
}

export const Tag = React.memo(function Tag(rawProps: TagProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Tag", rawProps as unknown as Record<string, unknown>) as unknown as TagProps;
  const {
    label,
    color = colors.brand.primary,
    bold: boldProp,
    dim,
    variant = "filled",
    onRemove,
    isFocused = false,
  } = props;

  useInput(
    (event: KeyEvent) => {
      if (onRemove && (event.key === "x" || event.key === "backspace")) {
        onRemove();
      }
    },
    { isActive: isFocused && onRemove !== undefined },
  );

  const displayText = variant === "outlined" ? `[${label}]` : ` ${label} `;

  const children: React.ReactElement[] = props.renderLabel
    ? [React.createElement(React.Fragment, { key: "label" }, props.renderLabel(label, variant))]
    : [
        variant === "filled"
          ? React.createElement(
              "tui-text",
              { key: "label", color: colors.surface.base, backgroundColor: color, ...(boldProp !== undefined ? { bold: boldProp } : {}), ...(dim !== undefined ? { dim } : {}) },
              displayText,
            )
          : React.createElement(
              "tui-text",
              { key: "label", color, ...(boldProp !== undefined ? { bold: boldProp } : {}), ...(dim !== undefined ? { dim } : {}) },
              displayText,
            ),
      ];

  if (onRemove) {
    children.push(
      React.createElement(
        "tui-text",
        { key: "remove", color: colors.text.dim },
        " \u00D7",
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    ...children,
  );
});
