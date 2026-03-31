/**
 * KeyboardHelp — horizontal keybinding help bar.
 *
 * Renders a row of key-label pairs separated by a configurable separator.
 * Keys are displayed bold in keyColor, labels in color.
 *
 * Supports a `context` header and multi-column layout.
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface KeyboardHelpProps extends StormLayoutStyleProps {
  bindings: Array<{ key: string; label: string }>;
  separator?: string;
  keyColor?: string | number;
  /** When provided, render as a header above the bindings: "[context mode]" */
  context?: string;
  /** Number of columns to arrange bindings in. 0 = auto (single row). */
  columns?: number;
  /** Custom render for each key binding. */
  renderBinding?: (key: string, label: string) => React.ReactNode;
}

export const KeyboardHelp = React.memo(function KeyboardHelp(rawProps: KeyboardHelpProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("KeyboardHelp", rawProps as unknown as Record<string, unknown>) as unknown as KeyboardHelpProps;
  const {
    bindings,
    separator = " \u00B7 ",
    color = colors.text.secondary,
    keyColor = colors.brand.primary,
    context,
    columns = 0,
  } = props;

  const layoutProps = pickStyleProps(props as unknown as Record<string, unknown>);

  /** Render a single binding (key + label). */
  function renderBinding(binding: { key: string; label: string }, idx: number, showSep: boolean): React.ReactElement[] {
    const parts: React.ReactElement[] = [];

    if (showSep) {
      parts.push(
        React.createElement(
          "tui-text",
          { key: `sep-${idx}`, color: colors.text.dim },
          separator,
        ),
      );
    }

    if (props.renderBinding) {
      parts.push(
        React.createElement(React.Fragment, { key: `bind-${idx}` }, props.renderBinding(binding.key, binding.label)),
      );
      return parts;
    }

    parts.push(
      React.createElement(
        "tui-text",
        { key: `key-${idx}`, color: keyColor, bold: true },
        binding.key,
      ),
    );
    parts.push(
      React.createElement(
        "tui-text",
        { key: `label-${idx}`, color },
        ` ${binding.label}`,
      ),
    );

    return parts;
  }

  // Context header
  const header = context
    ? React.createElement(
        "tui-text",
        { key: "__ctx", color: colors.text.secondary, bold: true, dim: true },
        `[${context} mode]`,
      )
    : null;

  // Multi-column layout
  if (columns > 0 && bindings.length > 0) {
    const rows: React.ReactElement[] = [];
    const perColumn = Math.ceil(bindings.length / columns);

    for (let row = 0; row < perColumn; row++) {
      const rowChildren: React.ReactElement[] = [];
      for (let col = 0; col < columns; col++) {
        const idx = col * perColumn + row;
        if (idx < bindings.length) {
          const binding = bindings[idx]!;
          const showSep = col > 0;
          rowChildren.push(...renderBinding(binding, idx, showSep));
        }
      }
      rows.push(
        React.createElement(
          "tui-box",
          { key: `row-${row}`, flexDirection: "row" },
          ...rowChildren,
        ),
      );
    }

    const containerChildren: React.ReactElement[] = [];
    if (header) containerChildren.push(header);
    containerChildren.push(...rows);

    return React.createElement(
      "tui-box",
      { flexDirection: "column", ...layoutProps },
      ...containerChildren,
    );
  }

  // Single row (default)
  const children: React.ReactElement[] = [];

  for (let i = 0; i < bindings.length; i++) {
    children.push(...renderBinding(bindings[i]!, i, i > 0));
  }

  if (header) {
    return React.createElement(
      "tui-box",
      { flexDirection: "column", ...layoutProps },
      header,
      React.createElement(
        "tui-box",
        { flexDirection: "row" },
        ...children,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row", ...layoutProps },
    ...children,
  );
});
