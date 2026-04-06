import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { BORDER_CHARS, type BorderStyle } from "../../core/types.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  color?: string | number;     // border/text color
  width?: number;              // auto-calculated from label if not specified
}

export interface DiagramEdge {
  from: string;    // node id
  to: string;      // node id
  label?: string;  // edge label
}

export interface DiagramProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  direction?: "horizontal" | "vertical";  // flow direction, default "horizontal"
  nodeStyle?: "round" | "single" | "double" | "heavy";  // border style
  arrowChar?: string;   // default "▸" for horizontal, "▾" for vertical
  gapX?: number;        // horizontal gap between nodes (default 4)
  gapY?: number;        // vertical gap between node rows (default 2)
  color?: string | number;  // default node color
  edgeColor?: string | number;  // arrow/line color
}

/** Calculate the display width for a node box (including border). */
function calcNodeWidth(node: DiagramNode): number {
  if (node.width !== undefined) return node.width;
  const labelLen = node.label.length;
  const sublabelLen = node.sublabel ? node.sublabel.length : 0;
  return Math.max(labelLen, sublabelLen) + 4; // 2 padding + 2 border
}

interface DagLevel {
  nodes: DiagramNode[];
}

/**
 * Topological sort via Kahn's algorithm.
 * Returns nodes grouped into levels (layers) for rendering.
 * Each level contains nodes that can be placed in the same column/row.
 */
function topoSort(nodes: DiagramNode[], edges: DiagramEdge[]): DagLevel[] {
  if (nodes.length === 0) return [];
  if (edges.length === 0) return [{ nodes }];

  const nodeMap = new Map<string, DiagramNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  const outgoing = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const out = outgoing.get(edge.from);
    if (out) out.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Kahn's algorithm with level tracking
  const levels: DagLevel[] = [];
  let queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const visited = new Set<string>();

  while (queue.length > 0) {
    const levelNodes: DiagramNode[] = [];
    const nextQueue: string[] = [];

    for (const id of queue) {
      if (visited.has(id)) continue;
      visited.add(id);
      const node = nodeMap.get(id);
      if (node) levelNodes.push(node);

      const targets = outgoing.get(id) ?? [];
      for (const t of targets) {
        const newDeg = (inDegree.get(t) ?? 1) - 1;
        inDegree.set(t, newDeg);
        if (newDeg === 0) nextQueue.push(t);
      }
    }

    if (levelNodes.length > 0) levels.push({ nodes: levelNodes });
    queue = nextQueue;
  }

  const remaining: DiagramNode[] = [];
  for (const node of nodes) {
    if (!visited.has(node.id)) remaining.push(node);
  }
  if (remaining.length > 0) levels.push({ nodes: remaining });

  return levels;
}

function buildEdgeLookup(edges: DiagramEdge[]): Map<string, DiagramEdge> {
  const lookup = new Map<string, DiagramEdge>();
  for (const edge of edges) {
    lookup.set(`${edge.from}->${edge.to}`, edge);
  }
  return lookup;
}

function getOutgoing(nodeId: string, edges: DiagramEdge[]): DiagramEdge[] {
  return edges.filter((e) => e.from === nodeId);
}

function getIncoming(nodeId: string, edges: DiagramEdge[]): DiagramEdge[] {
  return edges.filter((e) => e.to === nodeId);
}

function renderHorizontalConnector(
  lineChar: string,
  arrow: string,
  gapX: number,
  lineColor: string | number,
  edgeLabel?: string,
): React.ReactElement {
  const lineCount = Math.max(1, gapX - 1);
  const connector = lineChar.repeat(lineCount) + arrow;

  if (edgeLabel) {
    return React.createElement(
      "tui-box",
      { flexDirection: "column", alignItems: "center", justifyContent: "center" },
      React.createElement("tui-text", { dim: true, color: lineColor }, edgeLabel),
      React.createElement("tui-text", { color: lineColor }, connector),
    );
  }

  return React.createElement(
    "tui-box",
    { alignItems: "center", justifyContent: "center" },
    React.createElement("tui-text", { color: lineColor }, connector),
  );
}

