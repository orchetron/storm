/**
 * Storm Code CLI — Message list renderer.
 *
 * Storm visual design:
 * - 2-char left gutter pattern: [gutter 2 chars][space][content]
 * - User: `› ` prefix dim, text bold white, subtle dark background
 * - Assistant: `◆ ` prefix in arc blue, MarkdownText content
 * - Thinking: `∴ ` prefix dim, "Reasoning..." header dim italic, content dim italic
 * - Tool calls: BlinkDot + tool name bold + args dim
 * - Tool returns: BlinkDot (completed/failed) + "Done"/"Failed" + `◂ ` result
 * - Memory ops: dim `◆ ` + action bold in arc + content
 * - System: dim `│ ` + dim text
 */

import React from "react";
import {
  Box,
  Text,
  BlinkDot,
  MarkdownText,
  SyntaxHighlight,
  Collapsible,
} from "../../../src/index.js";
import type { Message } from "../data/types.js";
import { S } from "../data/theme.js";

// -- Per-Type Renderers -----------------------------------------------------------

function UserMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row" backgroundColor={S.userBg}>
      <Text color={S.dim}>{"› "}</Text>
      <Box flexShrink={1}>
        <Text color={S.userText} bold>{msg.content}</Text>
      </Box>
    </Box>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row">
      <Text color={S.arc}>{"◆ "}</Text>
      <Box flexDirection="column" flexShrink={1}>
        <MarkdownText>{msg.content}</MarkdownText>
      </Box>
    </Box>
  );
}

function ThinkingMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="column">
      {/* Header — star diamond (completed thinking) */}
      <Box flexDirection="row">
        <Text color={S.dim}>{"⟡ "}</Text>
        <Text color={S.dim} dim>Reasoning</Text>
      </Box>
      {/* Content indented 2 spaces, all dimmed */}
      <Box paddingLeft={2} flexShrink={1}>
        <Text color={S.dim} dim>{msg.content}</Text>
      </Box>
    </Box>
  );
}

interface ToolCallDisplay {
  verb: string;
  args: string;
}

function formatToolCall(toolName: string, params: Record<string, unknown> | undefined): ToolCallDisplay {
  const p = params ?? {};
  switch (toolName) {
    case "read_file":
      return { verb: "Read", args: String(p.path ?? "file") };
    case "edit_file":
      return { verb: "Edit", args: String(p.path ?? "file") };
    case "bash":
      return { verb: "Run", args: String(p.command ?? "command") };
    case "search_files":
      return { verb: "Search", args: `"${p.pattern ?? "..."}" in ${p.path ?? "src/"}` };
    default: {
      const summary = p.path ?? p.command ?? p.pattern ?? "";
      return { verb: toolName, args: summary ? String(summary) : "" };
    }
  }
}

function FunctionCallMessage({ msg }: { msg: Message }) {
  const toolName = msg.toolName ?? "tool";
  const { verb, args } = formatToolCall(toolName, msg.toolParams);

  return (
    <Box flexDirection="row">
      <BlinkDot state="running" />
      <Text>{" "}</Text>
      <Box flexShrink={1} flexDirection="row">
        <Text color={S.arc} bold>{"▸ "}{verb}</Text>
        {args ? <Text color={S.text}>{" "}{args}</Text> : null}
      </Box>
    </Box>
  );
}

function hasDiffContent(content: string): boolean {
  const lines = content.split("\n");
  return lines.some(
    (l) => l.startsWith("+") || l.startsWith("-") || l.startsWith("@@"),
  );
}

function DiffContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        if (line.startsWith("@@")) {
          return <Text key={i} color={S.arc} dim>{line}</Text>;
        }
        if (line.startsWith("+")) {
          return <Text key={i} color={S.success}>{line}</Text>;
        }
        if (line.startsWith("-")) {
          return <Text key={i} color={S.error}>{line}</Text>;
        }
        return <Text key={i} color={S.dim}>{line}</Text>;
      })}
    </Box>
  );
}

function hasCodeBlock(content: string): boolean {
  return content.includes("```");
}

function extractCodeBlock(content: string): { language: string; code: string } | null {
  const match = content.match(/```(\w*)\n?([\s\S]*?)```/);
  if (!match) return null;
  return { language: match[1] || "text", code: match[2].trimEnd() };
}

function ToolOutputContent({ content }: { content: string }) {
  const isDiff = hasDiffContent(content);
  const codeBlock = hasCodeBlock(content) ? extractCodeBlock(content) : null;

  if (isDiff) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={S.dim}>{"◂ diff"}</Text>
        <DiffContent content={content} />
      </Box>
    );
  }

  if (codeBlock) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color={S.dim}>{"◂ "}{codeBlock.language}</Text>
        <SyntaxHighlight code={codeBlock.code} language={codeBlock.language} />
      </Box>
    );
  }

  const lines = content.split("\n");
  const lineCount = lines.length;

  if (lineCount > 5) {
    return (
      <Box paddingLeft={2}>
        <Text color={S.dim}>{"◂ "}</Text>
        <Collapsible title={`Output (${lineCount} lines)`} expanded={false}>
          <Text color={S.dim}>{content}</Text>
        </Collapsible>
      </Box>
    );
  }

  return (
    <Box paddingLeft={2}>
      <Text color={S.dim}>{"◂ "}{content}</Text>
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
        <Text color={isError ? S.error : S.success} bold>
          {isError ? "Failed" : "Done"}
        </Text>
      </Box>
      {msg.content ? <ToolOutputContent content={msg.content} /> : null}
    </Box>
  );
}

function MemoryOpMessage({ msg }: { msg: Message }) {
  const action = msg.memoryAction ?? "memory_op";
  return (
    <Box flexDirection="row">
      <Text color={S.dim} dim>{"◆ "}</Text>
      <Box flexShrink={1}>
        <Text color={S.arc} bold>{action}</Text>
        <Text color={S.dim}>{": "}{msg.content}</Text>
      </Box>
    </Box>
  );
}

function SystemMessage({ msg }: { msg: Message }) {
  return (
    <Box flexDirection="row">
      <Text color={S.dim} dim>{"│ "}</Text>
      <Box flexShrink={1}>
        <Text color={S.dim} dim>{msg.content}</Text>
      </Box>
    </Box>
  );
}

// -- Grouping Logic ---------------------------------------------------------------

type MessageGroup = { kind: "tool"; messages: Message[] } | { kind: "single"; message: Message };

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i]!;
    if (msg.type === "function_call" || msg.type === "function_return") {
      // Collect consecutive tool-related messages into a tight group
      const toolMsgs: Message[] = [msg];
      let j = i + 1;
      while (j < messages.length) {
        const next = messages[j]!;
        if (next.type === "function_call" || next.type === "function_return") {
          toolMsgs.push(next);
          j++;
        } else {
          break;
        }
      }
      groups.push({ kind: "tool", messages: toolMsgs });
      i = j;
    } else {
      groups.push({ kind: "single", message: msg });
      i++;
    }
  }
  return groups;
}

function renderMessage(msg: Message): React.ReactElement | null {
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
}

// -- Main Component ---------------------------------------------------------------

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps): React.ReactElement {
  const groups = groupMessages(messages);

  return (
    <Box flexDirection="column" gap={1}>
      {groups.map((group, gi) => {
        if (group.kind === "tool") {
          // Tool call + return rendered tight (no gap between them)
          return (
            <Box key={`tg-${group.messages[0]!.id}`} flexDirection="column">
              {group.messages.map((msg) => renderMessage(msg))}
            </Box>
          );
        }
        return renderMessage(group.message);
      })}
    </Box>
  );
}
