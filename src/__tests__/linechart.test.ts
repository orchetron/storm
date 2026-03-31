/**
 * LineChart component tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { LineChart } from "../components/LineChart.js";

describe("LineChart", () => {
  it("renders with data", () => {
    const result = renderForTest(
      React.createElement(LineChart, {
        series: [{ data: [10, 20, 30, 40, 50], name: "Throughput" }],
        width: 40, height: 8,
      }),
      { width: 50, height: 15 },
    );
    // Chart renders braille characters in the 0x2800 range
    expect(result.output.length).toBeGreaterThan(0);
    // Should not show "(no data)" message
    expect(result.hasText("(no data)")).toBe(false);
  });

  it("shows Y-axis labels when showAxes=true", () => {
    const result = renderForTest(
      React.createElement(LineChart, {
        series: [{ data: [0, 50, 100], name: "Test" }],
        width: 40, height: 8, showAxes: true,
      }),
      { width: 50, height: 15 },
    );
    // Y-axis renders the vertical bar character
    expect(result.output.includes("\u2502")).toBe(true); // │
  });

  it("shows legend for multiple series", () => {
    const result = renderForTest(
      React.createElement(LineChart, {
        series: [
          { data: [10, 20, 30], name: "CPU" },
          { data: [5, 15, 25], name: "Memory" },
        ],
        width: 40, height: 8,
      }),
      { width: 50, height: 15 },
    );
    expect(result.hasText("CPU")).toBe(true);
    expect(result.hasText("Memory")).toBe(true);
  });

  it("handles empty data", () => {
    const result = renderForTest(
      React.createElement(LineChart, {
        series: [{ data: [], name: "Empty" }],
        width: 40, height: 8,
      }),
      { width: 50, height: 15 },
    );
    expect(result.hasText("(no data)")).toBe(true);
  });

  it("renders title when provided", () => {
    const result = renderForTest(
      React.createElement(LineChart, {
        series: [{ data: [1, 2, 3], name: "S1" }],
        width: 40, height: 8, title: "Performance",
      }),
      { width: 50, height: 15 },
    );
    expect(result.hasText("Performance")).toBe(true);
  });

  it("hides legend for single series by default", () => {
    const result = renderForTest(
      React.createElement(LineChart, {
        series: [{ data: [1, 2, 3], name: "Solo" }],
        width: 40, height: 8,
      }),
      { width: 50, height: 15 },
    );
    // Single series does not show legend by default
    expect(result.hasText("Solo")).toBe(false);
  });
});