function renderVerticalConnector(
  lineChar: string,
  arrow: string,
  gapY: number,
  lineColor: string | number,
  edgeLabel?: string,
): React.ReactElement {
  const lineCount = Math.max(1, gapY - 1);
  const lines: React.ReactElement[] = [];

  for (let i = 0; i < lineCount; i++) {
    lines.push(React.createElement("tui-text", { key: `l${i}`, color: lineColor }, lineChar));
  }
  lines.push(React.createElement("tui-text", { key: "arrow", color: lineColor }, arrow));

  if (edgeLabel) {
    return React.createElement(
      "tui-box",
      { flexDirection: "row", justifyContent: "center", gap: 1 },
      React.createElement("tui-box", { flexDirection: "column", alignItems: "center" }, ...lines),
      React.createElement(
        "tui-box",
        { alignItems: "center" },
        React.createElement("tui-text", { dim: true, color: lineColor }, edgeLabel),
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column", alignItems: "center" },
    ...lines,
  );
}

/** Render a fan-out connector: one source splitting into N targets stacked. */
function renderFanOutHorizontal(
  lineChar: string,
  arrow: string,
  gapX: number,
  lineColor: string | number,
  edgeLabels: (string | undefined)[],
  count: number,
): React.ReactElement {
  const branches: React.ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    branches.push(
      React.createElement(
        React.Fragment,
        { key: `branch-${i}` },
        renderHorizontalConnector(lineChar, arrow, gapX, lineColor, edgeLabels[i]),
      ),
    );
  }
  return React.createElement(
    "tui-box",
    { flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 1 },
    ...branches,
  );
}

/** Render a fan-out connector for vertical direction. */
function renderFanOutVertical(
  lineChar: string,
  arrow: string,
  gapY: number,
  lineColor: string | number,
  edgeLabels: (string | undefined)[],
  count: number,
): React.ReactElement {
  const branches: React.ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    branches.push(
      React.createElement(
        React.Fragment,
        { key: `branch-${i}` },
        renderVerticalConnector(lineChar, arrow, gapY, lineColor, edgeLabels[i]),
      ),
    );
  }
  return React.createElement(
    "tui-box",
    { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 2 },
    ...branches,
  );
}

/** Render merge indicator for nodes with multiple incoming edges. */
function renderMergeIndicator(
  lineChar: string,
  lineColor: string | number,
  count: number,
  isHorizontal: boolean,
): React.ReactElement {
  if (isHorizontal) {
    const lines: React.ReactElement[] = [];
    for (let i = 0; i < count; i++) {
      lines.push(
        React.createElement("tui-text", { key: `merge-${i}`, color: lineColor }, lineChar),
      );
    }
    return React.createElement(
      "tui-box",
      { flexDirection: "column", alignItems: "center", justifyContent: "center" },
      ...lines,
    );
  }
  // Vertical merge: horizontal lines converging
  const segments: React.ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    segments.push(
      React.createElement("tui-text", { key: `merge-${i}`, color: lineColor }, lineChar),
    );
  }
  return React.createElement(
    "tui-box",
    { flexDirection: "row", justifyContent: "center", gap: 1 },
    ...segments,
  );
}

function renderNodeBox(
  node: DiagramNode,
  borderStyle: Exclude<BorderStyle, "none" | "ascii" | "storm">,
  defaultColor: string | number,
): React.ReactElement {
  const nodeColor = node.color ?? defaultColor;
  const nodeWidth = calcNodeWidth(node);

  const children: React.ReactElement[] = [
    React.createElement("tui-text", { key: "label", color: nodeColor }, node.label),
  ];
  if (node.sublabel !== undefined) {
    children.push(
      React.createElement("tui-text", { key: "sublabel", dim: true, color: nodeColor }, node.sublabel),
    );
  }

  return React.createElement(
    "tui-box",
    {
      key: node.id,
      borderStyle,
      borderColor: nodeColor,
      width: nodeWidth,
      paddingX: 1,
      flexDirection: "column",
      alignItems: "center",
    },
    ...children,
  );
}

