import React from "react";
import { Box } from "../../components/core/Box.js";
import { Text } from "../../components/core/Text.js";
import { fmtNum as formatNumber } from "../../utils/format.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";

export interface StatusLineSegment {
  text: string;
  color?: string;
  bg?: string;
}

export interface StatusLineProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  brand?: string;
  model?: string;
  tokens?: number;
  turns?: number;
  extra?: Record<string, string | number>;
  backgroundColor?: string;
  segments?: StatusLineSegment[];
  renderSegment?: (segment: StatusLineSegment, index: number) => React.ReactNode;
  /** Default: "▶". */
  powerlineSeparator?: string;
}

const POWERLINE_SEPARATOR = "\u25B6"; // ▶

export const StatusLine = React.memo(function StatusLine(rawProps: StatusLineProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("StatusLine", rawProps);
  const { left, right, brand, model, tokens, turns, extra, backgroundColor = colors.surface.raised, segments, powerlineSeparator } = props;
  const separator = powerlineSeparator ?? POWERLINE_SEPARATOR;

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

  if (left !== undefined || right !== undefined) {
    return (
      <Box flexDirection="row" height={1} flexShrink={0} overflow="hidden" paddingX={1} backgroundColor={backgroundColor}>
        {left}
        <Box flex={1} />
        {right}
      </Box>
    );
  }

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
