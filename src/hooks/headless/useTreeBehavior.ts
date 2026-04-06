import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

const MAX_TREE_DEPTH = 100;

export interface TreeBehaviorNode {
  key: string;
  label: string;
  children?: TreeBehaviorNode[];
  expanded?: boolean;
  icon?: string;
}

export interface FlatTreeNode {
  node: TreeBehaviorNode;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
  hasChildren: boolean;
}

export interface UseTreeBehaviorOptions {
  nodes: TreeBehaviorNode[];
  onToggle?: (key: string) => void;
  isActive?: boolean;
  maxVisible?: number;
}

export interface UseTreeBehaviorResult {
  /** Flattened visible nodes in display order */
  visibleNodes: FlatTreeNode[];
  /** Index of the highlighted node */
  highlightIndex: number;
  /** Set of expanded node keys */
  expandedKeys: Set<string>;
  /** Toggle expand/collapse of a node */
  toggle: (key: string) => void;
  /** Visible range start index (for virtual scrolling) */
  visibleStart: number;
  /** Visible range end index */
  visibleEnd: number;
  /** Number of hidden nodes above visible window */
  hiddenAbove: number;
  /** Number of hidden nodes below visible window */
  hiddenBelow: number;
  /** Get props for a node by its key */
  getNodeProps: (key: string) => {
    isHighlighted: boolean;
    isExpanded: boolean;
    hasChildren: boolean;
    depth: number;
    node: TreeBehaviorNode;
  };
}

/** Collect visible nodes in display order, flattened with depth/position info. */
function flattenVisible(nodes: TreeBehaviorNode[], depth: number, parentIsLast: boolean[]): FlatTreeNode[] {
  if (depth >= MAX_TREE_DEPTH) return [];
  const result: FlatTreeNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLast = i === nodes.length - 1;
    const hasChildren = node.children !== undefined && node.children.length > 0;
    result.push({ node, depth, isLast, parentIsLast: [...parentIsLast], hasChildren });
    if (hasChildren && node.expanded) {
      result.push(...flattenVisible(node.children!, depth + 1, [...parentIsLast, isLast]));
    }
  }
  return result;
}

/** Collect visible keys in display order for keyboard navigation. */
function collectVisibleKeys(nodes: TreeBehaviorNode[], depth: number): string[] {
  if (depth >= MAX_TREE_DEPTH) return [];
  const keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.key);
    const hasChildren = node.children !== undefined && node.children.length > 0;
    if (hasChildren && node.expanded) {
      keys.push(...collectVisibleKeys(node.children!, depth + 1));
    }
  }
  return keys;
}

/** Find a node by key in the tree. */
function findNode(nodes: TreeBehaviorNode[], key: string, depth: number): TreeBehaviorNode | undefined {
  if (depth >= MAX_TREE_DEPTH) return undefined;
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNode(node.children, key, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

/** Collect all expanded keys in the tree. */
function collectExpandedKeys(nodes: TreeBehaviorNode[], depth: number): Set<string> {
  if (depth >= MAX_TREE_DEPTH) return new Set();
  const keys = new Set<string>();
  for (const node of nodes) {
    if (node.expanded) keys.add(node.key);
    if (node.children) {
      for (const k of collectExpandedKeys(node.children, depth + 1)) {
        keys.add(k);
      }
    }
  }
  return keys;
}

export function useTreeBehavior(options: UseTreeBehaviorOptions): UseTreeBehaviorResult {
  const {
    nodes,
    onToggle,
    isActive = false,
    maxVisible,
  } = options;

  const forceUpdate = useForceUpdate();
  const highlightRef = useRef(0);
  const scrollOffsetRef = useRef(0);

  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  const flatNodes = flattenVisible(nodes, 0, []);

  // Clamp highlight index
  if (highlightRef.current >= flatNodes.length) {
    highlightRef.current = Math.max(0, flatNodes.length - 1);
  }

  // Virtual scrolling
  const useVirtualScroll = maxVisible !== undefined && flatNodes.length > maxVisible;
  if (useVirtualScroll) {
    if (highlightRef.current < scrollOffsetRef.current) {
      scrollOffsetRef.current = highlightRef.current;
    } else if (highlightRef.current >= scrollOffsetRef.current + maxVisible) {
      scrollOffsetRef.current = highlightRef.current - maxVisible + 1;
    }
    const maxOffset = Math.max(0, flatNodes.length - maxVisible);
    if (scrollOffsetRef.current > maxOffset) scrollOffsetRef.current = maxOffset;
    if (scrollOffsetRef.current < 0) scrollOffsetRef.current = 0;
  } else {
    scrollOffsetRef.current = 0;
  }

  const toggle = useCallback((key: string) => {
    onToggleRef.current?.(key);
  }, []);

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const keys = collectVisibleKeys(nodes, 0);
      if (keys.length === 0) return;

      if (event.key === "up") {
        if (highlightRef.current > 0) {
          highlightRef.current -= 1;
          forceUpdate();
        }
      } else if (event.key === "down") {
        if (highlightRef.current < keys.length - 1) {
          highlightRef.current += 1;
          forceUpdate();
        }
      } else if (event.key === "left") {
        const key = keys[highlightRef.current];
        if (key) {
          const node = findNode(nodes, key, 0);
          if (node && node.expanded && node.children && node.children.length > 0) {
            onToggleRef.current?.(key);
          }
        }
      } else if (event.key === "right") {
        const key = keys[highlightRef.current];
        if (key) {
          const node = findNode(nodes, key, 0);
          if (node && !node.expanded && node.children && node.children.length > 0) {
            onToggleRef.current?.(key);
          }
        }
      } else if (event.key === "return" || event.key === "space") {
        const key = keys[highlightRef.current];
        if (key) {
          onToggleRef.current?.(key);
        }
      }
    },
    [nodes, forceUpdate],
  );

  useInput(handleInput, { isActive });

  const visibleStart = scrollOffsetRef.current;
  const visibleEnd = useVirtualScroll
    ? Math.min(scrollOffsetRef.current + maxVisible, flatNodes.length)
    : flatNodes.length;

  const hiddenAbove = visibleStart;
  const hiddenBelow = flatNodes.length - visibleEnd;

  const expandedKeys = collectExpandedKeys(nodes, 0);

  const keyToIndex = new Map<string, number>();
  for (let i = 0; i < flatNodes.length; i++) {
    keyToIndex.set(flatNodes[i]!.node.key, i);
  }

  const getNodeProps = useCallback((key: string) => {
    const idx = keyToIndex.get(key);
    const flatNode = idx !== undefined ? flatNodes[idx] : undefined;
    const node = flatNode?.node ?? findNode(nodes, key, 0);
    const hasChildren = node?.children !== undefined && (node?.children.length ?? 0) > 0;
    return {
      isHighlighted: idx === highlightRef.current,
      isExpanded: !!node?.expanded,
      hasChildren,
      depth: flatNode?.depth ?? 0,
      node: node!,
    };
  }, [flatNodes, nodes, keyToIndex]);

  return {
    visibleNodes: flatNodes.slice(visibleStart, visibleEnd),
    highlightIndex: highlightRef.current,
    expandedKeys,
    toggle,
    visibleStart,
    visibleEnd,
    hiddenAbove,
    hiddenBelow,
    getNodeProps,
  };
}
