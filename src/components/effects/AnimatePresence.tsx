import React, { useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface AnimatePresenceProps {
  children: React.ReactNode;
  /** Animation type for exiting children (default: "fade"). */
  exitType?: "fade" | "slide-up" | "collapse";
  /** Duration of the exit animation in milliseconds. */
  exitDuration?: number;
}

interface ExitingChild {
  element: React.ReactElement;
  timer: ReturnType<typeof setTimeout>;
}

export const AnimatePresence = React.memo(function AnimatePresence(
  rawProps: AnimatePresenceProps,
): React.ReactElement {
  const props = usePluginProps("AnimatePresence", rawProps);

  const personality = usePersonality();
  const {
    children,
    exitType = "fade",
    exitDuration = personality.animation.durationNormal,
  } = props;

  const { requestRender } = useTui();
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  const prevChildrenRef = useRef<Map<string, React.ReactElement>>(new Map());
  const exitingRef = useRef<Map<string, ExitingChild>>(new Map());

  // ── Build current children map ────────────────────────────────

  const currentChildren = new Map<string, React.ReactElement>();
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.key == null) return;
    currentChildren.set(String(child.key), child);
  });

  // ── Detect exiting children ───────────────────────────────────

  const prevKeys = prevChildrenRef.current;

  for (const [key, element] of prevKeys) {
    if (!currentChildren.has(key) && !exitingRef.current.has(key)) {
      // Child was removed — schedule exit animation
      const reducedMotion = personality.animation.reducedMotion;
      const duration = reducedMotion ? 0 : exitDuration;

      const timer = setTimeout(() => {
        exitingRef.current.delete(key);
        requestRenderRef.current();
      }, duration);

      exitingRef.current.set(key, { element, timer });
    }
  }

  // If a previously-exiting child reappears, cancel exit
  for (const [key, exiting] of exitingRef.current) {
    if (currentChildren.has(key)) {
      clearTimeout(exiting.timer);
      exitingRef.current.delete(key);
    }
  }

  prevChildrenRef.current = currentChildren;

  // ── Cleanup timers on unmount ─────────────────────────────────

  useCleanup(() => {
    for (const exiting of exitingRef.current.values()) {
      clearTimeout(exiting.timer);
    }
    exitingRef.current.clear();
  });

  // ── Compose output: current children + exiting children ───────

  const output: React.ReactElement[] = [];

  // Current (live) children in their original order
  for (const [key, child] of currentChildren) {
    output.push(child);
  }

  // Exiting children — wrap in a dim/slide/collapse wrapper
  for (const [key, { element }] of exitingRef.current) {
    const wrapperProps: Record<string, unknown> = {};

    if (exitType === "fade") {
      wrapperProps.dim = true;
    } else if (exitType === "slide-up") {
      // Slide up by setting a negative marginTop effect via dim
      wrapperProps.dim = true;
      wrapperProps.marginTop = -1;
    } else if (exitType === "collapse") {
      wrapperProps.height = 0;
      wrapperProps.overflow = "hidden";
    }

    output.push(
      React.createElement(
        "tui-box",
        { key: `__exit_${key}`, ...wrapperProps },
        element,
      ),
    );
  }

  return React.createElement("tui-box", {}, ...output);
});
