import React, { useRef, useCallback, createContext, useContext } from "react";
import * as fs from "fs";
import * as path from "path";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface DirNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: DirNode[];
  expanded?: boolean;
}

/** Entry descriptor returned by onLoadChildren. */
export interface DirChildEntry {
  name: string;
  isDirectory: boolean;
}

export interface DirectoryTreeProps {
  rootPath: string;
  onSelect?: (path: string) => void;
  showHidden?: boolean;
  showFiles?: boolean;
  fileColor?: string | number;
  dirColor?: string | number;
  isFocused?: boolean;
  /** Custom renderer for each directory entry. */
  renderEntry?: (entry: DirNode, state: { isHighlighted: boolean; isExpanded: boolean; depth: number }) => React.ReactNode;
  /** Custom async child loader. When provided, replaces the default sync fs.readdirSync.
   *  Return an array of { name: string, isDirectory: boolean } entries. */
  onLoadChildren?: (path: string) => DirChildEntry[] | Promise<DirChildEntry[]>;
}

export interface DirectoryTreeContextValue {
  expandedPaths: ReadonlySet<string>;
  toggleExpanded: (path: string) => void;
  cursor: number;
  setCursor: (index: number) => void;
}

export const DirectoryTreeContext = createContext<DirectoryTreeContextValue | null>(null);

export function useDirectoryTreeContext(): DirectoryTreeContextValue {
  const ctx = useContext(DirectoryTreeContext);
  if (!ctx) throw new Error("DirectoryTree sub-components must be used inside DirectoryTree.Root");
  return ctx;
}

export interface DirectoryTreeRootProps {
  expandedPaths?: ReadonlySet<string>;
  onToggleExpanded?: (path: string) => void;
  cursor?: number;
  onCursorChange?: (index: number) => void;
  children: React.ReactNode;
}