export const Diagram = React.memo(function Diagram(rawProps: DiagramProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Diagram", rawProps);
  const {
    nodes,
    edges,
    direction = "horizontal",
    nodeStyle = "round",
    arrowChar,
    gapX = 4,
    gapY = 2,
    color,
    edgeColor,
  } = props;

  const arrow = arrowChar ?? (direction === "horizontal" ? "\u25B8" : "\u25BE");
  const borderChars = BORDER_CHARS[nodeStyle];
  const lineChar = direction === "horizontal" ? borderChars.horizontal : borderChars.vertical;
  const defaultColor = color ?? colors.brand.primary;
  const lineColor = edgeColor ?? colors.text.dim;
  const isHorizontal = direction === "horizontal";

  const levels = topoSort(nodes, edges);
  const edgeLookup = buildEdgeLookup(edges);

  if (levels.length === 0) {
    return React.createElement("tui-box", {});
  }

  const nodeLevelMap = new Map<string, number>();
  for (let li = 0; li < levels.length; li++) {
    for (const node of levels[li]!.nodes) {
      nodeLevelMap.set(node.id, li);
    }
  }

  const elements: React.ReactElement[] = [];

  for (let li = 0; li < levels.length; li++) {
    const level = levels[li]!;

    if (level.nodes.length === 1) {
      // Single node at this level
      const node = level.nodes[0]!;
      const incomingEdges = getIncoming(node.id, edges);

      // Show merge indicator if multiple incoming edges from different levels
      const incomingFromPrevLevels = incomingEdges.filter((e) => {
        const srcLevel = nodeLevelMap.get(e.from);
        return srcLevel !== undefined && srcLevel < li;
      });

      if (incomingFromPrevLevels.length > 1 && li > 0) {
        elements.push(
          React.createElement(
            React.Fragment,
            { key: `merge-${node.id}` },
            renderMergeIndicator(lineChar, lineColor, incomingFromPrevLevels.length, isHorizontal),
          ),
        );
      }

      elements.push(renderNodeBox(node, nodeStyle, defaultColor));
    } else {
      // Multiple nodes at this level — stack them
      const nodeElements: React.ReactElement[] = level.nodes.map((node) =>
        renderNodeBox(node, nodeStyle, defaultColor),
      );

      elements.push(
        React.createElement(
          "tui-box",
          {
            key: `level-${li}`,
            flexDirection: isHorizontal ? "column" : "row",
            alignItems: "center",
            gap: 1,
          },
          ...nodeElements,
        ),
      );
    }

    // Add connectors to the next level
    if (li < levels.length - 1) {
      const nextLevel = levels[li + 1]!;
      const nextNodeIds = new Set(nextLevel.nodes.map((n) => n.id));

      const crossEdges: DiagramEdge[] = [];
      for (const node of level.nodes) {
        const outEdges = getOutgoing(node.id, edges);
        for (const e of outEdges) {
          if (nextNodeIds.has(e.to)) crossEdges.push(e);
        }
      }

      if (crossEdges.length === 0) {
        // No direct edges — just add a gap
        elements.push(
          React.createElement(
            "tui-box",
            { key: `gap-${li}`, ...(isHorizontal ? { width: gapX } : { height: gapY }) },
          ),
        );
      } else if (crossEdges.length === 1) {
        // Single connector
        const edge = crossEdges[0]!;
        const connector = isHorizontal
          ? renderHorizontalConnector(lineChar, arrow, gapX, lineColor, edge.label)
          : renderVerticalConnector(lineChar, arrow, gapY, lineColor, edge.label);
        elements.push(
          React.createElement(React.Fragment, { key: `edge-${li}` }, connector),
        );
      } else {
        // Multiple edges — fan-out/fan-in connector
        const edgeLabels = crossEdges.map((e) => e.label);
        const connector = isHorizontal
          ? renderFanOutHorizontal(lineChar, arrow, gapX, lineColor, edgeLabels, crossEdges.length)
          : renderFanOutVertical(lineChar, arrow, gapY, lineColor, edgeLabels, crossEdges.length);
        elements.push(
          React.createElement(React.Fragment, { key: `fan-${li}` }, connector),
        );
      }
    }
  }

  return React.createElement(
    "tui-box",
    {
      flexDirection: isHorizontal ? "row" : "column",
      alignItems: "center",
      role: "img",
    },
    ...elements,
  );
});
