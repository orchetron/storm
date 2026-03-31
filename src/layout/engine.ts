/**
 * Layout engine — flexbox-like constraint solver for terminal UI.
 *
 * Supports vertical/horizontal flex, fixed/percentage sizes, padding,
 * gap, alignItems, justifyContent, and overflow clipping.
 * Pure TypeScript, fast and predictable.
 */

// ── Types ───────────────────────────────────────────────────────────

export type FlexDirection = "column" | "row";
export type FlexWrap = "nowrap" | "wrap";
export type Align = "start" | "center" | "end" | "stretch" | "baseline";
export type AlignSelf = Align | "auto";
export type Justify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
export type AlignContent = "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around";
export type Overflow = "visible" | "hidden" | "scroll";
export type Display = "flex" | "grid" | "none";
export type GridAutoFlow = "row" | "column";
export type Position = "relative" | "absolute";

export interface LayoutProps {
  width?: number | `${number}%` | "auto" | "min-content" | "max-content";
  height?: number | `${number}%` | "auto" | "min-content" | "max-content";
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | `${number}%`;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  margin?: number | "auto";
  marginX?: number | "auto";
  marginY?: number | "auto";
  marginTop?: number | "auto";
  marginBottom?: number | "auto";
  marginLeft?: number | "auto";
  marginRight?: number | "auto";
  gap?: number;
  columnGap?: number;
  rowGap?: number;
  alignItems?: Align;
  alignContent?: AlignContent;
  alignSelf?: AlignSelf;
  justifyContent?: Justify;
  overflow?: Overflow;
  overflowX?: Overflow;
  overflowY?: Overflow;
  display?: Display;
  position?: Position;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  order?: number;
  aspectRatio?: number;
  direction?: "ltr" | "rtl";

  /** Grid layout properties */
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumn?: string;
  gridRow?: string;
  gridGap?: number;
  gridAutoFlow?: GridAutoFlow;
}

export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
  innerX: number;
  innerY: number;
  innerWidth: number;
  innerHeight: number;
  /** Total content height (may exceed innerHeight for scroll) */
  contentHeight: number;
  /** Total content width */
  contentWidth: number;
}

export interface LayoutNode {
  props: LayoutProps;
  children: LayoutNode[];
  /** Set by layout computation */
  layout: LayoutResult;
  /** For text nodes: measured height given a width */
  measureText?: (availableWidth: number) => { width: number; height: number };

  // ── Incremental layout caching ───────────────────────────────────
  /** Whether this node needs re-layout. Set by buildLayoutTree, cleared by computeLayout. */
  dirty?: boolean;
  /** Cached props reference from the last layout pass. */
  _prevProps?: LayoutProps;
  /** Cached available width from the last layout pass. */
  _prevWidth?: number;
  /** Cached available height from the last layout pass. */
  _prevHeight?: number;
  /** Cached child count from the last buildLayoutTree pass. */
  _prevChildCount?: number;
}

/** Sentinel value for unconstrained space in scroll containers.
 *  Children of overflow:scroll containers get this as available height/width
 *  so they can lay out at their natural size. */
const UNCONSTRAINED = 100000;

/** Dev-mode: warn once when percentage sizes are used inside a scroll container. */
let _warnedPercentInScroll = false;

// ── Padding resolution ──────────────────────────────────────────────

interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function resolvePadding(p: LayoutProps): Padding {
  const base = p.padding ?? 0;
  const px = p.paddingX ?? base;
  const py = p.paddingY ?? base;
  return {
    top: p.paddingTop ?? py,
    bottom: p.paddingBottom ?? py,
    left: p.paddingLeft ?? px,
    right: p.paddingRight ?? px,
  };
}

// ── Margin resolution ──────────────────────────────────────────────

