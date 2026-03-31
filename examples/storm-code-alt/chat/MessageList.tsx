/**
 * Storm Code CLI -- Message list renderer.
 *
 * Storm Code visual design:
 *
 * User:       ❯ message text
 *             gray chevron, white bold text
 *
 * Assistant:  ✻ response text
 *             terra cotta prefix, white markdown
 *
 * Thinking:   (collapsed) "  Reasoning (4.2s)" dim italic
 *             (expanded) header + dim italic content
 *
 * Tool call:  ⏺ ToolName args
 *               output lines (dim, indented 4)
 *               ... +N lines (ctrl+r to expand)
 *
 * System:     dim italic, indented 2
 */

import React from "react";
import {
  Box,
  Text,
  MarkdownText,
} from "../../../src/index.js";
import type { Message } from "../data/types.js";

// -- Colors -------------------------------------------------------------------

const CC = {
  accent: "#d97757",       // terra cotta orange
  userChevron: "#666666",  // muted gray
  text: "#ffffff",
  textDim: "#808080",
  textDisabled: "#555555",
  diffAdd: "#34d399",      // green for + lines
  diffDel: "#f87171",      // red for - lines
};

// -- Per-Type Renderers -------------------------------------------------------

function UserMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row">
      <Text color={CC.userChevron}>{"\u276F "}</Text>
      <Text color={CC.text} bold>{msg.content}</Text>
    </Box>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row">
      <Text color={CC.accent} bold>{"\u273B "}</Text>
      <Box flexShrink={1}>
        <MarkdownText>{msg.content}</MarkdownText>
      </Box>
    </Box>
  );
}

function ThinkingMessage({ msg }: { msg: Message }) {
  const duration = msg.thinkingDuration?.toFixed(1) ?? "?";
  const expanded = msg.thinkingExpanded ?? false;

  if (!expanded) {
    // Collapsed: single dim line
    return (
      <Box flexDirection="row">
        <Text dim>{"  "}</Text>
        <Text dim italic>{`Reasoning (${duration}s)`}</Text>
      </Box>
    );
  }

  // Expanded: header + content
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Text dim>{"  "}</Text>
        <Text dim italic>{"Reasoning"}</Text>
      </Box>
      <Box paddingLeft={4}>
        <Text dim italic>{msg.content}</Text>
      </Box>
    </Box>
  );
}

function ToolCallMessage({ msg }: { msg: Message }) {
  const tc = msg.toolCall;
  if (!tc) return null;

  const outputLines = tc.output.split("\n");
  const previewLines = outputLines.slice(0, 4);
  const remaining = tc.totalLines - previewLines.length;
  const showCollapse = remaining > 0 && !tc.expanded;
  const displayLines = tc.expanded ? outputLines : previewLines;
  const isEditTool = tc.name === "Edit";

  return (
    <Box flexDirection="column">
      {/* Tool call header: ⏺ ToolName args (NO parens) */}
      <Box flexDirection="row">
        <Text color={CC.accent}>{"\u23FA "}</Text>
        <Text bold>{tc.name}</Text>
        {tc.args ? <Text dim>{" " + tc.args}</Text> : null}
      </Box>

      {/* Tool output: indented 4 spaces below */}
      {tc.output && (
        <Box flexDirection="column" paddingLeft={4}>
          {displayLines.map((line, i) => {
            // For Edit tool, color diff lines
            if (isEditTool) {
              if (line.startsWith("+")) {
                return (
                  <Box key={i} flexDirection="row" flexShrink={1}>
                    <Text color={CC.diffAdd}>{line}</Text>
                  </Box>
                );
              }
              if (line.startsWith("-")) {
                return (
                  <Box key={i} flexDirection="row" flexShrink={1}>
                    <Text color={CC.diffDel}>{line}</Text>
                  </Box>
                );
              }
            }
            return (
              <Box key={i} flexDirection="row" flexShrink={1}>
                <Text dim>{line}</Text>
              </Box>
            );
          })}
          {showCollapse && (
            <Text dim>
              {"\u2026 +"}{remaining}{" lines (ctrl+r to expand)"}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function SystemMessage({ msg }: { msg: Message }) {
  return (
    <Box paddingLeft={2}>
      <Text dim italic>{msg.content}</Text>
    </Box>
  );
}

// -- Main Component -----------------------------------------------------------

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {messages.map((msg) => {
        let el: React.ReactElement | null = null;
        switch (msg.type) {
          case "user":
            el = <UserMessage key={msg.id} msg={msg} />;
            break;
          case "assistant":
            el = <AssistantMessage key={msg.id} msg={msg} />;
            break;
          case "thinking":
            el = <ThinkingMessage key={msg.id} msg={msg} />;
            break;
          case "tool_call":
            el = <ToolCallMessage key={msg.id} msg={msg} />;
            break;
          case "system":
            el = <SystemMessage key={msg.id} msg={msg} />;
            break;
        }
        // Extra margin before user messages (visual turn separator)
        const isUser = msg.type === "user";
        return el ? (
          <Box key={msg.id} flexDirection="column" marginTop={isUser ? 1 : 0} marginBottom={msg.type === "tool_call" ? 0 : 1}>
            {el}
          </Box>
        ) : null;
      })}
    </Box>
  );
}
