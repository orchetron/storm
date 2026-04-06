/**
 * SyntaxHighlight widget tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { SyntaxHighlight } from "../widgets/index.js";

describe("SyntaxHighlight", () => {
  it("renders TypeScript code", () => {
    const code = 'const x = 42;';
    const result = renderForTest(
      React.createElement(SyntaxHighlight, { code, language: "ts" }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("const")).toBe(true);
    expect(result.hasText("42")).toBe(true);
  });

  it("renders keywords in styled output", () => {
    const code = 'if (true) { return false; }';
    const result = renderForTest(
      React.createElement(SyntaxHighlight, { code, language: "ts" }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("if")).toBe(true);
    expect(result.hasText("return")).toBe(true);
    expect(result.hasText("true")).toBe(true);
    // ANSI codes should be present in styled output for keyword coloring
    expect(result.styledOutput.length).toBeGreaterThan(result.output.length);
  });

  it("renders strings in output", () => {
    const code = 'const msg = "hello world";';
    const result = renderForTest(
      React.createElement(SyntaxHighlight, { code, language: "ts" }),
      { width: 60, height: 10 },
    );
    expect(result.hasText('"hello world"')).toBe(true);
  });

  it("renders comments in output", () => {
    const code = '// This is a comment\nconst x = 1;';
    const result = renderForTest(
      React.createElement(SyntaxHighlight, { code, language: "ts" }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("// This is a comment")).toBe(true);
    expect(result.hasText("const")).toBe(true);
  });

  it("handles multiline code", () => {
    const code = 'function add(a: number, b: number): number {\n  return a + b;\n}';
    const result = renderForTest(
      React.createElement(SyntaxHighlight, { code, language: "ts" }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("function")).toBe(true);
    expect(result.hasText("return")).toBe(true);
  });

  it("renders Python code", () => {
    const code = 'def greet(name):\n    print(f"Hello {name}")';
    const result = renderForTest(
      React.createElement(SyntaxHighlight, { code, language: "python" }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("def")).toBe(true);
    expect(result.hasText("greet")).toBe(true);
  });
});