interface Margin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface MarginAuto {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

function resolveMarginValue(specific: number | "auto" | undefined, fallback: number | "auto"): { value: number; isAuto: boolean } {
  const v = specific ?? fallback;
  if (v === "auto") return { value: 0, isAuto: true };
  return { value: v, isAuto: false };
}

function resolveMargin(p: LayoutProps): Margin {
  const base = p.margin ?? 0;
  const mx = p.marginX ?? base;
  const my = p.marginY ?? base;
  return {
    top: resolveMarginValue(p.marginTop, my).value,
    bottom: resolveMarginValue(p.marginBottom, my).value,
    left: resolveMarginValue(p.marginLeft, mx).value,
    right: resolveMarginValue(p.marginRight, mx).value,
  };
}

function resolveMarginAuto(p: LayoutProps): MarginAuto {
  const base = p.margin ?? 0;
  const mx = p.marginX ?? base;
  const my = p.marginY ?? base;
  return {
    top: resolveMarginValue(p.marginTop, my).isAuto,
    bottom: resolveMarginValue(p.marginBottom, my).isAuto,
    left: resolveMarginValue(p.marginLeft, mx).isAuto,
    right: resolveMarginValue(p.marginRight, mx).isAuto,
  };
}

// ── Size resolution ─────────────────────────────────────────────────

function resolveSize(
  value: number | `${number}%` | "auto" | "min-content" | "max-content" | undefined,
  parentSize: number,
  node?: LayoutNode,
  axis?: "width" | "height",
): number | undefined {
  if (value === undefined || value === "auto") return undefined;
  if (typeof value === "number") return value;
  if (value === "min-content") {
    if (!node) return undefined;
    if (axis === "width") {
      // Measure at minimum width to find the narrowest the node can be
      if (node.measureText) {
        const measured = node.measureText(0);
        const pad = resolvePadding(node.props);
        return measured.width + pad.left + pad.right;
      }
      return measureNaturalWidth(node, parentSize);
    } else {
      // height min-content: measure with unlimited width
      if (node.measureText) {
        const measured = node.measureText(UNCONSTRAINED);
        const pad = resolvePadding(node.props);
        return measured.height + pad.top + pad.bottom;
      }
      return measureNaturalHeight(node, parentSize);
    }
  }
  if (value === "max-content") {
    if (!node) return undefined;
    if (axis === "width") {
      // Measure with unlimited width to find natural (unwrapped) width
      if (node.measureText) {
        const measured = node.measureText(UNCONSTRAINED);
        const pad = resolvePadding(node.props);
        return measured.width + pad.left + pad.right;
      }
      return measureNaturalWidth(node, parentSize);
    } else {
      // height max-content: measure at the available width
      if (node.measureText) {
        const measured = node.measureText(parentSize);
        const pad = resolvePadding(node.props);
        return measured.height + pad.top + pad.bottom;
      }
      return measureNaturalHeight(node, parentSize);
    }
  }
  // Percentage string: "50%" → 0.5 * parentSize
  // BUG FIX: If parentSize is unlimited (scroll container), percentage is meaningless
  if (parentSize >= UNCONSTRAINED) {
    if (process.env.NODE_ENV !== "production" && !_warnedPercentInScroll) {
      _warnedPercentInScroll = true;
      process.stderr.write("[storm-tui] Warning: Percentage width/height inside a ScrollView is not supported (parent size is unconstrained). Use explicit numeric values instead.\n");
    }
    return undefined;
  }
  const pct = parseFloat(value);
  return Math.floor((pct / 100) * parentSize);
}

function clampSize(
  size: number,
  min: number | undefined,
  max: number | undefined,
): number {
  let s = size;
  if (min !== undefined && s < min) s = min;
  if (max !== undefined && s > max) s = max;
  return Math.max(0, s);
}

// ── RTL x-flip helper ───────────────────────────────────────────────

/**
 * Flip the x position of a child node (and its descendants) for RTL row layout.
 * child.x = parentInnerX + parentInnerWidth - (child.x - parentInnerX) - child.width
 */
function flipXRecursive(node: LayoutNode, parentInnerX: number, parentInnerWidth: number): void {
  const layout = node.layout;
  const flippedX = parentInnerX + parentInnerWidth - (layout.x - parentInnerX) - layout.width;
  const dx = flippedX - layout.x;
  layout.x = flippedX;
  layout.innerX += dx;
  // Shift children by the same delta (they were already laid out relative to old x)
  for (const child of node.children) {
    shiftXRecursive(child, dx);
  }
}

function shiftXRecursive(node: LayoutNode, dx: number): void {
  node.layout.x += dx;
  node.layout.innerX += dx;
  for (const child of node.children) {
    shiftXRecursive(child, dx);
  }
}

function shiftYRecursive(node: LayoutNode, dy: number): void {
  node.layout.y += dy;
  node.layout.innerY += dy;
  for (const child of node.children) {
    shiftYRecursive(child, dy);
  }
}

/**
 * Shift an entire subtree by (dx, dy) without recomputing sizes.
 * Used by incremental layout caching when a clean subtree only moved position.
 */
function shiftSubtree(node: LayoutNode, dx: number, dy: number): void {
  node.layout.x += dx;
  node.layout.y += dy;
  node.layout.innerX += dx;
  node.layout.innerY += dy;
  for (const child of node.children) {
    shiftSubtree(child, dx, dy);
  }
}

// ── Grid track parsing & layout ─────────────────────────────────────

interface GridTrack {
  type: "fixed" | "fr" | "auto";
  value: number; // fixed size or fr multiplier
}

function parseGridTemplate(template: string | undefined): GridTrack[] {
  if (!template) return [];
  return template.trim().split(/\s+/).map((token) => {
    if (token.endsWith("fr")) {
      return { type: "fr" as const, value: parseFloat(token) || 1 };
    }
    if (token === "auto") {
      return { type: "auto" as const, value: 0 };
    }
    return { type: "fixed" as const, value: parseInt(token, 10) || 0 };
  });
}

/** Parse grid placement like "1 / 3", "span 2", or "2" into start (0-based) and span */
function parseGridPlacement(
  placement: string | undefined,
  autoIndex: number,
  trackCount: number,
): { start: number; span: number } {
  if (!placement) {
    return { start: autoIndex, span: 1 };
  }
  const trimmed = placement.trim();

  // "span N" syntax
  const spanMatch = trimmed.match(/^span\s+(\d+)$/);
  if (spanMatch) {
    return { start: autoIndex, span: parseInt(spanMatch[1]!, 10) };
  }

  // "start / end" syntax (1-based CSS grid lines)
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(.+)$/);
  if (slashMatch) {
    const start = parseInt(slashMatch[1]!, 10) - 1; // convert to 0-based
    const endPart = slashMatch[2]!.trim();
    const spanInEnd = endPart.match(/^span\s+(\d+)$/);
    if (spanInEnd) {
      return { start, span: parseInt(spanInEnd[1]!, 10) };
    }
    const end = parseInt(endPart, 10) - 1; // convert to 0-based
    return { start, span: Math.max(1, end - start) };
  }

  // Single number (1-based line)
  const num = parseInt(trimmed, 10);
  if (!isNaN(num)) {
    return { start: num - 1, span: 1 };
  }

  return { start: autoIndex, span: 1 };
}

function resolveGridTrackSizes(
  tracks: GridTrack[],
  availableSize: number,
  gap: number,
  children: LayoutNode[],
  axis: "col" | "row",
  placements: { col: { start: number; span: number }; row: { start: number; span: number } }[],
): number[] {
  if (tracks.length === 0) return [];

  const totalGap = gap * Math.max(0, tracks.length - 1);
  let fixedTotal = 0;
  let frTotal = 0;
  const sizes = new Array<number>(tracks.length).fill(0);

  // First pass: resolve fixed sizes
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!;
    if (track.type === "fixed") {
      sizes[i] = track.value;
      fixedTotal += track.value;
    } else if (track.type === "fr") {
      frTotal += track.value;
    }
  }

  // Second pass: resolve auto tracks by measuring children in those tracks
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!;
    if (track.type === "auto") {
      let maxSize = 0;
      for (let ci = 0; ci < children.length; ci++) {
        const p = placements[ci]!;
        const placement = axis === "col" ? p.col : p.row;
        // Only consider children that start in this track and span 1 cell on this axis
        if (placement.start === i && placement.span === 1) {
          const child = children[ci]!;
          if (axis === "col") {
            maxSize = Math.max(maxSize, measureNaturalWidth(child, availableSize));
          } else {
            maxSize = Math.max(maxSize, measureNaturalHeight(child, availableSize));
          }
        }
      }
      sizes[i] = maxSize;
      fixedTotal += maxSize;
    }
  }

  // Third pass: distribute remaining space to fr tracks
  const remaining = Math.max(0, availableSize - fixedTotal - totalGap);
  if (frTotal > 0) {
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]!;
      if (track.type === "fr") {
        sizes[i] = Math.floor((track.value / frTotal) * remaining);
      }
    }
  }

  return sizes;
}

