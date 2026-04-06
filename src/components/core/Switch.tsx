import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useTui } from "../../context/TuiContext.js";
import type { KeyEvent } from "../../input/types.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { usePersonality } from "../../core/personality.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";
import { FOCUS_CHARS } from "../../utils/focus-chars.js";

export type SwitchSize = "sm" | "md" | "lg";

export interface SwitchProps extends StormLayoutStyleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  isFocused?: boolean;
  disabled?: boolean;
  /** Track size: sm (3-char), md (5-char, default), lg (7-char) */
  size?: SwitchSize;
  /** Custom render for the switch track visual. */
  renderTrack?: (state: { checked: boolean; disabled: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

const DOT = "\u25CF";   // ●
const TRACK = "\u2501";  // ━

export const Switch = React.memo(function Switch(rawProps: SwitchProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Switch", rawProps);
  const {
    checked,
    onChange,
    label,
    onLabel = "ON",
    offLabel = "OFF",
    color = colors.success,
    bold: boldProp,
    dim: dimProp,
    isFocused = true,
    disabled = false,
    size = "md",
  } = props;

  const { requestRender } = useTui();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const checkedRef = useRef(checked);
  checkedRef.current = checked;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Animation state: "idle" | "animating"
  const animatingRef = useRef(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = useCallback((event: KeyEvent) => {
    if (disabledRef.current) return;
    if (animatingRef.current) return;
    const cb = onChangeRef.current;
    if (!cb) return;
    if (event.key === "return" || event.char === " ") {
      // Start animation: show intermediate state for 50ms
      animatingRef.current = true;
      requestRender();
      animTimerRef.current = setTimeout(() => {
        animatingRef.current = false;
        animTimerRef.current = null;
        cb(!checkedRef.current);
        requestRender();
      }, 50);
    }
  }, [requestRender]);

  useCleanup(() => {
    if (animTimerRef.current !== null) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  });

  const hasHandler = onChange !== undefined;
  useInput(handleInput, { isActive: hasHandler && isFocused && !disabled });

  const trackLen = size === "sm" ? 1 : size === "lg" ? 5 : 3;
  const padLen = size === "sm" ? 1 : size === "lg" ? 3 : 2;
  const trackStr = TRACK.repeat(trackLen);
  const padStr = " ".repeat(padLen);

  let switchVisual: string;
  if (animatingRef.current) {
    // Intermediate animation frame: dot in the middle of the track
    const halfTrack = Math.floor(trackLen / 2);
    const leftTrack = TRACK.repeat(halfTrack);
    const rightTrack = TRACK.repeat(trackLen - halfTrack);
    const leftPad = " ".repeat(Math.floor(padLen / 2));
    const rightPad = " ".repeat(padLen - Math.floor(padLen / 2));
    switchVisual = `[${leftPad}${leftTrack}${DOT}${rightTrack}${rightPad}]`;
  } else if (checked) {
    switchVisual = `[${padStr}${trackStr}${DOT}]`;
  } else {
    switchVisual = `[${DOT}${trackStr}${padStr}]`;
  }

  const switchColor = disabled ? colors.text.disabled : checked ? color : colors.text.dim;
  const statusLabel = checked ? onLabel : offLabel;

  const children: React.ReactElement[] = [];

  // Focus indicator prefix — style from personality
  const focusChar = FOCUS_CHARS[personality.interaction.focusIndicator] ?? "> ";
  if (isFocused && !disabled) {
    children.push(
      React.createElement("tui-text", { key: "focus", bold: true, color: colors.brand.primary }, focusChar),
    );
  } else {
    children.push(
      React.createElement("tui-text", { key: "focus" }, " ".repeat(focusChar.length)),
    );
  }

  if (props.renderTrack) {
    children.push(
      React.createElement(React.Fragment, { key: "switch" }, props.renderTrack({ checked, disabled })),
    );
  } else {
    children.push(
      React.createElement(
        "tui-text",
        { key: "switch", color: switchColor, ...(disabled ? { dim: true } : {}) },
        switchVisual,
      ),
    );
  }

  children.push(
    React.createElement(
      "tui-text",
      {
        key: "status",
        ...(disabled ? { color: colors.text.disabled, dim: true } : checked ? { color: switchColor } : { dim: true }),
      },
      ` ${statusLabel}`,
    ),
  );

  if (label !== undefined) {
    children.push(
      React.createElement(
        "tui-text",
        { key: "label" },
        `  ${label}`,
      ),
    );
  }

  const outerBoxProps: Record<string, unknown> = {
    role: "switch",
    flexDirection: "row",
    "aria-label": props["aria-label"],
    ...pickLayoutProps(props),
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...children,
  );
});
