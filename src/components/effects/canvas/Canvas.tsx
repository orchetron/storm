import React from "react";
import { useColors } from "../../../hooks/useColors.js";
import type { CanvasProps } from "./types.js";
import { buildNodeIndex } from "./canvasUtils.js";
import { renderCanvasNode } from "./renderNode.js";

export function Canvas(props: CanvasProps): React.ReactElement {
  const colors = useColors();
  const {
    nodes,
    edges = [],
    title,
    direction = "vertical",
    width,
    borderStyle,
    borderColor,
    padding,
  } = props;

  const nodeIndex = buildNodeIndex(nodes);

  const children = nodes.map(node =>
    renderCanvasNode(node, edges, nodeIndex, 0, colors),
  );

  const outerProps: Record<string, unknown> = {
    flexDirection: direction === "horizontal" ? "row" : "column",
    ...(width !== undefined ? { width } : {}),
    ...(borderStyle !== undefined ? { borderStyle, borderColor: borderColor ?? colors.text.dim } : {}),
    ...(padding !== undefined ? { padding } : {}),
    gap: 1,
  };

  const elements: React.ReactElement[] = [];

  if (title) {
    elements.push(
      React.createElement("tui-box", { key: "__title", flexDirection: "row", marginBottom: 1 },
        React.createElement("tui-text", { bold: true, color: colors.brand.primary }, title),
      ),
    );
  }

  elements.push(...children);

  return React.createElement("tui-box", outerProps, ...elements);
}
