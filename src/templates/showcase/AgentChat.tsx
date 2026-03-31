/**
 * AgentChat -- Clean, warm AI chat interface.
 *
 * Uses the default Storm color theme (amber/sage).
 * Simple layout: header, scrollable conversation, input bar.
 */

import React, { useState, useRef, useCallback } from "react";
import * as path from "path";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { useColors } from "../../hooks/useColors.js";
import { ScrollView } from "../../components/ScrollView.js";
import { TextInput } from "../../components/TextInput.js";
import { MarkdownText } from "../../widgets/MarkdownText.js";
import { SyntaxHighlight } from "../../widgets/SyntaxHighlight.js";
import { MessageBubble } from "../../widgets/MessageBubble.js";
import { Image } from "../../components/Image.js";

export interface AgentChatProps {
  title?: string;
}

interface ChatMsg {
  role: "system" | "user" | "assistant" | "thinking";
  content: string;
  kind?: "text" | "markdown" | "code" | "image";
  lang?: string;
}

const INITIAL_MESSAGES: ChatMsg[] = [
  { role: "system", content: "Agent initialized. Model: command-r-plus | Context: 200K" },
  { role: "user", content: "Explain how Storm's cell-based rendering works" },
  {
    role: "assistant", kind: "markdown",
    content: "## Cell-Based Rendering\n\nStorm uses a **cell buffer** where each cell holds a character, foreground color, and background color.\n\nThe renderer maintains two buffers:\n\n1. **Front buffer** -- what's currently on screen\n2. **Back buffer** -- the next frame being composed\n\nOn each render pass, only cells that *differ* between buffers get written to the terminal. This `diff` approach minimizes escape sequences and keeps output flicker-free.",
  },
  { role: "user", content: "Show me a code example" },
  {
    role: "assistant", kind: "markdown",
    content: "Here's the core diff algorithm:",
  },
  {
    role: "assistant", kind: "code", lang: "typescript",
    content: [
      "interface Cell {",
      "  char: string;",
      "  fg: number;   // -1 = default, 0-255 = ANSI, 0x1RRGGBB = RGB",
      "  bg: number;",
      "  attrs: number; // bitmask: bold | dim | italic | underline",
      "}",
      "",
      "function diffBuffers(front: Cell[], back: Cell[]): string {",
      "  const parts: string[] = [];",
      "  for (let i = 0; i < back.length; i++) {",
      "    if (front[i].fg !== back[i].fg || front[i].char !== back[i].char) {",
      "      parts.push(cursorTo(i) + sgr(back[i]) + back[i].char);",
      "    }",
      "  }",
      "  return parts.join('');  // only changed cells",
      "}",
    ].join("\n"),
  },
  { role: "user", content: "Can you show me the benchmark results?" },
  {
    role: "assistant", kind: "image",
    content: "chart.png",
  },
  {
    role: "assistant", kind: "markdown",
    content: "The chart above shows Storm rendering **6,872 FPS** at full buffer change and **25,631 FPS** on scroll — both with the adaptive WASM engine active.",
  },
];

const MOCK_RESPONSE = "The diff algorithm runs in **O(n)** where `n` is the buffer size. For a typical 120x40 terminal that's only 4,800 cells -- trivially fast.\n\nCombined with viewport culling (skipping offscreen nodes during layout), Storm achieves consistent **<2ms** render times even with complex layouts.";

function renderMsg(msg: ChatMsg, i: number): React.ReactElement {
  const colors = useColors();
  // System message — dim
  if (msg.role === "system") {
    return React.createElement("tui-text", { key: `m${i}`, dim: true, color: colors.system.text }, `  ${msg.content}`);
  }

  // Thinking indicator
  if (msg.role === "thinking") {
    return React.createElement("tui-text", { key: `m${i}`, dim: true, italic: true, color: colors.thinking.symbol }, "    \u25C6 Reasoning...");
  }

  // User message — amber
  if (msg.role === "user") {
    return React.createElement(MessageBubble, {
      key: `m${i}`, symbol: "\u25B8", symbolColor: colors.user.symbol,
      children: React.createElement("tui-text", { color: colors.text.primary }, msg.content),
    });
  }

  // Assistant — code block with border (width capped to prevent overflow)
  if (msg.kind === "code") {
    return React.createElement("tui-box", {
      key: `m${i}`, paddingLeft: 4, paddingRight: 1, flexDirection: "column",
    },
      React.createElement("tui-box", { borderStyle: "round", borderColor: colors.text.dim, paddingX: 1, overflow: "hidden" },
        React.createElement(SyntaxHighlight, { code: msg.content, language: msg.lang ?? "typescript" }),
      ),
    );
  }

  // Assistant — image
  if (msg.kind === "image") {
    return React.createElement("tui-box", { key: `m${i}`, paddingLeft: 4, flexDirection: "column" },
      React.createElement(Image, {
        src: path.join(process.cwd(), "examples", msg.content),
        alt: msg.content, width: 50, height: 10, protocol: "block" as const,
      }),
    );
  }

  // Assistant — markdown
  if (msg.kind === "markdown") {
    return React.createElement(MessageBubble, {
      key: `m${i}`, symbol: "\u25C6", symbolColor: colors.assistant.symbol,
      children: React.createElement(MarkdownText, null, msg.content),
    });
  }

  // Assistant — plain text
  return React.createElement(MessageBubble, {
    key: `m${i}`, symbol: "\u25C6", symbolColor: colors.assistant.symbol,
    children: React.createElement("tui-text", { color: colors.text.primary }, msg.content),
  });
}

