import type { LayoutProps, LayoutResult, LayoutNode, FlexDirection, FlexWrap, Align, AlignSelf, Justify, Overflow, Display, Position } from "../layout/engine.js";
import type { Style, BorderStyle } from "../core/types.js";

export const TUI_BOX = "tui-box";
export const TUI_TEXT = "tui-text";
export const TUI_SCROLL_VIEW = "tui-scroll-view";
export const TUI_TEXT_INPUT = "tui-text-input";
export const TUI_OVERLAY = "tui-overlay";

export type TuiElementType =
  | typeof TUI_BOX
  | typeof TUI_TEXT
  | typeof TUI_SCROLL_VIEW
  | typeof TUI_TEXT_INPUT
  | typeof TUI_OVERLAY;

export interface TuiBoxProps extends LayoutProps {
  borderStyle?: BorderStyle;
  borderColor?: string | number;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  borderDimColor?: boolean;
  borderTopDimColor?: boolean;
  borderBottomDimColor?: boolean;
  borderLeftDimColor?: boolean;
  borderRightDimColor?: boolean;
  backgroundColor?: string | number;
  /** Background pattern — painted into the buffer before children. */
  background?: BackgroundProp;
  opaque?: boolean;
  sticky?: boolean;
  stickyChildren?: boolean;
  zIndex?: number;
}

export interface TuiTextProps {
  color?: string | number;
  bgColor?: string | number;
  bold?: boolean;
  dim?: boolean;
  /** Alias for `dim` — applies dim attribute when true. */
  dimColor?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  wrap?: "wrap" | "truncate" | "truncate-end" | "truncate-middle";
}

export interface TuiScrollViewProps extends LayoutProps {
  scrollTop?: number;
  scrollLeft?: number;
  onScroll?: (scrollTop: number, maxScroll: number) => void;
  borderStyle?: BorderStyle;
  borderColor?: string | number;
  backgroundColor?: string | number;
  opaque?: boolean;
  sticky?: boolean;
  stickyChildren?: boolean;
}

export interface TuiTextInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  cursorOffset?: number;
  focus?: boolean;
  color?: string | number;
  placeholderColor?: string | number;
}

export interface TuiOverlayProps extends Omit<LayoutProps, "position"> {
  visible?: boolean;
  position?: "center" | "bottom" | "top";
  borderStyle?: BorderStyle;
  borderColor?: string | number;
  zIndex?: number;
}

export type TuiProps = TuiBoxProps | TuiTextProps | TuiScrollViewProps | TuiTextInputProps | TuiOverlayProps;

export type BackgroundPreset = "dots" | "grid" | "crosshatch";

export interface BackgroundPattern {
  /** Preset or custom pattern */
  type: BackgroundPreset | "watermark" | "gradient" | "custom";
  /** Spacing between pattern characters. Default: 4 for dots, 6 for grid */
  spacing?: number;
  /** Custom character to use */
  char?: string;
  /** Pattern color. Uses theme dim color by default */
  color?: string;
  /** Render dimmed. Default: true */
  dim?: boolean;
  /** Text for watermark type */
  text?: string;
  /** Watermark mode: tile diagonally or center once. Default: "tile" */
  mode?: "tile" | "center";
  /** Gradient colors [from, to]. Applies to pattern chars OR fills cells for type "gradient" */
  gradient?: [string, string];
  /** Gradient direction. Default: "horizontal" */
  direction?: "horizontal" | "vertical" | "diagonal";
  /** Animate the background pattern. Default: false */
  animate?: boolean;
  /** Animation speed in ms. Default: 200 */
  animateSpeed?: number;
  /** Opacity 0-1. At < 1, blends background color with existing buffer content. Default: 1 */
  opacity?: number;
}

export type BackgroundProp = BackgroundPreset | BackgroundPattern;

export interface TuiElement {
  type: TuiElementType;
  props: Record<string, unknown>;
  children: Array<TuiElement | TuiTextNode>;
  parent: TuiElement | null;
  /** Layout result — computed during layout phase */
  layoutNode: LayoutNode;
  /** Cached styled runs for paint — invalidated on commitUpdate */
  _cachedRuns?: Array<{ text: string; fg: number; bg: number; attrs: number; ulColor: number }> | undefined;
  /** Version counter for cached runs invalidation */
  _cachedRunsVersion?: number | undefined;
  /** Per-element dirty flag — set when text-related props change */
  _runsDirty?: boolean | undefined;
}

export interface TuiTextNode {
  type: "TEXT_NODE";
  text: string;
  parent: TuiElement | null;
}

/** Ref target for imperative mutation. Set properties directly, then call requestRender(). */
export interface HostTextNode extends Pick<TuiTextNode, "text"> {
  scrollTop?: number;
  scrollLeft?: number;
  cursorOffset?: number;
  value?: string;
  _elementPositions?: unknown;
  _viewportHeight?: unknown;
  _viewportWidth?: unknown;
}

export function isTuiElement(node: TuiElement | TuiTextNode): node is TuiElement {
  return node.type !== "TEXT_NODE";
}

export function isTuiTextNode(node: TuiElement | TuiTextNode): node is TuiTextNode {
  return node.type === "TEXT_NODE";
}

