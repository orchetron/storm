import React, { useRef } from "react";
import { Box } from "../../components/core/Box.js";
import { Text } from "../../components/core/Text.js";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { computeScrollWindow } from "../../utils/navigation.js";

export interface CommandItem {
  name: string;
  description: string;
}

export interface CommandDropdownProps {
  /** Items to display. */
  items: readonly CommandItem[];
  /** Currently selected index (default: 0). */
  selectedIndex?: number;
  /** Maximum visible items before scrolling (default: 6). */
  maxVisible?: number;
  /** Highlight color for the selected item (default: brand primary). */
  highlightColor?: string;
  isFocused?: boolean;
  /** Called when the user selects an item with Enter. */
  onSelect?: (item: CommandItem) => void;
  /** Called when keyboard navigation changes the selected index. */
  onSelectionChange?: (index: number) => void;
  /** Called when the dropdown is closed (second Escape press). */
  onClose?: () => void;
  /** Override the selection indicator string (default: "▸ "). */
  selectionIndicator?: string;
  /** Custom render for each dropdown item. */
  renderItem?: (item: CommandItem, isSelected: boolean) => React.ReactNode;
}

/** Returns indices of matching characters for fuzzy substring match, or null. */
function fuzzyMatch(query: string, text: string): number[] | null {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qIdx = 0;
  const indices: number[] = [];
  for (let i = 0; i < lower.length && qIdx < q.length; i++) {
    if (lower[i] === q[qIdx]) {
      indices.push(i);
      qIdx++;
    }
  }
  return qIdx === q.length ? indices : null;
}

/** Render item name with matching characters highlighted in bold. */
function highlightName(name: string, matchIndices: number[]): React.ReactElement[] {
  const parts: React.ReactElement[] = [];
  const matchSet = new Set(matchIndices);
  let i = 0;
  while (i < name.length) {
    if (matchSet.has(i)) {
      let end = i;
      while (end < name.length && matchSet.has(end)) end++;
      parts.push(
        React.createElement("tui-text", { key: `m${i}`, bold: true }, name.slice(i, end)),
      );
      i = end;
    } else {
      let end = i;
      while (end < name.length && !matchSet.has(end)) end++;
      parts.push(
        React.createElement("tui-text", { key: `u${i}` }, name.slice(i, end)),
      );
      i = end;
    }
  }
  return parts;
}

export const CommandDropdown = React.memo(function CommandDropdown(rawProps: CommandDropdownProps): React.ReactElement | null {
  const colors = useColors();
  const props = usePluginProps("CommandDropdown", rawProps);
  const {
    items,
    selectedIndex = 0,
    maxVisible = 6,
    highlightColor = colors.brand.primary,
    isFocused,
    onSelect,
    onSelectionChange,
    onClose,
    selectionIndicator,
    renderItem,
  } = props;
  const indicator = selectionIndicator ?? "\u25B8 ";

  const { requestRender } = useTui();
  const indexRef = useRef(selectedIndex);
  const filterRef = useRef("");

  // Sync external selectedIndex prop into ref
  indexRef.current = selectedIndex;

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const filter = filterRef.current;
  const filteredItems: Array<{ item: CommandItem; matchIndices: number[]; originalIndex: number }> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (filter.length === 0) {
      filteredItems.push({ item, matchIndices: [], originalIndex: i });
    } else {
      const indices = fuzzyMatch(filter, item.name);
      if (indices) {
        filteredItems.push({ item, matchIndices: indices, originalIndex: i });
      }
    }
  }

  // Clamp index to filtered range
  if (indexRef.current >= filteredItems.length) {
    indexRef.current = Math.max(0, filteredItems.length - 1);
  }

  // Keyboard handling for navigation, selection, and filtering
  useInput(
    (e) => {
      if (e.key === "escape") {
        if (filterRef.current.length > 0) {
          // First Escape: clear filter
          filterRef.current = "";
          indexRef.current = 0;
          if (onSelectionChangeRef.current) onSelectionChangeRef.current(0);
          requestRender();
        } else {
          // Second Escape: close dropdown
          onClose?.();
        }
        return;
      }

      if (e.key === "backspace") {
        if (filterRef.current.length > 0) {
          filterRef.current = filterRef.current.slice(0, -1);
          indexRef.current = 0;
          if (onSelectionChangeRef.current) onSelectionChangeRef.current(0);
          requestRender();
        }
        return;
      }

      if (filteredItems.length === 0) return;

      if (e.key === "up") {
        if (indexRef.current > 0) {
          indexRef.current--;
          if (onSelectionChangeRef.current) onSelectionChangeRef.current(indexRef.current);
          requestRender();
        }
      } else if (e.key === "down") {
        if (indexRef.current < filteredItems.length - 1) {
          indexRef.current++;
          if (onSelectionChangeRef.current) onSelectionChangeRef.current(indexRef.current);
          requestRender();
        }
      } else if (e.key === "return") {
        const selected = filteredItems[indexRef.current];
        if (selected && onSelect) {
          onSelect(selected.item);
        }
      } else if (e.key.length === 1 && e.key >= " ") {
        // Type-to-filter: printable characters
        filterRef.current += e.key;
        indexRef.current = 0;
        if (onSelectionChangeRef.current) onSelectionChangeRef.current(0);
        requestRender();
      }
    },
    { isActive: isFocused === true },
  );

  if (filteredItems.length === 0 && filter.length === 0) return null;

  const activeIndex = indexRef.current;

  const { start, end } = computeScrollWindow(filteredItems.length, activeIndex, maxVisible);
  const visibleItems = filteredItems.slice(start, end);

  const hasMoreAbove = start > 0;
  const hasMoreBelow = end < filteredItems.length;

  return (
    <Box flexDirection="column" paddingX={1}>
      {filter.length > 0 && (
        <Text dim color={colors.brand.primary}>
          {`filter: ${filter}${filteredItems.length === 0 ? " (no matches)" : ""}`}
        </Text>
      )}
      {hasMoreAbove && <Text dim>{"  ..."}</Text>}
      {visibleItems.map((entry, i) => {
        const actualIndex = start + i;
        const isSelected = actualIndex === activeIndex;
        const nameElements = filter.length > 0
          ? highlightName(entry.item.name, entry.matchIndices)
          : null;

        if (renderItem) {
          return (
            <Box key={entry.item.name} flexDirection="row">
              {renderItem(entry.item, isSelected)}
            </Box>
          );
        }

        const unselectedPad = " ".repeat(indicator.length);

        return (
          <Box key={entry.item.name} flexDirection="row">
            {isSelected ? (
              <>
                <Text color={highlightColor} bold>{indicator}</Text>
                {nameElements
                  ? React.createElement("tui-text", { color: highlightColor }, ...nameElements)
                  : <Text color={highlightColor} bold>{entry.item.name}</Text>
                }
              </>
            ) : (
              <>
                <Text>{unselectedPad}</Text>
                {nameElements
                  ? React.createElement("tui-text", null, ...nameElements)
                  : <Text>{entry.item.name}</Text>
                }
              </>
            )}
            <Text dim> {entry.item.description}</Text>
          </Box>
        );
      })}
      {hasMoreBelow && <Text dim>{"  ..."}</Text>}
    </Box>
  );
});
