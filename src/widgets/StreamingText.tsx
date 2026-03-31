/**
 * StreamingText — live streaming text display.
 *
 * Renders text with an optional animated cursor (▊) at the end
 * when streaming is active. Both text animation and cursor blink
 * use imperative requestRender() — no React setState, no full repaints.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

export interface StreamingTextProps {
  text: string;
  color?: string | number;
  cursor?: boolean;
  streaming?: boolean;
  /** When true, reveal text character by character. */
  animate?: boolean;
  /** Characters revealed per tick when animate is true (default: 2). */
  speed?: number;
  /** Callback fired when all text has been revealed (animate mode). */
  onComplete?: () => void;
  /** Override the cursor character (default: "▊"). */
  cursorCharacter?: string;
  /** Override cursor blink interval in ms (default: 530). */
  cursorBlinkInterval?: number;
  /** Custom render for the cursor. Receives the cursor character and current visibility. */
  renderCursor?: (char: string, visible: boolean) => React.ReactNode;
}

const CURSOR_CHAR = "▊";
const DEFAULT_CURSOR_BLINK_INTERVAL = 530;
const ANIMATE_TICK_INTERVAL = 80;

export const StreamingText = React.memo(function StreamingText(rawProps: StreamingTextProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("StreamingText", rawProps as unknown as Record<string, unknown>) as unknown as StreamingTextProps;
  const personality = usePersonality();
  const { text, color, cursor = true, streaming, animate = false, speed = 2, onComplete, cursorCharacter, cursorBlinkInterval, renderCursor } = props;
  const effectiveCursorChar = cursorCharacter ?? CURSOR_CHAR;
  const effectiveBlinkInterval = cursorBlinkInterval ?? DEFAULT_CURSOR_BLINK_INTERVAL;
  const { requestRender } = useTui();

  // ── Refs ────────────────────────────────────────────────────────────
  const textNodeRef = useRef<any>(null);
  const cursorTextNodeRef = useRef<any>(null);
  const cursorVisibleRef = useRef(true);

  // ── Typing animation ───────────────────────────────────────────────
  // Start with 1 character (not 0) so the TEXT_NODE exists for _textNodeRef.
  // Empty strings cause React to skip creating the text node.
  const revealedRef = useRef(animate ? 1 : text.length);
  const animateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  if (!animate) {
    revealedRef.current = text.length;
  }

  if (animate && !animateTimerRef.current && revealedRef.current < text.length) {
    completeFiredRef.current = false;
    animateTimerRef.current = setInterval(() => {
      revealedRef.current = Math.min(revealedRef.current + speed, text.length);
      // Imperative text update — same pattern as the raw test that works.
      if (textNodeRef.current) {
        textNodeRef.current.text = text.slice(0, revealedRef.current);
      }
      requestRender();
      if (revealedRef.current >= text.length) {
        if (animateTimerRef.current) {
          clearInterval(animateTimerRef.current);
          animateTimerRef.current = null;
        }
        if (!completeFiredRef.current) {
          completeFiredRef.current = true;
          onCompleteRef.current?.();
        }
      }
    }, ANIMATE_TICK_INTERVAL);
  } else if (!animate && animateTimerRef.current) {
    clearInterval(animateTimerRef.current);
    animateTimerRef.current = null;
  }

  // Display text: start with 1 char minimum so text node exists
  const displayText = animate ? text.slice(0, revealedRef.current) : text;

  // ── Cursor blink ───────────────────────────────────────────────────
  const showCursor = cursor && streaming;
  const needsBlink = !!(cursor && streaming);

  const blinkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (needsBlink && !blinkTimerRef.current) {
    blinkTimerRef.current = setInterval(() => {
      if (!cursorTextNodeRef.current) return;
      cursorVisibleRef.current = !cursorVisibleRef.current;
      cursorTextNodeRef.current.text = cursorVisibleRef.current ? effectiveCursorChar : " ";
      requestRender();
    }, effectiveBlinkInterval);
  } else if (!needsBlink && blinkTimerRef.current) {
    clearInterval(blinkTimerRef.current);
    blinkTimerRef.current = null;
  }

  useCleanup(() => {
    if (blinkTimerRef.current) { clearInterval(blinkTimerRef.current); blinkTimerRef.current = null; }
    if (animateTimerRef.current) { clearInterval(animateTimerRef.current); animateTimerRef.current = null; }
  });

  // ── Render ─────────────────────────────────────────────────────────
  // Single tui-text with _textNodeRef — exact same structure as the
  // working raw test. No nesting, no wrapper elements.
  if (!showCursor) {
    return React.createElement(
      "tui-text",
      { ...(color ? { color } : {}), _textNodeRef: textNodeRef },
      displayText,
    );
  }

  // With cursor: text + cursor as siblings inside a parent tui-text.
  // Cursor uses its own _textNodeRef for imperative blink.
  if (renderCursor) {
    return React.createElement(
      "tui-text",
      null,
      React.createElement("tui-text", { key: "t", ...(color ? { color } : {}), _textNodeRef: textNodeRef }, displayText),
      React.createElement(React.Fragment, { key: "c" }, renderCursor(effectiveCursorChar, cursorVisibleRef.current)),
    );
  }

  return React.createElement(
    "tui-text",
    null,
    React.createElement("tui-text", { key: "t", ...(color ? { color } : {}), _textNodeRef: textNodeRef }, displayText),
    React.createElement("tui-text", { key: "c", color: colors.brand.primary, _textNodeRef: cursorTextNodeRef }, effectiveCursorChar),
  );
});
