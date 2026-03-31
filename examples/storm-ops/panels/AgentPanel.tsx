/**
 * Storm Ops — Agent Panel.
 *
 * Displays active agents with their operation trees.
 * Each agent shows a name + status badge and an OperationTree
 * with nodes cycling through operation phases.
 */

import React from "react";
import {
  Box,
  Text,
  Badge,
  OperationTree,
  ScrollView,
  type OpNode,
} from "../../../src/index.js";

const S = {
  arc: "#82AAFF",
  text: "#C0CAF5",
  dim: "#565F89",
  success: "#9ECE6A",
  error: "#F7768E",
  warning: "#E0AF68",
  panelBorder: "#565F89",
};

export interface AgentPanelProps {
  agents: Array<{
    name: string;
    status: string;
    ops: OpNode[];
  }>;
  flex?: number;
}

export function AgentPanel({ agents, flex }: AgentPanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Active Agents"}</Text>
      </Box>
      <Box flex={1} overflow="hidden">
        <ScrollView flex={1}>
          <Box flexDirection="column" gap={1} paddingX={1}>
            {agents.map((agent) => (
              <Box key={agent.name} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Text color={S.text} bold>{agent.name}</Text>
                  <Badge
                    label={agent.status === "complete" ? "done" : "running"}
                    variant={agent.status === "complete" ? "success" : "info"}
                  />
                </Box>
                <OperationTree nodes={agent.ops} showDuration={true} />
              </Box>
            ))}
          </Box>
        </ScrollView>
      </Box>
    </Box>
  );
}
