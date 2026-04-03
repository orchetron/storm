/**
 * Renderer — paints the TUI element tree into a ScreenBuffer.
 *
 * After React commits and layout is computed, this walks the tree
 * and writes characters + styles into the cell buffer.
 * Handles text wrapping, borders, scroll viewport clipping.
 *
 * All mutable state lives in a RenderContext instance — no module-level
 * singletons. This enables multi-instance use and testing.
 */

import { ScreenBuffer } from "../core/buffer.js";
import type { RenderContext } from "../core/render-context.js";
import { charWidth, stringWidth, iterGraphemes } from "../core/unicode.js";
import {
  type Cell,
  DEFAULT_COLOR,
  Attr,
  parseColor,
  styleToAttrs,
  BORDER_CHARS,
  type BorderStyle,
} from "../core/types.js";
import { computeLayout, type LayoutNode, type Overflow } from "../layout/engine.js";
import {
  type TuiElement,
  type TuiTextNode,
  type TuiRoot,
  isTuiElement,
  isTuiTextNode,
  TUI_BOX,
  TUI_TEXT,
  TUI_SCROLL_VIEW,
  TUI_TEXT_INPUT,
  TUI_OVERLAY,
  type BackgroundProp,
  type BackgroundPattern,
} from "./types.js";
import { notifyResizeObservers, setResizeObserverMeasureMap } from "../core/resize-observer.js";

// ── Animation baseline ─────────────────────────────────────────────

/** Module-level start time for background animations — no timers needed. */
const bgAnimStartTime = Date.now();

// ── Clip rect ───────────────────────────────────────────────────────

interface ClipRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function intersectClip(a: ClipRect, b: ClipRect): ClipRect {
  return {
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    x2: Math.min(a.x2, b.x2),
    y2: Math.min(a.y2, b.y2),
  };
}

function isClipEmpty(c: ClipRect): boolean {
  return c.x1 >= c.x2 || c.y1 >= c.y2;
}

// ── ANSI stripping ──────────────────────────────────────────────────

/** Strip ANSI escape sequences from text to prevent injection into cell buffer. */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}

// ── Text wrapping ───────────────────────────────────────────────────

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [];
  const lines: string[] = [];

  for (const rawLine of text.split("\n")) {
    if (rawLine.length === 0) {
      lines.push("");
      continue;
    }

    // Build grapheme list with string offsets for correct slicing
    const graphemes: { offset: number; len: number; width: number; text: string }[] = [];
    let pos = 0;
    for (const g of iterGraphemes(rawLine)) {
      graphemes.push({ offset: pos, len: g.text.length, width: g.width, text: g.text });
      pos += g.text.length;
    }

    let lineStartIdx = 0; // index into graphemes[]
    let lineWidth = 0;
    let lastSpaceIdx = -1; // index into graphemes[]

    for (let gi = 0; gi < graphemes.length; gi++) {
      const g = graphemes[gi]!;
      if (g.text === " ") lastSpaceIdx = gi;
      lineWidth += g.width;

      if (lineWidth > width) {
        const breakIdx = lastSpaceIdx > lineStartIdx ? lastSpaceIdx : gi;
        const startOffset = graphemes[lineStartIdx]!.offset;
        const endOffset = graphemes[breakIdx]!.offset;
        lines.push(rawLine.slice(startOffset, endOffset));
        const skipSpace = lastSpaceIdx > lineStartIdx ? 1 : 0;
        lineStartIdx = breakIdx + skipSpace;
        // Re-measure from lineStartIdx to current position
        lineWidth = 0;
        for (let j = lineStartIdx; j <= gi; j++) {
          lineWidth += graphemes[j]!.width;
        }
        lastSpaceIdx = -1;
      }
    }
    if (lineStartIdx < graphemes.length) {
      const startOffset = graphemes[lineStartIdx]!.offset;
      lines.push(rawLine.slice(startOffset));
    }
  }

  return lines;
}

/** Bump the runs version on a RenderContext so all styled-run caches are stale. */
export function invalidateStyledRunsCache(ctx: RenderContext): void {
  ctx.runsVersion++;
}

// ── Main paint function ─────────────────────────────────────────────

export interface PaintResult {
  buffer: ScreenBuffer;
  /** Cursor position for focused TextInput (-1 if none) */
  cursorX: number;
  cursorY: number;
}

// ── Measure layout map ──────────────────────────────────────────────

