/**
 * Badge component tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { Badge } from "../components/Badge.js";

describe("Badge", () => {
  it("renders with label in default mode", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Active" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("(Active)")).toBe(true);
  });

  it("renders success variant with dot prefix", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "OK", variant: "success" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("\u25CF OK")).toBe(true); // ● OK
  });

  it("renders warning variant", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Warn", variant: "warning" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("\u25CF Warn")).toBe(true);
  });

  it("renders error variant", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Fail", variant: "error" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("\u25CF Fail")).toBe(true);
  });

  it("renders dot mode with just a colored dot", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Status", mode: "dot" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("\u25CF")).toBe(true); // ●
    // Should NOT show the label text in dot mode
    expect(result.hasText("Status")).toBe(false);
  });

  it("renders count mode with number", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Notif", mode: "count", count: 5 }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("5")).toBe(true);
  });

  it("renders count mode with overflow", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Notif", mode: "count", count: 150, max: 99 }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("99+")).toBe(true);
  });
});
