import React from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { padCell } from "../../utils/format.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface MarkdownProps extends StormLayoutStyleProps {
  content: string;
  maxWidth?: number;
}

type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] }
  | { type: "bolditalic"; children: InlineToken[] }
  | { type: "strikethrough"; children: InlineToken[] }
  | { type: "code"; value: string }
  | { type: "link"; text: string; url: string }
  | { type: "image"; alt: string; url: string };

type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "codeblock"; language: string; content: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "hr" }
  | { type: "ulist"; items: ListNode[] }
  | { type: "olist"; items: ListNode[]; start: number }
  | { type: "table"; headers: string[]; alignments: ("left" | "center" | "right")[]; rows: string[][] };

interface ListNode {
  text: string;
  checked?: boolean | undefined;
  children: ListNode[];
  ordered: boolean;
  start: number;
}

function parseInline(src: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;

  function pushText(t: string): void {
    if (t.length === 0) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text") {
      last.value += t;
    } else {
      tokens.push({ type: "text", value: t });
    }
  }

  while (i < src.length) {
    // Image: ![alt](url)
    if (src[i] === "!" && src[i + 1] === "[") {
      const closeBracket = src.indexOf("]", i + 2);
      if (closeBracket !== -1 && src[closeBracket + 1] === "(") {
        const closeParen = src.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          const alt = src.slice(i + 2, closeBracket);
          const url = src.slice(closeBracket + 2, closeParen);
          tokens.push({ type: "image", alt, url });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Link: [text](url)
    if (src[i] === "[") {
      const closeBracket = src.indexOf("]", i + 1);
      if (closeBracket !== -1 && src[closeBracket + 1] === "(") {
        const closeParen = src.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          const text = src.slice(i + 1, closeBracket);
          const url = src.slice(closeBracket + 2, closeParen);
          tokens.push({ type: "link", text, url });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Inline code: `code`
    if (src[i] === "`") {
      const end = src.indexOf("`", i + 1);
      if (end !== -1) {
        tokens.push({ type: "code", value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Bold+Italic: ***text*** or ___text___
    if ((src[i] === "*" || src[i] === "_") && src[i + 1] === src[i] && src[i + 2] === src[i]) {
      const marker = src[i]!;
      const closer = src.indexOf(marker + marker + marker, i + 3);
      if (closer !== -1) {
        tokens.push({ type: "bolditalic", children: parseInline(src.slice(i + 3, closer)) });
        i = closer + 3;
        continue;
      }
    }

    // Bold: **text** or __text__
    if ((src[i] === "*" || src[i] === "_") && src[i + 1] === src[i]) {
      const marker = src[i]!;
      const closer = src.indexOf(marker + marker, i + 2);
      if (closer !== -1 && closer > i + 2) {
        tokens.push({ type: "bold", children: parseInline(src.slice(i + 2, closer)) });
        i = closer + 2;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (src[i] === "~" && src[i + 1] === "~") {
      const closer = src.indexOf("~~", i + 2);
      if (closer !== -1) {
        tokens.push({ type: "strikethrough", children: parseInline(src.slice(i + 2, closer)) });
        i = closer + 2;
        continue;
      }
    }

    // Italic: *text* or _text_
    if (src[i] === "*" || src[i] === "_") {
      const marker = src[i]!;
      const closer = src.indexOf(marker, i + 1);
      if (closer !== -1 && closer > i + 1) {
        tokens.push({ type: "italic", children: parseInline(src.slice(i + 1, closer)) });
        i = closer + 1;
        continue;
      }
    }

    // Escaped character
    if (src[i] === "\\" && i + 1 < src.length) {
      pushText(src[i + 1]!);
      i += 2;
      continue;
    }

    // Plain text
    pushText(src[i]!);
    i++;
  }

  return tokens;
}

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  function collectParagraph(): string {
    const parts: string[] = [];
    while (i < lines.length) {
      const line = lines[i]!;
      if (
        line.trim() === "" ||
        /^#{1,6}\s/.test(line) ||
        /^```/.test(line) ||
        /^>\s?/.test(line) ||
        /^---+$|^\*\*\*+$|^___+$/.test(line.trim()) ||
        /^\s*[-*+]\s/.test(line) ||
        /^\s*\d+\.\s/.test(line) ||
        /^\|.+\|/.test(line)
      ) {
        break;
      }
      parts.push(line);
      i++;
    }
    return parts.join(" ").trim();
  }

  function parseListItems(startIdx: number, baseIndent: number, ordered: boolean): { items: ListNode[]; endIdx: number } {
    const items: ListNode[] = [];
    let idx = startIdx;

    while (idx < lines.length) {
      const line = lines[idx]!;
      const trimmed = line.trimStart();
      const currentIndent = line.length - trimmed.length;

      if (trimmed === "") {
        idx++;
        continue;
      }

      const ulMatch = trimmed.match(/^[-*+]\s(.*)$/);
      const olMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      const isListItem = ordered ? olMatch : ulMatch;

      if (!isListItem || currentIndent < baseIndent) {
        break;
      }

      if (currentIndent > baseIndent) {
        // This is a nested item — parse as children of the last item
        if (items.length > 0) {
          const nestedOrdered = !!olMatch;
          const nested = parseListItems(idx, currentIndent, nestedOrdered);
          items[items.length - 1]!.children = nested.items;
          idx = nested.endIdx;
        } else {
          idx++;
        }
        continue;
      }

      let itemText: string;
      let start = 1;
      if (ordered && olMatch) {
        start = parseInt(olMatch[1]!, 10);
        itemText = olMatch[2]!;
      } else if (ulMatch) {
        itemText = ulMatch[1]!;
      } else {
        idx++;
        continue;
      }

      // Task list detection: - [ ] or - [x]
      let checked: boolean | undefined;
      const taskMatch = itemText.match(/^\[([ xX])\]\s(.*)$/);
      if (taskMatch) {
        checked = taskMatch[1] !== " ";
        itemText = taskMatch[2]!;
      }

      items.push({ text: itemText, checked, children: [], ordered, start });
      idx++;

      while (idx < lines.length) {
        const nextLine = lines[idx]!;
        const nextTrimmed = nextLine.trimStart();
        const nextIndent = nextLine.length - nextTrimmed.length;

        if (nextTrimmed === "") {
          idx++;
          continue;
        }

        if (nextIndent > baseIndent) {
          const nextUl = nextTrimmed.match(/^[-*+]\s/);
          const nextOl = nextTrimmed.match(/^\d+\.\s/);
          if (nextUl || nextOl) {
            const nestedOrdered = !!nextOl;
            const nested = parseListItems(idx, nextIndent, nestedOrdered);
            items[items.length - 1]!.children = nested.items;
            idx = nested.endIdx;
          } else {
            // Continuation line
            items[items.length - 1]!.text += " " + nextTrimmed;
            idx++;
          }
        } else {
          break;
        }
      }
    }

    return { items, endIdx: idx };
  }

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Empty line
    if (trimmed === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (/^```/.test(trimmed)) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "codeblock", language, content: codeLines.join("\n") });
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, text: headingMatch[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$|^___+$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!.trim())) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Table
    if (/^\|.+\|/.test(trimmed) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1]!.trim())) {
      const headerLine = trimmed;
      const separatorLine = lines[i + 1]!.trim();
      const headers = headerLine.split("|").slice(1, -1).map((c) => c.trim());
      const alignments = separatorLine
        .split("|")
        .slice(1, -1)
        .map((c): "left" | "center" | "right" => {
          const s = c.trim();
          if (s.startsWith(":") && s.endsWith(":")) return "center";
          if (s.endsWith(":")) return "right";
          return "left";
        });
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\|.+\|/.test(lines[i]!.trim())) {
        rows.push(
          lines[i]!
            .trim()
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim()),
        );
        i++;
      }
      blocks.push({ type: "table", headers, alignments, rows });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const baseIndent = line.length - line.trimStart().length;
      const result = parseListItems(i, baseIndent, false);
      blocks.push({ type: "ulist", items: result.items });
      i = result.endIdx;
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const baseIndent = line.length - line.trimStart().length;
      const startMatch = line.trimStart().match(/^(\d+)\./);
      const startNum = startMatch ? parseInt(startMatch[1]!, 10) : 1;
      const result = parseListItems(i, baseIndent, true);
      blocks.push({ type: "olist", items: result.items, start: startNum });
      i = result.endIdx;
      continue;
    }

    // Paragraph (fallback)
    const paraText = collectParagraph();
    if (paraText) {
      blocks.push({ type: "paragraph", text: paraText });
    }
  }

  return blocks;
}

interface InlineRenderContext {
  colors: ReturnType<typeof useColors>;
  personality: ReturnType<typeof usePersonality>;
}

function renderInlineTokens(tokens: InlineToken[], ctx: InlineRenderContext, keyPrefix: string): React.ReactNode[] {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case "text":
        return token.value;

      case "bold":
        return React.createElement(
          "tui-text",
          { key, bold: true },
          ...renderInlineTokens(token.children, ctx, key),
        );

      case "italic":
        return React.createElement(
          "tui-text",
          { key, italic: true },
          ...renderInlineTokens(token.children, ctx, key),
        );

      case "bolditalic":
        return React.createElement(
          "tui-text",
          { key, bold: true, italic: true },
          ...renderInlineTokens(token.children, ctx, key),
        );

      case "strikethrough":
        return React.createElement(
          "tui-text",
          { key, strikethrough: true, dim: true },
          ...renderInlineTokens(token.children, ctx, key),
        );

      case "code":
        return React.createElement(
          "tui-text",
          { key, color: ctx.colors.syntax.string, dim: true },
          "`" + token.value + "`",
        );

      case "link":
        return React.createElement(
          "tui-text",
          {
            key,
            color: ctx.personality.typography.linkColor,
            underline: ctx.personality.typography.linkUnderline,
            _linkUrl: token.url,
          },
          token.text,
        );

      case "image":
        return React.createElement(
          "tui-text",
          { key, color: ctx.colors.info, dim: true },
          `[Image: ${token.alt || token.url}]`,
        );

      default:
        return null;
    }
  });
}

