/**
 * Storm Ops — Governance Panel.
 *
 * Pending approvals, policy status, and governance alerts.
 */

import React from "react";
import {
  Box,
  Text,
  Badge,
  StatusMessage,
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

export interface GovernancePanelProps {
  pendingApprovals: number;
  policiesActive: number;
  policiesPassed: number;
  flex?: number;
}

export function GovernancePanel({ pendingApprovals, policiesActive, policiesPassed, flex }: GovernancePanelProps): React.ReactElement {
  const policiesFailed = policiesActive - policiesPassed;

  return (
    <Box
      flexDirection="column"
      flex={flex}
      borderStyle="round"
      borderColor={S.panelBorder}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text color={S.arc} bold>{"Governance"}</Text>
      </Box>
      <Box flex={1} overflow="hidden" paddingX={1}>
        <Box flexDirection="column" gap={1}>
        {/* Policy overview */}
        <Box flexDirection="row" gap={1}>
          <Text color={S.dim}>{"Policies:"}</Text>
          <Badge label={String(policiesPassed)} variant="success" mode="count" count={policiesPassed} />
          <Text color={S.dim}>{"passed"}</Text>
          {policiesFailed > 0 && (
            <>
              <Badge label={String(policiesFailed)} variant="error" mode="count" count={policiesFailed} />
              <Text color={S.dim}>{"failed"}</Text>
            </>
          )}
        </Box>

        {/* Pending approvals */}
        <Box flexDirection="row" gap={1}>
          <Text color={S.dim}>{"Pending:"}</Text>
          <Badge
            label={String(pendingApprovals)}
            variant={pendingApprovals > 0 ? "warning" : "success"}
            mode="count"
            count={pendingApprovals}
          />
        </Box>

        {/* Approval items */}
        {pendingApprovals > 0 && (
          <Box flexDirection="column">
            <StatusMessage
              type="warning"
              title="filesystem.write"
              message="Agent auth-refactor requests write to src/auth/"
            />
            {pendingApprovals > 1 && (
              <StatusMessage
                type="warning"
                title="network.fetch"
                message="Agent perf-optimization requests external API call"
              />
            )}
          </Box>
        )}

        {/* Auto-approved */}
        <StatusMessage
          type="success"
          title="filesystem.read"
          message="Auto-approved by policy (read-only, safe)"
        />
        </Box>
      </Box>
    </Box>
  );
}
