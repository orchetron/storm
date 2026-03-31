/**
 * Storm Code CLI -- Main chat screen.
 *
 * Storm Code visual design:
 * - Single column, full width
 * - ScrollView fills available space with messages
 * - Spinner cycles through: · ✻ ✽ ✶ ✳ ✢ at ~100ms in terra cotta
 * - Shows "✻ Thinking..." during thinking phase
 * - After thinking, show tool calls then response
 * - Bottom: InputBar (❯ prompt) + StatusBar (dim)
 * - ⏺ prefix for tool calls in terra cotta
 * - Thinking collapsed by default, Ctrl+O toggles
 * - Assistant response prefixed with ✻ in terra cotta
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  ScrollView,
  StreamingText,
  MarkdownText,
  useInput,
  useTerminal,
  useTui,
  useCleanup,
} from "../../src/index.js";

import type { Message } from "./data/types.js";
import { simulate } from "./data/simulator.js";

import { MessageList } from "./chat/MessageList.js";
import { InputBar } from "./chat/InputBar.js";
import { ToolApproval } from "./chat/ToolApproval.js";

// -- Colors -------------------------------------------------------------------

const CC = {
  accent: "#d97757",       // terra cotta orange
  text: "#ffffff",
  textDim: "#808080",
  textDisabled: "#555555",
};

// -- Spinner Frames: · ✻ ✽ ✶ ✳ ✢ -------------------------------------------

const SPINNER_CHARS = ["\u00B7", "\u273B", "\u273D", "\u2736", "\u2733", "\u2722"];
const SPINNER_INTERVAL = 100;

// -- ID Generator -------------------------------------------------------------

let nextMsgId = 1;
function makeId(): number {
  return nextMsgId++;
}

// -- Types --------------------------------------------------------------------

interface PendingApproval {
  toolName: string;
  toolArgs: string;
  resolve: (approved: boolean) => void;
}

export interface ChatScreenProps {
  model: string;
  workingDirectory: string;
  onExit: () => void;
}

// -- Chat Screen Component ----------------------------------------------------

export function ChatScreen({ model, workingDirectory, onExit }: ChatScreenProps): React.ReactElement {
  const { width, height } = useTerminal();
  const { flushSync, exit, requestRender } = useTui();

  // -- State ------------------------------------------------------------------
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingType, setStreamingType] = useState<"thinking" | "response">("thinking");
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [alwaysApproveTools, setAlwaysApproveTools] = useState<Set<string>>(new Set());
  const [totalCost, setTotalCost] = useState(0);
  const [contextPercent, setContextPercent] = useState(0);

  const cleanupRef = useRef<(() => void) | null>(null);

  // -- Spinner Animation (imperative) -----------------------------------------
  const spinnerFrameRef = useRef(0);
  const spinnerTextRef = useRef<any>(null);
  const spinnerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startSpinner() {
    if (spinnerTimerRef.current) return;
    spinnerFrameRef.current = 0;
    spinnerTimerRef.current = setInterval(() => {
      spinnerFrameRef.current = (spinnerFrameRef.current + 1) % SPINNER_CHARS.length;
      if (spinnerTextRef.current) {
        spinnerTextRef.current.text = SPINNER_CHARS[spinnerFrameRef.current]! + " ";
        requestRender();
      }
    }, SPINNER_INTERVAL);
  }

  function stopSpinner() {
    if (spinnerTimerRef.current) {
      clearInterval(spinnerTimerRef.current);
      spinnerTimerRef.current = null;
    }
  }

  useCleanup(() => {
    cleanupRef.current?.();
    stopSpinner();
  });

  // -- Keyboard Shortcuts -----------------------------------------------------

  useInput(
    useCallback(
      (e) => {
        if (e.key === "c" && e.ctrl) {
          cleanupRef.current?.();
          stopSpinner();
          exit();
          onExit();
        }
        if (e.key === "o" && e.ctrl) {
          // Toggle expand on the LAST thinking message and all tool calls
          flushSync(() => {
            setMessages((prev) => {
              const newMsgs = [...prev];
              // Find last thinking message
              for (let i = newMsgs.length - 1; i >= 0; i--) {
                const m = newMsgs[i]!;
                if (m.type === "thinking") {
                  newMsgs[i] = { ...m, thinkingExpanded: !m.thinkingExpanded };
                  break;
                }
              }
              // Toggle all tool calls
              return newMsgs.map((m) => {
                if (m.type === "tool_call" && m.toolCall) {
                  return {
                    ...m,
                    toolCall: { ...m.toolCall, expanded: !m.toolCall.expanded },
                  };
                }
                return m;
              });
            });
          });
        }
        if (e.key === "l" && e.ctrl) {
          flushSync(() => setMessages([]));
        }
      },
      [flushSync, exit, onExit],
    ),
  );

  // -- Input Handling ---------------------------------------------------------

  const handleInputChange = useCallback(
    (value: string) => {
      flushSync(() => setInput(value));
    },
    [flushSync],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      if (isStreaming) return;

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

      startSpinner();

      const cleanup = simulate(userText, {
        onThinking: (accumulated) => {
          flushSync(() => {
            setStreamingType("thinking");
            setStreamingText(accumulated);
          });
        },

        onToolCall: (name, args, needsApproval) => {
          return new Promise<boolean>((resolve) => {
            // Auto-approve if always-approved or no approval needed
            if (!needsApproval || alwaysApproveTools.has(name)) {
              resolve(true);
              return;
            }

            flushSync(() => {
              setStreamingText("");
              setPendingApproval({ toolName: name, toolArgs: args, resolve });
            });
          });
        },

        onToolOutput: (name, args, output, totalLines, isError) => {
          flushSync(() => {
            setStreamingText("");
            setMessages((prev) => [
              ...prev,
              {
                id: makeId(),
                type: "tool_call",
                content: "",
                timestamp: Date.now(),
                toolCall: {
                  name,
                  args,
                  output,
                  totalLines,
                  expanded: false,
                  isError,
                },
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

        onComplete: (simMessages, cost, contextDelta) => {
          stopSpinner();

          const assistantMsg = simMessages.filter((m) => m.type === "assistant").pop();
          const thinkingMsg = simMessages.filter((m) => m.type === "thinking").pop();

          flushSync(() => {
            setIsStreaming(false);
            setStreamingText("");
            setTotalCost((prev) => prev + cost);
            setContextPercent((prev) => Math.min(100, prev + contextDelta));

            setMessages((prev) => {
              const newMsgs = [...prev];
              if (thinkingMsg) {
                newMsgs.push({
                  id: makeId(),
                  type: "thinking",
                  content: thinkingMsg.content,
                  timestamp: thinkingMsg.timestamp,
                  thinkingDuration: thinkingMsg.thinkingDuration,
                  thinkingExpanded: false,
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
    [isStreaming, flushSync, alwaysApproveTools],
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

  // -- Render -----------------------------------------------------------------

  const costStr = "$" + totalCost.toFixed(3);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Messages -- single column, full width */}
      <ScrollView flexGrow={1} flexShrink={1} flexBasis={0} stickToBottom>
        <Box flexDirection="column" paddingBottom={1} paddingTop={1}>
          <MessageList messages={messages} />

          {/* Gap for stickToBottom */}
          {isStreaming ? <Box height={1} /> : null}

          {/* Streaming: ✻ Thinking... with spinner cycling through chars */}
          {isStreaming && streamingType === "thinking" && (
            <Box flexDirection="row">
              {React.createElement(
                "tui-text",
                { color: CC.accent, _textNodeRef: spinnerTextRef },
                SPINNER_CHARS[0]! + " ",
              )}
              <Text color={CC.accent}>{"Thinking..."}</Text>
            </Box>
          )}

          {/* Streaming: assistant response with ✻ prefix */}
          {isStreaming && streamingText.length > 0 && streamingType === "response" && (
            <Box flexDirection="row">
              <Text color={CC.accent} bold>{"\u273B "}</Text>
              <Box flexShrink={1}>
                <StreamingText
                  text={streamingText}
                  color={CC.text}
                  streaming
                />
              </Box>
            </Box>
          )}
        </Box>
      </ScrollView>

      {/* Tool Approval -- inline under the tool call */}
      {pendingApproval !== null && (
        <ToolApproval
          toolName={pendingApproval.toolName}
          toolArgs={pendingApproval.toolArgs}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onAlwaysApprove={handleAlwaysApprove}
        />
      )}

      {/* Input (❯ prompt) + Status bar at bottom */}
      <InputBar
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
        hasPendingApproval={pendingApproval !== null}
        model={model}
        cost={costStr}
        contextPercent={contextPercent}
      />
    </Box>
  );
}