/**
 * Compute grid layout for a node with display: "grid".
 * Handles gridTemplateColumns, gridTemplateRows, gridGap, gridAutoFlow,
 * and child placement via gridColumn/gridRow.
 */
function computeGridLayout(
  node: LayoutNode,
  innerX: number,
  innerY: number,
  innerWidth: number,
  innerHeight: number,
): void {
  const props = node.props;
  const gap = props.gridGap ?? 0;
  const autoFlow = props.gridAutoFlow ?? "row";

  const colTracks = parseGridTemplate(props.gridTemplateColumns);
  const rowTracks = parseGridTemplate(props.gridTemplateRows);

  // Default to 1 column/row if none specified
  if (colTracks.length === 0) colTracks.push({ type: "fr", value: 1 });
  if (rowTracks.length === 0) rowTracks.push({ type: "auto", value: 0 });

  const visibleChildren = node.children.filter((c) => c.props.display !== "none");

  // Lay out hidden children with zero size
  for (const child of node.children) {
    if (child.props.display === "none") {
      computeLayout(child, innerX, innerY, 0, 0);
    }
  }

  // Phase 1: Determine placement for each child
  // Grid for tracking occupied cells: occupied[row][col] = true
  const occupied = new Map<string, boolean>();
  const markOccupied = (r: number, c: number, rs: number, cs: number) => {
    for (let ri = r; ri < r + rs; ri++) {
      for (let ci = c; ci < c + cs; ci++) {
        occupied.set(`${ri},${ci}`, true);
      }
    }
  };
  const isOccupied = (r: number, c: number, rs: number, cs: number): boolean => {
    for (let ri = r; ri < r + rs; ri++) {
      for (let ci = c; ci < c + cs; ci++) {
        if (occupied.get(`${ri},${ci}`)) return true;
      }
    }
    return false;
  };

  interface Placement {
    col: { start: number; span: number };
    row: { start: number; span: number };
  }

  const placements: Placement[] = [];

  // Auto-placement cursor
  let autoRow = 0;
  let autoCol = 0;

  // Dynamically expand row tracks as needed
  const ensureRowTracks = (needed: number) => {
    while (rowTracks.length < needed) {
      rowTracks.push({ type: "auto", value: 0 });
    }
  };

  for (const child of visibleChildren) {
    const cp = child.props;
    const colPlacement = parseGridPlacement(cp.gridColumn, -1, colTracks.length);
    const rowPlacement = parseGridPlacement(cp.gridRow, -1, rowTracks.length);

    const hasExplicitCol = cp.gridColumn !== undefined && !cp.gridColumn.trim().startsWith("span");
    const hasExplicitRow = cp.gridRow !== undefined && !cp.gridRow.trim().startsWith("span");

    let finalCol: number;
    let finalRow: number;
    const colSpan = colPlacement.span;
    const rowSpan = rowPlacement.span;

    if (hasExplicitCol && hasExplicitRow) {
      // Both explicitly placed
      finalCol = colPlacement.start;
      finalRow = rowPlacement.start;
    } else if (hasExplicitCol) {
      // Column fixed, find next available row
      finalCol = colPlacement.start;
      finalRow = 0;
      while (isOccupied(finalRow, finalCol, rowSpan, colSpan)) {
        finalRow++;
      }
    } else if (hasExplicitRow) {
      // Row fixed, find next available column
      finalRow = rowPlacement.start;
      finalCol = 0;
      while (isOccupied(finalRow, finalCol, rowSpan, colSpan)) {
        finalCol++;
      }
    } else {
      // Auto-placement
      if (autoFlow === "row") {
        // Try to place starting from current cursor
        while (isOccupied(autoRow, autoCol, rowSpan, colSpan) || autoCol + colSpan > colTracks.length) {
          autoCol++;
          if (autoCol + colSpan > colTracks.length) {
            autoCol = 0;
            autoRow++;
          }
        }
        finalCol = autoCol;
        finalRow = autoRow;
        // Advance cursor
        autoCol += colSpan;
        if (autoCol >= colTracks.length) {
          autoCol = 0;
          autoRow++;
        }
      } else {
        // column flow
        while (isOccupied(autoRow, autoCol, rowSpan, colSpan) || autoRow + rowSpan > rowTracks.length) {
          autoRow++;
          if (autoRow + rowSpan > rowTracks.length) {
            autoRow = 0;
            autoCol++;
          }
          // Safety: ensure we don't get stuck if row tracks keep expanding
          if (autoCol >= colTracks.length) break;
        }
        finalCol = autoCol;
        finalRow = autoRow;
        autoRow += rowSpan;
      }
    }

    ensureRowTracks(finalRow + rowSpan);
    markOccupied(finalRow, finalCol, rowSpan, colSpan);
    placements.push({
      col: { start: finalCol, span: colSpan },
      row: { start: finalRow, span: rowSpan },
    });
  }

  // Phase 2: Resolve track sizes
  const colSizes = resolveGridTrackSizes(colTracks, innerWidth, gap, visibleChildren, "col", placements);
  const rowSizes = resolveGridTrackSizes(rowTracks, innerHeight, gap, visibleChildren, "row", placements);

  // Precompute cumulative offsets
  const colOffsets: number[] = [0];
  for (let i = 0; i < colSizes.length; i++) {
    colOffsets.push(colOffsets[i]! + colSizes[i]! + gap);
  }
  const rowOffsets: number[] = [0];
  for (let i = 0; i < rowSizes.length; i++) {
    rowOffsets.push(rowOffsets[i]! + rowSizes[i]! + gap);
  }

  // Phase 3: Lay out each child in its cell
  let maxContentBottom = 0;
  let maxContentRight = 0;

  for (let i = 0; i < visibleChildren.length; i++) {
    const child = visibleChildren[i]!;
    const placement = placements[i]!;

    const cellX = innerX + (colOffsets[placement.col.start] ?? 0);
    const cellY = innerY + (rowOffsets[placement.row.start] ?? 0);

    // Calculate cell width spanning multiple columns
    let cellWidth = 0;
    for (let c = placement.col.start; c < placement.col.start + placement.col.span && c < colSizes.length; c++) {
      cellWidth += colSizes[c]!;
      if (c > placement.col.start) cellWidth += gap; // include gap between spanned columns
    }

    // Calculate cell height spanning multiple rows
    let cellHeight = 0;
    for (let r = placement.row.start; r < placement.row.start + placement.row.span && r < rowSizes.length; r++) {
      cellHeight += rowSizes[r]!;
      if (r > placement.row.start) cellHeight += gap; // include gap between spanned rows
    }

    computeLayout(child, cellX, cellY, cellWidth, cellHeight);

    maxContentBottom = Math.max(maxContentBottom, cellY + cellHeight - innerY);
    maxContentRight = Math.max(maxContentRight, cellX + cellWidth - innerX);
  }

  node.layout.contentHeight = Math.max(maxContentBottom, innerHeight);
  node.layout.contentWidth = Math.max(maxContentRight, innerWidth);
}

