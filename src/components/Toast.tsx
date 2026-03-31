/**
 * Toast — single-line notification with auto-hide.
 *
 * Renders a colored notification based on type.
 * If durationMs > 0, auto-hides after the specified duration.
 * Uses eager timer registration with useCleanup.
 *
 * ToastContainer — manages a stack of toasts with auto-dismiss.
 */

import React, { useRef, createContext, useContext } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { createAnimation, tickAnimation, type AnimationRef } from "../utils/animate.js";
import { useColors } from "../hooks/useColors.js";
import type { StormColors } from "../theme/colors.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface ToastProps extends StormContainerStyleProps {
  message: string;
  type?: "info" | "success" | "warning" | "error";
  visible?: boolean;
  durationMs?: number;
  /** Called when the auto-hide timer fires. */
  onDismiss?: () => void;
  /** Enable slide-in entrance and dim-out exit animation (~120ms). */
  animated?: boolean;
  /** Custom render for the toast content. */
  renderContent?: (message: string, type: string, icon: string) => React.ReactNode;
}

export interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  durationMs?: number;
}

export interface ToastContainerProps extends StormContainerStyleProps {
  /** Stack of toast items to display. */
  toasts: ToastItem[];
  /** Position of the toast stack: "top" or "bottom" (default "bottom"). */
  position?: "top" | "bottom";
  /** Maximum number of visible toasts (default 3). */
  maxVisible?: number;
  /** Called when an individual toast auto-dismisses. */
  onDismiss?: (id: string) => void;
}

// ── Compound Component API ──────────────────────────────────────

export interface ToastQueueContextValue {
  toasts: ToastItem[];
  addToast: (toast: ToastItem) => void;
  removeToast: (id: string) => void;
}

export const ToastQueueContext = createContext<ToastQueueContextValue | null>(null);

export function useToastQueueContext(): ToastQueueContextValue {
  const ctx = useContext(ToastQueueContext);
  if (!ctx) throw new Error("Toast sub-components must be used inside Toast.Provider");
  return ctx;
}

export interface ToastProviderProps {
  maxVisible?: number;
  position?: "top" | "bottom";
  children: React.ReactNode;
}

function ToastProvider({ maxVisible = 5, position = "bottom", children }: ToastProviderProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const toastsRef = useRef<ToastItem[]>([]);

  const ctx: ToastQueueContextValue = {
    toasts: toastsRef.current,
    addToast: (toast: ToastItem) => {
      toastsRef.current = [...toastsRef.current, toast];
      requestRender();
    },
    removeToast: (id: string) => {
      toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
      requestRender();
    },
  };

  // Render visible toasts
  const visibleToasts = toastsRef.current.slice(-maxVisible);
  const toastElements = visibleToasts.map((item) =>
    React.createElement(Toast, {
      key: item.id,
      message: item.message,
      ...(item.type !== undefined ? { type: item.type } : {}),
      ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
      visible: true,
      onDismiss: () => {
        toastsRef.current = toastsRef.current.filter((t) => t.id !== item.id);
        requestRender();
      },
    }),
  );

  const orderedElements = position === "top" ? [...toastElements].reverse() : toastElements;

  return React.createElement(
    ToastQueueContext.Provider,
    { value: ctx },
    children,
    React.createElement("tui-box", { flexDirection: "column" }, ...orderedElements),
  );
}

export interface ToastCompoundItemProps {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  durationMs?: number;
}

function ToastCompoundItem({ id, message, type = "info", durationMs }: ToastCompoundItemProps): React.ReactElement | null {
  return React.createElement(Toast, {
    message,
    type,
    visible: true,
    ...(durationMs !== undefined ? { durationMs } : {}),
  });
}

// ── Recipe API (original) ───────────────────────────────────────

function getTypeColors(colors: StormColors): Record<string, string> {
  return {
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };
}

const TYPE_ICONS: Record<string, string> = {
  info: "\u25C6",    // ◆
  success: "\u2714", // ✔
  warning: "\u25B2", // ▲
  error: "\u2718",   // ✘
};

