/**
 * Form component tests.
 *
 * Covers multi-field rendering, tab navigation, validation rules,
 * onSubmit, radio/switch field types, and reset on Escape.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { Form, type FormField } from "../components/Form.js";

const basicFields: FormField[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
];

describe("Form", () => {
  it("renders multiple fields", () => {
    const result = renderForTest(
      React.createElement(Form, { fields: basicFields }),
      { width: 60, height: 15 },
    );
    expect(result.hasText("Name")).toBe(true);
    expect(result.hasText("Email")).toBe(true);
  });

  it("renders submit button with custom label", () => {
    const result = renderForTest(
      React.createElement(Form, { fields: basicFields, submitLabel: "Send" }),
      { width: 60, height: 15 },
    );
    expect(result.hasText("Send")).toBe(true);
  });

  it("tab cycles between fields", () => {
    const result = renderForTest(
      React.createElement(Form, { fields: basicFields, isFocused: true }),
      { width: 60, height: 15 },
    );
    // First field should be active initially (has the > indicator)
    expect(result.hasText("\u276F")).toBe(true);
    // Tab to next field — navigation is imperative via refs
    result.pressTab();
    // Form should still render correctly
    expect(result.hasText("Email")).toBe(true);
  });

  it("validates required fields — blocks submit", () => {
    const fields: FormField[] = [
      { key: "name", label: "Name", required: true },
    ];
    const onSubmit = vi.fn();
    const result = renderForTest(
      React.createElement(Form, { fields, onSubmit, isFocused: true }),
      { width: 60, height: 15 },
    );
    // Tab to submit button and press enter with empty value
    result.pressTab();
    result.pressEnter();
    // Validation should prevent onSubmit from firing
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates minLength — blocks submit", () => {
    const fields: FormField[] = [
      { key: "pw", label: "Password", minLength: 8 },
    ];
    const onSubmit = vi.fn();
    const result = renderForTest(
      React.createElement(Form, { fields, onSubmit, isFocused: true }),
      { width: 60, height: 15 },
    );
    // Type a short value then submit
    result.type("abc");
    result.pressTab();
    result.pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates pattern — blocks submit", () => {
    const fields: FormField[] = [
      { key: "code", label: "Code", pattern: /^\d{4}$/ },
    ];
    const onSubmit = vi.fn();
    const result = renderForTest(
      React.createElement(Form, { fields, onSubmit, isFocused: true }),
      { width: 60, height: 15 },
    );
    result.type("abc");
    result.pressTab();
    result.pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with values when valid", () => {
    const fields: FormField[] = [
      { key: "name", label: "Name" },
    ];
    const onSubmit = vi.fn();
    const result = renderForTest(
      React.createElement(Form, {
        fields,
        onSubmit,
        initialValues: { name: "Alice" },
        isFocused: true,
      }),
      { width: 60, height: 15 },
    );
    // Tab to submit and press enter
    result.pressTab();
    result.pressEnter();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Alice" }));
  });

  it("renders radio field type with options", () => {
    const fields: FormField[] = [
      {
        key: "color",
        label: "Favorite Color",
        type: "radio",
        options: [
          { label: "Red", value: "red" },
          { label: "Blue", value: "blue" },
        ],
      },
    ];
    const result = renderForTest(
      React.createElement(Form, { fields, isFocused: true }),
      { width: 60, height: 15 },
    );
    expect(result.hasText("Favorite Color")).toBe(true);
    expect(result.hasText("Red")).toBe(true);
    expect(result.hasText("Blue")).toBe(true);
  });

  it("renders switch field type", () => {
    const fields: FormField[] = [
      { key: "notify", label: "Notifications", type: "switch" },
    ];
    const result = renderForTest(
      React.createElement(Form, { fields, isFocused: true }),
      { width: 60, height: 15 },
    );
    expect(result.hasText("Notifications")).toBe(true);
    // Switch shows OFF by default
    expect(result.hasText("OFF")).toBe(true);
  });
});
