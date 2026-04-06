import React, { useCallback, useRef, createContext, useContext } from "react";
import fs from "node:fs";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import type { KeyEvent } from "../../input/types.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

/** Entry descriptor returned by onLoadEntries. */
export interface FilePickerChildEntry {
  name: string;
  isDirectory: boolean;
}

export interface FilePickerProps {
  files: readonly FileNode[];
  onSelect?: (path: string) => void;
  selectedPath?: string;
  maxVisible?: number;
  isFocused?: boolean;
  color?: string | number;
  /** Only show files with these extensions (e.g. [".ts", ".tsx"]). Directories are always shown. */
  extensions?: string[];
  /** Show file sizes to the right of filenames. */
  showSize?: boolean;
  /** Show last modified date in dim text. */
  showModified?: boolean;
  /** Custom render for each file/directory entry. */
  renderEntry?: (file: FileNode, state: { isHighlighted: boolean; isExpanded: boolean; depth: number }) => React.ReactNode;
  /** Custom async entry loader. When provided, replaces the default sync fs.statSync for metadata.
   *  Called when a directory is expanded to load its children. Return an array of entries. */
  onLoadEntries?: (path: string) => FilePickerChildEntry[] | Promise<FilePickerChildEntry[]>;
  "aria-label"?: string;
}

export interface FilePickerContextValue {
  expandedPaths: ReadonlySet<string>;
  toggleExpanded: (path: string) => void;
  highlightIndex: number;
  setHighlightIndex: (index: number) => void;
  searchFilter: string;
  setSearchFilter: (filter: string) => void;
}

export const FilePickerContext = createContext<FilePickerContextValue | null>(null);

export function useFilePickerContext(): FilePickerContextValue {
  const ctx = useContext(FilePickerContext);
  if (!ctx) throw new Error("FilePicker sub-components must be used inside FilePicker.Root");
  return ctx;
}

export interface FilePickerRootProps {
  children: React.ReactNode;
  expandedPaths?: ReadonlySet<string>;
  onToggleExpanded?: (path: string) => void;
  highlightIndex?: number;
  onHighlightChange?: (index: number) => void;
  searchFilter?: string;
  onSearchFilterChange?: (filter: string) => void;
}

