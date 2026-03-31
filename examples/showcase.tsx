#!/usr/bin/env npx tsx
/**
 * @orchetron/tui — Full Showcase
 * Press 1=Chat  2=Components  Ctrl+C=exit
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  render, Box, Text, ScrollView, TextInput, Spinner, Spacer, Newline,
  Link, SelectInput, OperationTree, StreamingText, MarkdownText,
  SyntaxHighlight, Overlay, useInput, useTerminal, useTui,
  type OpNode,
} from "../src/index.js";

function App() {
  const { width, height, exit } = useTerminal();
  const { flushSync } = useTui();
  const [view, setView] = useState<1 | 2>(1);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);

  useInput(useCallback((e) => {
    if (e.key === "c" && e.ctrl) exit();
    if (e.key === "o" && e.ctrl) flushSync(() => setShowOverlay(v => !v));
    if (e.key === "s" && e.ctrl) flushSync(() => setView(v => v === 1 ? 2 : 1));
  }, [exit, flushSync]));

  useEffect(() => {
    const t = setTimeout(() => {
      flushSync(() => setMessages(Array.from({ length: 100 }, (_, i) => ({
        role: i % 3 === 0 ? "user" : "assistant",
        content: i % 3 === 0
          ? `Message #${i + 1} — scroll to explore`
          : `Response #${i + 1}: The quick brown fox jumps over the lazy dog. Smooth scroll demo content.`,
      }))));
    }, 300);
    return () => clearTimeout(t);
  }, [flushSync]);

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim()) return;
    flushSync(() => {
      setMessages(prev => [...prev, { role: "user", content: text }]);
      setHistory(prev => [...prev, text]);
      setInput("");
      setStreaming(true);
      setStreamText("");
    });
    const response = `You said "${text}" — streaming response token by token via StreamingText component.`;
    let i = 0;
    const iv = setInterval(() => {
      if (i >= response.length) {
        clearInterval(iv);
        flushSync(() => {
          setMessages(prev => [...prev, { role: "assistant", content: response }]);
          setStreaming(false);
          setStreamText("");
        });
        return;
      }
      flushSync(() => setStreamText(prev => prev + response.slice(i, i + 3)));
      i += 3;
    }, 30);
  }, [flushSync]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={3} borderStyle="round" borderColor="cyan" flexDirection="row" paddingX={1}>
        <Text bold color="cyan">@orchetron/tui</Text>
        <Spacer />
        <Text dim color={8}>
          {view === 1 ? "Chat" : "Components"} │ Ctrl+S switch │ Ctrl+O overlay │ Ctrl+C exit
        </Text>
      </Box>

      {view === 1 ? (
        <Box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0}>
          <ScrollView flexGrow={1} flexShrink={1} flexBasis={0} stickToBottom>
            <Box flexDirection="column" gap={1}>
              {messages.map((msg, i) => (
                <Box key={i} flexDirection="column">
                  <Box flexDirection="row">
                    <Text bold color={msg.role === "user" ? "blue" : "magenta"}>
                      {msg.role === "user" ? "You" : "Assistant"}
                    </Text>
                  </Box>
                  <Box paddingLeft={2}>
                    <Text color={msg.role === "user" ? "white" : "greenBright"}>{msg.content}</Text>
                  </Box>
                </Box>
              ))}
              {streaming && (
                <Box paddingLeft={2}>
                  <StreamingText text={streamText} color="greenBright" streaming />
                </Box>
              )}
            </Box>
          </ScrollView>
          <Box height={3} borderStyle="single" borderColor="green" flexDirection="row" paddingX={1}>
            <Text color="green" bold>{"❯ "}</Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="Type a message..."
              placeholderColor={8}
              history={history}
              flex={1}
            />
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0}>
          <ScrollView flexGrow={1} flexShrink={1} flexBasis={0}>
            <Box flexDirection="column" gap={1} paddingX={1}>
              <Text bold color="yellow">Inline Styled Text:</Text>
              <Text>Normal <Text bold>bold</Text> <Text italic>italic</Text> <Text underline>underline</Text> <Text color="red">red</Text> <Text color="green" bold>green bold</Text></Text>

              <Text bold color="yellow">Operation Tree:</Text>
              <Box paddingLeft={2}>
                <OperationTree nodes={[
                  { id: "1", label: "file_read", status: "completed", detail: "src/app.ts", durationMs: 12,
                    children: [{ id: "1a", label: "parse", status: "completed", durationMs: 3 }]},
                  { id: "2", label: "shell_exec", status: "running", detail: "npm test",
                    children: [
                      { id: "2a", label: "npm install", status: "completed", durationMs: 2340 },
                      { id: "2b", label: "npm build", status: "running" },
                      { id: "2c", label: "npm test", status: "pending" },
                    ]},
                  { id: "3", label: "file_write", status: "pending", detail: "output.json" },
                ]} />
              </Box>

              <Text bold color="yellow">Syntax Highlighting:</Text>
              <Box paddingLeft={2}>
                <SyntaxHighlight language="typescript" code={`function greet(name: string): void {
  const msg = \`Hello, \${name}!\`;
  console.log(msg); // prints greeting
  return 42;
}`} />
              </Box>

              <Text bold color="yellow">Markdown:</Text>
              <Box paddingLeft={2}>
                <MarkdownText>{`# Welcome
This is **bold** and *italic* text.

## Features
- Item one with \`inline code\`
- Item two
- Item three

> A blockquote with important info

---

1. Numbered one
2. Numbered two`}</MarkdownText>
              </Box>

              <Text bold color="yellow">Spinners:</Text>
              <Box paddingLeft={2} flexDirection="row" gap={4}>
                <Spinner type="dots" color="cyan" label="dots" />
                <Spinner type="line" color="green" label="line" />
                <Spinner type="arc" color="magenta" label="arc" />
                <Spinner type="braille" color="yellow" label="braille" />
              </Box>

              <Text bold color="yellow">Flexbox Layout:</Text>
              <Box flexDirection="row" gap={1} paddingLeft={2}>
                <Box width={20} height={3} borderStyle="single" borderColor="red" flexDirection="row" paddingX={1}>
                  <Text color="red">fixed 20</Text>
                </Box>
                <Box flexGrow={1} height={3} borderStyle="single" borderColor="green" flexDirection="row" paddingX={1}>
                  <Text color="green">flexGrow=1</Text>
                  <Spacer />
                  <Text dim>fills</Text>
                </Box>
                <Box flexGrow={2} height={3} borderStyle="single" borderColor="blue" flexDirection="row" paddingX={1}>
                  <Text color="blue">flexGrow=2</Text>
                  <Spacer />
                  <Text dim>fills 2x</Text>
                </Box>
              </Box>

              <Text bold color="yellow">Link:</Text>
              <Box paddingLeft={2}>
                <Link url="https://github.com" color="cyan" bold>github.com</Link>
              </Box>

              <Newline count={2} />
            </Box>
          </ScrollView>
        </Box>
      )}

      <Box height={1} flexDirection="row" paddingX={1}>
        <Text dim color={8}>
          {width}×{height} │ 16 components │ 6 hooks │ 43 files │ msgs:{messages.length}
        </Text>
      </Box>

      {showOverlay && (
        <Overlay visible position="center" width={50} height={8} borderStyle="double" borderColor="yellow" padding={1}>
          <Box flexDirection="column">
            <Text bold color="yellow">Modal Overlay</Text>
            <Newline />
            <Text>Renders ON TOP of everything.</Text>
            <Text dim>Ctrl+O to dismiss</Text>
          </Box>
        </Overlay>
      )}
    </Box>
  );
}

const app = render(<App />);
await app.waitUntilExit();
