import React, { useCallback, useRef, createContext, useContext } from "react";
import { useInput } from "../../hooks/useInput.js";
import type { KeyEvent } from "../../input/types.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../../styles/applyStyles.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { usePersonality } from "../../core/personality.js";

export interface ListViewItem {
  key: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ListViewProps extends StormContainerStyleProps {
  items: readonly ListViewItem[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
  onHighlight?: (key: string) => void;
  maxVisible?: number;
  highlightColor?: string | number;
  isFocused?: boolean;
  emptyMessage?: string;
  /** Custom item renderer. Receives item, whether highlighted, and the index. */
  renderItem?: (item: ListViewItem, isHighlighted: boolean, index: number) => React.ReactElement;
}

export interface ListViewContextValue {
  highlightIndex: number;
  setHighlightIndex: (index: number) => void;
  filterText: string;
  setFilterText: (text: string) => void;
  onSelect: ((key: string) => void) | undefined;
}

export const ListViewContext = createContext<ListViewContextValue | null>(null);

export function useListViewContext(): ListViewContextValue {
  const ctx = useContext(ListViewContext);
  if (!ctx) throw new Error("ListView sub-components must be used inside ListView.Root");
  return ctx;
}

export interface ListViewRootProps {
  highlightIndex?: number;
  onHighlightChange?: (index: number) => void;
  filterText?: string;
  onFilterChange?: (text: string) => void;
  onSelect?: (key: string) => void;
  children: React.ReactNode;
}

function ListViewRoot({
  highlightIndex = 0,
  onHighlightChange,
  filterText = "",
  onFilterChange,
  onSelect,
  children,
}: ListViewRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onHighlightRef = useRef(onHighlightChange);
  onHighlightRef.current = onHighlightChange;
  const onFilterRef = useRef(onFilterChange);
  onFilterRef.current = onFilterChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const ctx: ListViewContextValue = {
    highlightIndex,
    setHighlightIndex: (i: number) => { onHighlightRef.current?.(i); requestRender(); },
    filterText,
    setFilterText: (t: string) => { onFilterRef.current?.(t); requestRender(); },
    onSelect: onSelectRef.current,
  };

  return React.createElement(
    ListViewContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface ListViewCompoundItemProps {
  item: ListViewItem;
  index?: number;
  children?: React.ReactNode;
}

function ListViewCompoundItem({ item, index = 0, children }: ListViewCompoundItemProps): React.ReactElement {
  const colors = useColors();
  const { highlightIndex } = useListViewContext();
  const personality = usePersonality();
  const isHighlighted = index === highlightIndex;

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const parts: React.ReactElement[] = [];
  parts.push(
    React.createElement(
      "tui-text",
      { key: "ind", color: colors.brand.primary },
      isHighlighted ? `${personality.interaction.selectionChar} ` : "  ",
    ),
  );
  if (item.icon !== undefined) {
    parts.push(React.createElement("tui-text", { key: "icon" }, `${item.icon} `));
  }
  parts.push(
    React.createElement(
      "tui-text",
      isHighlighted ? { key: "label", bold: true, color: colors.brand.primary } : { key: "label" },
      item.label,
    ),
  );
  if (item.description !== undefined) {
    parts.push(
      React.createElement("tui-text", { key: "desc", color: colors.text.dim }, ` \u2014 ${item.description}`),
    );
  }

  return React.createElement("tui-box", { flexDirection: "row" }, ...parts);
}

const OVERFLOW = "\u00B7\u00B7\u00B7"; // ···
const SEPARATOR = " \u2014 "; // —

const ListViewBase = React.memo(function ListView(rawProps: ListViewProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("ListView", rawProps);
  const {
    items,
    selectedKey,
    onSelect,
    onHighlight,
    maxVisible = 10,
    highlightColor = colors.brand.primary,
    isFocused = true,
    emptyMessage = "No items",
    renderItem,
  } = props;

  const userStyles = pickStyleProps(props);
  const { requestRender } = useTui();

  const highlightIndexRef = useRef(0);
  const filterTextRef = useRef("");

  const filter = filterTextRef.current.toLowerCase();
  const filteredItems = filter
    ? items.filter((it) => it.label.toLowerCase().includes(filter))
    : [...items];

  if (items.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      emptyMessage,
    );
  }

  const initialIndex = selectedKey
    ? Math.max(0, filteredItems.findIndex((it) => it.key === selectedKey))
    : 0;

  if (highlightIndexRef.current >= filteredItems.length) {
    highlightIndexRef.current = Math.max(0, filteredItems.length - 1);
  }

  // Clamp highlight index
  const effectiveIndex = filteredItems.length > 0
    ? Math.min(highlightIndexRef.current, Math.max(0, filteredItems.length - 1))
    : 0;

  // Notify onHighlight — track previous index to detect changes
  const prevIndexRef = useRef(effectiveIndex);
  if (onHighlight && effectiveIndex !== prevIndexRef.current && filteredItems.length > 0) {
    const item = filteredItems[effectiveIndex];
    if (item) {
      onHighlight(item.key);
    }
  }
  prevIndexRef.current = effectiveIndex;

  const handleInput = useCallback(
    (event: KeyEvent) => {
      // Recompute filtered list within callback
      const currentFilter = filterTextRef.current.toLowerCase();
      const currentFiltered = currentFilter
        ? items.filter((it) => it.label.toLowerCase().includes(currentFilter))
        : [...items];

      if (event.key === "up") {
        highlightIndexRef.current = highlightIndexRef.current > 0
          ? highlightIndexRef.current - 1
          : currentFiltered.length - 1;
        requestRender();
      } else if (event.key === "down") {
        highlightIndexRef.current = highlightIndexRef.current < currentFiltered.length - 1
          ? highlightIndexRef.current + 1
          : 0;
        requestRender();
      } else if (event.key === "return") {
        const idx = Math.min(highlightIndexRef.current, Math.max(0, currentFiltered.length - 1));
        const item = currentFiltered[idx];
        if (item && onSelect) {
          onSelect(item.key);
        }
      } else if (event.key === "escape") {
        if (filterTextRef.current) {
          filterTextRef.current = "";
          highlightIndexRef.current = 0;
          requestRender();
        }
      } else if (event.key === "backspace") {
        if (filterTextRef.current.length > 0) {
          filterTextRef.current = filterTextRef.current.slice(0, -1);
          highlightIndexRef.current = 0;
          requestRender();
        }
      } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
        // Type-ahead: append character to filter
        filterTextRef.current += event.char;
        highlightIndexRef.current = 0;
        requestRender();
      }
    },
    [items, onSelect, requestRender],
  );

  useInput(handleInput, { isActive: isFocused });

  if (filteredItems.length === 0) {
    const noMatchElements: React.ReactElement[] = [];
    // Show filter bar even when no matches
    if (filterTextRef.current) {
      noMatchElements.push(
        React.createElement(
          "tui-text",
          { key: "__filter", color: colors.brand.primary },
          `\u{1F50D} "${filterTextRef.current}" \u2014 0/${items.length} matches`,
        ),
      );
    }
    noMatchElements.push(
      React.createElement(
        "tui-text",
        { key: "__no-match", color: colors.text.dim, dim: true },
        "No matching items",
      ),
    );
    return React.createElement(
      "tui-box",
      mergeBoxStyles({ flexDirection: "column" }, userStyles),
      ...noMatchElements,
    );
  }

  // Virtual scroll: compute visible window
  const totalItems = filteredItems.length;
  const visibleCount = Math.min(maxVisible, totalItems);

  let scrollStart = 0;
  if (totalItems > visibleCount) {
    // Keep highlighted item in the middle of the viewport when possible
    const half = Math.floor(visibleCount / 2);
    scrollStart = Math.max(0, effectiveIndex - half);
    scrollStart = Math.min(scrollStart, totalItems - visibleCount);
  }

  const visibleItems = filteredItems.slice(scrollStart, scrollStart + visibleCount);
  const hasOverflowTop = scrollStart > 0;
  const hasOverflowBottom = scrollStart + visibleCount < totalItems;

  const elements: React.ReactElement[] = [];

  if (filterTextRef.current) {
    elements.push(
      React.createElement(
        "tui-text",
        { key: "__filter", color: colors.brand.primary },
        `\u{1F50D} "${filterTextRef.current}" \u2014 ${filteredItems.length}/${items.length} matches`,
      ),
    );
  }

  if (hasOverflowTop) {
    elements.push(
      React.createElement(
        "tui-text",
        { key: "__overflow-top", color: colors.text.dim },
        `  ${OVERFLOW}`,
      ),
    );
  }

  for (let i = 0; i < visibleItems.length; i++) {
    const item = visibleItems[i]!;
    const actualIndex = scrollStart + i;
    const isHighlighted = actualIndex === effectiveIndex;

    // Use custom renderer if provided
    if (renderItem) {
      elements.push(
        React.createElement(
          "tui-box",
          { key: item.key, flexDirection: "row" },
          React.createElement(
            "tui-text",
            { key: "ind", color: highlightColor },
            isHighlighted ? `${personality.interaction.selectionChar} ` : "  ",
          ),
          renderItem(item, isHighlighted, actualIndex),
        ),
      );
      continue;
    }

    const parts: React.ReactElement[] = [];

    // Indicator
    parts.push(
      React.createElement(
        "tui-text",
        { key: "ind", color: highlightColor },
        isHighlighted ? `${personality.interaction.selectionChar} ` : "  ",
      ),
    );

    // Icon (if present)
    if (item.icon !== undefined) {
      parts.push(
        React.createElement(
          "tui-text",
          { key: "icon" },
          `${item.icon} `,
        ),
      );
    }

    // Label
    parts.push(
      React.createElement(
        "tui-text",
        isHighlighted
          ? { key: "label", bold: true, color: highlightColor }
          : { key: "label" },
        item.label,
      ),
    );

    // Description (dim, after separator)
    if (item.description !== undefined) {
      parts.push(
        React.createElement(
          "tui-text",
          { key: "desc", color: colors.text.dim },
          `${SEPARATOR}${item.description}`,
        ),
      );
    }

    elements.push(
      React.createElement(
        "tui-box",
        { key: item.key, flexDirection: "row" },
        ...parts,
      ),
    );
  }

  if (hasOverflowBottom) {
    elements.push(
      React.createElement(
        "tui-text",
        { key: "__overflow-bottom", color: colors.text.dim },
        `  ${OVERFLOW}`,
      ),
    );
  }

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", role: "list" },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...elements,
  );
});

export const ListView = Object.assign(ListViewBase, {
  Root: ListViewRoot,
  Item: ListViewCompoundItem,
});
