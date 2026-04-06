/**
 * DevTools overlay — a polished debug panel rendered at the bottom of the screen.
 *
 * Implements a multi-tab overlay as a render middleware, painting directly
 * into the ScreenBuffer after normal component rendering. Toggle with F12.
 *
 * Panels:
 *   [Tree]   — Collapsible element tree with type, key, and layout dimensions.
 *   [Styles] — Computed props and layout for the selected element.
 *   [Perf]   — FPS sparkline, paint/diff/flush timing, cells changed.
 *   [Events] — Ring buffer of recent input events with timestamps.
 */

import type { ScreenBuffer } from "../core/buffer.js";
import type { RenderMiddleware } from "../core/middleware.js";
import type { TuiElement, TuiTextNode, TuiRoot } from "../reconciler/types.js";
import { isTuiElement, isTuiTextNode } from "../reconciler/types.js";
import { parseColor, Attr } from "../core/types.js";
import { colors } from "../theme/index.js";
import type { PerformanceMetrics } from "./performance-monitor.js";
import type { LoggedEvent } from "./event-logger.js";
import { miniSparkline } from "../utils/sparkline.js";

const COL_BRAND    = parseColor(colors.brand.primary);
const COL_BRAND_LT = parseColor(colors.brand.light);
const COL_TEXT_PRI = parseColor(colors.text.primary);
const COL_TEXT_SEC = parseColor(colors.text.secondary);
const COL_TEXT_DIM = parseColor(colors.text.dim);
const COL_SURF_BASE    = parseColor(colors.surface.base);
const COL_SURF_RAISED  = parseColor(colors.surface.raised);
const COL_SURF_OVERLAY = parseColor(colors.surface.overlay);
const COL_SURF_HL      = parseColor(colors.surface.highlight);
const COL_DIVIDER  = parseColor(colors.divider);
const COL_SUCCESS  = parseColor(colors.success);
const COL_WARNING  = parseColor(colors.warning);
const COL_ERROR    = parseColor(colors.error);

export type DevToolsPanel = "tree" | "styles" | "performance" | "events";

export interface DevToolsOverlayOptions {
  /** Keyboard shortcut to toggle (default: "F12") */
  toggleKey?: string;
  /** Initial panel to show */
  initialPanel?: DevToolsPanel;
  /** Panel height in rows (default: 12) */
  panelHeight?: number;
}

interface TreeEntry {
  element: TuiElement;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  label: string;
}

function writeStr(
  buf: ScreenBuffer,
  x: number,
  y: number,
  text: string,
  fg: number,
  bg: number,
  attrs: number = Attr.NONE,
  maxWidth?: number,
): void {
  const limit = maxWidth ?? buf.width - x;
  const clipped = text.length > limit ? text.slice(0, limit) : text;
  buf.writeString(x, y, clipped, fg, bg, attrs, x + limit);
}

function fillRow(buf: ScreenBuffer, y: number, x0: number, x1: number, fg: number, bg: number): void {
  for (let x = x0; x < x1 && x < buf.width; x++) {
    buf.setCell(x, y, { char: " ", fg, bg, attrs: Attr.NONE, ulColor: -1 });
  }
}

function fillRegion(buf: ScreenBuffer, x0: number, y0: number, x1: number, y1: number, fg: number, bg: number): void {
  for (let y = y0; y < y1 && y < buf.height; y++) {
    fillRow(buf, y, x0, x1, fg, bg);
  }
}

/**
 * Creates a DevTools overlay middleware that renders a debug panel.
 *
 * Panels: component tree, style inspector, performance metrics, event log. Toggle with F12.
 */
