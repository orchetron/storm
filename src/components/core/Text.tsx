import React from "react";

export interface TextProps {
  children?: React.ReactNode;
  color?: string | number;
  bgColor?: string | number;
  /** Alias for `bgColor` — applies background color. */
  backgroundColor?: string | number;
  bold?: boolean;
  dim?: boolean;
  /** Alias for `dim` — applies dim attribute when true. */
  dimColor?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  wrap?: "wrap" | "truncate" | "truncate-start" | "truncate-end" | "truncate-middle";
  /** Text alignment — implemented via a wrapper box with justifyContent. */
  align?: "left" | "center" | "right";
  // Accessibility
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

const ALIGN_TO_JUSTIFY = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

export const Text = React.memo(function Text(props: TextProps): React.ReactElement {
  const { children, align, ...rest } = props;
  const textEl = React.createElement("tui-text", rest, children);

  if (align && align !== "left") {
    return React.createElement(
      "tui-box",
      { justifyContent: ALIGN_TO_JUSTIFY[align], width: "100%" },
      textEl,
    );
  }

  return textEl;
});
