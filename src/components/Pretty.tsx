/**
 * Pretty — JSON/object pretty-printer with collapsible nodes.
 *
 * Recursively formats data with syntax coloring: strings in success,
 * numbers in brand.light, booleans in brand.primary, null/undefined
 * in text.dim, keys in text.primary. Truncates at maxDepth with "...".
 *
 * When interactive=true, objects/arrays can be collapsed with Enter/Space.
 * Collapsed nodes show `{...N}` or `[...N]` with item count.
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import type { KeyEvent } from "../input/types.js";
import { useTui } from "../context/TuiContext.js";
import type { StormColors } from "../theme/colors.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface PrettyProps {
  data: unknown;
  indent?: number;
  color?: boolean;
  maxDepth?: number;
  /** Enable interactive mode: collapse/expand objects and arrays. */
  interactive?: boolean;
  /** Whether the component is focused for keyboard navigation. */
  isFocused?: boolean;
  /** When provided, highlight all matching text (case-insensitive) in the JSON output with inverse styling. */
  searchQuery?: string;
  /** Custom value renderer. Return null to use default rendering. */
  renderValue?: (value: unknown, path: string, depth: number) => React.ReactNode | null;
}

// ── Compound Component API ──────────────────────────────────────

export interface PrettyContextValue {
  collapsedPaths: ReadonlySet<string>;
  toggleCollapsed: (path: string) => void;
  cursor: number;
  setCursor: (index: number) => void;
}

export const PrettyContext = createContext<PrettyContextValue | null>(null);

export function usePrettyContext(): PrettyContextValue {
  const ctx = useContext(PrettyContext);
  if (!ctx) throw new Error("Pretty sub-components must be used inside Pretty.Root");
  return ctx;
}

export interface PrettyRootProps {
  collapsedPaths?: ReadonlySet<string>;
  onToggleCollapsed?: (path: string) => void;
  cursor?: number;
  onCursorChange?: (index: number) => void;
  children: React.ReactNode;
}