// ── Main layout computation ─────────────────────────────────────────

/**
 * Compute layout for a tree of nodes starting from the root.
 * The root gets placed at (x, y) with the given available dimensions.
 */
export function computeLayout(
  node: LayoutNode,
  x: number,
  y: number,
  availableWidth: number,
  availableHeight: number,
): void {
  const props = node.props;

  // ── Incremental cache: skip clean subtrees with same constraints ──
  if (
    !node.dirty &&
    node._prevProps === props &&
    node._prevWidth === availableWidth &&
    node._prevHeight === availableHeight
  ) {
    // Same props, same available space, not dirty — reuse cached layout.
    // If position changed, shift the whole subtree without recomputing sizes.
    if (node.layout.x !== x || node.layout.y !== y) {
      const dx = x - node.layout.x;
      const dy = y - node.layout.y;
      shiftSubtree(node, dx, dy);
    }
    return;
  }

  // display: none — skip entirely, zero-size layout
  if (props.display === "none") {
    node.layout = {
      x, y, width: 0, height: 0,
      innerX: x, innerY: y, innerWidth: 0, innerHeight: 0,
      contentHeight: 0, contentWidth: 0,
    };
    node.dirty = false;
    node._prevProps = props;
    node._prevWidth = availableWidth;
    node._prevHeight = availableHeight;
    return;
  }

  const pad = resolvePadding(props);

  // Resolve own dimensions
  let width = resolveSize(props.width, availableWidth, node, "width") ?? availableWidth;
  let height = resolveSize(props.height, availableHeight, node, "height") ?? availableHeight;

  // Aspect ratio: derive missing dimension from the other
  if (props.aspectRatio !== undefined && props.aspectRatio > 0) {
    const hasExplicitWidth = props.width !== undefined;
    const hasExplicitHeight = props.height !== undefined;
    if (hasExplicitWidth && !hasExplicitHeight) {
      height = Math.round(width / props.aspectRatio);
    } else if (!hasExplicitWidth && hasExplicitHeight) {
      width = Math.round(height * props.aspectRatio);
    }
  }

  // flexGrow is an alias; `flex` still works as shorthand for flexGrow
  const flexGrow = props.flexGrow ?? props.flex ?? 0;

  // If we got unlimited height (from a scroll parent), shrink to natural size
  if (height >= UNCONSTRAINED && props.height === undefined && flexGrow === 0) {
    height = measureNaturalHeight(node, width);
  }

  width = clampSize(width, props.minWidth, props.maxWidth);
  height = clampSize(height, props.minHeight, props.maxHeight);

  const innerWidth = Math.max(0, width - pad.left - pad.right);
  const innerHeight = Math.max(0, height - pad.top - pad.bottom);
  const innerX = x + pad.left;
  const innerY = y + pad.top;

  node.layout = {
    x,
    y,
    width,
    height,
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    contentHeight: innerHeight,
    contentWidth: innerWidth,
  };

  if (node.children.length === 0) {
    // Text measurement
    if (node.measureText) {
      const measured = node.measureText(innerWidth);
      node.layout.contentHeight = measured.height;
      node.layout.contentWidth = measured.width;
      // For text nodes with no explicit height, use measured height
      if (props.height === undefined && flexGrow === 0) {
        node.layout.height = measured.height + pad.top + pad.bottom;
        node.layout.innerHeight = measured.height;
        node.layout.contentHeight = measured.height;
      }
    }
    // Store cache for leaf nodes
    node.dirty = false;
    node._prevProps = props;
    node._prevWidth = availableWidth;
    node._prevHeight = availableHeight;
    return;
  }

  // Grid layout: dispatch to computeGridLayout instead of flex path
  if (props.display === "grid") {
    computeGridLayout(node, innerX, innerY, innerWidth, innerHeight);
    // Store cache for grid nodes
    node.dirty = false;
    node._prevProps = props;
    node._prevWidth = availableWidth;
    node._prevHeight = availableHeight;
    return;
  }

  const direction = props.flexDirection ?? "column";
  const wrap = props.flexWrap ?? "nowrap";
  const isColumn = direction === "column";
  const dir = props.direction ?? "ltr";
  const isRtl = dir === "rtl";

  // Resolve gap values: columnGap/rowGap override the shorthand `gap`
  const gapBase = props.gap ?? 0;
  const resolvedColumnGap = props.columnGap ?? gapBase;
  const resolvedRowGap = props.rowGap ?? gapBase;
  // In row direction: columnGap between items on main axis, rowGap between wrap lines
  // In column direction: rowGap between items on main axis, columnGap between wrap lines (columns)
  const mainAxisGap = isColumn ? resolvedRowGap : resolvedColumnGap;
  const crossAxisGap = isColumn ? resolvedColumnGap : resolvedRowGap;

  const align = props.alignItems ?? "stretch";
  const justify = props.justifyContent ?? "start";

  // Filter out display:none and position:absolute children for normal flow
  const allVisibleChildren = node.children.filter((c) => c.props.display !== "none");
  const visibleChildrenUnsorted = allVisibleChildren.filter((c) => c.props.position !== "absolute");
  const absoluteChildren = allVisibleChildren.filter((c) => c.props.position === "absolute");

  // Sort by order property (stable sort preserves document order for equal values)
  const visibleChildren = [...visibleChildrenUnsorted].sort(
    (a, b) => (a.props.order ?? 0) - (b.props.order ?? 0),
  );

  // Lay out hidden children with zero size so their layout is initialized
  for (const child of node.children) {
    if (child.props.display === "none") {
      computeLayout(child, innerX, innerY, 0, 0);
    }
  }

  // Phase 1: Measure children's natural sizes (including margins)
  interface ChildEntry {
    natural: number;         // main-axis size (modified by flex grow/shrink)
    originalNatural: number; // pre-flex natural size (never modified)
    flexGrow: number;
    flexShrink: number;
    margin: Margin;
    marginAuto: MarginAuto;
    mainMargin: number;      // total margin along main axis
    crossMargin: number;     // total margin along cross axis
    naturalCross: number;    // cross-axis natural size (for wrap)
    node: LayoutNode;
  }

  function measureChildEntry(child: LayoutNode): ChildEntry {
    const cp = child.props;
    const childFlexGrow = cp.flexGrow ?? cp.flex ?? 0;
    const childFlexShrink = cp.flexShrink ?? 1;
    const childMargin = resolveMargin(cp);
    const childMarginAuto = resolveMarginAuto(cp);
    const mainMargin = isColumn
      ? childMargin.top + childMargin.bottom
      : childMargin.left + childMargin.right;
    const crossMargin = isColumn
      ? childMargin.left + childMargin.right
      : childMargin.top + childMargin.bottom;

    const basisRaw = cp.flexBasis;
    const mainAvailableForBasis = isColumn ? innerHeight : innerWidth;
    const basisVal = basisRaw !== undefined ? resolveSize(basisRaw, mainAvailableForBasis) : undefined;
    let natural: number;

    if (childFlexGrow > 0 && basisVal === undefined) {
      natural = 0;
    } else if (basisVal !== undefined) {
      natural = basisVal;
    } else {
      const resolved = resolveSize(
        isColumn ? cp.height : cp.width,
        mainAvailableForBasis,
      );

      if (resolved !== undefined) {
        natural = resolved;
      } else if (child.measureText) {
        const measureWidth = isColumn ? Math.max(0, innerWidth - crossMargin) : UNCONSTRAINED;
        const measured = child.measureText(measureWidth);
        natural = isColumn ? measured.height : measured.width;
        const childPad = resolvePadding(cp);
        natural += isColumn
          ? childPad.top + childPad.bottom
          : childPad.left + childPad.right;
      } else {
        if (isColumn) {
          natural = measureNaturalHeight(child, Math.max(0, innerWidth - crossMargin));
        } else {
          natural = measureNaturalWidth(child, Math.max(0, innerHeight - crossMargin));
        }
      }

      const min = isColumn ? cp.minHeight : cp.minWidth;
      const max = isColumn ? cp.maxHeight : cp.maxWidth;
      natural = clampSize(natural, min, max);
    }

    // Measure cross-axis natural size
    let naturalCross: number;
    const crossResolved = resolveSize(
      isColumn ? cp.width : cp.height,
      isColumn ? innerWidth : innerHeight,
    );
    if (crossResolved !== undefined) {
      naturalCross = crossResolved;
    } else if (isColumn) {
      naturalCross = measureNaturalWidth(child, innerHeight);
    } else {
      naturalCross = measureNaturalHeight(child, innerWidth);
    }

    // Compute true content size for scroll containers (ignoring flex)
    let originalNatural = natural;
    if (childFlexGrow > 0 && basisVal === undefined) {
      // natural was set to 0 for flex distribution, but we need actual size
      if (child.measureText) {
        const mw = isColumn ? Math.max(0, innerWidth - crossMargin) : UNCONSTRAINED;
        const m = child.measureText(mw);
        originalNatural = isColumn ? m.height : m.width;
      } else {
        originalNatural = isColumn
          ? measureNaturalHeight(child, Math.max(0, innerWidth - crossMargin))
          : measureNaturalWidth(child, Math.max(0, innerHeight - crossMargin));
      }
    }

    return {
      natural,
      originalNatural,
      flexGrow: childFlexGrow,
      flexShrink: childFlexShrink,
      margin: childMargin,
      marginAuto: childMarginAuto,
      mainMargin,
      crossMargin,
      naturalCross,
      node: child,
    };
  }

  const childEntries: ChildEntry[] = visibleChildren.map(measureChildEntry);

  // ── Wrap logic: split children into wrap lines ──
  const mainSize = isColumn ? innerHeight : innerWidth;
  const crossSize = isColumn ? innerWidth : innerHeight;

  interface WrapLine {
    entries: ChildEntry[];
    mainTotal: number;   // total natural main size + gaps + margins
    crossMax: number;    // max cross size in the line
  }

  let wrapLines: WrapLine[];

  if (wrap === "wrap") {
    // Split entries into lines that fit within mainSize
    wrapLines = [];
    let currentLine: ChildEntry[] = [];
    let currentMainTotal = 0;

    for (const entry of childEntries) {
      const entryMain = entry.natural + entry.mainMargin;
      const gapBefore = currentLine.length > 0 ? mainAxisGap : 0;

      if (currentLine.length > 0 && currentMainTotal + gapBefore + entryMain > mainSize) {
        // Start new line
        const crossMax = Math.max(...currentLine.map(e => e.naturalCross + e.crossMargin), 0);
        wrapLines.push({
          entries: currentLine,
          mainTotal: currentMainTotal,
          crossMax,
        });
        currentLine = [entry];
        currentMainTotal = entryMain;
      } else {
        currentLine.push(entry);
        currentMainTotal += gapBefore + entryMain;
      }
    }
    if (currentLine.length > 0) {
      const crossMax = Math.max(...currentLine.map(e => e.naturalCross + e.crossMargin), 0);
      wrapLines.push({
        entries: currentLine,
        mainTotal: currentMainTotal,
        crossMax,
      });
    }
  } else {
    // No wrap — single line with all entries
    const totalMarginMain = childEntries.reduce((s, e) => s + e.mainMargin, 0);
    const totalNatural = childEntries.reduce((s, e) => s + e.natural, 0);
    wrapLines = [{
      entries: childEntries,
      mainTotal: totalNatural + totalMarginMain + mainAxisGap * Math.max(0, childEntries.length - 1),
      crossMax: crossSize,
    }];
  }

  // Phase 2 + 3 + 4: For each wrap line, distribute flex, justify, and position
  let crossOffset = 0;
  let contentTotal = 0;

  // align-content: distribute wrap lines along the cross axis
  const alignContentVal = props.alignContent ?? "stretch";
  let alignContentStartOffset = 0;
  let alignContentLineGap = crossAxisGap;

  if (wrap === "wrap" && wrapLines.length > 1) {
    const totalLineCross = wrapLines.reduce((s, l) => s + l.crossMax, 0);
    const totalCrossGaps = crossAxisGap * (wrapLines.length - 1);
    const freeCross = crossSize - totalLineCross - totalCrossGaps;

    switch (alignContentVal) {
      case "flex-start":
        break;
      case "flex-end":
        alignContentStartOffset = freeCross;
        break;
      case "center":
        alignContentStartOffset = Math.floor(freeCross / 2);
        break;
      case "space-between":
        if (wrapLines.length > 1) {
          alignContentLineGap = crossAxisGap + Math.floor(freeCross / (wrapLines.length - 1));
        }
        break;
      case "space-around": {
        const aroundSpace = Math.floor(freeCross / (wrapLines.length * 2));
        alignContentStartOffset = aroundSpace;
        alignContentLineGap = crossAxisGap + aroundSpace * 2;
        break;
      }
      case "stretch":
      default: {
        // Distribute extra cross space evenly among lines
        if (freeCross > 0) {
          const extraPerLine = Math.floor(freeCross / wrapLines.length);
          for (const wl of wrapLines) {
            wl.crossMax += extraPerLine;
          }
        }
        break;
      }
    }
  }

  crossOffset = alignContentStartOffset;

  for (let lineIdx = 0; lineIdx < wrapLines.length; lineIdx++) {
    const line = wrapLines[lineIdx]!;
    const lineEntries = line.entries;
    const lineCount = lineEntries.length;

    // For single-line (nowrap), cross size is full cross; for wrap, use the line's max cross size
    const lineCrossSize = wrap === "wrap" ? line.crossMax : crossSize;

    // Phase 2: Distribute flex space within this line
    let lineTotalNatural = 0;
    let lineTotalFlexGrow = 0;
    let lineTotalMarginMain = 0;
    for (const entry of lineEntries) {
      lineTotalNatural += entry.natural;
      lineTotalFlexGrow += entry.flexGrow;
      lineTotalMarginMain += entry.mainMargin;
    }
    const lineGap = mainAxisGap * Math.max(0, lineCount - 1);
    const spaceForChildren = mainSize - lineGap - lineTotalMarginMain;
    const remainingSpace = spaceForChildren - lineTotalNatural;

    if (remainingSpace >= 0 && lineTotalFlexGrow > 0) {
      for (const entry of lineEntries) {
        if (entry.flexGrow > 0 && entry.natural === 0) {
          entry.natural = Math.floor((entry.flexGrow / lineTotalFlexGrow) * remainingSpace);
        } else if (entry.flexGrow > 0) {
          entry.natural += Math.floor((entry.flexGrow / lineTotalFlexGrow) * remainingSpace);
        }
        const cp = entry.node.props;
        const min = isColumn ? cp.minHeight : cp.minWidth;
        const max = isColumn ? cp.maxHeight : cp.maxWidth;
        entry.natural = clampSize(entry.natural, min, max);
      }
    } else if (remainingSpace < 0) {
      let totalShrinkWeighted = 0;
      for (const entry of lineEntries) {
        totalShrinkWeighted += entry.flexShrink * entry.natural;
      }
      if (totalShrinkWeighted > 0) {
        const overflow = -remainingSpace;
        for (const entry of lineEntries) {
          if (entry.flexShrink > 0 && entry.natural > 0) {
            const shrinkAmount = Math.floor(
              (entry.flexShrink * entry.natural / totalShrinkWeighted) * overflow,
            );
            entry.natural = Math.max(0, entry.natural - shrinkAmount);
          }
          const cp = entry.node.props;
          const min = isColumn ? cp.minHeight : cp.minWidth;
          const max = isColumn ? cp.maxHeight : cp.maxWidth;
          entry.natural = clampSize(entry.natural, min, max);
        }
      }
    }

    // BUG FIX: Re-measure text nodes with flexGrow after flex distribution
    // Text nodes with flexGrow>0 initially got natural=0, but now have their
    // allocated size. In row layout, their cross-axis size depends on the
    // main-axis width they received.
    for (const entry of lineEntries) {
      if (entry.flexGrow > 0 && entry.node.measureText && !isColumn) {
        // Row layout: text node got a width from flex; re-measure cross (height)
        const measured = entry.node.measureText(entry.natural);
        entry.naturalCross = measured.height + resolvePadding(entry.node.props).top + resolvePadding(entry.node.props).bottom;
      }
    }

    // Phase 3: Position children (justifyContent) within this line
    let mainOffset: number;
    let lineMainGap = mainAxisGap;
    const totalChildSize = lineEntries.reduce((sum, e) => sum + e.natural, 0);
    const freeSpace = mainSize - totalChildSize - lineGap - lineTotalMarginMain;

    switch (justify) {
      case "center":
        mainOffset = Math.floor(freeSpace / 2);
        break;
      case "end":
        mainOffset = freeSpace;
        break;
      case "space-between":
        mainOffset = 0;
        if (lineCount > 1) {
          lineMainGap = mainAxisGap + Math.floor(freeSpace / (lineCount - 1));
        }
        break;
      case "space-around": {
        const around = Math.floor(freeSpace / (lineCount * 2));
        mainOffset = around;
        lineMainGap = mainAxisGap + around * 2;
        break;
      }
      case "space-evenly": {
        const evenSpace = Math.floor(freeSpace / (lineCount + 1));
        mainOffset = evenSpace;
        lineMainGap = mainAxisGap + evenSpace;
        break;
      }
      default: // "start"
        mainOffset = 0;
    }

    // Phase 4: Lay out each child in this line
    let lineContentTotal = 0;
    for (let i = 0; i < lineEntries.length; i++) {
      const entry = lineEntries[i]!;
      const child = entry.node;
      const cm = entry.margin;
      const cma = entry.marginAuto;

      const mainMarginBefore = isColumn ? cm.top : cm.left;
      const mainMarginAfter = isColumn ? cm.bottom : cm.right;
      const crossMarginBefore = isColumn ? cm.left : cm.top;
      const crossMarginAfter = isColumn ? cm.right : cm.bottom;
      const mainAutoStart = isColumn ? cma.top : cma.left;
      const mainAutoEnd = isColumn ? cma.bottom : cma.right;
      const crossAutoStart = isColumn ? cma.left : cma.top;
      const crossAutoEnd = isColumn ? cma.right : cma.bottom;

      // Resolve auto margins on main axis: absorb free space
      let effectiveMainMarginBefore = mainMarginBefore;
      if (mainAutoStart || mainAutoEnd) {
        const entryFreeSpace = mainSize - totalChildSize - lineGap - lineTotalMarginMain;
        if (mainAutoStart && mainAutoEnd) {
          effectiveMainMarginBefore = Math.floor(entryFreeSpace / 2);
        } else if (mainAutoStart) {
          effectiveMainMarginBefore = entryFreeSpace;
        }
        // mainAutoEnd only: nothing to add before
      }

      mainOffset += effectiveMainMarginBefore;

      const selfAlign = child.props.alignSelf;
      let effectiveAlign: Align =
        selfAlign !== undefined && selfAlign !== "auto"
          ? selfAlign
          : align;

      // RTL + column: cross axis is horizontal, so swap start/end
      if (isRtl && isColumn) {
        if (effectiveAlign === "start") effectiveAlign = "end";
        else if (effectiveAlign === "end") effectiveAlign = "start";
      }

      const availableCross = lineCrossSize - crossMarginBefore - crossMarginAfter;
      let childCrossSize: number;
      let childCrossOffset: number;
      const childCrossResolved = resolveSize(
        isColumn ? child.props.width : child.props.height,
        availableCross,
      );

      if (childCrossResolved !== undefined) {
        childCrossSize = childCrossResolved;
      } else if (crossAutoStart || crossAutoEnd) {
        // Auto cross margins: use natural size, then center
        if (isColumn) {
          childCrossSize = measureNaturalWidth(child, entry.natural);
        } else {
          childCrossSize = measureNaturalHeight(child, entry.natural);
        }
        childCrossSize = Math.min(childCrossSize, availableCross);
      } else if (effectiveAlign === "stretch") {
        childCrossSize = availableCross;
      } else {
        // BUG FIX: non-stretch should use natural size, not available size
        if (isColumn) {
          childCrossSize = measureNaturalWidth(child, entry.natural);
        } else {
          childCrossSize = measureNaturalHeight(child, entry.natural);
        }
        childCrossSize = Math.min(childCrossSize, availableCross);
      }

      // Resolve cross-axis offset with auto margins
      if (crossAutoStart && crossAutoEnd) {
        childCrossOffset = crossMarginBefore + Math.floor((availableCross - childCrossSize) / 2);
      } else if (crossAutoStart) {
        childCrossOffset = crossMarginBefore + availableCross - childCrossSize;
      } else if (crossAutoEnd) {
        childCrossOffset = crossMarginBefore;
      } else {
        switch (effectiveAlign) {
          case "center":
            childCrossOffset = crossMarginBefore + Math.floor((availableCross - childCrossSize) / 2);
            break;
          case "end":
            childCrossOffset = crossMarginBefore + availableCross - childCrossSize;
            break;
          case "baseline":
            // In terminal UI, baseline aligns text bottoms (same as "end")
            childCrossOffset = crossMarginBefore + availableCross - childCrossSize;
            break;
          default: // "start" | "stretch"
            childCrossOffset = crossMarginBefore;
        }
      }

      const childX = isColumn ? innerX + crossOffset + childCrossOffset : innerX + mainOffset;
      const childY = isColumn ? innerY + mainOffset : innerY + crossOffset + childCrossOffset;
      const childW = isColumn ? childCrossSize : entry.natural;
      const childH = isColumn ? entry.natural : childCrossSize;

      // Scroll containers: give children unlimited main-axis space.
      // This is the correct CSS overflow:scroll behavior — children are NOT
      // constrained to the viewport. They render at their natural height,
      // and the scroll view clips + scrolls the overflow.
      const parentIsScroll = props.overflow === "scroll";
      const childAvailH = parentIsScroll && isColumn ? UNCONSTRAINED : childH;
      const childAvailW = parentIsScroll && !isColumn ? UNCONSTRAINED : childW;
      computeLayout(child, childX, childY,
        isColumn ? childW : childAvailW,
        isColumn ? childAvailH : childH);

      // RTL + row: flip x positions so children flow right-to-left
      if (isRtl && !isColumn) {
        flipXRecursive(child, innerX, innerWidth);
      }

      const actualMainSize = isColumn
        ? child.layout.height
        : child.layout.width;

      mainOffset += actualMainSize + mainMarginAfter + lineMainGap;
      lineContentTotal += mainMarginBefore + actualMainSize + mainMarginAfter + (i < lineEntries.length - 1 ? mainAxisGap : 0);
    }

    contentTotal += lineContentTotal + (lineIdx > 0 ? crossAxisGap : 0);
    crossOffset += lineCrossSize + alignContentLineGap;
  }

  // Phase 5: Lay out absolute-positioned children
  for (const child of absoluteChildren) {
    const cp = child.props;
    const childW = resolveSize(cp.width, innerWidth) ?? innerWidth;
    const childH = resolveSize(cp.height, innerHeight) ?? innerHeight;
    const clampedW = clampSize(childW, cp.minWidth, cp.maxWidth);
    const clampedH = clampSize(childH, cp.minHeight, cp.maxHeight);

    let childX: number;
    if (cp.left !== undefined) {
      childX = innerX + cp.left;
    } else if (cp.right !== undefined) {
      childX = innerX + innerWidth - clampedW - cp.right;
    } else {
      childX = innerX;
    }

    let childY: number;
    if (cp.top !== undefined) {
      childY = innerY + cp.top;
    } else if (cp.bottom !== undefined) {
      childY = innerY + innerHeight - clampedH - cp.bottom;
    } else {
      childY = innerY;
    }

    computeLayout(child, childX, childY, clampedW, clampedH);
  }

  // contentHeight is the ACTUAL content total, not clamped to viewport.
  // The viewport clip in paintScrollView handles visual clipping.
  node.layout.contentHeight = isColumn ? Math.max(contentTotal, innerHeight) : innerHeight;
  node.layout.contentWidth = isColumn ? innerWidth : Math.max(contentTotal, innerWidth);

  // ── Store cache for incremental layout ──
  node.dirty = false;
  node._prevProps = props;
  node._prevWidth = availableWidth;
  node._prevHeight = availableHeight;
}

