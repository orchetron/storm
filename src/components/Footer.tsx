/**
 * Footer — full-width footer bar with a top border.
 *
 * Renders a footer section with a thin border line above the content.
 *
 * Features:
 *   - bindings: render a KeyboardHelp-style binding bar as footer content
 *   - left/right: custom content on left and right sides
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { pickStyleProps } from "../styles/applyStyles.js";
import { DEFAULTS } from "../styles/defaults.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface FooterBinding {
  key: string;
  label: string;
}

export interface FooterProps extends StormLayoutStyleProps {
  children?: React.ReactNode;
  borderStyle?: "single" | "double" | "none";
  /** Override: must be numeric for border line repeat. */
  width?: number;
  /** Key bindings rendered as a KeyboardHelp-style bar. */
  bindings?: FooterBinding[];
  /** Left-aligned custom content. */
  left?: string | React.ReactNode;
  /** Right-aligned custom content. */
  right?: string | React.ReactNode;
  /** Custom render for footer content. */
  renderContent?: (children: React.ReactNode) => React.ReactNode;
}

const BORDER_CHARS: Record<"single" | "double", string> = {
  single: "\u2500", // ─
  double: "\u2501", // ━
};

const DEFAULT_WIDTH = 80;

function renderBindings(bindings: FooterBinding[]): React.ReactElement {
  const colors = useColors();
  const children: React.ReactElement[] = [];

  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]!;
    if (i > 0) {
      children.push(
        React.createElement(
          "tui-text",
          { key: `sep-${i}`, color: colors.text.dim },
          " \u00B7 ",
        ),
      );
    }
    children.push(
      React.createElement(
        "tui-text",
        { key: `key-${i}`, color: colors.brand.primary, bold: true },
        binding.key,
      ),
    );
    children.push(
      React.createElement(
        "tui-text",
        { key: `label-${i}`, color: colors.text.secondary },
        ` ${binding.label}`,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    ...children,
  );
}

export const Footer = React.memo(function Footer(rawProps: FooterProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Footer", rawProps as unknown as Record<string, unknown>) as unknown as FooterProps;
  const personality = usePersonality();
  const {
    children,
    borderStyle = DEFAULTS.footer.borderStyle,
    width,
    bindings,
    left,
    right,
  } = props;

  const layoutProps = pickStyleProps(props as unknown as Record<string, unknown>);

  const borderWidth = typeof width === "number" ? width : DEFAULT_WIDTH;

  const elements: React.ReactElement[] = [];

  if (borderStyle !== "none") {
    const borderChar = BORDER_CHARS[borderStyle] ?? BORDER_CHARS.single;
    const borderLine = borderChar.repeat(borderWidth);
    elements.push(
      React.createElement(
        "tui-text",
        { key: "__border-top", color: colors.text.dim },
        borderLine,
      ),
    );
  }

  // Determine content: bindings bar, left/right layout, or raw children
  const hasLeftRight = left !== undefined || right !== undefined;

  if (bindings !== undefined && bindings.length > 0) {
    // Render keybinding bar as the footer content
    const bindingsContent = renderBindings(bindings);

    if (hasLeftRight) {
      // Combine left, bindings, and right
      const rowChildren: React.ReactElement[] = [];
      if (left !== undefined) {
        rowChildren.push(
          typeof left === "string"
            ? React.createElement("tui-text", { key: "left", color: colors.text.secondary }, left)
            : React.createElement("tui-box", { key: "left" }, left),
        );
        rowChildren.push(React.createElement("tui-text", { key: "lsep" }, "  "));
      }
      rowChildren.push(React.createElement("tui-box", { key: "bindings" }, bindingsContent));
      if (right !== undefined) {
        rowChildren.push(React.createElement("tui-box", { key: "spacer", flex: 1 }));
        rowChildren.push(
          typeof right === "string"
            ? React.createElement("tui-text", { key: "right", color: colors.text.secondary }, right)
            : React.createElement("tui-box", { key: "right" }, right),
        );
      }
      elements.push(
        React.createElement("tui-box", { key: "__content", flexDirection: "row", paddingLeft: 1 }, ...rowChildren),
      );
    } else {
      elements.push(
        React.createElement("tui-box", { key: "__content", paddingLeft: 1 }, bindingsContent),
      );
    }
  } else if (hasLeftRight) {
    // left/right layout without bindings
    const rowChildren: React.ReactElement[] = [];
    if (left !== undefined) {
      rowChildren.push(
        typeof left === "string"
          ? React.createElement("tui-text", { key: "left", color: colors.text.secondary }, left)
          : React.createElement("tui-box", { key: "left" }, left),
      );
    }
    rowChildren.push(React.createElement("tui-box", { key: "spacer", flex: 1 }));
    if (right !== undefined) {
      rowChildren.push(
        typeof right === "string"
          ? React.createElement("tui-text", { key: "right", color: colors.text.secondary }, right)
          : React.createElement("tui-box", { key: "right" }, right),
      );
    }
    elements.push(
      React.createElement("tui-box", { key: "__content", flexDirection: "row", paddingLeft: 1 }, ...rowChildren),
    );
  } else if (props.renderContent) {
    elements.push(
      React.createElement(
        "tui-box",
        { key: "__content", paddingLeft: 1 },
        props.renderContent(children),
      ),
    );
  } else if (children !== undefined) {
    elements.push(
      React.createElement(
        "tui-box",
        { key: "__content", paddingLeft: 1 },
        children,
      ),
    );
  }

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    ...layoutProps,
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...elements,
  );
});
