/**
 * Storm Ops — Resource Panel.
 *
 * CPU, Memory, GPU gauges with sparkline histories.
 */

import React from "react";
import {
  Box,
  Text,
  Gauge,
  Sparkline,
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

export interface ResourcePanelProps {
  cpu: number;
  memory: number;
  gpu: number;
  cpuHistory: number[];
  memHistory: number[];
  gpuHistory: number[];
  flex?: number;
}

function resourceColor(val: number): string {
  if (val > 80) return S.error;
  if (val > 60) return S.warning;
  return S.success;
}

export function ResourcePanel({ cpu, memory, gpu, cpuHistory, memHistory, gpuHistory, flex }: ResourcePanelProps): React.ReactElement {
  const memPct = (memory / 8) * 100;

  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"System Resources"}</Text>
      </Box>
      <Box flex={1} overflow="hidden" paddingX={1}>
        <Box flexDirection="column" gap={1}>
          {/* CPU */}
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text color={S.dim}>{"CPU"}</Text>
              <Text color={resourceColor(cpu)}>{cpu + "%"}</Text>
            </Box>
            <Gauge value={cpu / 100} width={20} color={resourceColor(cpu)} showValue={false} />
            <Sparkline data={cpuHistory} width={20} height={1} color={resourceColor(cpu)} />
          </Box>

          {/* Memory */}
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text color={S.dim}>{"MEM"}</Text>
              <Text color={resourceColor(memPct)}>{memory.toFixed(1) + " / 8 GB"}</Text>
            </Box>
            <Gauge value={memPct / 100} width={20} color={resourceColor(memPct)} showValue={false} />
            <Sparkline data={memHistory} width={20} height={1} color={resourceColor(memPct)} />
          </Box>

          {/* GPU */}
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text color={S.dim}>{"GPU"}</Text>
              <Text color={resourceColor(gpu)}>{gpu + "%"}</Text>
            </Box>
            <Gauge value={gpu / 100} width={20} color={resourceColor(gpu)} showValue={false} />
            <Sparkline data={gpuHistory} width={20} height={1} color={resourceColor(gpu)} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
