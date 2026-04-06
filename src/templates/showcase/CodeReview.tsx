import React, { useState, useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { Breadcrumb } from "../../components/extras/Breadcrumb.js";
import { Badge } from "../../components/extras/Badge.js";
import { Tag } from "../../components/extras/Tag.js";
import { Button } from "../../components/core/Button.js";
import { TextInput } from "../../components/core/TextInput.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { KeyboardHelp } from "../../components/extras/KeyboardHelp.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { colors as defaultColors } from "../../theme/colors.js";
import { useColors } from "../../hooks/useColors.js";

export interface CodeReviewProps {
  repoName?: string;
}

type FileStatus = "Modified" | "Added" | "Deleted";
interface FileEntry { name: string; status: FileStatus; language: string; lines: number }

const FILES: FileEntry[] = [
  { name: "src/buffer.ts", status: "Modified", language: "typescript", lines: 142 },
  { name: "src/diff.ts", status: "Modified", language: "typescript", lines: 98 },
  { name: "src/utils.ts", status: "Added", language: "typescript", lines: 56 },
  { name: "src/old.ts", status: "Deleted", language: "typescript", lines: 34 },
  { name: "src/render.ts", status: "Modified", language: "typescript", lines: 210 },
  { name: "README.md", status: "Modified", language: "markdown", lines: 88 },
];

const STATUS_DOT: Record<FileStatus, string> = { Added: "\u25CF", Deleted: "\u25CF", Modified: "\u25CF" };
const STATUS_CLR: Record<FileStatus, string> = { Added: defaultColors.success, Deleted: defaultColors.error, Modified: defaultColors.warning };
const BADGE_CLR: Record<FileStatus, string> = { Modified: defaultColors.warning, Added: defaultColors.success, Deleted: defaultColors.error };

const CODE_LINES = [
  "import { Buffer } from './buffer.js';",
  "import { DiffEngine } from './diff.js';",
  "",
  "export interface RenderOptions {",
  "  width: number;",
  "  height: number;",
  "+  colorMode: 'ansi256' | 'truecolor';",
  "+  debug?: boolean;",
  "}",
  "",
  "export class Renderer {",
  "  private buffer: Buffer;",
  "-  private engine: DiffEngine;",
  "+  private engine: DiffEngine | null;",
  "",
  "  constructor(opts: RenderOptions) {",
  "    this.buffer = new Buffer(opts.width, opts.height);",
  "-    this.engine = new DiffEngine();",
  "+    this.engine = opts.debug ? null : new DiffEngine();",
  "+    this.colorMode = opts.colorMode;",
  "  }",
  "",
  "  render(cells: Cell[]): string {",
  "    const diff = this.engine?.compute(cells);",
  "    if (!diff) return this.buffer.flush();",
  "+    // Apply incremental updates only",
  "+    for (const patch of diff.patches) {",
  "+      this.buffer.apply(patch);",
  "+    }",
  "    return this.buffer.toString();",
  "  }",
  "}",
];

const BUTTON_LABELS = ["Comment", "Approve", "Request Changes"] as const;
const BUTTON_COLORS = [defaultColors.brand.primary, defaultColors.diff.added, defaultColors.error] as const;

function paneLabel(idx: number): string {
  return idx === 0 ? "files" : idx === 1 ? "code" : "review";
}

export function CodeReview(props: CodeReviewProps): React.ReactElement {
  const colors = useColors();
  const { repoName = "storm" } = props;
  const { exit, flushSync } = useTui();
  const { width, height } = useTerminal();

  const [focusPane, setFocusPane] = useState(0);
  const [fileIndex, setFileIndex] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<string[]>(["Fix the null check", "Add tests for patch", "Looks good overall"]);
  const [buttonIndex, setButtonIndex] = useState(0);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);

  const stateRef = useRef({ focusPane, fileIndex, commentText, comments, buttonIndex });
  stateRef.current = { focusPane, fileIndex, commentText, comments, buttonIndex };

  const submitComment = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      flushSync(() => {
        setComments([...stateRef.current.comments, trimmed]);
        setCommentText("");
      });
    }
  };

  const triggerButton = (idx: number) => {
    if (idx === 0) {
      // Comment button — submit current comment text
      submitComment(stateRef.current.commentText);
    } else if (idx === 1) {
      // Approve
      flushSync(() => setReviewStatus("Approved"));
    } else {
      // Request Changes
      flushSync(() => setReviewStatus("Changes Requested"));
    }
  };

  useInput((ev) => {
    const s = stateRef.current;
    if (ev.char === "q") { exit(); return; }

    if (ev.key === "tab") {
      flushSync(() => setFocusPane((s.focusPane + 1) % 3));
      return;
    }

    if (s.focusPane === 0) {
      if (ev.key === "up") flushSync(() => setFileIndex(Math.max(0, s.fileIndex - 1)));
      else if (ev.key === "down") flushSync(() => setFileIndex(Math.min(FILES.length - 1, s.fileIndex + 1)));
    } else if (s.focusPane === 2) {
      // Review pane: Up/Down cycles buttons, Enter triggers focused button
      if (ev.key === "up") flushSync(() => setButtonIndex(Math.max(0, s.buttonIndex - 1)));
      else if (ev.key === "down") flushSync(() => setButtonIndex(Math.min(BUTTON_LABELS.length - 1, s.buttonIndex + 1)));
      else if (ev.key === "return") triggerButton(s.buttonIndex);
    }
    // Pane 1 (code view): Up/Down handled natively by ScrollView — no manual binding needed
  });

  const file = FILES[fileIndex]!;
  const addedCount = CODE_LINES.filter((l) => l.startsWith("+")).length;
  const removedCount = CODE_LINES.filter((l) => l.startsWith("-")).length;

  // --- Header row ---
  const header = React.createElement("tui-box", { key: "hdr", flexDirection: "row", marginBottom: 1 },
    React.createElement(Breadcrumb, { key: "bc", items: [repoName, "src", file.name.split("/").pop()!], activeColor: defaultColors.brand.primary }),
    React.createElement("tui-text", { key: "sp1" }, "  "),
    React.createElement(Badge, { key: "badge", label: file.status, color: BADGE_CLR[file.status] }),
    React.createElement("tui-text", { key: "sp2" }, "  "),
    React.createElement("tui-text", { key: "add", color: defaultColors.diff.added, bold: true }, `+${addedCount}`),
    React.createElement("tui-text", { key: "rm", color: defaultColors.diff.removed, bold: true }, ` -${removedCount}`),
    ...(reviewStatus ? [
      React.createElement("tui-text", { key: "sp3" }, "  "),
      React.createElement(Badge, { key: "status", label: reviewStatus, color: reviewStatus === "Approved" ? defaultColors.success : defaultColors.error }),
    ] : []),
  );

  // --- File tree (left panel) ---
  const fileEntries = FILES.map((f, i) => {
    const isSelected = i === fileIndex && focusPane === 0;
    return React.createElement("tui-box", { key: f.name, flexDirection: "row" },
      React.createElement("tui-text", { key: "dot", color: STATUS_CLR[f.status] }, ` ${STATUS_DOT[f.status]} `),
      React.createElement("tui-text", {
        key: "name", bold: isSelected, color: isSelected ? defaultColors.brand.primary : undefined,
      }, f.name),
    );
  });

  const treeWidth = Math.min(28, Math.floor(width * 0.3));

  const fileTree = React.createElement("tui-box", {
    key: "tree", width: treeWidth, borderStyle: "round",
    borderColor: focusPane === 0 ? defaultColors.brand.primary : undefined,
  },
    React.createElement("tui-text", { key: "title", bold: true, color: defaultColors.brand.primary }, " Changed Files"),
    ...fileEntries,
  );

  // --- Code view (right panel) — all lines inside a single ScrollView ---
  const codeContent = CODE_LINES.map((line, i) => {
    const lineNum = i + 1;
    const numStr = String(lineNum).padStart(3, " ");
    const isAdd = line.startsWith("+");
    const isRm = line.startsWith("-");
    const isDiff = isAdd || isRm;

    if (isDiff) {
      return React.createElement("tui-box", { key: `l${lineNum}`, flexDirection: "row" },
        React.createElement("tui-text", { key: "n", dim: true }, `${numStr} `),
        React.createElement("tui-text", {
          key: "c", color: isAdd ? defaultColors.diff.added : defaultColors.diff.removed, bold: true,
        }, line),
      );
    }
    return React.createElement("tui-box", { key: `l${lineNum}`, flexDirection: "row" },
      React.createElement("tui-text", { key: "n", dim: true }, `${numStr} `),
      React.createElement("tui-text", { key: "c" }, line),
    );
  });

  const codeView = React.createElement("tui-box", {
    key: "code", flex: 1, borderStyle: "round",
    borderColor: focusPane === 1 ? defaultColors.brand.primary : undefined, flexDirection: "column",
  },
    React.createElement("tui-box", { key: "info", flexDirection: "row" },
      React.createElement(Tag, { key: "lang", label: file.language, color: defaultColors.info }),
      React.createElement("tui-text", { key: "lc", dim: true }, `  ${file.lines} lines`),
    ),
    React.createElement(ScrollView, { key: "sv", flex: 1 }, ...codeContent),
  );

  const mainArea = React.createElement("tui-box", { key: "main", flexDirection: "row", flex: 1 },
    fileTree, codeView,
  );

  // --- Review area (bottom) — natural height, no fixed height ---
  const buttons = BUTTON_LABELS.map((label, i) =>
    React.createElement(React.Fragment, { key: `btn-${i}` },
      ...(i > 0 ? [React.createElement("tui-text", { key: `s${i}` }, " ")] : []),
      React.createElement(Button, {
        key: label,
        label,
        color: BUTTON_COLORS[i] ?? defaultColors.brand.primary,
        isFocused: focusPane === 2 && buttonIndex === i,
        onPress: () => triggerButton(i),
      }),
    ),
  );

  const reviewArea = React.createElement("tui-box", {
    key: "review", borderStyle: "round",
    borderColor: focusPane === 2 ? defaultColors.brand.primary : undefined, flexDirection: "column",
  },
    React.createElement("tui-box", { key: "rh", flexDirection: "row" },
      React.createElement("tui-text", { key: "rt", bold: true, color: defaultColors.brand.primary }, " Review Comment "),
      React.createElement(Badge, { key: "rb", label: `${comments.length} comments`, color: defaultColors.info }),
    ),
    React.createElement("tui-box", { key: "ri", flexDirection: "row" },
      React.createElement(TextInput, {
        key: "ti", value: commentText, focus: focusPane === 2,
        onChange: (v: string) => flushSync(() => setCommentText(v)),
        onSubmit: (val: string) => submitComment(val),
        placeholder: "Type a review comment...", flex: 1,
      }),
    ),
    React.createElement("tui-box", { key: "btns", flexDirection: "row" },
      ...buttons,
    ),
  );

  // --- Footer ---
  const helpBindings = [
    { key: "Tab", label: paneLabel((focusPane + 1) % 3) },
    ...(focusPane === 0 ? [{ key: "\u2191\u2193", label: "Select file" }] : []),
    ...(focusPane === 1 ? [{ key: "\u2191\u2193", label: "Scroll code" }] : []),
    ...(focusPane === 2 ? [{ key: "\u2191\u2193", label: "Cycle buttons" }, { key: "Enter", label: "Activate" }] : []),
    { key: "q", label: "Quit" },
  ];

  // --- Root: plain box anchored to terminal dimensions, no outer ScrollView ---
  return React.createElement("tui-box", { width, height, flexDirection: "column" },
    header, mainArea, reviewArea,
    React.createElement("tui-box", { key: "ftr", marginTop: 1 },
      React.createElement(KeyboardHelp, { bindings: helpBindings, keyColor: defaultColors.brand.primary }),
    ),
  );
}
