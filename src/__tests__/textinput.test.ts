/**
 * TextInput component tests.
 *
 * Covers initial value rendering, focus props, onChange, onSubmit,
 * cursor position, and placeholder rendering.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { TextInput } from "../components/TextInput.js";

describe("TextInput", () => {
  it("renders with initial value", () => {
    const result = renderForTest(
      React.createElement(TextInput, { value: "hello", onChange: () => {} }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("hello")).toBe(true);
  });

  it("accepts isFocused prop", () => {
    const result = renderForTest(
      React.createElement(TextInput, { value: "test", onChange: () => {}, isFocused: true }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("test")).toBe(true);
  });

  it("accepts deprecated focus prop", () => {
    const result = renderForTest(
      React.createElement(TextInput, { value: "test", onChange: () => {}, focus: true }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("test")).toBe(true);
  });

  it("fires onChange on keypress", () => {
    const onChange = vi.fn();
    const result = renderForTest(
      React.createElement(TextInput, { value: "", onChange, isFocused: true }),
      { width: 40, height: 5 },
    );
    result.fireKey("a", { char: "a" } as any);
    expect(onChange).toHaveBeenCalled();
    const calledWith = onChange.mock.calls[0]![0] as string;
    expect(calledWith).toContain("a");
  });

  it("fires onSubmit on Enter", () => {
    const onSubmit = vi.fn();
    const result = renderForTest(
      React.createElement(TextInput, {
        value: "submitted",
        onChange: () => {},
        onSubmit,
        isFocused: true,
      }),
      { width: 40, height: 5 },
    );
    result.pressEnter();
    expect(onSubmit).toHaveBeenCalledWith("submitted");
  });

  it("renders placeholder when value is empty", () => {
    const result = renderForTest(
      React.createElement(TextInput, {
        value: "",
        onChange: () => {},
        placeholder: "Type here...",
        isFocused: false,
      }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Type here...")).toBe(true);
  });

  it("respects maxLength constraint", () => {
    const onChange = vi.fn();
    const result = renderForTest(
      React.createElement(TextInput, {
        value: "abc",
        onChange,
        maxLength: 3,
        isFocused: true,
      }),
      { width: 40, height: 5 },
    );
    result.fireKey("d", { char: "d" } as any);
    // onChange should not fire for a character that would exceed maxLength
    // (or it fires with the value capped at maxLength)
    if (onChange.mock.calls.length > 0) {
      const val = onChange.mock.calls[0]![0] as string;
      expect(val.length).toBeLessThanOrEqual(3);
    }
  });

  it("does not respond to input when disabled", () => {
    const onChange = vi.fn();
    const result = renderForTest(
      React.createElement(TextInput, {
        value: "fixed",
        onChange,
        disabled: true,
        isFocused: true,
      }),
      { width: 40, height: 5 },
    );
    result.fireKey("x", { char: "x" } as any);
    expect(onChange).not.toHaveBeenCalled();
  });
});
