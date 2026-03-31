/**
 * Modal — dialog overlay with title bar, escape-to-close, and focus trap.
 *
 * Renders content inside a centered tui-overlay with a border,
 * optional title, and divider. Escape key triggers onClose.
 *
 * Features:
 *   - Focus trap: captures ALL keyboard input at highest priority when visible
 *   - Tab cycles between interactive elements (if any) within the modal
 *   - Size presets: "sm" (30), "md" (50, default), "lg" (70), "full" (screen width - 4)
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useTui } from "../context/TuiContext.js";
import { useInput } from "../hooks/useInput.js";
import { FocusGroup } from "./FocusGroup.js";
import { useColors } from "../hooks/useColors.js";
import type { KeyEvent } from "../input/types.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { DEFAULTS } from "../styles/defaults.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Compound Component API ──────────────────────────────────────

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

  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape") {
      onCloseRef.current?.();
      return;
    }
    // Forward scroll-related keys to the active ScrollView inside the modal.
    // Without this, the focus trap swallows PgUp/PgDown/Shift+arrows and
    // ScrollViews inside the modal can never receive keyboard scroll.
    const activeId = focus.activeScrollId;
    if (activeId) {
      const entry = focus.entries.get(activeId);
      if (entry) {
        if (event.key === "pageup") entry.onScroll?.(-10);
        else if (event.key === "pagedown") entry.onScroll?.(10);
        else if (event.key === "up" && event.shift) entry.onScroll?.(-1);
        else if (event.key === "down" && event.shift) entry.onScroll?.(1);
        else if (event.key === "left") entry.onHScroll?.(-1);
        else if (event.key === "right") entry.onHScroll?.(1);
      }
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
      { trap: true, direction: "vertical" },
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
  const colors = useColors();
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
  const colors = useColors();
  return React.createElement(
    "tui-box",
    { flexDirection: "row", marginTop: 1 },
    children,
  );
}

// ── Recipe API (original) ───────────────────────────────────────

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
  const props = usePluginProps("Modal", rawProps as unknown as Record<string, unknown>) as unknown as ModalProps;
  const personality = usePersonality();

  const {
    visible,
    title,
    children,
    onClose,
    size = "md",
  } = props;

  const { screen, focus } = useTui();

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  // Resolve width from size prop, user style override, or DEFAULTS
  const sizeWidth = size === "full"
    ? Math.max(1, screen.width - 4)
    : (SIZE_WIDTHS[size] ?? DEFAULTS.modal.width);
  const width = (userStyles.width as number | undefined) ?? sizeWidth;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus trap: capture ALL keyboard input at highest priority when modal is visible.
  // This prevents any other useInput handlers from receiving events.
  // Scroll-related keys are forwarded to the active ScrollView so that
  // ScrollViews inside the modal can be keyboard-scrolled.
  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape") {
      onCloseRef.current?.();
      return;
    }
    // Forward scroll-related keys to the active ScrollView inside the modal.
    const activeId = focus.activeScrollId;
    if (activeId) {
      const entry = focus.entries.get(activeId);
      if (entry) {
        if (event.key === "pageup") entry.onScroll?.(-10);
        else if (event.key === "pagedown") entry.onScroll?.(10);
        else if (event.key === "up" && event.shift) entry.onScroll?.(-1);
        else if (event.key === "down" && event.shift) entry.onScroll?.(1);
        else if (event.key === "left") entry.onHScroll?.(-1);
        else if (event.key === "right") entry.onHScroll?.(1);
      }
    }
  }, [focus]);

  // Priority 1000 ensures the modal's focus trap runs before all other input handlers.
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
      { trap: true, direction: "vertical" },
      React.createElement(
        "tui-box",
        { flexDirection: "column" },
        ...contentChildren,
      ),
    ),
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Modal = Object.assign(ModalBase, {
  Root: ModalRoot,
  Title: ModalTitle,
  Body: ModalBody,
  Footer: ModalFooter,
});
