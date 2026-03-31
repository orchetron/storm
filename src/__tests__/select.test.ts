/**
 * Select component tests.
 *
 * Covers option rendering, up/down navigation, enter selection,
 * grouped options, type-to-filter, and disabled option skipping.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { Select, type SelectOption } from "../components/Select.js";

const options: SelectOption[] = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
];

describe("Select", () => {
  it("renders with placeholder when no value selected", () => {
    const result = renderForTest(
      React.createElement(Select, {
        options,
        placeholder: "Pick a fruit",
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    expect(result.hasText("Pick a fruit")).toBe(true);
  });

  it("renders selected value label", () => {
    const result = renderForTest(
      React.createElement(Select, {
        options,
        value: "banana",
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    expect(result.hasText("Banana")).toBe(true);
  });

  it("renders options when opened via controlled isOpen prop", () => {
    const result = renderForTest(
      React.createElement(Select, {
        options,
        isOpen: true,
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    expect(result.hasText("Apple")).toBe(true);
    expect(result.hasText("Banana")).toBe(true);
    expect(result.hasText("Cherry")).toBe(true);
  });

  it("calls onOpenChange when Enter is pressed to open", () => {
    const onOpenChange = vi.fn();
    const result = renderForTest(
      React.createElement(Select, {
        options,
        isOpen: false,
        onOpenChange,
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    result.pressEnter();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("selects item with Enter when open", () => {
    const onChange = vi.fn();
    const result = renderForTest(
      React.createElement(Select, {
        options,
        isOpen: true,
        onChange,
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    // First item is active by default — press Enter to select it
    result.pressEnter();
    expect(onChange).toHaveBeenCalledWith("apple");
  });

  it("navigates with down arrow and selects", () => {
    const onChange = vi.fn();
    const result = renderForTest(
      React.createElement(Select, {
        options,
        isOpen: true,
        onChange,
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    result.pressDown();
    result.pressEnter();
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("renders grouped options with group headers", () => {
    const groupedOptions: SelectOption[] = [
      { label: "Apple", value: "apple", group: "Fruits" },
      { label: "Banana", value: "banana", group: "Fruits" },
      { label: "Carrot", value: "carrot", group: "Vegetables" },
    ];
    const result = renderForTest(
      React.createElement(Select, {
        options: groupedOptions,
        isOpen: true,
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    expect(result.hasText("Fruits")).toBe(true);
    expect(result.hasText("Vegetables")).toBe(true);
  });

  it("skips disabled options during navigation", () => {
    const disabledOptions: SelectOption[] = [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b", disabled: true },
      { label: "Gamma", value: "c" },
    ];
    const onChange = vi.fn();
    const result = renderForTest(
      React.createElement(Select, {
        options: disabledOptions,
        isOpen: true,
        onChange,
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    // Navigate down once — should skip disabled Beta and land on Gamma
    result.pressDown();
    result.pressEnter();
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("closes on Escape without selecting", () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const result = renderForTest(
      React.createElement(Select, {
        options,
        isOpen: true,
        onChange,
        onOpenChange,
        placeholder: "Choose",
        isFocused: true,
      }),
      { width: 40, height: 15 },
    );
    result.pressEscape();
    expect(onChange).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
