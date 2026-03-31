/**
 * useCollapsibleBehavior — headless behavior hook for collapsible sections.
 *
 * Extracts expanded state, toggle, controlled/uncontrolled modes,
 * and animation state from the Collapsible component.
 *
 * Returns state + props objects with no JSX.
 */

import { useRef, useCallback } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../useInput.js";
import { useCleanup } from "../useCleanup.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

export interface UseCollapsibleBehaviorOptions {
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  isActive?: boolean;
  animated?: boolean;
}

export interface UseCollapsibleBehaviorResult {
  /** Whether the section is currently expanded */
  expanded: boolean;
  /** Toggle the expanded state */
  toggle: () => void;
  /** Animation progress (0 = collapsed, 1 = expanded) */
  animationProgress: number;
  /** Whether an animation is currently in progress */
  isAnimating: boolean;
  /** Props for the header/trigger element */
  headerProps: {
    onToggle: () => void;
    role: string;
    expanded: boolean;
  };
  /** Props for the content element */
  contentProps: {
    visible: boolean;
    role: string;
  };
}

export function useCollapsibleBehavior(options: UseCollapsibleBehaviorOptions): UseCollapsibleBehaviorResult {
  const {
    expanded: expandedProp,
    onToggle,
    isActive,
    animated = false,
  } = options;

  const { renderContext } = useTui();
  const forceUpdate = useForceUpdate();

  // Internal state for uncontrolled mode
  const internalExpandedRef = useRef(false);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp! : internalExpandedRef.current;

  // Refs to avoid stale closures
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  // Animation state
  const prevExpandedRef = useRef(expanded);
  const progressRef = useRef(expanded ? 1 : 0);
  const animatingRef = useRef(false);
  const animStartRef = useRef(0);
  const unsubRef = useRef<(() => void) | null>(null);

  const TRANSITION_MS = 150;

  if (animated && expanded !== prevExpandedRef.current) {
    prevExpandedRef.current = expanded;
    animatingRef.current = true;
    animStartRef.current = Date.now();

    // Remove previous scheduler callback
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    unsubRef.current = renderContext.animationScheduler.add(() => {
      const elapsed = Date.now() - animStartRef.current;
      const t = Math.min(1, elapsed / TRANSITION_MS);
      // easeOut: t * (2 - t)
      const eased = t * (2 - t);

      if (expanded) {
        progressRef.current = eased;
      } else {
        progressRef.current = 1 - eased;
      }

      if (t >= 1) {
        animatingRef.current = false;
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
      }
    });
  } else if (!animated) {
    prevExpandedRef.current = expanded;
    progressRef.current = expanded ? 1 : 0;
    animatingRef.current = false;
  }

  useCleanup(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  });

  const toggle = useCallback(() => {
    const next = !expandedRef.current;
    if (onToggleRef.current) {
      onToggleRef.current(next);
    }
    if (!isControlledRef.current) {
      internalExpandedRef.current = next;
      forceUpdate();
    }
  }, [forceUpdate]);

  const handleInput = useCallback(
    (event: KeyEvent) => {
      if (event.key === "return" || event.key === "space") {
        toggle();
      }
    },
    [toggle],
  );

  // Enable keyboard input when onToggle is provided and isActive is not explicitly false
  const keyboardActive = isActive !== undefined ? isActive : onToggle !== undefined;
  useInput(handleInput, { isActive: keyboardActive });

  // Content is visible when expanded or during transition
  const showContent = expanded || (animated && animatingRef.current);

  return {
    expanded,
    toggle,
    animationProgress: progressRef.current,
    isAnimating: animatingRef.current,
    headerProps: {
      onToggle: toggle,
      role: "button",
      expanded,
    },
    contentProps: {
      visible: showContent,
      role: "region",
    },
  };
}