function PrettyRoot({
  collapsedPaths = new Set(),
  onToggleCollapsed,
  cursor = 0,
  onCursorChange,
  children,
}: PrettyRootProps): React.ReactElement {
  const { requestRender } = useTui();
  const onToggleRef = useRef(onToggleCollapsed);
  onToggleRef.current = onToggleCollapsed;
  const onCursorRef = useRef(onCursorChange);
  onCursorRef.current = onCursorChange;

  const ctx: PrettyContextValue = {
    collapsedPaths,
    toggleCollapsed: (p: string) => { onToggleRef.current?.(p); requestRender(); },
    cursor,
    setCursor: (i: number) => { onCursorRef.current?.(i); requestRender(); },
  };

  return React.createElement(
    PrettyContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface PrettyCompoundNodeProps {
  text: string;
  path?: string;
  collapsible?: boolean;
  isCollapsed?: boolean;
  color?: string;
  bold?: boolean;
  children?: React.ReactNode;
}

function PrettyCompoundNode({ text, path, collapsible, isCollapsed, color, bold, children }: PrettyCompoundNodeProps): React.ReactElement {
  const colors = useColors();
  const { collapsedPaths } = usePrettyContext();
  const collapsed = isCollapsed || (path ? collapsedPaths.has(path) : false);

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  let displayText = text;
  if (collapsible) {
    const indicator = collapsed ? "\u25B8 " : "\u25BE ";
    const leading = text.match(/^(\s*)/)?.[1] ?? "";
    displayText = leading + indicator + text.trimStart();
  }

  const textProps: Record<string, unknown> = {};
  if (color) textProps.color = color;
  if (bold) textProps.bold = true;

  return React.createElement("tui-text", textProps, displayText);
}

// ── Recipe API helpers ─────────────────────────────────────────

interface Line {
  text: string;
  color?: string;
  bold?: boolean;
  /** JSON path for this line (used for collapse tracking). */
  path?: string;
  /** Whether this line is the opening of a collapsible node. */
  collapsible?: boolean;
  /** Whether this is an inline collapsed representation. */
  isCollapsed?: boolean;
}

function formatValue(
  data: unknown,
  indent: number,
  useColor: boolean,
  maxDepth: number,
  currentDepth: number,
  prefix: string,
  currentPath: string,
  collapsedPaths: Set<string>,
  colors: StormColors,
  visited: Set<object> = new Set(),
): Line[] {
  const pad = " ".repeat(currentDepth * indent);
  const innerPad = " ".repeat((currentDepth + 1) * indent);

  if (data === null) {
    return [{ text: `${prefix}null`, ...(useColor ? { color: colors.text.dim } : {}), path: currentPath }];
  }

  if (data === undefined) {
    return [{ text: `${prefix}undefined`, ...(useColor ? { color: colors.text.dim } : {}), path: currentPath }];
  }

  if (typeof data === "string") {
    return [{ text: `${prefix}"${data}"`, ...(useColor ? { color: colors.success } : {}), path: currentPath }];
  }

  if (typeof data === "number") {
    return [{ text: `${prefix}${data}`, ...(useColor ? { color: colors.brand.light } : {}), path: currentPath }];
  }

  if (typeof data === "boolean") {
    return [{ text: `${prefix}${data}`, ...(useColor ? { color: colors.brand.primary } : {}), path: currentPath }];
  }

  if (currentDepth >= maxDepth) {
    return [{ text: `${prefix}...`, ...(useColor ? { color: colors.text.dim } : {}), path: currentPath }];
  }

  if (Array.isArray(data)) {
    if (visited.has(data)) {
      return [{ text: `${prefix}[Circular]`, ...(useColor ? { color: colors.text.dim } : {}), path: currentPath }];
    }
    visited.add(data);
    if (data.length === 0) {
      return [{ text: `${prefix}[]`, path: currentPath }];
    }

    // Check if collapsed
    if (collapsedPaths.has(currentPath)) {
      return [{
        text: `${prefix}[...${data.length}]`,
        ...(useColor ? { color: colors.text.dim } : {}),
        path: currentPath,
        collapsible: true,
        isCollapsed: true,
      }];
    }

    const lines: Line[] = [];
    lines.push({ text: `${prefix}[`, path: currentPath, collapsible: true });
    for (let i = 0; i < data.length; i++) {
      const comma = i < data.length - 1 ? "," : "";
      const itemPath = `${currentPath}[${i}]`;
      const itemLines = formatValue(data[i], indent, useColor, maxDepth, currentDepth + 1, innerPad, itemPath, collapsedPaths, colors, visited);
      if (itemLines.length === 1) {
        lines.push({ ...itemLines[0]!, text: itemLines[0]!.text + comma });
      } else {
        for (let j = 0; j < itemLines.length; j++) {
          if (j === itemLines.length - 1) {
            lines.push({ ...itemLines[j]!, text: itemLines[j]!.text + comma });
          } else {
            lines.push(itemLines[j]!);
          }
        }
      }
    }
    lines.push({ text: `${pad}]`, path: currentPath });
    return lines;
  }

  if (typeof data === "object") {
    if (visited.has(data as object)) {
      return [{ text: `${prefix}[Circular]`, ...(useColor ? { color: colors.text.dim } : {}), path: currentPath }];
    }
    visited.add(data as object);
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return [{ text: `${prefix}{}`, path: currentPath }];
    }

    // Check if collapsed
    if (collapsedPaths.has(currentPath)) {
      return [{
        text: `${prefix}{...${entries.length}}`,
        ...(useColor ? { color: colors.text.dim } : {}),
        path: currentPath,
        collapsible: true,
        isCollapsed: true,
      }];
    }

    const lines: Line[] = [];
    lines.push({ text: `${prefix}{`, path: currentPath, collapsible: true });
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i]!;
      const comma = i < entries.length - 1 ? "," : "";
      const valPath = `${currentPath}.${key}`;
      const valLines = formatValue(val, indent, useColor, maxDepth, currentDepth + 1, "", valPath, collapsedPaths, colors, visited);
      if (valLines.length === 1) {
        lines.push({
          text: `${innerPad}${key}: ${valLines[0]!.text.trimStart()}${comma}`,
          ...(valLines[0]!.color ? { color: valLines[0]!.color } : {}),
          ...(valLines[0]!.collapsible ? { path: valPath, collapsible: valLines[0]!.collapsible } : {}),
        });
      } else {
        lines.push({
          text: `${innerPad}${key}: ${valLines[0]!.text.trimStart()}`,
          ...(valLines[0]!.collapsible ? { path: valPath, collapsible: valLines[0]!.collapsible } : {}),
        });
        for (let j = 1; j < valLines.length; j++) {
          if (j === valLines.length - 1) {
            lines.push({ ...valLines[j]!, text: valLines[j]!.text + comma });
          } else {
            lines.push(valLines[j]!);
          }
        }
      }
    }
    lines.push({ text: `${pad}}`, path: currentPath });
    return lines;
  }

  return [{ text: `${prefix}${String(data)}`, path: currentPath }];
}

