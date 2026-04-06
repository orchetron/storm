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

import React, { useCallback, useRef, useState } from "react";
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
  useTick,
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
  accent: "#82AAFF",
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

      // Normal message — capture text before clearing input
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
              if (currentSet.has(name)) {
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

  // -- Approval Handlers ------------------------------------------------------

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

  // -- Command Palette Handlers -----------------------------------------------

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

  // -- Render -----------------------------------------------------------------

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Messages -- single column, full width, no header */}
      <Box flex={1} flexDirection="column" overflow="hidden">
      <ScrollView flex={1} scrollSpeed={1} stickToBottom={true}>
        <Box flexDirection="column" gap={1} paddingY={1}>
          <MessageList messages={messages} />

          {/* Streaming indicator */}
          {isStreamingRef.current && streamingTextRef.current.length > 0 && streamingTypeRef.current === "thinking" && (
            <Box flexDirection="column">
              <Box flexDirection="row">
                <Text color={THEME.textDisabled}>{"\u2042 "}</Text>
                <Text color={THEME.textDisabled} dim>Thinking...</Text>
              </Box>
              <Box paddingLeft={2} flexShrink={1}>
                <StreamingText
                  text={streamingTextRef.current}
                  color={THEME.textDisabled}
                  streaming
                />
              </Box>
            </Box>
          )}

          {isStreamingRef.current && streamingTextRef.current.length > 0 && streamingTypeRef.current === "response" && (
            <Box flexDirection="row">
              <Text color={THEME.accent}>{"\u25CF "}</Text>
              <Box flexDirection="column" flexShrink={1}>
                <StreamingText
                  text={streamingTextRef.current}
                  color={THEME.text}
                  streaming
                />
              </Box>
            </Box>
          )}

          {/* Streaming spinner when no text yet */}
          {isStreamingRef.current && streamingTextRef.current.length === 0 && (
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
        isStreaming={isStreamingRef.current}
        hasPendingApproval={pendingApproval !== null}
        agentName={agent.name}
        model={agent.model}
      />
    </Box>
  );
}
