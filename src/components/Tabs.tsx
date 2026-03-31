/**
 * Tabs — horizontal/vertical tab bar with keyboard navigation.
 *
 * Active tab is bold + colored. Others are dim.
 * Left/Right arrows and number keys navigate. Calls onChange on tab switch.
 *
 * Features:
 *   - closable: per-tab close button, Delete/Backspace triggers onClose
 *   - disabled: per-tab disabled state, skipped by navigation
 *   - orientation: "horizontal" (default) or "vertical"
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import type { KeyEvent } from "../input/types.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { usePersonality } from "../core/personality.js";

export interface Tab {
  key: string;
  label: string;
  /** When true, show "x" after label. Delete/Backspace on active tab calls onClose. */
  closable?: boolean;
  /** When true, tab renders dimmed and is skipped by keyboard navigation. */
  disabled?: boolean;
}

export interface TabsProps extends StormLayoutStyleProps {
  tabs: Tab[];
  activeKey: string;
  onChange?: (key: string) => void;
  /** Called when a closable tab is closed (via Delete/Backspace). */
  onClose?: (key: string) => void;
  isFocused?: boolean;
  "aria-label"?: string;
  /** Layout orientation: "horizontal" (default) or "vertical". */
  orientation?: "horizontal" | "vertical";
  /** Custom renderer for each tab. */
  renderTab?: (tab: Tab, state: { isActive: boolean; isDisabled: boolean }) => React.ReactNode;
}

/**
 * Find the next navigable (non-disabled) tab index in a given direction.
 * Wraps around. Returns -1 if no navigable tabs exist.
 */
function findNextNavigable(tabs: Tab[], fromIndex: number, direction: 1 | -1): number {
  const len = tabs.length;
  if (len === 0) return -1;
  for (let step = 1; step <= len; step++) {
    const candidate = ((fromIndex + direction * step) % len + len) % len;
    if (!tabs[candidate]!.disabled) return candidate;
  }
  return -1;
}

// ── Compound Component API ──────────────────────────────────────

export interface TabsContextValue {
  activeKey: string;
  setActiveKey: (key: string) => void;
  orientation: "horizontal" | "vertical";
}

export const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs sub-components must be used inside Tabs.Root");
  return ctx;
}

export interface TabsRootProps {
  activeKey: string;
  onActiveKeyChange?: (key: string) => void;
  orientation?: "horizontal" | "vertical";
  children: React.ReactNode;
}

function TabsRoot({ activeKey, onActiveKeyChange, orientation = "horizontal", children }: TabsRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onChangeRef = useRef(onActiveKeyChange);
  onChangeRef.current = onActiveKeyChange;

  const ctx: TabsContextValue = {
    activeKey,
    setActiveKey: (key: string) => { onChangeRef.current?.(key); requestRender(); },
    orientation,
  };

  return React.createElement(TabsContext.Provider, { value: ctx }, children);
}

export interface TabsTriggerProps {
  tabKey: string;
  disabled?: boolean;
  closable?: boolean;
  children?: React.ReactNode;
  color?: string | number;
}

function TabsTrigger({ tabKey, disabled = false, closable = false, children, color: triggerColor }: TabsTriggerProps): React.ReactElement {
  const colors = useColors();
  const { activeKey, setActiveKey } = useTabsContext();
  const isActive = activeKey === tabKey;
  const effectiveColor = triggerColor ?? colors.brand.primary;

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const textProps: Record<string, unknown> = {};
  if (disabled) {
    textProps["dim"] = true;
    textProps["color"] = colors.text.disabled;
  } else if (isActive) {
    textProps["bold"] = true;
    textProps["color"] = effectiveColor;
  } else {
    textProps["dim"] = true;
  }

  const labelText = closable ? `[ ${tabKey} \u00D7 ]` : `[ ${tabKey} ]`;

  return React.createElement("tui-text", textProps, labelText);
}

export interface TabsPanelProps {
  tabKey: string;
  children: React.ReactNode;
}

function TabsPanel({ tabKey, children }: TabsPanelProps): React.ReactElement | null {
  const { activeKey } = useTabsContext();
  if (activeKey !== tabKey) return null;
  return React.createElement("tui-box", { flexDirection: "column" }, children);
}

// ── Recipe API (original) ───────────────────────────────────────

const TabsBase = React.memo(function Tabs(rawProps: TabsProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Tabs", rawProps as unknown as Record<string, unknown>) as unknown as TabsProps;
  const {
    tabs,
    activeKey,
    onChange,
    onClose,
    color = colors.brand.primary,
    isFocused = true,
    orientation = "horizontal",
  } = props;

  const layoutProps = pickStyleProps(props as unknown as Record<string, unknown>);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const handleInput = useCallback((event: KeyEvent) => {
    const currentTabs = tabsRef.current;
    const cb = onChangeRef.current;
    if (!cb || currentTabs.length === 0) return;

    const currentIndex = currentTabs.findIndex((t) => t.key === activeKeyRef.current);
    const idx = currentIndex >= 0 ? currentIndex : 0;

    // Navigation keys depend on orientation
    const prevKey = orientation === "vertical" ? "up" : "left";
    const nextKey = orientation === "vertical" ? "down" : "right";

    if (event.key === prevKey) {
      const next = findNextNavigable(currentTabs, idx, -1);
      if (next >= 0) cb(currentTabs[next]!.key);
    } else if (event.key === nextKey) {
      const next = findNextNavigable(currentTabs, idx, 1);
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

  useInput(handleInput, { isActive: isFocused !== false });

  const tabElements = tabs.map((tab) => {
    const isActive = tab.key === activeKey;
    const isDisabled = tab.disabled === true;

    if (props.renderTab) {
      return React.createElement(
        "tui-box",
        { key: tab.key, flexDirection: "row" },
        props.renderTab(tab, { isActive, isDisabled }),
      );
    }

    const tabProps: Record<string, unknown> = { key: tab.key };

    if (isDisabled) {
      tabProps["dim"] = true;
      tabProps["color"] = colors.text.disabled;
    } else if (isActive) {
      tabProps["bold"] = true;
      tabProps["color"] = color;
    } else {
      tabProps["dim"] = true;
    }

    const labelText = tab.closable
      ? `[ ${tab.label} \u00D7 ]`
      : `[ ${tab.label} ]`;

    return React.createElement(
      "tui-text",
      tabProps,
      labelText,
    );
  });

  // Add separators between tabs
  const children: React.ReactElement[] = [];
  for (let i = 0; i < tabElements.length; i++) {
    children.push(tabElements[i]!);
    if (i < tabElements.length - 1) {
      if (orientation === "vertical") {
        // No explicit separator needed in vertical — each tab is on its own row
      } else {
        children.push(
          React.createElement("tui-text", { key: `sep-${i}` }, " "),
        );
      }
    }
  }

  const outerBoxProps: Record<string, unknown> = {
    role: "tablist",
    flexDirection: orientation === "vertical" ? "column" : "row",
    "aria-label": props["aria-label"],
    ...layoutProps,
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...children,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Tabs = Object.assign(TabsBase, {
  Root: TabsRoot,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
});
