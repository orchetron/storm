import React from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface HeadingProps extends StormLayoutStyleProps {
  children: string;
  level?: 1 | 2 | 3 | 4;
}

export const Heading = React.memo(function Heading(rawProps: HeadingProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Heading", rawProps);
  const personality = usePersonality();
  const { children, level = 2, color: colorOverride, bold: boldOverride, dim: dimOverride, ...layoutProps } = props;

  const configs = {
    1: { color: personality.typography.headingColor, bold: personality.typography.headingBold, dim: false, transform: (s: string) => s.toUpperCase(), marginBottom: 1, decoration: true },
    2: { color: colors.text.primary, bold: personality.typography.headingBold, dim: false, transform: (s: string) => s, marginBottom: 1, decoration: false },
    3: { color: colors.text.secondary, bold: personality.typography.headingBold, dim: false, transform: (s: string) => s, marginBottom: 0, decoration: false },
    4: { color: colors.text.secondary, bold: false, dim: true, transform: (s: string) => s, marginBottom: 0, decoration: false },
  };

  const cfg = configs[level];
  const text = cfg.transform(children);
  const elements: React.ReactElement[] = [];

  elements.push(
    React.createElement("tui-text", {
      key: "t",
      color: colorOverride ?? cfg.color,
      bold: boldOverride ?? cfg.bold,
      ...(cfg.dim || dimOverride ? { dim: true } : {}),
    }, text),
  );

  // H1 gets an underline decoration
  if (cfg.decoration) {
    elements.push(
      React.createElement("tui-text", {
        key: "d",
        color: colors.text.dim,
        dim: true,
        wrap: "truncate",
      }, "\u2500".repeat(200)),
    );
  }

  const outerProps: Record<string, unknown> = {
    flexDirection: "column",
    ...(cfg.marginBottom ? { marginBottom: cfg.marginBottom } : {}),
  };
  for (const key of ["width", "height", "margin", "marginX", "marginY", "marginTop", "marginBottom", "marginLeft", "marginRight", "minWidth", "maxWidth"] as const) {
    const val = (layoutProps as Record<string, unknown>)[key];
    if (val !== undefined) outerProps[key] = val;
  }

  return React.createElement("tui-box", outerProps, ...elements);
});
