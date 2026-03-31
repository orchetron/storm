/**
 * Box — flexbox container component.
 *
 * The primary layout primitive. Arranges children vertically (default)
 * or horizontally with flexbox semantics.
 */

import React from "react";
import type { FlexDirection, FlexWrap, Align, AlignSelf, Justify, Overflow, Display, Position } from "../layout/engine.js";
import type { BorderStyle } from "../core/types.js";

export interface BoxProps {
  children?: React.ReactNode;
  // Layout
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
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
  overflow?: Overflow;
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
  // Selection
  userSelect?: boolean;
  // Accessibility
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

export const Box = React.memo(function Box(props: BoxProps): React.ReactElement {
  const { children, ...rest } = props;
  return React.createElement("tui-box", rest, children);
});
