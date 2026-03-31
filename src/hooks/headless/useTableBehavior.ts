/**
 * useTableBehavior — headless behavior hook for data tables.
 *
 * Extracts cursor position, sort state, selection set, horizontal scroll,
 * column widths, and editing state from Table and DataGrid components.
 *
 * Returns state + props objects with no JSX.
 */

import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

export interface TableBehaviorColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface UseTableBehaviorOptions {
  columns: TableBehaviorColumn[];
  data: Array<Record<string, string | number>>;
  isActive?: boolean;
  maxVisibleRows?: number;
  scrollOffset?: number;
  onScrollChange?: (offset: number) => void;
  onRowSelect?: (rowIndex: number) => void;
  rowHighlight?: boolean;
  sortable?: boolean;
  onSort?: (columnKey: string, direction: "asc" | "desc") => void;
  multiSelect?: boolean;
  onSelectionChange?: (selectedIndices: number[]) => void;
  editable?: boolean;
  onCellEdit?: (rowIndex: number, columnKey: string, newValue: string) => void;
}

export interface TableBehaviorEditing {
  row: number;
  col: number;
  value: string;
  cursor: number;
}

export interface UseTableBehaviorResult {
  /** Current cursor row index */
  cursorRow: number;
  /** Current cursor column index */
  cursorCol: number;
  /** Current sort column key (if any) */
  sortKey: string | null;
  /** Current sort direction */
  sortDir: "asc" | "desc" | null;
  /** Set of selected row indices (for multi-select) */
  selectedRows: ReadonlySet<number>;
  /** Whether cursor is on the header row */
  onHeaderRow: boolean;
  /** Current scroll offset for virtualization */
  scrollOffset: number;
  /** Visible row range start */
  visibleStart: number;
  /** Visible row range end (exclusive) */
  visibleEnd: number;
  /** Whether virtualization is active */
  isVirtualized: boolean;
  /** Current editing state (null if not editing) */
  editing: TableBehaviorEditing | null;
  /** Get props for a cell */
  getCellProps: (row: number, col: number) => {
    isCursorRow: boolean;
    isCursorCol: boolean;
    isCursorCell: boolean;
    isSelected: boolean;
    isEditing: boolean;
  };
  /** Get props for a column header */
  getHeaderProps: (col: number) => {
    isCursorCol: boolean;
    isSorted: boolean;
    sortDirection: "asc" | "desc" | null;
    columnKey: string;
  };
}

/** Max rows to sample when auto-sizing column widths. */
const COL_WIDTH_SAMPLE_SIZE = 100;

