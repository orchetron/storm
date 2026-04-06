import { colors } from "../theme/colors.js";

const RST = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";
const INVERSE = "\x1b[7m";
const INTENSITY_OFF = "\x1b[22m";
const ITALIC_OFF = "\x1b[23m";
const INVERSE_OFF = "\x1b[27m";

function hexToAnsi(hex: string, bg = false): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[${bg ? 48 : 38};2;${r};${g};${b}m`;
}

function fg(hex: string): string {
  return hexToAnsi(hex);
}

function bgAnsi(hex: string): string {
  return hexToAnsi(hex, true);
}

export function abbreviateNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}

interface OpNodeLike {
  readonly id: string;
  readonly label: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "cancelled";
  readonly children: readonly string[];
  readonly detail?: string;
  readonly durationMs?: number;
}

const STATUS_ICONS: Record<string, string> = {
  pending: "\u25CB",      // ○
  running: "\u25CF",      // ●
  completed: "\u2713",    // ✓
  failed: "\u2717",       // ✗
  cancelled: "\u2298",    // ⊘
};

const STATUS_COLORS: Record<string, string> = {
  pending: colors.tool.pending,
  running: colors.tool.running,
  completed: colors.tool.completed,
  failed: colors.tool.failed,
  cancelled: colors.tool.cancelled,
};

function renderOpNodeToAnsi(
  nodes: ReadonlyMap<string, OpNodeLike>,
  id: string,
  depth: number,
  parentPrefix: string,
  isLast: boolean,
  isRoot: boolean,
): string {
  const node = nodes.get(id);
  if (!node) return "";

  let out = "";
  const connector = isRoot && nodes.size <= 1 ? "" : isLast ? "\u2514\u2500 " : "\u251C\u2500 ";
  const childPrefixAdd = isRoot && nodes.size <= 1 ? "" : isLast ? "   " : "\u2502  ";
  const prefix = parentPrefix + connector;
  const childPrefix = parentPrefix + childPrefixAdd;

  // Status icon
  const icon = STATUS_ICONS[node.status] ?? "\u25CB";
  const iconColor = STATUS_COLORS[node.status] ?? colors.text.dim;

  out += `${prefix}${fg(iconColor)}${icon}${RST} ${fg(colors.text.primary)}${node.label}${RST}`;

  // Detail
  if (node.detail) {
    out += ` ${DIM}${node.detail}${INTENSITY_OFF}`;
  }

  // Duration
  if (node.durationMs !== undefined) {
    const formatted = node.durationMs >= 1000
      ? `${(node.durationMs / 1000).toFixed(1)}s`
      : `${node.durationMs}ms`;
    out += ` ${DIM}${fg(colors.brand.light)}(${formatted})${RST}`;
  }

  out += "\n";

  // Children
  for (let i = 0; i < node.children.length; i++) {
    const childId = node.children[i]!;
    const childIsLast = i === node.children.length - 1;
    out += renderOpNodeToAnsi(nodes, childId, depth + 1, childPrefix, childIsLast, false);
  }

  return out;
}

export function renderOpTreeToAnsi(
  nodes: ReadonlyMap<string, OpNodeLike>,
  rootIds: readonly string[],
): string {
  if (rootIds.length === 0) return "";

  // Only show the last turn's tree root (same behavior as OpTreeView)
  const lastRootId = rootIds[rootIds.length - 1];
  if (!lastRootId) return "";

  return renderOpNodeToAnsi(nodes, lastRootId, 0, " ", true, true);
}

function markdownToAnsi(text: string): string {
  // Code blocks: ```...```
  let out = text.replace(/```\w*\n([\s\S]*?)```/g, (_match, code: string) => {
    const lines = (code as string).split("\n");
    return lines.map((l) => `  ${DIM}${l}${INTENSITY_OFF}`).join("\n");
  });

  // Headings: # text
  out = out.replace(/^(#{1,3})\s+(.+)$/gm, (_match, hashes: string, content: string) => {
    const color = hashes.length === 1 ? colors.brand.primary : colors.brand.light;
    return `${BOLD}${fg(color)}${content}${RST}`;
  });

  // Bold+italic: ***text***
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, `${BOLD}${ITALIC}$1${RST}`);

  // Bold: **text** or __text__
  out = out.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${INTENSITY_OFF}`);
  out = out.replace(/__(.+?)__/g, `${BOLD}$1${INTENSITY_OFF}`);

  // Italic: *text* or _text_ (careful not to match mid-word underscores)
  out = out.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, `${ITALIC}$1${ITALIC_OFF}`);
  out = out.replace(/(?<!\w)_(.+?)_(?!\w)/g, `${ITALIC}$1${ITALIC_OFF}`);

  // Inline code: `text`
  out = out.replace(/`([^`]+)`/g, `${INVERSE} $1 ${INVERSE_OFF}`);

  // Unordered list items
  out = out.replace(/^[\-\*]\s+(.+)$/gm, `  \u2022 $1`);

  // Ordered list items
  out = out.replace(/^(\d+)\.\s+(.+)$/gm, `  $1. $2`);

  // Blockquotes
  out = out.replace(/^>\s?(.*)$/gm, `  ${DIM}\u2502 $1${INTENSITY_OFF}`);

  // Horizontal rules
  out = out.replace(/^(?:---+|\*\*\*+|___+)\s*$/gm, `${DIM}${"─".repeat(40)}${INTENSITY_OFF}`);

  return out;
}

interface DiffLike {
  readonly path: string;
  readonly lines: string;
}

function renderDiffToAnsi(diff: DiffLike): string {
  let out = "";
  for (const line of diff.lines.split("\n")) {
    if (line.startsWith("  +")) {
      out += `${fg(colors.diff.added)}${DIM}${line}${RST}\n`;
    } else if (line.startsWith("  -")) {
      out += `${fg(colors.diff.removed)}${DIM}${line}${RST}\n`;
    } else {
      out += `${fg(colors.warning)}${line}${RST}\n`;
    }
  }
  return out;
}

export interface CommittableTurn {
  readonly userText: string;
  readonly ops: ReadonlyMap<string, OpNodeLike>;
  readonly opRootIds: readonly string[];
  readonly diffs: readonly DiffLike[];
  readonly assistantText: string;
  readonly tokens: number;
  readonly durationMs: number;
  readonly toolCount: number;
  readonly status: "streaming" | "completed" | "failed" | "cancelled";
}

export function renderTurnToAnsi(turn: CommittableTurn): string {
  let out = "";

  // User message
  out += ` ${BOLD}${fg(colors.user.symbol)}\u276F ${RST}${turn.userText}\n`;

  // Op tree (if any)
  if (turn.opRootIds.length > 0) {
    out += renderOpTreeToAnsi(turn.ops, turn.opRootIds);
  }

  // Diffs
  for (const diff of turn.diffs) {
    out += renderDiffToAnsi(diff);
  }

  // Assistant response
  if (turn.assistantText) {
    const isError = turn.status === "failed" || turn.assistantText.startsWith("[Error]");
    const timingParts: string[] = [formatDuration(turn.durationMs), `${abbreviateNumber(turn.tokens)} tokens`];
    if (turn.toolCount > 0) timingParts.push(`${turn.toolCount} tool${turn.toolCount === 1 ? "" : "s"}`);

    const symbolColor = isError ? colors.error : colors.assistant.symbol;
    const symbol = isError ? "\u2717" : "\u25C6";

    out += ` ${fg(symbolColor)}${symbol}${RST} ${DIM}${timingParts.join(" \u2502 ")}${RST}\n`;
    out += `   ${markdownToAnsi(turn.assistantText).split("\n").join("\n   ")}\n`;
  }

  // Turn separator
  out += ` ${fg(colors.divider)}\u00B7 \u00B7 \u00B7${RST}\n`;

  return out;
}

export interface CommittableNotice {
  readonly text: string;
  readonly style?: "default" | "timing" | "diff";
}

export function renderNoticeToAnsi(notice: CommittableNotice): string {
  if (notice.style === "diff") {
    let out = "";
    for (const line of notice.text.split("\n")) {
      if (line.startsWith("  +")) {
        out += ` ${fg(colors.diff.added)}${line}${RST}\n`;
      } else if (line.startsWith("  -")) {
        out += ` ${fg(colors.diff.removed)}${line}${RST}\n`;
      } else {
        out += ` ${fg(colors.warning)}${line}${RST}\n`;
      }
    }
    return out;
  }
  if (notice.style === "timing") {
    return ` ${DIM}${ITALIC}   ${notice.text}${RST}\n`;
  }
  return ` ${DIM}${ITALIC}\u2500\u2500 ${notice.text} \u2500\u2500${RST}\n`;
}

export function renderWelcomeBannerToAnsi(appName: string, modelStr: string, autonomy: string, cwd: string): string {
  let out = "";
  out += ` ${BOLD}${fg(colors.brand.primary)}${appName}${RST}\n`;
  out += ` ${fg(colors.text.secondary)}${modelStr} \u00B7 ${autonomy}${RST}\n`;
  out += ` ${fg(colors.text.dim)}${cwd}${RST}\n`;
  out += ` ${fg(colors.text.dim)}/help for commands${RST}\n`;
  out += "\n";
  return out;
}
