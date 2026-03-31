/**
 * Table — bordered table with headers and rows.
 *
 * Renders a table using Box layout with optional striped rows.
 * Each column gets a fixed width based on max content width.
 * Supports row virtualization for large datasets.
 * Supports horizontal scrolling with arrow indicators.
 * Supports row highlight (inverse) and onRowSelect callback.
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import type { KeyEvent } from "../input/types.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { DEFAULTS } from "../styles/defaults.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface TableProps extends StormContainerStyleProps {
  columns: TableColumn[];
  data: Record<string, string | number>[];
  headerColor?: string | number;
  stripe?: boolean;
  /** Maximum rows rendered at once (default 100). Rows beyond this are virtualized. */
  maxVisibleRows?: number;
  /** Current scroll offset into the data array (default 0). */
  scrollOffset?: number;
  /** Called when the scroll offset changes due to virtualization. */
  onScrollChange?: (offset: number) => void;
  /** Whether the table is focused for keyboard input. */
  isFocused?: boolean;
  /** Called when Enter is pressed on a data row. Receives the row index. */
  onRowSelect?: (rowIndex: number) => void;
  /** When true, highlight the current row with inverse styling. */
  rowHighlight?: boolean;
  /** Visible width of the table in columns for horizontal scroll (default: total column width). */
  visibleWidth?: number;
  /** Enable column sorting. Press "s" to cycle sort on the current column header. */
  sortable?: boolean;
  /** Called when a column sort is triggered. */
  onSort?: (columnKey: string, direction: "asc" | "desc") => void;
  /** Custom renderer for individual cells. */
  renderCell?: (value: string | number, column: TableColumn, rowIndex: number) => React.ReactNode;
  /** Custom renderer for header cells. */
  renderHeader?: (column: TableColumn) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface TableContextValue {
  columns: TableColumn[];
  registerColumn: (col: TableColumn) => void;
}

export const TableContext = createContext<TableContextValue | null>(null);

export function useTableContext(): TableContextValue {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error("Table sub-components must be used inside Table.Root");
  return ctx;
}

export interface TableRootProps {
  headerColor?: string | number;
  stripe?: boolean;
  isFocused?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}

function TableRoot({ headerColor, stripe, isFocused, children, ...rest }: TableRootProps): React.ReactElement {
  const colors = useColors();
  const columnsRef = useRef<TableColumn[]>([]);

  const ctx: TableContextValue = {
    columns: columnsRef.current,
    registerColumn: (col: TableColumn) => {
      if (!columnsRef.current.find((c) => c.key === col.key)) {
        columnsRef.current.push(col);
      }
    },
  };

  return React.createElement(
    TableContext.Provider,
    { value: ctx },
    React.createElement(
      "tui-box",
      {
        flexDirection: "column",
        borderStyle: DEFAULTS.table.borderStyle,
        borderColor: colors.divider,
        ...(rest["aria-label"] !== undefined ? { "aria-label": rest["aria-label"] } : {}),
      },
      children,
    ),
  );
}

export interface TableCompoundHeaderProps {
  children: React.ReactNode;
}

function TableCompoundHeader({ children }: TableCompoundHeaderProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    children,
  );
}

export interface TableCompoundBodyProps {
  children: React.ReactNode;
}

function TableCompoundBody({ children }: TableCompoundBodyProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    children,
  );
}

export interface TableCompoundRowProps {
  children: React.ReactNode;
  highlighted?: boolean;
}

function TableCompoundRow({ children, highlighted = false }: TableCompoundRowProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-box",
    {
      flexDirection: "row",
      ...(highlighted ? { inverse: true } : {}),
    },
    children,
  );
}

export interface TableCompoundCellProps {
  children: React.ReactNode;
  width?: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  color?: string | number;
}

