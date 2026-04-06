import React from "react";
import { fmtNum, fmtCost } from "../../utils/format.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";

export interface CostTrackerProps {
  inputTokens: number;
  outputTokens: number;
  /** Default: 3. */
  inputCostPer1M?: number;
  /** Default: 15. */
  outputCostPer1M?: number;
  /** Default: "$". */
  currency?: string;
  sessionTotal?: number;
  compact?: boolean;
  renderCost?: (cost: number, currency: string) => React.ReactNode;
}

function costColor(total: number, colors: StormColors): string {
  if (total >= 1) return colors.error;
  if (total >= 0.1) return colors.warning;
  return colors.success;
}

export const CostTracker = React.memo(function CostTracker(rawProps: CostTrackerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("CostTracker", rawProps);
  const {
    inputTokens,
    outputTokens,
    inputCostPer1M = 3,
    outputCostPer1M = 15,
    currency = "$",
    sessionTotal = 0,
    compact = false,
  } = props;

  const inputCost = (inputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * outputCostPer1M;
  const totalCost = inputCost + outputCost + sessionTotal;

  const clr = costColor(totalCost, colors);

  if (props.renderCost) {
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      props.renderCost(totalCost, currency),
    );
  }

  if (compact) {
    const detail = `(${fmtNum(inputTokens)} in \u00D7 ${currency}${inputCostPer1M}/M + ${fmtNum(outputTokens)} out \u00D7 ${currency}${outputCostPer1M}/M)`;

    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: clr, bold: true },
        fmtCost(totalCost, currency),
      ),
      React.createElement(
        "tui-text",
        { dim: true },
        ` ${detail}`,
      ),
    );
  }

  const rows: React.ReactElement[] = [];

  rows.push(
    React.createElement(
      "tui-box",
      { key: "header", flexDirection: "row" },
      React.createElement(
        "tui-text",
        { bold: true, color: clr },
        `Total: ${fmtCost(totalCost, currency)}`,
      ),
    ),
  );

  rows.push(
    React.createElement(
      "tui-box",
      { key: "input", flexDirection: "row" },
      React.createElement(
        "tui-text",
        { dim: true },
        `  Input:  ${fmtNum(inputTokens)} tokens \u00D7 ${currency}${inputCostPer1M}/M = ${fmtCost(inputCost, currency)}`,
      ),
    ),
  );

  rows.push(
    React.createElement(
      "tui-box",
      { key: "output", flexDirection: "row" },
      React.createElement(
        "tui-text",
        { dim: true },
        `  Output: ${fmtNum(outputTokens)} tokens \u00D7 ${currency}${outputCostPer1M}/M = ${fmtCost(outputCost, currency)}`,
      ),
    ),
  );

  if (sessionTotal > 0) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "session", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { dim: true },
          `  Prior:  ${fmtCost(sessionTotal, currency)}`,
        ),
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...rows,
  );
});