const PrettyBase = React.memo(function Pretty(rawProps: PrettyProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Pretty", rawProps as unknown as Record<string, unknown>) as unknown as PrettyProps;
  const {
    data,
    indent = 2,
    color = true,
    maxDepth = 5,
    interactive = false,
    isFocused = false,
    searchQuery,
  } = props;

  const { requestRender } = useTui();
  const collapsedPathsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef(0);

  const lines = formatValue(data, indent, color, maxDepth, 0, "", "$", collapsedPathsRef.current, colors);

  // Collect navigable lines (collapsible nodes) for interactive mode
  const navigableIndices: number[] = [];
  if (interactive) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.collapsible) {
        navigableIndices.push(i);
      }
    }
  }

  // Clamp cursor
  if (cursorRef.current >= navigableIndices.length) {
    cursorRef.current = Math.max(0, navigableIndices.length - 1);
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      if (!interactive || navigableIndices.length === 0) return;

      if (event.key === "up") {
        if (cursorRef.current > 0) {
          cursorRef.current -= 1;
          requestRender();
        }
      } else if (event.key === "down") {
        if (cursorRef.current < navigableIndices.length - 1) {
          cursorRef.current += 1;
          requestRender();
        }
      } else if (event.key === "return" || event.key === "space") {
        const lineIdx = navigableIndices[cursorRef.current];
        if (lineIdx !== undefined) {
          const line = lines[lineIdx];
          if (line?.path) {
            if (collapsedPathsRef.current.has(line.path)) {
              collapsedPathsRef.current.delete(line.path);
            } else {
              collapsedPathsRef.current.add(line.path);
            }
            requestRender();
          }
        }
      }
    },
    [interactive, navigableIndices, lines, requestRender],
  );

  useInput(handleInput, { isActive: interactive && isFocused });

  const currentNavigableLineIdx = navigableIndices.length > 0
    ? navigableIndices[cursorRef.current]
    : -1;

  // Count search matches across all lines
  const hasSearch = searchQuery !== undefined && searchQuery.length > 0;
  let totalMatches = 0;
  if (hasSearch) {
    const lowerQuery = searchQuery!.toLowerCase();
    for (const line of lines) {
      let searchIdx = 0;
      const lowerText = line.text.toLowerCase();
      while (searchIdx < lowerText.length) {
        const found = lowerText.indexOf(lowerQuery, searchIdx);
        if (found === -1) break;
        totalMatches += 1;
        searchIdx = found + lowerQuery.length;
      }
    }
  }

  /** Split a display string into segments with search highlights. Returns array of tui-text elements. */
  function renderWithHighlights(
    displayText: string,
    baseProps: Record<string, unknown>,
    lineKey: number,
  ): React.ReactElement[] {
    if (!hasSearch) {
      return [React.createElement("tui-text", { ...baseProps, key: lineKey }, displayText)];
    }
    const lowerQuery = searchQuery!.toLowerCase();
    const lowerText = displayText.toLowerCase();
    const segments: React.ReactElement[] = [];
    let pos = 0;
    let segIdx = 0;
    while (pos < displayText.length) {
      const found = lowerText.indexOf(lowerQuery, pos);
      if (found === -1) {
        segments.push(
          React.createElement("tui-text", { ...baseProps, key: `${lineKey}-${segIdx}` }, displayText.slice(pos)),
        );
        break;
      }
      if (found > pos) {
        segments.push(
          React.createElement("tui-text", { ...baseProps, key: `${lineKey}-${segIdx}` }, displayText.slice(pos, found)),
        );
        segIdx += 1;
      }
      segments.push(
        React.createElement(
          "tui-text",
          { ...baseProps, key: `${lineKey}-${segIdx}`, inverse: true },
          displayText.slice(found, found + lowerQuery.length),
        ),
      );
      segIdx += 1;
      pos = found + lowerQuery.length;
    }
    if (segments.length === 0) {
      segments.push(React.createElement("tui-text", { ...baseProps, key: lineKey }, displayText));
    }
    return segments;
  }

  const children: React.ReactElement[] = [];

  // Show match count header when searching
  if (hasSearch) {
    children.push(
      React.createElement(
        "tui-text",
        { key: "__match-count", color: colors.brand.primary, bold: true },
        `${totalMatches} match${totalMatches === 1 ? "" : "es"}`,
      ),
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Try custom renderValue if provided
    if (props.renderValue && line.path) {
      // Compute the depth from the path
      const pathDepth = (line.path.match(/\./g) || []).length + (line.path.match(/\[/g) || []).length;
      // Extract the raw value at this path from data for the callback
      const customResult = props.renderValue(line.text, line.path, pathDepth);
      if (customResult !== null) {
        children.push(
          React.createElement("tui-box", { key: i, flexDirection: "row" }, customResult),
        );
        continue;
      }
    }

    const textProps: Record<string, unknown> = {};
    if (line.color) {
      textProps.color = line.color;
    }
    if (line.bold) {
      textProps.bold = true;
    }

    const isCurrentNode = interactive && isFocused && i === currentNavigableLineIdx;
    if (isCurrentNode) {
      textProps.inverse = true;
      textProps.bold = true;
    }

    // Add collapse indicator for collapsible lines
    let displayText = line.text;
    if (interactive && line.collapsible) {
      const collapsed = line.isCollapsed || (line.path ? collapsedPathsRef.current.has(line.path) : false);
      const indicator = collapsed ? "\u25B8 " : "\u25BE "; // ▸ or ▾
      displayText = indicator + displayText.trimStart();
      // Preserve original indentation
      const leading = line.text.match(/^(\s*)/)?.[1] ?? "";
      displayText = leading + displayText;
    }

    if (hasSearch && !isCurrentNode) {
      // Wrap in a box to hold multiple text segments for highlighting
      const segments = renderWithHighlights(displayText, textProps, i);
      children.push(
        React.createElement("tui-box", { key: i, flexDirection: "row" }, ...segments),
      );
    } else {
      children.push(React.createElement("tui-text", { ...textProps, key: i }, displayText));
    }
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column", role: "document" },
    ...children,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Pretty = Object.assign(PrettyBase, {
  Root: PrettyRoot,
  Node: PrettyCompoundNode,
});
