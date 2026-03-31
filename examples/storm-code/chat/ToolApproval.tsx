/**
 * Storm Code CLI — Inline tool approval prompt.
 *
 * Storm design:
 *   Allow edit_file src/auth/session.ts?
 *   [y] yes  [n] no  [a] always
 */

import React, { useCallback } from "react";
import { Box, Text, useInput, useTui } from "../../../src/index.js";
import { S } from "../data/theme.js";

export interface ToolApprovalProps {
  toolName: string;
  toolParams: Record<string, unknown>;
  riskLevel: string;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysApprove: () => void;
}

export function ToolApproval({
  toolName,
  toolParams,
  riskLevel,
  onApprove,
  onDeny,
  onAlwaysApprove,
}: ToolApprovalProps): React.ReactElement {
  const { flushSync } = useTui();

  const riskColor =
    riskLevel === "high"
      ? S.error
      : riskLevel === "medium"
        ? S.warning
        : S.success;

  // Build a clean summary based on tool type
  let toolVerb: string;
  let toolTarget: string;
  let detailLines: string[] = [];

  switch (toolName) {
    case "read_file":
      toolVerb = "Read";
      toolTarget = String(toolParams.path ?? "file");
      break;
    case "edit_file": {
      toolVerb = "Edit";
      toolTarget = String(toolParams.path ?? "file");
      // Show compact diff preview (first 3 changed lines)
      const diff = String(toolParams.diff ?? toolParams.content ?? "");
      if (diff) {
        detailLines = diff
          .split("\n")
          .filter((l) => l.startsWith("+") || l.startsWith("-"))
          .slice(0, 3);
      }
      break;
    }
    case "bash":
      toolVerb = "Run";
      toolTarget = String(toolParams.command ?? "command");
      break;
    case "search_files":
      toolVerb = "Search";
      toolTarget = `"${toolParams.pattern ?? "..."}" in ${toolParams.path ?? "src/"}`;
      break;
    default: {
      toolVerb = toolName;
      const summary = toolParams.path ?? toolParams.command ?? toolParams.pattern ?? "";
      toolTarget = summary ? String(summary) : "";
      break;
    }
  }

  useInput(
    useCallback(
      (e) => {
        if (e.key === "y" || e.key === "1") {
          onApprove();
        } else if (e.key === "n" || e.key === "2") {
          onDeny();
        } else if (e.key === "a" || e.key === "3") {
          onAlwaysApprove();
        }
      },
      [onApprove, onDeny, onAlwaysApprove],
    ),
  );

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      {/* Prompt line */}
      <Box flexDirection="row">
        <Text color={S.text}>{"Allow "}</Text>
        <Text color={S.arc} bold>{toolVerb}</Text>
        {toolTarget ? <Text color={S.text}>{" "}{toolTarget}</Text> : null}
        <Text color={riskColor}>{" ["}{riskLevel}{"]"}</Text>
        <Text color={S.text}>{"?"}</Text>
      </Box>
      {/* Diff preview for edit_file */}
      {detailLines.length > 0 ? (
        <Box flexDirection="column" paddingLeft={2}>
          {detailLines.map((line, i) => (
            <Text
              key={i}
              color={line.startsWith("+") ? S.success : S.error}
            >
              {line}
            </Text>
          ))}
        </Box>
      ) : null}
      {/* Options line */}
      <Box flexDirection="row">
        <Text color={S.success} bold>{"[y]"}</Text>
        <Text color={S.dim}>{" yes  "}</Text>
        <Text color={S.error} bold>{"[n]"}</Text>
        <Text color={S.dim}>{" no  "}</Text>
        <Text color={S.arc} bold>{"[a]"}</Text>
        <Text color={S.dim}>{" always"}</Text>
      </Box>
    </Box>
  );
}