export function useTableBehavior(options: UseTableBehaviorOptions): UseTableBehaviorResult {
  const {
    columns,
    data,
    isActive = false,
    maxVisibleRows = 100,
    scrollOffset = 0,
    onScrollChange,
    onRowSelect,
    rowHighlight = false,
    sortable = false,
    onSort,
    multiSelect = false,
    onSelectionChange,
    editable = false,
    onCellEdit,
  } = options;

  const forceUpdate = useForceUpdate();

  const scrollRef = useRef(scrollOffset);
  const cursorRowRef = useRef(0);
  const cursorColRef = useRef(0);
  const sortStateRef = useRef<{ column: string; direction: "asc" | "desc" } | null>(null);
  const onHeaderRowRef = useRef(false);
  const selectedSetRef = useRef<Set<number>>(new Set());
  const rangeAnchorRef = useRef<number | null>(null);
  const editingRef = useRef<TableBehaviorEditing | null>(null);

  // Sync scrollRef with controlled prop
  scrollRef.current = scrollOffset;

  // Clamp cursor row
  if (data.length > 0 && cursorRowRef.current >= data.length) {
    cursorRowRef.current = data.length - 1;
  }
  if (cursorColRef.current >= columns.length) {
    cursorColRef.current = Math.max(0, columns.length - 1);
  }

  // Virtualization
  const totalRows = data.length;
  const needsVirtualization = totalRows > maxVisibleRows;

  if (needsVirtualization) {
    if (cursorRowRef.current < scrollRef.current) {
      scrollRef.current = cursorRowRef.current;
    } else if (cursorRowRef.current >= scrollRef.current + maxVisibleRows) {
      scrollRef.current = cursorRowRef.current - maxVisibleRows + 1;
    }
    scrollRef.current = Math.max(0, Math.min(scrollRef.current, totalRows - maxVisibleRows));
  } else {
    scrollRef.current = 0;
  }

  const visibleStart = scrollRef.current;
  const visibleEnd = needsVirtualization
    ? Math.min(visibleStart + maxVisibleRows, totalRows)
    : totalRows;

  function notifySelectionChange(): void {
    if (onSelectionChange) {
      const sorted = [...selectedSetRef.current].sort((a, b) => a - b);
      onSelectionChange(sorted);
    }
  }

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
      const prevOffset = scrollRef.current;

      // --- Inline cell editing mode ---
      if (editingRef.current !== null) {
        const edit = editingRef.current;
        if (event.key === "escape") {
          editingRef.current = null;
          forceUpdate();
          return;
        }
        if (event.key === "return") {
          const colKey = columns[edit.col]?.key;
          if (colKey && onCellEdit) {
            onCellEdit(edit.row, colKey, edit.value);
          }
          editingRef.current = null;
          forceUpdate();
          return;
        }
        if (event.key === "backspace") {
          if (edit.cursor > 0) {
            edit.value = edit.value.slice(0, edit.cursor - 1) + edit.value.slice(edit.cursor);
            edit.cursor -= 1;
            forceUpdate();
          }
          return;
        }
        if (event.key === "delete") {
          if (edit.cursor < edit.value.length) {
            edit.value = edit.value.slice(0, edit.cursor) + edit.value.slice(edit.cursor + 1);
            forceUpdate();
          }
          return;
        }
        if (event.key === "left") {
          if (edit.cursor > 0) { edit.cursor -= 1; forceUpdate(); }
          return;
        }
        if (event.key === "right") {
          if (edit.cursor < edit.value.length) { edit.cursor += 1; forceUpdate(); }
          return;
        }
        if (event.key === "home") { edit.cursor = 0; forceUpdate(); return; }
        if (event.key === "end") { edit.cursor = edit.value.length; forceUpdate(); return; }
        if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
          edit.value = edit.value.slice(0, edit.cursor) + event.char + edit.value.slice(edit.cursor);
          edit.cursor += 1;
          forceUpdate();
        }
        return;
      }

      if (event.key === "up") {
        if (event.shift && multiSelect && !onHeaderRowRef.current) {
          if (rangeAnchorRef.current === null) rangeAnchorRef.current = cursorRowRef.current;
          if (cursorRowRef.current > 0) {
            cursorRowRef.current -= 1;
            selectRange(rangeAnchorRef.current, cursorRowRef.current);
            notifySelectionChange();
            if (needsVirtualization && cursorRowRef.current < scrollRef.current) {
              scrollRef.current = cursorRowRef.current;
            }
          }
          forceUpdate();
        } else if (onHeaderRowRef.current) {
          // Already on header
        } else if (cursorRowRef.current === 0 && sortable) {
          onHeaderRowRef.current = true;
          forceUpdate();
        } else if (rowHighlight && cursorRowRef.current > 0) {
          cursorRowRef.current -= 1;
          rangeAnchorRef.current = null;
          if (needsVirtualization && cursorRowRef.current < scrollRef.current) {
            scrollRef.current = cursorRowRef.current;
          }
          forceUpdate();
        } else if (!rowHighlight) {
          const maxOffset = Math.max(0, data.length - maxVisibleRows);
          const prev = scrollRef.current;
          scrollRef.current = Math.max(0, scrollRef.current - 1);
          if (scrollRef.current !== prev) forceUpdate();
        }
      } else if (event.key === "down") {
        if (event.shift && multiSelect && !onHeaderRowRef.current) {
          if (rangeAnchorRef.current === null) rangeAnchorRef.current = cursorRowRef.current;
          if (cursorRowRef.current < data.length - 1) {
            cursorRowRef.current += 1;
            selectRange(rangeAnchorRef.current, cursorRowRef.current);
            notifySelectionChange();
            if (needsVirtualization && cursorRowRef.current >= scrollRef.current + maxVisibleRows) {
              scrollRef.current = cursorRowRef.current - maxVisibleRows + 1;
            }
          }
          forceUpdate();
        } else if (onHeaderRowRef.current) {
          onHeaderRowRef.current = false;
          cursorRowRef.current = 0;
          rangeAnchorRef.current = null;
          forceUpdate();
        } else if (rowHighlight && cursorRowRef.current < data.length - 1) {
          cursorRowRef.current += 1;
          rangeAnchorRef.current = null;
          if (needsVirtualization && cursorRowRef.current >= scrollRef.current + maxVisibleRows) {
            scrollRef.current = cursorRowRef.current - maxVisibleRows + 1;
          }
          forceUpdate();
        } else if (!rowHighlight) {
          const maxOffset = Math.max(0, data.length - maxVisibleRows);
          const prev = scrollRef.current;
          scrollRef.current = Math.min(maxOffset, scrollRef.current + 1);
          if (scrollRef.current !== prev) forceUpdate();
        }
      } else if (event.key === "left") {
        if (cursorColRef.current > 0) {
          cursorColRef.current -= 1;
          forceUpdate();
        }
      } else if (event.key === "right") {
        if (cursorColRef.current < columns.length - 1) {
          cursorColRef.current += 1;
          forceUpdate();
        }
      } else if (event.key === "space" && multiSelect && !onHeaderRowRef.current) {
        const row = cursorRowRef.current;
        if (selectedSetRef.current.has(row)) {
          selectedSetRef.current.delete(row);
        } else {
          selectedSetRef.current.add(row);
        }
        rangeAnchorRef.current = row;
        notifySelectionChange();
        forceUpdate();
      } else if (event.key === "pageup") {
        const prev = scrollRef.current;
        scrollRef.current = Math.max(0, scrollRef.current - maxVisibleRows);
        if (rowHighlight) {
          cursorRowRef.current = Math.max(0, cursorRowRef.current - maxVisibleRows);
        }
        if (scrollRef.current !== prev) forceUpdate();
      } else if (event.key === "pagedown") {
        const maxOffset = Math.max(0, data.length - maxVisibleRows);
        const prev = scrollRef.current;
        scrollRef.current = Math.min(maxOffset, scrollRef.current + maxVisibleRows);
        if (rowHighlight) {
          cursorRowRef.current = Math.min(data.length - 1, cursorRowRef.current + maxVisibleRows);
        }
        if (scrollRef.current !== prev) forceUpdate();
      } else if (event.key === "return") {
        if (onHeaderRowRef.current) {
          if (onSort && columns[cursorColRef.current]) {
            const col = columns[cursorColRef.current]!;
            const prev = sortStateRef.current;
            let newDir: "asc" | "desc" = "asc";
            if (prev && prev.column === col.key && prev.direction === "asc") {
              newDir = "desc";
            }
            sortStateRef.current = { column: col.key, direction: newDir };
            onSort(col.key, newDir);
            forceUpdate();
          }
        } else if (editable) {
          const row = data[cursorRowRef.current];
          const col = columns[cursorColRef.current];
          if (row && col) {
            const val = row[col.key];
            const strVal = val !== undefined ? String(val) : "";
            editingRef.current = {
              row: cursorRowRef.current,
              col: cursorColRef.current,
              value: strVal,
              cursor: strVal.length,
            };
            forceUpdate();
          }
        } else if (onRowSelect) {
          onRowSelect(cursorRowRef.current);
        }
      } else if (sortable && (event.char === "s" || event.char === "S") && !editable) {
        const col = columns[cursorColRef.current];
        if (col && onSort) {
          const prev = sortStateRef.current;
          let newDir: "asc" | "desc" = "asc";
          if (prev && prev.column === col.key && prev.direction === "asc") {
            newDir = "desc";
          }
          sortStateRef.current = { column: col.key, direction: newDir };
          onSort(col.key, newDir);
          forceUpdate();
        }
      }

      if (onScrollChange && scrollRef.current !== prevOffset) {
        onScrollChange(scrollRef.current);
      }
    },
    [data, columns, maxVisibleRows, needsVirtualization, onScrollChange, forceUpdate,
     rowHighlight, onRowSelect, sortable, onSort, multiSelect, onSelectionChange,
     editable, onCellEdit],
  );

  useInput(handleInput, { isActive });

  const getCellProps = useCallback((row: number, col: number) => {
    return {
      isCursorRow: row === cursorRowRef.current,
      isCursorCol: col === cursorColRef.current,
      isCursorCell: row === cursorRowRef.current && col === cursorColRef.current,
      isSelected: multiSelect && selectedSetRef.current.has(row),
      isEditing: editingRef.current !== null
        && editingRef.current.row === row
        && editingRef.current.col === col,
    };
  }, [multiSelect]);

  const getHeaderProps = useCallback((col: number) => {
    const column = columns[col];
    const sortState = sortStateRef.current;
    const isSorted = sortState !== null && column !== undefined && sortState.column === column.key;
    return {
      isCursorCol: col === cursorColRef.current && onHeaderRowRef.current,
      isSorted,
      sortDirection: isSorted ? sortState!.direction : null,
      columnKey: column?.key ?? "",
    };
  }, [columns]);

  return {
    cursorRow: cursorRowRef.current,
    cursorCol: cursorColRef.current,
    sortKey: sortStateRef.current?.column ?? null,
    sortDir: sortStateRef.current?.direction ?? null,
    selectedRows: selectedSetRef.current,
    onHeaderRow: onHeaderRowRef.current,
    scrollOffset: scrollRef.current,
    visibleStart,
    visibleEnd,
    isVirtualized: needsVirtualization,
    editing: editingRef.current,
    getCellProps,
    getHeaderProps,
  };
}
