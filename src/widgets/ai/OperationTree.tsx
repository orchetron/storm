import React, { useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { fmtDuration } from "../../utils/format.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";

export interface OpNode {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  children?: OpNode[];
  detail?: string;
  durationMs?: number;
}

export interface OperationTreeProps {
  nodes: OpNode[];
  maxDepth?: number;
  showDuration?: boolean;
  /** Custom render for each operation node. */
  renderNode?: (node: OpNode, state: { depth: number }) => React.ReactNode;
  /** Custom spinner animation frames (default: braille spinner). */
  spinnerFrames?: string[];
  /** Spinner animation interval in ms (default: 80). */
  spinnerInterval?: number;
  /** Override status icons by status key. */
  statusIcons?: Partial<Record<string, string>>;
  /** Override tree connector characters. */
  treeConnectors?: { branch?: string; last?: string; pipe?: string; space?: string };
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL = 80;

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  completed: "✓",
  failed: "✗",
  cancelled: "⊘",
};

function getStatusColors(colors: StormColors): Record<string, string | undefined> {
  return {
    pending: colors.tool.pending,
    running: colors.tool.running,
    completed: colors.tool.completed,
    failed: colors.tool.failed,
    cancelled: colors.tool.cancelled,
  };
}

function hasRunningNode(nodes: readonly OpNode[]): boolean {
  for (const node of nodes) {
    if (node.status === "running") return true;
    if (node.children && hasRunningNode(node.children)) return true;
  }
  return false;
}

function collectRunningRefs(
  nodes: readonly OpNode[],
  refs: Map<string, React.RefObject<any>>,
  depth: number,
  maxDepth: number | undefined,
): void {
  if (maxDepth !== undefined && depth >= maxDepth) return;
  for (const node of nodes) {
    if (node.status === "running") {
      if (!refs.has(node.id)) {
        refs.set(node.id, React.createRef());
      }
    }
    if (node.children) {
      collectRunningRefs(node.children, refs, depth + 1, maxDepth);
    }
  }
}

export const OperationTree = React.memo(function OperationTree(rawProps: OperationTreeProps): React.ReactElement {
  const colors = useColors();
  const STATUS_COLORS = getStatusColors(colors);
  const props = usePluginProps("OperationTree", rawProps);
  const { nodes, maxDepth, showDuration = true, spinnerFrames, spinnerInterval, statusIcons: statusIconsOverride, treeConnectors } = props;
  const effectiveSpinnerFrames = spinnerFrames ?? SPINNER_FRAMES;
  const effectiveSpinnerInterval = spinnerInterval ?? SPINNER_INTERVAL;
  const effectiveStatusIcons: Record<string, string> = statusIconsOverride
    ? { ...STATUS_ICONS, ...statusIconsOverride as Record<string, string> }
    : STATUS_ICONS;
  const connBranch = treeConnectors?.branch ?? "\u251C\u2500";
  const connLast = treeConnectors?.last ?? "\u2514\u2500";
  const connPipe = treeConnectors?.pipe ?? "\u2502  ";
  const connSpace = treeConnectors?.space ?? "   ";
  const { requestRender } = useTui();
  const frameRef = useRef(0);
  const spinnerRefsMap = useRef<Map<string, React.RefObject<any>>>(new Map());

  // Clean up stale refs for nodes no longer in the tree
  const allNodeIds = new Set<string>();
  function collectAllIds(nodeList: readonly OpNode[]): void {
    for (const node of nodeList) {
      allNodeIds.add(node.id);
      if (node.children) collectAllIds(node.children);
    }
  }
  collectAllIds(nodes);
  for (const id of spinnerRefsMap.current.keys()) {
    if (!allNodeIds.has(id)) {
      spinnerRefsMap.current.delete(id);
    }
  }

  collectRunningRefs(nodes, spinnerRefsMap.current, 0, maxDepth);

  const anyRunning = hasRunningNode(nodes);

  // Animate spinner — only when running nodes exist.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (anyRunning && !timerRef.current) {
    timerRef.current = setInterval(() => {
      // Only animate if there are refs pointing to live text nodes
      let updated = false;
      frameRef.current = (frameRef.current + 1) % effectiveSpinnerFrames.length;
      const frame = effectiveSpinnerFrames[frameRef.current]!;
      for (const ref of spinnerRefsMap.current.values()) {
        if (ref.current) {
          ref.current.text = frame;
          updated = true;
        }
      }
      if (updated) requestRender();
    }, effectiveSpinnerInterval);
  } else if (!anyRunning && timerRef.current) {
    // Stop timer when no nodes are running
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  useCleanup(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  });

  function renderNodes(
    nodeList: readonly OpNode[],
    depth: number,
    parentPrefix: string,
  ): React.ReactElement[] {
    if (maxDepth !== undefined && depth >= maxDepth) return [];

    const elements: React.ReactElement[] = [];

    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i]!;
      const isLast = i === nodeList.length - 1;
      const connector = isLast ? connLast : connBranch;
      const childPrefix = parentPrefix + (isLast ? connSpace : connPipe);

      if (props.renderNode) {
        elements.push(
          React.createElement(React.Fragment, { key: node.id }, props.renderNode(node, { depth })),
        );
        if (node.children && node.children.length > 0) {
          elements.push(...renderNodes(node.children, depth + 1, childPrefix));
        }
        continue;
      }

      const lineChildren: React.ReactElement[] = [];

      // Prefix
      if (depth > 0 || nodeList.length > 1 || parentPrefix.length > 0) {
        lineChildren.push(
          React.createElement("tui-text", { key: "prefix", color: colors.text.disabled }, parentPrefix + connector + " "),
        );
      }

      // Status icon
      if (node.status === "running") {
        const ref = spinnerRefsMap.current.get(node.id) ?? React.createRef();
        spinnerRefsMap.current.set(node.id, ref);
        lineChildren.push(
          React.createElement(
            "tui-text",
            { key: "icon", color: colors.tool.running, _textNodeRef: ref },
            effectiveSpinnerFrames[frameRef.current]!,
          ),
        );
      } else {
        const icon = effectiveStatusIcons[node.status] ?? "○";
        const color = STATUS_COLORS[node.status];
        lineChildren.push(
          React.createElement(
            "tui-text",
            { key: "icon", ...(color ? { color } : {}) },
            icon,
          ),
        );
      }

      // Label — running nodes are brighter, completed/pending are dim
      const labelColor = node.status === "running" ? colors.text.primary : colors.text.dim;
      lineChildren.push(
        React.createElement("tui-text", { key: "label", color: labelColor }, ` ${node.label}`),
      );

      // Detail
      if (node.detail) {
        lineChildren.push(
          React.createElement("tui-text", { key: "detail", dim: true }, ` ${node.detail}`),
        );
      }

      // Duration
      if (showDuration && node.durationMs !== undefined) {
        const formatted = fmtDuration(node.durationMs);
        lineChildren.push(
          React.createElement(
            "tui-text",
            { key: "duration", dim: true, color: colors.brand.light },
            ` (${formatted})`,
          ),
        );
      }

      elements.push(
        React.createElement("tui-text", { key: node.id }, ...lineChildren),
      );

      // Children
      if (node.children && node.children.length > 0) {
        elements.push(
          ...renderNodes(node.children, depth + 1, childPrefix),
        );
      }
    }

    return elements;
  }

  return React.createElement("tui-box", { flexDirection: "column" }, ...renderNodes(nodes, 0, ""));
});