function TableCompoundCell({ children, width, align, bold, color: cellColor }: TableCompoundCellProps): React.ReactElement {
  const colors = useColors();
  const props: Record<string, unknown> = {};
  if (width !== undefined) props["width"] = width;
  if (bold) props["bold"] = true;
  if (cellColor !== undefined) props["color"] = cellColor;

  return React.createElement("tui-text", props, children);
}

// ── Recipe API (original) ───────────────────────────────────────

/** Max rows to sample when auto-sizing column widths. */
const COL_WIDTH_SAMPLE_SIZE = 100;

function padCell(text: string, width: number, align: "left" | "center" | "right"): string {
  if (text.length > width) return text.slice(0, width - 1) + "\u2026";
  const gap = width - text.length;
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") {
    const left = Math.floor(gap / 2);
    return " ".repeat(left) + text + " ".repeat(gap - left);
  }
  return text + " ".repeat(gap);
}

const TableBase = React.memo(function Table(rawProps: TableProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Table", rawProps as unknown as Record<string, unknown>) as unknown as TableProps;
  const {
    columns,
    data,
    headerColor = colors.brand.primary,
    stripe = false,
    maxVisibleRows = 100,
    scrollOffset = 0,
    onScrollChange,
    isFocused = false,
    onRowSelect,
    rowHighlight = false,
    visibleWidth,
    sortable = false,
    onSort,
  } = props;

  const { requestRender } = useTui();
  const scrollRef = useRef(scrollOffset);
  const cursorRowRef = useRef(0);
  const hScrollRef = useRef(0);
  const sortStateRef = useRef<{ column: string; direction: "asc" | "desc" } | null>(null);
  const cursorColRef = useRef(0);

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);
  const borderStyle = (userStyles.borderStyle as string | undefined) ?? DEFAULTS.table.borderStyle;
  const borderColor = (userStyles.borderColor as string | number | undefined) ?? colors.divider;

  // Sync scrollRef with controlled prop
  scrollRef.current = scrollOffset;

  // Compute column widths: sample at most COL_WIDTH_SAMPLE_SIZE rows for auto-sizing
  const colWidths = columns.map((col) => {
    if (col.width !== undefined) return col.width;
    let max = col.header.length;
    const sampleCount = Math.min(data.length, COL_WIDTH_SAMPLE_SIZE);
    for (let i = 0; i < sampleCount; i++) {
      const row = data[i]!;
      const val = row[col.key];
      const len = val !== undefined ? String(val).length : 0;
      if (len > max) max = len;
    }
    return max;
  });

  // Total content width (each cell has 1-char padding on each side)
  const totalContentWidth = colWidths.reduce((sum, w) => sum + w + 2, 0) + (colWidths.length - 1); // +separators
  const effectiveVisibleWidth = visibleWidth ?? totalContentWidth;
  const canHScroll = totalContentWidth > effectiveVisibleWidth;
  const maxHScroll = Math.max(0, totalContentWidth - effectiveVisibleWidth);

  // Clamp hScroll
  if (hScrollRef.current > maxHScroll) hScrollRef.current = maxHScroll;
  if (hScrollRef.current < 0) hScrollRef.current = 0;

  // Clamp cursor row
  if (data.length > 0 && cursorRowRef.current >= data.length) {
    cursorRowRef.current = data.length - 1;
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const maxOffset = Math.max(0, data.length - maxVisibleRows);
      const prev = scrollRef.current;
      let changed = false;

      if (event.key === "up") {
        if (rowHighlight && cursorRowRef.current > 0) {
          cursorRowRef.current -= 1;
          // Adjust vertical scroll to keep cursor visible
          if (cursorRowRef.current < scrollRef.current) {
            scrollRef.current = cursorRowRef.current;
          }
          changed = true;
        } else if (!rowHighlight) {
          scrollRef.current = Math.max(0, scrollRef.current - 1);
          changed = scrollRef.current !== prev;
        }
      } else if (event.key === "down") {
        if (rowHighlight && cursorRowRef.current < data.length - 1) {
          cursorRowRef.current += 1;
          // Adjust vertical scroll to keep cursor visible
          if (cursorRowRef.current >= scrollRef.current + maxVisibleRows) {
            scrollRef.current = cursorRowRef.current - maxVisibleRows + 1;
          }
          changed = true;
        } else if (!rowHighlight) {
          scrollRef.current = Math.min(maxOffset, scrollRef.current + 1);
          changed = scrollRef.current !== prev;
        }
      } else if (event.key === "left") {
        if (sortable && cursorColRef.current > 0) {
          cursorColRef.current -= 1;
          changed = true;
        }
        if (canHScroll) {
          const prevH = hScrollRef.current;
          hScrollRef.current = Math.max(0, hScrollRef.current - 3);
          changed = changed || hScrollRef.current !== prevH;
        }
      } else if (event.key === "right") {
        if (sortable && cursorColRef.current < columns.length - 1) {
          cursorColRef.current += 1;
          changed = true;
        }
        if (canHScroll) {
          const prevH = hScrollRef.current;
          hScrollRef.current = Math.min(maxHScroll, hScrollRef.current + 3);
          changed = changed || hScrollRef.current !== prevH;
        }
      } else if (event.key === "pageup") {
        scrollRef.current = Math.max(0, scrollRef.current - maxVisibleRows);
        if (rowHighlight) {
          cursorRowRef.current = Math.max(0, cursorRowRef.current - maxVisibleRows);
        }
        changed = scrollRef.current !== prev;
      } else if (event.key === "pagedown") {
        scrollRef.current = Math.min(maxOffset, scrollRef.current + maxVisibleRows);
        if (rowHighlight) {
          cursorRowRef.current = Math.min(data.length - 1, cursorRowRef.current + maxVisibleRows);
        }
        changed = scrollRef.current !== prev;
      } else if (event.key === "return" && rowHighlight && onRowSelect) {
        onRowSelect(cursorRowRef.current);
        return;
      } else if (sortable && (event.char === "s" || event.char === "S")) {
        // Toggle sort on current column
        const col = columns[cursorColRef.current];
        if (col) {
          const prev = sortStateRef.current;
          let newDir: "asc" | "desc" = "asc";
          if (prev && prev.column === col.key && prev.direction === "asc") {
            newDir = "desc";
          }
          sortStateRef.current = { column: col.key, direction: newDir };
          if (onSort) {
            onSort(col.key, newDir);
          }
          requestRender();
        }
        return;
      }

      if (changed) {
        if (scrollRef.current !== prev) {
          onScrollChange?.(scrollRef.current);
        }
        requestRender();
      }
    },
    [data.length, maxVisibleRows, onScrollChange, requestRender, rowHighlight, onRowSelect, canHScroll, maxHScroll, sortable, onSort, columns],
  );

  useInput(handleInput, { isActive: isFocused });

  if (data.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No data",
    );
  }

  /** Apply horizontal scroll: slice a rendered line to the visible window */
  function applyHScroll(line: string): string {
    if (!canHScroll) return line;
    const sliced = line.slice(hScrollRef.current, hScrollRef.current + effectiveVisibleWidth);
    const leftArrow = hScrollRef.current > 0 ? "\u25C0" : " ";
    const rightArrow = hScrollRef.current < maxHScroll ? "\u25B6" : " ";
    return leftArrow + sliced.slice(1, -1) + rightArrow;
  }

  const elements: React.ReactElement[] = [];

  // Header row — bold + secondary color for visual hierarchy, with sort indicators
  if (props.renderHeader) {
    const headerCells = columns.map((col) =>
      React.createElement("tui-box", { key: col.key, flexDirection: "row" }, props.renderHeader!(col)),
    );
    elements.push(
      React.createElement(
        "tui-box",
        { key: "header", flexDirection: "row" },
        ...headerCells,
      ),
    );
  } else {
    const headerLine = columns.map((col, ci) => {
      let headerText = col.header;
      if (sortable && sortStateRef.current && sortStateRef.current.column === col.key) {
        headerText += sortStateRef.current.direction === "asc" ? " \u25B2" : " \u25BC"; // ▲ or ▼
      }
      return " " + padCell(headerText, colWidths[ci]!, col.align ?? "left") + " ";
    }).join("\u2502");

    elements.push(
      React.createElement(
        "tui-text",
        { key: "header", bold: true, color: headerColor, underline: true },
        applyHScroll(headerLine),
      ),
    );
  }

  // Separator — solid line between header and body
  const separatorText = columns
    .map((_col, ci) => "\u2500".repeat(colWidths[ci]! + 2))
    .join("\u253C");
  elements.push(
    React.createElement(
      "tui-text",
      { key: "sep", color: borderColor },
      applyHScroll(separatorText),
    ),
  );

  // Virtualization: compute visible window
  const totalRows = data.length;
  const needsVirtualization = totalRows > maxVisibleRows;
  const clampedOffset = needsVirtualization
    ? Math.max(0, Math.min(scrollOffset, totalRows - maxVisibleRows))
    : 0;
  const visibleStart = clampedOffset;
  const visibleEnd = needsVirtualization
    ? Math.min(clampedOffset + maxVisibleRows, totalRows)
    : totalRows;

  // Data rows (only the visible window) — zebra striping via background color
  for (let ri = visibleStart; ri < visibleEnd; ri++) {
    const row = data[ri]!;
    const isOdd = ri % 2 === 1;
    const isCursorRow = rowHighlight && ri === cursorRowRef.current;

    const rowBoxProps: Record<string, unknown> = {
      key: `rowbox-${ri}`,
      flexDirection: "row",
    };
    // Zebra striping: odd rows get a raised surface background
    if (stripe && isOdd && !isCursorRow) {
      rowBoxProps["backgroundColor"] = colors.surface.raised;
    }

    if (props.renderCell) {
      const cellElements = columns.map((col) => {
        const val = row[col.key];
        return React.createElement(
          "tui-box",
          { key: col.key, flexDirection: "row" },
          props.renderCell!(val !== undefined ? val : "", col, ri),
        );
      });
      elements.push(
        React.createElement("tui-box", rowBoxProps, ...cellElements),
      );
    } else {
      const rowLine = columns.map((col, ci) => {
        const val = row[col.key];
        const text = val !== undefined ? String(val) : "";
        return " " + padCell(text, colWidths[ci]!, col.align ?? "left") + " ";
      }).join("\u2502");

      const textProps: Record<string, unknown> = { key: `row-${ri}` };
      if (isCursorRow) {
        textProps["inverse"] = true;
        textProps["bold"] = true;
      }

      elements.push(
        React.createElement(
          "tui-box",
          rowBoxProps,
          React.createElement("tui-text", textProps, applyHScroll(rowLine)),
        ),
      );
    }
  }

  // Row count indicator when virtualized
  if (needsVirtualization) {
    const indicatorText = `Showing ${visibleStart + 1}-${visibleEnd} of ${totalRows.toLocaleString()}`;
    elements.push(
      React.createElement(
        "tui-text",
        { key: "row-indicator", color: colors.text.dim, dim: true },
        indicatorText,
      ),
    );
  }

  // Horizontal scroll indicator
  if (canHScroll) {
    const pct = maxHScroll > 0 ? Math.round((hScrollRef.current / maxHScroll) * 100) : 0;
    elements.push(
      React.createElement(
        "tui-text",
        { key: "hscroll-indicator", color: colors.text.dim, dim: true },
        `\u2190\u2192 Scroll: ${pct}%`,
      ),
    );
  }

  const boxProps = mergeBoxStyles(
    {
      role: "table",
      flexDirection: "column",
      overflow: "hidden",
      borderStyle,
      borderColor,
    },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...elements,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Table = Object.assign(TableBase, {
  Root: TableRoot,
  Header: TableCompoundHeader,
  Body: TableCompoundBody,
  Row: TableCompoundRow,
  Cell: TableCompoundCell,
});
