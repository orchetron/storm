/**
 * JSX intrinsic element types for Storm TUI.
 *
 * Provides full type safety for tui-box, tui-text, tui-scroll-view,
 * tui-text-input, and tui-overlay host elements, eliminating the need
 * for `as any` casts in React.createElement calls.
 */

import type { BorderStyle } from "./core/types.js";
import type { AriaRole } from "./core/aria.js";
import type {
  FlexDirection,
  FlexWrap,
  Align,
  AlignSelf,
  AlignContent,
  Justify,
  Overflow,
  Display,
  Position,
  GridAutoFlow,
} from "./layout/engine.js";

interface StormBoxProps {
  key?: string | number;
  children?: React.ReactNode;
  // Layout — dimensions
  width?: number | `${number}%` | "auto" | "min-content" | "max-content";
  height?: number | `${number}%` | "auto" | "min-content" | "max-content";
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  // Layout — flex
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | `${number}%`;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  gap?: number;
  columnGap?: number;
  rowGap?: number;
  alignItems?: Align;
  alignContent?: AlignContent;
  alignSelf?: AlignSelf;
  justifyContent?: Justify;
  // Layout — overflow
  overflow?: Overflow;
  overflowX?: Overflow;
  overflowY?: Overflow;
  // Layout — display & position
  display?: Display;
  position?: Position;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  order?: number;
  aspectRatio?: number;
  direction?: "ltr" | "rtl";
  // Layout — grid
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumn?: string;
  gridRow?: string;
  gridGap?: number;
  gridAutoFlow?: GridAutoFlow;
  // Padding
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  // Margin
  margin?: number | "auto";
  marginX?: number | "auto";
  marginY?: number | "auto";
  marginTop?: number | "auto";
  marginBottom?: number | "auto";
  marginLeft?: number | "auto";
  marginRight?: number | "auto";
  // Border
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
  // Rendering
  backgroundColor?: string | number;
  opaque?: boolean;
  // Sticky positioning (for use inside ScrollView)
  sticky?: boolean;
  stickyChildren?: boolean;
  // Stacking order
  zIndex?: number;
  // Selection
  userSelect?: boolean;
  // Accessibility
  role?: AriaRole;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

interface StormTextProps {
  key?: string | number;
  children?: React.ReactNode;
  color?: string | number;
  bgColor?: string | number;
  backgroundColor?: string | number;
  bold?: boolean;
  dim?: boolean;
  dimColor?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  wrap?: "wrap" | "truncate" | "truncate-start" | "truncate-end" | "truncate-middle";
  // Accessibility
  role?: AriaRole;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

interface StormScrollViewProps {
  key?: string | number;
  children?: React.ReactNode;
  // Layout — dimensions
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  // Layout — flex
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  gap?: number;
  columnGap?: number;
  rowGap?: number;
  alignItems?: Align;
  alignSelf?: AlignSelf;
  justifyContent?: Justify;
  overflowX?: Overflow;
  overflowY?: Overflow;
  display?: Display;
  position?: Position;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  // Padding
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  // Margin
  margin?: number;
  marginX?: number;
  marginY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  // Border
  borderStyle?: BorderStyle;
  borderColor?: string | number;
  // Scroll behavior
  scrollTop?: number;
  scrollLeft?: number;
  scrollSpeed?: number;
  stickToBottom?: boolean;
  horizontalScroll?: boolean;
  snapToItem?: boolean;
  onScroll?: (scrollTop: number, maxScroll?: number) => void;
  scrollbarThumbColor?: string | number;
  scrollbarTrackColor?: string | number;
  scrollbarChar?: string;
  scrollbarTrackChar?: string;
  // Sticky children
  sticky?: boolean;
  stickyChildren?: boolean;
  // Windowing
  maxRenderChildren?: number;
  itemHeight?: number;
  // Internal — used by ScrollView component for imperative mutation
  _scrollState?: unknown;
  _hostPropsRef?: unknown;
  _focusId?: string;
}

interface StormTextInputProps {
  key?: string | number;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  placeholderColor?: string | number;
  color?: string | number;
  focus?: boolean;
  cursorOffset?: number;
  flex?: number;
  width?: number | `${number}%`;
  height?: number;
  history?: string[];
  mask?: string;
  // Accessibility
  role?: AriaRole;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

interface StormOverlayProps {
  key?: string | number;
  children?: React.ReactNode;
  visible?: boolean;
  position?: "center" | "bottom" | "top" | "center-left" | "center-right";
  width?: number | `${number}%`;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  borderStyle?: BorderStyle;
  borderColor?: string | number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  zIndex?: number;
  role?: AriaRole;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "tui-box": StormBoxProps;
      "tui-text": StormTextProps;
      "tui-scroll-view": StormScrollViewProps;
      "tui-text-input": StormTextInputProps;
      "tui-overlay": StormOverlayProps;
    }
  }
}
