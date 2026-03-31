/**
 * StatusLine — reusable bottom status bar.
 *
 * Supports two modes:
 * 1. **Custom layout** — pass `left` and/or `right` React nodes.
 * 2. **Built-in layout** — pass `brand`, `model`, `tokens`, `turns`, and
 *    optional `extra` key-value pairs.
 *
 * All text renders dim by default.
 *
 * @module
 */

import React from "react";
import { Box } from "../components/Box.js";
import { Text } from "../components/Text.js";
import { fmtNum as formatNumber } from "../utils/format.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

// ── Types ────────────────────────────────────────────────────────────

/** A single powerline segment with its own foreground/background colors. */
export interface StatusLineSegment {
  /** Text content of the segment. */
  text: string;
  /** Foreground color. */
  color?: string;
  /** Background color. */
  bg?: string;
}

export interface StatusLineProps {
  /** Left-side content (custom layout). */
  left?: React.ReactNode;
  /** Right-side content (custom layout). */
  right?: React.ReactNode;
  /** Brand name shown with lightning prefix. */
  brand?: string;
  /** Model display name. */
  model?: string;
  /** Token count. */
  tokens?: number;
  /** Turn count. */
  turns?: number;
  /** Arbitrary extra key-value pairs rendered on the right. */
  extra?: Record<string, string | number>;
  /** Background color for the status line (default: colors.surface.raised). */
  backgroundColor?: string;
  /** Powerline-style segments — alternative to left/right/brand/model layout. */
  segments?: StatusLineSegment[];
  /** Custom render for each powerline segment. */
  renderSegment?: (segment: StatusLineSegment, index: number) => React.ReactNode;
  /** Override the powerline separator character (default: "▶"). */
  powerlineSeparator?: string;
}

// ── Component ────────────────────────────────────────────────────────

const POWERLINE_SEPARATOR = "\u25B6"; // ▶

export const StatusLine = React.memo(function StatusLine(rawProps: StatusLineProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("StatusLine", rawProps as unknown as Record<string, unknown>) as unknown as StatusLineProps;
  const { left, right, brand, model, tokens, turns, extra, backgroundColor = colors.surface.raised, segments, powerlineSeparator } = props;
  const separator = powerlineSeparator ?? POWERLINE_SEPARATOR;

  // Powerline segments mode
  if (segments !== undefined && segments.length > 0) {
    const segElements: React.ReactElement[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const nextBg = i < segments.length - 1 ? segments[i + 1]!.bg : undefined;

      if (props.renderSegment) {
        segElements.push(
          <Box key={`seg-${i}`}>{props.renderSegment(seg, i)}</Box>,
        );
      } else {
        // Segment text
        segElements.push(
          <Text
            key={`seg-${i}`}
            bold
            wrap="truncate"
            {...(seg.color ? { color: seg.color } : {})}
            {...(seg.bg ? { backgroundColor: seg.bg } : {})}
          >
            {` ${seg.text} `}
          </Text>,
        );
      }

      // Powerline separator between segments
      if (i < segments.length - 1) {
        segElements.push(
          <Text
            key={`sep-${i}`}
            {...(seg.bg ? { color: seg.bg } : {})}
            {...(nextBg ? { backgroundColor: nextBg } : {})}
          >
            {separator}
          </Text>,
        );
      }
    }

    return (
      <Box flexDirection="row" height={1} flexShrink={0} overflow="hidden">
        {segElements}
      </Box>
    );
  }

  // Custom layout mode
  if (left !== undefined || right !== undefined) {
    return (
      <Box flexDirection="row" height={1} flexShrink={0} overflow="hidden" paddingX={1} backgroundColor={backgroundColor}>
        {left}
        <Box flex={1} />
        {right}
      </Box>
    );
  }

  // Built-in layout mode
  const rightParts: React.ReactElement[] = [];

  if (tokens !== undefined) {
    rightParts.push(<Text key="tok" dim>tokens:{formatNumber(tokens)}</Text>);
  }
  if (turns !== undefined) {
    rightParts.push(<Text key="turns" dim>  turns:{turns}</Text>);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const display = typeof v === "number" ? formatNumber(v) : v;
      rightParts.push(<Text key={k} dim>  {k}:{display}</Text>);
    }
  }

  return (
    <Box flexDirection="row" height={1} flexShrink={0} overflow="hidden" paddingX={1} backgroundColor={backgroundColor}>
      {brand !== undefined && <Text bold color={colors.brand.primary}>{"\u26A1 "}{brand}</Text>}
      {model !== undefined && <Text dim> {model}</Text>}
      <Box flex={1} />
      {rightParts}
    </Box>
  );
});
