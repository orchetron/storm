/**
 * Storm Agent CLI -- Message list renderer.
 *
 * Storm Agent visual design:
 * - 2-char left gutter pattern: [gutter 2 chars][space][content]
 * - User: full-width background (#2d2d2d), `> ` prefix
 * - Assistant: `\u25CF ` (filled circle) in accent for first line, `  ` for continuation
 * - Thinking: `\u2042 ` (asterism) dimmed header, dimmed content
 * - Tool calls: blinking dot gutter, tool name bold + args
 * - System: dim `\u25CF ` gutter
 * - Errors: `\u26A0 ` in warning color
 */

import React from "react";
import {
  Box,
  Text,
  BlinkDot,
  Markdown,
} from "../../../src/index.js";
import type { Message } from "../data/types.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#82AAFF",
  accentLight: "#BEBEEE",
  text: "#DEE1E4",
  textSecondary: "#A5A8AB",
  textDisabled: "#46484A",
  success: "#64CF64",
  warning: "#FEE19C",
  error: "#F1689F",
  userMsgBg: "#2d2d2d",
};

// -- Per-Type Renderers -------------------------------------------------------

function UserMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row" backgroundColor={THEME.userMsgBg}>
      <Text color={THEME.text}>{"> "}</Text>
      <Box flexShrink={1}>
        <Text color={THEME.text}>{msg.content}</Text>
      </Box>
    </Box>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row" overflow="hidden">
      <Text color={THEME.accent}>{"\u25CF "}</Text>
      <Box flexDirection="column" flexShrink={1} overflow="hidden">
        <Markdown content={msg.content} />
      </Box>
    </Box>
  );
}

function ThinkingMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="column" overflow="hidden">
      <Box flexDirection="row">
        <Text color={THEME.textDisabled}>{"\u2042 "}</Text>
        <Text color={THEME.textDisabled} dim>Thinking...</Text>
      </Box>
      <Box paddingLeft={2} flexShrink={1} overflow="hidden">
        <Text color={THEME.textDisabled} dim>{msg.content}</Text>
      </Box>
    </Box>
  );
}

function FunctionCallMessage({ msg }: { msg: Message }) {
  const params = msg.toolParams
    ? Object.entries(msg.toolParams)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ")
    : "";
  const toolName = msg.toolName ?? "tool";

  return (
    <Box flexDirection="row">
      <BlinkDot state="running" />
      <Text>{" "}</Text>
      <Box flexShrink={1}>
        <Text color={THEME.text} bold>{toolName}</Text>
        <Text color={THEME.textSecondary}>{params ? `(${params})` : ""}</Text>
      </Box>
    </Box>
  );
}

function FunctionReturnMessage({ msg }: { msg: Message }) {
  const isError =
    msg.content.toLowerCase().includes("error") ||
    msg.content.toLowerCase().includes("denied") ||
    msg.content.toLowerCase().includes("fail");

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <BlinkDot state={isError ? "failed" : "completed"} />
        <Text>{" "}</Text>
        <Text color={isError ? THEME.error : THEME.success} bold>
          {isError ? "Failed" : "Done"}
        </Text>
      </Box>
      {msg.content && (
        <Box paddingLeft={2}>
          <Text color={THEME.textSecondary}>{"\u23A3 "}{msg.content}</Text>
        </Box>
      )}
    </Box>
  );
}

function MemoryOpMessage({ msg }: { msg: Message }) {
  const action = msg.memoryAction ?? "memory_op";
  return (
    <Box flexDirection="row">
      <Text color={THEME.textDisabled} dim>{"\u25CF "}</Text>
      <Box flexShrink={1}>
        <Text color={THEME.accent} bold>{action}</Text>
        <Text color={THEME.textSecondary}>{": "}{msg.content}</Text>
      </Box>
    </Box>
  );
}

function SystemMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row">
      <Text color={THEME.textDisabled} dim>{"\u25CF "}</Text>
      <Box flexShrink={1}>
        <Text color={THEME.textSecondary} dim>{msg.content}</Text>
      </Box>
    </Box>
  );
}

function ErrorMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row">
      <Text color={THEME.warning}>{"\u26A0 "}</Text>
      <Box flexShrink={1}>
        <Text color={THEME.warning}>{msg.content}</Text>
      </Box>
    </Box>
  );
}

// -- Main Component -----------------------------------------------------------

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column" gap={2}>
      {messages.map((msg) => {
        switch (msg.type) {
          case "user":
            return <UserMessage key={msg.id} msg={msg} />;
          case "assistant":
            return <AssistantMessage key={msg.id} msg={msg} />;
          case "thinking":
            return <ThinkingMessage key={msg.id} msg={msg} />;
          case "function_call":
            return <FunctionCallMessage key={msg.id} msg={msg} />;
          case "function_return":
            return <FunctionReturnMessage key={msg.id} msg={msg} />;
          case "memory_op":
            return <MemoryOpMessage key={msg.id} msg={msg} />;
          case "system":
            return <SystemMessage key={msg.id} msg={msg} />;
          default:
            return null;
        }
      })}
    </Box>
  );
}
