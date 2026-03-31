/**
 * Badge — colored status label with pill, dot, and count modes.
 *
 * Renders [label] with color determined by variant or explicit color prop.
 * Variants map to theme colors: success, warning, error, info, outline.
 *
 * Modes:
 *   - "label" (default): text label with variant styling
 *   - "dot": just a colored dot character, no text
 *   - "count": number badge with max overflow (e.g. "99+")
 */

import React from "react";
import type { StormTextStyleProps } from "../styles/styleProps.js";
import { useStyles } from "../core/style-provider.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export interface BadgeProps extends StormTextStyleProps {
  label: string;
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
  /** Display mode: label (text), dot (colored dot only), count (number with max). */
  mode?: "label" | "dot" | "count";
  /** The count value displayed in "count" mode. */
  count?: number;
  /** Maximum count before showing "N+" (default 99). Only used in "count" mode. */
  max?: number;
  /** Custom render for the badge content. */
  renderContent?: (label: string, variant: string, mode: string) => React.ReactNode;
}

export const Badge = React.memo(function Badge(rawProps: BadgeProps): React.ReactElement {
  const colors = useColors();
  const VARIANT_COLORS: Record<string, string> = {
    default: colors.brand.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    outline: colors.text.secondary,
  };
  const props = usePluginProps("Badge", rawProps as unknown as Record<string, unknown>) as unknown as BadgeProps;
  const {
    label,
    color: colorProp,
    bold: boldProp,
    dim,
    variant = "default",
    mode = "label",
    count,
    max = 99,
    className,
    id,
  } = props;

  // Resolve stylesheet styles
  const ssStyles = useStyles("Badge", className, id);

  // Explicit props win over stylesheet, stylesheet wins over variant defaults
  const resolvedColor = colorProp ?? (ssStyles.color as string | number | undefined) ?? VARIANT_COLORS[variant] ?? colors.brand.primary;
  const resolvedBold = boldProp !== undefined ? boldProp : (ssStyles.bold !== undefined ? ssStyles.bold : (variant !== "default" || colorProp !== undefined));

  // Custom render delegate
  if (props.renderContent) {
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      props.renderContent(label, variant, mode),
    );
  }

  // Dot mode — just a colored dot, no text
  if (mode === "dot") {
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: resolvedColor, bold: resolvedBold, ...(dim !== undefined ? { dim } : {}) },
        "\u25CF",
      ),
    );
  }

  // Count mode — show number with max overflow
  if (mode === "count") {
    const displayCount = count !== undefined ? count : 0;
    const countText = displayCount > max ? `${max}+` : `${displayCount}`;
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: resolvedColor, bold: true, ...(dim !== undefined ? { dim } : {}) },
        countText,
      ),
    );
  }

  // Label mode (default) — original behavior
  const isOutline = variant === "outline";
  const displayText = isOutline ? `[${label}]` : (variant !== "default" ? `\u25CF ${label}` : `(${label})`);
  const outlineDim = isOutline && dim === undefined ? true : undefined;

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement(
      "tui-text",
      {
        color: resolvedColor,
        bold: resolvedBold,
        ...(dim !== undefined ? { dim } : {}),
        ...(outlineDim !== undefined ? { dim: outlineDim } : {}),
      },
      displayText,
    ),
  );
});