function renderInlineText(text: string, ctx: InlineRenderContext, keyPrefix: string): React.ReactNode {
  const tokens = parseInline(text);
  if (tokens.length === 1 && tokens[0]!.type === "text") {
    return tokens[0]!.value;
  }
  return React.createElement(
    "tui-text",
    { key: keyPrefix },
    ...renderInlineTokens(tokens, ctx, keyPrefix),
  );
}

const BULLET_MARKERS = ["\u2022", "\u25E6", "\u25AA"]; // bullet, circle, square

function renderListItems(
  items: ListNode[],
  ctx: InlineRenderContext,
  depth: number,
  ordered: boolean,
  keyPrefix: string,
): React.ReactElement[] {
  if (depth > 10) return [];
  const elements: React.ReactElement[] = [];
  const indent = "  ".repeat(depth);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const key = `${keyPrefix}-${idx}`;

    let prefix: string;
    if (item.checked !== undefined) {
      prefix = `${indent}${item.checked ? "\u2611" : "\u2610"} `;
    } else if (ordered) {
      prefix = `${indent}${item.start + idx}. `;
    } else {
      prefix = `${indent}${BULLET_MARKERS[depth % BULLET_MARKERS.length]} `;
    }

    elements.push(
      React.createElement(
        "tui-box",
        { key, flexDirection: "row" },
        React.createElement(
          "tui-text",
          { color: ctx.colors.text.secondary },
          prefix,
        ),
        React.createElement(
          "tui-text",
          { color: ctx.colors.text.primary },
          ...renderInlineTokens(parseInline(item.text), ctx, key),
        ),
      ),
    );

    if (item.children.length > 0) {
      const childOrdered = item.children[0]?.ordered ?? false;
      elements.push(
        ...renderListItems(item.children, ctx, depth + 1, childOrdered, `${key}-c`),
      );
    }
  }

  return elements;
}

