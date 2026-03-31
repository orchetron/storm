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

import React, { useState, useCallback, useRef } from "react";
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

  // -- State -------------------------------------------------------------------
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      type: "system",
      content: `storm ${model} · ${process.cwd()}`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingType, setStreamingType] = useState<"thinking" | "response">("thinking");
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
          flushSync(() =>
            setMessages([
              {
                id: makeId(),
                type: "system",
                content: "Screen cleared.",
                timestamp: Date.now(),
              },
            ]),
          );
        }
      },
      [flushSync, exit, onExit],
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
      if (isStreaming) return;

      flushSync(() => setShowCommands(false));

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
          flushSync(() => {
            setInput("");
            setMessages([
              {
                id: makeId(),
                type: "system",
                content: "Screen cleared.",
                timestamp: Date.now(),
              },
            ]);
          });
          return;
        }

        flushSync(() => {
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
        });
        return;
      }

      // Normal message
      const userText = text.trim();
      if (!userText) return;

      flushSync(() => {
        setInput("");
        setIsStreaming(true);
        setStreamingText("");
        setStreamingType("thinking");
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            type: "user" as const,
            content: userText,
            timestamp: Date.now(),
          },
        ]);
      });

      const cleanup = simulate(text, {
        onThinking: (accumulated) => {
          flushSync(() => {
            setStreamingType("thinking");
            setStreamingText(accumulated);
          });
        },

        onMemoryOp: (action, content) => {
          flushSync(() => {
            setStreamingText("");
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
          });
        },

        onToolCall: (name, params, riskLevel) => {
          return new Promise<boolean>((resolve) => {
            // Auto-approve low-risk tools and tools the user marked "always"
            if (riskLevel === "low" || alwaysApproveTools.has(name)) {
              flushSync(() => {
                setStreamingText("");
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
              });
              resolve(true);
              return;
            }

            // Medium/high risk — show approval prompt
            flushSync(() => {
              setStreamingText("");
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
            });
          });
        },

        onToolResult: (result) => {
          flushSync(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: makeId(),
                type: "function_return",
                content: result,
                timestamp: Date.now(),
              },
            ]);
          });
        },

        onResponse: (accumulated) => {
          flushSync(() => {
            setStreamingType("response");
            setStreamingText(accumulated);
          });
        },

        onComplete: (simMessages) => {
          const assistantMsg = simMessages.filter((m) => m.type === "assistant").pop();
          const thinkingMsg = simMessages.filter((m) => m.type === "thinking").pop();

          flushSync(() => {
            setIsStreaming(false);
            setStreamingText("");

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
          });
        },
      });

      cleanupRef.current = cleanup;
    },
    [isStreaming, flushSync, exit, onExit, alwaysApproveTools],
  );

  // -- Approval Handlers -------------------------------------------------------

  const handleApprove = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(true);
      flushSync(() => setPendingApproval(null));
    }
  }, [pendingApproval, flushSync]);

  const handleDeny = useCallback(() => {
    if (pendingApproval) {
      pendingApproval.resolve(false);
      flushSync(() => setPendingApproval(null));
    }
  }, [pendingApproval, flushSync]);

  const handleAlwaysApprove = useCallback(() => {
    if (pendingApproval) {
      setAlwaysApproveTools((prev) => new Set([...prev, pendingApproval.toolName]));
      pendingApproval.resolve(true);
      flushSync(() => setPendingApproval(null));
    }
  }, [pendingApproval, flushSync]);

  // -- Command Palette Handlers ------------------------------------------------

  const handleCommandSelect = useCallback(
    (commandName: string) => {
      flushSync(() => {
        setShowCommands(false);
        setInput("");
      });
      handleSubmit(commandName);
    },
    [flushSync, handleSubmit],
  );

  const handleCommandClose = useCallback(() => {
    flushSync(() => setShowCommands(false));
  }, [flushSync]);

  // -- Render ------------------------------------------------------------------

  return (
    <Box flexDirection="column" width={width} height={height} {...(S.bg ? { backgroundColor: S.bg } : {})}>
      {/* Header — mini storm logo spinner + bottom border */}
      <Box height={1} flexDirection="row" paddingLeft={1} overflow="hidden">
        <Spinner type="storm-logo" color={S.arc} interval={120} />
        <Text color={S.text} bold>{" storm"}</Text>
        <Text color={S.dim}>{" · "}{model}</Text>
        <Box flex={1} />
        <Text color={isStreaming ? S.arc : S.success} wrap="truncate">{isStreaming ? "● working" : "● ready"}</Text>
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
          {isStreaming && streamingText.length > 0 && streamingType === "thinking" && (
            <Box flexDirection="column" flexShrink={1}>
              <Box flexDirection="row">
                <Text color={S.dim} dim>{"⟡ Reasoning..."}</Text>
              </Box>
              <Box paddingLeft={2} flexShrink={1}>
                <StreamingText
                  text={streamingText}
                  color={S.dim}
                  streaming
                  cursor={false}
                />
              </Box>
            </Box>
          )}

          {/* Streaming indicator — response */}
          {isStreaming && streamingText.length > 0 && streamingType === "response" && (
            <Box flexDirection="row" flexShrink={1}>
              <Text color={S.arc}>{"◆ "}</Text>
              <Box flexDirection="column" flexShrink={1}>
                <StreamingText
                  text={streamingText}
                  color={S.text}
                  streaming
                  cursor={false}
                />
              </Box>
            </Box>
          )}

          {/* Streaming spinner when no text yet */}
          {isStreaming && streamingText.length === 0 && (
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
        isStreaming={isStreaming}
        hasPendingApproval={pendingApproval !== null}
        model={model}
      />
    </Box>
  );
}
