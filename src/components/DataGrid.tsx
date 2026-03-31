/**
 * DataGrid — advanced data table with sorting, selection, and multi-select.
 *
 * Renders a table with column headers, sort indicators, selectable rows,
 * and proper alignment. Up/Down navigate rows, Enter selects,
 * Left/Right navigate columns, Enter on header sorts.
 * Supports row virtualization for large datasets.
 * Supports multi-row selection with Space toggle and Shift+Up/Down range.
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import type { KeyEvent } from "../input/types.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface DataGridColumn {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
}

export interface DataGridProps extends StormContainerStyleProps {
  columns: DataGridColumn[];
  rows: Array<Record<string, string | number>>;
  selectedRow?: number;
  onSelect?: (rowIndex: number) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  isFocused?: boolean;
  headerColor?: string | number;
  selectedColor?: string | number;
  "aria-label"?: string;
  /** Maximum rows rendered at once (default 100). Rows beyond this are virtualized. */
  maxVisibleRows?: number;
  /** Called when the scroll offset changes due to navigation or virtualization. */
  onScrollChange?: (offset: number) => void;
  /** Enable multi-row selection. Space toggles, Shift+Up/Down extends range. */
  multiSelect?: boolean;
  /** Called when the set of selected rows changes in multiSelect mode. */
  onSelectionChange?: (selectedIndices: number[]) => void;
  /** Enable inline cell editing. Press Enter on a data cell to edit. */
  editable?: boolean;
  /** Called when a cell edit is confirmed. */
  onCellEdit?: (rowIndex: number, columnKey: string, newValue: string) => void;
  /** Enable column resizing with +/- keys on the header row. */
  resizable?: boolean;
  /** Called when a column is resized. */
  onColumnResize?: (columnKey: string, newWidth: number) => void;
  /** Custom renderer for individual data cells. */
  renderCell?: (value: string | number, column: DataGridColumn, rowIndex: number, state: { isSelected: boolean; isEditing: boolean }) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface DataGridContextValue {
  columns: DataGridColumn[];
  selectedRow: number | undefined;
  onSelect: ((rowIndex: number) => void) | undefined;
  sortColumn: string | undefined;
  sortDirection: "asc" | "desc" | undefined;
  onSort: ((column: string) => void) | undefined;
  headerColor: string | number;
  selectedColor: string | number;
}

export const DataGridContext = createContext<DataGridContextValue | null>(null);

export function useDataGridContext(): DataGridContextValue {
  const ctx = useContext(DataGridContext);
  if (!ctx) throw new Error("DataGrid sub-components must be used inside DataGrid.Root");
  return ctx;
}

export interface DataGridRootProps {
  selectedRow?: number;
  onSelect?: (rowIndex: number) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  headerColor?: string | number;
  selectedColor?: string | number;
  children: React.ReactNode;
  "aria-label"?: string;
}

function DataGridRoot({
  selectedRow,
  onSelect,
  sortColumn,
  sortDirection,
  onSort,
  headerColor: headerColorProp,
  selectedColor: selectedColorProp,
  children,
  ...rest
}: DataGridRootProps): React.ReactElement {
  const colors = useColors();
  const headerColor = headerColorProp ?? colors.brand.primary;
  const selectedColor = selectedColorProp ?? colors.brand.light;
  const ctx: DataGridContextValue = {
    columns: [],
    selectedRow,
    onSelect,
    sortColumn,
    sortDirection,
    onSort,
    headerColor,
    selectedColor,
  };

  return React.createElement(
    DataGridContext.Provider,
    { value: ctx },
    React.createElement(
      "tui-box",
      {
        flexDirection: "column",
        ...(rest["aria-label"] !== undefined ? { "aria-label": rest["aria-label"] } : {}),
      },
      children,
    ),
  );
}

export interface DataGridCompoundColumnProps {
  columnKey: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  children?: React.ReactNode;
}

function DataGridCompoundColumn({ columnKey, label, width, align, children }: DataGridCompoundColumnProps): React.ReactElement {
  const colors = useColors();
  const { headerColor, sortColumn, sortDirection } = useDataGridContext();

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  let sortIndicator = "";
  if (sortColumn === columnKey) {
    sortIndicator = sortDirection === "asc" ? " \u25B2" : " \u25BC";
  }

  return React.createElement(
    "tui-text",
    { bold: true, color: headerColor },
    ` ${label}${sortIndicator} `,
  );
}