const ToastBase = React.memo(function Toast(rawProps: ToastProps): React.ReactElement | null {
  const props = usePluginProps("Toast", rawProps as unknown as Record<string, unknown>) as unknown as ToastProps;
  const personality = usePersonality();
  const {
    message,
    type = "info",
    visible: visibleProp = true,
    durationMs = 3000,
    onDismiss,
    animated = false,
  } = props;

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const { requestRender } = useTui();
  const hiddenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  // Animation state
  const entranceAnimRef = useRef<AnimationRef | null>(null);
  const exitAnimRef = useRef<AnimationRef | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const entranceProgressRef = useRef(animated ? 0 : 1);
  const exitProgressRef = useRef(0);
  const entranceStartedRef = useRef(false);

  // Start entrance animation on first render (when animated)
  if (animated && !entranceStartedRef.current && visibleProp && !hiddenRef.current) {
    entranceStartedRef.current = true;
    entranceAnimRef.current = createAnimation(0, 1, personality.animation.durationFast);
    entranceProgressRef.current = 0;

    if (animTimerRef.current) clearInterval(animTimerRef.current);
    animTimerRef.current = setInterval(() => {
      let needsRender = false;
      const entrance = entranceAnimRef.current;
      if (entrance) {
        entranceProgressRef.current = tickAnimation(entrance);
        needsRender = true;
        if (entrance.done) {
          entranceAnimRef.current = null;
          if (!exitAnimRef.current && animTimerRef.current) {
            clearInterval(animTimerRef.current);
            animTimerRef.current = null;
          }
        }
      }
      const exit = exitAnimRef.current;
      if (exit) {
        exitProgressRef.current = tickAnimation(exit);
        needsRender = true;
        if (exit.done) {
          exitAnimRef.current = null;
          hiddenRef.current = true;
          onDismissRef.current?.();
          if (animTimerRef.current) {
            clearInterval(animTimerRef.current);
            animTimerRef.current = null;
          }
        }
      }
      if (needsRender) requestRender();
    }, 16);
  }

  // Reset hidden state when message changes
  const prevMessageRef = useRef(message);
  if (prevMessageRef.current !== message) {
    prevMessageRef.current = message;
    hiddenRef.current = false;
    exitAnimRef.current = null;
    exitProgressRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startedRef.current = false;
    // Restart entrance animation for new message
    if (animated) {
      entranceStartedRef.current = false;
    }
  }

  // Start auto-hide timer eagerly if durationMs > 0
  if (durationMs > 0 && !startedRef.current && !hiddenRef.current) {
    startedRef.current = true;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (animated) {
        // Start exit animation (dim then disappear)
        exitAnimRef.current = createAnimation(0, 1, personality.animation.durationFast);
        exitProgressRef.current = 0;
        if (!animTimerRef.current) {
          animTimerRef.current = setInterval(() => {
            const exit = exitAnimRef.current;
            if (exit) {
              exitProgressRef.current = tickAnimation(exit);
              if (exit.done) {
                exitAnimRef.current = null;
                hiddenRef.current = true;
                onDismissRef.current?.();
                if (animTimerRef.current) {
                  clearInterval(animTimerRef.current);
                  animTimerRef.current = null;
                }
              }
              requestRender();
            }
          }, 16);
        }
      } else {
        hiddenRef.current = true;
        onDismissRef.current?.();
        requestRender();
      }
    }, durationMs);
  }

  useCleanup(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
  });

  if (!visibleProp || hiddenRef.current) {
    return null;
  }

  const colors = useColors();
  const typeColors = getTypeColors(colors);
  const color = typeColors[type] ?? colors.info;
  const icon = TYPE_ICONS[type] ?? "\u25C6";

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);
  const boxProps = mergeBoxStyles(
    { role: "status", flexDirection: "row" },
    userStyles,
  );

  // Apply entrance/exit visual effects
  const isEntering = animated && entranceAnimRef.current !== null && !entranceAnimRef.current.done;
  const isExiting = animated && exitAnimRef.current !== null && !exitAnimRef.current.done;

  const content = props.renderContent
    ? React.createElement("tui-box", boxProps, props.renderContent(message, type, icon))
    : React.createElement(
        "tui-box",
        boxProps,
        React.createElement("tui-text", { color, bold: true }, icon + " "),
        React.createElement("tui-text", { color }, message),
      );

  // During entrance: show dimmed, then brighten
  if (isEntering && entranceProgressRef.current < 0.5) {
    return React.createElement("tui-box", { dim: true }, content);
  }

  // During exit: dim content as it fades out
  if (isExiting) {
    return React.createElement("tui-box", { dim: true }, content);
  }

  return content;
});

/**
 * ToastContainer — manages a vertical stack of toasts.
 *
 * Displays up to `maxVisible` toasts, newest at the bottom.
 * Each toast auto-dismisses independently via its own durationMs.
 */
export const ToastContainer = React.memo(function ToastContainer(props: ToastContainerProps): React.ReactElement | null {
  const {
    toasts,
    position = "bottom",
    maxVisible = 3,
    onDismiss,
  } = props;

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  if (toasts.length === 0) {
    return null;
  }

  // Take only the last maxVisible toasts (newest at end)
  const visibleToasts = toasts.slice(-maxVisible);

  const toastElements = visibleToasts.map((item) =>
    React.createElement(Toast, {
      key: item.id,
      message: item.message,
      ...(item.type !== undefined ? { type: item.type } : {}),
      ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
      visible: true,
      ...(onDismiss ? { onDismiss: () => onDismiss(item.id) } : {}),
    }),
  );

  // Reverse order for "top" position so newest still appears closest to content
  const orderedElements = position === "top" ? [...toastElements].reverse() : toastElements;

  const boxProps = mergeBoxStyles(
    { flexDirection: "column" },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...orderedElements,
  );
});

// ── Static compound assignments ──────────────────���──────────────
export const Toast = Object.assign(ToastBase, {
  Provider: ToastProvider,
  Item: ToastCompoundItem,
});
