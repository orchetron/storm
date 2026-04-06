/**
 * Storm Code CLI — Main chat screen.
 *
 * Storm visual design:
 * - Single column, full width, NO header bar
 * - ScrollView fills available space
 * - Input between two `─` dividers (part of InputBar)
 * - Footer with hints + model/cost/context (part of InputBar)
 * - Streaming: pulsing indicator during thinking, `◆ ` prefix during response
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Box,
  Text,
  ScrollView,
  Spinner,
  BlinkDot,
  StreamingText,
  useInput,
  useTerminal,
  useTui,
  useCleanup,
  useTick,
} from "../../../src/index.js";

import type { Message } from "../data/types.js";
import { simulate } from "../data/simulator.js";
import { executeCommand } from "../data/slash-commands.js";

import { MessageList } from "../chat/MessageList.js";
import { InputBar } from "../chat/InputBar.js";
import { CommandPalette } from "../chat/CommandPalette.js";
import { ToolApproval } from "../chat/ToolApproval.js";
import { S } from "../data/theme.js";

// -- ID Generator ----------------------------------------------------------------

let nextMsgId = 1;
function makeId(): number {
  return nextMsgId++;
}

// -- Types -----------------------------------------------------------------------

interface PendingApproval {
  toolName: string;
  toolParams: Record<string, unknown>;
  riskLevel: string;
  resolve: (approved: boolean) => void;
}

export interface ChatScreenProps {
  model: string;
  onExit: () => void;
}

// -- Chat Screen Component -------------------------------------------------------

export function ChatScreen({ model, onExit }: ChatScreenProps): React.ReactElement {
  const { width, height } = useTerminal();
  const { flushSync, exit } = useTui();

  // -- State ------------------------------------------------------------------
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      type: "system",
      content: `storm ${model} · ${process.cwd()}`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  // Streaming state in refs — useTick reactive re-renders at 50ms, not per-char
  const isStreamingRef = useRef(false);
  const streamingTextRef = useRef("");
  const streamingTypeRef = useRef<"thinking" | "response">("thinking");
  useTick(50, () => {}, { active: isStreamingRef.current });
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [alwaysApproveTools, setAlwaysApproveTools] = useState<Set<string>>(new Set());

  const cleanupRef = useRef<(() => void) | null>(null);

  useCleanup(() => {
    cleanupRef.current?.();
  });

  // -- Keyboard Shortcuts ------------------------------------------------------

  useInput(
    useCallback(
      (e) => {
        if (e.key === "c" && e.ctrl) {
          cleanupRef.current?.();
          exit();
          onExit();
        }
        if (e.key === "l" && e.ctrl) {
          setMessages([
            {
              id: makeId(),
              type: "system",
              content: "Screen cleared.",
              timestamp: Date.now(),
            },
          ]);
        }
      },
      [exit, onExit],
    ),
  );

  // -- Input Handling ----------------------------------------------------------

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      setShowCommands(value.startsWith("/"));
    },
    [],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      if (isStreamingRef.current) return;

      setShowCommands(false);

      // Slash command
      if (text.startsWith("/")) {
        const result = executeCommand(text);

        if (text.trim() === "/exit") {
          cleanupRef.current?.();
          exit();
          onExit();
          return;
        }

        if (text.trim() === "/clear") {
          setInput("");
          setMessages([
            {
              id: makeId(),
              type: "system",
              content: "Screen cleared.",
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        setInput("");
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            type: "system",
            content: result,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Normal message
      const userText = text.trim();
      if (!userText) return;

      setInput("");
      isStreamingRef.current = true;
      streamingTextRef.current = "";
      streamingTypeRef.current = "thinking";
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          type: "user" as const,
          content: userText,
          timestamp: Date.now(),
        },
      ]);

      const cleanup = simulate(text, {
        onThinking: (accumulated) => {
          streamingTypeRef.current = "thinking";
          streamingTextRef.current = accumulated;
        },

        onMemoryOp: (action, content) => {
          streamingTextRef.current = "";
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              type: "memory_op",
              content,
              memoryAction: action,
              timestamp: Date.now(),
            },
          ]);
        },

        onToolCall: (name, params, riskLevel) => {
          return new Promise<boolean>((resolve) => {
            setAlwaysApproveTools((currentSet) => {
              // Auto-approve low-risk tools and tools the user marked "always"
              if (riskLevel === "low" || currentSet.has(name)) {
                streamingTextRef.current = "";
                setMessages((prev) => [
                  ...prev,
                  {
                    id: makeId(),
                    type: "function_call",
                    content: `Auto-approved: ${name}`,
                    toolName: name,
                    toolParams: params,
                    riskLevel: riskLevel as Message["riskLevel"],
                    timestamp: Date.now(),
                  },
                ]);
                resolve(true);
              } else {
                // Medium/high risk — show approval prompt
                streamingTextRef.current = "";
                setMessages((prev) => [
                  ...prev,
                  {
                    id: makeId(),
                    type: "function_call",
                    content: `Requesting approval: ${name}`,
                    toolName: name,
                    toolParams: params,
                    riskLevel: riskLevel as Message["riskLevel"],
                    timestamp: Date.now(),
                  },
                ]);
                setPendingApproval({ toolName: name, toolParams: params, riskLevel, resolve });
              }
              return currentSet; // don't change the set
            });
          });
        },

        onToolResult: (result) => {
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              type: "function_return",
              content: result,
              timestamp: Date.now(),
            },
          ]);
        },

        onResponse: (accumulated) => {
          streamingTypeRef.current = "response";
          streamingTextRef.current = accumulated;
        },

        onComplete: (simMessages) => {
          const assistantMsg = simMessages.filter((m) => m.type === "assistant").pop();
          const thinkingMsg = simMessages.filter((m) => m.type === "thinking").pop();

          isStreamingRef.current = false;
          streamingTextRef.current = "";

          setMessages((prev) => {
            const newMsgs = [...prev];
            if (thinkingMsg) {
              newMsgs.push({
                id: makeId(),
                type: "thinking",
                content: thinkingMsg.content,
                timestamp: thinkingMsg.timestamp,
              });
            }
            if (assistantMsg) {
              newMsgs.push({
                id: makeId(),
                type: "assistant",
                content: assistantMsg.content,
                timestamp: assistantMsg.timestamp,
              });
            }
            return newMsgs;
          });
        },
      });

      cleanupRef.current = cleanup;
    },
    [exit, onExit],
  );

  // -- Approval Handlers -------------------------------------------------------

  const handleApprove = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(true);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const handleDeny = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(false);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  const handleAlwaysApprove = useCallback(() => {
    if (pendingApproval) {
      setAlwaysApproveTools((prev) => new Set([...prev, pendingApproval.toolName]));
      pendingApproval.resolve(true);
      setPendingApproval(null);
    }
  }, [pendingApproval]);

  // -- Command Palette Handlers ------------------------------------------------

  const handleCommandSelect = useCallback(
    (commandName: string) => {
      setShowCommands(false);
      setInput("");
      handleSubmit(commandName);
    },
    [handleSubmit],
  );

  const handleCommandClose = useCallback(() => {
    setShowCommands(false);
  }, []);

  // -- Render ------------------------------------------------------------------

  return (
    <Box flexDirection="column" width={width} height={height} {...(S.bg ? { backgroundColor: S.bg } : {})}>
      {/* Header — mini storm logo spinner + bottom border */}
      <Box height={1} flexDirection="row" paddingLeft={1} overflow="hidden">
        <Spinner type="storm-logo" color={S.arc} interval={120} />
        <Text color={S.text} bold>{" storm"}</Text>
        <Text color={S.dim}>{" · "}{model}</Text>
        <Box flex={1} />
        <Text color={isStreamingRef.current ? S.arc : S.success} wrap="truncate">{isStreamingRef.current ? "● working" : "● ready"}</Text>
      </Box>
      <Box height={1} overflow="hidden">
        <Text color={S.dim}>{"\u2500".repeat(width)}</Text>
      </Box>

      {/* Messages */}
      <Box flex={1} flexDirection="column" overflow="hidden">
      <ScrollView flex={1} scrollSpeed={1} stickToBottom={true}>
        <Box flexDirection="column" gap={1} paddingY={1}>
          <MessageList messages={messages} />

          {/* Streaming indicator — thinking (mini storm logo) */}
          {isStreamingRef.current && streamingTextRef.current.length > 0 && streamingTypeRef.current === "thinking" && (
            <Box flexDirection="column" flexShrink={1}>
              <Box flexDirection="row">
                <Text color={S.dim} dim>{"⟡ Reasoning..."}</Text>
              </Box>
              <Box paddingLeft={2} flexShrink={1}>
                <StreamingText
                  text={streamingTextRef.current}
                  color={S.dim}
                  streaming
                  cursor={false}
                />
              </Box>
            </Box>
          )}

          {/* Streaming indicator — response */}
          {isStreamingRef.current && streamingTextRef.current.length > 0 && streamingTypeRef.current === "response" && (
            <Box flexDirection="row" flexShrink={1}>
              <Text color={S.arc}>{"◆ "}</Text>
              <Box flexDirection="column" flexShrink={1}>
                <StreamingText
                  text={streamingTextRef.current}
                  color={S.text}
                  streaming
                  cursor={false}
                />
              </Box>
            </Box>
          )}

          {/* Streaming spinner when no text yet */}
          {isStreamingRef.current && streamingTextRef.current.length === 0 && (
            <Box flexDirection="row">
              <Text color={S.dim}>{"⟡ Thinking..."}</Text>
            </Box>
          )}
        </Box>
      </ScrollView>
      </Box>

      {/* Tool Approval */}
      {pendingApproval !== null && (
        <ToolApproval
          toolName={pendingApproval.toolName}
          toolParams={pendingApproval.toolParams}
          riskLevel={pendingApproval.riskLevel}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onAlwaysApprove={handleAlwaysApprove}
        />
      )}

      {/* Command Palette */}
      {showCommands && (
        <CommandPalette
          inputText={input}
          onSelect={handleCommandSelect}
          onClose={handleCommandClose}
        />
      )}

      {/* Input */}
      <InputBar
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isStreaming={isStreamingRef.current}
        hasPendingApproval={pendingApproval !== null}
        model={model}
      />
    </Box>
  );
}