export function AgentChat(_props: AgentChatProps): React.ReactElement {
  const colors = useColors();
  const { exit, flushSync } = useTui();
  const { width, height } = useTerminal();

  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenCount, setTokenCount] = useState(1234);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useCleanup(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  });

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // Add user message immediately
    const userMsg: ChatMsg = { role: "user", content: trimmed };
    flushSync(() => {
      setInput("");
      setIsStreaming(true);
      setTokenCount((t) => t + trimmed.split(" ").length * 2);
    });
    // Use setState callback form to ensure we have latest messages
    flushSync(() => {
      setMessages((prev) => [...prev, userMsg]);
    });

    // Mock response after delay
    timerRef.current = setTimeout(() => {
      const response: ChatMsg = { role: "assistant", kind: "markdown", content: MOCK_RESPONSE };
      flushSync(() => {
        setIsStreaming(false);
        setTokenCount((t) => t + 180);
      });
      flushSync(() => {
        setMessages((prev) => [...prev, response]);
      });
    }, 1500);
  }, [input, isStreaming, flushSync]);

  useInput((event) => {
    if (event.ctrl && (event.key === "q" || event.char === "q")) exit();
  });

  const costEstimate = `$${(tokenCount * 0.000015).toFixed(2)}`;

  // -- Header (bordered, visible, identity) --
  const header = React.createElement("tui-box", {
    borderStyle: "round", borderColor: colors.brand.primary, paddingX: 1, flexDirection: "column", width: width - 2,
  },
    React.createElement("tui-box", { flexDirection: "row", justifyContent: "space-between" },
      React.createElement("tui-text", { bold: true, color: colors.brand.primary }, "\u26A1 STORM AGENT"),
      React.createElement("tui-text", { color: colors.text.secondary }, "command-r-plus"),
    ),
    React.createElement("tui-box", { flexDirection: "row", justifyContent: "space-between" },
      React.createElement("tui-text", { dim: true }, `${tokenCount.toLocaleString()} tokens \u00B7 ${costEstimate}`),
      React.createElement("tui-text", { dim: true, color: colors.success }, "\u25CF connected"),
    ),
  );

  // -- Messages --
  const msgEls = messages.map((m, i) => renderMsg(m, i));

  const thinkingEl = isStreaming
    ? React.createElement("tui-box", { key: "thinking", paddingLeft: 4, marginBottom: 1 },
        React.createElement("tui-text", { dim: true, italic: true, color: colors.thinking.symbol }, "  Reasoning..."),
      )
    : null;

  // -- Input (clearly visible with border + background hint) --
  const inputRow = React.createElement("tui-box", {
    flexDirection: "row", borderStyle: "round",
    borderColor: colors.brand.primary, paddingX: 1, paddingY: 0, gap: 1,
    height: 3,
  },
    React.createElement("tui-text", { color: colors.input.prompt, bold: true }, "\u276F "),
    React.createElement(TextInput, {
      value: input,
      onChange: (v: string) => flushSync(() => setInput(v)),
      onSubmit: () => handleSend(),
      placeholder: "Ask anything...",
      focus: true,
      flex: 1,
      color: colors.text.primary,
      placeholderColor: colors.text.dim,
    }),
  );

  // -- Footer --
  const footer = React.createElement("tui-text", {
    dim: true, color: colors.text.dim,
  }, "[Enter] Send \u00B7 [Ctrl+Q] Quit \u00B7 [\u2191\u2193] Scroll");

  // Layout follows the proven ChatApp pattern:
  // 1. Root box with explicit terminal width/height (anchors layout)
  // 2. ScrollView with flexGrow:1, flexShrink:1, flexBasis:0 (fills + adapts)
  // 3. Inner box with gap:1 (automatic spacing between messages)
  // 4. Header INSIDE scroll (feels part of conversation)
  // 5. Input OUTSIDE scroll (always visible at bottom)
  return React.createElement("tui-box", {
    flexDirection: "column", width, height,
  },
    React.createElement(ScrollView, {
      flexGrow: 1, flexShrink: 1, flexBasis: 0,
      stickToBottom: true, flexDirection: "column",
    },
      React.createElement("tui-box", {
        flexDirection: "column", gap: 1, paddingBottom: 1,
      },
        header,
        ...msgEls,
        ...(thinkingEl ? [thinkingEl] : []),
      ),
    ),
    inputRow,
    footer,
  );
}
