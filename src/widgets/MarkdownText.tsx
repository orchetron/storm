/**
 * MarkdownText — renders markdown to styled TUI elements.
 *
 * Pure regex-based parser with no external dependencies.
 * Supports headings, bold, italic, inline code, code blocks,
 * lists, blockquotes, links, and horizontal rules.
 */

import React, { useRef } from "react";
import { Box } from "../components/Box.js";
import { Text } from "../components/Text.js";
import { SyntaxHighlight } from "./SyntaxHighlight.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";
import type { StormColors } from "../theme/colors.js";

export interface MarkdownTextProps {
  children: string;
  width?: number;
}

// ── Inline formatting parser ─────────────────────────────────────────

interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  dim?: boolean;
  link?: string;
}

/**
 * Parses inline markdown formatting into a list of spans.
 * Handles bold, italic, inline code, and links. Supports nesting.
 */
function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];

  // Regex captures: inline code, link, strikethrough, bold+italic (***), bold (**/__), italic (*/_)
  const inlineRegex =
    /(`[^`]+`)|(\[([^\]]*)\]\(([^)]*)\))|(~~)(.+?)\5|(\*\*\*|___)(.+?)\7|(\*\*|__)(.+?)\9|(\*|_)(.+?)\11/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push plain text before this match
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index) });
    }

    const [full, inlineCode, _linkFull, linkText, linkUrl, _st1, strikeContent, _bi1, biContent, _b1, boldContent, _i1, italicContent] = match;

    if (inlineCode !== undefined) {
      // Strip backticks
      spans.push({ text: inlineCode.slice(1, -1), code: true });
    } else if (linkText !== undefined && linkUrl !== undefined) {
      spans.push({ text: linkText, link: linkUrl });
    } else if (strikeContent !== undefined) {
      spans.push({ text: strikeContent, dim: true });
    } else if (biContent !== undefined) {
      spans.push({ text: biContent, bold: true, italic: true });
    } else if (boldContent !== undefined) {
      spans.push({ text: boldContent, bold: true });
    } else if (italicContent !== undefined) {
      spans.push({ text: italicContent, italic: true });
    } else {
      spans.push({ text: full });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex) });
  }

  return spans;
}

function renderInlineSpans(spans: InlineSpan[], colors: StormColors, linkColor?: string, codeBg?: string): React.ReactElement[] {
  return spans.map((span, i) => {
    if (span.code) {
      return React.createElement(Text, { key: i, inverse: true, dim: true }, ` ${span.text} `);
    }
    if (span.link !== undefined) {
      return React.createElement(Text, { key: i, color: linkColor ?? colors.info, underline: true }, span.text);
    }

    const props: Record<string, unknown> = { key: i };
    if (span.bold) props["bold"] = true;
    if (span.italic) props["italic"] = true;
    if (span.dim) props["dim"] = true;

    return React.createElement(Text, props, span.text);
  });
}

function renderInline(text: string, colors: StormColors): React.ReactElement {
  const spans = parseInline(text);
  const children = renderInlineSpans(spans, colors);
  return React.createElement(Text, null, ...children);
}

// ── Block-level parser ───────────────────────────────────────────────

type TableAlignment = "left" | "center" | "right";

type Block =
  | { type: "heading"; level: number; content: string }
  | { type: "code"; language: string; content: string }
  | { type: "blockquote"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "table"; headers: string[]; alignments: TableAlignment[]; rows: string[][] }
  | { type: "paragraph"; content: string };

/** Split a pipe-delimited table row into cell strings. */
function parsePipeCells(line: string): string[] {
  // Remove leading/trailing pipe and split by pipe
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Code block (fenced)
    const codeMatch = /^```(\w*)/.exec(line);
    if (codeMatch) {
      const lang = codeMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const cl = lines[i]!;
        if (/^```\s*$/.test(cl)) {
          i++;
          break;
        }
        codeLines.push(cl);
        i++;
      }
      blocks.push({ type: "code", language: lang, content: codeLines.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1]!.length,
        content: headingMatch[2]!,
      });
      i++;
      continue;
    }

    // Table: header row followed by separator row
    if (/^\|.+\|/.test(line) && i + 1 < lines.length && /^\|[\s:]*-+[\s:]*/.test(lines[i + 1]!)) {
      const headerCells = parsePipeCells(line);
      const sepLine = lines[i + 1]!;
      const alignments = parsePipeCells(sepLine).map((cell): TableAlignment => {
        const trimmed = cell.trim();
        const leftColon = trimmed.startsWith(":");
        const rightColon = trimmed.endsWith(":");
        if (leftColon && rightColon) return "center";
        if (rightColon) return "right";
        return "left";
      });
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i]!)) {
        rows.push(parsePipeCells(lines[i]!));
        i++;
      }
      blocks.push({ type: "table", headers: headerCells, alignments, rows });
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        quoteLines.push(lines[i]!.replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Unordered list
    if (/^[\-\*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[\-\*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect contiguous non-empty lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pl = lines[i]!;
      if (
        pl.trim() === "" ||
        /^#{1,6}\s/.test(pl) ||
        /^```/.test(pl) ||
        /^>\s?/.test(pl) ||
        /^[\-\*]\s+/.test(pl) ||
        /^\d+\.\s+/.test(pl) ||
        /^(?:---+|\*\*\*+|___+)\s*$/.test(pl) ||
        (/^\|.+\|/.test(pl) && i + 1 < lines.length && /^\|[\s:]*-+[\s:]*/.test(lines[i + 1]!))
      ) {
        break;
      }
      paraLines.push(pl);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

// ── Block renderers ──────────────────────────────────────────────────

function renderHeading(block: { level: number; content: string }, key: number, colors: StormColors, headingColor?: string): React.ReactElement {
  if (block.level === 1) {
    return React.createElement(Text, { key, bold: true, color: headingColor ?? colors.brand.primary }, block.content);
  }
  // level 2+
  return React.createElement(Text, { key, bold: true, color: colors.brand.light }, block.content);
}

function renderCodeBlock(
  block: { language: string; content: string },
  key: number,
  width: number | undefined,
): React.ReactElement {
  const codeBoxProps: Record<string, unknown> = {
    key,
    borderStyle: "single" as const,
    flexDirection: "column" as const,
    paddingX: 1,
  };
  if (width !== undefined) {
    codeBoxProps["width"] = width;
  }

  const children: React.ReactElement[] = [];

  if (block.language) {
    children.push(React.createElement(Text, { key: "lang", dim: true }, block.language));
  }

  children.push(
    React.createElement(SyntaxHighlight, {
      key: "code",
      code: block.content,
      language: block.language || "js",
    }),
  );

  return React.createElement(Box, codeBoxProps, ...children);
}

function renderBlockquote(block: { content: string }, key: number, colors: StormColors): React.ReactElement {
  const quoteLines = block.content.split("\n");
  const children = quoteLines.map((ql, i) =>
    React.createElement(
      Text,
      { key: i },
      React.createElement(Text, { dim: true }, "│ "),
      ...renderInlineSpans(parseInline(ql), colors),
    ),
  );
  return React.createElement(Box, { key, flexDirection: "column" as const, paddingLeft: 1 }, ...children);
}

function renderUnorderedList(block: { items: string[] }, key: number, colors: StormColors): React.ReactElement {
  const children = block.items.map((item, i) => {
    // Task list detection
    const uncheckedMatch = /^\[ \]\s*(.*)$/.exec(item);
    if (uncheckedMatch) {
      return React.createElement(
        Text,
        { key: i },
        React.createElement(Text, null, "  ☐ "),
        ...renderInlineSpans(parseInline(uncheckedMatch[1]!), colors),
      );
    }
    const checkedMatch = /^\[x\]\s*(.*)$/i.exec(item);
    if (checkedMatch) {
      return React.createElement(
        Text,
        { key: i },
        React.createElement(Text, null, "  ☑ "),
        ...renderInlineSpans(parseInline(checkedMatch[1]!), colors),
      );
    }
    return React.createElement(
      Text,
      { key: i },
      React.createElement(Text, null, "  • "),
      ...renderInlineSpans(parseInline(item), colors),
    );
  });
  return React.createElement(Box, { key, flexDirection: "column" as const }, ...children);
}

function renderOrderedList(block: { items: string[] }, key: number, colors: StormColors): React.ReactElement {
  const children = block.items.map((item, i) =>
    React.createElement(
      Text,
      { key: i },
      React.createElement(Text, null, `  ${i + 1}. `),
      ...renderInlineSpans(parseInline(item), colors),
    ),
  );
  return React.createElement(Box, { key, flexDirection: "column" as const }, ...children);
}

function renderTable(
  block: { headers: string[]; alignments: TableAlignment[]; rows: string[][] },
  key: number,
): React.ReactElement {
  const colCount = block.headers.length;

  // Calculate column widths from header and all row content
  const colWidths: number[] = block.headers.map((h) => h.length);
  for (const row of block.rows) {
    for (let c = 0; c < colCount; c++) {
      const cell = row[c] ?? "";
      colWidths[c] = Math.max(colWidths[c] ?? 0, cell.length);
    }
  }

  /** Pad a cell string to fit its column width, respecting alignment. */
  function padCell(text: string, colIdx: number): string {
    const w = colWidths[colIdx] ?? text.length;
    const alignment = block.alignments[colIdx] ?? "left";
    if (alignment === "right") return text.padStart(w);
    if (alignment === "center") {
      const total = w - text.length;
      const left = Math.floor(total / 2);
      const right = total - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    return text.padEnd(w);
  }

  /** Build a horizontal separator line with the given junction characters. */
  function separator(left: string, mid: string, right: string): string {
    const segments = colWidths.map((w) => "─".repeat(w + 2));
    return left + segments.join(mid) + right;
  }

  const lineElements: React.ReactElement[] = [];

  // Top border
  lineElements.push(
    React.createElement(Text, { key: "top", dim: true }, separator("┌", "┬", "┐")),
  );

  // Header row
  const headerParts: React.ReactElement[] = [
    React.createElement(Text, { key: "hl", dim: true }, "│"),
  ];
  block.headers.forEach((h, c) => {
    if (c > 0) {
      headerParts.push(React.createElement(Text, { key: `hd-${c}`, dim: true }, "│"));
    }
    headerParts.push(
      React.createElement(Text, { key: `hc-${c}`, bold: true }, ` ${padCell(h, c)} `),
    );
  });
  headerParts.push(React.createElement(Text, { key: "hr", dim: true }, "│"));
  lineElements.push(
    React.createElement(Text, { key: "header" }, ...headerParts),
  );

  // Header separator
  lineElements.push(
    React.createElement(Text, { key: "sep", dim: true }, separator("├", "┼", "┤")),
  );

  // Data rows
  for (let r = 0; r < block.rows.length; r++) {
    const row = block.rows[r]!;
    const rowParts: React.ReactElement[] = [
      React.createElement(Text, { key: "rl", dim: true }, "│"),
    ];
    block.headers.forEach((_, c) => {
      if (c > 0) {
        rowParts.push(React.createElement(Text, { key: `rd-${c}`, dim: true }, "│"));
      }
      const cell = row[c] ?? "";
      rowParts.push(
        React.createElement(Text, { key: `rc-${c}` }, ` ${padCell(cell, c)} `),
      );
    });
    rowParts.push(React.createElement(Text, { key: "rr", dim: true }, "│"));
    lineElements.push(
      React.createElement(Text, { key: `row-${r}` }, ...rowParts),
    );
  }

  // Bottom border
  lineElements.push(
    React.createElement(Text, { key: "bot", dim: true }, separator("└", "┴", "┘")),
  );

  return React.createElement(Box, { key, flexDirection: "column" as const }, ...lineElements);
}

function renderHr(key: number, width: number | undefined): React.ReactElement {
  const ruleWidth = width ?? 40;
  const rule = "─".repeat(ruleWidth);
  return React.createElement(Text, { key, dim: true }, rule);
}

function renderParagraph(block: { content: string }, key: number, colors: StormColors): React.ReactElement {
  const spans = parseInline(block.content);
  const children = renderInlineSpans(spans, colors);
  return React.createElement(Text, { key }, ...children);
}

// ── Main component ───────────────────────────────────────────────────

export const MarkdownText = React.memo(function MarkdownText(rawProps: MarkdownTextProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("MarkdownText", rawProps as unknown as Record<string, unknown>) as unknown as MarkdownTextProps;
  const { children: markdown, width } = props;

  const blocksCacheRef = useRef<{ md: string; blocks: Block[] } | null>(null);
  let blocks: Block[];
  if (blocksCacheRef.current?.md === markdown) {
    blocks = blocksCacheRef.current.blocks;
  } else {
    blocks = parseBlocks(markdown);
    blocksCacheRef.current = { md: markdown, blocks };
  }

  const elements = blocks.map((block, i) => {
    switch (block.type) {
      case "heading":
        return renderHeading(block, i, colors);
      case "code":
        return renderCodeBlock(block, i, width);
      case "blockquote":
        return renderBlockquote(block, i, colors);
      case "ul":
        return renderUnorderedList(block, i, colors);
      case "ol":
        return renderOrderedList(block, i, colors);
      case "table":
        return renderTable(block, i);
      case "hr":
        return renderHr(i, width);
      case "paragraph":
        return renderParagraph(block, i, colors);
    }
  });

  const boxProps: Record<string, unknown> = { flexDirection: "column" as const };
  if (width !== undefined) {
    boxProps["width"] = width;
  }

  return React.createElement(Box, boxProps, ...elements);
});
