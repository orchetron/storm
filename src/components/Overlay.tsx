/**
 * Overlay — modal/overlay component rendered on top of all other elements.
 *
 * Overlays are painted in a second pass, overwriting cells from the
 * normal element tree. Position controls where the overlay appears
 * relative to the screen.
 */

import React from "react";
import type { BorderStyle } from "../core/types.js";

export interface OverlayProps {
  children?: React.ReactNode;
  visible?: boolean; // default true
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
}

export const Overlay = React.memo(function Overlay(props: OverlayProps): React.ReactElement | null {
  const { children, visible = true, ...rest } = props;
  if (!visible) return null;
  return React.createElement("tui-overlay", rest, children);
});