export interface TuiRoot {
  children: Array<TuiElement | TuiTextNode>;
  /** Callback triggered after React commits — triggers layout + paint + diff */
  onCommit: () => void;
}

export function createRoot(onCommit: () => void): TuiRoot {
  return { children: [], onCommit };
}

export function createElement(
  type: TuiElementType,
  props: Record<string, unknown>,
): TuiElement {
  return {
    type,
    props: { ...props }, // Copy — React freezes its props objects
    children: [],
    parent: null,
    _runsDirty: false,
    _cachedRuns: undefined,
    _cachedRunsVersion: undefined,
    layoutNode: {
      props: extractLayoutProps(type, props),
      children: [],
      layout: {
        x: 0, y: 0, width: 0, height: 0,
        innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0,
        contentHeight: 0, contentWidth: 0,
      },
    },
  };
}

export function createTextNode(initialText: string): TuiTextNode {
  let _text = initialText;
  const node: TuiTextNode = {
    type: "TEXT_NODE",
    get text() { return _text; },
    set text(newText: string) {
      if (_text === newText) return; // no-op if unchanged
      _text = newText;
      // Mark all tui-text ancestors' styled runs as dirty so the renderer
      // re-reads this text on the next paint. Nested tui-text elements
      // (e.g., OperationTree's icon inside a row) need the outermost
      // tui-text to be marked dirty since that's where paintText checks.
      let ancestor: TuiElement | null = node.parent;
      while (ancestor) {
        ancestor._runsDirty = true;
        if (ancestor.type !== TUI_TEXT) break;
        ancestor = ancestor.parent;
      }
    },
    parent: null,
  };
  return node;
}

export function extractLayoutProps(
  type: TuiElementType,
  props: Record<string, unknown>,
): LayoutProps {
  // Border adds 1 cell of implicit padding on each side
  const hasBorder = props["borderStyle"] !== undefined && props["borderStyle"] !== "none";
  // Individual border sides default to true when borderStyle is set
  const showTop = hasBorder && (props["borderTop"] as boolean | undefined) !== false;
  const showBottom = hasBorder && (props["borderBottom"] as boolean | undefined) !== false;
  const showLeft = hasBorder && (props["borderLeft"] as boolean | undefined) !== false;
  const showRight = hasBorder && (props["borderRight"] as boolean | undefined) !== false;

  const basePad = (props["padding"] as number | undefined) ?? 0;
  const basePX = (props["paddingX"] as number | undefined) ?? basePad;
  const basePY = (props["paddingY"] as number | undefined) ?? basePad;
  const pTop = ((props["paddingTop"] as number | undefined) ?? basePY) + (showTop ? 1 : 0);
  const pBottom = ((props["paddingBottom"] as number | undefined) ?? basePY) + (showBottom ? 1 : 0);
  const pLeft = ((props["paddingLeft"] as number | undefined) ?? basePX) + (showLeft ? 1 : 0);
  const pRight = ((props["paddingRight"] as number | undefined) ?? basePX) + (showRight ? 1 : 0);

  const baseMargin = (props["margin"] as number | undefined) ?? 0;
  const baseMX = (props["marginX"] as number | undefined) ?? baseMargin;
  const baseMY = (props["marginY"] as number | undefined) ?? baseMargin;
  const mTop = (props["marginTop"] as number | undefined) ?? baseMY;
  const mBottom = (props["marginBottom"] as number | undefined) ?? baseMY;
  const mLeft = (props["marginLeft"] as number | undefined) ?? baseMX;
  const mRight = (props["marginRight"] as number | undefined) ?? baseMX;
  const hasMargin = mTop > 0 || mBottom > 0 || mLeft > 0 || mRight > 0;

  const result: LayoutProps = { paddingTop: pTop, paddingBottom: pBottom, paddingLeft: pLeft, paddingRight: pRight };
  const set = (key: string, val: unknown) => { if (val !== undefined) (result as Record<string, unknown>)[key] = val; };
  set("width", props["width"]); set("height", props["height"]);
  set("minWidth", props["minWidth"]); set("minHeight", props["minHeight"]);
  set("maxWidth", props["maxWidth"]); set("maxHeight", props["maxHeight"]);
  set("flex", props["flex"]); set("flexGrow", props["flexGrow"]);
  set("flexShrink", props["flexShrink"]); set("flexBasis", props["flexBasis"]);
  set("flexDirection", props["flexDirection"]); set("flexWrap", props["flexWrap"]);
  if (hasMargin) { result.marginTop = mTop; result.marginBottom = mBottom; result.marginLeft = mLeft; result.marginRight = mRight; }
  set("gap", props["gap"]); set("columnGap", props["columnGap"]); set("rowGap", props["rowGap"]);
  set("alignItems", props["alignItems"]); set("alignSelf", props["alignSelf"]);
  set("justifyContent", props["justifyContent"]);
  if (type === TUI_SCROLL_VIEW) result.overflow = "scroll" as Overflow;
  else set("overflow", props["overflow"]);
  set("overflowX", props["overflowX"]); set("overflowY", props["overflowY"]);
  set("display", props["display"]); set("position", props["position"]);
  set("top", props["top"]); set("left", props["left"]);
  set("right", props["right"]); set("bottom", props["bottom"]);
  return result;
}
