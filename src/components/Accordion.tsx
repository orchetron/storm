/**
 * Accordion — group of collapsible sections with keyboard navigation.
 *
 * Renders a list of titled sections that can be expanded/collapsed.
 * Up/Down arrows navigate between section headers, Enter/Space toggles.
 * Supports exclusive mode (only one section open at a time).
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";

import { useColors } from "../hooks/useColors.js";
import type { KeyEvent } from "../input/types.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { usePersonality } from "../core/personality.js";

export interface AccordionSection {
  title: string;
  content: React.ReactNode;
  key: string;
}

export interface AccordionProps extends StormContainerStyleProps {
  sections: AccordionSection[];
  activeKeys?: string[];
  onToggle?: (key: string) => void;
  exclusive?: boolean;
  /** Enable animated height transitions (~150ms). */
  animated?: boolean;
  /**
   * Whether the accordion captures keyboard input (default true).
   * When false, Up/Down/Enter/Space keys are not consumed — useful when
   * the Accordion is inside a ScrollView and should let scroll keys through
   * until the user explicitly focuses the Accordion.
   */
  isFocused?: boolean;
  /** Custom renderer for section headers. */
  renderSectionHeader?: (props: { key: string; title: string; expanded: boolean; focused: boolean }) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface AccordionContextValue {
  activeKeys: string[];
  toggle: (key: string) => void;
  exclusive: boolean;
}

export const AccordionContext = createContext<AccordionContextValue | null>(null);

export function useAccordionContext(): AccordionContextValue {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion sub-components must be used inside Accordion.Root");
  return ctx;
}

export interface AccordionSectionContextValue {
  sectionKey: string;
  isExpanded: boolean;
}

export const AccordionSectionContext = createContext<AccordionSectionContextValue | null>(null);

export function useAccordionSectionContext(): AccordionSectionContextValue {
  const ctx = useContext(AccordionSectionContext);
  if (!ctx) throw new Error("Accordion.Header/Content must be used inside Accordion.Section");
  return ctx;
}

export interface AccordionRootProps {
  activeKeys?: string[];
  onToggle?: (key: string) => void;
  exclusive?: boolean;
  children: React.ReactNode;
}

