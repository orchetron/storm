#!/usr/bin/env npx tsx
/**
 * Storm Chat v2 — Streaming + status line + history.
 */
import React, { useState, useCallback, useRef } from "react";
import {
  render, Box, Text, ScrollView, TextInput, Spinner, Spacer,
  StreamingText, useInput, useTerminal, useTui,
} from "../src/index.js";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  text: string;
}

let nextId = 0;

function Chat() {
  const { width, height } = useTerminal();
  const { flushSync } = useTui();
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId++, role: "system", text: "Storm Chat v2. Streaming + history." },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [tokens, setTokens] = useState(0);
  const [turns, setTurns] = useState(0);

  useInput(useCallback((e) => {
    if (e.key === "c" && e.ctrl) app.unmount();
    if (e.key === "l" && e.ctrl) {
      flushSync(() => setMessages([{ id: nextId++, role: "system", text: "Cleared." }]));
    }
  }, [flushSync]));

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim() || streaming) return;
    flushSync(() => {
      setMessages(prev => [...prev, { id: nextId++, role: "user", text: text.trim() }]);
      setHistory(prev => [...prev, text.trim()]);
      setInput("");
      setStreaming(true);
      setStreamText("");
      setTurns(n => n + 1);
    });

    // Simulate streaming response token by token
    const response = `I received your message: "${text.trim()}". This response streams token by token, demonstrating Storm's StreamingText component with a blinking cursor.`;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= response.length) {
        clearInterval(interval);
        flushSync(() => {
          setMessages(prev => [...prev, { id: nextId++, role: "assistant", text: response }]);
          setStreaming(false);
          setStreamText("");
          setTokens(prev => prev + Math.ceil(response.length / 4));
        });
        return;
      }
      const chunk = response.slice(i, i + 2 + Math.floor(Math.random() * 3));
      i += chunk.length;
      flushSync(() => setStreamText(prev => prev + chunk));
    }, 25);
  }, [flushSync, streaming]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Messages */}
      <ScrollView flexGrow={1} flexShrink={1} flexBasis={0} stickToBottom>
        <Box flexDirection="column">
          {messages.map((msg) => (
            <MessageView key={msg.id} message={msg} />
          ))}
          {streaming && (
            <Box flexDirection="column" paddingX={1}>
              <Text bold color="magenta">assistant</Text>
              <Box paddingLeft={2}>
                <StreamingText text={streamText} color="white" streaming />
              </Box>
            </Box>
          )}
        </Box>
      </ScrollView>

      {/* Input */}
      <Box flexDirection="row" paddingX={1} borderStyle="round" borderColor={streaming ? 8 : "cyan"}>
        <Text color="cyan" bold>{"❯ "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={streaming ? "waiting..." : "message..."}
          placeholderColor={8}
          focus={!streaming}
          flex={1}
          history={history}
        />
      </Box>

      {/* Status line — no border, just dim text */}
      <Box flexDirection="row" paddingX={1}>
        <Text bold color="cyan">⚡</Text>
        <Text dim> storm</Text>
        <Spacer />
        <Text dim>tokens:{tokens}</Text>
        <Text dim>  turns:{turns}</Text>
        <Text dim>  msgs:{messages.length}</Text>
        <Text dim>  Ctrl+L clear  Ctrl+C exit</Text>
      </Box>
    </Box>
  );
}

function MessageView({ message }: { message: Message }) {
  const { role, text } = message;
  if (role === "system") {
    return (
      <Box paddingX={1}>
        <Text dim italic>{"── "}{text}{" ──"}</Text>
      </Box>
    );
  }
  const isUser = role === "user";
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={isUser ? "blue" : "magenta"}>{role}</Text>
      <Box paddingLeft={2}>
        <Text color={isUser ? "white" : "white"}>{text}</Text>
      </Box>
    </Box>
  );
}

const app = render(<Chat />);
await app.waitUntilExit();
