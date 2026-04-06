import React, { useState, useRef, useCallback } from "react";
import * as path from "path";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { useColors } from "../../hooks/useColors.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { TextInput } from "../../components/core/TextInput.js";
import { Markdown as MarkdownText } from "../../components/extras/Markdown.js";
import { SyntaxHighlight } from "../../widgets/dev/SyntaxHighlight.js";
import { MessageBubble } from "../../widgets/ai/MessageBubble.js";
import { Image } from "../../components/effects/Image.js";

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
  { role: "system", content: "Agent initialized. Ready for input." },
  { role: "user", content: "What's the weather like in San Francisco today?" },
  {
    role: "assistant", kind: "markdown",
    content: "## Current Weather in San Francisco\n\nRight now in San Francisco it's **58°F (14°C)** with partly cloudy skies.\n\nHere's the forecast for today:\n\n1. **Morning** -- Fog clearing by 10am\n2. **Afternoon** -- Partly sunny, high of 63°F\n\nWind is coming from the west at ~12 mph. Typical for this time of year!",
  },
  { role: "user", content: "Can you show me a code snippet to fetch weather data?" },
  {
    role: "assistant", kind: "markdown",
    content: "Sure, here's a simple example using fetch:",
  },
  {
    role: "assistant", kind: "code", lang: "typescript",
    content: [
      "interface WeatherResponse {",
      "  temperature: number;",
      "  condition: string;",
      "  humidity: number;",
      "  windSpeed: number;",
      "}",
      "",
      "async function getWeather(city: string): Promise<WeatherResponse> {",
      "  const url = `https://api.example.com/weather?q=${city}`;",
      "  const res = await fetch(url);",
      "  if (!res.ok) throw new Error(`HTTP ${res.status}`);",
      "  return res.json();",
      "}",
    ].join("\n"),
  },
  { role: "user", content: "What about a chart of temperatures?" },
  {
    role: "assistant", kind: "image",
    content: "chart.png",
  },
  {
    role: "assistant", kind: "markdown",
    content: "The chart above shows the temperature trend over the past week for San Francisco.",
  },
];

const MOCK_RESPONSE = "Great question! You can use the `getWeather()` function from the example above and call it in a loop for multiple cities.\n\nFor example, `Promise.all([getWeather('SF'), getWeather('NYC')])` will fetch both in parallel.";

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

  const costEstimate = `$${(tokenCount * 0.00001).toFixed(2)}`;

  // -- Header (bordered, visible, identity) --
  const header = React.createElement("tui-box", {
    borderStyle: "round", borderColor: colors.brand.primary, paddingX: 1, flexDirection: "column", width: width - 2,
  },
    React.createElement("tui-box", { flexDirection: "row", justifyContent: "space-between" },
      React.createElement("tui-text", { bold: true, color: colors.brand.primary }, "Chat Demo"),
      React.createElement("tui-text", { color: colors.text.secondary }, "demo-model"),
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
