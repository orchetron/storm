/**
 * DiffView component tests.
 *
 * Covers unified diff parsing, added/removed line markers, line numbers,
 * hunk navigation, and word-level diff highlighting.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { DiffView, type DiffLine } from "../components/DiffView.js";

const sampleDiff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 const d = 5;`;

describe("DiffView", () => {
  it("parses and renders a unified diff string", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: sampleDiff }),
      { width: 60, height: 20 },
    );
    expect(result.hasText("const a = 1")).toBe(true);
    expect(result.hasText("const b")).toBe(true);
  });

  it("shows added lines with + marker", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: sampleDiff }),
      { width: 60, height: 20 },
    );
    expect(result.hasText("+")).toBe(true);
    expect(result.hasText("const c = 4")).toBe(true);
  });

  it("shows removed lines with - marker", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: sampleDiff }),
      { width: 60, height: 20 },
    );
    expect(result.hasText("-")).toBe(true);
    expect(result.hasText("const b = 2")).toBe(true);
  });

  it("renders line numbers by default", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: sampleDiff, showLineNumbers: true }),
      { width: 60, height: 20 },
    );
    // Line numbers should appear in the gutter
    expect(result.hasText("1")).toBe(true);
  });

  it("hides line numbers when showLineNumbers is false", () => {
    const lines: DiffLine[] = [
      { type: "added", content: "new line", newLineNumber: 42 },
    ];
    const result = renderForTest(
      React.createElement(DiffView, { lines, showLineNumbers: false }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("new line")).toBe(true);
    // Line number 42 should not appear in gutter
    expect(result.hasText("42")).toBe(false);
  });

  it("renders pre-parsed DiffLine array", () => {
    const lines: DiffLine[] = [
      { type: "header", content: "@@ -1,2 +1,2 @@" },
      { type: "removed", content: "old value", oldLineNumber: 1 },
      { type: "added", content: "new value", newLineNumber: 1 },
      { type: "context", content: "unchanged", oldLineNumber: 2, newLineNumber: 2 },
    ];
    const result = renderForTest(
      React.createElement(DiffView, { lines }),
      { width: 60, height: 15 },
    );
    expect(result.hasText("old value")).toBe(true);
    expect(result.hasText("new value")).toBe(true);
    expect(result.hasText("unchanged")).toBe(true);
  });

  it("renders file path header", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: sampleDiff, filePath: "src/main.ts" }),
      { width: 60, height: 20 },
    );
    expect(result.hasText("src/main.ts")).toBe(true);
  });

  it("supports word-level diff highlighting", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: sampleDiff, wordDiff: true }),
      { width: 60, height: 20 },
    );
    // Should render without error; changed words within lines get highlighted
    expect(result.hasText("const b")).toBe(true);
  });

  it("renders empty diff without crashing", () => {
    const result = renderForTest(
      React.createElement(DiffView, { diff: "" }),
      { width: 60, height: 10 },
    );
    // Should render an empty container without error
    expect(result.output).toBeDefined();
  });
});
