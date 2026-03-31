/**
 * Divider — a horizontal line that fills available width.
 *
 * Simple: renders a line of repeated characters.
 * Width comes from the parent's layout (no overflow tricks).
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface DividerProps {
  style?: "solid" | "dotted" | "dashed";
  color?: string;
  width?: number;
}

const LINE_CHARS: Record<string, string> = {
  solid: "\u2500",   // ─
  dotted: "\u254C",  // ╌
  dashed: "\u2504",  // ┄
};

export const Divider = React.memo(function Divider(rawProps: DividerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Divider", rawProps as unknown as Record<string, unknown>) as unknown as DividerProps;
  const { style = "solid", color = colors.divider, width = 200 } = props;
  const char = LINE_CHARS[style] ?? LINE_CHARS["solid"]!;

  return React.createElement(
    "tui-box",
    { height: 1, overflow: "hidden", flexShrink: 0 },
    React.createElement(
      "tui-text",
      { color, dim: true, wrap: "truncate" },
      char.repeat(width),
    ),
  );
});
