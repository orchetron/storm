/**
 * Link — terminal hyperlink using OSC 8 escape sequences.
 *
 * Renders a clickable link in terminals that support the OSC 8 protocol.
 * The _linkUrl prop is picked up by the renderer, which populates a link
 * registry. The diff engine then wraps the appropriate character ranges
 * with OSC 8 open/close sequences during output.
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormTextStyleProps } from "../styles/styleProps.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface LinkProps extends StormTextStyleProps {
  url: string;
  children: React.ReactNode;
}

export const Link = React.memo(function Link(rawProps: LinkProps): React.ReactElement {
  const props = usePluginProps("Link", rawProps as unknown as Record<string, unknown>) as unknown as LinkProps;
  const personality = usePersonality();
  const { url, children, color, bold, dim } = props;

  return React.createElement(
    "tui-text",
    {
      color: color ?? personality.typography.linkColor,
      underline: personality.typography.linkUnderline,
      ...(bold !== undefined ? { bold } : {}),
      ...(dim !== undefined ? { dim } : {}),
      _linkUrl: url,
    },
    children,
  );
});
