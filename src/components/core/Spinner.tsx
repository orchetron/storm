import React, { useRef } from "react";
import type { StormTextStyleProps } from "../../styles/styleProps.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import { useImperativeAnimation } from "../../hooks/useImperativeAnimation.js";

export type SpinnerType =
  | "dots" | "line" | "arc" | "bounce" | "braille" | "storm" | "flywheel"
  | "clock" | "arrows" | "pulse" | "wave" | "moon" | "diamond" | "storm-logo";

export interface SpinnerProps extends StormTextStyleProps {
  /** Spinner animation style.
   *  @default personality.animation.spinnerType */
  type?: SpinnerType;
  /** Frame interval in milliseconds.
   *  @default personality-based (durationNormal / 2.5, min 40, fallback 80) */
  interval?: number;
  label?: string;
  labelColor?: string | number;
  /** When provided (0-100), shows a determinate progress indicator instead of spinning. */
  progress?: number;
  /** Custom renderer for each animation frame. */
  renderFrame?: (frame: string, index: number) => React.ReactNode;
  /** Custom renderer for the label text. */
  renderLabel?: (label: string) => React.ReactNode;
}

const STORM_FRAMES: string[] = [
  "░░░░░░░░",
  "▒░░░░░░░",
  "▓▒░░░░░░",
  "█▓▒░░░░░",
  "░█▓▒░░░░",
  "░░█▓▒░░░",
  "░░░█▓▒░░",
  "░░░░█▓▒░",
  "░░░░░█▓▒",
  "░░░░░░█▓",
  "░░░░░░░█",
  "░░░░░░█▓",
  "░░░░░█▓▒",
  "░░░░█▓▒░",
  "░░░█▓▒░░",
  "░░█▓▒░░░",
  "░█▓▒░░░░",
  "▓▒░░░░░░",
];

// Spinning wheel — uses box-drawing quarter arcs that rotate like a turbine
const FLYWHEEL_FRAMES: string[] = [
  "◐", "◓", "◑", "◒",
];

// Rotating diamond — single-char variant of the Storm logo.
const DIAMOND_FRAMES: string[] = ["◇", "◈", "◆", "◈", "◇", "◈", "◆", "◈"];

// Mini Storm logo spinner — 3-char wide, same block-density pulse as the full logo.
// Cycles density around the center ◆ mark like the logo rotation.
const STORM_LOGO_FRAMES: string[] = [
  "█◆█",
  "▓◆▓",
  "▒◆▒",
  "░◆░",
  "▒◆▒",
  "▓◆▓",
];

const CLOCK_FRAMES: string[] = ["◴", "◷", "◶", "◵"];
const ARROWS_FRAMES: string[] = ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"];
const PULSE_FRAMES: string[] = ["░", "▒", "▓", "█", "▓", "▒"];
const WAVE_FRAMES: string[] = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂", "▁"];
const MOON_FRAMES: string[] = ["◑", "◒", "◐", "◓"];

const FRAMES: Record<string, string[]> = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  arc: ["◜", "◠", "◝", "◞", "◡", "◟"],
  bounce: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"],
  braille: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
  flywheel: FLYWHEEL_FRAMES,
  storm: STORM_FRAMES,
  clock: CLOCK_FRAMES,
  arrows: ARROWS_FRAMES,
  pulse: PULSE_FRAMES,
  wave: WAVE_FRAMES,
  moon: MOON_FRAMES,
  diamond: DIAMOND_FRAMES,
  "storm-logo": STORM_LOGO_FRAMES,
};

export const Spinner = React.memo(function Spinner(rawProps: SpinnerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Spinner", rawProps);
  const personality = usePersonality();

  const {
    type = personality.animation.spinnerType as SpinnerType ?? "dots",
    color = colors.brand.primary,
    bold: boldProp,
    dim: dimProp,
    interval = personality.animation.durationNormal > 0 ? Math.max(40, personality.animation.durationNormal / 2.5) : 80,
    label,
    labelColor,
    progress,
  } = props;

  // Determinate mode: show progress percentage instead of spinner
  if (progress !== undefined) {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    const progressColor = clamped >= 100
      ? colors.success
      : clamped >= 50
        ? colors.brand.primary
        : colors.warning;
    return React.createElement(
      "tui-text",
      { color: progressColor, bold: true, ...(dimProp !== undefined ? { dim: dimProp } : {}) },
      `${clamped}%`,
      ...(label ? [React.createElement("tui-text", { key: "lbl", color: labelColor }, ` ${label}`)] : []),
    );
  }

  const frames = FRAMES[type] ?? FRAMES["dots"]!;
  const frameRef = useRef(0);

  const framesRef = useRef(frames);
  framesRef.current = frames;

  const typeRef = useRef(type);
  if (typeRef.current !== type) {
    typeRef.current = type;
    frameRef.current = 0;
  }

  const { textNodeRef: spinnerTextNodeRef } = useImperativeAnimation({
    intervalMs: interval,
    onTick: () => {
      if (spinnerTextNodeRef.current) {
        const f = framesRef.current;
        frameRef.current = (frameRef.current + 1) % f.length;
        spinnerTextNodeRef.current.text = f[frameRef.current]!;
      }
    },
  });

  // Use _textNodeRef to capture the text node reference
  // The host config will store the first text child's ref
  const currentFrame = frames[frameRef.current]!;
  const frameContent = props.renderFrame
    ? props.renderFrame(currentFrame, frameRef.current)
    : null;
  const labelContent = label
    ? (props.renderLabel
      ? props.renderLabel(label)
      : React.createElement("tui-text", { color: labelColor }, ` ${label}`))
    : null;

  if (props.renderFrame) {
    return React.createElement(
      "tui-box",
      { flexDirection: "row", height: 1 },
      frameContent,
      ...(labelContent ? [labelContent] : []),
    );
  }

  return React.createElement(
    "tui-box",
    { height: 1, flexDirection: "row" },
    React.createElement(
      "tui-text",
      { color, ...(boldProp !== undefined ? { bold: boldProp } : {}), ...(dimProp !== undefined ? { dim: dimProp } : {}), _textNodeRef: spinnerTextNodeRef },
      currentFrame,
      ...(labelContent ? [labelContent] : []),
    ),
  );
});
