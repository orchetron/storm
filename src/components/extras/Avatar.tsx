import React from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormTextStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface AvatarProps extends StormTextStyleProps {
  name: string;
  size?: "small" | "large";
  /** Custom render for the initials display. */
  renderInitials?: (initials: string, size: string) => React.ReactNode;
}

export const Avatar = React.memo(function Avatar(rawProps: AvatarProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Avatar", rawProps);
  const {
    name,
    color = colors.brand.primary,
    bold: boldProp,
    dim,
    size = "small",
  } = props;

  // Two-letter initials: for names with spaces, use first letter of each word
  const words = name.trim().split(/\s+/);
  const initial = words.length >= 2
    ? (words[0]![0]!.toUpperCase() + words[1]![0]!.toUpperCase())
    : (name.length > 0 ? name[0]!.toUpperCase() : "?");

  if (props.renderInitials) {
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      props.renderInitials(initial, size),
    );
  }

  if (size === "small") {
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color, bold: boldProp !== undefined ? boldProp : true, ...(dim !== undefined ? { dim } : {}) },
        `(${initial})`,
      ),
    );
  }

  // Large: 3-line block with rounded corners
  //  ╭────╮
  //  │ JD │
  //  ╰────╯
  const innerWidth = Math.max(initial.length + 2, 3); // at least 3 chars inside
  const topLine = "\u256D" + "\u2500".repeat(innerWidth) + "\u256E";
  const padded = initial.length < innerWidth - 2
    ? " ".repeat(Math.floor((innerWidth - initial.length) / 2)) + initial + " ".repeat(Math.ceil((innerWidth - initial.length) / 2))
    : " " + initial + " ";
  const midLine = "\u2502" + padded + "\u2502";
  const botLine = "\u2570" + "\u2500".repeat(innerWidth) + "\u256F";

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    React.createElement("tui-text", { key: "top", color, ...(dim !== undefined ? { dim } : {}) }, topLine),
    React.createElement("tui-text", { key: "mid", color, bold: boldProp !== undefined ? boldProp : true, ...(dim !== undefined ? { dim } : {}) }, midLine),
    React.createElement("tui-text", { key: "bot", color, ...(dim !== undefined ? { dim } : {}) }, botLine),
  );
});
