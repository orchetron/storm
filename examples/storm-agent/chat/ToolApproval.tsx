/**
 * Storm Agent CLI -- Tool approval dialog.
 *
 * Storm Agent design:
 * - Rounded border box with accent-colored border
 * - Bold colored header inside with tool name
 * - Numbered options (1, 2, 3) with `\u276F` selection indicator
 * - Keyboard: 1/2/3 or y/n/a
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useTui } from "../../../src/index.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#8C8CF9",
  text: "#DEE1E4",
  textSecondary: "#A5A8AB",
  textDisabled: "#46484A",
  success: "#64CF64",
  warning: "#FEE19C",
  error: "#F1689F",
};

// -- Rounded border characters ------------------------------------------------

const BORDER = {
  topLeft: "\u256D",
  topRight: "\u256E",
  bottomLeft: "\u2570",
  bottomRight: "\u256F",
  horizontal: "\u2500",
  vertical: "\u2502",
};

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
  const [selected, setSelected] = useState(0);

  const options = [
    { label: "Allow once", action: onApprove },
    { label: "Deny", action: onDeny },
    { label: "Always allow this tool", action: onAlwaysApprove },
  ];

  useInput(
    useCallback(
      (e) => {
        if (e.key === "1" || e.key === "y") {
          onApprove();
        } else if (e.key === "2" || e.key === "n") {
          onDeny();
        } else if (e.key === "3" || e.key === "a") {
          onAlwaysApprove();
        } else if (e.key === "up" || (e.key === "k" && !e.ctrl)) {
          flushSync(() => setSelected((s) => Math.max(0, s - 1)));
        } else if (e.key === "down" || (e.key === "j" && !e.ctrl)) {
          flushSync(() => setSelected((s) => Math.min(options.length - 1, s + 1)));
        } else if (e.key === "return") {
          options[selected]!.action();
        }
      },
      [onApprove, onDeny, onAlwaysApprove, selected, flushSync, options],
    ),
  );

  const params = Object.entries(toolParams)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");

  const riskColor =
    riskLevel === "high"
      ? THEME.error
      : riskLevel === "medium"
        ? THEME.warning
        : THEME.success;

  // Box width
  const innerWidth = 50;
  const hLine = BORDER.horizontal.repeat(innerWidth);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Top border */}
      <Text color={THEME.accent}>
        {BORDER.topLeft}{hLine}{BORDER.topRight}
      </Text>

      {/* Header */}
      <Box flexDirection="row">
        <Text color={THEME.accent}>{BORDER.vertical}{" "}</Text>
        <Text color={THEME.accent} bold>Tool: {toolName}</Text>
        <Text color={riskColor}>{" ["}{riskLevel}{"]"}</Text>
      </Box>

      {/* Params */}
      {params && (
        <Box flexDirection="row">
          <Text color={THEME.accent}>{BORDER.vertical}{" "}</Text>
          <Text color={THEME.textSecondary}>{params}</Text>
        </Box>
      )}

      {/* Blank line */}
      <Text color={THEME.accent}>{BORDER.vertical}</Text>

      {/* Options */}
      {options.map((opt, i) => (
        <Box key={i} flexDirection="row">
          <Text color={THEME.accent}>{BORDER.vertical}{" "}</Text>
          <Text color={i === selected ? THEME.accent : THEME.textDisabled}>
            {i === selected ? "\u276F " : "  "}
          </Text>
          <Text color={i === selected ? THEME.text : THEME.textSecondary}>
            {i + 1}. {opt.label}
          </Text>
        </Box>
      ))}

      {/* Bottom border */}
      <Text color={THEME.accent}>
        {BORDER.bottomLeft}{hLine}{BORDER.bottomRight}
      </Text>
    </Box>
  );
}
