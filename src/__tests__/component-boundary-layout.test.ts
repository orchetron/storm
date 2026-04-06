/**
 * Regression tests for layout correctness:
 *
 * 1. Component-returned children must produce identical layout to inline JSX.
 * 2. commitUpdate must properly invalidate the layout cache when props change.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "../reconciler/render-to-string.js";
import { Box, Text } from "../components/index.js";

describe("Component boundary layout", () => {
  it("inline vs component-returned children produce identical output (raw elements)", () => {
    const width = 40;
    const height = 10;

    function MyFooter() {
      return React.createElement("tui-box", { height: 1, flexShrink: 0, overflow: "hidden", flexDirection: "row", paddingX: 1, backgroundColor: "#CBD5E1" },
        React.createElement("tui-text", null, "Footer"));
    }

    const inlineEl = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height, backgroundColor: "#E2E8F0", opaque: true },
      React.createElement("tui-box", { height: 1, backgroundColor: "#CBD5E1" },
        React.createElement("tui-text", null, "HEADER")),
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "Content")),
      React.createElement("tui-box", { height: 1, flexShrink: 0, overflow: "hidden", flexDirection: "row", paddingX: 1, backgroundColor: "#CBD5E1" },
        React.createElement("tui-text", null, "Footer")),
    );

    const componentEl = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height, backgroundColor: "#E2E8F0", opaque: true },
      React.createElement("tui-box", { height: 1, backgroundColor: "#CBD5E1" },
        React.createElement("tui-text", null, "HEADER")),
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "Content")),
      React.createElement(MyFooter),
    );

    const inlineResult = renderToString(inlineEl, { width, height });
    const componentResult = renderToString(componentEl, { width, height });

    expect(inlineResult.output).toContain("HEADER");
    expect(componentResult.output).toContain("HEADER");
    expect(componentResult.output).toBe(inlineResult.output);
  });

  it("inline vs component-returned children produce identical output (Box/Text)", () => {
    const width = 80;
    const height = 24;

    function MyFooter() {
      return React.createElement(Box, { height: 1, flexShrink: 0, overflow: "hidden", flexDirection: "row", paddingX: 1, backgroundColor: "#CBD5E1" },
        React.createElement(Text, { color: "#111827", bold: true }, "\u26A1 storm"),
        React.createElement(Box, { flex: 1 }),
        React.createElement(Text, { color: "#6B7280" }, "tokens:10.4K"));
    }

    const inlineEl = React.createElement(
      Box,
      { flexDirection: "column", width, height, backgroundColor: "#E2E8F0", opaque: true },
      React.createElement(Box, { height: 1, backgroundColor: "#CBD5E1" },
        React.createElement(Text, { color: "#111827", bold: true }, "HEADER")),
      React.createElement(Box, { flex: 1 },
        React.createElement(Text, { color: "#111827" }, "Content area")),
      React.createElement(Box, { height: 1, flexShrink: 0, overflow: "hidden", flexDirection: "row", paddingX: 1, backgroundColor: "#CBD5E1" },
        React.createElement(Text, { color: "#111827", bold: true }, "\u26A1 storm"),
        React.createElement(Box, { flex: 1 }),
        React.createElement(Text, { color: "#6B7280" }, "tokens:10.4K")),
    );

    const componentEl = React.createElement(
      Box,
      { flexDirection: "column", width, height, backgroundColor: "#E2E8F0", opaque: true },
      React.createElement(Box, { height: 1, backgroundColor: "#CBD5E1" },
        React.createElement(Text, { color: "#111827", bold: true }, "HEADER")),
      React.createElement(Box, { flex: 1 },
        React.createElement(Text, { color: "#111827" }, "Content area")),
      React.createElement(MyFooter),
    );

    const f8Result = renderToString(inlineEl, { width, height });
    const f11Result = renderToString(componentEl, { width, height });

    expect(f8Result.lines[0]).toContain("HEADER");
    expect(f11Result.lines[0]).toContain("HEADER");
    expect(f11Result.output).toBe(f8Result.output);
  });
});

describe("commitUpdate layout cache invalidation", () => {
  it("layout updates correctly when props change via rerender", () => {
    const width = 40;
    const height = 10;

    // First render: child has height=3
    const el1 = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      React.createElement("tui-box", { height: 3, backgroundColor: "#CBD5E1" },
        React.createElement("tui-text", null, "AAA")),
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "BBB")),
    );

    const result = renderToString(el1, { width, height });
    expect(result.lines[0]).toContain("AAA");
    // BBB should be at line 3 (after the height=3 box)
    expect(result.lines[3]).toContain("BBB");

    // Second render: child changes to height=1 — layout must update
    const el2 = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      React.createElement("tui-box", { height: 1, backgroundColor: "#CBD5E1" },
        React.createElement("tui-text", null, "AAA")),
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "BBB")),
    );

    const result2 = result.rerender(el2);
    // AAA should still be on line 0
    expect(result2.lines[0]).toContain("AAA");
    // BBB should now be on line 1 (not line 3)
    expect(result2.lines[1]).toContain("BBB");
    // Line 3 should NOT have BBB (stale layout)
    expect(result2.lines[3] ?? "").not.toContain("BBB");
  });

  it("flex to fixed height switch updates layout correctly", () => {
    const width = 40;
    const height = 10;

    // First render: child has flex=1
    const el1 = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "STRETCHY")),
      React.createElement("tui-box", { height: 1 },
        React.createElement("tui-text", null, "FIXED")),
    );

    const result = renderToString(el1, { width, height });
    // STRETCHY should be on line 0
    expect(result.lines[0]).toContain("STRETCHY");
    // FIXED should be on last line
    expect(result.lines[height - 1]).toContain("FIXED");

    // Second render: first child changes from flex=1 to height=2
    const el2 = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      React.createElement("tui-box", { height: 2 },
        React.createElement("tui-text", null, "STRETCHY")),
      React.createElement("tui-box", { height: 1 },
        React.createElement("tui-text", null, "FIXED")),
    );

    const result2 = result.rerender(el2);
    expect(result2.lines[0]).toContain("STRETCHY");
    // FIXED should now be at line 2, not at line height-1
    expect(result2.lines[2]).toContain("FIXED");
  });

  it("removed layout prop (flex) is cleared on rerender", () => {
    const width = 40;
    const height = 10;

    // First render: two flex children
    const el1 = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "A")),
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "B")),
    );

    const result = renderToString(el1, { width, height });
    expect(result.lines[0]).toContain("A");
    // B should be at height/2 (each gets half)
    expect(result.lines[5]).toContain("B");

    // Second render: first child changes from flex=1 to height=1
    // The old flex prop must be cleared from layoutNode.props
    const el2 = React.createElement(
      "tui-box",
      { flexDirection: "column", width, height },
      React.createElement("tui-box", { height: 1 },
        React.createElement("tui-text", null, "A")),
      React.createElement("tui-box", { flex: 1 },
        React.createElement("tui-text", null, "B")),
    );

    const result2 = result.rerender(el2);
    expect(result2.lines[0]).toContain("A");
    // B should be at line 1 (A only takes 1 row now)
    expect(result2.lines[1]).toContain("B");
  });
});
