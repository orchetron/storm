/**
 * Modal component tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { Modal } from "../components/index.js";

describe("Modal", () => {
  it("renders children when visible", () => {
    const result = renderForTest(
      React.createElement(Modal, { visible: true },
        React.createElement("tui-text", null, "Modal body"),
      ),
      { width: 60, height: 20 },
    );
    expect(result.hasText("Modal body")).toBe(true);
  });

  it("renders nothing when not visible", () => {
    const result = renderForTest(
      React.createElement(Modal, { visible: false },
        React.createElement("tui-text", null, "Hidden content"),
      ),
      { width: 60, height: 20 },
    );
    expect(result.hasText("Hidden content")).toBe(false);
  });

  it("renders title when provided", () => {
    const result = renderForTest(
      React.createElement(Modal, { visible: true, title: "Confirm Action" },
        React.createElement("tui-text", null, "Are you sure?"),
      ),
      { width: 60, height: 20 },
    );
    expect(result.hasText("Confirm Action")).toBe(true);
    expect(result.hasText("Are you sure?")).toBe(true);
  });

  it("shows esc hint when onClose is provided", () => {
    const result = renderForTest(
      React.createElement(Modal, { visible: true, onClose: () => {} },
        React.createElement("tui-text", null, "Content"),
      ),
      { width: 60, height: 20 },
    );
    expect(result.hasText("[Esc to close]")).toBe(true);
  });

  it("renders compound API with Root/Title/Body/Footer", () => {
    const result = renderForTest(
      React.createElement(Modal.Root, { visible: true },
        React.createElement(Modal.Title, null, "Settings"),
        React.createElement(Modal.Body, null,
          React.createElement("tui-text", null, "Body content"),
        ),
        React.createElement(Modal.Footer, null,
          React.createElement("tui-text", null, "Save"),
        ),
      ),
      { width: 60, height: 20 },
    );
    expect(result.hasText("Settings")).toBe(true);
    expect(result.hasText("Body content")).toBe(true);
    expect(result.hasText("Save")).toBe(true);
  });
});