function DirectoryTreeRoot({
  expandedPaths = new Set(),
  onToggleExpanded,
  cursor = 0,
  onCursorChange,
  children,
}: DirectoryTreeRootProps): React.ReactElement {
  const { requestRender } = useTui();
  const onToggleRef = useRef(onToggleExpanded);
  onToggleRef.current = onToggleExpanded;
  const onCursorRef = useRef(onCursorChange);
  onCursorRef.current = onCursorChange;

  const ctx: DirectoryTreeContextValue = {
    expandedPaths,
    toggleExpanded: (p: string) => { onToggleRef.current?.(p); requestRender(); },
    cursor,
    setCursor: (i: number) => { onCursorRef.current?.(i); requestRender(); },
  };

  return React.createElement(
    DirectoryTreeContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface DirectoryTreeCompoundNodeProps {
  node: DirNode;
  depth?: number;
  index?: number;
  children?: React.ReactNode;
}

function DirectoryTreeCompoundNode({ node, depth = 0, index = 0, children }: DirectoryTreeCompoundNodeProps): React.ReactElement {
  const colors = useColors();
  const { expandedPaths, cursor } = useDirectoryTreeContext();
  const isHighlighted = index === cursor;
  const isExpanded = expandedPaths.has(node.path);
  const icon = node.isDir ? (isExpanded ? "\u25BE " : "\u25B8 ") : "\u{1F4C4} ";
  const nameColor = node.isDir ? colors.brand.primary : colors.text.primary;

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement(
      "tui-text",
      { color: isHighlighted ? colors.brand.primary : undefined },
      isHighlighted ? "\u276F " : "  ",
    ),
    React.createElement("tui-text", { color: colors.divider }, "  ".repeat(depth)),
    React.createElement(
      "tui-text",
      { color: isHighlighted ? colors.text.primary : nameColor, bold: isHighlighted },
      icon + node.name + (node.isDir ? "/" : ""),
    ),
  );
}

interface FlatEntry {
  node: DirNode;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

function readDir(dirPath: string, showHidden: boolean, showFiles: boolean, rootPath?: string): DirNode[] {
  // Canonicalize the root for path traversal checks
  let canonicalRoot: string;
  try {
    canonicalRoot = rootPath ? fs.realpathSync(rootPath) : fs.realpathSync(dirPath);
  } catch {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return [];
  }

  if (!showHidden) {
    entries = entries.filter((e) => !e.startsWith("."));
  }

  const nodes: DirNode[] = [];
  const dirs: DirNode[] = [];
  const files: DirNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);

    // Path traversal protection: canonicalize and verify it stays within root
    let realPath: string;
    try {
      realPath = fs.realpathSync(fullPath);
    } catch {
      continue;
    }
    if (!realPath.startsWith(canonicalRoot + path.sep) && realPath !== canonicalRoot) {
      continue; // Skip entries that escape the root directory
    }

    let isDir = false;
    try {
      isDir = fs.statSync(realPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      dirs.push({ name: entry, path: realPath, isDir: true });
    } else if (showFiles) {
      files.push({ name: entry, path: realPath, isDir: false });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  nodes.push(...dirs, ...files);

  return nodes;
}

const FILE_ICONS: Record<string, string> = {
  ".ts": "\u{1F1F9}", ".tsx": "\u{1F1F9}", ".js": "\u{1F4DC}", ".jsx": "\u{1F4DC}",
  ".json": "\u{1F4CB}", ".md": "\u{1F4DD}", ".css": "\u{1F3A8}", ".scss": "\u{1F3A8}",
  ".html": "\u{1F310}",
};

function getFileIcon(name: string): string {
  return FILE_ICONS[path.extname(name).toLowerCase()] ?? "\u{1F4C4}";
}

function flattenVisible(
  nodes: DirNode[],
  depth: number,
  parentIsLast: boolean[],
): FlatEntry[] {
  const result: FlatEntry[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLast = i === nodes.length - 1;
    result.push({ node, depth, isLast, parentIsLast: [...parentIsLast] });
    if (node.isDir && node.expanded && node.children) {
      result.push(
        ...flattenVisible(node.children, depth + 1, [...parentIsLast, isLast]),
      );
    }
  }
  return result;
}

const DirectoryTreeBase = React.memo(function DirectoryTree(rawProps: DirectoryTreeProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("DirectoryTree", rawProps);
  const {
    rootPath,
    onSelect,
    showHidden = false,
    showFiles = true,
    fileColor = colors.text.primary,
    dirColor = colors.brand.primary,
    isFocused = true,
    onLoadChildren,
  } = props;

  const { requestRender } = useTui();

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onLoadChildrenRef = useRef(onLoadChildren);
  onLoadChildrenRef.current = onLoadChildren;

  // Canonicalize root path for traversal checks
  let canonicalRootPath: string;
  try {
    canonicalRootPath = fs.realpathSync(rootPath);
  } catch {
    canonicalRootPath = path.resolve(rootPath);
  }

  const loadingPathsRef = useRef<Set<string>>(new Set());

  /** Convert DirChildEntry[] from onLoadChildren into DirNode[]. */
  function childEntriesToNodes(parentPath: string, entries: DirChildEntry[], showFilesFlag: boolean): DirNode[] {
    const dirs: DirNode[] = [];
    const files: DirNode[] = [];
    for (const entry of entries) {
      const fullPath = path.join(parentPath, entry.name);
      if (entry.isDirectory) {
        dirs.push({ name: entry.name, path: fullPath, isDir: true });
      } else if (showFilesFlag) {
        files.push({ name: entry.name, path: fullPath, isDir: false });
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  }

  const rootNodesRef = useRef<DirNode[] | null>(null);
  if (rootNodesRef.current === null) {
    if (onLoadChildren) {
      // If custom loader provided, attempt sync first; if it returns a promise, start with empty + loading
      const result = onLoadChildren(canonicalRootPath);
      if (result instanceof Promise) {
        rootNodesRef.current = [];
        loadingPathsRef.current.add(canonicalRootPath);
        result.then((entries) => {
          rootNodesRef.current = childEntriesToNodes(canonicalRootPath, entries, showFiles);
          loadingPathsRef.current.delete(canonicalRootPath);
          requestRender();
        }).catch(() => {
          rootNodesRef.current = [];
          loadingPathsRef.current.delete(canonicalRootPath);
          requestRender();
        });
      } else {
        rootNodesRef.current = childEntriesToNodes(canonicalRootPath, result, showFiles);
      }
    } else {
      rootNodesRef.current = readDir(canonicalRootPath, showHidden, showFiles, canonicalRootPath);
    }
  }

  const cursorRef = useRef(0);
  const expandedSetRef = useRef<Set<string>>(new Set());

  // Expand a directory node (lazy load children)
  function expandNode(node: DirNode): void {
    if (!node.isDir) return;
    if (!node.children) {
      const loader = onLoadChildrenRef.current;
      if (loader) {
        const result = loader(node.path);
        if (result instanceof Promise) {
          // Async path: mark loading, resolve later
          loadingPathsRef.current.add(node.path);
          node.expanded = true;
          expandedSetRef.current.add(node.path);
          node.children = []; // placeholder while loading
          result.then((entries) => {
            node.children = childEntriesToNodes(node.path, entries, showFiles);
            loadingPathsRef.current.delete(node.path);
            requestRender();
          }).catch(() => {
            node.children = [];
            loadingPathsRef.current.delete(node.path);
            requestRender();
          });
          return;
        } else {
          node.children = childEntriesToNodes(node.path, result, showFiles);
        }
      } else {
        node.children = readDir(node.path, showHidden, showFiles, canonicalRootPath);
      }
    }
    node.expanded = true;
    expandedSetRef.current.add(node.path);
  }

  function collapseNode(node: DirNode): void {
    node.expanded = false;
    expandedSetRef.current.delete(node.path);
  }

  const flatCacheRef = useRef<{ expanded: string; result: FlatEntry[] } | null>(null);
  const expandedKey = [...expandedSetRef.current].sort().join(",");
  let flatEntries: FlatEntry[];
  if (flatCacheRef.current?.expanded === expandedKey) {
    flatEntries = flatCacheRef.current.result;
  } else {
    flatEntries = flattenVisible(rootNodesRef.current!, 0, []);
    flatCacheRef.current = { expanded: expandedKey, result: flatEntries };
  }

  // Clamp cursor
  if (cursorRef.current >= flatEntries.length && flatEntries.length > 0) {
    cursorRef.current = flatEntries.length - 1;
  }

  const handleInput = useCallback((event: KeyEvent) => {
    const entries = flattenVisible(rootNodesRef.current!, 0, []);
    if (entries.length === 0) return;

    if (event.key === "up") {
      cursorRef.current =
        cursorRef.current > 0 ? cursorRef.current - 1 : entries.length - 1;
      requestRender();
    } else if (event.key === "down") {
      cursorRef.current =
        cursorRef.current < entries.length - 1 ? cursorRef.current + 1 : 0;
      requestRender();
    } else if (event.key === "return") {
      const entry = entries[cursorRef.current];
      if (!entry) return;
      if (entry.node.isDir) {
        if (entry.node.expanded) {
          collapseNode(entry.node);
        } else {
          expandNode(entry.node);
        }
        requestRender();
      } else {
        onSelectRef.current?.(entry.node.path);
      }
    } else if (event.key === "right") {
      const entry = entries[cursorRef.current];
      if (entry && entry.node.isDir && !entry.node.expanded) {
        expandNode(entry.node);
        requestRender();
      }
    } else if (event.key === "left") {
      const entry = entries[cursorRef.current];
      if (entry && entry.node.isDir && entry.node.expanded) {
        collapseNode(entry.node);
        requestRender();
      }
    }
  }, [requestRender, showHidden, showFiles]);

  useInput(handleInput, { isActive: isFocused });

  const rows: React.ReactElement[] = [];

  for (let i = 0; i < flatEntries.length; i++) {
    const entry = flatEntries[i]!;
    const isHighlighted = i === cursorRef.current;

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

    // Icon and name
    let icon: string;
    let nameColor: string | number;
    if (entry.node.isDir) {
      icon = entry.node.expanded ? "\u25BE " : "\u25B8 "; // ▾ or ▸
      nameColor = dirColor;
    } else {
      icon = getFileIcon(entry.node.name) + " ";
      nameColor = fileColor;
    }

    const children: React.ReactElement[] = [];

    // Cursor indicator
    children.push(
      React.createElement(
        "tui-text",
        { key: "cursor", color: isHighlighted ? colors.brand.primary : undefined },
        isHighlighted ? "\u276F " : "  ", // ❯
      ),
    );

    // Tree connector
    children.push(
      React.createElement(
        "tui-text",
        { key: "prefix", color: colors.divider },
        prefix,
      ),
    );

    // Icon + name
    children.push(
      React.createElement(
        "tui-text",
        {
          key: "name",
          color: isHighlighted ? colors.text.primary : nameColor,
          bold: isHighlighted,
        },
        icon + entry.node.name + (entry.node.isDir ? "/" : ""),
      ),
    );

    // Loading spinner for async child loading
    if (entry.node.isDir && entry.node.expanded && loadingPathsRef.current.has(entry.node.path)) {
      children.push(
        React.createElement(
          "tui-text",
          { key: "loading", color: colors.text.dim },
          " \u23F3 loading\u2026",
        ),
      );
    }

    if (props.renderEntry) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: entry.node.path, flexDirection: "row" },
          props.renderEntry(entry.node, {
            isHighlighted,
            isExpanded: !!entry.node.expanded,
            depth: entry.depth,
          }),
        ),
      );
    } else {
      rows.push(
        React.createElement(
          "tui-box",
          { key: entry.node.path, flexDirection: "row" },
          ...children,
        ),
      );
    }
  }

  if (rows.length === 0) {
    if (loadingPathsRef.current.has(canonicalRootPath)) {
      rows.push(
        React.createElement(
          "tui-text",
          { key: "loading", color: colors.text.dim },
          "  \u23F3 loading\u2026",
        ),
      );
    } else {
      rows.push(
        React.createElement(
          "tui-text",
          { key: "empty", color: colors.text.dim },
          "  (empty directory)",
        ),
      );
    }
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column", role: "tree" },
    ...rows,
  );
});

export const DirectoryTree = Object.assign(DirectoryTreeBase, {
  Root: DirectoryTreeRoot,
  Node: DirectoryTreeCompoundNode,
});
