/**
 * Storm Ops — Cost Panel.
 *
 * Token usage, cost tracking, and budget progress.
 */

import React from "react";
import {
  Box,
  Text,
  CostTracker,
  ContextWindow,
  GradientProgress,
} from "../../../src/index.js";

const S = {
  arc: "#82AAFF",
  text: "#C0CAF5",
  dim: "#565F89",
  success: "#9ECE6A",
  warning: "#E0AF68",
  error: "#F7768E",
  panelBorder: "#565F89",
};

export interface CostPanelProps {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  flex?: number;
}

export function CostPanel({ inputTokens, outputTokens, totalCost, flex }: CostPanelProps): React.ReactElement {
  const budget = 25.00;
  const budgetPct = Math.min(1, totalCost / budget);
  const contextUsed = inputTokens + outputTokens;
  const contextLimit = 128000;

  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Cost & Tokens"}</Text>
      </Box>
      <Box flex={1} overflow="hidden" paddingX={1}>
        <Box flexDirection="column" gap={1}>
        <CostTracker
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          compact={true}
        />

        <ContextWindow
          used={contextUsed}
          limit={contextLimit}
          compact={true}
          barWidth={20}
        />

        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={S.dim}>{"Budget:"}</Text>
            <Text color={budgetPct > 0.8 ? S.error : budgetPct > 0.5 ? S.warning : S.success}>
              {"$" + totalCost.toFixed(2) + " / $" + budget.toFixed(2)}
            </Text>
          </Box>
          <GradientProgress
            value={budgetPct}
            width={20}
            colors={[S.success, S.warning, S.error]}
            showPercentage={true}
          />
        </Box>
        </Box>
      </Box>
    </Box>
  );
}
