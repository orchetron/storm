/**
 * RadioGroup — single-selection radio button list.
 *
 * Renders ● for selected, ○ for unselected.
 * Up/Down navigates, Enter/Space selects.
 */

import React, { useCallback, useRef, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import type { KeyEvent } from "../input/types.js";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { usePersonality } from "../core/personality.js";

export interface RadioOption {
  value: string;
  label: string;
  /** Description text rendered as dim text below the label. */
  description?: string;
  /** When true, option is dimmed and skipped by navigation. */
  disabled?: boolean;
}

export interface RadioGroupProps extends StormLayoutStyleProps {
  options: readonly RadioOption[];
  value: string;
  onChange?: (value: string) => void;
  direction?: "column" | "row";
  isFocused?: boolean;
  /** Custom render for each radio option. */
  renderOption?: (option: RadioOption, state: { isSelected: boolean; isHighlighted: boolean; isDisabled: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

// ── Compound Component API ──────────────────────────────────────

export interface RadioGroupContextValue {
  value: string;
  highlightIndex: number;
  select: (value: string) => void;
  setHighlightIndex: (index: number) => void;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export function useRadioGroupContext(): RadioGroupContextValue {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) throw new Error("RadioGroup sub-components must be used inside RadioGroup.Root");
  return ctx;
}

export interface RadioGroupRootProps {
  value: string;
  onChange?: (value: string) => void;
  highlightIndex?: number;
  onHighlightChange?: (index: number) => void;
  children: React.ReactNode;
}

function RadioGroupRoot({
  value,
  onChange,
  highlightIndex = 0,
  onHighlightChange,
  children,
}: RadioGroupRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onHighlightRef = useRef(onHighlightChange);
  onHighlightRef.current = onHighlightChange;

  const ctx: RadioGroupContextValue = {
    value,
    highlightIndex,
    select: (v: string) => { onChangeRef.current?.(v); requestRender(); },
    setHighlightIndex: (i: number) => { onHighlightRef.current?.(i); requestRender(); },
  };

  return React.createElement(
    RadioGroupContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface RadioGroupCompoundOptionProps {
  option: RadioOption;
  index?: number;
  children?: React.ReactNode;
}

function RadioGroupCompoundOption({ option, index = 0, children }: RadioGroupCompoundOptionProps): React.ReactElement {
  const colors = useColors();
  const { value, highlightIndex } = useRadioGroupContext();
  const isSelected = option.value === value;
  const isHighlighted = index === highlightIndex;
  const isDisabled = option.disabled === true;
  const indicator = isSelected ? "\u25CF" : "\u25CB";
  const indicatorColor = isDisabled ? colors.text.disabled : isSelected ? colors.brand.primary : colors.text.dim;

  if (children) {
    return React.createElement("tui-box", { flexDirection: "column" }, children);
  }

  const optionChildren: React.ReactElement[] = [];
  optionChildren.push(
    React.createElement(
      "tui-box",
      { key: "row", flexDirection: "row" },
      React.createElement(
        "tui-text",
        { color: indicatorColor, ...(isDisabled ? { dim: true } : {}) },
        ` ${indicator} `,
      ),
      React.createElement(
        "tui-text",
        isDisabled ? { dim: true, color: colors.text.disabled } : isHighlighted ? { bold: true } : {},
        option.label,
      ),
    ),
  );

  if (option.description !== undefined) {
    optionChildren.push(
      React.createElement(
        "tui-text",
        { key: "desc", dim: true, color: colors.text.dim },
        `    ${option.description}`,
      ),
    );
  }

  return React.createElement("tui-box", { flexDirection: "column" }, ...optionChildren);
}

// ── Recipe API ─────────────────────────────────────────────────

const FILLED = "\u25CF"; // ●
const EMPTY = "\u25CB";  // ○

const RadioGroupBase = React.memo(function RadioGroup(rawProps: RadioGroupProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("RadioGroup", rawProps as unknown as Record<string, unknown>) as unknown as RadioGroupProps;
  const {
    options,
    value,
    onChange,
    color = colors.brand.primary,
    bold: boldProp,
    dim: dimProp,
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
    direction = "column",
    isFocused = true,
  } = props;

  const { requestRender } = useTui();

  // Track highlighted index for keyboard navigation via ref + imperative mutation
  const selectedIdx = options.findIndex((o) => o.value === value);
  const highlightRef = useRef(selectedIdx >= 0 ? selectedIdx : 0);

  // Pure clamp
  if (highlightRef.current >= options.length) {
    highlightRef.current = Math.max(0, options.length - 1);
  }
  const effectiveIndex = highlightRef.current;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleInput = useCallback(
    (event: KeyEvent) => {
      // Helper: find next non-disabled index in a direction
      const findNext = (from: number, dir: 1 | -1): number => {
        let idx = from;
        for (let i = 0; i < options.length; i++) {
          idx = (idx + dir + options.length) % options.length;
          if (!options[idx]?.disabled) return idx;
        }
        return from; // all disabled, stay put
      };

      if (event.key === "up" || (direction === "row" && event.key === "left")) {
        highlightRef.current = findNext(highlightRef.current, -1);
        requestRender();
      } else if (
        event.key === "down" ||
        (direction === "row" && event.key === "right")
      ) {
        highlightRef.current = findNext(highlightRef.current, 1);
        requestRender();
      } else if (event.key === "return" || event.char === " ") {
        const opt = options[highlightRef.current];
        if (opt && !opt.disabled) {
          onChangeRef.current?.(opt.value);
        }
      } else if (event.char && event.char.length === 1 && /[a-zA-Z0-9]/.test(event.char)) {
        // Type-ahead: jump to first non-disabled option starting with this letter
        const ch = event.char.toLowerCase();
        const idx = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(ch));
        if (idx >= 0) {
          highlightRef.current = idx;
          requestRender();
        }
      }
    },
    [options, direction, requestRender],
  );

  useInput(handleInput, { isActive: isFocused && onChange !== undefined });

  const outerBoxProps: Record<string, unknown> = {
    role: "radiogroup",
    flexDirection: direction === "row" ? "row" : "column",
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

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...options.map((option, index) => {
      const isSelected = option.value === value;
      const isHighlighted = index === effectiveIndex;
      const isDisabled = option.disabled === true;

      if (props.renderOption) {
        return React.createElement(
          "tui-box",
          {
            key: option.value,
            flexDirection: "column",
            ...(direction === "row" ? { marginRight: 2 } : {}),
          },
          props.renderOption(option, { isSelected, isHighlighted, isDisabled }),
        );
      }

      const indicator = isSelected ? FILLED : EMPTY;
      const indicatorColor = isDisabled ? colors.text.disabled : isSelected ? color : colors.text.dim;

      const optionChildren: React.ReactElement[] = [];

      // Focus indicator prefix — style from personality
      const focusChars: Record<string, string> = { arrow: "> ", bar: "\u258C ", highlight: "\u25B8 ", border: "> " };
      const focusChar = focusChars[personality.interaction.focusIndicator] ?? "> ";
      const focusPrefix = isHighlighted && !isDisabled ? focusChar : " ".repeat(focusChar.length);

      // Main row: focus indicator + radio indicator + label
      optionChildren.push(
        React.createElement(
          "tui-box",
          { key: "row", flexDirection: "row" },
          React.createElement(
            "tui-text",
            { color: isHighlighted ? colors.brand.primary : undefined, bold: isHighlighted && !isDisabled },
            focusPrefix,
          ),
          React.createElement(
            "tui-text",
            { color: indicatorColor, ...(isDisabled ? { dim: true } : {}) },
            `${indicator} `,
          ),
          React.createElement(
            "tui-text",
            isDisabled ? { dim: true, color: colors.text.disabled } : isHighlighted ? { bold: true } : {},
            option.label,
          ),
        ),
      );

      // Description below label
      if (option.description !== undefined) {
        optionChildren.push(
          React.createElement(
            "tui-text",
            { key: "desc", dim: true, color: colors.text.dim },
            `    ${option.description}`,
          ),
        );
      }

      return React.createElement(
        "tui-box",
        {
          key: option.value,
          flexDirection: "column",
          ...(direction === "row" ? { marginRight: 2 } : {}),
        },
        ...optionChildren,
      );
    }),
  );
});

// ── Static compound assignments ─────────────────────────────────
export const RadioGroup = Object.assign(RadioGroupBase, {
  Root: RadioGroupRoot,
  Option: RadioGroupCompoundOption,
});
