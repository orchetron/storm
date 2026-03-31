/**
 * Menu — vertical menu with keyboard navigation.
 *
 * Renders items vertically with an active indicator.
 * Supports shortcuts, separators, disabled items, icons, and nested submenus.
 * Up/Down arrows navigate (skipping separators and disabled), Enter selects.
 * Right arrow opens submenu, Left arrow / Escape returns to parent.
 * Pressing a shortcut key fires onSelect for the matching item.
 *
 * Features:
 * - Nested submenus via `children` field
 * - Optional `icon` field rendered before label
 * - `maxVisible` prop with scroll window for long menus
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import type { KeyEvent } from "../input/types.js";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { usePersonality } from "../core/personality.js";

export interface MenuItem {
  label: string;
  value: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  /** Optional icon rendered before the label. */
  icon?: string;
  /** Submenu items. Right arrow opens, Left arrow / Escape closes. */
  children?: MenuItem[];
}

export interface MenuProps extends StormLayoutStyleProps {
  items: MenuItem[];
  onSelect?: (value: string) => void;
  isFocused?: boolean;
  activeColor?: string | number;
  /** Max visible items. Scrolls when items exceed this. */
  maxVisible?: number;
  "aria-label"?: string;
  /** Custom renderer for each menu item. */
  renderItem?: (item: MenuItem, state: { isActive: boolean; isDisabled: boolean; hasSubmenu: boolean }) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface MenuContextValue {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onSelect: ((value: string) => void) | undefined;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenuContext(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("Menu sub-components must be used inside Menu.Root");
  return ctx;
}

export interface MenuRootProps {
  onSelect?: (value: string) => void;
  children: React.ReactNode;
}

function MenuRoot({ onSelect, children }: MenuRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const activeIndexRef = useRef(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const ctx: MenuContextValue = {
    activeIndex: activeIndexRef.current,
    setActiveIndex: (idx: number) => { activeIndexRef.current = idx; requestRender(); },
    onSelect,
  };

  return React.createElement(
    MenuContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface MenuCompoundItemProps {
  value: string;
  label?: string;
  disabled?: boolean;
  icon?: string;
  shortcut?: string;
  children?: React.ReactNode;
}

function MenuCompoundItem({ value, label, disabled = false, icon, shortcut, children }: MenuCompoundItemProps): React.ReactElement {
  const colors = useColors();
  const { onSelect } = useMenuContext();
  const displayLabel = label ?? value;
  const iconPrefix = icon ? `${icon} ` : "";

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const elements: React.ReactElement[] = [
    React.createElement(
      "tui-text",
      {
        key: "label",
        color: disabled ? colors.text.disabled : colors.text.primary,
        dim: disabled,
        strikethrough: disabled,
      },
      `  ${iconPrefix}${displayLabel}`,
    ),
  ];

  if (shortcut) {
    elements.push(
      React.createElement("tui-text", { key: "shortcut", color: colors.text.dim }, `  ${shortcut}`),
    );
  }

  return React.createElement("tui-box", { flexDirection: "row" }, ...elements);
}

export interface MenuSeparatorProps {
  children?: React.ReactNode;
}

function MenuSeparator({ children }: MenuSeparatorProps): React.ReactElement {
  const colors = useColors();
  if (children) {
    return React.createElement("tui-box", {}, children);
  }

  return React.createElement(
    "tui-text",
    { color: colors.divider, dim: true },
    `  \u2500\u2500\u2500`,
  );
}

export interface MenuSubmenuProps {
  label: string;
  icon?: string;
  children: React.ReactNode;
}

function MenuSubmenu({ label, icon, children }: MenuSubmenuProps): React.ReactElement {
  const colors = useColors();
  const iconPrefix = icon ? `${icon} ` : "";

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    React.createElement(
      "tui-box",
      { flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: colors.text.primary },
        `  ${iconPrefix}${label}`,
      ),
      React.createElement("tui-text", { color: colors.text.dim }, ` \u25B6`),
    ),
    React.createElement("tui-box", { paddingLeft: 2 }, children),
  );
}

// ── Recipe API (original) ───────────────────────────────────────

const INDICATOR = "\u25B8"; // ▸
const SEPARATOR_LINE = "\u2500\u2500\u2500";
const SUBMENU_ARROW = "\u25B6"; // ▶

function isNavigable(item: MenuItem): boolean {
  return !item.separator && !item.disabled;
}

function findNextNavigable(items: MenuItem[], from: number, direction: 1 | -1): number {
  const len = items.length;
  let idx = from;
  for (let i = 0; i < len; i++) {
    idx = (idx + direction + len) % len;
    if (isNavigable(items[idx]!)) return idx;
  }
  return from;
}

function findFirstNavigable(items: MenuItem[]): number {
  for (let i = 0; i < items.length; i++) {
    if (isNavigable(items[i]!)) return i;
  }
  return 0;
}

const MenuBase = React.memo(function Menu(rawProps: MenuProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Menu", rawProps as unknown as Record<string, unknown>) as unknown as MenuProps;
  const {
    items,
    onSelect,
    isFocused = true,
    color = colors.text.primary,
    activeColor = colors.brand.primary,
    width,
    height,
    margin,
    marginX,
    marginY,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    minWidth,
    maxWidth,
    maxVisible,
  } = props;

  const { requestRender } = useTui();
  const activeIndexRef = useRef(findFirstNavigable(items));

  // Submenu navigation stack: array of { parentItems, parentIndex }
  // currentItems / currentActiveIndex represent the currently active level
  const submenuStackRef = useRef<Array<{ items: MenuItem[]; activeIndex: number }>>([]);
  const currentItemsRef = useRef(items);
  const subActiveIndexRef = useRef(findFirstNavigable(items));

  // Refs for latest prop values
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Sync root items when props change
  if (submenuStackRef.current.length === 0) {
    currentItemsRef.current = items;
  }

  // Clamp active index if items changed
  const currentItems = currentItemsRef.current;
  const activeRef = submenuStackRef.current.length === 0 ? activeIndexRef : subActiveIndexRef;

  if (activeRef.current >= currentItems.length) {
    activeRef.current = findFirstNavigable(currentItems);
  }
  if (currentItems[activeRef.current] && !isNavigable(currentItems[activeRef.current]!)) {
    activeRef.current = findNextNavigable(currentItems, activeRef.current, 1);
  }

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const itms = currentItemsRef.current;
      const cb = onSelectRef.current;
      const aRef = submenuStackRef.current.length === 0 ? activeIndexRef : subActiveIndexRef;

      if (event.key === "up") {
        aRef.current = findNextNavigable(itms, aRef.current, -1);
        requestRender();
      } else if (event.key === "down") {
        aRef.current = findNextNavigable(itms, aRef.current, 1);
        requestRender();
      } else if (event.key === "return") {
        const item = itms[aRef.current];
        if (item && isNavigable(item)) {
          // If item has children, open submenu
          if (item.children && item.children.length > 0) {
            submenuStackRef.current.push({ items: itms, activeIndex: aRef.current });
            currentItemsRef.current = item.children;
            subActiveIndexRef.current = findFirstNavigable(item.children);
            requestRender();
          } else if (cb) {
            cb(item.value);
          }
        }
      } else if (event.key === "right") {
        // Open submenu if current item has children
        const item = itms[aRef.current];
        if (item && item.children && item.children.length > 0 && isNavigable(item)) {
          submenuStackRef.current.push({ items: itms, activeIndex: aRef.current });
          currentItemsRef.current = item.children;
          subActiveIndexRef.current = findFirstNavigable(item.children);
          requestRender();
        }
      } else if (event.key === "left" || event.key === "escape") {
        // Return to parent menu
        if (submenuStackRef.current.length > 0) {
          const parent = submenuStackRef.current.pop()!;
          currentItemsRef.current = parent.items;
          if (submenuStackRef.current.length === 0) {
            activeIndexRef.current = parent.activeIndex;
          } else {
            subActiveIndexRef.current = parent.activeIndex;
          }
          requestRender();
        }
      } else if (event.char) {
        // Check if pressed key matches any item's shortcut
        for (const item of itms) {
          if (
            item.shortcut &&
            !item.disabled &&
            !item.separator &&
            item.shortcut.toLowerCase() === event.char.toLowerCase()
          ) {
            cb?.(item.value);
            break;
          }
        }
      }
    },
    [],
  );

  useInput(handleInput, { isActive: isFocused });

  // Empty items — render placeholder after all hooks
  if (items.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No items",
    );
  }

  const outerBoxProps: Record<string, unknown> = {
    role: "menu",
    flexDirection: "column",
    "aria-label": props["aria-label"],
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(margin !== undefined ? { margin } : {}),
    ...(marginX !== undefined ? { marginX } : {}),
    ...(marginY !== undefined ? { marginY } : {}),
    ...(marginTop !== undefined ? { marginTop } : {}),
    ...(marginBottom !== undefined ? { marginBottom } : {}),
    ...(marginLeft !== undefined ? { marginLeft } : {}),
    ...(marginRight !== undefined ? { marginRight } : {}),
    ...(minWidth !== undefined ? { minWidth } : {}),
    ...(maxWidth !== undefined ? { maxWidth } : {}),
  };

  // Determine depth for indentation
  const depth = submenuStackRef.current.length;
  const indent = "  ".repeat(depth);

  // Breadcrumb trail for submenus
  const breadcrumbs: React.ReactElement[] = [];
  if (depth > 0) {
    const trail: string[] = [];
    for (const frame of submenuStackRef.current) {
      const parentItem = frame.items[frame.activeIndex];
      if (parentItem) trail.push(parentItem.label);
    }
    breadcrumbs.push(
      React.createElement(
        "tui-text",
        { key: "__breadcrumb", color: colors.text.dim, dim: true },
        trail.join(" > "),
      ),
    );
  }

  const renderItems = currentItemsRef.current;
  const currentActiveIdx = (submenuStackRef.current.length === 0 ? activeIndexRef : subActiveIndexRef).current;

  // Apply maxVisible scroll window
  let visibleStart = 0;
  let visibleItems = renderItems;
  if (maxVisible !== undefined && renderItems.length > maxVisible) {
    const halfPage = Math.floor(maxVisible / 2);
    visibleStart = Math.max(0, currentActiveIdx - halfPage);
    visibleStart = Math.min(visibleStart, renderItems.length - maxVisible);
    visibleItems = renderItems.slice(visibleStart, visibleStart + maxVisible);
  }

  const itemElements = visibleItems.map((item, i) => {
    const index = visibleStart + i;

    // Separator line
    if (item.separator) {
      return React.createElement(
        "tui-text",
        { key: `sep-${index}`, color: colors.divider, dim: true },
        `${indent}  ${SEPARATOR_LINE}`,
      );
    }

    const isActive = index === currentActiveIdx;
    const isDisabled = !!item.disabled;
    const hasSubmenu = !!(item.children && item.children.length > 0);

    let textColor: string | number;
    if (isDisabled) {
      textColor = colors.text.disabled;
    } else if (isActive) {
      textColor = activeColor;
    } else {
      textColor = color;
    }

    const indicator = isActive ? `${personality.interaction.selectionChar} ` : "  ";
    const iconPrefix = item.icon ? `${item.icon} ` : "";

    const children: React.ReactElement[] = [
      // Indicator + icon + label
      React.createElement(
        "tui-text",
        {
          key: "label",
          color: textColor,
          bold: isActive,
          dim: isDisabled,
          strikethrough: isDisabled,
        },
        `${indent}${indicator}${iconPrefix}${item.label}`,
      ),
    ];

    // Submenu arrow indicator
    if (hasSubmenu) {
      children.push(
        React.createElement(
          "tui-text",
          { key: "sub", color: colors.text.dim },
          ` ${SUBMENU_ARROW}`,
        ),
      );
    }

    // Shortcut (right-aligned, dim)
    if (item.shortcut) {
      children.push(
        React.createElement(
          "tui-text",
          { key: "shortcut", color: colors.text.dim },
          `  ${item.shortcut}`,
        ),
      );
    }

    if (props.renderItem) {
      return React.createElement(
        "tui-box",
        { key: item.value, flexDirection: "row" },
        props.renderItem(item, { isActive, isDisabled, hasSubmenu }),
      );
    }

    return React.createElement(
      "tui-box",
      { key: item.value, flexDirection: "row" },
      ...children,
    );
  });

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...breadcrumbs,
    ...itemElements,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Menu = Object.assign(MenuBase, {
  Root: MenuRoot,
  Item: MenuCompoundItem,
  Separator: MenuSeparator,
  Submenu: MenuSubmenu,
});