export interface DataGridCompoundRowProps {
  index: number;
  children: React.ReactNode;
}

function DataGridCompoundRow({ index, children }: DataGridCompoundRowProps): React.ReactElement {
  const colors = useColors();
  const { selectedRow, selectedColor } = useDataGridContext();
  const isSelected = index === selectedRow;
  const isOdd = index % 2 === 1;

  const rowProps: Record<string, unknown> = {
    flexDirection: "row",
  };

  if (isSelected) {
    // inverse for selection
  } else if (isOdd) {
    rowProps["backgroundColor"] = colors.surface.raised;
  }

  return React.createElement("tui-box", rowProps, children);
}

// ── Recipe API (original) ───────────────────────────────────────

/** Max rows to sample when auto-sizing column widths. */
const COL_WIDTH_SAMPLE_SIZE = 100;

function padCell(text: string, width: number, align: "left" | "right" | "center"): string {
  if (text.length > width) return text.slice(0, width - 1) + "\u2026";
  const gap = width - text.length;
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") {
    const left = Math.floor(gap / 2);
    return " ".repeat(left) + text + " ".repeat(gap - left);
  }
  return text + " ".repeat(gap);
}

const DataGridBase = React.memo(function DataGrid(rawProps: DataGridProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("DataGrid", rawProps as unknown as Record<string, unknown>) as unknown as DataGridProps;
  const {
    columns,
    rows,
    selectedRow,
    onSelect,
    sortColumn,
    sortDirection,
    onSort,
    isFocused = true,
    headerColor: headerColorProp,
    selectedColor: selectedColorProp,
    maxVisibleRows = 100,
    onScrollChange,
    multiSelect = false,
    onSelectionChange,
    editable = false,
    onCellEdit,
    resizable = false,
    onColumnResize,
  } = props;

  const headerColor = headerColorProp ?? colors.brand.primary;
  const selectedColor = selectedColorProp ?? colors.brand.light;

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);
  const borderColor = (userStyles.borderColor as string | number | undefined) ?? colors.divider;

  if (rows.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No data",
    );
  }

  // Clamp selectedRow to valid range
  const clampedSelectedRow = selectedRow !== undefined
    ? Math.max(0, Math.min(selectedRow, rows.length - 1))
    : undefined;

  const { requestRender } = useTui();

  // cursor.row: 0..n = data rows (row 0 = header when onHeaderRow is true)
  // cursor.col: column index for sorting
  // scrollOffset: first visible row index for virtualization
  // onHeaderRow: whether cursor is on the header row (row -1 conceptually)
  const cursorRef = useRef({ row: clampedSelectedRow ?? 0, col: 0, scrollOffset: 0, onHeaderRow: false });
  const selectedSetRef = useRef<Set<number>>(new Set());
  const rangeAnchorRef = useRef<number | null>(null);
  const editingRef = useRef<{ row: number; col: number; value: string; cursor: number } | null>(null);
  const colWidthOverridesRef = useRef<Record<string, number>>({});

  // Clamp cursor
  if (cursorRef.current.row >= rows.length) {
    cursorRef.current.row = Math.max(0, rows.length - 1);
  }
  if (cursorRef.current.col >= columns.length) {
    cursorRef.current.col = Math.max(0, columns.length - 1);
  }

  // Virtualization: determine visible window
  const totalRows = rows.length;
  const needsVirtualization = totalRows > maxVisibleRows;

  // Ensure scrollOffset keeps cursor visible
  if (needsVirtualization) {
    const cursor = cursorRef.current;
    if (cursor.row < cursor.scrollOffset) {
      cursor.scrollOffset = cursor.row;
    } else if (cursor.row >= cursor.scrollOffset + maxVisibleRows) {
      cursor.scrollOffset = cursor.row - maxVisibleRows + 1;
    }
    // Clamp scrollOffset
    cursor.scrollOffset = Math.max(0, Math.min(cursor.scrollOffset, totalRows - maxVisibleRows));
  } else {
    cursorRef.current.scrollOffset = 0;
  }

  const visibleStart = cursorRef.current.scrollOffset;
  const visibleEnd = needsVirtualization
    ? Math.min(visibleStart + maxVisibleRows, totalRows)
    : totalRows;

  // Compute column widths: overrides > explicit width > auto-sized
  const colWidths = columns.map((col) => {
    // Column resize overrides take highest precedence
    const override = colWidthOverridesRef.current[col.key];
    if (override !== undefined) return override;
    if (col.width !== undefined) return col.width;
    // Include sort indicator in header length calculation
    let max = col.label.length + 2; // space for sort indicator
    const sampleCount = Math.min(rows.length, COL_WIDTH_SAMPLE_SIZE);
    for (let i = 0; i < sampleCount; i++) {
      const row = rows[i]!;
      const val = row[col.key];
      const len = val !== undefined ? String(val).length : 0;
      if (len > max) max = len;
    }
    return max;
  });

  /** Notify onSelectionChange with current selected set */
  function notifySelectionChange(): void {
    if (onSelectionChange) {
      const sorted = [...selectedSetRef.current].sort((a, b) => a - b);
      onSelectionChange(sorted);
    }
  }

  /** Select a range from anchor to target (inclusive), replacing previous selection */
  function selectRange(anchor: number, target: number): void {
    const lo = Math.min(anchor, target);
    const hi = Math.max(anchor, target);
    selectedSetRef.current.clear();
    for (let i = lo; i <= hi; i++) {
      selectedSetRef.current.add(i);
    }
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const prevOffset = cursorRef.current.scrollOffset;

      // --- Inline cell editing mode ---
      if (editingRef.current !== null) {
        const edit = editingRef.current;
        if (event.key === "escape") {
          // Cancel editing
          editingRef.current = null;
          requestRender();
          return;
        }
        if (event.key === "return") {
          // Confirm edit
          const colKey = columns[edit.col]?.key;
          if (colKey && onCellEdit) {
            onCellEdit(edit.row, colKey, edit.value);
          }
          editingRef.current = null;
          requestRender();
          return;
        }
        if (event.key === "backspace") {
          if (edit.cursor > 0) {
            edit.value = edit.value.slice(0, edit.cursor - 1) + edit.value.slice(edit.cursor);
            edit.cursor -= 1;
            requestRender();
          }
          return;
        }
        if (event.key === "delete") {
          if (edit.cursor < edit.value.length) {
            edit.value = edit.value.slice(0, edit.cursor) + edit.value.slice(edit.cursor + 1);
            requestRender();
          }
          return;
        }
        if (event.key === "left") {
          if (edit.cursor > 0) {
            edit.cursor -= 1;
            requestRender();
          }
          return;
        }
        if (event.key === "right") {
          if (edit.cursor < edit.value.length) {
            edit.cursor += 1;
            requestRender();
          }
          return;
        }
        if (event.key === "home") {
          edit.cursor = 0;
          requestRender();
          return;
        }
        if (event.key === "end") {
          edit.cursor = edit.value.length;
          requestRender();
          return;
        }
        // Printable character
        if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
          edit.value = edit.value.slice(0, edit.cursor) + event.char + edit.value.slice(edit.cursor);
          edit.cursor += 1;
          requestRender();
        }
        return;
      }

      // --- Column resize on header row ---
      if (resizable && cursorRef.current.onHeaderRow) {
        if (event.char === "+" || event.char === "-") {
          const col = columns[cursorRef.current.col];
          if (col) {
            const currentWidth = colWidths[cursorRef.current.col] ?? col.label.length + 2;
            const delta = event.char === "+" ? 1 : -1;
            const newWidth = Math.max(1, currentWidth + delta);
            colWidthOverridesRef.current[col.key] = newWidth;
            if (onColumnResize) {
              onColumnResize(col.key, newWidth);
            }
            requestRender();
          }
          return;
        }
      }

      if (event.key === "up") {
        if (event.shift && multiSelect && !cursorRef.current.onHeaderRow) {
          // Shift+Up: extend range selection upward
          if (rangeAnchorRef.current === null) {
            rangeAnchorRef.current = cursorRef.current.row;
          }
          if (cursorRef.current.row > 0) {
            cursorRef.current.row -= 1;
            selectRange(rangeAnchorRef.current, cursorRef.current.row);
            notifySelectionChange();
            if (needsVirtualization && cursorRef.current.row < cursorRef.current.scrollOffset) {
              cursorRef.current.scrollOffset = cursorRef.current.row;
            }
          }
          requestRender();
        } else if (cursorRef.current.onHeaderRow) {
          // Already on header, nowhere to go
        } else if (cursorRef.current.row === 0) {
          // Move to header row
          cursorRef.current.onHeaderRow = true;
          requestRender();
        } else {
          cursorRef.current.row -= 1;
          rangeAnchorRef.current = null;
          // Auto-scroll up if cursor moves above visible window
          if (needsVirtualization && cursorRef.current.row < cursorRef.current.scrollOffset) {
            cursorRef.current.scrollOffset = cursorRef.current.row;
          }
          requestRender();
        }
      } else if (event.key === "down") {
        if (event.shift && multiSelect && !cursorRef.current.onHeaderRow) {
          // Shift+Down: extend range selection downward
          if (rangeAnchorRef.current === null) {
            rangeAnchorRef.current = cursorRef.current.row;
          }
          if (cursorRef.current.row < rows.length - 1) {
            cursorRef.current.row += 1;
            selectRange(rangeAnchorRef.current, cursorRef.current.row);
            notifySelectionChange();
            if (needsVirtualization && cursorRef.current.row >= cursorRef.current.scrollOffset + maxVisibleRows) {
              cursorRef.current.scrollOffset = cursorRef.current.row - maxVisibleRows + 1;
            }
          }
          requestRender();
        } else if (cursorRef.current.onHeaderRow) {
          // Move from header to first data row
          cursorRef.current.onHeaderRow = false;
          cursorRef.current.row = 0;
          rangeAnchorRef.current = null;
          requestRender();
        } else if (cursorRef.current.row < rows.length - 1) {
          cursorRef.current.row += 1;
          rangeAnchorRef.current = null;
          // Auto-scroll down if cursor moves below visible window
          if (needsVirtualization && cursorRef.current.row >= cursorRef.current.scrollOffset + maxVisibleRows) {
            cursorRef.current.scrollOffset = cursorRef.current.row - maxVisibleRows + 1;
          }
          requestRender();
        }
      } else if (event.key === "left") {
        if (cursorRef.current.col > 0) {
          cursorRef.current.col -= 1;
          requestRender();
        }
      } else if (event.key === "right") {
        if (cursorRef.current.col < columns.length - 1) {
          cursorRef.current.col += 1;
          requestRender();
        }
      } else if (event.key === "space" && multiSelect && !cursorRef.current.onHeaderRow) {
        // Toggle selection on current row
        const row = cursorRef.current.row;
        if (selectedSetRef.current.has(row)) {
          selectedSetRef.current.delete(row);
        } else {
          selectedSetRef.current.add(row);
        }
        rangeAnchorRef.current = row;
        notifySelectionChange();
        requestRender();
      } else if (event.key === "return") {
        if (cursorRef.current.onHeaderRow) {
          // On header row: sort the current column
          if (onSort && columns[cursorRef.current.col]) {
            onSort(columns[cursorRef.current.col]!.key);
          }
        } else if (editable) {
          // Enter edit mode on the current cell
          const row = rows[cursorRef.current.row];
          const col = columns[cursorRef.current.col];
          if (row && col) {
            const val = row[col.key];
            const strVal = val !== undefined ? String(val) : "";
            editingRef.current = {
              row: cursorRef.current.row,
              col: cursorRef.current.col,
              value: strVal,
              cursor: strVal.length,
            };
            requestRender();
          }
        } else {
          // On data row: select the row
          if (onSelect) {
            onSelect(cursorRef.current.row);
          }
        }
      }

      // Notify about scroll changes
      if (onScrollChange && cursorRef.current.scrollOffset !== prevOffset) {
        onScrollChange(cursorRef.current.scrollOffset);
      }
    },
    [rows, columns, onSelect, onSort, maxVisibleRows, needsVirtualization, onScrollChange, requestRender, multiSelect, onSelectionChange, editable, onCellEdit, resizable, onColumnResize, colWidths],
  );

  useInput(handleInput, { isActive: isFocused });

  const elements: React.ReactElement[] = [];

  // Header row
  const headerCells = columns.map((col, ci) => {
    let sortIndicator = "";
    if (sortColumn === col.key) {
      sortIndicator = sortDirection === "asc" ? " \u25B2" : " \u25BC"; // ▲ or ▼
    }
    const label = col.label + sortIndicator;
    return React.createElement(
      "tui-text",
      { key: col.key, bold: true, color: headerColor },
      " " + padCell(label, colWidths[ci]!, col.align ?? "left") + " ",
    );
  });
  elements.push(
    React.createElement(
      "tui-box",
      { key: "header", flexDirection: "row" },
      ...headerCells,
    ),
  );

  // Border line between header and data
  const borderText = columns
    .map((_col, ci) => "\u2500".repeat(colWidths[ci]! + 2))
    .join("\u2500");
  elements.push(
    React.createElement(
      "tui-text",
      { key: "border", color: borderColor, dim: true },
      borderText,
    ),
  );

  // Data rows (only the visible window) — zebra striping + selected highlight
  const activeRow = selectedRow ?? cursorRef.current.row;
  for (let ri = visibleStart; ri < visibleEnd; ri++) {
    const row = rows[ri]!;
    const isSelected = ri === activeRow;
    const isMultiSelected = multiSelect && selectedSetRef.current.has(ri);
    const isOdd = ri % 2 === 1;

    const cellElements: React.ReactElement[] = [];

    // Multi-select checkbox indicator
    if (multiSelect) {
      cellElements.push(
        React.createElement(
          "tui-text",
          { key: "__chk", color: isMultiSelected ? colors.success : colors.text.dim },
          isMultiSelected ? " \u25C9 " : " \u25CB ",
        ),
      );
    }

    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]!;
      const val = row[col.key];
      const text = val !== undefined ? String(val) : "";

      // Check if this cell is currently being edited
      const isEditing = editingRef.current !== null
        && editingRef.current.row === ri
        && editingRef.current.col === ci;

      if (props.renderCell && !isEditing) {
        cellElements.push(
          React.createElement(
            "tui-box",
            { key: col.key, flexDirection: "row" },
            props.renderCell(val !== undefined ? val : "", col, ri, { isSelected, isEditing: false }),
          ),
        );
      } else if (isEditing) {
        const edit = editingRef.current!;
        // Render editing cell with cursor and inverse styling
        const before = edit.value.slice(0, edit.cursor);
        const cursorChar = edit.cursor < edit.value.length ? edit.value[edit.cursor]! : " ";
        const after = edit.value.slice(edit.cursor + 1);
        const editDisplay = before + "\u2588" + after; // block cursor
        cellElements.push(
          React.createElement(
            "tui-text",
            { key: col.key, inverse: true, bold: true },
            " " + padCell(editDisplay, colWidths[ci]!, col.align ?? "left") + " ",
          ),
        );
      } else {
        const cellProps: Record<string, unknown> = {
          key: col.key,
        };
        if (isSelected) {
          // Selected row: brand background with inverse text
          cellProps["color"] = selectedColor;
          cellProps["bold"] = true;
          cellProps["inverse"] = true;
        } else if (isMultiSelected) {
          cellProps["color"] = colors.brand.light;
          cellProps["bold"] = true;
        }
        cellElements.push(
          React.createElement(
            "tui-text",
            cellProps,
            " " + padCell(text, colWidths[ci]!, col.align ?? "left") + " ",
          ),
        );
      }
    }

    const rowProps: Record<string, unknown> = {
      key: `row-${ri}`,
      flexDirection: "row",
    };

    // Zebra striping: odd rows get a raised surface background
    if (!isSelected && !isMultiSelected && isOdd) {
      rowProps["backgroundColor"] = colors.surface.raised;
    }

    elements.push(
      React.createElement("tui-box", rowProps, ...cellElements),
    );
  }

  // Row range indicator when virtualized
  if (needsVirtualization) {
    const indicatorText = `${visibleStart + 1}-${visibleEnd} of ${totalRows.toLocaleString()}`;
    elements.push(
      React.createElement(
        "tui-text",
        { key: "row-indicator", color: colors.text.dim, dim: true },
        indicatorText,
      ),
    );
  }

  // Multi-select count indicator
  if (multiSelect && selectedSetRef.current.size > 0) {
    elements.push(
      React.createElement(
        "tui-text",
        { key: "sel-indicator", color: colors.brand.primary, dim: true },
        `${selectedSetRef.current.size} row${selectedSetRef.current.size === 1 ? "" : "s"} selected`,
      ),
    );
  }

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", overflow: "hidden", role: "grid", "aria-label": props["aria-label"] },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...elements,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const DataGrid = Object.assign(DataGridBase, {
  Root: DataGridRoot,
  Column: DataGridCompoundColumn,
  Row: DataGridCompoundRow,
});
