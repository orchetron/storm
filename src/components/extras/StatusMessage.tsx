import React, { useRef } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormTextStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface StatusMessageProps extends StormTextStyleProps {
  message: string;
  type?: "success" | "warning" | "error" | "info";
  title?: string;
  /** Optional detail text. When provided, shows a collapsible "Details" toggle. */
  detail?: string;
  /** Whether the component is focused (required for detail toggle via Enter). */
  isFocused?: boolean;
  /** Custom render for the status icon. */
  renderIcon?: (type: string, icon: string) => React.ReactNode;
}

function getTypeConfig(colors: StormColors): Record<string, { icon: string; color: string }> {
  return {
    success: { icon: "\u2713", color: colors.success },
    warning: { icon: "\u26A0", color: colors.warning },
    error: { icon: "\u2717", color: colors.error },
    info: { icon: "\u2139", color: colors.info },
  };
}

export const StatusMessage = React.memo(function StatusMessage(rawProps: StatusMessageProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("StatusMessage", rawProps);
  const { message, type = "info", title, color, bold: boldProp, dim, detail, isFocused = false } = props;

  const { requestRender } = useTui();
  const expandedRef = useRef(false);

  const typeConfig = getTypeConfig(colors);
  const config = typeConfig[type] ?? typeConfig["info"]!;
  const resolvedColor = color ?? config.color;
  const resolvedBold = boldProp !== undefined ? boldProp : true;

  const handleInput = React.useCallback(
    (event: KeyEvent) => {
      if (detail && event.key === "return") {
        expandedRef.current = !expandedRef.current;
        requestRender();
      }
    },
    [detail, requestRender],
  );

  useInput(handleInput, { isActive: isFocused && detail !== undefined });

  const iconElement = props.renderIcon
    ? React.createElement(React.Fragment, { key: "icon" }, props.renderIcon(type, config.icon))
    : React.createElement(
        "tui-text",
        { color: resolvedColor, bold: resolvedBold, ...(dim !== undefined ? { dim } : {}), key: "icon" },
        `${config.icon} `,
      );

  const children: React.ReactElement[] = [iconElement];

  if (title) {
    children.push(
      React.createElement(
        "tui-text",
        { color: resolvedColor, bold: resolvedBold, ...(dim !== undefined ? { dim } : {}), key: "title" },
        `${title} `,
      ),
    );
  }

  children.push(
    React.createElement(
      "tui-text",
      { color: colors.text.primary, ...(dim !== undefined ? { dim } : {}), key: "message" },
      message,
    ),
  );

  // Detail toggle indicator
  if (detail) {
    const toggleIcon = expandedRef.current ? "\u25BE" : "\u25B8";
    children.push(
      React.createElement(
        "tui-text",
        { color: colors.text.dim, dim: true, key: "toggle" },
        `  ${toggleIcon} Details`,
      ),
    );
  }

  const mainRow = React.createElement(
    "tui-box",
    { flexDirection: "row", key: "main" },
    ...children,
  );

  // If detail is present and expanded, show detail text below
  if (detail && expandedRef.current) {
    const detailRow = React.createElement(
      "tui-box",
      { key: "detail", paddingLeft: 2, marginTop: 0 },
      React.createElement(
        "tui-text",
        { color: colors.text.secondary, dim: true },
        detail,
      ),
    );

    return React.createElement(
      "tui-box",
      { flexDirection: "column" },
      mainRow,
      detailRow,
    );
  }

  return mainRow;
});
