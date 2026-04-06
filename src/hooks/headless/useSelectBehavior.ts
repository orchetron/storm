import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";
import { findNextNavigable as findNextNav } from "../../utils/navigation.js";

export interface SelectBehaviorOption {
  label: string;
  value: string;
  group?: string;
  disabled?: boolean;
  description?: string;
}

export interface UseSelectBehaviorOptions {
  options: SelectBehaviorOption[];
  value?: string;
  onChange?: (value: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isActive?: boolean;
  maxVisible?: number;
}

export interface UseSelectBehaviorResult {
  /** Whether the dropdown is currently open */
  isOpen: boolean;
  /** Index of the active/highlighted item in the filtered list */
  activeIndex: number;
  /** Current filter text from type-ahead */
  filterText: string;
  /** Filtered options based on current filter text */
  filteredItems: SelectBehaviorOption[];
  /** Visible items after maxVisible windowing */
  visibleItems: SelectBehaviorOption[];
  /** Offset of visible window start relative to filteredItems */
  visibleOffset: number;
  /** Open the dropdown */
  open: () => void;
  /** Close the dropdown */
  close: () => void;
  /** Props to spread on the trigger element */
  triggerProps: {
    onSelect: () => void;
  };
  /** Props for the list container */
  listProps: {
    role: string;
  };
  /** Get props for each option by its index in the visible list */
  getOptionProps: (visibleIndex: number) => {
    isActive: boolean;
    isSelected: boolean;
    isDisabled: boolean;
    option: SelectBehaviorOption;
    globalIndex: number;
  };
}

/** Find next navigable (non-disabled) index in the given direction, wrapping around. */
function findNextOption(options: SelectBehaviorOption[], from: number, direction: 1 | -1): number {
  return findNextNav(options.length, from, direction, (i) => !options[i]!.disabled);
}

function getFiltered(opts: SelectBehaviorOption[], filter: string): SelectBehaviorOption[] {
  if (!filter) return opts;
  const lower = filter.toLowerCase();
  return opts.filter((o) => o.label.toLowerCase().includes(lower));
}

export function useSelectBehavior(options: UseSelectBehaviorOptions): UseSelectBehaviorResult {
  const {
    options: items,
    value,
    onChange,
    isOpen: isOpenProp,
    onOpenChange,
    isActive = true,
    maxVisible,
  } = options;

  const forceUpdate = useForceUpdate();

  const activeIndexRef = useRef(0);
  const filterRef = useRef("");
  const internalOpenRef = useRef(false);

  const isControlled = isOpenProp !== undefined;
  const effectiveIsOpen = isControlled ? isOpenProp! : internalOpenRef.current;

  // Refs for latest prop values
  const itemsRef = useRef(items);
  itemsRef.current = items;
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

  // Sync activeIndex to current value when opening
  if (effectiveIsOpen && value !== undefined) {
    const filteredOpts = getFiltered(items, filterRef.current);
    const idx = filteredOpts.findIndex((o) => o.value === value);
    if (idx >= 0) activeIndexRef.current = idx;
  }

  if (!effectiveIsOpen) {
    filterRef.current = "";
  }

  const filteredOptions = getFiltered(items, effectiveIsOpen ? filterRef.current : "");

  // Clamp activeIndex
  if (activeIndexRef.current >= filteredOptions.length) {
    activeIndexRef.current = Math.max(0, filteredOptions.length - 1);
  }

  if (filteredOptions.length > 0 && filteredOptions[activeIndexRef.current]?.disabled) {
    activeIndexRef.current = findNextOption(filteredOptions, activeIndexRef.current, 1);
  }

  const open = useCallback(() => {
    if (!isControlledRef.current) {
      internalOpenRef.current = true;
      forceUpdate();
    }
    onOpenChangeRef.current?.(true);
  }, [forceUpdate]);

  const close = useCallback(() => {
    filterRef.current = "";
    if (!isControlledRef.current) {
      internalOpenRef.current = false;
      forceUpdate();
    }
    onOpenChangeRef.current?.(false);
  }, [forceUpdate]);

  const handleInput = useCallback((event: KeyEvent) => {
    const opts = itemsRef.current;
    if (opts.length === 0) return;

    if (isOpenRef.current) {
      const filtered = getFiltered(opts, filterRef.current);

      if (event.key === "up") {
        activeIndexRef.current = findNextOption(filtered, activeIndexRef.current, -1);
        forceUpdate();
      } else if (event.key === "down") {
        activeIndexRef.current = findNextOption(filtered, activeIndexRef.current, 1);
        forceUpdate();
      } else if (event.key === "return") {
        const selected = filtered[activeIndexRef.current];
        if (selected && !selected.disabled) {
          onChangeRef.current?.(selected.value);
          filterRef.current = "";
          if (!isControlledRef.current) {
            internalOpenRef.current = false;
            forceUpdate();
          }
          onOpenChangeRef.current?.(false);
        }
      } else if (event.key === "escape") {
        filterRef.current = "";
        if (!isControlledRef.current) {
          internalOpenRef.current = false;
          forceUpdate();
        }
        onOpenChangeRef.current?.(false);
      } else if (event.key === "backspace") {
        if (filterRef.current.length > 0) {
          filterRef.current = filterRef.current.slice(0, -1);
          activeIndexRef.current = 0;
          const newFiltered = getFiltered(opts, filterRef.current);
          if (newFiltered.length > 0 && newFiltered[0]?.disabled) {
            activeIndexRef.current = findNextOption(newFiltered, 0, 1);
          }
          forceUpdate();
        }
      } else if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
        filterRef.current += event.char;
        activeIndexRef.current = 0;
        const newFiltered = getFiltered(opts, filterRef.current);
        if (newFiltered.length > 0 && newFiltered[0]?.disabled) {
          activeIndexRef.current = findNextOption(newFiltered, 0, 1);
        }
        forceUpdate();
      }
    } else {
      if (event.key === "return") {
        if (!isControlledRef.current) {
          internalOpenRef.current = true;
          forceUpdate();
        }
        onOpenChangeRef.current?.(true);
      }
    }
  }, [forceUpdate]);

  useInput(handleInput, { isActive });

  let visibleItems: SelectBehaviorOption[];
  let visibleOffset: number;
  if (maxVisible !== undefined && filteredOptions.length > maxVisible) {
    const halfPage = Math.floor(maxVisible / 2);
    let start = Math.max(0, activeIndexRef.current - halfPage);
    start = Math.min(start, filteredOptions.length - maxVisible);
    visibleItems = filteredOptions.slice(start, start + maxVisible);
    visibleOffset = start;
  } else {
    visibleItems = filteredOptions;
    visibleOffset = 0;
  }

  const getOptionProps = useCallback((visibleIndex: number) => {
    const globalIndex = visibleIndex + visibleOffset;
    const option = visibleItems[visibleIndex]!;
    return {
      isActive: globalIndex === activeIndexRef.current,
      isSelected: option.value === valueRef.current,
      isDisabled: !!option.disabled,
      option,
      globalIndex,
    };
  }, [visibleItems, visibleOffset]);

  return {
    isOpen: effectiveIsOpen,
    activeIndex: activeIndexRef.current,
    filterText: filterRef.current,
    filteredItems: filteredOptions,
    visibleItems,
    visibleOffset,
    open,
    close,
    triggerProps: {
      onSelect: effectiveIsOpen ? close : open,
    },
    listProps: {
      role: "listbox",
    },
    getOptionProps,
  };
}
