import React from "react";
import * as path from "path";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { Image } from "../../components/effects/Image.js";
import { Markdown as MarkdownText } from "../../components/extras/Markdown.js";
import { SyntaxHighlight } from "../../widgets/dev/SyntaxHighlight.js";

export interface ShowcaseRichContentProps {
  title?: string;
  imagePath?: string;
}

const MARKDOWN = `# Storm TUI Framework

A terminal UI framework for building rich applications.

## Features

- **Components and widgets** for common UI patterns
- Pure TypeScript flexbox + CSS Grid
- Cell-based diff rendering with \`synchronized output\`
- 100 syntax highlighting languages

## Getting Started

Install the package:

\`\`\`typescript
import { render } from "@orchetron/storm";
import { Box, Text } from "@orchetron/storm/components";

render(
  React.createElement(Box, { borderStyle: "round" },
    React.createElement(Text, { bold: true }, "Hello Storm!")
  )
);
\`\`\`

> Storm provides components, layout, and rendering for terminal UIs.

---

Built with Storm.`;

const TS_CODE = `import React, { useState } from "react";
import { render } from "@orchetron/storm";
import { Box, Text, TextInput, ScrollView } from "@orchetron/storm/components";

interface Message {
  role: "user" | "assistant";
  text: string;
}

function ChatApp(): React.ReactElement {
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSubmit = (value: string) => {
    setMessages(prev => [...prev, { role: "user", text: value }]);
    setInput("");
    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: "Hello! How can I help?" },
      ]);
    }, 1000);
  };

  return React.createElement(Box, { flexDirection: "column", flex: 1 },
    React.createElement(ScrollView, { flex: 1, stickToBottom: true },
      ...messages.map((msg, i) =>
        React.createElement(Text, {
          key: i,
          color: msg.role === "user" ? "#D4A053" : "#6DBF8B",
        }, \`\${msg.role === "user" ? "▸" : "◆"} \${msg.text}\`)
      ),
    ),
    React.createElement(TextInput, {
      value: input,
      onChange: setInput,
      onSubmit: handleSubmit,
      placeholder: "Type a message...",
    }),
  );
}

render(React.createElement(ChatApp));`;

const PYTHON_CODE = `import asyncio
from dataclasses import dataclass
from typing import AsyncIterator

@dataclass
class TokenStream:
    """Streams tokens from an LLM with backpressure handling."""
    model: str
    max_tokens: int = 4096
    temperature: float = 0.7

    async def generate(self, prompt: str) -> AsyncIterator[str]:
        """Generate tokens one at a time."""
        async with self._create_session() as session:
            async for chunk in session.stream(prompt):
                yield chunk.text

    async def _create_session(self):
        """Create a new streaming session."""
        return await LLMClient.connect(
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
        )

async def main():
    stream = TokenStream(model="my-model")
    async for token in stream.generate("Explain quantum computing"):
        print(token, end="", flush=True)
    print()

if __name__ == "__main__":
    asyncio.run(main())`;

function heading(label: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", {
    key: `h-${label}`, bold: true, color: colors.brand.primary,
  }, `\n  ━━━ ${label} ━━━`);
}

function gap(): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", null, "");
}

export function ShowcaseRichContent(props: ShowcaseRichContentProps): React.ReactElement {
  const colors = useColors();
  const { title = "Rich Content", imagePath } = props;
  const { exit } = useTui();

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  return React.createElement(ScrollView, { flex: 1 },

    // Title
    React.createElement("tui-text", {
      key: "title", bold: true, color: colors.brand.light,
    }, `\n  === ${title} ===\n`),

    // 1. Images — PNG decoded and rendered with half-block characters
    heading("Image — Storm Banner"),
    gap(),
    React.createElement("tui-box", { key: "img-banner", marginLeft: 2 },
      React.createElement(Image, {
        src: imagePath ?? path.join(process.cwd(), "examples", "storm-banner.png"),
        alt: "Storm Banner",
        width: 60,
        height: 10,
        protocol: "block" as const,
      }),
    ),
    gap(),

    heading("Image — Colorful Bar Chart"),
    gap(),
    React.createElement("tui-box", { key: "img-chart", marginLeft: 2 },
      React.createElement(Image, {
        src: path.join(process.cwd(), "examples", "chart.png"),
        alt: "Bar Chart",
        width: 60,
        height: 12,
        protocol: "block" as const,
      }),
    ),
    gap(),

    heading("Image — Sunset Landscape"),
    gap(),
    React.createElement("tui-box", { key: "img-sunset", marginLeft: 2 },
      React.createElement(Image, {
        src: path.join(process.cwd(), "examples", "sunset.png"),
        alt: "Sunset",
        width: 60,
        height: 15,
        protocol: "block" as const,
      }),
    ),
    gap(),

    heading("Image — Mountain Scene"),
    gap(),
    React.createElement("tui-box", { key: "img-mountain", marginLeft: 2 },
      React.createElement(Image, {
        src: path.join(process.cwd(), "examples", "mountain.png"),
        alt: "Mountain",
        width: 60,
        height: 12,
        protocol: "block" as const,
      }),
    ),
    gap(),

    // 2. Markdown
    heading("MarkdownText"),
    gap(),
    React.createElement("tui-box", {
      key: "md-box", marginLeft: 2, marginRight: 2,
    },
      React.createElement(MarkdownText, null, MARKDOWN),
    ),
    gap(),

    // 3. TypeScript Code
    heading("SyntaxHighlight — TypeScript"),
    gap(),
    React.createElement("tui-box", {
      key: "ts-box", marginLeft: 2, marginRight: 2,
      borderStyle: "single", borderColor: colors.text.dim,
    },
      React.createElement(SyntaxHighlight, {
        code: TS_CODE, language: "typescript",
      }),
    ),
    gap(),

    // 4. Python Code
    heading("SyntaxHighlight — Python"),
    gap(),
    React.createElement("tui-box", {
      key: "py-box", marginLeft: 2, marginRight: 2,
      borderStyle: "single", borderColor: colors.text.dim,
    },
      React.createElement(SyntaxHighlight, {
        code: PYTHON_CODE, language: "python",
      }),
    ),
    gap(),

    // Footer
    React.createElement("tui-text", {
      key: "footer", dim: true,
    }, "  [q] Quit · [↑↓] Scroll · [PgUp/PgDn] Page"),
    gap(),
  );
}
