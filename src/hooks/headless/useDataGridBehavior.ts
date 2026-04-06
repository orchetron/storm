import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useTui } from "../../context/TuiContext.js";
import type { KeyEvent } from "../../input/types.js";
import { handleCellEdit } from "./cell-edit.js";
import { computeVirtualWindow, computeColumnWidths } from "../../utils/table-render.js";

export interface DataGridBehaviorColumn {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
}

export interface DataGridBehaviorEditState {
  row: number;
  col: number;
  value: string;
  cursor: number;
}

export interface UseDataGridBehaviorOptions {
  columns: DataGridBehaviorColumn[];
  rows: Array<Record<string, string | number>>;
  selectedRow?: number | undefined;
  onSelect?: ((rowIndex: number) => void) | undefined;
  sortColumn?: string | undefined;
  sortDirection?: ("asc" | "desc") | undefined;
  onSort?: ((column: string) => void) | undefined;
  isActive?: boolean | undefined;
  /** Maximum rows rendered at once (default 100). Rows beyond this are virtualized. */
  maxVisibleRows?: number | undefined;
  /** Called when the scroll offset changes due to navigation or virtualization. */
  onScrollChange?: ((offset: number) => void) | undefined;
  /** Enable multi-row selection. Space toggles, Shift+Up/Down extends range. */
  multiSelect?: boolean | undefined;
  /** Called when the set of selected rows changes in multiSelect mode. */
  onSelectionChange?: ((selectedIndices: number[]) => void) | undefined;
  /** Enable inline cell editing. Press Enter on a data cell to edit. */
  editable?: boolean | undefined;
  /** Called when a cell edit is confirmed. */
  onCellEdit?: ((rowIndex: number, columnKey: string, newValue: string) => void) | undefined;
  /** Enable column resizing with +/- keys on the header row. */
  resizable?: boolean | undefined;
  /** Called when a column is resized. */
  onColumnResize?: ((columnKey: string, newWidth: number) => void) | undefined;
}

export interface UseDataGridBehaviorResult {
  /** The currently focused cell: row index and column index */
  focusedCell: { row: number; col: number; onHeaderRow: boolean };
  /** Sort state passthrough */
  sortState: { column: string | undefined; direction: "asc" | "desc" | undefined };
  /** Set of multi-selected row indices */
  selectionSet: ReadonlySet<number>;
  /** Current inline edit state, or null */
  editState: DataGridBehaviorEditState | null;
  /** Column width overrides from resizing */
  resizeState: Readonly<Record<string, number>>;
  /** Virtualization window: start index (inclusive), end index (exclusive) */
  virtualWindow: { start: number; end: number; total: number; needsVirtualization: boolean };
  /** Computed column widths (incorporating overrides, explicit widths, and auto-sizing) */
  columnWidths: number[];
  /** The active row index (selectedRow prop or cursor row) */
  activeRow: number;
  /** Input handler (already wired via useInput) */
  handleInput: (event: KeyEvent) => void;
  /** Original rows passthrough */
  rows: Array<Record<string, string | number>>;
  /** Original columns passthrough */
  columns: DataGridBehaviorColumn[];
}

