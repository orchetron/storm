/**
 * Storm Ops — Metrics Panel.
 *
 * Latency sparklines (p50/p99) and a LineChart trend.
 */

import React from "react";
import {
  Box,
  Text,
  Sparkline,
  LineChart,
} from "../../../src/index.js";

const S = {
  arc: "#82AAFF",
  text: "#C0CAF5",
  dim: "#565F89",
  success: "#9ECE6A",
  warning: "#E0AF68",
  panelBorder: "#565F89",
};

export interface MetricsPanelProps {
  p50History: number[];
  p99History: number[];
  latencyTrend: number[];
  flex?: number;
}

export function MetricsPanel({ p50History, p99History, latencyTrend, flex }: MetricsPanelProps): React.ReactElement {
  const p50 = p50History[p50History.length - 1] ?? 0;
  const p99 = p99History[p99History.length - 1] ?? 0;

  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Latency Metrics"}</Text>
      </Box>
      <Box flex={1} overflow="hidden" paddingX={1}>
        <Box flexDirection="column">
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <Text color={S.dim}>{"p50:"}</Text>
                <Text color={S.success}>{p50 + "ms"}</Text>
              </Box>
              <Sparkline data={p50History} width={20} height={1} color={S.success} label="p50" />
            </Box>
            <Box flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <Text color={S.dim}>{"p99:"}</Text>
                <Text color={S.warning}>{p99 + "ms"}</Text>
              </Box>
              <Sparkline data={p99History} width={20} height={1} color={S.warning} label="p99" />
            </Box>
          </Box>
          <LineChart
            series={[
              { data: latencyTrend, color: S.arc, name: "latency" },
            ]}
            width={30}
            height={6}
            showAxes={true}
            showLegend={false}
          />
        </Box>
      </Box>
    </Box>
  );
}
