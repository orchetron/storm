import React, { useRef, useCallback, createContext, useContext } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { FocusGroup } from "./FocusGroup.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../../styles/applyStyles.js";
import { DEFAULTS } from "../../styles/defaults.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

let nextModalId = 0;

export interface ModalContextValue {
  visible: boolean;
  onClose: (() => void) | undefined;
  size: ModalSize;
}

export const ModalContext = createContext<ModalContextValue | null>(null);

export function useModalContext(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("Modal sub-components must be used inside Modal.Root");
  return ctx;
}

export interface ModalRootProps {
  visible: boolean;
  onClose?: () => void;
  size?: ModalSize;
  children: React.ReactNode;
}

function ModalRoot({ visible, onClose, size = "md", children }: ModalRootProps): React.ReactElement | null {
  const personality = usePersonality();
  const { screen, focus } = useTui();

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable unique group ID for this modal instance (supports nested modals)
  const groupIdRef = useRef(`modal-${nextModalId++}`);

  // Focus trap handler: only consumes Escape and Tab.
  // All other keys pass through to child components (ScrollView, TextInput, Select, etc.)
  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape") {
      event.consumed = true;
      onCloseRef.current?.();
      return;
    }
    if (event.key === "tab") {
      event.consumed = true;
      if (event.shift) {
        focus.cyclePrev();
      } else {
        focus.cycleNext();
      }
      return;
    }
  }, [focus]);

  useInput(handleInput, { isActive: visible, priority: 1000 });

  if (!visible) return null;

  const sizeWidth = size === "full"
    ? Math.max(1, screen.width - 4)
    : (SIZE_WIDTHS[size] ?? DEFAULTS.modal.width);

  const ctx: ModalContextValue = { visible, onClose, size };

  const overlayProps = {
    visible: true,
    position: "center" as const,
    ...DEFAULTS.modal,
    borderStyle: personality.borders.panel,
    width: sizeWidth,
    borderColor: personality.colors.brand.primary,
  };

  return React.createElement(
    "tui-overlay",
    overlayProps,
    React.createElement(
      FocusGroup,
      { id: groupIdRef.current, trap: true, direction: "vertical" },
      React.createElement(
        ModalContext.Provider,
        { value: ctx },
        React.createElement("tui-box", { flexDirection: "column" }, children),
      ),
    ),
  );
}

export interface ModalTitleProps {
  children: React.ReactNode;
}

function ModalTitle({ children }: ModalTitleProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-text",
    { bold: true, color: colors.text.primary },
    children,
  );
}

export interface ModalBodyProps {
  children: React.ReactNode;
}

function ModalBody({ children }: ModalBodyProps): React.ReactElement {
  return React.createElement(
    "tui-box",
    { flexDirection: "column", marginTop: 1 },
    children,
  );
}

export interface ModalFooterProps {
  children: React.ReactNode;
}

function ModalFooter({ children }: ModalFooterProps): React.ReactElement {
  return React.createElement(
    "tui-box",
    { flexDirection: "row", marginTop: 1 },
    children,
  );
}

export type ModalSize = "sm" | "md" | "lg" | "full";

const SIZE_WIDTHS: Record<string, number> = {
  sm: 30,
  md: 50,
  lg: 70,
};

export interface ModalProps extends StormContainerStyleProps {
  visible: boolean;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  /** Size preset: "sm" (30), "md" (50, default), "lg" (70), "full" (screen width - 4). */
  size?: ModalSize;
  /** Custom render for the modal title. */
  renderTitle?: (title: string) => React.ReactNode;
}

const ModalBase = React.memo(function Modal(rawProps: ModalProps): React.ReactElement | null {
  const colors = useColors();
  const props = usePluginProps("Modal", rawProps);
  const personality = usePersonality();

  const {
    visible,
    title,
    children,
    onClose,
    size = "md",
  } = props;

  const { screen, focus } = useTui();

  const userStyles = pickStyleProps(props);

  const sizeWidth = size === "full"
    ? Math.max(1, screen.width - 4)
    : (SIZE_WIDTHS[size] ?? DEFAULTS.modal.width);
  const width = (userStyles.width as number | undefined) ?? sizeWidth;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable unique group ID for this modal instance (supports nested modals)
  const groupIdRef = useRef(`modal-${nextModalId++}`);

  // Focus trap handler: only consumes Escape and Tab.
  // All other keys pass through to child components (ScrollView, TextInput, Select, etc.)
  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape") {
      event.consumed = true;
      onCloseRef.current?.();
      return;
    }
    if (event.key === "tab") {
      event.consumed = true;
      if (event.shift) {
        focus.cyclePrev();
      } else {
        focus.cycleNext();
      }
      return;
    }
  }, [focus]);
  useInput(handleInput, { isActive: visible, priority: 1000 });

  if (!visible) return null;

  const contentChildren: React.ReactElement[] = [];

  // Title bar
  if (title) {
    if (props.renderTitle) {
      contentChildren.push(
        React.createElement(React.Fragment, { key: "title" }, props.renderTitle(title)),
      );
    } else {
      contentChildren.push(
        React.createElement(
          "tui-text",
          { key: "title", bold: true, color: colors.text.primary },
          title,
        ),
      );
    }

    // Divider line below title — subtract padding (paddingX defaults from DEFAULTS.modal)
    const padding = ((userStyles.padding as number | undefined) ?? (DEFAULTS.modal as Record<string, unknown>).padding as number | undefined) ?? 0;
    const paddingX = ((userStyles.paddingX as number | undefined) ?? (DEFAULTS.modal as Record<string, unknown>).paddingX as number | undefined) ?? padding;
    const dividerWidth = Math.max(1, width - paddingX * 2);
    contentChildren.push(
      React.createElement(
        "tui-text",
        { key: "divider", color: colors.divider },
        "\u2500".repeat(dividerWidth),
      ),
    );
  }

  // Children content
  contentChildren.push(
    React.createElement(
      "tui-box",
      { key: "body", flexDirection: "column", marginTop: title ? 1 : 0 },
      children,
    ),
  );

  // Esc to close hint
  if (onClose) {
    contentChildren.push(
      React.createElement(
        "tui-text",
        { key: "esc-hint", dim: true, color: colors.text.dim, marginTop: 1 },
        "[Esc to close]",
      ),
    );
  }

  const overlayProps = mergeBoxStyles(
    {
      visible: true,
      position: "center",
      ...DEFAULTS.modal,
      borderStyle: personality.borders.panel,
      width,
      borderColor: personality.colors.brand.primary,
      role: "dialog",
    },
    userStyles,
  );

  return React.createElement(
    "tui-overlay",
    overlayProps,
    React.createElement(
      FocusGroup,
      { id: groupIdRef.current, trap: true, direction: "vertical" },
      React.createElement(
        "tui-box",
        { flexDirection: "column" },
        ...contentChildren,
      ),
    ),
  );
});

export const Modal = Object.assign(ModalBase, {
  Root: ModalRoot,
  Title: ModalTitle,
  Body: ModalBody,
  Footer: ModalFooter,
});
