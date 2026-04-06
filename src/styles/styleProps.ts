import type { FlexDirection, FlexWrap, Align, AlignSelf, Justify, Overflow, Display, Position } from "../layout/engine.js";
import type { BorderStyle } from "../core/types.js";

export interface StormTextStyleProps {
  color?: string | number;
  bold?: boolean;
  dim?: boolean;
  /** CSS-like class name(s) for StyleSheet matching (space-separated). */
  className?: string;
  /** CSS-like ID for StyleSheet matching (without the '#' prefix). */
  id?: string;
}

export interface StormLayoutStyleProps extends StormTextStyleProps {
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
  margin?: number;
  marginX?: number;
  marginY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

/** Base style interface for all container components (Box, Card, Modal, etc). Extends layout with padding, border, bg. */
export interface StormContainerStyleProps extends StormLayoutStyleProps {
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
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
}
