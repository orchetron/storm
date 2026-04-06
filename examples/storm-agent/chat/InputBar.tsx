/**
 * Storm Agent CLI -- Input bar.
 *
 * Storm Agent design:
 * - Top divider: thin `\u2500` line full width, dimmed
 * - Input: `> ` prompt + ChatInput (no border, no box)
 * - Bottom divider: thin `\u2500` line full width, dimmed
 * - Footer: left "Press / for commands", right "Agent: name \u00B7 model"
 */

import React, { useCallback } from "react";
import {
  Box,
  Text,
  ChatInput,
  Spinner,
  useTerminal,
  useTui,
} from "../../../src/index.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#82AAFF",
  text: "#DEE1E4",
  textSecondary: "#A5A8AB",
  textDisabled: "#46484A",
};

export interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isStreaming: boolean;
  hasPendingApproval: boolean;
  agentName: string;
  model: string;
}

export function InputBar({
  value,
  onChange,
  onSubmit,
  isStreaming,
  hasPendingApproval,
  agentName,
  model,
}: InputBarProps): React.ReactElement {
  const { width } = useTerminal();
  const { flushSync } = useTui();

  const handleChange = useCallback(
    (v: string) => {
      onChange(v);
    },
    [onChange],
  );

  const handleSubmit = useCallback(
    (v: string) => {
      if (!v.trim()) return;
      onSubmit(v.trim());
    },
    [onSubmit],
  );

  const isFocused = !isStreaming && !hasPendingApproval;
  const divider = "\u2500".repeat(Math.max(0, width));

  return (
    <Box flexDirection="column">
      {/* Top divider */}
      <Text color={THEME.textDisabled}>{divider}</Text>

      {/* Input row */}
      <Box flexDirection="row">
        {isStreaming ? (
          <>
            <Spinner type="flywheel" color={THEME.textDisabled} />
            <Text color={THEME.textDisabled}>{" "}</Text>
          </>
        ) : (
          <Text color={THEME.text}>{"> "}</Text>
        )}
        <ChatInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder={
            isStreaming
              ? "Agent is responding..."
              : hasPendingApproval
                ? "Waiting for approval..."
                : "Enter your message..."
          }
          placeholderColor={THEME.textDisabled}
          focus={isFocused}
          flex={1}
          color={THEME.text}
        />
      </Box>

      {/* Bottom divider */}
      <Text color={THEME.textDisabled}>{divider}</Text>

      {/* Footer: left hints, right agent/model info */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={THEME.textDisabled}>{"Press / for commands"}</Text>
        <Text color={THEME.textDisabled}>
          {"Agent: "}{agentName}{" \u00B7 "}{model}
        </Text>
      </Box>
    </Box>
  );
}
