/**
 * TokenStream — display widget for token metrics visualization.
 *
 * This is a display/presentation widget, NOT an actual stream processor.
 * It renders a compact status line showing model, token counts (input/output),
 * tokens-per-second speed, and a progress bar when maxTokens is known.
 * Feed it updated props from your streaming logic.
 *
 * @module
 */

import React, { useRef } from "react";
import { useColors } from "../hooks/useColors.js";
import { fmtNum } from "../utils/format.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Types ────────────────────────────────────────────────────────────

export interface TokenStreamProps {
  /** Total tokens so far. */
  tokens: number;
  /** Input/prompt tokens. */
  inputTokens?: number;
  /** Output/completion tokens. */
  outputTokens?: number;
  /** Current speed in tokens per second. */
  tokensPerSecond?: number;
  /** Context window limit. */
  maxTokens?: number;
  /** Model name. */
  model?: string;
  /** Whether currently streaming. */
  streaming?: boolean;
  /** Override color. */
  color?: string | number;
  /** Custom render for a metric (label + value pair). */
  renderMetric?: (label: string, value: string | number) => React.ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildProgressBar(ratio: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

// ── Component ────────────────────────────────────────────────────────

export const TokenStream = React.memo(function TokenStream(rawProps: TokenStreamProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("TokenStream", rawProps as unknown as Record<string, unknown>) as unknown as TokenStreamProps;
  const {
    tokens,
    inputTokens,
    outputTokens,
    tokensPerSecond,
    maxTokens,
    model,
    streaming,
    color,
  } = props;

  const parts: React.ReactElement[] = [];

  // Model name (dim)
  if (model !== undefined) {
    if (props.renderMetric) {
      parts.push(React.createElement(React.Fragment, { key: "model" }, props.renderMetric("model", model)));
    } else {
      parts.push(
        React.createElement(
          "tui-text",
          { key: "model", dim: true, color: color ?? colors.text.dim },
          model,
        ),
      );
    }
    parts.push(
      React.createElement("tui-text", { key: "sep1", dim: true }, " \u00B7 "),
    );
  }

  // Token counts (primary color)
  let countStr = `${fmtNum(tokens)} tokens`;
  if (inputTokens !== undefined && outputTokens !== undefined) {
    countStr += ` (${fmtNum(inputTokens)} in / ${fmtNum(outputTokens)} out)`;
  } else if (inputTokens !== undefined) {
    countStr += ` (${fmtNum(inputTokens)} in)`;
  } else if (outputTokens !== undefined) {
    countStr += ` (${fmtNum(outputTokens)} out)`;
  }

  parts.push(
    React.createElement(
      "tui-text",
      { key: "counts", color: color ?? colors.text.primary },
      countStr,
    ),
  );

  // Speed (only when streaming)
  if (streaming && tokensPerSecond !== undefined) {
    const speedColor = tokensPerSecond >= 30 ? colors.success : colors.warning;
    parts.push(
      React.createElement("tui-text", { key: "sep2", dim: true }, " \u00B7 "),
    );
    parts.push(
      React.createElement(
        "tui-text",
        { key: "speed", color: speedColor },
        `${Math.round(tokensPerSecond)} tok/s`,
      ),
    );
  }

  // Progress bar (when maxTokens provided)
  if (maxTokens !== undefined && maxTokens > 0) {
    const ratio = tokens / maxTokens;
    const pct = Math.min(100, Math.round(ratio * 100));
    const bar = buildProgressBar(ratio, 8);

    const barColor = ratio > 0.9 ? colors.error : ratio > 0.7 ? colors.warning : colors.success;

    parts.push(
      React.createElement("tui-text", { key: "sep3", dim: true }, " \u00B7 "),
    );
    parts.push(
      React.createElement(
        "tui-text",
        { key: "bar", color: barColor },
        bar,
      ),
    );
    parts.push(
      React.createElement(
        "tui-text",
        { key: "pct", dim: true },
        ` ${pct}%`,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    ...parts,
  );
});