export function createDevToolsOverlay(options?: DevToolsOverlayOptions): {
  middleware: RenderMiddleware;
  setRoot: (root: TuiRoot) => void;
  toggle: () => void;
  isVisible: () => boolean;
  setPanel: (panel: DevToolsPanel) => void;
  getPanel: () => DevToolsPanel;
  selectNext: () => void;
  selectPrev: () => void;
  toggleCollapse: () => void;
  selectNextPanel: () => void;
  selectPrevPanel: () => void;
  setMetrics: (metrics: PerformanceMetrics) => void;
  setEvents: (events: readonly LoggedEvent[]) => void;
} {
  const panelHeight = options?.panelHeight ?? 12;
  let visible = false;
  let activePanel: DevToolsPanel = options?.initialPanel ?? "tree";
  let currentRoot: TuiRoot | null = null;

  // Tree state
  let treeEntries: TreeEntry[] = [];
  let selectedIdx = 0;
  let treeScrollOffset = 0;
  const collapsedSet = new Set<TuiElement>();

  // Performance state
  let currentMetrics: PerformanceMetrics | null = null;
  const fpsHistory: number[] = [];
  const FPS_HISTORY_MAX = 60;

  // Event log state
  let currentEvents: readonly LoggedEvent[] = [];

  // ── Tree construction ──────────────────────────────────────────

  function buildTreeEntries(): void {
    treeEntries = [];
    if (!currentRoot) return;
    for (const child of currentRoot.children) {
      collectTreeEntry(child, 0);
    }
    if (treeEntries.length > 0 && selectedIdx >= treeEntries.length) {
      selectedIdx = treeEntries.length - 1;
    }
  }

  function collectTreeEntry(node: TuiElement | TuiTextNode, depth: number): void {
    if (isTuiTextNode(node)) return;
    if (!isTuiElement(node)) return;

    const elementChildren = node.children.filter(c => isTuiElement(c));
    const hasChildren = elementChildren.length > 0;
    const isCollapsed = collapsedSet.has(node);
    const layout = node.layoutNode.layout;

    const parts: string[] = [node.type];
    const key = node.props["key"] as string | number | undefined;
    if (key !== undefined) parts.push(`key=${String(key)}`);
    if (layout.width > 0 || layout.height > 0) {
      parts.push(`${layout.width}x${layout.height}`);
    }

    treeEntries.push({
      element: node,
      depth,
      hasChildren,
      collapsed: isCollapsed,
      label: parts.join(" "),
    });

    if (!isCollapsed) {
      for (const child of node.children) {
        collectTreeEntry(child, depth + 1);
      }
    }
  }

  // ── Selection highlight ────────────────────────────────────────

  function drawSelectionHighlight(buf: ScreenBuffer): void {
    if (selectedIdx < 0 || selectedIdx >= treeEntries.length) return;
    const entry = treeEntries[selectedIdx]!;
    const el = entry.element;
    const layout = el.layoutNode.layout;
    if (layout.width < 2 || layout.height < 2) return;

    const panelTop = buf.height - panelHeight;
    const x1 = layout.x;
    const y1 = layout.y;
    const x2 = layout.x + layout.width - 1;
    const y2 = Math.min(layout.y + layout.height - 1, panelTop - 1);
    if (y2 <= y1) return;

    const fg = COL_BRAND_LT;
    // Top edge
    for (let x = x1; x <= x2 && x < buf.width; x++) {
      if (y1 >= 0 && y1 < panelTop) {
        buf.setCell(x, y1, { char: x === x1 ? "┌" : x === x2 ? "┐" : "─", fg, bg: -1, attrs: Attr.NONE, ulColor: -1 });
      }
    }
    // Bottom edge
    for (let x = x1; x <= x2 && x < buf.width; x++) {
      if (y2 >= 0 && y2 < panelTop) {
        buf.setCell(x, y2, { char: x === x1 ? "└" : x === x2 ? "┘" : "─", fg, bg: -1, attrs: Attr.NONE, ulColor: -1 });
      }
    }
    // Side edges
    for (let y = y1 + 1; y < y2 && y < panelTop; y++) {
      if (x1 >= 0 && x1 < buf.width && y >= 0) {
        buf.setCell(x1, y, { char: "│", fg, bg: -1, attrs: Attr.NONE, ulColor: -1 });
      }
      if (x2 >= 0 && x2 < buf.width && y >= 0) {
        buf.setCell(x2, y, { char: "│", fg, bg: -1, attrs: Attr.NONE, ulColor: -1 });
      }
    }
  }

  // ── Panel chrome ───────────────────────────────────────────────

  function drawChrome(buf: ScreenBuffer, panelTop: number, panelWidth: number): void {
    // Top border line
    fillRow(buf, panelTop, 0, panelWidth, COL_TEXT_DIM, COL_SURF_OVERLAY);
    for (let x = 0; x < panelWidth && x < buf.width; x++) {
      buf.setCell(x, panelTop, { char: "─", fg: COL_DIVIDER, bg: COL_SURF_OVERLAY, attrs: Attr.NONE, ulColor: -1 });
    }
    // Left corner
    if (panelWidth > 0) {
      buf.setCell(0, panelTop, { char: "┬", fg: COL_DIVIDER, bg: COL_SURF_OVERLAY, attrs: Attr.NONE, ulColor: -1 });
    }
    // Right corner
    if (panelWidth > 1) {
      buf.setCell(panelWidth - 1, panelTop, { char: "┬", fg: COL_DIVIDER, bg: COL_SURF_OVERLAY, attrs: Attr.NONE, ulColor: -1 });
    }

    // Storm DevTools title
    const title = " Storm DevTools ";
    writeStr(buf, 2, panelTop, title, COL_BRAND, COL_SURF_OVERLAY, Attr.BOLD);

    // Tab labels
    const tabs: { label: string; id: DevToolsPanel }[] = [
      { label: "Tree", id: "tree" },
      { label: "Styles", id: "styles" },
      { label: "Perf", id: "performance" },
      { label: "Events", id: "events" },
    ];

    let tabX = 2 + title.length + 1;
    for (const tab of tabs) {
      const isActive = tab.id === activePanel;
      const tabLabel = ` ${tab.label} `;
      const tabFg = isActive ? COL_SURF_BASE : COL_TEXT_SEC;
      const tabBg = isActive ? COL_BRAND : COL_SURF_HL;
      writeStr(buf, tabX, panelTop, tabLabel, tabFg, tabBg, isActive ? Attr.BOLD : Attr.NONE);
      tabX += tabLabel.length + 1;
    }

    // Shortcut hint on the right
    const hint = ` []:panels  jk:navigate  space:toggle `;
    const hintX = panelWidth - hint.length - 1;
    if (hintX > tabX) {
      writeStr(buf, hintX, panelTop, hint, COL_TEXT_DIM, COL_SURF_OVERLAY);
    }
  }

  // ── Tree panel ─────────────────────────────────────────────────

  function drawTreePanel(buf: ScreenBuffer, panelTop: number, contentTop: number, contentHeight: number, panelWidth: number): void {
    buildTreeEntries();

    if (treeEntries.length === 0) {
      writeStr(buf, 2, contentTop, "No element tree available. Call setRoot().", COL_TEXT_DIM, COL_SURF_RAISED);
      return;
    }

    if (selectedIdx < treeScrollOffset) {
      treeScrollOffset = selectedIdx;
    } else if (selectedIdx >= treeScrollOffset + contentHeight) {
      treeScrollOffset = selectedIdx - contentHeight + 1;
    }

    for (let row = 0; row < contentHeight; row++) {
      const entryIdx = treeScrollOffset + row;
      const y = contentTop + row;
      if (entryIdx >= treeEntries.length) break;
      const entry = treeEntries[entryIdx]!;
      const isSelected = entryIdx === selectedIdx;

      const rowBg = isSelected ? COL_SURF_HL : COL_SURF_RAISED;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, rowBg);

      // Indent + collapse indicator
      const indent = entry.depth * 2;
      const arrow = entry.hasChildren ? (entry.collapsed ? "▸ " : "▾ ") : "  ";
      const prefix = " ".repeat(indent + 1) + arrow;
      writeStr(buf, 0, y, prefix, entry.hasChildren ? COL_TEXT_SEC : COL_TEXT_DIM, rowBg);

      // Element label
      const labelX = prefix.length;
      const typeFg = isSelected ? COL_BRAND_LT : COL_BRAND;
      // Split label: type in brand color, rest in secondary
      const spaceIdx = entry.label.indexOf(" ");
      if (spaceIdx > 0) {
        const typePart = entry.label.slice(0, spaceIdx);
        const restPart = entry.label.slice(spaceIdx);
        writeStr(buf, labelX, y, typePart, typeFg, rowBg, Attr.BOLD);
        writeStr(buf, labelX + typePart.length, y, restPart, COL_TEXT_SEC, rowBg);
      } else {
        writeStr(buf, labelX, y, entry.label, typeFg, rowBg, Attr.BOLD);
      }

      // Children count on the right
      if (entry.hasChildren) {
        const childCount = entry.element.children.filter(c => isTuiElement(c)).length;
        const countStr = ` ${childCount} `;
        const countX = panelWidth - countStr.length - 1;
        if (countX > labelX + entry.label.length) {
          writeStr(buf, countX, y, countStr, COL_TEXT_DIM, rowBg);
        }
      }
    }

    // Scrollbar
    if (treeEntries.length > contentHeight) {
      const scrollBarX = panelWidth - 1;
      const ratio = treeScrollOffset / (treeEntries.length - contentHeight);
      const thumbY = contentTop + Math.round(ratio * (contentHeight - 1));
      for (let row = 0; row < contentHeight; row++) {
        const y = contentTop + row;
        const isTh = y === thumbY;
        buf.setCell(scrollBarX, y, {
          char: isTh ? "█" : "░",
          fg: isTh ? COL_BRAND : COL_TEXT_DIM,
          bg: COL_SURF_RAISED,
          attrs: Attr.NONE,
          ulColor: -1,
        });
      }
    }
  }

  // ── Styles panel ───────────────────────────────────────────────

  function drawStylesPanel(buf: ScreenBuffer, _panelTop: number, contentTop: number, contentHeight: number, panelWidth: number): void {
    if (selectedIdx < 0 || selectedIdx >= treeEntries.length) {
      writeStr(buf, 2, contentTop, "No element selected.", COL_TEXT_DIM, COL_SURF_RAISED);
      return;
    }

    const entry = treeEntries[selectedIdx]!;
    const el = entry.element;
    const layout = el.layoutNode.layout;

    const lines: Array<{ label: string; value: string; valueFg?: number }> = [];

    lines.push({ label: "Type", value: el.type, valueFg: COL_BRAND });
    lines.push({ label: "Position", value: `x=${layout.x}  y=${layout.y}` });
    lines.push({ label: "Size", value: `${layout.width} x ${layout.height}` });
    lines.push({ label: "Inner", value: `${layout.innerWidth} x ${layout.innerHeight}  at (${layout.innerX}, ${layout.innerY})` });
    lines.push({ label: "Content", value: `${layout.contentWidth} x ${layout.contentHeight}` });
    lines.push({ label: "Children", value: String(el.children.length) });

    // Style props
    const styleKeys = [
      "flexDirection", "flex", "flexGrow", "flexShrink",
      "alignItems", "justifyContent", "gap",
      "padding", "paddingX", "paddingY",
      "margin", "marginX", "marginY",
      "borderStyle", "color", "bgColor", "backgroundColor",
      "bold", "dim", "italic", "underline", "inverse",
      "wrap", "overflow", "display", "position",
      "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
      "zIndex",
    ];

    for (const key of styleKeys) {
      const val = el.props[key];
      if (val !== undefined) {
        lines.push({ label: key, value: String(val), valueFg: COL_TEXT_PRI });
      }
    }

    const labelWidth = Math.max(...lines.map(l => l.label.length), 8) + 1;

    for (let row = 0; row < contentHeight && row < lines.length; row++) {
      const y = contentTop + row;
      const line = lines[row]!;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);

      writeStr(buf, 2, y, line.label, COL_TEXT_SEC, COL_SURF_RAISED);
      writeStr(buf, 2 + labelWidth + 1, y, line.value, line.valueFg ?? COL_TEXT_PRI, COL_SURF_RAISED);
    }
  }

  // ── Performance panel ──────────────────────────────────────────

  function drawPerfPanel(buf: ScreenBuffer, _panelTop: number, contentTop: number, contentHeight: number, panelWidth: number): void {
    if (!currentMetrics) {
      writeStr(buf, 2, contentTop, "No metrics available. Call setMetrics().", COL_TEXT_DIM, COL_SURF_RAISED);
      return;
    }

    const m = currentMetrics;
    const halfW = Math.floor(panelWidth / 2);

    // Row 0: FPS + sparkline
    {
      const y = contentTop;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);
      const fpsLabel = ` FPS: `;
      writeStr(buf, 1, y, fpsLabel, COL_TEXT_SEC, COL_SURF_RAISED);
      const fpsVal = String(m.avgFps);
      const fpsFg = m.avgFps >= 30 ? COL_SUCCESS : m.avgFps >= 15 ? COL_WARNING : COL_ERROR;
      writeStr(buf, 1 + fpsLabel.length, y, fpsVal, fpsFg, COL_SURF_RAISED, Attr.BOLD);

      // Sparkline
      const sparkW = Math.min(fpsHistory.length, panelWidth - halfW - 4);
      const spark = miniSparkline(fpsHistory.slice(-sparkW));
      writeStr(buf, halfW, y, " " + spark, COL_BRAND, COL_SURF_RAISED);
    }

    // Row 1: Timing breakdown
    if (contentHeight > 1) {
      const y = contentTop + 1;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);
      const paintStr = `Paint: ${m.lastPaintMs.toFixed(1)}ms`;
      const diffStr = `Diff: ${m.lastDiffMs.toFixed(1)}ms`;
      const flushStr = `Flush: ${m.lastFlushMs.toFixed(1)}ms`;
      writeStr(buf, 2, y, paintStr, COL_TEXT_PRI, COL_SURF_RAISED);
      writeStr(buf, 2 + paintStr.length + 3, y, diffStr, COL_TEXT_PRI, COL_SURF_RAISED);
      writeStr(buf, 2 + paintStr.length + 3 + diffStr.length + 3, y, flushStr, COL_TEXT_PRI, COL_SURF_RAISED);
    }

    // Row 2: Cell stats
    if (contentHeight > 2) {
      const y = contentTop + 2;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);
      const totalMs = m.lastPaintMs + m.lastDiffMs + m.lastFlushMs;
      const cellPct = m.totalCells > 0 ? ((m.cellsChanged / m.totalCells) * 100).toFixed(1) : "0.0";
      writeStr(buf, 2, y, `Cells changed: ${m.cellsChanged}/${m.totalCells} (${cellPct}%)`, COL_TEXT_PRI, COL_SURF_RAISED);
      writeStr(buf, halfW, y, `Total frame: ${totalMs.toFixed(1)}ms`, COL_TEXT_SEC, COL_SURF_RAISED);
    }

    // Row 3: Frame count
    if (contentHeight > 3) {
      const y = contentTop + 3;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);
      writeStr(buf, 2, y, `Frames rendered: ${m.frameCount}`, COL_TEXT_SEC, COL_SURF_RAISED);
    }

    // Row 4: Budget bar
    if (contentHeight > 4) {
      const y = contentTop + 4;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);
      const totalMs = m.lastPaintMs + m.lastDiffMs + m.lastFlushMs;
      const budget = 16.67; // 60fps target
      const barWidth = Math.min(panelWidth - 20, 40);
      const filled = Math.min(Math.round((totalMs / budget) * barWidth), barWidth);

      writeStr(buf, 2, y, "Budget: ", COL_TEXT_SEC, COL_SURF_RAISED);
      const barX = 10;
      for (let i = 0; i < barWidth; i++) {
        const isFilled = i < filled;
        const barFg = totalMs <= budget ? COL_SUCCESS : totalMs <= budget * 2 ? COL_WARNING : COL_ERROR;
        buf.setCell(barX + i, y, {
          char: isFilled ? "█" : "░",
          fg: isFilled ? barFg : COL_TEXT_DIM,
          bg: COL_SURF_RAISED,
          attrs: Attr.NONE,
          ulColor: -1,
        });
      }
      const pctStr = ` ${((totalMs / budget) * 100).toFixed(0)}%`;
      writeStr(buf, barX + barWidth + 1, y, pctStr, COL_TEXT_SEC, COL_SURF_RAISED);
    }
  }

  // ── Events panel ───────────────────────────────────────────────

  function drawEventsPanel(buf: ScreenBuffer, _panelTop: number, contentTop: number, contentHeight: number, panelWidth: number): void {
    if (currentEvents.length === 0) {
      writeStr(buf, 2, contentTop, "No events logged yet.", COL_TEXT_DIM, COL_SURF_RAISED);
      return;
    }

    // Header row
    {
      const y = contentTop;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_OVERLAY);
      writeStr(buf, 2, y, "Type", COL_TEXT_SEC, COL_SURF_OVERLAY, Attr.BOLD);
      writeStr(buf, 10, y, "Detail", COL_TEXT_SEC, COL_SURF_OVERLAY, Attr.BOLD);
      writeStr(buf, panelWidth - 14, y, "Time", COL_TEXT_SEC, COL_SURF_OVERLAY, Attr.BOLD);
    }

    const eventRows = contentHeight - 1; // minus header
    for (let row = 0; row < eventRows && row < currentEvents.length; row++) {
      const y = contentTop + 1 + row;
      const evt = currentEvents[row]!;
      fillRow(buf, y, 0, panelWidth, COL_TEXT_PRI, COL_SURF_RAISED);

      // Type with color coding
      const typeFg = evt.type === "key" ? COL_BRAND
        : evt.type === "mouse" ? COL_SUCCESS
        : evt.type === "paste" ? COL_WARNING
        : COL_TEXT_SEC; // resize
      writeStr(buf, 2, y, evt.type.padEnd(6), typeFg, COL_SURF_RAISED);

      // Detail
      const maxDetail = panelWidth - 22;
      const detail = evt.detail.length > maxDetail ? evt.detail.slice(0, maxDetail - 1) + "\u2026" : evt.detail;
      writeStr(buf, 10, y, detail, COL_TEXT_PRI, COL_SURF_RAISED);

      // Timestamp (relative to now in ms)
      const ago = Date.now() - evt.timestamp;
      const timeStr = ago < 1000 ? `${ago}ms`
        : ago < 60000 ? `${(ago / 1000).toFixed(1)}s`
        : `${Math.floor(ago / 60000)}m`;
      writeStr(buf, panelWidth - 2 - timeStr.length, y, timeStr, COL_TEXT_DIM, COL_SURF_RAISED);
    }
  }

  // ── Middleware ──────────────────────────────────────────────────

  const middleware: RenderMiddleware = {
    name: "devtools-overlay",

    onPaint(buffer: ScreenBuffer, width: number, height: number): ScreenBuffer {
      if (!visible) return buffer;
      if (height < panelHeight + 2) return buffer; // not enough room

      const panelTop = height - panelHeight;
      const contentTop = panelTop + 1;
      const contentHeight = panelHeight - 1;
      const panelWidth = width;

      // Fill panel background
      fillRegion(buffer, 0, panelTop, panelWidth, height, COL_TEXT_PRI, COL_SURF_RAISED);

      // Draw chrome (border + tabs)
      drawChrome(buffer, panelTop, panelWidth);

      // Draw active panel content
      switch (activePanel) {
        case "tree":
          drawTreePanel(buffer, panelTop, contentTop, contentHeight, panelWidth);
          // Highlight selected element in the main view
          if (activePanel === "tree") {
            drawSelectionHighlight(buffer);
          }
          break;
        case "styles":
          // Need tree entries built for styles
          buildTreeEntries();
          drawStylesPanel(buffer, panelTop, contentTop, contentHeight, panelWidth);
          if (selectedIdx >= 0 && selectedIdx < treeEntries.length) {
            drawSelectionHighlight(buffer);
          }
          break;
        case "performance":
          drawPerfPanel(buffer, panelTop, contentTop, contentHeight, panelWidth);
          break;
        case "events":
          drawEventsPanel(buffer, panelTop, contentTop, contentHeight, panelWidth);
          break;
      }

      return buffer;
    },
  };

  // ── Public API ─────────────────────────────────────────────────

  return {
    middleware,

    setRoot(root: TuiRoot) {
      currentRoot = root;
    },

    toggle() {
      visible = !visible;
      if (visible && treeEntries.length === 0) {
        buildTreeEntries();
      }
    },

    isVisible() {
      return visible;
    },

    setPanel(panel: DevToolsPanel) {
      activePanel = panel;
    },

    getPanel() {
      return activePanel;
    },

    selectNext() {
      if (treeEntries.length === 0) {
        buildTreeEntries();
      }
      if (treeEntries.length === 0) return;
      selectedIdx = (selectedIdx + 1) % treeEntries.length;
    },

    selectPrev() {
      if (treeEntries.length === 0) {
        buildTreeEntries();
      }
      if (treeEntries.length === 0) return;
      selectedIdx = (selectedIdx - 1 + treeEntries.length) % treeEntries.length;
    },

    toggleCollapse() {
      if (selectedIdx < 0 || selectedIdx >= treeEntries.length) return;
      const entry = treeEntries[selectedIdx]!;
      if (!entry.hasChildren) return;
      if (collapsedSet.has(entry.element)) {
        collapsedSet.delete(entry.element);
      } else {
        collapsedSet.add(entry.element);
      }
      buildTreeEntries();
    },

    selectNextPanel() {
      const panels: DevToolsPanel[] = ["tree", "styles", "performance", "events"];
      const idx = panels.indexOf(activePanel);
      activePanel = panels[(idx + 1) % panels.length]!;
    },

    selectPrevPanel() {
      const panels: DevToolsPanel[] = ["tree", "styles", "performance", "events"];
      const idx = panels.indexOf(activePanel);
      activePanel = panels[(idx - 1 + panels.length) % panels.length]!;
    },

    setMetrics(metrics: PerformanceMetrics) {
      currentMetrics = metrics;
      fpsHistory.push(metrics.avgFps);
      if (fpsHistory.length > FPS_HISTORY_MAX) {
        fpsHistory.shift();
      }
    },

    setEvents(events: readonly LoggedEvent[]) {
      currentEvents = events;
    },
  };
}
