/**
 * TabbedContent — tabbed container with content panels.
 *
 * Renders a tab bar at the top with keyboard navigation (left/right arrows),
 * and displays the content panel matching the active tab key.
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import type { KeyEvent } from "../input/types.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface TabbedContentProps extends StormContainerStyleProps {
  tabs: Array<{ label: string; key: string }>;
  activeKey: string;
  onTabChange?: (key: string) => void;
  children: React.ReactNode;
  tabColor?: string | number;
  activeTabColor?: string | number;
  /**
   * Whether the TabbedContent captures keyboard input (default true).
   * When false, Left/Right arrow keys and number keys are not consumed —
   * useful when nested inside a Modal or another component that manages focus.
   */
  isFocused?: boolean;
}

// ── Compound Component API ──────────────────────────────────────

export interface TabbedContentContextValue {
  activeKey: string;
  setActiveKey: (key: string) => void;
  tabColor: string | number;
  activeTabColor: string | number;
}

export const TabbedContentContext = createContext<TabbedContentContextValue | null>(null);

export function useTabbedContentContext(): TabbedContentContextValue {
  const ctx = useContext(TabbedContentContext);
  if (!ctx) throw new Error("TabbedContent sub-components must be used inside TabbedContent.Root");
  return ctx;
}

export interface TabbedContentRootProps {
  activeKey: string;
  onTabChange?: (key: string) => void;
  tabColor?: string | number;
  activeTabColor?: string | number;
  children: React.ReactNode;
}

function TabbedContentRoot({
  activeKey,
  onTabChange,
  tabColor: tabColorProp,
  activeTabColor: activeTabColorProp,
  children,
}: TabbedContentRootProps): React.ReactElement {
  const colors = useColors();
  const tabColor = tabColorProp ?? colors.text.dim;
  const activeTabColor = activeTabColorProp ?? colors.brand.primary;
  const { requestRender } = useTui();
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  const ctx: TabbedContentContextValue = {
    activeKey,
    setActiveKey: (key: string) => { onTabChangeRef.current?.(key); requestRender(); },
    tabColor,
    activeTabColor,
  };

  return React.createElement(
    TabbedContentContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface TabbedContentTabProps {
  tabKey: string;
  label?: string;
  children?: React.ReactNode;
}

function TabbedContentTab({ tabKey, label, children }: TabbedContentTabProps): React.ReactElement {
  const colors = useColors();
  const { activeKey, tabColor, activeTabColor } = useTabbedContentContext();
  const isActive = tabKey === activeKey;

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const textProps: Record<string, unknown> = {};
  if (isActive) {
    textProps["bold"] = true;
    textProps["color"] = activeTabColor;
  } else {
    textProps["color"] = tabColor;
    textProps["dim"] = true;
  }

  return React.createElement("tui-text", textProps, `[ ${label ?? tabKey} ]`);
}

export interface TabbedContentPanelProps {
  tabKey: string;
  children: React.ReactNode;
}

function TabbedContentPanel({ tabKey, children }: TabbedContentPanelProps): React.ReactElement | null {
  const { activeKey } = useTabbedContentContext();
  if (tabKey !== activeKey) return null;

  return React.createElement("tui-box", {}, children);
}

// ── Recipe API (original) ───────────────────────────────────────

const TabbedContentBase = React.memo(function TabbedContent(rawProps: TabbedContentProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("TabbedContent", rawProps as unknown as Record<string, unknown>) as unknown as TabbedContentProps;
  const {
    tabs,
    activeKey,
    onTabChange,
    children,
    tabColor = colors.text.dim,
    activeTabColor = colors.brand.primary,
    isFocused = true,
  } = props;

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const handleInput = useCallback((event: KeyEvent) => {
    // Only handle arrows when this TabbedContent is focused.
    // This prevents nested TabbedContent from having the outer one
    // always consume Left/Right arrow keys.
    if (!isFocusedRef.current) return;

    const currentTabs = tabsRef.current;
    const cb = onTabChangeRef.current;
    if (!cb || currentTabs.length === 0) return;

    const currentIndex = currentTabs.findIndex((t) => t.key === activeKeyRef.current);
    const idx = currentIndex >= 0 ? currentIndex : 0;

    // Tab switching uses Left/Right arrows only.
    // Tab key is reserved for focus management (handled by FocusManager).
    if (event.key === "left") {
      const next = idx > 0 ? idx - 1 : currentTabs.length - 1;
      cb(currentTabs[next]!.key);
    } else if (event.key === "right") {
      const next = idx < currentTabs.length - 1 ? idx + 1 : 0;
      cb(currentTabs[next]!.key);
    } else if (event.char && /^[1-9]$/.test(event.char)) {
      // Number keys (1-9) for direct tab selection
      const numIdx = parseInt(event.char, 10) - 1;
      if (numIdx < currentTabs.length) {
        cb(currentTabs[numIdx]!.key);
      }
    }
  }, []);

  useInput(handleInput, { isActive: isFocused && onTabChange !== undefined });

  // Build tab bar
  const tabElements: React.ReactElement[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i]!;
    const isActive = tab.key === activeKey;

    if (i > 0) {
      tabElements.push(
        React.createElement("tui-text", { key: `sep-${i}` }, " "),
      );
    }

    const textProps: Record<string, unknown> = { key: tab.key };
    if (isActive) {
      textProps["bold"] = true;
      textProps["color"] = activeTabColor;
    } else {
      textProps["color"] = tabColor;
      textProps["dim"] = true;
    }

    tabElements.push(
      React.createElement("tui-text", textProps, `[ ${tab.label} ]`),
    );
  }

  const tabBar = React.createElement(
    "tui-box",
    { key: "__tab-bar", flexDirection: "row" },
    ...tabElements,
  );

  // Find active content panel.
  // Use a raw flat array instead of React.Children.toArray() to preserve
  // positional slots for falsy children (e.g. `{false && <Panel />}`).
  // toArray() strips nulls/booleans which shifts indices and breaks the
  // tabs-to-children index mapping.
  const childArray = Array.isArray(children) ? children.flat() : [children];
  const activeIndex = tabs.findIndex((t) => t.key === activeKey);
  const activeContent = activeIndex >= 0 ? childArray[activeIndex] ?? null : null;

  const contentBox = React.createElement(
    "tui-box",
    { key: "__content" },
    activeContent,
  );

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", role: "tabpanel" },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    tabBar,
    contentBox,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const TabbedContent = Object.assign(TabbedContentBase, {
  Root: TabbedContentRoot,
  Tab: TabbedContentTab,
  Panel: TabbedContentPanel,
});