/**
 * Compute the natural height of a node tree given a width constraint.
 * Used for measuring content size before final layout.
 */
export function measureNaturalHeight(
  node: LayoutNode,
  availableWidth: number,
): number {
  if (node.props.display === "none") return 0;

  const pad = resolvePadding(node.props);
  const margin = resolveMargin(node.props);
  const innerWidth = Math.max(0, availableWidth - pad.left - pad.right - margin.left - margin.right);

  if (node.props.flexBasis !== undefined) {
    const resolvedBasis = resolveSize(node.props.flexBasis, availableWidth);
    if (resolvedBasis !== undefined) {
      return resolvedBasis + margin.top + margin.bottom;
    }
  }

  if (node.measureText) {
    const measured = node.measureText(innerWidth);
    return measured.height + pad.top + pad.bottom + margin.top + margin.bottom;
  }

  if (node.children.length === 0) {
    const h = resolveSize(node.props.height, 0);
    return (h ?? pad.top + pad.bottom) + margin.top + margin.bottom;
  }

  const direction = node.props.flexDirection ?? "column";
  const isColumn = direction === "column";
  const rawGap = node.props.gap ?? 0;
  const gap = isColumn
    ? (node.props.rowGap ?? rawGap)
    : (node.props.columnGap ?? rawGap);

  const visibleChildren = node.children.filter((c) => c.props.display !== "none");

  if (isColumn) {
    let total = 0;
    for (let i = 0; i < visibleChildren.length; i++) {
      total += measureNaturalHeight(visibleChildren[i]!, innerWidth);
      if (i < visibleChildren.length - 1) total += gap;
    }
    return total + pad.top + pad.bottom + margin.top + margin.bottom;
  } else {
    let maxH = 0;
    for (const child of visibleChildren) {
      maxH = Math.max(maxH, measureNaturalHeight(child, innerWidth));
    }
    return maxH + pad.top + pad.bottom + margin.top + margin.bottom;
  }
}