function renderTable(
  block: Extract<Block, { type: "table" }>,
  ctx: InlineRenderContext,
  key: string,
): React.ReactElement {
  const { headers, alignments, rows } = block;
  const colCount = headers.length;

  const colWidths: number[] = headers.map((h) => h.length);
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const cell = row[c] ?? "";
      if (cell.length > colWidths[c]!) colWidths[c] = cell.length;
    }
  }

  const lines: React.ReactElement[] = [];

  // Top border
  const topBorder = "\u250C" + colWidths.map((w) => "\u2500".repeat(w + 2)).join("\u252C") + "\u2510";
  lines.push(
    React.createElement("tui-text", { key: `${key}-tb`, color: ctx.colors.text.dim, dim: true }, topBorder),
  );

  // Header row
  const headerCells = headers.map((h, c) => padCell(h, colWidths[c]!, alignments[c] ?? "left"));
  const headerLine = "\u2502" + headerCells.map((c) => ` ${c} `).join("\u2502") + "\u2502";
  lines.push(
    React.createElement("tui-text", { key: `${key}-h`, color: ctx.colors.text.primary, bold: true }, headerLine),
  );

  // Separator
  const sepLine = "\u251C" + colWidths.map((w) => "\u2500".repeat(w + 2)).join("\u253C") + "\u2524";
  lines.push(
    React.createElement("tui-text", { key: `${key}-sep`, color: ctx.colors.text.dim, dim: true }, sepLine),
  );

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    const cells = headers.map((_, c) => padCell(row[c] ?? "", colWidths[c]!, alignments[c] ?? "left"));
    const rowLine = "\u2502" + cells.map((c) => ` ${c} `).join("\u2502") + "\u2502";
    lines.push(
      React.createElement("tui-text", { key: `${key}-r${r}`, color: ctx.colors.text.primary }, rowLine),
    );
  }

  // Bottom border
  const bottomBorder = "\u2514" + colWidths.map((w) => "\u2500".repeat(w + 2)).join("\u2534") + "\u2518";
  lines.push(
    React.createElement("tui-text", { key: `${key}-bb`, color: ctx.colors.text.dim, dim: true }, bottomBorder),
  );

  return React.createElement(
    "tui-box",
    { key, flexDirection: "column", marginY: 1 },
    ...lines,
  );
}

