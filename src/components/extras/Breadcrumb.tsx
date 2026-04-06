
import React, { useRef, useCallback, createContext, useContext } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { pickStyleProps } from "../../styles/applyStyles.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface BreadcrumbProps extends StormLayoutStyleProps {
  items: string[];
  separator?: string;
  activeColor?: string | number;
  /** Callback when a breadcrumb item is navigated to (by index in original items array). */
  onNavigate?: (index: number) => void;
  /** When true, enable keyboard navigation with Left/Right and Enter. */
  isFocused?: boolean;
  /** Maximum number of visible items. Middle items collapse to "...". */
  maxItems?: number;
  /** Number of items to show at the start when collapsing (default 1). */
  itemsBefore?: number;
  /** Number of items to show at the end when collapsing (default 1). */
  itemsAfter?: number;
  /** Custom renderer for each breadcrumb item. */
  renderItem?: (item: string, state: { isLast: boolean; index: number }) => React.ReactNode;
}

export interface BreadcrumbContextValue {
  separator: string;
  activeColor: string | number;
  onNavigate: ((index: number) => void) | undefined;
  itemCount: number;
  registerItem: () => number;
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("Breadcrumb sub-components must be used inside Breadcrumb.Root");
  return ctx;
}

export interface BreadcrumbRootProps {
  separator?: string;
  activeColor?: string | number;
  onNavigate?: (index: number) => void;
  children: React.ReactNode;
}

function BreadcrumbRoot({ separator = " \u203A ", activeColor: activeColorProp, onNavigate, children }: BreadcrumbRootProps): React.ReactElement {
  const colors = useColors();
  const activeColor = activeColorProp ?? colors.brand.primary;
  const counterRef = useRef(0);
  counterRef.current = 0;

  const ctx: BreadcrumbContextValue = {
    separator,
    activeColor,
    onNavigate,
    itemCount: React.Children.count(children),
    registerItem: () => counterRef.current++,
  };

  return React.createElement(
    BreadcrumbContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "row" }, children),
  );
}

export interface BreadcrumbCompoundItemProps {
  children: React.ReactNode;
  isLast?: boolean;
}

function BreadcrumbCompoundItem({ children, isLast = false }: BreadcrumbCompoundItemProps): React.ReactElement {
  const colors = useColors();
  const { activeColor } = useBreadcrumbContext();

  const itemColor = isLast ? activeColor : colors.text.dim;
  const itemBold = isLast;

  return React.createElement(
    "tui-text",
    { color: itemColor, bold: itemBold },
    children,
  );
}

export interface BreadcrumbSeparatorProps {
  children?: React.ReactNode;
}

function BreadcrumbSeparator({ children }: BreadcrumbSeparatorProps): React.ReactElement {
  const colors = useColors();
  const { separator } = useBreadcrumbContext();

  if (children) {
    return React.createElement("tui-text", { color: colors.text.dim }, children);
  }

  return React.createElement("tui-text", { color: colors.text.dim }, separator);
}

const BreadcrumbBase = React.memo(function Breadcrumb(rawProps: BreadcrumbProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Breadcrumb", rawProps);
  const {
    items,
    separator = " \u203A ",
    color = colors.text.dim,
    activeColor: activeColor,
    onNavigate,
    isFocused = false,
    maxItems,
    itemsBefore = 1,
    itemsAfter = 1,
  } = props;

  const resolvedActiveColor = activeColor ?? colors.brand.primary;
  const { requestRender } = useTui();
  const layoutProps = pickStyleProps(props);

  const focusedIndexRef = useRef(items.length - 1);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Clamp focused index if items changed
  if (focusedIndexRef.current >= items.length) {
    focusedIndexRef.current = Math.max(0, items.length - 1);
  }

  const handleInput = useCallback((event: KeyEvent) => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;

    if (event.key === "left") {
      if (focusedIndexRef.current > 0) {
        focusedIndexRef.current--;
        requestRender();
      }
    } else if (event.key === "right") {
      if (focusedIndexRef.current < currentItems.length - 1) {
        focusedIndexRef.current++;
        requestRender();
      }
    } else if (event.key === "return") {
      onNavigateRef.current?.(focusedIndexRef.current);
    }
  }, [requestRender]);

  useInput(handleInput, { isActive: isFocused });

  // Collapse middle items if maxItems is set and items exceed it
  let displayItems: Array<{ label: string; originalIndex: number; isEllipsis: boolean }>;

  if (maxItems !== undefined && items.length > maxItems) {
    const before = Math.max(1, Math.min(itemsBefore, maxItems - 1));
    const after = Math.max(1, Math.min(itemsAfter, maxItems - before));

    displayItems = [];
    for (let i = 0; i < before && i < items.length; i++) {
      displayItems.push({ label: items[i]!, originalIndex: i, isEllipsis: false });
    }
    displayItems.push({ label: "\u2026", originalIndex: -1, isEllipsis: true });
    for (let i = Math.max(before, items.length - after); i < items.length; i++) {
      displayItems.push({ label: items[i]!, originalIndex: i, isEllipsis: false });
    }
  } else {
    displayItems = items.map((label, i) => ({ label, originalIndex: i, isEllipsis: false }));
  }

  const children: React.ReactElement[] = [];

  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i]!;
    const isLast = item.originalIndex === items.length - 1;
    const isNavigableFocused = isFocused && onNavigate !== undefined && item.originalIndex === focusedIndexRef.current;

    if (i > 0) {
      children.push(
        React.createElement(
          "tui-text",
          { key: `sep-${i}`, color: colors.text.dim },
          separator,
        ),
      );
    }

    if (item.isEllipsis) {
      children.push(
        React.createElement(
          "tui-text",
          { key: "ellipsis", color: colors.text.dim },
          item.label,
        ),
      );
    } else if (props.renderItem) {
      children.push(
        React.createElement(
          "tui-box",
          { key: `item-${item.originalIndex}`, flexDirection: "row" },
          props.renderItem(item.label, { isLast, index: item.originalIndex }),
        ),
      );
    } else {
      const itemColor = isNavigableFocused
        ? resolvedActiveColor
        : (isLast ? resolvedActiveColor : color);
      const itemBold = isNavigableFocused || isLast;
      const underline = isNavigableFocused && !isLast;

      children.push(
        React.createElement(
          "tui-text",
          {
            key: `item-${item.originalIndex}`,
            color: itemColor,
            bold: itemBold,
            ...(underline ? { underline: true } : {}),
          },
          item.label,
        ),
      );
    }
  }

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "row",
    role: "navigation",
    ...layoutProps,
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...children,
  );
});

export const Breadcrumb = Object.assign(BreadcrumbBase, {
  Root: BreadcrumbRoot,
  Item: BreadcrumbCompoundItem,
  Separator: BreadcrumbSeparator,
});
