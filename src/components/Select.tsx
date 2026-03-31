/**
 * Select — dropdown select with overlay.
 *
 * When closed, shows selected label or placeholder.
 * When open, renders a bordered dropdown with navigable options.
 * Enter opens/selects, Escape closes, Up/Down navigate.
 * Uses useRef for activeIndex — no useState.
 *
 * Features:
 * - Grouped options with group headers
 * - Disabled items (dimmed, skipped by navigation)
 * - Description field (dim text after label)
 * - Type-to-filter with indicator
 * - maxVisible scroll window
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import type { KeyEvent } from "../input/types.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { usePersonality } from "../core/personality.js";

export interface SelectOption {
  label: string;
  value: string;
  /** Optional group name. Items with the same group render under a group header. */
  group?: string;
  /** Disabled items render dimmed and are skipped by keyboard navigation. */
  disabled?: boolean;
  /** Description rendered as dim text after the label. */
  description?: string;
}

export interface SelectProps extends StormLayoutStyleProps {
  options: Array<SelectOption>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Whether the select captures keyboard input (default true). */
  isFocused?: boolean;
  /** Max visible items in dropdown. Scrolls when options exceed this. */
  maxVisible?: number;
  "aria-label"?: string;
  /** Custom renderer for each option in the dropdown. */
  renderOption?: (item: SelectOption, state: { isActive: boolean; isSelected: boolean; isDisabled: boolean }) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface SelectContextValue {
  value: string | undefined;
  onChange: (value: string) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  filter: string;
  setFilter: (filter: string) => void;
}

export const SelectContext = createContext<SelectContextValue | null>(null);

export function useSelectContext(): SelectContextValue {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error("Select sub-components must be used inside Select.Root");
  return ctx;
}

export interface SelectRootProps {
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}

function SelectRoot({ value, onChange, children }: SelectRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const openRef = useRef(false);
  const activeIndexRef = useRef(0);
  const filterRef = useRef("");

  const ctx: SelectContextValue = {
    value,
    onChange: (val: string) => { onChangeRef.current?.(val); requestRender(); },
    isOpen: openRef.current,
    setOpen: (open: boolean) => { openRef.current = open; requestRender(); },
    activeIndex: activeIndexRef.current,
    setActiveIndex: (idx: number) => { activeIndexRef.current = idx; requestRender(); },
    filter: filterRef.current,
    setFilter: (f: string) => { filterRef.current = f; requestRender(); },
  };

  return React.createElement(SelectContext.Provider, { value: ctx }, children);
}

export interface SelectTriggerProps {
  children?: React.ReactNode;
  placeholder?: string;
}

function SelectTrigger({ children, placeholder }: SelectTriggerProps): React.ReactElement {
  const colors = useColors();
  const { value, isOpen, setOpen } = useSelectContext();
  const displayLabel = value ?? placeholder;
  const displayColor = value ? colors.text.primary : colors.text.dim;
  const arrow = isOpen ? " \u25B2" : " \u25BC";

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color: displayColor }, displayLabel),
    React.createElement("tui-text", { color: colors.text.dim }, arrow),
  );
}

export interface SelectContentProps {
  maxVisible?: number;
  children: React.ReactNode;
}

function SelectContent({ maxVisible, children }: SelectContentProps): React.ReactElement | null {
  const colors = useColors();
  const personality = usePersonality();
  const { isOpen } = useSelectContext();
  if (!isOpen) return null;

  return React.createElement(
    "tui-box",
    {
      flexDirection: "column",
      borderStyle: personality.borders.default,
      borderColor: colors.brand.primary,
    },
    children,
  );
}

export interface SelectCompoundOptionProps {
  value: string;
  label?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

function SelectCompoundOption({ value: optionValue, label, disabled, children }: SelectCompoundOptionProps): React.ReactElement {
  const colors = useColors();
  const { value, onChange, setOpen } = useSelectContext();
  const isSelected = optionValue === value;

  let labelColor: string | number;
  if (disabled) {
    labelColor = colors.text.disabled;
  } else if (isSelected) {
    labelColor = colors.brand.primary;
  } else {
    labelColor = colors.text.secondary;
  }

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const displayLabel = label ?? optionValue;
  const prefix = isSelected ? "\u25B6 " : "  ";

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color: isSelected ? colors.brand.primary : colors.text.dim }, prefix),
    React.createElement(
      "tui-text",
      { color: labelColor, bold: isSelected && !disabled, dim: disabled },
      displayLabel,
    ),
  );
}

// ── Recipe API (original) ───────────────────────────────────────

/** Find next navigable (non-disabled) index in the given direction, wrapping around. */
function findNextNavigable(options: SelectOption[], from: number, direction: 1 | -1): number {
  const len = options.length;
  if (len === 0) return from;
  let idx = from;
  for (let i = 0; i < len; i++) {
    idx = (idx + direction + len) % len;
    if (!options[idx]!.disabled) return idx;
  }
  return from; // all disabled
}