function renderBlock(block: Block, ctx: InlineRenderContext, key: string): React.ReactElement {
  switch (block.type) {
    case "heading": {
      // H1: BOLD UPPERCASE + brand color + underline bar
      // H2: Bold + primary
      // H3: Bold + secondary
      // H4-H6: dim + secondary
      const headingConfigs: Record<number, { color: string; bold: boolean; dim: boolean; transform: (s: string) => string; decoration: boolean }> = {
        1: { color: ctx.personality.typography.headingColor, bold: true, dim: false, transform: (s) => s.toUpperCase(), decoration: true },
        2: { color: ctx.colors.text.primary, bold: true, dim: false, transform: (s) => s, decoration: false },
        3: { color: ctx.colors.text.secondary, bold: true, dim: false, transform: (s) => s, decoration: false },
        4: { color: ctx.colors.text.secondary, bold: false, dim: true, transform: (s) => s, decoration: false },
        5: { color: ctx.colors.text.dim, bold: false, dim: true, transform: (s) => s, decoration: false },
        6: { color: ctx.colors.text.dim, bold: false, dim: true, transform: (s) => s, decoration: false },
      };

      const cfg = headingConfigs[block.level]!;
      const elements: React.ReactElement[] = [];

      elements.push(
        React.createElement(
          "tui-text",
          { key: `${key}-t`, color: cfg.color, bold: cfg.bold, ...(cfg.dim ? { dim: true } : {}) },
          cfg.transform(block.text),
        ),
      );

      if (cfg.decoration) {
        elements.push(
          React.createElement(
            "tui-text",
            { key: `${key}-d`, color: ctx.colors.text.dim, dim: true, wrap: "truncate" },
            "\u2500".repeat(200),
          ),
        );
      }

      return React.createElement(
        "tui-box",
        { key, flexDirection: "column", marginBottom: block.level <= 2 ? 1 : 0 },
        ...elements,
      );
    }

    case "paragraph": {
      return React.createElement(
        "tui-box",
        { key, marginBottom: 1 },
        React.createElement(
          "tui-text",
          { color: ctx.colors.text.primary },
          ...renderInlineTokens(parseInline(block.text), ctx, key),
        ),
      );
    }

    case "codeblock": {
      const label = block.language
        ? React.createElement(
            "tui-text",
            { key: `${key}-lang`, color: ctx.colors.text.secondary, dim: true },
            ` ${block.language} `,
          )
        : null;

      return React.createElement(
        "tui-box",
        {
          key,
          flexDirection: "column",
          borderStyle: "round",
          borderColor: ctx.colors.text.dim,
          borderDimColor: true,
          padding: 1,
          marginY: 1,
        },
        ...(label ? [label] : []),
        React.createElement(
          "tui-text",
          { color: ctx.colors.text.secondary },
          block.content,
        ),
      );
    }

    case "blockquote": {
      const inner = block.lines.join("\n");
      const innerBlocks = parseBlocks(inner);

      return React.createElement(
        "tui-box",
        {
          key,
          borderLeft: true,
          borderRight: false,
          borderTop: false,
          borderBottom: false,
          borderStyle: "bold",
          borderColor: ctx.colors.brand.primary,
          paddingLeft: 1,
          marginY: 1,
        },
        ...innerBlocks.map((b, idx) => renderBlock(b, ctx, `${key}-bq${idx}`)),
      );
    }

    case "hr": {
      return React.createElement(
        "tui-box",
        { key, height: 1, overflow: "hidden", flexShrink: 0, marginY: 1 },
        React.createElement(
          "tui-text",
          { color: ctx.colors.divider, dim: true, wrap: "truncate" },
          "\u2500".repeat(200),
        ),
      );
    }

    case "ulist": {
      return React.createElement(
        "tui-box",
        { key, flexDirection: "column", marginBottom: 1 },
        ...renderListItems(block.items, ctx, 0, false, key),
      );
    }

    case "olist": {
      return React.createElement(
        "tui-box",
        { key, flexDirection: "column", marginBottom: 1 },
        ...renderListItems(block.items, ctx, 0, true, key),
      );
    }

    case "table": {
      return renderTable(block, ctx, key);
    }

    default:
      return React.createElement("tui-text", { key }, "");
  }
}

export const Markdown = React.memo(function Markdown(rawProps: MarkdownProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Markdown", rawProps);
  const { content, maxWidth, ...layoutProps } = props;

  const ctx: InlineRenderContext = { colors, personality };
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  const children = blocks.map((block, idx) => renderBlock(block, ctx, `md-${idx}`));

  const outerProps: Record<string, unknown> = {
    flexDirection: "column",
    ...(maxWidth !== undefined ? { maxWidth } : {}),
    ...pickLayoutProps(layoutProps),
  };

  return React.createElement("tui-box", outerProps, ...children);
});
