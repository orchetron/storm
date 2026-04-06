import React from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormTextStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface KbdProps extends StormTextStyleProps {
  /** Key label, e.g. "Ctrl+C", "Enter", "Esc" */
  children: string;
}

export const Kbd = React.memo(function Kbd(rawProps: KbdProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Kbd", rawProps);
  const { children: label, color = colors.text.secondary, bold: boldProp, dim: dimProp } = props;

  const bracketDim = dimProp !== undefined ? dimProp : true;
  const labelBold = boldProp !== undefined ? boldProp : true;

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement(
      "tui-text",
      { color, dim: bracketDim },
      "[",
    ),
    React.createElement(
      "tui-text",
      { color, bold: labelBold, ...(dimProp !== undefined ? { dim: dimProp } : {}) },
      label,
    ),
    React.createElement(
      "tui-text",
      { color, dim: bracketDim },
      "]",
    ),
  );
});
