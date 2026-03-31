/**
 * Storm Code CLI -- Input bar.
 *
 * Storm Code design:
 * - Just `❯ ` in muted gray + ChatInput, NO border, NO box, NO placeholder text
 * - Status bar at very bottom: model  $cost  N% ctx  Ctrl+C cancel (very dim)
 */

import React, { useCallback } from "react";
import {
  Box,
  Text,
  ChatInput,
  useTui,
} from "../../../src/index.js";

// -- Colors -------------------------------------------------------------------

const CC = {
  userChevron: "#666666",  // muted gray
  text: "#ffffff",
  textDisabled: "#555555",
};

export interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isStreaming: boolean;
  hasPendingApproval: boolean;
  model: string;
  cost: string;
  contextPercent: number;
}

export function InputBar({
  value,
  onChange,
  onSubmit,
  isStreaming,
  hasPendingApproval,
  model,
  cost,
  contextPercent,
}: InputBarProps): React.ReactElement {
  const { flushSync } = useTui();

  const handleChange = useCallback(
    (v: string) => {
      flushSync(() => onChange(v));
    },
    [flushSync, onChange],
  );

  const handleSubmit = useCallback(
    (v: string) => {
      if (!v.trim()) return;
      onSubmit(v.trim());
    },
    [onSubmit],
  );

  const isFocused = !isStreaming && !hasPendingApproval;

  return (
    <Box flexDirection="column">
      {/* Input row: ❯ prompt + input */}
      <Box flexDirection="row" height={1}>
        <Text color={CC.userChevron}>{"\u276F "}</Text>
        <ChatInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder=""
          placeholderColor={CC.textDisabled}
          focus={isFocused}
          flex={1}
          color={CC.text}
        />
      </Box>

      {/* Status bar: model  $cost  N% ctx  Ctrl+C cancel */}
      <Box flexDirection="row" height={1}>
        <Text dim>
          {model}{"  "}{cost}{"  "}{contextPercent}{"% ctx"}{"  Ctrl+C cancel"}
        </Text>
      </Box>
    </Box>
  );
}