export interface MeasuredLayout {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Paint a background pattern into an existing buffer.
 * Public wrapper used by render() to apply full-app backgrounds
 * before the component tree is painted.
 */
export function paintBackgroundToBuffer(
  buffer: ScreenBuffer,
  width: number,
  height: number,
  background: BackgroundProp,
): void {
  paintBackgroundPattern(buffer, 0, 0, width, height, background, DEFAULT_COLOR);
}

/**
 * Full paint: rebuild layout + paint buffer.
 * Called on React commits (structural changes).
 */
export function paint(
  root: TuiRoot,
  width: number,
  height: number,
  ctx: RenderContext,
): PaintResult {
  // Rebuild layout if tree changed or dimensions changed
  if (!ctx.layoutBuilt || width !== ctx.lastLayoutWidth || height !== ctx.lastLayoutHeight) {
    for (const child of root.children) {
      if (isTuiElement(child)) {
        buildLayoutTree(child);
        computeLayout(child.layoutNode, 0, 0, width, height);
      }
    }
    ctx.layoutBuilt = true;
    ctx.lastLayoutWidth = width;
    ctx.lastLayoutHeight = height;
  }

  return repaint(root, width, height, ctx);
}

/**
 * Fast repaint: skip layout, just paint buffer from cached layout.
 * Reuses buffer to avoid allocation overhead on scroll frames.
 */
export function repaint(
  root: TuiRoot,
  width: number,
  height: number,
  ctx: RenderContext,
): PaintResult {
  if (!ctx.buffer || ctx.buffer.width !== width || ctx.buffer.height !== height) {
    ctx.buffer = new ScreenBuffer(width, height);
  } else {
    ctx.buffer.clear();
  }
  const clip: ClipRect = { x1: 0, y1: 0, x2: width, y2: height };
  ctx.cursorX = -1;
  ctx.cursorY = -1;
  ctx.measureMap.clear();
  ctx.swapScrollStates();
  // Per-element _runsDirty flag replaces global runsVersion++.
  // commitUpdate and commitTextUpdate set _runsDirty on changed elements,
  // so only affected text elements rebuild their styled runs.
  ctx.links = [];

  // Paint root-level background pattern (from render options) BEFORE the component tree
  if (ctx.rootBackground) {
    paintBackgroundPattern(ctx.buffer, 0, 0, width, height, ctx.rootBackground, DEFAULT_COLOR);
  }

  // Single pass: paint normal elements, collect overlays for deferred painting
  const overlays: TuiElement[] = [];
  for (const child of root.children) {
    if (isTuiElement(child)) {
      if (child.type === TUI_OVERLAY) {
        overlays.push(child);
      } else {
        collectOverlaysFromTree(child, overlays);
        paintElement(ctx.buffer, child, clip, 0, 0, ctx);
      }
    }
  }

  // Sort overlays by zIndex so higher values paint on top (later = higher)
  overlays.sort((a, b) => {
    const zA = (a.props["zIndex"] as number | undefined) ?? 0;
    const zB = (b.props["zIndex"] as number | undefined) ?? 0;
    return zA - zB;
  });

  // Paint collected overlays ON TOP (overwriting cells)
  for (const overlay of overlays) {
    paintOverlay(ctx.buffer, overlay, clip, width, height, ctx);
  }

  // Notify resize observers of any layout changes
  setResizeObserverMeasureMap(ctx.measureMap, ctx.resizeObservers);
  notifyResizeObservers();

  // Prune stale image entries for unmounted components
  ctx.pruneStaleImages();

  return { buffer: ctx.buffer, cursorX: ctx.cursorX, cursorY: ctx.cursorY };
}

/**
 * Rebuild the layout node tree to mirror the element tree.
 * Must be called before computeLayout when the tree structure changes.
 *
 * Marks nodes as dirty when their props or children change,
 * enabling incremental layout caching in computeLayout.
 */
function buildLayoutTree(element: TuiElement): void {
  const node = element.layoutNode;
  const oldChildCount = node._prevChildCount ?? -1;
  node.children = [];

  // Set up text measurement if this is a text element
  if (element.type === TUI_TEXT) {
    const text = collectText(element);
    const wrapMode = (element.props["wrap"] as string | undefined) ?? "wrap";
    node.measureText = (availableWidth: number) => {
      if (wrapMode !== "wrap") {
        // Truncate modes: always 1 line
        const fullWidth = stringWidth(text.replace(/\n/g, " "));
        return {
          width: Math.min(availableWidth, fullWidth),
          height: 1,
        };
      }
      const lines = wrapText(text, availableWidth);
      return {
        width: Math.min(availableWidth, Math.max(...lines.map(l => stringWidth(l)), 0)),
        height: lines.length,
      };
    };
    // Text nodes always get a new measureText closure, so mark dirty
    // when the element's _runsDirty flag indicates text content changed.
    if (element._runsDirty) {
      node.dirty = true;
    }
  } else {
    delete node.measureText;
  }

  // Mark dirty if layout props object changed (commitUpdate replaces it)
  if (node._prevProps !== node.props) {
    node.dirty = true;
  }

  // Scroll containers: always mark dirty so children are re-laid-out
  // (their positions depend on scrollTop which can change independently).
  if (element.type === TUI_SCROLL_VIEW) {
    node.dirty = true;
  }

  for (const child of element.children) {
    if (isTuiElement(child)) {
      buildLayoutTree(child);
      node.children.push(child.layoutNode);
      // If any child is dirty, parent must also be dirty
      // (parent's layout depends on children's sizes)
      if (child.layoutNode.dirty) {
        node.dirty = true;
      }
    }
  }

  // Mark dirty if child count changed
  if (node.children.length !== oldChildCount) {
    node.dirty = true;
  }
  node._prevChildCount = node.children.length;
}

/** Collect all text content from a text element and its children. */
function collectText(element: TuiElement | TuiTextNode): string {
  if (isTuiTextNode(element)) return element.text;
  let text = "";
  for (const child of (element as TuiElement).children) {
    text += collectText(child);
  }
  return text;
}

// ── Element painting ────────────────────────────────────────────────

function paintElement(
  buffer: ScreenBuffer,
  element: TuiElement,
  clip: ClipRect,
  scrollOffsetX: number,
  scrollOffsetY: number,
  ctx: RenderContext,
  stickyFromParent = false,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  const layout = element.layoutNode.layout;
  let y = layout.y - scrollOffsetY;

  // Sticky: if the element would be scrolled above the clip top, pin it
  const isSticky = element.props["sticky"] === true || stickyFromParent;
  if (isSticky && y < clip.y1) {
    // Adjust scrollOffsetY so this element paints at the clip top
    scrollOffsetY = scrollOffsetY - (clip.y1 - y);
    y = clip.y1;
  }

  const x = layout.x - scrollOffsetX;

  // ── Viewport culling: skip entire subtree if element is fully outside clip ──
  // Skip culling for scroll views (they compute their own viewport clip) and
  // overlays (positioned independently, painted in second pass anyway).
  if (element.type !== TUI_SCROLL_VIEW && element.type !== TUI_OVERLAY) {
    const elemBottom = y + layout.height;
    const elemRight = x + layout.width;
    if (elemBottom <= clip.y1 || y >= clip.y2 || elemRight <= clip.x1 || x >= clip.x2) {
      return;
    }
  }

  // Store layout for measureElement API
  storeMeasureLayout(element, ctx);

  switch (element.type) {
    case TUI_BOX:
      paintBox(buffer, element, clip, scrollOffsetX, scrollOffsetY, ctx, inheritedBg);
      break;
    case TUI_TEXT:
      paintText(buffer, element, clip, x, y, ctx, inheritedBg);
      break;
    case TUI_SCROLL_VIEW:
      paintScrollView(buffer, element, clip, scrollOffsetX, scrollOffsetY, ctx, inheritedBg);
      break;
    case TUI_TEXT_INPUT:
      paintTextInput(buffer, element, clip, x, y, ctx, inheritedBg);
      break;
    case TUI_OVERLAY:
      // Overlays painted in second pass; skip in normal paint
      break;
  }
}

/** Store layout result for elements with _measureId prop. */
function storeMeasureLayout(element: TuiElement, ctx: RenderContext): void {
  const measureId = element.props["_measureId"] as string | undefined;
  if (measureId) {
    const layout = element.layoutNode.layout;
    ctx.measureMap.set(measureId, {
      width: layout.width,
      height: layout.height,
      x: layout.x,
      y: layout.y,
    });
  }
}

/** Recursively collect overlay elements from a subtree (without painting). */
function collectOverlaysFromTree(
  element: TuiElement,
  overlays: TuiElement[],
): void {
  for (const child of element.children) {
    if (!isTuiElement(child)) continue;
    if (child.type === TUI_OVERLAY) {
      overlays.push(child);
    } else {
      collectOverlaysFromTree(child, overlays);
    }
  }
}

function paintOverlay(
  buffer: ScreenBuffer,
  element: TuiElement,
  clip: ClipRect,
  screenWidth: number,
  screenHeight: number,
  ctx: RenderContext,
): void {
  const props = element.props;
  const position = (props["position"] as "center" | "bottom" | "top" | undefined) ?? "center";

  // Resolve overlay dimensions
  const rawWidth = props["width"] as number | `${number}%` | undefined;
  let overlayWidth: number;
  if (rawWidth === undefined) {
    overlayWidth = Math.min(screenWidth, 60);
  } else if (typeof rawWidth === "string") {
    overlayWidth = Math.floor((parseFloat(rawWidth) / 100) * screenWidth);
  } else {
    overlayWidth = rawWidth;
  }
  overlayWidth = Math.min(overlayWidth, screenWidth);

  const rawHeight = (props["height"] as number | undefined) ?? Math.min(screenHeight, 20);
  const overlayHeight = Math.min(rawHeight, screenHeight);

  // Position overlay on screen
  let overlayX: number;
  let overlayY: number;

  switch (position) {
    case "center":
      overlayX = Math.floor((screenWidth - overlayWidth) / 2);
      overlayY = Math.floor((screenHeight - overlayHeight) / 2);
      break;
    case "top":
      overlayX = Math.floor((screenWidth - overlayWidth) / 2);
      overlayY = 0;
      break;
    case "bottom":
      overlayX = Math.floor((screenWidth - overlayWidth) / 2);
      overlayY = screenHeight - overlayHeight;
      break;
  }

  // Rebuild and compute layout for overlay subtree at the computed position
  buildLayoutTree(element);
  computeLayout(element.layoutNode, overlayX, overlayY, overlayWidth, overlayHeight);

  storeMeasureLayout(element, ctx);

  // Draw border — pass overlay bg for border cell backgrounds
  const borderStyle = props["borderStyle"] as BorderStyle | undefined;
  const overlayBgRaw = props["backgroundColor"] as string | number | undefined;
  const overlayBg = overlayBgRaw !== undefined ? parseColor(overlayBgRaw) : DEFAULT_COLOR;
  if (borderStyle && borderStyle !== "none") {
    paintBorder(buffer, overlayX, overlayY, overlayWidth, overlayHeight, borderStyle,
      parseColor(props["borderColor"] as string | number | undefined), clip, ALL_SIDES, NO_DIM, overlayBg);
  }

  // Paint children — propagate overlay backgroundColor to descendants
  for (const child of element.children) {
    if (isTuiElement(child)) {
      paintElement(buffer, child, clip, 0, 0, ctx, false, overlayBg);
    }
  }
}

function extractBorderFlags(props: Record<string, unknown>): { sides: BorderSideFlags; dim: BorderDimFlags } {
  const hasBorder = props["borderStyle"] !== undefined && props["borderStyle"] !== "none";
  return {
    sides: {
      top: hasBorder && (props["borderTop"] as boolean | undefined) !== false,
      bottom: hasBorder && (props["borderBottom"] as boolean | undefined) !== false,
      left: hasBorder && (props["borderLeft"] as boolean | undefined) !== false,
      right: hasBorder && (props["borderRight"] as boolean | undefined) !== false,
    },
    dim: {
      all: (props["borderDimColor"] as boolean | undefined) === true,
      top: (props["borderTopDimColor"] as boolean | undefined) === true,
      bottom: (props["borderBottomDimColor"] as boolean | undefined) === true,
      left: (props["borderLeftDimColor"] as boolean | undefined) === true,
      right: (props["borderRightDimColor"] as boolean | undefined) === true,
    },
  };
}

// ── Background patterns ────────────────────────────────────────────

function paintBackgroundPattern(
  buffer: ScreenBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  background: BackgroundProp,
  bgColor: number,
): void {
  // Normalize shorthand preset to full pattern object
  const pattern: BackgroundPattern = typeof background === "string"
    ? { type: background }
    : background;

  const dim = pattern.dim ?? true;
  const color = pattern.color ? parseColor(pattern.color) : parseColor("#565F89");
  const attrs = dim ? Attr.DIM : Attr.NONE;

  // Gradient color interpolation helpers
  const gradFrom = pattern.gradient ? parseColor(pattern.gradient[0]) : 0;
  const gradTo = pattern.gradient ? parseColor(pattern.gradient[1]) : 0;
  const gradDir = pattern.direction ?? "horizontal";

  // Animation offset — no timers, driven by the existing render cycle
  const animOffset = pattern.animate
    ? Math.floor((Date.now() - bgAnimStartTime) / (pattern.animateSpeed ?? 200))
    : 0;

  // Opacity blending — 1 means fully opaque (default)
  const opacity = pattern.opacity ?? 1;
  const useOpacity = opacity < 1;

  function lerpColor(c1: number, c2: number, t: number): number {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return 0x1000000 | (r << 16) | (g << 8) | b;
  }

  function gradientT(px: number, py: number): number {
    if (gradDir === "vertical") return height > 1 ? py / (height - 1) : 0;
    if (gradDir === "diagonal") return (width + height) > 2 ? (px + py) / (width + height - 2) : 0;
    return width > 1 ? px / (width - 1) : 0;
  }

  // If a non-gradient pattern has gradient colors, resolve per-cell color
  function cellColor(px: number, py: number): number {
    if (pattern.gradient) return lerpColor(gradFrom, gradTo, gradientT(px, py));
    return color;
  }

  /** Blend a desired fg color with the existing buffer content, respecting opacity. */
  function blendFg(bx: number, by: number, fg: number): number {
    if (!useOpacity) return fg;
    // Blend against the actual buffer bg at this position, not the pattern bgColor
    const existingBg = buffer.getBg(bx, by);
    const base = existingBg !== DEFAULT_COLOR ? existingBg : (bgColor !== DEFAULT_COLOR ? bgColor : 0);
    return lerpColor(base, fg, opacity);
  }

  /** Blend a desired bg color with existing buffer content, respecting opacity. */
  function blendBg(bx: number, by: number, bg: number): number {
    if (!useOpacity) return bg;
    const existingBg = buffer.getBg(bx, by);
    if (existingBg !== DEFAULT_COLOR) {
      return lerpColor(existingBg, bg, opacity);
    }
    return bg;
  }

  switch (pattern.type) {
    case "dots": {
      const spacing = pattern.spacing ?? 4;
      const char = pattern.char ?? "\u00B7"; // middle dot
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          // With animation, shift the modulo check so dots drift
          if ((py + animOffset) % spacing === 0 && (px + animOffset) % spacing === 0) {
            const bx = x + px;
            const by = y + py;
            if (bx < buffer.width && by < buffer.height) {
              const fg = blendFg(bx, by, cellColor(px, py));
              buffer.setCell(bx, by, { char, fg, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
            }
          }
        }
      }
      break;
    }
    case "grid": {
      const spacing = pattern.spacing ?? 6;
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const bx = x + px;
          const by = y + py;
          if (bx >= buffer.width || by >= buffer.height) continue;
          const onRow = (py + animOffset) % spacing === 0;
          const onCol = (px + animOffset) % spacing === 0;
          const cc = blendFg(bx, by, cellColor(px, py));
          if (onRow && onCol) {
            buffer.setCell(bx, by, { char: "\u253C", fg: cc, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
          } else if (onRow) {
            buffer.setCell(bx, by, { char: "\u2500", fg: cc, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
          } else if (onCol) {
            buffer.setCell(bx, by, { char: "\u2502", fg: cc, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
          }
        }
      }
      break;
    }
    case "crosshatch": {
      const spacing = pattern.spacing ?? 3;
      const char = pattern.char ?? "\u00B7";
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          if ((px + py + animOffset) % spacing === 0) {
            const bx = x + px;
            const by = y + py;
            if (bx < buffer.width && by < buffer.height) {
              const fg = blendFg(bx, by, cellColor(px, py));
              buffer.setCell(bx, by, { char, fg, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
            }
          }
        }
      }
      break;
    }
    case "gradient": {
      // Pure gradient — fills every cell's background color along the gradient
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const bx = x + px;
          const by = y + py;
          if (bx < buffer.width && by < buffer.height) {
            // Animation cycles the gradient t value
            const baseT = gradientT(px, py);
            const t = pattern.animate ? ((baseT + animOffset * 0.02) % 1) : baseT;
            const gc = lerpColor(gradFrom, gradTo, t);
            const finalBg = blendBg(bx, by, gc);
            buffer.setCell(bx, by, { char: " ", fg: DEFAULT_COLOR, bg: finalBg, attrs: Attr.NONE, ulColor: DEFAULT_COLOR });
          }
        }
      }
      break;
    }
    case "watermark": {
      const text = pattern.text ?? "";
      if (!text) break;
      const mode = pattern.mode ?? "tile";

      if (mode === "center") {
        // Render text ONCE centered in the area
        const lines = text.split("\n");
        const startY = y + Math.floor((height - lines.length) / 2);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const startX = x + Math.floor((width - line.length) / 2);
          for (let c = 0; c < line.length; c++) {
            const bx = startX + c;
            const by = startY + i;
            if (bx >= 0 && bx < buffer.width && by >= 0 && by < buffer.height && line[c] !== " ") {
              const fg = blendFg(bx, by, color);
              buffer.setCell(bx, by, { char: line[c]!, fg, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
            }
          }
        }
      } else if (pattern.direction === "diagonal") {
        // True diagonal: place text along diagonal lines going top-left → bottom-right
        const padded = text + "   ";
        const len = padded.length;
        const spacing = pattern.spacing ?? (len + 2); // gap between diagonal stripes
        // Walk diagonal stripes across the area
        const diags = width + height;
        for (let d = -height; d < diags; d += spacing) {
          for (let ci = 0; ci < len; ci++) {
            const px = d + ci;
            const py = ci;
            // Tile vertically too
            for (let rep = 0; rep * len < height + len; rep++) {
              const ry = py + rep * len;
              const rx = px + rep * len;
              if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
                const ch = padded[ci]!;
                const bx = x + rx;
                const by = y + ry;
                if (bx < buffer.width && by < buffer.height && ch !== " ") {
                  const fg = blendFg(bx, by, color);
                  buffer.setCell(bx, by, { char: ch, fg, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
                }
              }
            }
          }
        }
      } else {
        // Tile horizontally with diagonal offset per row
        const padded = text + "  ";
        const len = padded.length;
        for (let py = 0; py < height; py += 2) {
          const tileOffset = Math.floor(py / 2) * 3; // diagonal shift
          for (let px = 0; px < width; px++) {
            const charIdx = (px + tileOffset) % len;
            const ch = padded[charIdx]!;
            const bx = x + px;
            const by = y + py;
            if (bx < buffer.width && by < buffer.height && ch !== " ") {
              const fg = blendFg(bx, by, color);
              buffer.setCell(bx, by, { char: ch, fg, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
            }
          }
        }
      }
      break;
    }
    case "custom": {
      const char = pattern.char ?? "\u00B7"; // middle dot
      const spacing = pattern.spacing ?? 4;
      for (let py = 0; py < height; py += spacing) {
        for (let px = 0; px < width; px += spacing) {
          const bx = x + px;
          const by = y + py;
          if (bx < buffer.width && by < buffer.height) {
            const fg = blendFg(bx, by, color);
            buffer.setCell(bx, by, { char, fg, bg: bgColor, attrs, ulColor: DEFAULT_COLOR });
          }
        }
      }
      break;
    }
  }
}

function paintBox(
  buffer: ScreenBuffer,
  element: TuiElement,
  clip: ClipRect,
  scrollOffsetX: number,
  scrollOffsetY: number,
  ctx: RenderContext,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  const layout = element.layoutNode.layout;
  const x = layout.x - scrollOffsetX;
  const y = layout.y - scrollOffsetY;
  const props = element.props;

  // Opaque: fill entire box area with spaces before painting anything.
  // If backgroundColor is also set, use it for the fill so the entire
  // box (including padding/border area) gets the background color.
  const bgColorRaw = props["backgroundColor"] as string | number | undefined;
  if (props["opaque"] === true) {
    const opaqueBg = bgColorRaw !== undefined ? parseColor(bgColorRaw) : DEFAULT_COLOR;
    buffer.fill(x, y, layout.width, layout.height, " ", DEFAULT_COLOR, opaqueBg);
  }

  // Draw border — use this box's bg or inherited bg for border cell backgrounds
  const borderStyle = props["borderStyle"] as BorderStyle | undefined;
  const borderBg = bgColorRaw !== undefined ? parseColor(bgColorRaw) : inheritedBg;
  if (borderStyle && borderStyle !== "none") {
    const { sides, dim } = extractBorderFlags(props);
    paintBorder(buffer, x, y, layout.width, layout.height, borderStyle,
      parseColor(props["borderColor"] as string | number | undefined), clip, sides, dim, borderBg);
  }

  // Fill background color (inside border, covering padding + content area)
  const effectiveBg = bgColorRaw !== undefined ? parseColor(bgColorRaw) : inheritedBg;
  if (bgColorRaw !== undefined) {
    buffer.fill(
      layout.innerX - scrollOffsetX,
      layout.innerY - scrollOffsetY,
      layout.innerWidth,
      layout.innerHeight,
      " ",
      DEFAULT_COLOR,
      effectiveBg,
    );
  }

  // Paint background pattern BEFORE children — children overwrite these cells
  const bgPattern = props["background"] as BackgroundProp | undefined;
  if (bgPattern) {
    paintBackgroundPattern(
      buffer,
      layout.innerX - scrollOffsetX,
      layout.innerY - scrollOffsetY,
      layout.innerWidth,
      layout.innerHeight,
      bgPattern,
      effectiveBg,
    );
  }

  // Queue graphics protocol image sequence for post-diff output.
  // The Image component stores its escape sequence as _imageSeq on the spacer box.
  // We queue it here (with layout position) so screen.flush() can emit it AFTER
  // the diff renderer output — preventing the diff from overwriting the image.
  //
  // IMPORTANT: Only emit the sequence if it hasn't already been written for this
  // position, or if the sequence changed (e.g. src prop changed). Without this
  // guard, the full base64 escape sequence (often 50KB+) would be written to
  // stdout on EVERY frame at 60fps, causing the terminal to decode and render
  // the image repeatedly — leading to extreme memory usage and crashes.
  const imageSeq = props["_imageSeq"] as string | undefined;
  if (imageSeq) {
    const imageKey = `${y},${x}`;
    ctx.trackImageForFrame(imageKey);
    // Register the region so the diff renderer skips these cells entirely
    ctx.addImageRegion(x, y, layout.width, layout.height);
    const prev = ctx.emittedImages.get(imageKey);
    if (prev !== imageSeq) {
      ctx.pendingImageSequences.push({ seq: imageSeq, row: y, col: x });
      ctx.emittedImages.set(imageKey, imageSeq);
    }
  }

  // Compute child clip rect: narrow to the box's inner area when the box has
  // a border (to prevent children from overwriting border characters) or when
  // overflow is "hidden" (explicit clip request from the component).
  const hasBorderClip = borderStyle !== undefined && borderStyle !== "none";
  const overflow = props["overflow"] as Overflow | undefined;
  const overflowX = props["overflowX"] as Overflow | undefined;
  const overflowY = props["overflowY"] as Overflow | undefined;
  const clipX = hasBorderClip || overflow === "hidden" || overflowX === "hidden";
  const clipY = hasBorderClip || overflow === "hidden" || overflowY === "hidden";

  let childClip = clip;
  if (clipX || clipY) {
    childClip = intersectClip(clip, {
      x1: clipX ? x + layout.innerX - layout.x : clip.x1,
      y1: clipY ? y + layout.innerY - layout.y : clip.y1,
      x2: clipX ? x + layout.innerX - layout.x + layout.innerWidth : clip.x2,
      y2: clipY ? y + layout.innerY - layout.y + layout.innerHeight : clip.y2,
    });
  }

  // Compute inherited background for children: this box's backgroundColor wins,
  // otherwise cascade whatever was inherited from ancestors.
  const childBg = effectiveBg;

  // Paint children — propagate stickyChildren flag via parameter (no prop mutation)
  const stickyChildren = props["stickyChildren"] === true;
  for (const child of element.children) {
    if (isTuiElement(child)) {
      paintElement(buffer, child, childClip, scrollOffsetX, scrollOffsetY, ctx, stickyChildren, childBg);
    }
  }
}

function paintText(
  buffer: ScreenBuffer,
  element: TuiElement,
  clip: ClipRect,
  x: number,
  y: number,
  ctx: RenderContext,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  const layout = element.layoutNode.layout;
  const props = element.props;
  const width = layout.innerWidth;
  const wrapMode = (props["wrap"] as string | undefined) ?? "wrap";
  const linkUrl = props["_linkUrl"] as string | undefined;

  // Use cached styled runs when available.
  // Per-element _runsDirty flag avoids global invalidation on every repaint.
  // Falls back to runsVersion check for external invalidateStyledRunsCache() calls.
  let runs: Array<{ text: string; fg: number; bg: number; attrs: number; ulColor: number }>;
  const versionStale = element._cachedRunsVersion !== undefined && element._cachedRunsVersion !== ctx.runsVersion;
  if (element._cachedRuns && !element._runsDirty && !versionStale) {
    runs = element._cachedRuns;
  } else {
    runs = [];
    collectStyledRuns(element, runs, props);
    element._cachedRuns = runs;
    element._cachedRunsVersion = ctx.runsVersion;
    element._runsDirty = false;
  }

  // Track the x-range painted per row for link registry
  let linkMinX = Infinity;
  let linkMaxX = -Infinity;

  if (wrapMode === "wrap") {
    // Flow all runs left-to-right, wrapping at width boundary
    // Uses grapheme iteration for correct ZWJ emoji handling
    let cx = x;
    let cy = y;
    for (const run of runs) {
      for (const g of iterGraphemes(run.text)) {
        if (g.text === "\n") {
          // Flush link range for the completed row
          if (linkUrl && linkMinX <= linkMaxX) {
            ctx.links.push({ url: linkUrl, y: cy, x1: linkMinX, x2: linkMaxX });
            linkMinX = Infinity;
            linkMaxX = -Infinity;
          }
          cx = x;
          cy++;
          continue;
        }
        const cw = g.width;
        if (cw === 0) continue;
        if (cx + cw > x + width) {
          // Flush link range for the completed row
          if (linkUrl && linkMinX <= linkMaxX) {
            ctx.links.push({ url: linkUrl, y: cy, x1: linkMinX, x2: linkMaxX });
            linkMinX = Infinity;
            linkMaxX = -Infinity;
          }
          cx = x;
          cy++;
        }
        if (cy >= clip.y1 && cy < clip.y2 && cx >= clip.x1 && cx < clip.x2) {
          // When text has no explicit bg (DEFAULT_COLOR), use the inherited
          // ancestor backgroundColor, falling back to the buffer's existing bg.
          const effectiveBg = run.bg !== DEFAULT_COLOR ? run.bg
            : inheritedBg !== DEFAULT_COLOR ? inheritedBg
            : buffer.getBg(cx, cy);
          buffer.setCell(cx, cy, { char: g.text, fg: run.fg, bg: effectiveBg, attrs: run.attrs, ulColor: run.ulColor });
          if (cw === 2 && cx + 1 < clip.x2) {
            buffer.setCell(cx + 1, cy, { char: "", fg: run.fg, bg: effectiveBg, attrs: run.attrs, ulColor: run.ulColor });
          }
          if (linkUrl) {
            if (cx < linkMinX) linkMinX = cx;
            if (cx + cw > linkMaxX) linkMaxX = cx + cw;
          }
        }
        cx += cw;
      }
    }
    // Flush link range for the last row
    if (linkUrl && linkMinX <= linkMaxX) {
      ctx.links.push({ url: linkUrl, y: cy, x1: linkMinX, x2: linkMaxX });
    }
  } else {
    // Truncate modes — flatten all runs to a single string, then truncate
    const fullText = runs.map(r => r.text).join("").replace(/\n/g, " ");
    let displayLen = fullText.length;
    let truncated = false;
    if (displayLen > width) {
      displayLen = width;
      truncated = true;
    }

    if (y >= clip.y1 && y < clip.y2) {
      // Build truncated run sequence
      let remaining: string;
      if (!truncated) {
        remaining = fullText;
      } else if (wrapMode === "truncate-start" && width > 1) {
        remaining = "\u2026" + fullText.slice(-(width - 1));
      } else if (wrapMode === "truncate-middle" && width > 3) {
        const half = Math.floor((width - 1) / 2);
        remaining = fullText.slice(0, half) + "\u2026" + fullText.slice(-(width - half - 1));
      } else {
        remaining = fullText.slice(0, width - 1) + "\u2026";
      }

      // For truncation, we need to map styled runs onto the truncated text.
      // Build a style map from original runs, then apply to truncated text.
      const styleMap: Array<{ fg: number; bg: number; attrs: number; ulColor: number }> = [];
      for (const run of runs) {
        const cleaned = run.text.replace(/\n/g, " ");
        for (let i = 0; i < cleaned.length; i++) {
          styleMap.push({ fg: run.fg, bg: run.bg, attrs: run.attrs, ulColor: run.ulColor });
        }
      }

      for (let j = 0; j < remaining.length; j++) {
        const colX = x + j;
        if (colX < clip.x1 || colX >= clip.x2) continue;
        // For truncate-start, the ellipsis is at j=0, then chars from the end of fullText.
        // Map j>0 to the corresponding position from the end of the style map.
        let styleIdx: number;
        if (truncated && wrapMode === "truncate-start" && j > 0) {
          styleIdx = styleMap.length - (remaining.length - j);
        } else if (truncated && wrapMode === "truncate-middle") {
          const half = Math.floor((width - 1) / 2);
          if (j < half) {
            styleIdx = j;
          } else if (j === half) {
            // ellipsis character — use style of surrounding text
            styleIdx = j < styleMap.length ? j : 0;
          } else {
            styleIdx = styleMap.length - (remaining.length - j);
          }
        } else {
          styleIdx = j;
        }
        const style = styleIdx >= 0 && styleIdx < styleMap.length ? styleMap[styleIdx]! : (runs[0] ?? { fg: DEFAULT_COLOR, bg: DEFAULT_COLOR, attrs: Attr.NONE, ulColor: DEFAULT_COLOR });
        const effectiveBg = style.bg !== DEFAULT_COLOR ? style.bg
          : inheritedBg !== DEFAULT_COLOR ? inheritedBg
          : buffer.getBg(colX, y);
        buffer.setCell(colX, y, { char: remaining[j]!, fg: style.fg, bg: effectiveBg, attrs: style.attrs, ulColor: style.ulColor });
      }
    }
  }
}

function collectStyledRuns(
  element: TuiElement | TuiTextNode,
  runs: Array<{ text: string; fg: number; bg: number; attrs: number; ulColor: number }>,
  inheritedProps: Record<string, unknown>,
): void {
  if (isTuiTextNode(element)) {
    const fg = parseColor(inheritedProps["color"] as string | number | undefined);
    const rawBg = (inheritedProps["bgColor"] as string | number | undefined)
      ?? (inheritedProps["backgroundColor"] as string | number | undefined);
    const bg = parseColor(rawBg);
    let attrs = Attr.NONE;
    if (inheritedProps["bold"]) attrs |= Attr.BOLD;
    if (inheritedProps["dim"] || inheritedProps["dimColor"]) attrs |= Attr.DIM;
    if (inheritedProps["italic"]) attrs |= Attr.ITALIC;
    if (inheritedProps["underline"]) attrs |= Attr.UNDERLINE;
    if (inheritedProps["strikethrough"]) attrs |= Attr.STRIKETHROUGH;
    if (inheritedProps["inverse"]) attrs |= Attr.INVERSE;
    const ulColor = parseColor(inheritedProps["underlineColor"] as string | number | undefined);
    // Strip ANSI escape sequences from user text content before writing to cells
    runs.push({ text: stripAnsi(element.text), fg, bg, attrs, ulColor });
    return;
  }

  // For nested Text elements, merge their props with parent
  const props = { ...inheritedProps };
  const el = element as TuiElement;
  for (const key of ["color", "bgColor", "backgroundColor", "bold", "dim", "dimColor", "italic", "underline", "strikethrough", "inverse", "underlineColor"]) {
    if (el.props[key] !== undefined) props[key] = el.props[key];
  }

  for (const child of el.children) {
    collectStyledRuns(child, runs, props);
  }
}

function paintScrollView(
  buffer: ScreenBuffer,
  element: TuiElement,
  clip: ClipRect,
  scrollOffsetX: number,
  scrollOffsetY: number,
  ctx: RenderContext,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  const layout = element.layoutNode.layout;
  const x = layout.x - scrollOffsetX;
  const y = layout.y - scrollOffsetY;
  const props = element.props;

  // Opaque fill (same as paintBox)
  const svBgRaw = props["backgroundColor"] as string | number | undefined;
  if (props["opaque"] === true) {
    const opaqueBg = svBgRaw !== undefined ? parseColor(svBgRaw) : DEFAULT_COLOR;
    buffer.fill(x, y, layout.width, layout.height, " ", DEFAULT_COLOR, opaqueBg);
  }

  // Draw border — use this scroll view's bg or inherited bg for border cell backgrounds
  const borderStyle = props["borderStyle"] as BorderStyle | undefined;
  const borderBg = svBgRaw !== undefined ? parseColor(svBgRaw) : inheritedBg;
  let borderOffset = 0;
  if (borderStyle && borderStyle !== "none") {
    const { sides, dim } = extractBorderFlags(props);
    paintBorder(buffer, x, y, layout.width, layout.height, borderStyle,
      parseColor(props["borderColor"] as string | number | undefined), clip, sides, dim, borderBg);
    borderOffset = 1;
  }

  // Fill background color (inside border)
  if (svBgRaw !== undefined) {
    const bgColor = parseColor(svBgRaw);
    buffer.fill(
      layout.innerX - scrollOffsetX,
      layout.innerY - scrollOffsetY,
      layout.innerWidth,
      layout.innerHeight,
      " ",
      DEFAULT_COLOR,
      bgColor,
    );
  }

  // Determine overflow modes — overflowY/overflowX override the general overflow
  const overflowY = (props["overflowY"] as string | undefined) ?? "scroll";
  const overflowX = (props["overflowX"] as string | undefined) ?? "hidden";

  // Viewport clip — children are clipped to the scroll view's inner area.
  // layout.innerX/innerY already include the border offset (border is baked into
  // padding by extractLayoutProps), so we must NOT add borderOffset again here.
  const viewportClip = intersectClip(clip, {
    x1: overflowX === "visible" ? clip.x1 : x + layout.innerX - layout.x,
    y1: overflowY === "visible" ? clip.y1 : y + layout.innerY - layout.y,
    x2: overflowX === "visible" ? clip.x2 : x + layout.innerX - layout.x + layout.innerWidth,
    y2: overflowY === "visible" ? clip.y2 : y + layout.innerY - layout.y + layout.innerHeight,
  });

  if (isClipEmpty(viewportClip)) return;

  // Compute real content height and clamp scrollTop.
  // layout.innerHeight already excludes border (border is baked into padding),
  // so no need to subtract borderOffset again.
  const contentHeight = layout.contentHeight;
  const viewportHeight = layout.innerHeight;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const rawScrollTop = (props["scrollTop"] as number | undefined) ?? 0;
  const scrollState = props["_scrollState"] as { clampedTop: number; maxScroll: number; clampedLeft?: number; maxHScroll?: number } | undefined;

  // Stick-to-bottom: if user was at bottom, keep them there as content grows.
  // If user scrolled up, stay there. Parent controls jump-to-bottom via scrollTop.
  const prevMaxScroll = scrollState?.maxScroll ?? 0;
  const wasAtBottom = rawScrollTop >= prevMaxScroll;
  const scrollTop = wasAtBottom ? maxScroll : Math.max(0, Math.min(maxScroll, rawScrollTop));

  // Compute horizontal scroll
  const contentWidth = layout.contentWidth;
  const viewportWidth = layout.innerWidth;
  const maxHScroll = Math.max(0, contentWidth - viewportWidth);
  const rawScrollLeft = (props["scrollLeft"] as number | undefined) ?? 0;
  const scrollLeft = Math.max(0, Math.min(maxHScroll, rawScrollLeft));

  // Write clamped values + screen bounds back for the scroll handler
  if (scrollState) {
    scrollState.clampedTop = scrollTop;
    scrollState.maxScroll = maxScroll;
    scrollState.clampedLeft = scrollLeft;
    scrollState.maxHScroll = maxHScroll;
    // Store screen bounds so terminal-native scroll can use them
    (scrollState as any)._screenY1 = viewportClip.y1;
    (scrollState as any)._screenY2 = viewportClip.y2 - 1;
  }
  // Also write back to host props so the component's next scroll delta uses correct base
  props["scrollTop"] = scrollTop;
  props["scrollLeft"] = scrollLeft;

  // Store viewport dimensions for scrollToElement API
  const hostPropsRef = props["_hostPropsRef"] as { current: Record<string, unknown> | null } | undefined;
  if (hostPropsRef?.current) {
    hostPropsRef.current._viewportHeight = viewportHeight;
    hostPropsRef.current._viewportWidth = viewportWidth;
    // Build element position map from children for scrollToElement
    const posMap = new Map<string, { x: number; y: number; width: number; height: number }>();
    collectElementPositions(element, posMap);
    hostPropsRef.current._elementPositions = posMap;
  }

  // Update focusManager bounds for hit-testing
  const focusId = props["_focusId"] as string | undefined;
  if (focusId) {
    ctx.focus.updateBounds(focusId, x, y, layout.width, layout.height);
    // Record scroll state for native scroll region optimization
    ctx.scrollViewStates.set(focusId, {
      scrollTop,
      screenY1: viewportClip.y1,
      screenY2: viewportClip.y2 - 1,
      screenX1: viewportClip.x1,
      screenX2: viewportClip.x2,
    });
  }

  // Compute inherited background for children: this scroll view's backgroundColor wins,
  // otherwise cascade whatever was inherited from ancestors.
  const childBg = svBgRaw !== undefined ? parseColor(svBgRaw) : inheritedBg;

  // Paint children with scroll offset — propagate stickyChildren via parameter (no prop mutation)
  const stickyChildren = props["stickyChildren"] === true;
  for (const child of element.children) {
    if (isTuiElement(child)) {
      paintElement(buffer, child, viewportClip, scrollOffsetX + scrollLeft, scrollOffsetY + scrollTop, ctx, stickyChildren, childBg);
    }
  }

  // Paint vertical scrollbar
  const hasHBar = contentWidth > viewportWidth && viewportWidth > 0;
  if (contentHeight > viewportHeight && viewportHeight > 0) {
    paintScrollbar(buffer, x + layout.width - 1 - borderOffset, y + borderOffset,
      viewportHeight - (hasHBar ? 1 : 0), scrollTop, contentHeight, clip,
      parseColor(props["scrollbarThumbColor"] as string | number | undefined),
      parseColor(props["scrollbarTrackColor"] as string | number | undefined),
      (props["scrollbarChar"] as string | undefined),
      (props["scrollbarTrackChar"] as string | undefined),
      ctx, childBg);
  }

  // Paint horizontal scrollbar at bottom of viewport
  if (hasHBar) {
    const hasVBar = contentHeight > viewportHeight && viewportHeight > 0;
    paintHScrollbar(buffer, x + borderOffset, y + layout.height - 1 - borderOffset,
      viewportWidth - (hasVBar ? 1 : 0), scrollLeft, contentWidth, clip,
      parseColor(props["scrollbarThumbColor"] as string | number | undefined),
      parseColor(props["scrollbarTrackColor"] as string | number | undefined),
      ctx, childBg);
  }
}

function paintTextInput(
  buffer: ScreenBuffer,
  element: TuiElement,
  clip: ClipRect,
  x: number,
  y: number,
  ctx: RenderContext,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  const layout = element.layoutNode.layout;
  const props = element.props;
  const value = (props["value"] as string | undefined) ?? "";
  const placeholder = (props["placeholder"] as string | undefined) ?? "";
  const cursorOffset = (props["cursorOffset"] as number | undefined) ?? value.length;
  const hasFocus = (props["focus"] as boolean | undefined) ?? false;

  const fg = parseColor(props["color"] as string | number | undefined);
  const placeholderFg = parseColor(
    (props["placeholderColor"] as string | number | undefined) ?? ctx.theme.text.disabled,
  );

  const display = value.length > 0 ? value : placeholder;
  const displayFg = value.length > 0 ? fg : placeholderFg;
  const displayAttrs = value.length > 0 ? Attr.NONE : Attr.DIM;

  if (y >= clip.y1 && y < clip.y2) {
    for (let j = 0; j < layout.innerWidth; j++) {
      const cx = x + j;
      if (cx < clip.x1 || cx >= clip.x2) continue;
      const char = j < display.length ? display[j]! : " ";
      // Preserve parent's backgroundColor when text input has no explicit bg
      const effectiveBg = inheritedBg !== DEFAULT_COLOR ? inheritedBg : buffer.getBg(cx, y);
      buffer.setCell(cx, y, {
        char,
        fg: displayFg,
        bg: effectiveBg,
        attrs: j === cursorOffset && hasFocus ? Attr.INVERSE : displayAttrs,
        ulColor: DEFAULT_COLOR,
      });
    }

    // Set real cursor position for the focused input
    if (hasFocus) {
      ctx.cursorX = x + Math.min(cursorOffset, layout.innerWidth - 1);
      ctx.cursorY = y;
    }
  }
}

// ── Border painting ─────────────────────────────────────────────────

export interface BorderSideFlags {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface BorderDimFlags {
  all: boolean;
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

const ALL_SIDES: BorderSideFlags = { top: true, bottom: true, left: true, right: true };
const NO_DIM: BorderDimFlags = { all: false, top: false, bottom: false, left: false, right: false };

function paintBorder(
  buffer: ScreenBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  style: BorderStyle,
  color: number,
  clip: ClipRect,
  sides: BorderSideFlags = ALL_SIDES,
  dimFlags: BorderDimFlags = NO_DIM,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  if (style === "none" || width < 2 || height < 2) return;
  const chars = BORDER_CHARS[style];
  const fg = color;
  const bg = DEFAULT_COLOR;

  const write = (cx: number, cy: number, char: string, attrs: number) => {
    if (cx >= clip.x1 && cx < clip.x2 && cy >= clip.y1 && cy < clip.y2) {
      // Preserve parent's backgroundColor when border has no explicit bg
      const effectiveBg = bg !== DEFAULT_COLOR ? bg
        : inheritedBg !== DEFAULT_COLOR ? inheritedBg
        : buffer.getBg(cx, cy);
      buffer.setCell(cx, cy, { char, fg, bg: effectiveBg, attrs, ulColor: DEFAULT_COLOR });
    }
  };

  const dimFor = (side: "top" | "bottom" | "left" | "right"): number =>
    (dimFlags.all || dimFlags[side]) ? Attr.DIM : Attr.NONE;

  // Corners — adapt based on which adjacent sides are shown
  // Top-left corner: top + left
  if (sides.top && sides.left) {
    write(x, y, chars.topLeft, dimFor("top") | dimFor("left"));
  } else if (sides.top) {
    write(x, y, chars.horizontal, dimFor("top"));
  } else if (sides.left) {
    write(x, y, chars.vertical, dimFor("left"));
  }

  // Top-right corner: top + right
  if (sides.top && sides.right) {
    write(x + width - 1, y, chars.topRight, dimFor("top") | dimFor("right"));
  } else if (sides.top) {
    write(x + width - 1, y, chars.horizontal, dimFor("top"));
  } else if (sides.right) {
    write(x + width - 1, y, chars.vertical, dimFor("right"));
  }

  // Bottom-left corner: bottom + left
  if (sides.bottom && sides.left) {
    write(x, y + height - 1, chars.bottomLeft, dimFor("bottom") | dimFor("left"));
  } else if (sides.bottom) {
    write(x, y + height - 1, chars.horizontal, dimFor("bottom"));
  } else if (sides.left) {
    write(x, y + height - 1, chars.vertical, dimFor("left"));
  }

  // Bottom-right corner: bottom + right
  if (sides.bottom && sides.right) {
    write(x + width - 1, y + height - 1, chars.bottomRight, dimFor("bottom") | dimFor("right"));
  } else if (sides.bottom) {
    write(x + width - 1, y + height - 1, chars.horizontal, dimFor("bottom"));
  } else if (sides.right) {
    write(x + width - 1, y + height - 1, chars.vertical, dimFor("right"));
  }

  // Top and bottom edges
  for (let i = 1; i < width - 1; i++) {
    if (sides.top) write(x + i, y, chars.horizontal, dimFor("top"));
    if (sides.bottom) write(x + i, y + height - 1, chars.horizontal, dimFor("bottom"));
  }

  // Left and right edges
  for (let i = 1; i < height - 1; i++) {
    if (sides.left) write(x, y + i, chars.vertical, dimFor("left"));
    if (sides.right) write(x + width - 1, y + i, chars.vertical, dimFor("right"));
  }
}

// ── Scrollbar ───────────────────────────────────────────────────────

function paintScrollbar(
  buffer: ScreenBuffer,
  x: number,
  y: number,
  height: number,
  scrollTop: number,
  contentHeight: number,
  clip: ClipRect,
  thumbColor: number = DEFAULT_COLOR,
  trackColor: number = DEFAULT_COLOR,
  thumbChar: string | undefined = undefined,
  trackChar: string | undefined = undefined,
  ctx?: RenderContext,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  if (height <= 0 || contentHeight <= 0) return;

  const themeColors = ctx?.theme;
  // Thumb brightness scales with scroll position — brighter when scrolled, indicating scrollability
  const defaultThumbColor = scrollTop > 0
    ? parseColor(themeColors?.text.secondary ?? "#808080")   // brighter when content is scrolled
    : parseColor(themeColors?.text.dim ?? "#505050");         // subtle at rest
  const resolvedThumbColor = thumbColor === DEFAULT_COLOR ? defaultThumbColor : thumbColor;
  const resolvedTrackColor = trackColor === DEFAULT_COLOR ? parseColor(themeColors?.text.disabled ?? "#333333") : trackColor;
  const resolvedThumbChar = thumbChar ?? "\u2503";
  const resolvedTrackChar = trackChar ?? "\u2502";

  const thumbHeight = Math.max(1, Math.floor((height / contentHeight) * height));
  const maxScroll = contentHeight - height;
  const thumbOffset = maxScroll > 0
    ? Math.floor((scrollTop / maxScroll) * (height - thumbHeight))
    : 0;

  for (let i = 0; i < height; i++) {
    const cy = y + i;
    if (cy < clip.y1 || cy >= clip.y2 || x < clip.x1 || x >= clip.x2) continue;

    const isThumb = i >= thumbOffset && i < thumbOffset + thumbHeight;
    // Preserve parent's backgroundColor for scrollbar track
    const effectiveBg = inheritedBg !== DEFAULT_COLOR ? inheritedBg : buffer.getBg(x, cy);
    buffer.setCell(x, cy, {
      char: isThumb ? resolvedThumbChar : resolvedTrackChar,
      fg: isThumb ? resolvedThumbColor : resolvedTrackColor,
      bg: effectiveBg,
      attrs: Attr.NONE,
      ulColor: DEFAULT_COLOR,
    });
  }
}

// ── Element position collection for scrollToElement ──────────────

function collectElementPositions(
  element: TuiElement,
  posMap: Map<string, { x: number; y: number; width: number; height: number }>,
): void {
  for (const child of element.children) {
    if (!isTuiElement(child)) continue;
    const elemId = child.props["_elementId"] as string | undefined;
    if (elemId) {
      const cl = child.layoutNode.layout;
      posMap.set(elemId, { x: cl.x, y: cl.y, width: cl.width, height: cl.height });
    }
    collectElementPositions(child, posMap);
  }
}

// ── Horizontal scrollbar ─────────────────────────────────────────

function paintHScrollbar(
  buffer: ScreenBuffer,
  x: number,
  y: number,
  width: number,
  scrollLeft: number,
  contentWidth: number,
  clip: ClipRect,
  thumbColor: number = DEFAULT_COLOR,
  trackColor: number = DEFAULT_COLOR,
  ctx?: RenderContext,
  inheritedBg: number = DEFAULT_COLOR,
): void {
  if (width <= 0 || contentWidth <= 0) return;

  const themeColors = ctx?.theme;
  const defaultThumbColor = scrollLeft > 0
    ? parseColor(themeColors?.text.secondary ?? "#808080")
    : parseColor(themeColors?.text.dim ?? "#505050");
  const resolvedThumbColor = thumbColor === DEFAULT_COLOR ? defaultThumbColor : thumbColor;
  const resolvedTrackColor = trackColor === DEFAULT_COLOR ? parseColor(themeColors?.text.disabled ?? "#333333") : trackColor;

  const thumbWidth = Math.max(1, Math.floor((width / contentWidth) * width));
  const maxScroll = contentWidth - width;
  const thumbOffset = maxScroll > 0
    ? Math.floor((scrollLeft / maxScroll) * (width - thumbWidth))
    : 0;

  for (let i = 0; i < width; i++) {
    const cx = x + i;
    if (cx < clip.x1 || cx >= clip.x2 || y < clip.y1 || y >= clip.y2) continue;

    const isThumb = i >= thumbOffset && i < thumbOffset + thumbWidth;
    // Preserve parent's backgroundColor for horizontal scrollbar track
    const effectiveBg = inheritedBg !== DEFAULT_COLOR ? inheritedBg : buffer.getBg(cx, y);
    buffer.setCell(cx, y, {
      char: isThumb ? "\u2501" : "\u2500",
      fg: isThumb ? resolvedThumbColor : resolvedTrackColor,
      bg: effectiveBg,
      attrs: Attr.NONE,
      ulColor: DEFAULT_COLOR,
    });
  }
}
