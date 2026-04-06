import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

export interface AccordionBehaviorSection {
  key: string;
  title: string;
}

export interface UseAccordionBehaviorOptions {
  sections: AccordionBehaviorSection[];
  activeKeys?: string[];
  onToggle?: (key: string) => void;
  exclusive?: boolean;
  isActive?: boolean;
}

export interface UseAccordionBehaviorResult {
  /** Keys of currently open sections */
  openKeys: string[];
  /** Index of the currently focused section header */
  focusedIndex: number;
  /** Toggle a section by key */
  toggle: (key: string) => void;
  /** Get props for a section by its key */
  getSectionProps: (key: string) => {
    isOpen: boolean;
    isFocused: boolean;
    onToggle: () => void;
    role: string;
    index: number;
  };
}

export function useAccordionBehavior(options: UseAccordionBehaviorOptions): UseAccordionBehaviorResult {
  const {
    sections,
    activeKeys = [],
    onToggle,
    exclusive = false,
    isActive,
  } = options;

  const forceUpdate = useForceUpdate();

  const focusedRef = useRef(0);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const exclusiveRef = useRef(exclusive);
  exclusiveRef.current = exclusive;
  const forceUpdateRef = useRef(forceUpdate);
  forceUpdateRef.current = forceUpdate;

  // Clamp focused index when sections shrink
  if (focusedRef.current >= sections.length) {
    focusedRef.current = Math.max(0, sections.length - 1);
  }

  const handleToggle = useCallback((sectionKey: string) => {
    const cb = onToggleRef.current;
    if (!cb) return;
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
      forceUpdateRef.current();
    } else if (event.key === "down") {
      focusedRef.current =
        focusedRef.current < currentSections.length - 1
          ? focusedRef.current + 1
          : 0;
      forceUpdateRef.current();
    } else if (event.key === "return" || event.key === "space") {
      const section = currentSections[focusedRef.current];
      if (section) {
        handleToggle(section.key);
      }
    }
  }, [handleToggle]);

  // Enable keyboard input when onToggle is provided and isActive is not explicitly false
  const keyboardActive = isActive !== undefined ? isActive : onToggle !== undefined;
  useInput(handleInput, { isActive: keyboardActive });

  const getSectionProps = useCallback((key: string) => {
    const index = sectionsRef.current.findIndex((s) => s.key === key);
    return {
      isOpen: activeKeys.includes(key),
      isFocused: index === focusedRef.current,
      onToggle: () => handleToggle(key),
      role: "region",
      index,
    };
  }, [activeKeys, handleToggle]);

  return {
    openKeys: activeKeys,
    focusedIndex: focusedRef.current,
    toggle: handleToggle,
    getSectionProps,
  };
}
