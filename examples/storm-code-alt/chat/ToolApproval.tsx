/**
 * Storm Code CLI -- Tool approval prompt.
 *
 * Simple one-line inline prompt:
 *   Allow Edit src/auth/rateLimit.ts? (y/n)
 */

import React, { useCallback } from "react";
import { Box, Text, useInput, useTui } from "../../../src/index.js";

export interface ToolApprovalProps {
  toolName: string;
  toolArgs: string;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysApprove: () => void;
}

export function ToolApproval({
  toolName,
  toolArgs,
  onApprove,
  onDeny,
  onAlwaysApprove,
}: ToolApprovalProps): React.ReactElement {
  const { flushSync } = useTui();

  useInput(
    useCallback(
      (e) => {
        if (e.key === "y" || e.key === "return") {
          onApprove();
        } else if (e.key === "n") {
          onDeny();
        } else if (e.key === "a") {
          onAlwaysApprove();
        }
      },
      [onApprove, onDeny, onAlwaysApprove],
    ),
  );

  return (
    <Box paddingLeft={2} marginBottom={1}>
      <Box flexDirection="row">
        <Text dim>{"Allow "}</Text>
        <Text bold>{toolName}{toolArgs ? " " + toolArgs : ""}</Text>
        <Text dim>{"? (y/n) "}</Text>
      </Box>
    </Box>
  );
}
