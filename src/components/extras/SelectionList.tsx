
import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { usePersonality } from "../../core/personality.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface SelectionListItem {
  label: string;
  value: string;
}

export interface SelectionListProps extends StormLayoutStyleProps {
  items: Array<{ label: string; value: string }>;
  selectedValues: string[];
  onChange?: (values: string[]) => void;
  checkColor?: string | number;
  highlightColor?: string | number;
  isFocused?: boolean;
  "aria-label"?: string;
  /** Custom renderer for each item. */
  renderItem?: (item: SelectionListItem, state: { isHighlighted: boolean; isSelected: boolean }) => React.ReactNode;
}

export const SelectionList = React.memo(function SelectionList(rawProps: SelectionListProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("SelectionList", rawProps);
  const {
    items,
    selectedValues,
    onChange,
    color = colors.text.primary,
    checkColor = colors.success,
    highlightColor = colors.brand.primary,
    isFocused = true,
  } = props;

  const { requestRender } = useTui();
  const highlightRef = useRef(0);
  const filterRef = useRef("");

  // Refs for latest prop values
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedRef = useRef(selectedValues);
  selectedRef.current = selectedValues;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const getFiltered = (itms: Array<{ label: string; value: string }>, filter: string) => {
    if (!filter) return itms;
    const lower = filter.toLowerCase();
    return itms.filter((item) => item.label.toLowerCase().includes(lower));
  };

  const filteredItems = getFiltered(items, filterRef.current);

  // Clamp highlight index
  if (highlightRef.current >= filteredItems.length) {
    highlightRef.current = Math.max(0, filteredItems.length - 1);
  }

  const handleInput = useCallback((event: KeyEvent) => {
    const itms = itemsRef.current;
    const sel = selectedRef.current;
    const cb = onChangeRef.current;

    // Type-to-filter: Escape clears filter
    if (event.key === "escape") {
      if (filterRef.current.length > 0) {
        filterRef.current = "";
        highlightRef.current = 0;
        requestRender();
      }
      return;
    }

    // Backspace removes filter character (when filter is active)
    if (event.key === "backspace") {
      if (filterRef.current.length > 0) {
        filterRef.current = filterRef.current.slice(0, -1);
        highlightRef.current = 0;
        requestRender();
      }
      return;
    }

    const filtered = getFiltered(itms, filterRef.current);
    if (filtered.length === 0 && event.key !== "backspace") {
      // Still allow typing to change the filter even when empty
      if (event.char && event.char.length === 1 && !event.ctrl && !event.meta
        && event.char !== " " && event.char !== "a" && event.char !== "A"
        && event.char !== "n" && event.char !== "N") {
        filterRef.current += event.char;
        highlightRef.current = 0;
        requestRender();
      }
      return;
    }

    if (!cb || itms.length === 0) return;

    if (event.key === "up" && event.shift) {
      // Shift+Up: select current, move up, select that too (range selection)
      const currentItem = filtered[highlightRef.current];
      const selSet = new Set(sel);
      if (currentItem) selSet.add(currentItem.value);
      highlightRef.current =
        highlightRef.current > 0
          ? highlightRef.current - 1
          : filtered.length - 1;
      const nextItem = filtered[highlightRef.current];
      if (nextItem) selSet.add(nextItem.value);
      cb([...selSet]);
    } else if (event.key === "down" && event.shift) {
      // Shift+Down: select current, move down, select that too (range selection)
      const currentItem = filtered[highlightRef.current];
      const selSet = new Set(sel);
      if (currentItem) selSet.add(currentItem.value);
      highlightRef.current =
        highlightRef.current < filtered.length - 1
          ? highlightRef.current + 1
          : 0;
      const nextItem = filtered[highlightRef.current];
      if (nextItem) selSet.add(nextItem.value);
      cb([...selSet]);
    } else if (event.key === "up") {
      highlightRef.current =
        highlightRef.current > 0
          ? highlightRef.current - 1
          : filtered.length - 1;
      requestRender();
    } else if (event.key === "down") {
      highlightRef.current =
        highlightRef.current < filtered.length - 1
          ? highlightRef.current + 1
          : 0;
      requestRender();
    } else if (event.key === "space" || event.char === " ") {
      const item = filtered[highlightRef.current];
      if (!item) return;
      const isSelected = sel.includes(item.value);
      if (isSelected) {
        cb(sel.filter((v) => v !== item.value));
      } else {
        cb([...sel, item.value]);
      }
    } else if (event.char === "a" || event.char === "A") {
      // Select all visible (filtered) items, preserving already-selected filtered-out items
      const filteredValues = new Set(filtered.map((i) => i.value));
      const existingNonFiltered = sel.filter((v) => !filteredValues.has(v));
      cb([...existingNonFiltered, ...filtered.map((i) => i.value)]);
    } else if (event.char === "n" || event.char === "N") {
      // Deselect all visible (filtered) items, preserving selection of filtered-out items
      const filteredValues = new Set(filtered.map((i) => i.value));
      cb(sel.filter((v) => !filteredValues.has(v)));
    } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
      // Type-to-filter: add character
      filterRef.current += event.char;
      highlightRef.current = 0;
      requestRender();
    }
  }, [requestRender]);

  useInput(handleInput, { isActive: isFocused });

  // Empty items — render placeholder after all hooks
  if (items.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No items",
    );
  }

  const selectedSet = new Set(selectedValues);
  const rows: React.ReactElement[] = [];

  if (filterRef.current) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "__filter", flexDirection: "row" },
        React.createElement("tui-text", { color: colors.text.dim }, "Filter: "),
        React.createElement("tui-text", { color: colors.text.primary }, filterRef.current),
      ),
    );
  }

  // No matches
  if (filteredItems.length === 0) {
    rows.push(
      React.createElement(
        "tui-text",
        { key: "__no-match", color: colors.text.dim, dim: true },
        "  No matching items",
      ),
    );
  } else {
    for (let index = 0; index < filteredItems.length; index++) {
      const item = filteredItems[index]!;
      const isHighlighted = index === highlightRef.current;
      const isChecked = selectedSet.has(item.value);
      const checkMark = isChecked ? "\u2713" : " ";
      const checkBoxColor = isChecked ? checkColor : colors.text.dim;

      // Distinguish highlighted vs selected vs normal
      let labelColor: string | number;
      let bold = false;
      if (isHighlighted) {
        labelColor = highlightColor;
        bold = true;
      } else if (isChecked) {
        labelColor = color;
      } else {
        labelColor = colors.text.secondary;
      }

      const indicator = isHighlighted ? `${personality.interaction.selectionChar} ` : "  ";

      if (props.renderItem) {
        rows.push(
          React.createElement(
            "tui-box",
            { key: item.value, flexDirection: "row" },
            props.renderItem(item as SelectionListItem, { isHighlighted, isSelected: isChecked }),
          ),
        );
      } else {
        rows.push(
          React.createElement(
            "tui-box",
            { key: item.value, flexDirection: "row" },
            React.createElement(
              "tui-text",
              { color: isHighlighted ? highlightColor : checkBoxColor },
              `${indicator}[${checkMark}]`,
            ),
            React.createElement(
              "tui-text",
              { color: labelColor, bold },
              ` ${item.label}`,
            ),
          ),
        );
      }
    }
  }

  // Selection count indicator — show filtered count vs total
  const filteredCountText = filterRef.current
    ? `${filteredItems.length} of ${items.length} items`
    : "";
  const selectedCountText = `${selectedValues.length} of ${items.length} selected`;
  const countText = filterRef.current
    ? `${selectedCountText} | ${filteredCountText}`
    : selectedCountText;

  rows.push(
    React.createElement(
      "tui-box",
      { key: "__count" },
      React.createElement(
        "tui-text",
        { color: colors.text.dim, dim: true },
        `  ${countText}`,
      ),
    ),
  );

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    role: "listbox",
    "aria-label": props["aria-label"],
    ...pickLayoutProps(props),
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...rows,
  );
});
