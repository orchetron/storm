/**
 * Storm Agent CLI -- Main chat screen.
 *
 * Storm Agent visual design:
 * - Single column, full width, NO header bar
 * - ScrollView fills available space
 * - Input between two `\u2500` dividers (part of InputBar)
 * - Footer at bottom with hints + agent/model info (part of InputBar)
 * - NO powerline, NO status bar, just thin dividers
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  ScrollView,
  BlinkDot,
  StreamingText,
  useInput,
  useTerminal,
  useTui,
  useCleanup,
} from "../../../src/index.js";

import type { Message, Agent } from "../data/types.js";
import { simulate } from "../data/simulator.js";
import { executeCommand } from "../data/slash-commands.js";

import { MessageList } from "../chat/MessageList.js";
import { InputBar } from "../chat/InputBar.js";
import { CommandPalette } from "../chat/CommandPalette.js";
import { ToolApproval } from "../chat/ToolApproval.js";

// -- Theme Colors -------------------------------------------------------------

const THEME = {
  accent: "#8C8CF9",
  text: "#DEE1E4",
  textSecondary: "#A5A8AB",
  textDisabled: "#46484A",
};

// -- ID Generator -------------------------------------------------------------

let nextMsgId = 1;
function makeId(): number {
  return nextMsgId++;
}

// -- Types --------------------------------------------------------------------

interface PendingApproval {
  toolName: string;
  toolParams: Record<string, unknown>;
  riskLevel: string;
  resolve: (approved: boolean) => void;
}

export interface ChatScreenProps {
  agent: Agent;
  onExit: () => void;
}

// -- Chat Screen Component ----------------------------------------------------

export function ChatScreen({ agent, onExit }: ChatScreenProps): React.ReactElement {
  const { width, height } = useTerminal();
  const { flushSync, exit } = useTui();

  // -- State ------------------------------------------------------------------
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      type: "system",
      content: `Session started with ${agent.name} (${agent.model})`,
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

  // -- Keyboard Shortcuts -----------------------------------------------------

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

  // -- Input Handling ---------------------------------------------------------

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

      // Normal message — capture text before clearing input
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
            if (alwaysApproveTools.has(name)) {
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

  // -- Approval Handlers ------------------------------------------------------

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

  // -- Command Palette Handlers -----------------------------------------------

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

  // -- Render -----------------------------------------------------------------

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Messages -- single column, full width, no header */}
      <Box flex={1} flexDirection="column" overflow="hidden">
      <ScrollView flex={1} scrollSpeed={1} stickToBottom={true}>
        <Box flexDirection="column" gap={1} paddingY={1}>
          <MessageList messages={messages} />

          {/* Streaming indicator */}
          {isStreaming && streamingText.length > 0 && streamingType === "thinking" && (
            <Box flexDirection="column">
              <Box flexDirection="row">
                <Text color={THEME.textDisabled}>{"\u2042 "}</Text>
                <Text color={THEME.textDisabled} dim>Thinking...</Text>
              </Box>
              <Box paddingLeft={2} flexShrink={1}>
                <StreamingText
                  text={streamingText}
                  color={THEME.textDisabled}
                  streaming
                />
              </Box>
            </Box>
          )}

          {isStreaming && streamingText.length > 0 && streamingType === "response" && (
            <Box flexDirection="row">
              <Text color={THEME.accent}>{"\u25CF "}</Text>
              <Box flexDirection="column" flexShrink={1}>
                <StreamingText
                  text={streamingText}
                  color={THEME.text}
                  streaming
                />
              </Box>
            </Box>
          )}

          {/* Streaming spinner when no text yet */}
          {isStreaming && streamingText.length === 0 && (
            <Box flexDirection="row">
              <BlinkDot state="running" />
              <Text color={THEME.textDisabled}>{" Thinking..."}</Text>
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

      {/* Input -- between dividers, with footer */}
      <InputBar
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        hasPendingApproval={pendingApproval !== null}
        agentName={agent.name}
        model={agent.model}
      />
    </Box>
  );
}
