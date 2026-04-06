/**
 * Inspector middleware — overlays component information on the rendered buffer.
 *
 * When enabled, draws colored borders around each component's layout box,
 * labels elements with their type names, and shows a detail panel for the
 * selected element. Designed for use during development.
 */

import type { ScreenBuffer } from "../core/buffer.js";
import type { RenderMiddleware } from "../core/middleware.js";
import type { TuiElement, TuiTextNode, TuiRoot } from "../reconciler/types.js";
import { isTuiElement, isTuiTextNode } from "../reconciler/types.js";

export interface InspectorState {
  enabled: boolean;
  selectedElement: TuiElement | null;
  showLayoutBoxes: boolean;
  showComponentNames: boolean;
}

const TYPE_COLORS: Record<string, number> = {
  "tui-box": 0x82aaff,         // blue
  "tui-text": 0xc3e88d,        // green
  "tui-scroll-view": 0xffcb6b, // amber
  "tui-text-input": 0xf78c6c,  // orange
  "tui-overlay": 0xc792ea,     // purple
};

const SELECTED_COLOR = 0xff5370;  // red highlight for selected element
const PANEL_BG = 0x1e1e2e;       // dark background for detail panel
const PANEL_FG = 0xcdd6f4;       // light text for detail panel
const LABEL_BG = 0x313244;       // label background
const LABEL_FG = 0xcdd6f4;       // label text

/**
 * Creates an inspector middleware that overlays component debug info.
 *
 * The middleware post-processes the ScreenBuffer after normal painting,
 * drawing colored borders and labels on top of the rendered content.
 *
 * Call `setRoot(root)` each frame (or once) to provide the element tree
 * for traversal. Without a root, the overlay has nothing to inspect.
 */
