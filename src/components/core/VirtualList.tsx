import React, { useRef, useCallback, createContext, useContext } from "react";
import { useVirtualList, type VirtualListOptions, type VirtualListResult } from "../../hooks/useVirtualList.js";
import { useInput } from "../../hooks/useInput.js";
import { useMouse } from "../../hooks/useMouse.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface VirtualListContextValue {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  scrollTop: number;
  scrollTo: (index: number) => void;
}

export const VirtualListContext = createContext<VirtualListContextValue | null>(null);

export function useVirtualListContext(): VirtualListContextValue {
  const ctx = useContext(VirtualListContext);
  if (!ctx) throw new Error("VirtualList sub-components must be used inside VirtualList.Root");
  return ctx;
}

export interface VirtualListRootProps {
  height: number;
  width?: number | string;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  children: React.ReactNode;
}

function VirtualListRoot({
  height,
  width,
  selectedIndex = 0,
  onSelectedIndexChange,
  children,
}: VirtualListRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onSelectedRef = useRef(onSelectedIndexChange);
  onSelectedRef.current = onSelectedIndexChange;

  const ctx: VirtualListContextValue = {
    selectedIndex,
    setSelectedIndex: (i: number) => { onSelectedRef.current?.(i); requestRender(); },
    scrollTop: 0,
    scrollTo: () => { requestRender(); },
  };

  return React.createElement(
    VirtualListContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { height, width, flexDirection: "column", overflow: "hidden" }, children),
  );
}

export interface VirtualListCompoundItemProps {
  index?: number;
  children: React.ReactNode;
}

function VirtualListCompoundItem({ index = 0, children }: VirtualListCompoundItemProps): React.ReactElement {
  const colors = useColors();
  const { selectedIndex } = useVirtualListContext();
  const isSelected = index === selectedIndex;

  return React.createElement(
    "tui-box",
    { ...(isSelected ? { backgroundColor: colors.brand.primary } : {}) },
    children,
  );
}

export interface VirtualListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  height: number;
  width?: number | string;
  keyExtractor?: (item: T, index: number) => string;
  onSelect?: (item: T, index: number) => void;
  isFocused?: boolean;
  selectedIndex?: number;
  emptyMessage?: string;
}

function VirtualListInner<T>(rawProps: VirtualListProps<T>): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("VirtualList", rawProps);
  const {
    items,
    renderItem,
    itemHeight = 1,
    height,
    width,
    keyExtractor,
    onSelect,
    isFocused = true,
    selectedIndex,
    emptyMessage = "No items",
  } = props;

  const { requestRender } = useTui();

  const safeItemHeight = Math.max(1, itemHeight);

  const selectedRef = useRef(selectedIndex ?? 0);
  // Sync from prop when provided
  if (selectedIndex !== undefined) {
    selectedRef.current = selectedIndex;
  }

  const virtualList = useVirtualList<T>({
    items,
    itemHeight: safeItemHeight,
    viewportHeight: height,
    overscan: 3,
  });

  // Keyboard navigation
  const handleKey = useCallback(
    (event: import("../../input/types.js").KeyEvent) => {
      if (event.key === "up") {
        selectedRef.current = Math.max(0, selectedRef.current - 1);
        // Ensure selected item is visible — scroll if needed
        if (selectedRef.current * safeItemHeight < virtualList.scrollTop) {
          virtualList.scrollTo(selectedRef.current);
        }
        requestRender();
      } else if (event.key === "down") {
        selectedRef.current = Math.min(items.length - 1, selectedRef.current + 1);
        // Scroll down if selected item is below viewport
        const itemBottom = (selectedRef.current + 1) * safeItemHeight;
        if (itemBottom > virtualList.scrollTop + height) {
          virtualList.scrollTo(selectedRef.current - Math.floor(height / safeItemHeight) + 1);
        }
        requestRender();
      } else if (event.key === "return") {
        const item = items[selectedRef.current];
        if (item && onSelect) {
          onSelect(item, selectedRef.current);
        }
      } else if (event.key === "home") {
        selectedRef.current = 0;
        virtualList.scrollToTop();
        requestRender();
      } else if (event.key === "end") {
        selectedRef.current = Math.max(0, items.length - 1);
        virtualList.scrollToBottom();
        requestRender();
      }
    },
    [items, safeItemHeight, height, onSelect, virtualList, requestRender],
  );

  useInput(handleKey, { isActive: isFocused });

  // Mouse scroll
  useMouse(
    (event) => {
      if (event.button === "scroll-up") {
        virtualList.onScroll(-safeItemHeight);
      } else if (event.button === "scroll-down") {
        virtualList.onScroll(safeItemHeight);
      }
    },
    { isActive: isFocused },
  );

  // Empty state
  if (items.length === 0) {
    return React.createElement(
      "tui-box",
      { height, width, flexDirection: "column" },
      React.createElement(
        "tui-text",
        { color: colors.text.dim },
        emptyMessage,
      ),
    );
  }

  const children: React.ReactElement[] = [];
  const currentSelected = selectedRef.current;

  for (const entry of virtualList.visibleItems) {
    const key = keyExtractor
      ? keyExtractor(entry.item, entry.index)
      : String(entry.index);

    const isSelected = entry.index === currentSelected;

    let renderedContent: React.ReactNode;
    try {
      renderedContent = renderItem(entry.item, entry.index);
    } catch (err) {
      renderedContent = React.createElement(
        "tui-text",
        { color: colors.error },
        `[Render error: ${String(err)}]`,
      );
    }

    children.push(
      React.createElement(
        "tui-box",
        {
          key,
          height: safeItemHeight,
          ...(isSelected ? { backgroundColor: colors.brand.primary } : {}),
        },
        renderedContent,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    {
      height,
      width,
      flexDirection: "column",
      overflow: "hidden",
      role: "list",
    },
    ...children,
  );
}

const VirtualListMemo = React.memo(VirtualListInner) as typeof VirtualListInner;
export const VirtualList = Object.assign(VirtualListMemo, {
  Root: VirtualListRoot,
  Item: VirtualListCompoundItem,
});
