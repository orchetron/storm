import React from "react";

export interface NewlineProps {
  count?: number;
}

export const Newline = React.memo(function Newline(props: NewlineProps): React.ReactElement {
  const count = props.count ?? 1;
  const lines: React.ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(React.createElement("tui-text", { key: i }, "\n"));
  }
  return React.createElement("tui-box", { flexDirection: "column" }, ...lines);
});