export function createInspectorMiddleware(): {
  middleware: RenderMiddleware;
  toggle: () => void;
  selectNext: () => void;
  selectPrev: () => void;
  getState: () => InspectorState;
  setRoot: (root: TuiRoot) => void;
} {
  const state: InspectorState = {
    enabled: false,
    selectedElement: null,
    showLayoutBoxes: true,
    showComponentNames: true,
  };

  // Flat list of elements for navigation — rebuilt on each paint
  let flatElements: TuiElement[] = [];
  let selectedIndex = -1;
  let currentRoot: TuiRoot | null = null;

  function collectElements(node: TuiElement | TuiTextNode, out: TuiElement[]): void {
    if (isTuiTextNode(node)) return;
    if (isTuiElement(node)) {
      const layout = node.layoutNode.layout;
      // Only include elements with a non-zero area
      if (layout.width > 0 && layout.height > 0) {
        out.push(node);
      }
      for (const child of node.children) {
        collectElements(child, out);
      }
    }
  }

  function rebuildFlatList(): void {
    flatElements = [];
    if (!currentRoot) return;
    for (const child of currentRoot.children) {
      collectElements(child, flatElements);
    }
    // Clamp selectedIndex
    if (flatElements.length === 0) {
      selectedIndex = -1;
      state.selectedElement = null;
    } else if (selectedIndex >= flatElements.length) {
      selectedIndex = flatElements.length - 1;
      state.selectedElement = flatElements[selectedIndex]!;
    } else if (selectedIndex < 0 && state.enabled) {
      selectedIndex = 0;
      state.selectedElement = flatElements[0]!;
    } else if (selectedIndex >= 0) {
      state.selectedElement = flatElements[selectedIndex]!;
    }
  }

  function drawHLine(buf: ScreenBuffer, x1: number, x2: number, y: number, fg: number): void {
    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < buf.width && y >= 0 && y < buf.height) {
        buf.setCell(x, y, { char: "─", fg, bg: -1, attrs: 0, ulColor: -1 });
      }
    }
  }

  function drawVLine(buf: ScreenBuffer, x: number, y1: number, y2: number, fg: number): void {
    for (let y = y1; y <= y2; y++) {
      if (x >= 0 && x < buf.width && y >= 0 && y < buf.height) {
        buf.setCell(x, y, { char: "│", fg, bg: -1, attrs: 0, ulColor: -1 });
      }
    }
  }

  function drawBorder(buf: ScreenBuffer, el: TuiElement, fg: number): void {
    const { x, y, width, height } = el.layoutNode.layout;
    if (width < 2 || height < 2) return;

    const x1 = x;
    const y1 = y;
    const x2 = x + width - 1;
    const y2 = y + height - 1;

    drawHLine(buf, x1 + 1, x2 - 1, y1, fg);
    drawHLine(buf, x1 + 1, x2 - 1, y2, fg);
    drawVLine(buf, x1, y1 + 1, y2 - 1, fg);
    drawVLine(buf, x2, y1 + 1, y2 - 1, fg);

    // Corners
    if (x1 >= 0 && x1 < buf.width && y1 >= 0 && y1 < buf.height)
      buf.setCell(x1, y1, { char: "┌", fg, bg: -1, attrs: 0, ulColor: -1 });
    if (x2 >= 0 && x2 < buf.width && y1 >= 0 && y1 < buf.height)
      buf.setCell(x2, y1, { char: "┐", fg, bg: -1, attrs: 0, ulColor: -1 });
    if (x1 >= 0 && x1 < buf.width && y2 >= 0 && y2 < buf.height)
      buf.setCell(x1, y2, { char: "└", fg, bg: -1, attrs: 0, ulColor: -1 });
    if (x2 >= 0 && x2 < buf.width && y2 >= 0 && y2 < buf.height)
      buf.setCell(x2, y2, { char: "┘", fg, bg: -1, attrs: 0, ulColor: -1 });
  }

  function drawLabel(buf: ScreenBuffer, text: string, x: number, y: number, fg: number, bg: number): void {
    for (let i = 0; i < text.length; i++) {
      const cx = x + i;
      if (cx >= 0 && cx < buf.width && y >= 0 && y < buf.height) {
        buf.setCell(cx, y, { char: text[i]!, fg, bg, attrs: 0, ulColor: -1 });
      }
    }
  }

  function drawDetailPanel(buf: ScreenBuffer, el: TuiElement): void {
    const layout = el.layoutNode.layout;
    const lines: string[] = [
      ` Type: ${el.type}`,
      ` Pos:  ${layout.x},${layout.y}  Size: ${layout.width}x${layout.height}`,
      ` Inner: ${layout.innerX},${layout.innerY}  ${layout.innerWidth}x${layout.innerHeight}`,
      ` Children: ${el.children.length}`,
    ];

    // Show key props
    const propsToShow = ["flexDirection", "flex", "borderStyle", "color", "bold", "wrap"];
    const propStrs: string[] = [];
    for (const key of propsToShow) {
      const val = el.props[key];
      if (val !== undefined) {
        propStrs.push(`${key}=${String(val)}`);
      }
    }
    if (propStrs.length > 0) {
      lines.push(` Props: ${propStrs.join(", ")}`);
    }

    // Panel dimensions
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const panelWidth = Math.min(maxLineLen + 2, buf.width);
    const panelHeight = lines.length + 2; // +2 for title + bottom padding
    const panelX = Math.max(0, buf.width - panelWidth);
    const panelY = Math.max(0, buf.height - panelHeight);

    // Fill background
    for (let py = panelY; py < panelY + panelHeight && py < buf.height; py++) {
      for (let px = panelX; px < panelX + panelWidth && px < buf.width; px++) {
        buf.setCell(px, py, { char: " ", fg: PANEL_FG, bg: PANEL_BG, attrs: 0, ulColor: -1 });
      }
    }

    // Title
    const titleBar = " Inspector ";
    drawLabel(buf, titleBar, panelX + 1, panelY, SELECTED_COLOR, PANEL_BG);

    // Content lines
    for (let i = 0; i < lines.length; i++) {
      const ly = panelY + 1 + i;
      if (ly < buf.height) {
        drawLabel(buf, lines[i]!, panelX, ly, PANEL_FG, PANEL_BG);
      }
    }
  }

  const middleware: RenderMiddleware = {
    name: "devtools-inspector",

    onPaint(buffer: ScreenBuffer, width: number, height: number): ScreenBuffer {
      if (!state.enabled) return buffer;

      // Rebuild flat element list from root
      rebuildFlatList();

      if (!state.showLayoutBoxes && !state.showComponentNames) return buffer;

      // Draw borders and labels for all elements
      for (let i = 0; i < flatElements.length; i++) {
        const el = flatElements[i]!;
        const isSelected = i === selectedIndex;
        const color = isSelected ? SELECTED_COLOR : (TYPE_COLORS[el.type] ?? 0x808080);

        if (state.showLayoutBoxes) {
          drawBorder(buffer, el, color);
        }

        if (state.showComponentNames) {
          const layout = el.layoutNode.layout;
          const label = ` ${el.type} `;
          const labelX = layout.x + 1;
          const labelY = layout.y;
          drawLabel(
            buffer, label, labelX, labelY,
            isSelected ? PANEL_BG : LABEL_FG,
            isSelected ? SELECTED_COLOR : LABEL_BG,
          );
        }
      }

      // Draw detail panel for selected element
      if (state.selectedElement) {
        drawDetailPanel(buffer, state.selectedElement);
      }

      return buffer;
    },
  };

  return {
    middleware,

    toggle() {
      state.enabled = !state.enabled;
      if (state.enabled && selectedIndex < 0 && flatElements.length > 0) {
        selectedIndex = 0;
        state.selectedElement = flatElements[0]!;
      }
    },

    selectNext() {
      if (!state.enabled || flatElements.length === 0) return;
      selectedIndex = (selectedIndex + 1) % flatElements.length;
      state.selectedElement = flatElements[selectedIndex]!;
    },

    selectPrev() {
      if (!state.enabled || flatElements.length === 0) return;
      selectedIndex = (selectedIndex - 1 + flatElements.length) % flatElements.length;
      state.selectedElement = flatElements[selectedIndex]!;
    },

    getState() {
      return { ...state };
    },

    setRoot(root: TuiRoot) {
      currentRoot = root;
    },
  };
}
