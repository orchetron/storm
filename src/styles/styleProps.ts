/**
 * Storm style prop interfaces — tiered customization for all components.
 *
 * Tier 1: StormTextStyleProps — color, bold, dim (inline components)
 * Tier 2: StormLayoutStyleProps — adds width, height, margin (layout components)
 * Tier 3: StormContainerStyleProps — adds padding, border, bg (container components)
 */

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
  maxWidth?: number;
  margin?: number;
  marginX?: number;
  marginY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

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
  backgroundColor?: string | number;
}
