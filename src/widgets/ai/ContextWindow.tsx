import React from "react";
import { fmtNum } from "../../utils/format.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import { miniSparkline, SPARK_CHARS } from "../../utils/sparkline.js";

export interface ContextWindowProps {
  used: number;
  limit: number;
  breakdown?: Array<{ label: string; tokens: number; color?: string }>;
  compact?: boolean;
  /** Default: 24. */
  barWidth?: number;
  history?: number[];
  renderBar?: (used: number, limit: number) => React.ReactNode;
  /** Default: block elements ▁▂▃▄▅▆▇█. */
  sparklineChars?: string[];
}

export const ContextWindow = React.memo(function ContextWindow(rawProps: ContextWindowProps): React.ReactElement {
  const colors = useColors();
  const SEGMENT_COLORS = [
    colors.brand.primary,   // amber
    colors.success,         // sage
    colors.info,            // sage
    colors.warning,         // amber
    colors.error,           // red
    colors.brand.light,     // warm gold
    colors.text.secondary,  // zinc-400
  ];
  const props = usePluginProps("ContextWindow", rawProps);
  const { used, limit, breakdown, compact, barWidth: BAR_WIDTH = 24, history, sparklineChars } = props;
  const effectiveSparkChars = sparklineChars ?? SPARK_CHARS;

  if (props.renderBar) {
    return React.createElement(
      "tui-box",
      { flexDirection: "column" },
      props.renderBar(used, limit),
    );
  }

  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const pct = Math.round(ratio * 100);

  const usageColor = ratio > 0.9 ? colors.error : ratio > 0.7 ? colors.warning : colors.success;

  const barParts: React.ReactElement[] = [];

  if (breakdown && breakdown.length > 0) {
    const segCharWidths: number[] = [];
    let charsSoFar = 0;
    for (let i = 0; i < breakdown.length; i++) {
      const seg = breakdown[i]!;
      const segRatio = limit > 0 ? seg.tokens / limit : 0;
      const segChars = Math.max(segRatio > 0 ? 1 : 0, Math.round(segRatio * BAR_WIDTH));
      segCharWidths.push(segChars);
      charsSoFar += segChars;
    }

    // If rounding caused overflow, reduce the last segment to compensate
    if (charsSoFar > BAR_WIDTH && segCharWidths.length > 0) {
      const overflow = charsSoFar - BAR_WIDTH;
      const lastIdx = segCharWidths.length - 1;
      segCharWidths[lastIdx] = Math.max(0, segCharWidths[lastIdx]! - overflow);
      charsSoFar = BAR_WIDTH;
    }

    for (let i = 0; i < breakdown.length; i++) {
      const seg = breakdown[i]!;
      const segChars = segCharWidths[i]!;
      const segColor = seg.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
      barParts.push(
        React.createElement(
          "tui-text",
          { key: `seg-${i}`, color: segColor },
          "\u2588".repeat(segChars),
        ),
      );
    }

    // Fill remaining with empty
    const remaining = Math.max(0, BAR_WIDTH - charsSoFar);
    if (remaining > 0) {
      barParts.push(
        React.createElement(
          "tui-text",
          { key: "empty", color: colors.text.disabled },
          "\u2591".repeat(remaining),
        ),
      );
    }
  } else {
    // Simple filled/empty bar
    const filled = Math.round(ratio * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    barParts.push(
      React.createElement(
        "tui-text",
        { key: "filled", color: usageColor },
        "\u2588".repeat(filled),
      ),
    );
    if (empty > 0) {
      barParts.push(
        React.createElement(
          "tui-text",
          { key: "empty", color: colors.text.disabled },
          "\u2591".repeat(empty),
        ),
      );
    }
  }

  // Tokens remaining
  const remaining = Math.max(0, limit - used);

  // Summary text with remaining tokens
  const summaryEl = React.createElement(
    "tui-text",
    { key: "summary", dim: true },
    ` ${fmtNum(used)}/${fmtNum(limit)} (${pct}%) \u00B7 ${fmtNum(remaining)} remaining`,
  );

  // Bar row
  const barRow = React.createElement(
    "tui-box",
    { key: "bar-row", flexDirection: "row" },
    ...barParts,
    summaryEl,
  );

  // Optional sparkline row for history data
  const sparklineRow = history && history.length > 0
    ? React.createElement(
        "tui-box",
        { key: "sparkline-row", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { color: colors.text.dim, dim: true },
          miniSparkline(history, effectiveSparkChars),
        ),
        React.createElement(
          "tui-text",
          { dim: true },
          " history",
        ),
      )
    : null;

  if (compact || !breakdown || breakdown.length === 0) {
    if (sparklineRow) {
      return React.createElement(
        "tui-box",
        { flexDirection: "column" },
        barRow,
        sparklineRow,
      );
    }
    return barRow;
  }

  // Expanded: bar row + breakdown list
  const legendItems: React.ReactElement[] = breakdown.map((seg, i) => {
    const segColor = seg.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length]!;
    return React.createElement(
      "tui-box",
      { key: `legend-${i}`, flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: segColor },
        "\u25A0 ",
      ),
      React.createElement(
        "tui-text",
        { dim: true },
        `${seg.label}: ${fmtNum(seg.tokens)}`,
      ),
    );
  });

  const allChildren = [barRow, ...legendItems];
  if (sparklineRow) allChildren.push(sparklineRow);

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...allChildren,
  );
});
