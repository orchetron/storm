import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import type { KeyEvent } from "../../input/types.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { usePersonality } from "../../core/personality.js";

const MAX_TREE_DEPTH = 100;

export interface TreeNode {
  key: string;
  label: string;
  children?: TreeNode[];
  expanded?: boolean;
  /** Optional icon rendered before the label. */
  icon?: string;
}

export interface TreeProps {
  nodes: TreeNode[];
  onToggle?: (key: string) => void;
  color?: string | number;
  isFocused?: boolean;
  /** Maximum visible nodes for virtual scrolling (default: all visible). */
  maxVisible?: number;
  /** Custom renderer for each tree node. */
  renderNode?: (node: TreeNode, state: { isExpanded: boolean; isHighlighted: boolean; depth: number }) => React.ReactNode;
}

interface FlatNode {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

/** Collect visible nodes in display order, flattened with depth/position info. */
function flattenVisible(nodes: TreeNode[], depth: number, parentIsLast: boolean[]): FlatNode[] {
  if (depth >= MAX_TREE_DEPTH) return [];
  const result: FlatNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLast = i === nodes.length - 1;
    result.push({ node, depth, isLast, parentIsLast: [...parentIsLast] });
    const hasChildren = node.children !== undefined && node.children.length > 0;
    if (hasChildren && node.expanded) {
      result.push(...flattenVisible(node.children!, depth + 1, [...parentIsLast, isLast]));
    }
  }
  return result;
}

/** Derive visible keys from a flat node list. */
function collectVisibleKeysFromFlat(flatNodes: FlatNode[]): string[] {
  return flatNodes.map((fn) => fn.node.key);
}

/** Build a lookup map from a flat node list. */
function buildNodeMap(flatNodes: FlatNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  for (const fn of flatNodes) {
    map.set(fn.node.key, fn.node);
  }
  return map;
}

export const Tree = React.memo(function Tree(rawProps: TreeProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Tree", rawProps);
  const {
    nodes,
    onToggle,
    color = colors.brand.primary,
    isFocused = false,
    maxVisible,
  } = props;

  const { requestRender } = useTui();
  const highlightRef = useRef(0);
  const scrollOffsetRef = useRef(0);

  if (nodes.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No items",
    );
  }

  const flatNodes = flattenVisible(nodes, 0, []);
  const visibleKeys = collectVisibleKeysFromFlat(flatNodes);
  const nodeMap = buildNodeMap(flatNodes);

  // Clamp highlight index
  if (highlightRef.current >= flatNodes.length) {
    highlightRef.current = Math.max(0, flatNodes.length - 1);
  }

  // Virtual scrolling
  const useVirtualScroll = maxVisible !== undefined && flatNodes.length > maxVisible;
  if (useVirtualScroll) {
    // Keep highlight visible within scroll window
    if (highlightRef.current < scrollOffsetRef.current) {
      scrollOffsetRef.current = highlightRef.current;
    } else if (highlightRef.current >= scrollOffsetRef.current + maxVisible) {
      scrollOffsetRef.current = highlightRef.current - maxVisible + 1;
    }
    // Clamp scroll offset
    const maxOffset = Math.max(0, flatNodes.length - maxVisible);
    if (scrollOffsetRef.current > maxOffset) scrollOffsetRef.current = maxOffset;
    if (scrollOffsetRef.current < 0) scrollOffsetRef.current = 0;
  } else {
    scrollOffsetRef.current = 0;
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      if (visibleKeys.length === 0) return;

      if (event.key === "up") {
        if (highlightRef.current > 0) {
          highlightRef.current -= 1;
          requestRender();
        }
      } else if (event.key === "down") {
        if (highlightRef.current < visibleKeys.length - 1) {
          highlightRef.current += 1;
          requestRender();
        }
      } else if (event.key === "left") {
        // Collapse current node
        const key = visibleKeys[highlightRef.current];
        if (key) {
          const node = nodeMap.get(key);
          if (node && node.expanded && node.children && node.children.length > 0) {
            onToggle?.(key);
          }
        }
      } else if (event.key === "right") {
        // Expand current node
        const key = visibleKeys[highlightRef.current];
        if (key) {
          const node = nodeMap.get(key);
          if (node && !node.expanded && node.children && node.children.length > 0) {
            onToggle?.(key);
          }
        }
      } else if (event.key === "return" || event.key === "space") {
        const key = visibleKeys[highlightRef.current];
        if (key) {
          onToggle?.(key);
        }
      }
    },
    [visibleKeys, nodeMap, onToggle, requestRender],
  );

  useInput(handleInput, { isActive: isFocused });

  const visibleStart = scrollOffsetRef.current;
  const visibleEnd = useVirtualScroll
    ? Math.min(scrollOffsetRef.current + maxVisible, flatNodes.length)
    : flatNodes.length;

  const allElements: React.ReactElement[] = [];

  // Overflow indicator at top
  if (useVirtualScroll && visibleStart > 0) {
    allElements.push(
      React.createElement(
        "tui-text",
        { key: "__scroll-up", color: colors.text.dim, dim: true },
        `  \u25B2 ${visibleStart} more above`,
      ),
    );
  }

  for (let i = visibleStart; i < visibleEnd; i++) {
    const entry = flatNodes[i]!;
    const isHighlighted = isFocused && i === highlightRef.current;
    const hasChildren = entry.node.children !== undefined && entry.node.children.length > 0;

    let prefix = "";
    for (let d = 0; d < entry.depth; d++) {
      if (entry.parentIsLast[d]) {
        prefix += "   ";
      } else {
        prefix += "\u2502  "; // │
      }
    }
    if (entry.depth > 0) {
      prefix =
        prefix.slice(0, -3) +
        (entry.isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500"); // └── or ├──
    }

    // Expand/collapse marker
    const marker = hasChildren
      ? entry.node.expanded
        ? "\u25BE" // ▾
        : "\u25B8" // ▸
      : " ";

    const parts: React.ReactElement[] = [];

    // Tree connector
    if (prefix) {
      parts.push(
        React.createElement(
          "tui-text",
          { key: "prefix", color: colors.divider },
          prefix,
        ),
      );
    }

    // Expand/collapse marker
    parts.push(
      React.createElement(
        "tui-text",
        { key: "marker", color },
        marker + " ",
      ),
    );

    // Optional icon
    if (entry.node.icon !== undefined) {
      parts.push(
        React.createElement(
          "tui-text",
          { key: "icon" },
          entry.node.icon + " ",
        ),
      );
    }

    if (props.renderNode) {
      allElements.push(
        React.createElement(
          "tui-box",
          { key: entry.node.key, flexDirection: "row" },
          props.renderNode(entry.node, {
            isExpanded: !!entry.node.expanded,
            isHighlighted,
            depth: entry.depth,
          }),
        ),
      );
    } else {
      // Label
      parts.push(
        React.createElement(
          "tui-text",
          { key: "label", ...(isHighlighted ? { bold: true, inverse: personality.interaction.focusIndicator === "highlight", color: isHighlighted ? color : undefined } : {}) },
          entry.node.label,
        ),
      );

      allElements.push(
        React.createElement(
          "tui-box",
          { key: entry.node.key, flexDirection: "row" },
          ...parts,
        ),
      );
    }
  }

  // Overflow indicator at bottom
  if (useVirtualScroll && visibleEnd < flatNodes.length) {
    allElements.push(
      React.createElement(
        "tui-text",
        { key: "__scroll-down", color: colors.text.dim, dim: true },
        `  \u25BC ${flatNodes.length - visibleEnd} more below`,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { role: "tree", flexDirection: "column" },
    ...allElements,
  );
});
