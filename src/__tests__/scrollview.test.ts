/**
 * ScrollView component tests.
 *
 * Covers height constraints, dev warnings, stickToBottom, keyboard scroll,
 * multiple children, windowing, horizontal scroll, and scrollStateRef.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { ScrollView } from "../components/index.js";

describe("ScrollView", () => {
  it("renders children within a height constraint", () => {
    const result = renderForTest(
      React.createElement(ScrollView, { height: 5 },
        React.createElement("tui-text", null, "Line A"),
        React.createElement("tui-text", null, "Line B"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Line A")).toBe(true);
    expect(result.hasText("Line B")).toBe(true);
  });

  it("emits dev warning when no height/flex constraint is set", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    renderForTest(
      React.createElement(ScrollView, {},
        React.createElement("tui-text", null, "content"),
      ),
      { width: 40, height: 10 },
    );
    const warningCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(warningCalls.some((msg) => msg.includes("no height constraint"))).toBe(true);
    stderrSpy.mockRestore();
  });

  it("does not warn when flex is provided", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    renderForTest(
      React.createElement(ScrollView, { flex: 1 },
        React.createElement("tui-text", null, "content"),
      ),
      { width: 40, height: 10 },
    );
    const warningCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(warningCalls.some((msg) => msg.includes("no height constraint"))).toBe(false);
    stderrSpy.mockRestore();
  });

  it("renders with stickToBottom enabled", () => {
    const result = renderForTest(
      React.createElement(ScrollView, { height: 3, stickToBottom: true },
        React.createElement("tui-text", null, "First"),
        React.createElement("tui-text", null, "Second"),
        React.createElement("tui-text", null, "Third"),
        React.createElement("tui-text", null, "Fourth"),
        React.createElement("tui-text", null, "Fifth"),
      ),
      { width: 40, height: 10 },
    );
    // stickToBottom should keep the last content visible
    expect(result.hasText("Fifth")).toBe(true);
  });

  it("handles pageup/pagedown keyboard events without crashing", () => {
    const ref = { current: null } as React.MutableRefObject<any>;
    const result = renderForTest(
      React.createElement(ScrollView, { height: 5, scrollStateRef: ref },
        ...Array.from({ length: 20 }, (_, i) =>
          React.createElement("tui-text", { key: `line-${i}` }, `Line ${i}`),
        ),
      ),
      { width: 40, height: 10 },
    );
    // Verify scrollState is initialized
    expect(ref.current).not.toBeNull();
    // Fire pagedown — should not throw
    result.fireKey("pagedown");
    result.fireKey("pageup");
    // ScrollView still renders after keyboard events
    expect(result.output).toBeDefined();
  });

  it("renders multiple children correctly", () => {
    const result = renderForTest(
      React.createElement(ScrollView, { height: 10 },
        React.createElement("tui-text", null, "Alpha"),
        React.createElement("tui-text", null, "Bravo"),
        React.createElement("tui-text", null, "Charlie"),
        React.createElement("tui-text", null, "Delta"),
      ),
      { width: 40, height: 12 },
    );
    expect(result.hasText("Alpha")).toBe(true);
    expect(result.hasText("Bravo")).toBe(true);
    expect(result.hasText("Charlie")).toBe(true);
    expect(result.hasText("Delta")).toBe(true);
  });

  it("triggers windowing for large child counts (>500) without crashing", () => {
    // With maxRenderChildren default of 500, passing 600 children should not crash
    // and windowing should kick in to only render a subset
    const ref = { current: null } as React.MutableRefObject<any>;
    const result = renderForTest(
      React.createElement(ScrollView, { height: 10, scrollStateRef: ref },
        ...Array.from({ length: 600 }, (_, i) =>
          React.createElement("tui-text", { key: `item-${i}` }, `Item ${i}`),
        ),
      ),
      { width: 40, height: 12 },
    );
    // Windowing should activate — verify the component rendered and scrollState exists
    expect(ref.current).not.toBeNull();
    expect(result.output).toBeDefined();
  });

  it("supports horizontalScroll prop", () => {
    const result = renderForTest(
      React.createElement(ScrollView, { height: 5, horizontalScroll: true },
        React.createElement("tui-text", null, "A".repeat(100)),
      ),
      { width: 20, height: 10 },
    );
    // Should render without errors and contain content
    expect(result.output).toBeTruthy();
  });

  it("exposes scrollToBottom via scrollStateRef", () => {
    const ref = { current: null } as React.MutableRefObject<any>;
    renderForTest(
      React.createElement(ScrollView, { height: 5, scrollStateRef: ref },
        React.createElement("tui-text", null, "content"),
      ),
      { width: 40, height: 10 },
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current.scrollToBottom).toBe("function");
    expect(typeof ref.current.scrollToElement).toBe("function");
  });
});
