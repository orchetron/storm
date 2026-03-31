/**
 * SelectInput — arrow-key navigable menu.
 *
 * Renders items vertically with a highlight indicator.
 * Up/Down arrows navigate, Enter selects.
 *
 * Features:
 * - Type-to-filter: typing filters visible items by label (case-insensitive)
 * - Filter indicator at top
 * - Backspace removes filter chars, Escape clears filter
 * - maxVisible prop with scroll window
 */

import React, { useCallback, useRef } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import type { KeyEvent } from "../input/types.js";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { usePersonality } from "../core/personality.js";

export interface SelectInputItem {
  label: string;
  value: string;
}

export interface SelectInputProps extends StormLayoutStyleProps {
  items: SelectInputItem[];
  onSelect: (item: SelectInputItem) => void;
  onHighlight?: (item: SelectInputItem) => void;
  initialIndex?: number;
  isFocused?: boolean;
  /** Max visible items. Scrolls when items exceed this. */
  maxVisible?: number;
  "aria-label"?: string;
  /** Custom renderer for each item. */
  renderItem?: (item: SelectInputItem, state: { isHighlighted: boolean; index: number }) => React.ReactNode;
}

const INDICATOR = "\u25b6"; // ▶
const INDICATOR_SPACE = " ";

export const SelectInput = React.memo(function SelectInput(rawProps: SelectInputProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("SelectInput", rawProps as unknown as Record<string, unknown>) as unknown as SelectInputProps;
  const {
    items,
    onSelect,
    onHighlight,
    initialIndex = 0,
    isFocused = true,
    color,
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

  const highlightRef = useRef(initialIndex);
  const filterRef = useRef("");

  // Refs for latest props
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onHighlightRef = useRef(onHighlight);
  onHighlightRef.current = onHighlight;

  // Compute filtered items
  const filteredItems = filterRef.current
    ? items.filter((item) => item.label.toLowerCase().includes(filterRef.current.toLowerCase()))
    : items;

  // Clamp highlight
  if (highlightRef.current >= filteredItems.length) {
    highlightRef.current = Math.max(0, filteredItems.length - 1);
  }
  const effectiveIndex = filteredItems.length === 0 ? 0 : highlightRef.current;

  // Notify onHighlight — track previous index to detect changes
  const prevIndexRef = useRef(effectiveIndex);
  if (onHighlight && effectiveIndex !== prevIndexRef.current) {
    const item = filteredItems[effectiveIndex];
    if (item) {
      onHighlight(item);
    }
  }
  prevIndexRef.current = effectiveIndex;

  const handleInput = useCallback(
    (event: KeyEvent) => {
      const allItems = itemsRef.current;
      if (allItems.length === 0) return;

      const getFiltered = () => {
        if (!filterRef.current) return allItems;
        const lower = filterRef.current.toLowerCase();
        return allItems.filter((item) => item.label.toLowerCase().includes(lower));
      };

      if (event.key === "up") {
        const filtered = getFiltered();
        if (filtered.length === 0) return;
        highlightRef.current =
          highlightRef.current > 0 ? highlightRef.current - 1 : filtered.length - 1;
        requestRender();
        const item = filtered[highlightRef.current];
        if (item) onHighlightRef.current?.(item);
      } else if (event.key === "down") {
        const filtered = getFiltered();
        if (filtered.length === 0) return;
        highlightRef.current =
          highlightRef.current < filtered.length - 1 ? highlightRef.current + 1 : 0;
        requestRender();
        const item = filtered[highlightRef.current];
        if (item) onHighlightRef.current?.(item);
      } else if (event.key === "return") {
        const filtered = getFiltered();
        const item = filtered[highlightRef.current];
        if (item) {
          onSelectRef.current(item);
        }
      } else if (event.key === "escape") {
        if (filterRef.current.length > 0) {
          filterRef.current = "";
          highlightRef.current = 0;
          requestRender();
        }
      } else if (event.key === "backspace") {
        if (filterRef.current.length > 0) {
          filterRef.current = filterRef.current.slice(0, -1);
          highlightRef.current = 0;
          requestRender();
        }
      } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
        filterRef.current += event.char;
        highlightRef.current = 0;
        requestRender();
      }
    },
    [requestRender],
  );

  useInput(handleInput, { isActive: isFocused });

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    role: "listbox",
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

  const indicatorColor = color ?? colors.success;

  // Empty items — render placeholder after all hooks
  if (items.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No options",
    );
  }

  const rowChildren: React.ReactElement[] = [];

  // Filter indicator
  if (filterRef.current) {
    rowChildren.push(
      React.createElement(
        "tui-box",
        { key: "__filter", flexDirection: "row" },
        React.createElement("tui-text", { color: colors.text.dim }, "Filter: "),
        React.createElement("tui-text", { color: colors.text.primary }, filterRef.current),
        React.createElement(
          "tui-text",
          { color: colors.text.dim, dim: true },
          ` (${filteredItems.length} of ${items.length})`,
        ),
      ),
    );
  }

  // No matches
  if (filteredItems.length === 0) {
    rowChildren.push(
      React.createElement(
        "tui-text",
        { key: "__no-match", color: colors.text.dim, dim: true },
        "No matching options",
      ),
    );

    return React.createElement("tui-box", outerBoxProps, ...rowChildren);
  }

  // Apply maxVisible scroll window
  let visibleStart = 0;
  let visibleItems = filteredItems;
  if (maxVisible !== undefined && filteredItems.length > maxVisible) {
    const halfPage = Math.floor(maxVisible / 2);
    visibleStart = Math.max(0, effectiveIndex - halfPage);
    visibleStart = Math.min(visibleStart, filteredItems.length - maxVisible);
    visibleItems = filteredItems.slice(visibleStart, visibleStart + maxVisible);
  }

  for (let i = 0; i < visibleItems.length; i++) {
    const item = visibleItems[i]!;
    const globalIndex = visibleStart + i;
    const isHighlighted = globalIndex === effectiveIndex;

    if (props.renderItem) {
      rowChildren.push(
        React.createElement(
          "tui-box",
          { key: item.value, flexDirection: "row" },
          props.renderItem(item, { isHighlighted, index: globalIndex }),
        ),
      );
    } else {
      rowChildren.push(
        React.createElement(
          "tui-box",
          { key: item.value, flexDirection: "row" },
          // Indicator
          React.createElement(
            "tui-text",
            { color: indicatorColor },
            isHighlighted ? `${personality.interaction.selectionChar} ` : `${INDICATOR_SPACE}${INDICATOR_SPACE}`,
          ),
          // Label
          React.createElement(
            "tui-text",
            isHighlighted ? { bold: true } : {},
            item.label,
          ),
        ),
      );
    }
  }

  return React.createElement("tui-box", outerBoxProps, ...rowChildren);
});
