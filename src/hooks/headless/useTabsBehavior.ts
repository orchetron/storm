import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import type { KeyEvent } from "../../input/types.js";
import { findNextNavigable as findNextNav } from "../../utils/navigation.js";

export interface TabBehaviorItem {
  key: string;
  label: string;
  closable?: boolean;
  disabled?: boolean;
}

export interface UseTabsBehaviorOptions {
  tabs: TabBehaviorItem[];
  activeKey: string;
  onChange?: (key: string) => void;
  onClose?: (key: string) => void;
  isActive?: boolean;
  orientation?: "horizontal" | "vertical";
}

export interface UseTabsBehaviorResult {
  /** The currently active tab key */
  activeKey: string;
  /** Set the active tab key (calls onChange) */
  setActiveKey: (key: string) => void;
  /** Get props for a tab trigger element */
  getTriggerProps: (key: string) => {
    isActive: boolean;
    isDisabled: boolean;
    isClosable: boolean;
    onSelect: () => void;
    role: string;
  };
  /** Get props for a tab panel element */
  getPanelProps: (key: string) => {
    isActive: boolean;
    role: string;
    hidden: boolean;
  };
}

function findNextTab(tabs: TabBehaviorItem[], fromIndex: number, direction: 1 | -1): number {
  return findNextNav(tabs.length, fromIndex, direction, (i) => !tabs[i]!.disabled, -1);
}

export function useTabsBehavior(options: UseTabsBehaviorOptions): UseTabsBehaviorResult {
  const {
    tabs,
    activeKey,
    onChange,
    onClose,
    isActive = true,
    orientation = "horizontal",
  } = options;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const setActiveKey = useCallback((key: string) => {
    onChangeRef.current?.(key);
  }, []);

  const handleInput = useCallback((event: KeyEvent) => {
    const currentTabs = tabsRef.current;
    const cb = onChangeRef.current;
    if (!cb || currentTabs.length === 0) return;

    const currentIndex = currentTabs.findIndex((t) => t.key === activeKeyRef.current);
    const idx = currentIndex >= 0 ? currentIndex : 0;

    const prevKey = orientation === "vertical" ? "up" : "left";
    const nextKey = orientation === "vertical" ? "down" : "right";

    if (event.key === prevKey) {
      const next = findNextTab(currentTabs, idx, -1);
      if (next >= 0) cb(currentTabs[next]!.key);
    } else if (event.key === nextKey) {
      const next = findNextTab(currentTabs, idx, 1);
      if (next >= 0) cb(currentTabs[next]!.key);
    } else if (event.char && /^[1-9]$/.test(event.char)) {
      const numIdx = parseInt(event.char, 10) - 1;
      if (numIdx < currentTabs.length && !currentTabs[numIdx]!.disabled) {
        cb(currentTabs[numIdx]!.key);
      }
    } else if ((event.key === "delete" || event.key === "backspace") && onCloseRef.current) {
      const activeTab = currentTabs[idx];
      if (activeTab && activeTab.closable) {
        onCloseRef.current(activeTab.key);
      }
    }
  }, [orientation]);

  useInput(handleInput, { isActive });

  const getTriggerProps = useCallback((key: string) => {
    const tab = tabsRef.current.find((t) => t.key === key);
    return {
      isActive: key === activeKeyRef.current,
      isDisabled: tab?.disabled === true,
      isClosable: tab?.closable === true,
      onSelect: () => {
        if (tab && !tab.disabled) {
          onChangeRef.current?.(key);
        }
      },
      role: "tab",
    };
  }, []);

  const getPanelProps = useCallback((key: string) => {
    const isActivePanel = key === activeKeyRef.current;
    return {
      isActive: isActivePanel,
      role: "tabpanel",
      hidden: !isActivePanel,
    };
  }, []);

  return {
    activeKey,
    setActiveKey,
    getTriggerProps,
    getPanelProps,
  };
}
