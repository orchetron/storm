/**
 * Storm Code CLI — Input bar.
 *
 * Storm design:
 * - Top divider: thin `─` line full width, dimmed
 * - Input: `› ` prompt dim + ChatInput
 * - Bottom divider: thin `─` line full width, dimmed
 * - Footer: left "/ for commands", right "model · cost · ctx% · mode"
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
import { S } from "../data/theme.js";

export interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isStreaming: boolean;
  hasPendingApproval: boolean;
  model: string;
}

export function InputBar({
  value,
  onChange,
  onSubmit,
  isStreaming,
  hasPendingApproval,
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
  const divider = "─".repeat(Math.max(0, width));

  return (
    <Box flexDirection="column">
      {/* Top divider */}
      <Text color={S.dim}>{divider}</Text>

      {/* Input row — ChatInput always rendered (stable hook count) */}
      <Box flexDirection="row">
        {isStreaming ? (
          <>
            <Spinner type="dots" color={S.dim} interval={120} />
            <Text color={S.dim}>{" "}</Text>
          </>
        ) : (
          <Text color={S.dim}>{"› "}</Text>
        )}
        <ChatInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder={
            isStreaming ? "Storm is responding..."
            : hasPendingApproval ? "Waiting for approval..."
            : "Enter your message..."
          }
          placeholderColor={S.dim}
          focus={!isStreaming && !hasPendingApproval}
          flex={1}
          maxRows={4}
          color={S.text}
        />
      </Box>

      {/* Bottom divider */}
      <Text color={S.dim}>{divider}</Text>

      {/* Footer: left hints, right model/cost/context */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={S.dim}>{"/ for commands"}</Text>
        <Text color={S.dim}>
          {model}{" · $0.44 · 9.7% · auto"}
        </Text>
      </Box>
    </Box>
  );
}
