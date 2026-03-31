/**
 * Separator — horizontal section separator.
 *
 * Renders a line of repeated characters with optional centered label.
 * Width defaults to 200 and is clipped by the parent layout.
 */

import React from "react";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export interface SeparatorProps {
  label?: string;
  style?: "line" | "dashed" | "dotted" | "storm";
  color?: string | number;
  width?: number;
}

const STYLE_CHARS: Record<string, string> = {
  line: "\u2500",    // ─
  dashed: "\u2504",  // ┄
  dotted: "\u254C",  // ╌
  storm: "\u2501",   // ━
};

export const Separator = React.memo(function Separator(rawProps: SeparatorProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Separator", rawProps as unknown as Record<string, unknown>) as unknown as SeparatorProps;
  const {
    label,
    style = "line",
    color = colors.divider,
    width = 200,
  } = props;

  const char = STYLE_CHARS[style] ?? STYLE_CHARS["line"]!;
  const safeWidth = Math.max(0, Math.floor(width));

  if (!label) {
    return React.createElement(
      "tui-box",
      { height: 1, overflow: "hidden", flexShrink: 0 },
      React.createElement(
        "tui-text",
        { color, dim: style !== "storm", wrap: "truncate" },
        char.repeat(safeWidth),
      ),
    );
  }

  const pad = 3;
  const labelWidth = label.length + 2; // " label "
  const rightWidth = Math.max(0, safeWidth - pad - labelWidth);
  return React.createElement(
    "tui-box",
    { flexDirection: "row", width: safeWidth, height: 1, overflow: "hidden", flexShrink: 0 },
    React.createElement("tui-text", { key: "l", color, dim: style !== "storm" }, char.repeat(pad)),
    React.createElement("tui-text", { key: "t", color, bold: true }, ` ${label} `),
    React.createElement("tui-text", { key: "r", color, dim: style !== "storm", wrap: "truncate" }, char.repeat(rightWidth)),
  );
});