/**
 * Compute the natural width of a node tree given a height constraint.
 * Used for row-direction natural sizing.
 */
export function measureNaturalWidth(
  node: LayoutNode,
  availableHeight: number,
): number {
  if (node.props.display === "none") return 0;

  const pad = resolvePadding(node.props);
  const margin = resolveMargin(node.props);

  if (node.props.flexBasis !== undefined) {
    const resolvedBasis = resolveSize(node.props.flexBasis, availableHeight);
    if (resolvedBasis !== undefined) {
      return resolvedBasis + margin.left + margin.right;
    }
  }

  if (node.measureText) {
    // For text, measure with a very large width to get the "unwrapped" width
    const measured = node.measureText(UNCONSTRAINED);
    return measured.width + pad.left + pad.right + margin.left + margin.right;
  }

  if (node.children.length === 0) {
    const w = resolveSize(node.props.width, 0);
    return (w ?? pad.left + pad.right) + margin.left + margin.right;
  }

  const direction = node.props.flexDirection ?? "column";
  const isColumn = direction === "column";
  const rawGap = node.props.gap ?? 0;
  // measureNaturalWidth: for row direction, items are side-by-side so gap = columnGap
  const gap = isColumn
    ? (node.props.rowGap ?? rawGap)
    : (node.props.columnGap ?? rawGap);

  const visibleChildren = node.children.filter((c) => c.props.display !== "none");

  if (!isColumn) {
    // Row: children side by side
    let total = 0;
    for (let i = 0; i < visibleChildren.length; i++) {
      total += measureNaturalWidth(visibleChildren[i]!, availableHeight);
      if (i < visibleChildren.length - 1) total += gap;
    }
    return total + pad.left + pad.right + margin.left + margin.right;
  } else {
    // Column: widest child
    let maxW = 0;
    for (const child of visibleChildren) {
      maxW = Math.max(maxW, measureNaturalWidth(child, availableHeight));
    }
    return maxW + pad.left + pad.right + margin.left + margin.right;
  }
}