export function useDataGridBehavior(options: UseDataGridBehaviorOptions): UseDataGridBehaviorResult {
  const {
    columns,
    rows,
    selectedRow,
    onSelect,
    sortColumn,
    sortDirection,
    onSort,
    isActive = true,
    maxVisibleRows = 100,
    onScrollChange,
    multiSelect = false,
    onSelectionChange,
    editable = false,
    onCellEdit,
    resizable = false,
    onColumnResize,
  } = options;

  const { requestRender } = useTui();

  // Clamp selectedRow to valid range
  const clampedSelectedRow = selectedRow !== undefined
    ? Math.max(0, Math.min(selectedRow, rows.length - 1))
    : undefined;

  // cursor.row: 0..n = data rows
  // cursor.col: column index
  // scrollOffset: first visible row index for virtualization
  // onHeaderRow: whether cursor is on the header row
  const cursorRef = useRef({ row: clampedSelectedRow ?? 0, col: 0, scrollOffset: 0, onHeaderRow: false });
  const selectedSetRef = useRef<Set<number>>(new Set());
  const rangeAnchorRef = useRef<number | null>(null);
  const editingRef = useRef<DataGridBehaviorEditState | null>(null);
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

  if (needsVirtualization) {
    const cursor = cursorRef.current;
    if (cursor.row < cursor.scrollOffset) {
      cursor.scrollOffset = cursor.row;
    } else if (cursor.row >= cursor.scrollOffset + maxVisibleRows) {
      cursor.scrollOffset = cursor.row - maxVisibleRows + 1;
    }
  }

  const vw = computeVirtualWindow(totalRows, maxVisibleRows, cursorRef.current.scrollOffset);
  cursorRef.current.scrollOffset = vw.start;

  const visibleStart = vw.start;
  const visibleEnd = vw.end;

  const baseWidths = computeColumnWidths(columns, rows, "label", 2);
  const colWidths = columns.map((col, i) => {
    const override = colWidthOverridesRef.current[col.key];
    if (override !== undefined) return override;
    return baseWidths[i]!;
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

  /** Handle keyboard input while in inline cell editing mode. */
  function handleEditInput(event: KeyEvent): void {
    handleCellEdit(
      event,
      editingRef.current!,
      (_row, col, value) => {
        const colKey = columns[col]?.key;
        if (colKey && onCellEdit) onCellEdit(_row, colKey, value);
        editingRef.current = null;
        requestRender();
      },
      () => { editingRef.current = null; requestRender(); },
      requestRender,
    );
  }

  /** Handle +/- keys for column resizing when on the header row. Returns true if handled. */
  function handleResizeInput(event: KeyEvent): boolean {
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
      return true;
    }
    return false;
  }

  /** Handle arrow keys, including virtualization scroll adjustments. */
  function handleNavigationInput(event: KeyEvent): boolean {
    if (event.key === "up") {
      if (cursorRef.current.onHeaderRow) {
        // Already on header, nowhere to go
      } else if (cursorRef.current.row === 0) {
        cursorRef.current.onHeaderRow = true;
        requestRender();
      } else {
        cursorRef.current.row -= 1;
        rangeAnchorRef.current = null;
        if (needsVirtualization && cursorRef.current.row < cursorRef.current.scrollOffset) {
          cursorRef.current.scrollOffset = cursorRef.current.row;
        }
        requestRender();
      }
      return true;
    }
    if (event.key === "down") {
      if (cursorRef.current.onHeaderRow) {
        cursorRef.current.onHeaderRow = false;
        cursorRef.current.row = 0;
        rangeAnchorRef.current = null;
        requestRender();
      } else if (cursorRef.current.row < rows.length - 1) {
        cursorRef.current.row += 1;
        rangeAnchorRef.current = null;
        if (needsVirtualization && cursorRef.current.row >= cursorRef.current.scrollOffset + maxVisibleRows) {
          cursorRef.current.scrollOffset = cursorRef.current.row - maxVisibleRows + 1;
        }
        requestRender();
      }
      return true;
    }
    if (event.key === "left") {
      if (cursorRef.current.col > 0) {
        cursorRef.current.col -= 1;
        requestRender();
      }
      return true;
    }
    if (event.key === "right") {
      if (cursorRef.current.col < columns.length - 1) {
        cursorRef.current.col += 1;
        requestRender();
      }
      return true;
    }
    return false;
  }

  /** Handle Shift+arrow range selection and Space multi-select toggle. Returns true if handled. */
  function handleSelectionInput(event: KeyEvent): boolean {
    if (event.key === "up" && event.shift && multiSelect && !cursorRef.current.onHeaderRow) {
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
      return true;
    }
    if (event.key === "down" && event.shift && multiSelect && !cursorRef.current.onHeaderRow) {
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
      return true;
    }
    if (event.key === "space" && multiSelect && !cursorRef.current.onHeaderRow) {
      const row = cursorRef.current.row;
      if (selectedSetRef.current.has(row)) {
        selectedSetRef.current.delete(row);
      } else {
        selectedSetRef.current.add(row);
      }
      rangeAnchorRef.current = row;
      notifySelectionChange();
      requestRender();
      return true;
    }
    return false;
  }

  /** Handle Enter (sort/edit/select) and Escape actions. Returns true if handled. */
  function handleActionInput(event: KeyEvent): boolean {
    if (event.key === "return") {
      if (cursorRef.current.onHeaderRow) {
        if (onSort && columns[cursorRef.current.col]) {
          onSort(columns[cursorRef.current.col]!.key);
        }
      } else if (editable) {
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
        if (onSelect) {
          onSelect(cursorRef.current.row);
        }
      }
      return true;
    }
    return false;
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const prevOffset = cursorRef.current.scrollOffset;

      // Editing mode: all input goes to the edit handler
      if (editingRef.current !== null) {
        handleEditInput(event);
        return;
      }

      // Column resize mode: +/- on header row
      if (resizable && cursorRef.current.onHeaderRow) {
        if (handleResizeInput(event)) return;
      }

      // Selection (Shift+arrow, Space) takes priority over plain navigation
      if (!handleSelectionInput(event)) {
        // Actions: Enter, Escape
        if (!handleActionInput(event)) {
          // Plain navigation: arrow keys
          handleNavigationInput(event);
        }
      }

      if (onScrollChange && cursorRef.current.scrollOffset !== prevOffset) {
        onScrollChange(cursorRef.current.scrollOffset);
      }
    },
    [rows, columns, onSelect, onSort, maxVisibleRows, needsVirtualization, onScrollChange, requestRender, multiSelect, onSelectionChange, editable, onCellEdit, resizable, onColumnResize, colWidths],
  );

  useInput(handleInput, { isActive });

  const activeRow = selectedRow ?? cursorRef.current.row;

  return {
    focusedCell: {
      row: cursorRef.current.row,
      col: cursorRef.current.col,
      onHeaderRow: cursorRef.current.onHeaderRow,
    },
    sortState: {
      column: sortColumn,
      direction: sortDirection,
    },
    selectionSet: selectedSetRef.current,
    editState: editingRef.current,
    resizeState: colWidthOverridesRef.current,
    virtualWindow: {
      start: visibleStart,
      end: visibleEnd,
      total: totalRows,
      needsVirtualization,
    },
    columnWidths: colWidths,
    activeRow,
    handleInput,
    rows,
    columns,
  };
}
