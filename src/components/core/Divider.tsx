import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface DividerProps {
  style?: "solid" | "dotted" | "dashed" | "line" | "storm";
  color?: string;
  width?: number;
  label?: string;
}

const LINE_CHARS: Record<string, string> = {
  solid: "\u2500",   // ─
  dotted: "\u254C",  // ╌
  dashed: "\u2504",  // ┄
  line: "\u2500",    // ─
  storm: "\u2501",   // ━
};

export const Divider = React.memo(function Divider(rawProps: DividerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Divider", rawProps);
  const { style = "solid", color = colors.divider, width = 200, label } = props;
  const char = LINE_CHARS[style] ?? LINE_CHARS["solid"]!;
  const dim = style !== "storm";

  if (!label) {
    return React.createElement(
      "tui-box",
      { height: 1, overflow: "hidden", flexShrink: 0 },
      React.createElement("tui-text", { color, dim, wrap: "truncate" }, char.repeat(width)),
    );
  }

  const pad = 3;
  const labelWidth = label.length + 2;
  const rightWidth = Math.max(0, width - pad - labelWidth);
  return React.createElement(
    "tui-box",
    { flexDirection: "row", width, height: 1, overflow: "hidden", flexShrink: 0 },
    React.createElement("tui-text", { key: "l", color, dim }, char.repeat(pad)),
    React.createElement("tui-text", { key: "t", color, bold: true }, ` ${label} `),
    React.createElement("tui-text", { key: "r", color, dim, wrap: "truncate" }, char.repeat(rightWidth)),
  );
});
