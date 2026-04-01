/**
 * useDialogBehavior — headless behavior hook for modal dialogs.
 *
 * Extracts visible state, focus trap, escape handling, and size
 * from the Modal and ConfirmDialog components.
 *
 * Returns state + props objects with no JSX.
 */

import { useRef, useCallback } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

export type DialogSize = "sm" | "md" | "lg" | "full";

const SIZE_WIDTHS: Record<string, number> = {
  sm: 30,
  md: 50,
  lg: 70,
};

export interface UseDialogBehaviorOptions {
  visible?: boolean;
  onClose?: () => void;
  size?: DialogSize;
  /** Focus trap priority (default 1000, matching Modal) */
  trapPriority?: number;
}

export interface UseDialogBehaviorResult {
  /** Whether the dialog is currently visible */
  isVisible: boolean;
  /** Show the dialog */
  show: () => void;
  /** Hide the dialog */
  hide: () => void;
  /** Resolved width based on size */
  resolvedWidth: number;
  /** Props for the dialog container (overlay) */
  dialogProps: {
    visible: boolean;
    role: string;
  };
  /** Props for the dialog content area */
  contentProps: {
    role: string;
  };
}

export function useDialogBehavior(options: UseDialogBehaviorOptions): UseDialogBehaviorResult {
  const {
    visible: visibleProp,
    onClose,
    size = "md",
    trapPriority = 1000,
  } = options;

  const { screen, focus } = useTui();
  const forceUpdate = useForceUpdate();

  // Support both controlled (visible prop) and uncontrolled modes
  const internalVisibleRef = useRef(false);
  const isControlled = visibleProp !== undefined;
  const effectiveVisible = isControlled ? visibleProp! : internalVisibleRef.current;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;

  const show = useCallback(() => {
    if (!isControlledRef.current) {
      internalVisibleRef.current = true;
      forceUpdate();
    }
  }, [forceUpdate]);

  const hide = useCallback(() => {
    if (!isControlledRef.current) {
      internalVisibleRef.current = false;
      forceUpdate();
    }
    onCloseRef.current?.();
  }, [forceUpdate]);

  // Focus trap handler: only consumes Escape and Tab.
  // All other keys pass through to child components (ScrollView, TextInput, Select, etc.)
  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === "escape") {
      event.consumed = true;
      if (!isControlledRef.current) {
        internalVisibleRef.current = false;
        forceUpdate();
      }
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
    // All other keys: do NOT set event.consumed — they propagate to normal
    // handlers (ScrollView keyboard scroll, TextInput, Select, etc.)
  }, [forceUpdate, focus]);

  useInput(handleInput, { isActive: effectiveVisible, priority: trapPriority });

  // Resolve width from size
  const resolvedWidth = size === "full"
    ? Math.max(1, screen.width - 4)
    : (SIZE_WIDTHS[size] ?? 50);

  return {
    isVisible: effectiveVisible,
    show,
    hide,
    resolvedWidth,
    dialogProps: {
      visible: effectiveVisible,
      role: "dialog",
    },
    contentProps: {
      role: "document",
    },
  };
}
