import React from "react";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import type { BackgroundProp } from "../../reconciler/types.js";

export interface BoxProps extends StormContainerStyleProps {
  children?: React.ReactNode;
  /** Background pattern — painted into the buffer before children. */
  background?: BackgroundProp;
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
