import { COL_WIDTH_SAMPLE_SIZE, padCell } from "./format.js";

// ─── Column width auto-sizing ───────────────────────────────────────────

export interface ColumnWidthInput {
  key: string;
  header: string;
  width?: number;
}

/**
 * Compute column widths by sampling data rows.
 * If a column has an explicit `width`, it is used as-is.
 * Otherwise the width is the max of the header length and the longest
 * value in the first COL_WIDTH_SAMPLE_SIZE rows.
 *
 * @param headerField  Which field on the column object holds the header text
 *                     ("header" for Table, "label" for DataGrid).
 */
export function computeColumnWidths<C extends { key: string; width?: number }>(
  columns: ReadonlyArray<C>,
  data: ReadonlyArray<Record<string, string | number>>,
  headerField: string = "header",
  extraPadding: number = 0,
): number[] {
  const sampleCount = Math.min(data.length, COL_WIDTH_SAMPLE_SIZE);
  return columns.map((col) => {
    if (col.width !== undefined) return col.width;
    const headerText = String((col as Record<string, unknown>)[headerField] ?? "");
    let max = headerText.length + extraPadding;
    for (let i = 0; i < sampleCount; i++) {
      const row = data[i]!;
      const val = row[col.key];
      const len = val !== undefined ? String(val).length : 0;
      if (len > max) max = len;
    }
    return max;
  });
}

// ─── Separator / divider line ───────────────────────────────────────────

/**
 * Build a horizontal separator string that sits between header and body.
 * Each column segment is `─` repeated (colWidth + 2) for the 1-char padding
 * on each side, joined by the given `joiner` character.
 *
 * Table uses "┼" (`\u253C`), DataGrid uses "─" (`\u2500`).
 */
export function buildSeparatorText(colWidths: number[], joiner: string): string {
  return colWidths
    .map((w) => "\u2500".repeat(w + 2))
    .join(joiner);
}

// ─── Zebra stripe background ────────────────────────────────────────────

/**
 * Determine whether a row should receive the zebra-stripe background.
 * Returns `true` when striping is enabled, the row index is odd,
 * and the row is not in a highlighted/selected state.
 */
export function shouldStripe(
  rowIndex: number,
  stripeEnabled: boolean,
  isHighlighted: boolean,
): boolean {
  return stripeEnabled && rowIndex % 2 === 1 && !isHighlighted;
}

// ─── Virtualization window ──────────────────────────────────────────────

export interface VirtualWindow {
  /** Index of first visible row (inclusive). */
  start: number;
  /** Index past the last visible row (exclusive). */
  end: number;
  /** Total number of rows in the dataset. */
  total: number;
  /** Whether the dataset exceeds maxVisibleRows. */
  needsVirtualization: boolean;
}

/**
 * Compute the visible row window for virtualized rendering.
 */
export function computeVirtualWindow(
  totalRows: number,
  maxVisibleRows: number,
  scrollOffset: number,
): VirtualWindow {
  const needsVirtualization = totalRows > maxVisibleRows;
  const clampedOffset = needsVirtualization
    ? Math.max(0, Math.min(scrollOffset, totalRows - maxVisibleRows))
    : 0;
  const start = clampedOffset;
  const end = needsVirtualization
    ? Math.min(clampedOffset + maxVisibleRows, totalRows)
    : totalRows;
  return { start, end, total: totalRows, needsVirtualization };
}

// ─── Row count indicator text ───────────────────────────────────────────

/**
 * Format the "Showing X-Y of Z" (Table) or "X-Y of Z" (DataGrid) indicator.
 *
 * @param prefix  Text before the range, e.g. "Showing " or "" (empty).
 */
export function formatRowIndicator(
  start: number,
  end: number,
  total: number,
  prefix: string = "",
): string {
  return `${prefix}${start + 1}-${end} of ${total.toLocaleString()}`;
}

// ─── Header text with sort indicator ────────────────────────────────────

/**
 * Append a sort direction arrow (▲ or ▼) to a header label when the
 * column is the active sort column.
 */
export function headerTextWithSort(
  label: string,
  columnKey: string,
  sortColumn: string | null | undefined,
  sortDirection: "asc" | "desc" | null | undefined,
): string {
  if (sortColumn === columnKey && sortDirection) {
    return label + (sortDirection === "asc" ? " \u25B2" : " \u25BC");
  }
  return label;
}

// ─── Padded row line builder ────────────────────────────────────────────

/**
 * Build a single row line string: each cell is ` <padded> ` joined by the
 * given separator character (typically "│").
 */
export function buildRowLine(
  columns: ReadonlyArray<{ key: string; align?: "left" | "center" | "right" }>,
  row: Record<string, string | number>,
  colWidths: number[],
  separator: string = "\u2502",
): string {
  return columns.map((col, ci) => {
    const val = row[col.key];
    const text = val !== undefined ? String(val) : "";
    return " " + padCell(text, colWidths[ci]!, col.align ?? "left") + " ";
  }).join(separator);
}
