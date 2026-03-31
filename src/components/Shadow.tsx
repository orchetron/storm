/**
 * Shadow — drop shadow wrapper.
 *
 * Adds a fake drop shadow to any content, creating visual depth.
 * Renders children in a box, then adds shadow characters on the right
 * edge and bottom edge using dim styling.
 *
 * Features:
 *   - contentWidth: explicit width for bottom shadow that matches content
 *   - Falls back to generic `width` when contentWidth is not provided
 *
 * @module
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ShadowProps {
  children: React.ReactNode;
  /** Shadow offset — number of characters for shadow thickness (default 1) */
  offset?: number;
  /** Shadow character (default "░") */
  char?: string;
  /** Shadow color (default very dim) */
  color?: string | number;
  /** Direction */
  direction?: "bottom-right" | "bottom" | "right";
  /** Width of the bottom shadow row in characters (default 20) */
  width?: number;
  /**
   * Explicit content width for the bottom shadow.
   * When provided, overrides `width` for a more accurate shadow sizing
   * that matches the actual content width.
   */
  contentWidth?: number;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_SHADOW_CHAR = "\u2591"; // ░

// ── Component ────────────────────────────────────────────────────────

export const Shadow = React.memo(function Shadow(rawProps: ShadowProps): React.ReactElement {
  const themeColors = useColors();
  const props = usePluginProps("Shadow", rawProps as unknown as Record<string, unknown>) as unknown as ShadowProps;
  const {
    children,
    offset = 1,
    char = DEFAULT_SHADOW_CHAR,
    color = themeColors.surface.base,
    direction = "bottom-right",
    width = 20,
    contentWidth,
  } = props;

  // contentWidth overrides width for the bottom shadow
  const bottomWidth = contentWidth ?? width;

  const showRight = direction === "bottom-right" || direction === "right";
  const showBottom = direction === "bottom-right" || direction === "bottom";

  const shadowChar = char.repeat(offset);

  // Build the content row: children + optional right shadow column
  const contentRowChildren: React.ReactElement[] = [];

  contentRowChildren.push(
    React.createElement(
      "tui-box",
      { key: "content" },
      children,
    ),
  );

  if (showRight) {
    contentRowChildren.push(
      React.createElement(
        "tui-text",
        { key: "shadow-right", color, dim: true },
        shadowChar,
      ),
    );
  }

  const contentRow = React.createElement(
    "tui-box",
    { key: "row", flexDirection: "row" },
    ...contentRowChildren,
  );

  const elements: React.ReactElement[] = [contentRow];

  // Bottom shadow row
  if (showBottom) {
    const bottomShadowChildren: React.ReactElement[] = [];

    // If showing right shadow too, we need an offset spacer at the start
    // to align the bottom shadow under the content (not under the right shadow)
    if (showRight) {
      bottomShadowChildren.push(
        React.createElement(
          "tui-text",
          { key: "spacer" },
          " ".repeat(offset),
        ),
      );
    }

    bottomShadowChildren.push(
      React.createElement(
        "tui-text",
        { key: "shadow-bottom", color, dim: true },
        char.repeat(bottomWidth),
      ),
    );

    elements.push(
      React.createElement(
        "tui-box",
        { key: "bottom-row", flexDirection: "row" },
        ...bottomShadowChildren,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...elements,
  );
});
