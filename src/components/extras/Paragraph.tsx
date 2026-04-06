import React from "react";
import type { StormTextStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface ParagraphProps extends StormTextStyleProps {
  children: React.ReactNode;
  marginBottom?: number;
}

export const Paragraph = React.memo(function Paragraph(rawProps: ParagraphProps): React.ReactElement {
  const props = usePluginProps("Paragraph", rawProps);
  const { children, color, bold, dim, marginBottom = 1 } = props;
  const textProps: Record<string, unknown> = {};
  if (color !== undefined) textProps.color = color;
  if (bold !== undefined) textProps.bold = bold;
  if (dim !== undefined) textProps.dim = dim;

  return React.createElement("tui-box", { marginBottom },
    React.createElement("tui-text", textProps, children),
  );
});
