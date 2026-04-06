import React from "react";
import { interpolateColor } from "../../utils/color.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";

export interface GradientBorderProps {
  children: React.ReactNode;
  /** Gradient from/to colors (default violet to mint) */
  colors?: [string, string];
  /** Box width in characters (default 40) */
  width?: number | string;
  /** Inner padding in spaces (default 1) */
  padding?: number;
}

export const GradientBorder = React.memo(function GradientBorder(rawProps: GradientBorderProps): React.ReactElement {
  const themeColors = useColors();
  const props = usePluginProps("GradientBorder", rawProps);
  const personality = usePersonality();
  const defaultColors: [string, string] = [themeColors.brand.primary, themeColors.brand.glow];
  const {
    children,
    colors: gradientColors = defaultColors,
    width: rawWidth = 40,
    padding = 1,
  } = props;

  // When rawWidth is a string (e.g. percentage like "50%"), we cannot compute
  // character-level border rendering, so parse numeric portion or fall back to 40.
  const totalWidth = typeof rawWidth === "number"
    ? rawWidth
    : (parseInt(rawWidth, 10) || 40);
  const innerWidth = Math.max(totalWidth - 2, 0); // subtract left+right border
  const [colorFrom, colorTo] = gradientColors;

  // Total border perimeter characters for interpolation
  // top: 1 + innerWidth + 1 = totalWidth
  // right side: height (unknown, use proportion)
  // We interpolate based on a single diagonal metric: position along the border path
  const totalChars = totalWidth + totalWidth; // approximate

  function colorAt(index: number): string {
    const t = totalChars <= 1 ? 0 : index / (totalChars - 1);
    return interpolateColor(colorFrom, colorTo, Math.min(t, 1));
  }

  // ── Top border row: ╭──...──╮ ──────────────────────────────────────
  const topElements: React.ReactElement[] = [];
  topElements.push(
    React.createElement("tui-text", { key: "tl", color: colorAt(0) }, "\u256D"),
  );
  for (let i = 0; i < innerWidth; i++) {
    topElements.push(
      React.createElement(
        "tui-text",
        { key: `t${i}`, color: colorAt(1 + i) },
        "\u2500",
      ),
    );
  }
  topElements.push(
    React.createElement(
      "tui-text",
      { key: "tr", color: colorAt(1 + innerWidth) },
      "\u256E",
    ),
  );

  const topRow = React.createElement(
    "tui-box",
    { key: "top", flexDirection: "row" },
    ...topElements,
  );

  // ── Content row: │ <pad> content <pad> │ ───────────────────────────
  const padStr = " ".repeat(padding);
  const midIndex = Math.floor(totalChars / 2);

  const contentRow = React.createElement(
    "tui-box",
    { key: "mid", flexDirection: "row" },
    React.createElement("tui-text", { key: "ml", color: colorAt(midIndex - 2) }, "\u2502"),
    React.createElement("tui-text", { key: "pl" }, padStr),
    React.createElement("tui-box", { key: "content", flex: 1 }, children),
    React.createElement("tui-text", { key: "pr" }, padStr),
    React.createElement("tui-text", { key: "mr", color: colorAt(midIndex + 2) }, "\u2502"),
  );

  // ── Bottom border row: ╰──...──╯ ──────────────────────────────────
  const botElements: React.ReactElement[] = [];
  const botStart = totalChars - totalWidth;
  botElements.push(
    React.createElement(
      "tui-text",
      { key: "bl", color: colorAt(botStart) },
      "\u2570",
    ),
  );
  for (let i = 0; i < innerWidth; i++) {
    botElements.push(
      React.createElement(
        "tui-text",
        { key: `b${i}`, color: colorAt(botStart + 1 + i) },
        "\u2500",
      ),
    );
  }
  botElements.push(
    React.createElement(
      "tui-text",
      { key: "br", color: colorAt(totalChars - 1) },
      "\u256F",
    ),
  );

  const botRow = React.createElement(
    "tui-box",
    { key: "bot", flexDirection: "row" },
    ...botElements,
  );

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    topRow,
    contentRow,
    botRow,
  );
});
