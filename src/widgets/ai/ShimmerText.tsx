import React, { useRef } from "react";
import type { HostTextNode } from "../../reconciler/types.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import { useImperativeAnimation } from "../../hooks/useImperativeAnimation.js";

export interface ShimmerTextProps {
  text: string;
  baseColor?: string;
  shimmerColor?: string;
  interval?: number;
  bold?: boolean;
  /** When false, stop the animation and show static text (default true). */
  active?: boolean;
  /** Width of the shimmer highlight window (default 3) */
  shimmerWidth?: number;
  /** Custom render for each text segment */
  renderSegment?: (text: string, isShimmer: boolean) => React.ReactNode;
}

const DEFAULT_SHIMMER_WIDTH = 3;

export const ShimmerText = React.memo(function ShimmerText(rawProps: ShimmerTextProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ShimmerText", rawProps);
  const personality = usePersonality();
  const {
    text,
    baseColor = colors.thinking.symbol,
    shimmerColor = colors.thinking.shimmer,
    interval = personality.animation.durationFast,
    bold,
    active = true,
    shimmerWidth = DEFAULT_SHIMMER_WIDTH,
    renderSegment,
  } = props;

  const offsetRef = useRef(-shimmerWidth);
  const beforeRef = useRef<HostTextNode | null>(null);
  const shimmerRef = useRef<HostTextNode | null>(null);
  const afterRef = useRef<HostTextNode | null>(null);

  // Keep latest text value in ref for the interval callback
  const textRef = useRef(text);
  textRef.current = text;

  useImperativeAnimation({
    active,
    intervalMs: interval,
    onTick: () => {
      const t = textRef.current;
      const totalTravel = t.length + shimmerWidth * 2;
      if (totalTravel <= 0) return;
      offsetRef.current = ((offsetRef.current + shimmerWidth + 1) % totalTravel) - shimmerWidth;

      const pos = offsetRef.current;
      const start = Math.max(0, pos);
      const end = Math.min(t.length, pos + shimmerWidth);

      const beforeText = t.slice(0, start);
      const shimmerText = start < end ? t.slice(start, end) : "";
      const afterText = t.slice(end);

      if (beforeRef.current) {
        beforeRef.current.text = beforeText;
      }
      if (shimmerRef.current) {
        shimmerRef.current.text = shimmerText;
      }
      if (afterRef.current) {
        afterRef.current.text = afterText;
      }
    },
  });

  // When not active, show static text without shimmer
  if (!active) {
    return React.createElement(
      "tui-text",
      { color: baseColor, ...(bold ? { bold: true } : {}) },
      text,
    );
  }

  const pos = offsetRef.current;
  const start = Math.max(0, pos);
  const end = Math.min(text.length, pos + shimmerWidth);

  const beforeText = text.slice(0, start);
  const shimmerTextStr = start < end ? text.slice(start, end) : "";
  const afterText = text.slice(end);

  if (renderSegment) {
    return React.createElement(
      "tui-text",
      { ...(bold ? { bold: true } : {}) },
      React.createElement(React.Fragment, null, renderSegment(beforeText, false)),
      React.createElement(React.Fragment, null, renderSegment(shimmerTextStr, true)),
      React.createElement(React.Fragment, null, renderSegment(afterText, false)),
    );
  }

  return React.createElement(
    "tui-text",
    { ...(bold ? { bold: true } : {}) },
    React.createElement(
      "tui-text",
      { color: baseColor, _textNodeRef: beforeRef },
      beforeText,
    ),
    React.createElement(
      "tui-text",
      { color: shimmerColor, bold: true, _textNodeRef: shimmerRef },
      shimmerTextStr,
    ),
    React.createElement(
      "tui-text",
      { color: baseColor, _textNodeRef: afterRef },
      afterText,
    ),
  );
});