function FilePickerRoot({
  children,
  expandedPaths = new Set(),
  onToggleExpanded,
  highlightIndex = 0,
  onHighlightChange,
  searchFilter = "",
  onSearchFilterChange,
}: FilePickerRootProps): React.ReactElement {
  const { requestRender } = useTui();
  const onToggleRef = useRef(onToggleExpanded);
  onToggleRef.current = onToggleExpanded;
  const onHighlightRef = useRef(onHighlightChange);
  onHighlightRef.current = onHighlightChange;
  const onSearchRef = useRef(onSearchFilterChange);
  onSearchRef.current = onSearchFilterChange;

  const ctx: FilePickerContextValue = {
    expandedPaths,
    toggleExpanded: (p: string) => { onToggleRef.current?.(p); requestRender(); },
    highlightIndex,
    setHighlightIndex: (i: number) => { onHighlightRef.current?.(i); requestRender(); },
    searchFilter,
    setSearchFilter: (f: string) => { onSearchRef.current?.(f); requestRender(); },
  };

  return React.createElement(
    FilePickerContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface FilePickerCompoundEntryProps {
  file: FileNode;
  depth?: number;
  index?: number;
  children?: React.ReactNode;
}

function FilePickerEntry({ file, depth = 0, index = 0, children }: FilePickerCompoundEntryProps): React.ReactElement {
  const colors = useColors();
  const { expandedPaths, highlightIndex } = useFilePickerContext();
  const isHighlighted = index === highlightIndex;
  const isExpanded = expandedPaths.has(file.path);
  const icon = file.isDirectory ? "\uD83D\uDCC1" : "\uD83D\uDCC4";
  const suffix = file.isDirectory ? "/" : "";
  const indent = "  ".repeat(depth);

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
    React.createElement("tui-text", { ...(isHighlighted ? { color: colors.brand.primary } : {}) }, `${indent}${icon} `),
    React.createElement(
      "tui-text",
      { ...(isHighlighted ? { bold: true, color: colors.brand.primary } : {}) },
      `${file.name}${suffix}`,
    ),
  );
}

const FOLDER_ICON = "\uD83D\uDCC1"; // 📁
const FILE_ICON = "\uD83D\uDCC4";   // 📄

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}K`;
  }
  return `${bytes}B`;
}

function formatModDate(mtime: Date): string {
  return `${MONTH_NAMES[mtime.getMonth()]} ${String(mtime.getDate()).padStart(2, "0")}`;
}

function matchesExtension(name: string, extensions: string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()));
}

interface FlatEntry {
  node: FileNode;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
}

function flattenNodes(
  nodes: readonly FileNode[],
  depth: number,
  expandedSet: ReadonlySet<string>,
  extensions?: string[],
): FlatEntry[] {
  const result: FlatEntry[] = [];
  for (const node of nodes) {
    if (!node.isDirectory && extensions !== undefined && extensions.length > 0) {
      if (!matchesExtension(node.name, extensions)) {
        continue;
      }
    }
    const hasChildren = node.isDirectory && node.children !== undefined && node.children.length > 0;
    const expanded = expandedSet.has(node.path);
    result.push({ node, depth, expanded, hasChildren });
    if (hasChildren && expanded) {
      result.push(...flattenNodes(node.children!, depth + 1, expandedSet, extensions));
    }
  }
  return result;
}

/** Fuzzy substring match: returns indices of matching characters or null. */
function fuzzyMatch(name: string, query: string): number[] | null {
  const nameLower = name.toLowerCase();
  const queryLower = query.toLowerCase();

  // Simple substring match — find the start index
  const idx = nameLower.indexOf(queryLower);
  if (idx >= 0) {
    const indices: number[] = [];
    for (let i = 0; i < queryLower.length; i++) {
      indices.push(idx + i);
    }
    return indices;
  }

  // Fuzzy character-by-character match
  const indices: number[] = [];
  let qi = 0;
  for (let ni = 0; ni < nameLower.length && qi < queryLower.length; ni++) {
    if (nameLower[ni] === queryLower[qi]) {
      indices.push(ni);
      qi++;
    }
  }
  return qi === queryLower.length ? indices : null;
}

/** Render a filename with matching characters in bold. */
function renderHighlightedName(
  name: string,
  matchIndices: number[] | null,
  baseColor: string | number | undefined,
  isBold: boolean,
  highlightColor: string | number,
): React.ReactElement[] {
  if (!matchIndices || matchIndices.length === 0) {
    return [
      React.createElement(
        "tui-text",
        { key: "name", ...(isBold ? { bold: true, color: baseColor } : { color: baseColor }) },
        name,
      ),
    ];
  }

  const matchSet = new Set(matchIndices);
  const elements: React.ReactElement[] = [];
  let currentRun = "";
  let currentIsMatch = false;
  let segIdx = 0;

  for (let i = 0; i < name.length; i++) {
    const isMatch = matchSet.has(i);
    if (i === 0) {
      currentIsMatch = isMatch;
      currentRun = name[i]!;
    } else if (isMatch === currentIsMatch) {
      currentRun += name[i]!;
    } else {
      elements.push(
        React.createElement(
          "tui-text",
          {
            key: `seg-${segIdx++}`,
            bold: currentIsMatch || isBold,
            color: currentIsMatch ? highlightColor : baseColor,
          },
          currentRun,
        ),
      );
      currentRun = name[i]!;
      currentIsMatch = isMatch;
    }
  }
  if (currentRun.length > 0) {
    elements.push(
      React.createElement(
        "tui-text",
        {
          key: `seg-${segIdx}`,
          bold: currentIsMatch || isBold,
          color: currentIsMatch ? highlightColor : baseColor,
        },
        currentRun,
      ),
    );
  }
  return elements;
}

const FilePickerBase = React.memo(function FilePicker(rawProps: FilePickerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("FilePicker", rawProps);
  const {
    files,
    onSelect,
    selectedPath,
    maxVisible = 15,
    isFocused = true,
    color: colorProp,
    extensions,
    showSize = false,
    showModified = false,
    onLoadEntries,
  } = props;

  const color = colorProp ?? colors.brand.primary;
  const { requestRender } = useTui();

  const expandedPathsRef = useRef<Set<string>>(new Set<string>());
  const highlightIndexRef = useRef(0);
  const searchRef = useRef("");

  const loadingPathsRef = useRef<Set<string>>(new Set());
  // Cache of dynamically loaded children keyed by parent path
  const dynamicChildrenRef = useRef<Map<string, FileNode[]>>(new Map());
  const onLoadEntriesRef = useRef(onLoadEntries);
  onLoadEntriesRef.current = onLoadEntries;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const allEntries = flattenNodes(files, 0, expandedPathsRef.current, extensions);

  const searchQuery = searchRef.current;
  let flatEntries: FlatEntry[];
  let matchCache: Map<string, number[] | null>;

  if (searchQuery) {
    matchCache = new Map();
    flatEntries = [];
    for (const entry of allEntries) {
      const indices = fuzzyMatch(entry.node.name, searchQuery);
      if (indices !== null || entry.node.isDirectory) {
        flatEntries.push(entry);
        if (indices !== null) {
          matchCache.set(entry.node.path, indices);
        }
      }
    }
  } else {
    flatEntries = allEntries;
    matchCache = new Map();
  }

  // Clamp highlight index
  if (highlightIndexRef.current >= flatEntries.length) {
    highlightIndexRef.current = Math.max(0, flatEntries.length - 1);
  }
  let effectiveIndex = highlightIndexRef.current;

  // If selectedPath is provided, try to match it
  if (selectedPath !== undefined) {
    const matchIdx = flatEntries.findIndex((e) => e.node.path === selectedPath);
    if (matchIdx >= 0 && matchIdx !== effectiveIndex) {
      effectiveIndex = matchIdx;
    }
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      if (event.key === "escape") {
        if (searchRef.current.length > 0) {
          searchRef.current = "";
          highlightIndexRef.current = 0;
          requestRender();
        }
        return;
      }

      if (event.key === "backspace") {
        if (searchRef.current.length > 0) {
          searchRef.current = searchRef.current.slice(0, -1);
          highlightIndexRef.current = 0;
          requestRender();
        }
        return;
      }

      if (event.key === "up") {
        highlightIndexRef.current =
          highlightIndexRef.current > 0 ? highlightIndexRef.current - 1 : flatEntries.length - 1;
        requestRender();
      } else if (event.key === "down") {
        highlightIndexRef.current =
          highlightIndexRef.current < flatEntries.length - 1 ? highlightIndexRef.current + 1 : 0;
        requestRender();
      } else if (event.key === "return") {
        const entry = flatEntries[highlightIndexRef.current];
        if (!entry) return;
        if (entry.node.isDirectory) {
          if (expandedPathsRef.current.has(entry.node.path)) {
            expandedPathsRef.current.delete(entry.node.path);
          } else {
            expandedPathsRef.current.add(entry.node.path);
            // Async load children if onLoadEntries provided and not yet loaded
            const loader = onLoadEntriesRef.current;
            if (loader && !entry.node.children?.length && !dynamicChildrenRef.current.has(entry.node.path)) {
              const result = loader(entry.node.path);
              if (result instanceof Promise) {
                loadingPathsRef.current.add(entry.node.path);
                result.then((entries) => {
                  const children: FileNode[] = entries.map((e) => ({
                    name: e.name,
                    path: entry.node.path + "/" + e.name,
                    isDirectory: e.isDirectory,
                  }));
                  dynamicChildrenRef.current.set(entry.node.path, children);
                  entry.node.children = children;
                  loadingPathsRef.current.delete(entry.node.path);
                  requestRender();
                }).catch(() => {
                  loadingPathsRef.current.delete(entry.node.path);
                  requestRender();
                });
              } else {
                const children: FileNode[] = result.map((e) => ({
                  name: e.name,
                  path: entry.node.path + "/" + e.name,
                  isDirectory: e.isDirectory,
                }));
                dynamicChildrenRef.current.set(entry.node.path, children);
                entry.node.children = children;
              }
            }
          }
          requestRender();
        } else {
          // Select file
          onSelectRef.current?.(entry.node.path);
        }
      } else if (event.key === "left") {
        // Collapse if expanded directory
        const entry = flatEntries[highlightIndexRef.current];
        if (entry && entry.node.isDirectory && entry.expanded) {
          expandedPathsRef.current.delete(entry.node.path);
          requestRender();
        }
      } else if (event.key === "right") {
        // Expand if collapsed directory
        const entry = flatEntries[highlightIndexRef.current];
        if (entry && entry.node.isDirectory && !entry.expanded && entry.hasChildren) {
          expandedPathsRef.current.add(entry.node.path);
          requestRender();
        }
      } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
        // Type-to-search
        searchRef.current += event.char;
        highlightIndexRef.current = 0;
        requestRender();
      }
    },
    [flatEntries, requestRender],
  );

  useInput(handleInput, { isActive: isFocused });

  let scrollStart = 0;
  if (flatEntries.length > maxVisible) {
    // Keep highlighted item in view
    const halfPage = Math.floor(maxVisible / 2);
    scrollStart = Math.max(0, effectiveIndex - halfPage);
    scrollStart = Math.min(scrollStart, flatEntries.length - maxVisible);
  }
  const visibleEntries = flatEntries.slice(scrollStart, scrollStart + maxVisible);

  const statCacheRef = useRef<Map<string, { size: number; mtime: Date }>>(new Map());

  const rows: React.ReactElement[] = [];

  // Search indicator
  if (searchQuery) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "__search", flexDirection: "row" },
        React.createElement("tui-text", { color: colors.text.dim }, "Search: "),
        React.createElement("tui-text", { color: colors.text.primary }, searchQuery),
        React.createElement(
          "tui-text",
          { color: colors.text.dim, dim: true },
          ` (${flatEntries.length} results)`,
        ),
      ),
    );
  }

  for (let i = 0; i < visibleEntries.length; i++) {
    const entry = visibleEntries[i]!;
    const globalIndex = scrollStart + i;
    const isHighlighted = globalIndex === effectiveIndex;

    if (props.renderEntry) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: entry.node.path, flexDirection: "row" },
          props.renderEntry(entry.node, { isHighlighted, isExpanded: entry.expanded, depth: entry.depth }),
        ),
      );
      continue;
    }

    const indent = "  ".repeat(entry.depth);
    const icon = entry.node.isDirectory ? FOLDER_ICON : FILE_ICON;
    const suffix = entry.node.isDirectory ? "/" : "";

    const children: React.ReactElement[] = [];

    // Highlight indicator
    children.push(
      React.createElement(
        "tui-text",
        { key: "ind", color: isHighlighted ? color : undefined },
        isHighlighted ? "\u276F " : "  ",
      ),
    );

    // Indent + icon
    children.push(
      React.createElement(
        "tui-text",
        { key: "prefix", ...(isHighlighted ? { color } : {}) },
        `${indent}${icon} `,
      ),
    );

    // Name with highlighted matching characters
    const matchIndices = matchCache.get(entry.node.path) ?? null;
    const nameColor = isHighlighted ? color : undefined;
    const nameElements = renderHighlightedName(
      `${entry.node.name}${suffix}`,
      searchQuery ? matchIndices : null,
      nameColor,
      isHighlighted,
      colors.brand.primary,
    );
    for (const el of nameElements) {
      children.push(el);
    }

    // Loading spinner for async child loading
    if (entry.node.isDirectory && entry.expanded && loadingPathsRef.current.has(entry.node.path)) {
      children.push(
        React.createElement(
          "tui-text",
          { key: "loading", color: colors.text.dim },
          " \u23F3 loading\u2026",
        ),
      );
    }

    // File metadata (size / modified) — cached to avoid re-statting on every render
    if ((showSize || showModified) && !entry.node.isDirectory) {
      let cached = statCacheRef.current.get(entry.node.path);
      if (!cached) {
        try {
          const stat = fs.statSync(entry.node.path);
          cached = { size: stat.size, mtime: stat.mtime };
          statCacheRef.current.set(entry.node.path, cached);
        } catch {
          // stat failed — skip metadata
        }
      }
      if (cached) {
        if (showSize) {
          children.push(
            React.createElement(
              "tui-text",
              { key: "size", dim: true },
              ` ${formatFileSize(cached.size)}`,
            ),
          );
        }
        if (showModified) {
          children.push(
            React.createElement(
              "tui-text",
              { key: "mod", dim: true },
              ` ${formatModDate(cached.mtime)}`,
            ),
          );
        }
      }
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: entry.node.path, flexDirection: "row" },
        ...children,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column", role: "dialog", "aria-label": props["aria-label"] },
    ...rows,
  );
});

export const FilePicker = Object.assign(FilePickerBase, {
  Root: FilePickerRoot,
  Entry: FilePickerEntry,
});