const SelectBase = React.memo(function Select(rawProps: SelectProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Select", rawProps as unknown as Record<string, unknown>) as unknown as SelectProps;
  const {
    options,
    value,
    onChange,
    placeholder = "Select...",
    isOpen,
    onOpenChange,
    color = colors.brand.primary,
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
    isFocused = true,
    maxVisible,
  } = props;

  const { requestRender } = useTui();

  const activeIndexRef = useRef(0);
  const filterRef = useRef("");

  // Internal uncontrolled open state — used when isOpen prop is not provided
  const internalOpenRef = useRef(false);
  const isControlled = props.isOpen !== undefined;
  const effectiveIsOpen = isControlled ? isOpen : internalOpenRef.current;

  // Refs for latest prop values
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const isOpenRef = useRef(effectiveIsOpen);
  isOpenRef.current = effectiveIsOpen;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  // Compute filtered options (filter by label, exclude nothing — disabled still shown)
  const getFiltered = (opts: SelectOption[], filter: string): SelectOption[] => {
    if (!filter) return opts;
    const lower = filter.toLowerCase();
    return opts.filter((o) => o.label.toLowerCase().includes(lower));
  };

  // Sync activeIndex to current value when opening
  if (effectiveIsOpen && value !== undefined) {
    const filteredOpts = getFiltered(options, filterRef.current);
    const idx = filteredOpts.findIndex((o) => o.value === value);
    if (idx >= 0) activeIndexRef.current = idx;
  }

  // Clear filter when closed
  if (!effectiveIsOpen) {
    filterRef.current = "";
  }

  // Compute filtered options for render
  const filteredOptions = getFiltered(options, effectiveIsOpen ? filterRef.current : "");

  // Clamp activeIndex
  if (activeIndexRef.current >= filteredOptions.length) {
    activeIndexRef.current = Math.max(0, filteredOptions.length - 1);
  }

  // Ensure activeIndex points to a non-disabled item
  if (filteredOptions.length > 0 && filteredOptions[activeIndexRef.current]?.disabled) {
    activeIndexRef.current = findNextNavigable(filteredOptions, activeIndexRef.current, 1);
  }

  const handleInput = useCallback((event: KeyEvent) => {
    const opts = optionsRef.current;
    if (opts.length === 0) return;

    if (isOpenRef.current) {
      const filtered = getFiltered(opts, filterRef.current);

      if (event.key === "up") {
        activeIndexRef.current = findNextNavigable(filtered, activeIndexRef.current, -1);
        requestRender();
      } else if (event.key === "down") {
        activeIndexRef.current = findNextNavigable(filtered, activeIndexRef.current, 1);
        requestRender();
      } else if (event.key === "return") {
        const selected = filtered[activeIndexRef.current];
        if (selected && !selected.disabled) {
          onChangeRef.current?.(selected.value);
          filterRef.current = "";
          if (!isControlledRef.current) {
            internalOpenRef.current = false;
            requestRender();
          }
          onOpenChangeRef.current?.(false);
        }
      } else if (event.key === "escape") {
        filterRef.current = "";
        if (!isControlledRef.current) {
          internalOpenRef.current = false;
          requestRender();
        }
        onOpenChangeRef.current?.(false);
      } else if (event.key === "backspace") {
        if (filterRef.current.length > 0) {
          filterRef.current = filterRef.current.slice(0, -1);
          activeIndexRef.current = 0;
          // Re-clamp to non-disabled
          const newFiltered = getFiltered(opts, filterRef.current);
          if (newFiltered.length > 0 && newFiltered[0]?.disabled) {
            activeIndexRef.current = findNextNavigable(newFiltered, 0, 1);
          }
          requestRender();
        }
      } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
        filterRef.current += event.char;
        activeIndexRef.current = 0;
        const newFiltered = getFiltered(opts, filterRef.current);
        if (newFiltered.length > 0 && newFiltered[0]?.disabled) {
          activeIndexRef.current = findNextNavigable(newFiltered, 0, 1);
        }
        requestRender();
      }
    } else {
      if (event.key === "return") {
        if (!isControlledRef.current) {
          internalOpenRef.current = true;
          requestRender();
        }
        onOpenChangeRef.current?.(true);
      }
    }
  }, [requestRender]);

  useInput(handleInput, { isActive: isFocused });

  // Find selected label
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const displayColor = selectedOption ? colors.text.primary : colors.text.dim;

  const boxProps: Record<string, unknown> = { role: "listbox", flexDirection: "column", "aria-label": props["aria-label"] };
  if (width !== undefined) boxProps["width"] = width;
  if (height !== undefined) boxProps["height"] = height;
  if (margin !== undefined) boxProps["margin"] = margin;
  if (marginX !== undefined) boxProps["marginX"] = marginX;
  if (marginY !== undefined) boxProps["marginY"] = marginY;
  if (marginTop !== undefined) boxProps["marginTop"] = marginTop;
  if (marginBottom !== undefined) boxProps["marginBottom"] = marginBottom;
  if (marginLeft !== undefined) boxProps["marginLeft"] = marginLeft;
  if (marginRight !== undefined) boxProps["marginRight"] = marginRight;
  if (minWidth !== undefined) boxProps["minWidth"] = minWidth;
  if (maxWidth !== undefined) boxProps["maxWidth"] = maxWidth;

  // Empty options — render placeholder instead of dropdown
  if (options.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "No options",
    );
  }

  if (!effectiveIsOpen) {
    // Closed state: show selected value with dropdown arrow
    return React.createElement(
      "tui-box",
      { ...boxProps, flexDirection: "row" },
      React.createElement("tui-text", { color: displayColor }, displayLabel),
      React.createElement("tui-text", { color: colors.text.dim }, " \u25BC"),
    );
  }

  // Open state: show trigger + dropdown list
  const children: React.ReactElement[] = [];

  // Trigger row
  children.push(
    React.createElement(
      "tui-box",
      { key: "trigger", flexDirection: "row" },
      React.createElement("tui-text", { color: displayColor }, displayLabel),
      React.createElement("tui-text", { color: colors.text.dim }, " \u25B2"),
    ),
  );

  // Filter text indicator
  if (filterRef.current) {
    children.push(
      React.createElement(
        "tui-box",
        { key: "filter", flexDirection: "row" },
        React.createElement("tui-text", { color: colors.text.dim }, "Filter: "),
        React.createElement("tui-text", { color: colors.text.primary }, filterRef.current),
      ),
    );
  }

  // Dropdown list with border — apply maxVisible scroll window
  const visibleOptions = maxVisible !== undefined && filteredOptions.length > maxVisible
    ? (() => {
        const halfPage = Math.floor(maxVisible / 2);
        let start = Math.max(0, activeIndexRef.current - halfPage);
        start = Math.min(start, filteredOptions.length - maxVisible);
        return { items: filteredOptions.slice(start, start + maxVisible), offset: start };
      })()
    : { items: filteredOptions, offset: 0 };

  // Track which groups we've already rendered headers for
  const renderedGroups = new Set<string>();
  const optionElements: React.ReactElement[] = [];

  for (let i = 0; i < visibleOptions.items.length; i++) {
    const option = visibleOptions.items[i]!;
    const index = i + visibleOptions.offset;
    const isActive = index === activeIndexRef.current;
    const isSelected = option.value === value;
    const isDisabled = !!option.disabled;

    // Group header — render before first item of each group
    if (option.group && !renderedGroups.has(option.group)) {
      renderedGroups.add(option.group);
      // Group header: bold label + dim separator
      optionElements.push(
        React.createElement(
          "tui-box",
          { key: `group-${option.group}`, flexDirection: "column" },
          React.createElement(
            "tui-text",
            { bold: true, color: colors.text.primary },
            `  ${option.group}`,
          ),
          React.createElement(
            "tui-text",
            { color: colors.text.dim, dim: true },
            "  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
          ),
        ),
      );
    }

    let labelColor: string | number;
    if (isDisabled) {
      labelColor = colors.text.disabled;
    } else if (isActive) {
      labelColor = color;
    } else if (isSelected) {
      labelColor = colors.text.primary;
    } else {
      labelColor = colors.text.secondary;
    }

    const prefix = isActive ? "\u25B6 " : "  ";
    const itemChildren: React.ReactElement[] = [
      React.createElement("tui-text", { key: "prefix", color: isActive ? color : colors.text.dim }, prefix),
      React.createElement(
        "tui-text",
        { key: "label", color: labelColor, bold: isActive && !isDisabled, dim: isDisabled },
        option.label,
      ),
    ];

    // Description (dim text after label)
    if (option.description) {
      itemChildren.push(
        React.createElement(
          "tui-text",
          { key: "desc", color: colors.text.dim, dim: true },
          ` - ${option.description}`,
        ),
      );
    }

    if (props.renderOption) {
      optionElements.push(
        React.createElement(
          "tui-box",
          { key: option.value, flexDirection: "row" },
          props.renderOption(option, { isActive, isSelected, isDisabled }),
        ),
      );
    } else {
      optionElements.push(
        React.createElement(
          "tui-box",
          { key: option.value, flexDirection: "row" },
          ...itemChildren,
        ),
      );
    }
  }

  children.push(
    React.createElement(
      "tui-box",
      {
        key: "dropdown",
        flexDirection: "column",
        borderStyle: personality.borders.default,
        borderColor: color,
      },
      ...optionElements,
    ),
  );

  return React.createElement("tui-box", boxProps, ...children);
});

// ── Static compound assignments ─────────────────────────────────
export const Select = Object.assign(SelectBase, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Option: SelectCompoundOption,
});
