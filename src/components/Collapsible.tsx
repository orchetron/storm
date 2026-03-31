/**
 * Collapsible — expand/collapse section with title.
 *
 * Renders a titled section that can be toggled between expanded
 * and collapsed states. Uses triangular markers for state indication.
 */

import React, { useCallback, useRef, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import type { KeyEvent } from "../input/types.js";
import { useColors } from "../hooks/useColors.js";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { createAnimation, tickAnimation, type AnimationRef } from "../utils/animate.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface CollapsibleProps extends StormContainerStyleProps {
  title: string;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  children?: React.ReactNode;
  /** When true, briefly dims content as a visual hint during collapse transitions. */
  animated?: boolean;
  /** Override the hint text shown when collapsed (from personality.interaction.collapseHint). */
  collapseHint?: string;
  /** Custom renderer for the collapsible header. */
  renderHeader?: (props: { expanded: boolean; title: string }) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface CollapsibleContextValue {
  expanded: boolean;
  toggle: () => void;
}

export const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

export function useCollapsibleContext(): CollapsibleContextValue {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error("Collapsible sub-components must be used inside Collapsible.Root");
  return ctx;
}

export interface CollapsibleRootProps {
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleRoot({ expanded: expandedProp, onToggle, children }: CollapsibleRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const internalExpandedRef = useRef(false);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : internalExpandedRef.current;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  const ctx: CollapsibleContextValue = {
    expanded,
    toggle: () => {
      const next = !expandedRef.current;
      onToggleRef.current?.(next);
      if (!isControlled) {
        internalExpandedRef.current = next;
        requestRender();
      }
    },
  };

  return React.createElement(
    CollapsibleContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface CollapsibleCompoundHeaderProps {
  children?: React.ReactNode;
  title?: string;
}

function CollapsibleCompoundHeader({ children, title }: CollapsibleCompoundHeaderProps): React.ReactElement {
  const colors = useColors();
  const { expanded } = useCollapsibleContext();
  const marker = expanded ? "\u25BE" : "\u25B8";

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color: colors.brand.primary }, `${marker} `),
    React.createElement("tui-text", { bold: true }, title ?? ""),
  );
}

export interface CollapsibleCompoundContentProps {
  children: React.ReactNode;
}

function CollapsibleCompoundContent({ children }: CollapsibleCompoundContentProps): React.ReactElement | null {
  const { expanded } = useCollapsibleContext();
  if (!expanded) return null;

  return React.createElement("tui-box", { paddingLeft: 2 }, children);
}

// ���─ Recipe API (original) ─────��─────────────────────────────────

const COLLAPSED = "\u25B8"; // ▸
const EXPANDED = "\u25BE"; // ▾

const CollapsibleBase = React.memo(function Collapsible(rawProps: CollapsibleProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Collapsible", rawProps as unknown as Record<string, unknown>) as unknown as CollapsibleProps;
  const personality = usePersonality();

  const {
    title,
    onToggle,
    color = personality.colors.brand.primary,
    children,
    animated = false,
    collapseHint = personality.interaction.collapseHint,
  } = props;

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  // Internal state for uncontrolled mode (useRef + requestRender instead of useState)
  const internalExpandedRef = useRef(false);

  // Use controlled value if provided, otherwise internal state
  const isControlled = props.expanded !== undefined;
  const expanded = isControlled ? props.expanded! : internalExpandedRef.current;

  // Refs to avoid stale closures in handleInput callback
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  // Animation support: progressive reveal/hide using AnimationScheduler
  const { requestRender, renderContext } = useTui();
  const prevExpandedRef = useRef(expanded);
  const animRefObj = useRef<AnimationRef | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const progressRef = useRef(expanded ? 1 : 0);

  if (animated && expanded !== prevExpandedRef.current) {
    prevExpandedRef.current = expanded;

    // Start transition animation: 0->1 for expand, 1->0 for collapse
    const from = progressRef.current;
    const to = expanded ? 1 : 0;
    animRefObj.current = createAnimation(from, to, 150);

    // Remove previous scheduler callback
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    unsubRef.current = renderContext.animationScheduler.add(() => {
      const anim = animRefObj.current;
      if (!anim) return;

      const val = tickAnimation(anim);
      progressRef.current = val;

      if (anim.done) {
        animRefObj.current = null;
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
      }
    });
  } else if (!animated) {
    prevExpandedRef.current = expanded;
    progressRef.current = expanded ? 1 : 0;
  }

  useCleanup(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  });

  const handleInput = useCallback(
    (event: KeyEvent) => {
      if (event.key === "return" || event.key === "space") {
        const next = !expandedRef.current;
        if (onToggleRef.current) {
          onToggleRef.current(next);
        }
        if (!isControlledRef.current) {
          internalExpandedRef.current = next;
          requestRender();
        }
      }
    },
    [],
  );

  // Only handle input if onToggle is provided (interactive mode)
  useInput(handleInput, { isActive: onToggle !== undefined });

  const marker = expanded ? EXPANDED : COLLAPSED;

  const elements: React.ReactElement[] = [];

  // Header line: marker + bold title + collapse hint when collapsed
  if (props.renderHeader) {
    elements.push(
      React.createElement(
        "tui-box",
        { key: "__header", flexDirection: "row" },
        props.renderHeader({ expanded, title }),
      ),
    );
  } else {
    const hintElement = !expanded && collapseHint && onToggle
      ? React.createElement(
          "tui-text",
          { dim: true, color: personality.colors.text.dim },
          `  (${collapseHint})`,
        )
      : null;

    elements.push(
      React.createElement(
        "tui-box",
        { key: "__header", flexDirection: "row" },
        React.createElement(
          "tui-text",
          { color },
          `${marker} `,
        ),
        React.createElement(
          "tui-text",
          { bold: true },
          title,
        ),
        ...(hintElement ? [hintElement] : []),
      ),
    );
  }

  // Content (indented, only when expanded or during animated transition)
  const transitioning = animated && animRefObj.current !== null && !animRefObj.current.done;
  const showContent = (expanded && children !== undefined) || (transitioning && children !== undefined);
  if (showContent) {
    const dimming = animated && progressRef.current < 0.5;
    elements.push(
      React.createElement(
        "tui-box",
        { key: "__content", paddingLeft: 2 },
        dimming
          ? React.createElement("tui-box", { dim: true }, children)
          : children,
      ),
    );
  }

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", role: "group" },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...elements,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Collapsible = Object.assign(CollapsibleBase, {
  Root: CollapsibleRoot,
  Header: CollapsibleCompoundHeader,
  Content: CollapsibleCompoundContent,
});
