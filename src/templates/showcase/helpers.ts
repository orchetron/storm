import React from "react";
import { useColors } from "../../hooks/useColors.js";

export function heading(label: string, key: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", {
    key, bold: true, color: colors.brand.primary,
  }, `  ${label}`);
}

export function blank(key: string): React.ReactElement {
  return React.createElement("tui-text", { key }, "");
}