function AccordionRoot({ activeKeys = [], onToggle, exclusive = false, children }: AccordionRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  const ctx: AccordionContextValue = {
    activeKeys,
    toggle: (key: string) => { onToggleRef.current?.(key); requestRender(); },
    exclusive,
  };

  return React.createElement(
    AccordionContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface AccordionCompoundSectionProps {
  sectionKey: string;
  children: React.ReactNode;
}

function AccordionCompoundSection({ sectionKey, children }: AccordionCompoundSectionProps): React.ReactElement {
  const colors = useColors();
  const { activeKeys } = useAccordionContext();
  const isExpanded = activeKeys.includes(sectionKey);

  const sectionCtx: AccordionSectionContextValue = { sectionKey, isExpanded };

  return React.createElement(
    AccordionSectionContext.Provider,
    { value: sectionCtx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface AccordionCompoundHeaderProps {
  children?: React.ReactNode;
}

function AccordionCompoundHeader({ children }: AccordionCompoundHeaderProps): React.ReactElement {
  const colors = useColors();
  const { toggle } = useAccordionContext();
  const { sectionKey, isExpanded } = useAccordionSectionContext();
  const marker = isExpanded ? "\u25BC" : "\u25B6";

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color: colors.brand.primary }, `${marker} `),
    React.createElement("tui-text", { bold: true, color: colors.text.primary }, sectionKey),
  );
}

export interface AccordionCompoundContentProps {
  children: React.ReactNode;
}

function AccordionCompoundContent({ children }: AccordionCompoundContentProps): React.ReactElement | null {
  const { isExpanded } = useAccordionSectionContext();
  if (!isExpanded) return null;

  return React.createElement(
    "tui-box",
    { paddingLeft: 2 },
    children,
  );
}

// ── Recipe API (original) ───────────────────────────────────────

const COLLAPSED = "\u25B6"; // ▶
const EXPANDED = "\u25BC";  // ▼

const AccordionBase = React.memo(function Accordion(rawProps: AccordionProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Accordion", rawProps as unknown as Record<string, unknown>) as unknown as AccordionProps;
  const {
    sections,
    activeKeys = [],
    onToggle,
    exclusive = false,
    color = colors.brand.primary,
    animated = false,
    isFocused = true,
  } = props;

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  // Track focused section index
  const focusedRef = useRef(0);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const exclusiveRef = useRef(exclusive);
  exclusiveRef.current = exclusive;

  // Internal open sections for exclusive mode management
  const internalOpenRef = useRef<Set<string>>(new Set(activeKeys));
  internalOpenRef.current = new Set(activeKeys);

  const { requestRender, renderContext } = useTui();
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  // Animation state: track sections that are transitioning
  const prevActiveRef = useRef<Set<string>>(new Set(activeKeys));
  // Map of section key -> { expanding: boolean, progress: 0-1, timer }
  const transitionsRef = useRef<Map<string, { expanding: boolean; progress: number }>>(new Map());
  const unsubRef = useRef<(() => void) | null>(null);
  const transitionStartRef = useRef<Map<string, number>>(new Map());

  const TRANSITION_MS = personality.animation.durationNormal;

  if (animated) {
    const prevActive = prevActiveRef.current;
    const currentActive = new Set(activeKeys);

    // Detect newly expanded sections
    for (const key of currentActive) {
      if (!prevActive.has(key)) {
        transitionsRef.current.set(key, { expanding: true, progress: 0 });
        transitionStartRef.current.set(key, Date.now());
      }
    }

    // Detect newly collapsed sections
    for (const key of prevActive) {
      if (!currentActive.has(key)) {
        transitionsRef.current.set(key, { expanding: false, progress: 1 });
        transitionStartRef.current.set(key, Date.now());
      }
    }

    prevActiveRef.current = currentActive;

    // Run animation tick via scheduler if there are active transitions
    if (transitionsRef.current.size > 0 && !unsubRef.current) {
      unsubRef.current = renderContext.animationScheduler.add((_frameTime: number) => {
        const now = Date.now();
        let anyActive = false;
        for (const [key, tr] of transitionsRef.current) {
          const startTime = transitionStartRef.current.get(key) ?? now;
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / TRANSITION_MS);
          // easeOut: t * (2 - t)
          const eased = t * (2 - t);

          if (tr.expanding) {
            tr.progress = eased;
          } else {
            tr.progress = 1 - eased;
          }

          if (t < 1) {
            anyActive = true;
          } else {
            transitionsRef.current.delete(key);
            transitionStartRef.current.delete(key);
          }
        }
        if (!anyActive && unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
      });
    }
  }

  useCleanup(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  });

  const handleToggle = useCallback((sectionKey: string) => {
    const cb = onToggleRef.current;
    if (!cb) return;

    // In both exclusive and non-exclusive mode, just call onToggle once
    // with the target key. The parent is responsible for managing activeKeys
    // (e.g. setting activeKeys to just [newKey] in exclusive mode).
    cb(sectionKey);
  }, []);

  const handleInput = useCallback((event: KeyEvent) => {
    const currentSections = sectionsRef.current;
    if (currentSections.length === 0) return;

    if (event.key === "up") {
      focusedRef.current =
        focusedRef.current > 0
          ? focusedRef.current - 1
          : currentSections.length - 1;
      requestRenderRef.current();
    } else if (event.key === "down") {
      focusedRef.current =
        focusedRef.current < currentSections.length - 1
          ? focusedRef.current + 1
          : 0;
      requestRenderRef.current();
    } else if (event.key === "return" || event.key === "space") {
      const section = currentSections[focusedRef.current];
      if (section) {
        handleToggle(section.key);
      }
    }
  }, [handleToggle]);

  useInput(handleInput, { isActive: isFocused && onToggle !== undefined });

  // Clamp focused index when sections shrink
  focusedRef.current = Math.min(focusedRef.current, sections.length - 1);

  const elements: React.ReactElement[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const isExpanded = activeKeys.includes(section.key);
    const transition = transitionsRef.current.get(section.key);
    const isFocused = i === focusedRef.current;
    const marker = isExpanded || (transition && transition.expanding) ? EXPANDED : COLLAPSED;

    // Section header
    if (props.renderSectionHeader) {
      elements.push(
        React.createElement(
          "tui-box",
          { key: `header-${section.key}`, flexDirection: "row" },
          props.renderSectionHeader({ key: section.key, title: section.title, expanded: isExpanded, focused: isFocused }),
        ),
      );
    } else {
      elements.push(
        React.createElement(
          "tui-box",
          { key: `header-${section.key}`, flexDirection: "row" },
          React.createElement(
            "tui-text",
            { color },
            `${marker} `,
          ),
          React.createElement(
            "tui-text",
            {
              bold: isFocused,
              color: isFocused ? colors.text.primary : colors.text.secondary,
            },
            section.title,
          ),
        ),
      );
    }

    // Section content: show when expanded or during animated transition
    const showContent = isExpanded || (animated && transition !== undefined);
    if (showContent) {
      const contentProps: Record<string, unknown> = {
        key: `content-${section.key}`,
        paddingLeft: 2,
      };

      // During animation, limit visible height via maxHeight
      if (animated && transition) {
        // Use dim to visually indicate transition progress
        const dimming = transition.progress < 0.5;
        elements.push(
          React.createElement(
            "tui-box",
            contentProps,
            dimming
              ? React.createElement("tui-box", { dim: true }, section.content)
              : section.content,
          ),
        );
      } else {
        elements.push(
          React.createElement(
            "tui-box",
            contentProps,
            section.content,
          ),
        );
      }
    }
  }

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", role: "region" },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...elements,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Accordion = Object.assign(AccordionBase, {
  Root: AccordionRoot,
  Section: AccordionCompoundSection,
  Header: AccordionCompoundHeader,
  Content: AccordionCompoundContent,
});
