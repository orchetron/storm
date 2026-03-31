/**
 * ShowcaseChat — "Chat & Content Widgets" showcase template.
 *
 * Demos: MarkdownText, SyntaxHighlight, ShimmerText, BlinkDot,
 * MessageBubble, StatusLine, CommandDropdown, AnimatedLogo,
 * ComponentGallery (text description only).
 */

import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { MarkdownText } from "../../widgets/MarkdownText.js";
import { SyntaxHighlight } from "../../widgets/SyntaxHighlight.js";
import { ShimmerText } from "../../widgets/ShimmerText.js";
import { BlinkDot } from "../../widgets/BlinkDot.js";
import { MessageBubble } from "../../widgets/MessageBubble.js";
import { StatusLine } from "../../widgets/StatusLine.js";
import { CommandDropdown } from "../../widgets/CommandDropdown.js";
import { AnimatedLogo } from "../../widgets/AnimatedLogo.js";
import { ScrollView } from "../../components/ScrollView.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import type { CommandItem } from "../../widgets/CommandDropdown.js";

export interface ShowcaseChatProps {
  title?: string;
}

function heading(label: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", { bold: true, color: colors.brand.primary }, `\n  ${label}`);
}

function gap(): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", null, "");
}

const MARKDOWN_CONTENT = "# Hello\nThis is **bold** and `code`\n- Item 1\n- Item 2";

const TS_CODE = "function greet(name: string) { return `Hello ${name}`; }";

const COMMANDS: readonly CommandItem[] = [
  { name: "/help", description: "Show help" },
  { name: "/clear", description: "Clear screen" },
  { name: "/model", description: "Switch model" },
  { name: "/quit", description: "Exit application" },
];

export function ShowcaseChat(props: ShowcaseChatProps): React.ReactElement {
  const colors = useColors();
  const { title = "Chat & Content Widgets" } = props;
  const { exit } = useTui();
  const { width } = useTerminal();

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  const header = React.createElement("tui-text", {
    bold: true, color: colors.brand.light,
  }, `  === ${title} ===`);

  // 1. MarkdownText
  const markdown = React.createElement(MarkdownText, null, MARKDOWN_CONTENT);

  // 2. SyntaxHighlight
  const syntaxHL = React.createElement(SyntaxHighlight, {
    code: TS_CODE, language: "typescript",
  });

  // 3. ShimmerText
  const shimmer = React.createElement(ShimmerText, { text: "Thinking..." });

  // 4. BlinkDot
  const blinkDot = React.createElement("tui-box", { flexDirection: "row", gap: 1 },
    React.createElement(BlinkDot, { state: "running" }),
    React.createElement("tui-text", { color: colors.text.secondary }, " Processing"),
  );

  // 5. MessageBubble
  const messageBubble = React.createElement(MessageBubble, {
    symbol: ">", symbolColor: colors.user.symbol,
    children: React.createElement("tui-text", null, "How do I use Storm TUI?"),
  });

  // 6. StatusLine
  const statusLine = React.createElement(StatusLine, {
    model: "command-r-plus", tokens: 1234,
  });

  // 7. CommandDropdown
  const dropdown = React.createElement(CommandDropdown, {
    items: COMMANDS, selectedIndex: 1,
  });

  // 8. AnimatedLogo
  const logo = React.createElement(AnimatedLogo, { animate: false });

  // 9. ComponentGallery — text description only
  const galleryNote = React.createElement("tui-text", {
    color: colors.text.secondary, italic: true,
  }, "  ComponentGallery: interactive split-pane catalog of all Storm components. Too complex to embed inline — run it standalone.");

  const footer = React.createElement("tui-text", { dim: true }, "  [q] Quit");

  return React.createElement(ScrollView, { flex: 1 },
    React.createElement("tui-box", {
      flexDirection: "column", width: width - 2,
    },
      header, gap(),
      heading("MarkdownText"), React.createElement("tui-box", { marginLeft: 2 }, markdown), gap(),
      heading("SyntaxHighlight"), React.createElement("tui-box", { marginLeft: 2 }, syntaxHL), gap(),
      heading("ShimmerText"), React.createElement("tui-box", { marginLeft: 2 }, shimmer), gap(),
      heading("BlinkDot"), React.createElement("tui-box", { marginLeft: 2 }, blinkDot), gap(),
      heading("MessageBubble"), React.createElement("tui-box", { marginLeft: 2 }, messageBubble), gap(),
      heading("StatusLine"), React.createElement("tui-box", { marginLeft: 2 }, statusLine), gap(),
      heading("CommandDropdown"), React.createElement("tui-box", { marginLeft: 2 }, dropdown), gap(),
      heading("AnimatedLogo (static)"), React.createElement("tui-box", { marginLeft: 2 }, logo), gap(),
      heading("ComponentGallery"), galleryNote, gap(),
      footer,
    ),
  );
}
