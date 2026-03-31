/**
 * InlineDiff — side-by-side single-line diff display.
 *
 * Shows before -> after of a single value change, with removed characters
 * rendered in red strikethrough and added characters in green bold.
 */

import React from "react";
import { Text } from "./Text.js";
import { Box } from "./Box.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Public types ─────────────────────────────────────────────────────

export interface InlineDiffProps {
  before: string;
  after: string;
  color?: string;
}

// ── Character-level LCS diff ─────────────────────────────────────────

interface DiffSegment {
  text: string;
  kind: "same" | "removed" | "added";
}

function computeCharDiff(before: string, after: string): DiffSegment[] {
  const m = before.length;
  const n = after.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (before[i - 1] === after[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to produce diff operations
  const ops: Array<{ kind: "same" | "removed" | "added"; char: string }> = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      ops.push({ kind: "same", char: before[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.push({ kind: "added", char: after[j - 1]! });
      j--;
    } else {
      ops.push({ kind: "removed", char: before[i - 1]! });
      i--;
    }
  }

  ops.reverse();

  // Merge consecutive ops of the same kind into segments
  const segments: DiffSegment[] = [];
  for (const op of ops) {
    const last = segments[segments.length - 1];
    if (last && last.kind === op.kind) {
      last.text += op.char;
    } else {
      segments.push({ text: op.char, kind: op.kind });
    }
  }

  return segments;
}

// ── Component ────────────────────────────────────────────────────────

export const InlineDiff = React.memo(function InlineDiff(rawProps: InlineDiffProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("InlineDiff", rawProps as unknown as Record<string, unknown>) as unknown as InlineDiffProps;
  const { before, after, color } = props;

  const segments = computeCharDiff(before, after);
  const parts: React.ReactElement[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    switch (seg.kind) {
      case "same":
        parts.push(
          React.createElement(Text, { key: i, ...(color ? { color } : {}) }, seg.text),
        );
        break;
      case "removed":
        parts.push(
          React.createElement(
            Text,
            { key: i, color: colors.diff.removed, strikethrough: true, dim: true },
            seg.text,
          ),
        );
        break;
      case "added":
        parts.push(
          React.createElement(
            Text,
            { key: i, color: colors.diff.added, bold: true },
            seg.text,
          ),
        );
        break;
    }
  }

  return React.createElement(Box, null, ...parts);
});
