/**
 * Internal element types for the TUI reconciler.
 *
 * These are the "host" elements that the React reconciler creates
 * and manages. They form a tree that gets laid out and painted.
 */

import type { LayoutProps, LayoutResult, LayoutNode, FlexDirection, FlexWrap, Align, AlignSelf, Justify, Overflow, Display, Position } from "../layout/engine.js";
import type { Style, BorderStyle } from "../core/types.js";

// ── Host element types ──────────────────────────────────────────────

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

// ── Props ───────────────────────────────────────────────────────────

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

// ── Element node ────────────────────────────────────────────────────

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

export function isTuiElement(node: TuiElement | TuiTextNode): node is TuiElement {
  return node.type !== "TEXT_NODE";
}

export function isTuiTextNode(node: TuiElement | TuiTextNode): node is TuiTextNode {
  return node.type === "TEXT_NODE";
}

// ── Root container ──────────────────────────────────────────────────

export interface TuiRoot {
  children: Array<TuiElement | TuiTextNode>;
  /** Callback triggered after React commits — triggers layout + paint + diff */
  onCommit: () => void;
}

export function createRoot(onCommit: () => void): TuiRoot {
  return { children: [], onCommit };
}

// ── Element creation ────────────────────────────────────────────────

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

  // Resolve explicit padding values, then add border offset per side
  const basePad = (props["padding"] as number | undefined) ?? 0;
  const basePX = (props["paddingX"] as number | undefined) ?? basePad;
  const basePY = (props["paddingY"] as number | undefined) ?? basePad;
  const pTop = ((props["paddingTop"] as number | undefined) ?? basePY) + (showTop ? 1 : 0);
  const pBottom = ((props["paddingBottom"] as number | undefined) ?? basePY) + (showBottom ? 1 : 0);
  const pLeft = ((props["paddingLeft"] as number | undefined) ?? basePX) + (showLeft ? 1 : 0);
  const pRight = ((props["paddingRight"] as number | undefined) ?? basePX) + (showRight ? 1 : 0);

  // Resolve margin values
  const baseMargin = (props["margin"] as number | undefined) ?? 0;
  const baseMX = (props["marginX"] as number | undefined) ?? baseMargin;
  const baseMY = (props["marginY"] as number | undefined) ?? baseMargin;
  const mTop = (props["marginTop"] as number | undefined) ?? baseMY;
  const mBottom = (props["marginBottom"] as number | undefined) ?? baseMY;
  const mLeft = (props["marginLeft"] as number | undefined) ?? baseMX;
  const mRight = (props["marginRight"] as number | undefined) ?? baseMX;
  const hasMargin = mTop > 0 || mBottom > 0 || mLeft > 0 || mRight > 0;

  return {
    ...(props["width"] !== undefined ? { width: props["width"] as number | `${number}%` } : {}),
    ...(props["height"] !== undefined ? { height: props["height"] as number | `${number}%` } : {}),
    ...(props["minWidth"] !== undefined ? { minWidth: props["minWidth"] as number } : {}),
    ...(props["minHeight"] !== undefined ? { minHeight: props["minHeight"] as number } : {}),
    ...(props["maxWidth"] !== undefined ? { maxWidth: props["maxWidth"] as number } : {}),
    ...(props["maxHeight"] !== undefined ? { maxHeight: props["maxHeight"] as number } : {}),
    ...(props["flex"] !== undefined ? { flex: props["flex"] as number } : {}),
    ...(props["flexGrow"] !== undefined ? { flexGrow: props["flexGrow"] as number } : {}),
    ...(props["flexShrink"] !== undefined ? { flexShrink: props["flexShrink"] as number } : {}),
    ...(props["flexBasis"] !== undefined ? { flexBasis: props["flexBasis"] as number } : {}),
    ...(props["flexDirection"] !== undefined ? { flexDirection: props["flexDirection"] as FlexDirection } : {}),
    ...(props["flexWrap"] !== undefined ? { flexWrap: props["flexWrap"] as FlexWrap } : {}),
    paddingTop: pTop,
    paddingBottom: pBottom,
    paddingLeft: pLeft,
    paddingRight: pRight,
    ...(hasMargin ? { marginTop: mTop } : {}),
    ...(hasMargin ? { marginBottom: mBottom } : {}),
    ...(hasMargin ? { marginLeft: mLeft } : {}),
    ...(hasMargin ? { marginRight: mRight } : {}),
    ...(props["gap"] !== undefined ? { gap: props["gap"] as number } : {}),
    ...(props["columnGap"] !== undefined ? { columnGap: props["columnGap"] as number } : {}),
    ...(props["rowGap"] !== undefined ? { rowGap: props["rowGap"] as number } : {}),
    ...(props["alignItems"] !== undefined ? { alignItems: props["alignItems"] as Align } : {}),
    ...(props["alignSelf"] !== undefined ? { alignSelf: props["alignSelf"] as AlignSelf } : {}),
    ...(props["justifyContent"] !== undefined ? { justifyContent: props["justifyContent"] as Justify } : {}),
    ...(type === TUI_SCROLL_VIEW
      ? { overflow: "scroll" as Overflow }
      : props["overflow"] !== undefined
        ? { overflow: props["overflow"] as Overflow }
        : {}),
    ...(props["overflowX"] !== undefined ? { overflowX: props["overflowX"] as Overflow } : {}),
    ...(props["overflowY"] !== undefined ? { overflowY: props["overflowY"] as Overflow } : {}),
    ...(props["display"] !== undefined ? { display: props["display"] as Display } : {}),
    ...(props["position"] !== undefined ? { position: props["position"] as Position } : {}),
    ...(props["top"] !== undefined ? { top: props["top"] as number } : {}),
    ...(props["left"] !== undefined ? { left: props["left"] as number } : {}),
    ...(props["right"] !== undefined ? { right: props["right"] as number } : {}),
    ...(props["bottom"] !== undefined ? { bottom: props["bottom"] as number } : {}),
  };
}
