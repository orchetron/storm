import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../../styles/applyStyles.js";
import { DEFAULTS } from "../../styles/defaults.js";
import { useStyles } from "../../core/style-provider.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { getTypeColors } from "../../utils/theme-maps.js";

export interface AlertAction {
  label: string;
  onAction: () => void;
}

export interface AlertProps extends StormContainerStyleProps {
  children: React.ReactNode;
  type?: "success" | "warning" | "error" | "info";
  title?: string;
  /** When true, show an "x" close indicator and handle Escape to call onClose. */
  closable?: boolean;
  /** Called when the alert is dismissed (via Escape key or close indicator). */
  onClose?: () => void;
  /** Action link rendered after the message. */
  action?: AlertAction;
  /** Whether this alert is focused and receives keyboard input (default true when closable). */
  isFocused?: boolean;
  /** Custom render for the alert type icon. */
  renderIcon?: (type: string, icon: string) => React.ReactNode;
}

export interface AlertContextValue {
  type: "success" | "warning" | "error" | "info";
  typeColor: string;
  closable: boolean;
  onClose: (() => void) | undefined;
}

export const AlertContext = createContext<AlertContextValue | null>(null);

export function useAlertContext(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("Alert sub-components must be used inside Alert.Root");
  return ctx;
}

export interface AlertRootProps {
  type?: "success" | "warning" | "error" | "info";
  closable?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

function AlertRoot({ type = "info", closable = false, onClose, children }: AlertRootProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape" && onCloseRef.current) {
      onCloseRef.current();
    }
  }, []);

  useInput(handleInput, { isActive: closable });

  const alertTypeColors = getTypeColors(colors);
  const typeColor = alertTypeColors[type] ?? colors.info;

  const ctx: AlertContextValue = { type, typeColor, closable, onClose };

  return React.createElement(
    AlertContext.Provider,
    { value: ctx },
    React.createElement(
      "tui-box",
      {
        flexDirection: "column",
        ...DEFAULTS.alert,
        borderStyle: personality.borders.default,
        borderColor: typeColor,
      },
      children,
    ),
  );
}

export interface AlertIconProps {
  children?: React.ReactNode;
}

function AlertIcon({ children }: AlertIconProps): React.ReactElement {
  const colors = useColors();
  const { type, typeColor } = useAlertContext();
  const icon = TYPE_ICONS[type] ?? "\u2139";

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  return React.createElement(
    "tui-text",
    { color: typeColor, bold: true },
    `${icon} `,
  );
}

export interface AlertCompoundTitleProps {
  children: React.ReactNode;
}

function AlertCompoundTitle({ children }: AlertCompoundTitleProps): React.ReactElement {
  const colors = useColors();
  const { typeColor } = useAlertContext();

  return React.createElement(
    "tui-text",
    { color: typeColor, bold: true },
    children,
  );
}

export interface AlertCompoundBodyProps {
  children: React.ReactNode;
}

function AlertCompoundBody({ children }: AlertCompoundBodyProps): React.ReactElement {
  return React.createElement("tui-box", {}, children);
}

export interface AlertCompoundActionProps {
  label: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

function AlertCompoundAction({ label, onAction, children }: AlertCompoundActionProps): React.ReactElement {
  const colors = useColors();
  const { typeColor } = useAlertContext();

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row", marginTop: 1 }, children);
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row", marginTop: 1 },
    React.createElement(
      "tui-text",
      { color: typeColor, bold: true, underline: true },
      label,
    ),
  );
}

const TYPE_ICONS: Record<string, string> = {
  info: "\u2139",    // ℹ
  success: "\u2713", // ✓
  warning: "\u26A0", // ⚠
  error: "\u2717",   // ✗
};

const AlertBase = React.memo(function Alert(rawProps: AlertProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Alert", rawProps);
  const personality = usePersonality();
  const {
    children,
    type = "info",
    title,
    closable = false,
    onClose,
    action,
    isFocused,
    className,
    id,
  } = props;

  const ssStyles = useStyles("Alert", className, id);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const actionRef = useRef(action);
  actionRef.current = action;

  const isInputActive = isFocused !== undefined ? isFocused : closable;

  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape" && onCloseRef.current) {
      onCloseRef.current();
    }
    if (event.key === "return" && actionRef.current) {
      actionRef.current.onAction();
    }
  }, []);

  useInput(handleInput, { isActive: isInputActive });

  const userStyles = pickStyleProps(props);
  const typeColors = getTypeColors(colors);
  const typeColor = typeColors[type] ?? colors.info;

  // Merge: defaults -> stylesheet -> explicit props (explicit wins)
  const boxProps = mergeBoxStyles(
    mergeBoxStyles(
      {
        role: "alert",
        flexDirection: "column",
        ...DEFAULTS.alert,
        borderStyle: personality.borders.default,
        borderColor: typeColor,
      },
      ssStyles as Record<string, unknown>,
    ),
    userStyles,
  );

  const innerChildren: React.ReactNode[] = [];

  const icon = TYPE_ICONS[type] ?? "\u2139";

  if (title) {
    const iconElement = props.renderIcon
      ? React.createElement(React.Fragment, { key: "icon" }, props.renderIcon(type, icon))
      : React.createElement(
          "tui-text",
          { color: typeColor, bold: true, key: "icon" },
          `${icon} `,
        );
    const titleRowChildren: React.ReactElement[] = [
      iconElement,
      React.createElement(
        "tui-text",
        { color: typeColor, bold: true, key: "title" },
        title,
      ),
    ];

    if (closable) {
      titleRowChildren.push(
        React.createElement("tui-box", { key: "spacer", flex: 1 }),
      );
      titleRowChildren.push(
        React.createElement(
          "tui-text",
          { key: "close", color: colors.text.dim, dim: true },
          "\u00D7",
        ),
      );
    }

    innerChildren.push(
      React.createElement(
        "tui-box",
        { key: "title-row", flexDirection: "row" },
        ...titleRowChildren,
      ),
    );
  } else {
    const iconOnlyElement = props.renderIcon
      ? React.createElement(React.Fragment, { key: "icon-only" }, props.renderIcon(type, icon))
      : React.createElement(
          "tui-text",
          { color: typeColor, bold: true, key: "icon-only" },
          `${icon} `,
        );
    const iconRowChildren: React.ReactElement[] = [
      iconOnlyElement,
    ];

    if (closable) {
      iconRowChildren.push(
        React.createElement("tui-box", { key: "spacer", flex: 1 }),
      );
      iconRowChildren.push(
        React.createElement(
          "tui-text",
          { key: "close", color: colors.text.dim, dim: true },
          "\u00D7",
        ),
      );
    }

    innerChildren.push(
      React.createElement(
        "tui-box",
        { key: "icon-row", flexDirection: "row" },
        ...iconRowChildren,
      ),
    );
  }

  innerChildren.push(
    React.createElement(
      "tui-box",
      { key: "content" },
      children,
    ),
  );

  // Action link
  if (action) {
    innerChildren.push(
      React.createElement(
        "tui-box",
        { key: "action-row", flexDirection: "row", marginTop: 1 },
        React.createElement(
          "tui-text",
          { color: typeColor, bold: true, underline: true },
          action.label,
        ),
      ),
    );
  }

  return React.createElement(
    "tui-box",
    boxProps,
    ...innerChildren,
  );
});

export const Alert = Object.assign(AlertBase, {
  Root: AlertRoot,
  Icon: AlertIcon,
  Title: AlertCompoundTitle,
  Body: AlertCompoundBody,
  Action: AlertCompoundAction,
});
