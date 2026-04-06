/**
 * Table component tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { Table } from "../components/index.js";

const columns = [
  { key: "name", header: "Name" },
  { key: "score", header: "Score" },
];

describe("Table", () => {
  it("renders columns and rows", () => {
    const result = renderForTest(
      React.createElement(Table, {
        columns,
        data: [{ name: "Alice", score: 95 }, { name: "Bob", score: 87 }],
      }),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Alice")).toBe(true);
    expect(result.hasText("Bob")).toBe(true);
    expect(result.hasText("95")).toBe(true);
    expect(result.hasText("87")).toBe(true);
  });

  it("renders header row", () => {
    const result = renderForTest(
      React.createElement(Table, {
        columns,
        data: [{ name: "Carol", score: 100 }],
      }),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Name")).toBe(true);
    expect(result.hasText("Score")).toBe(true);
  });

  it("renders right-aligned column", () => {
    const cols = [
      { key: "item", header: "Item" },
      { key: "price", header: "Price", align: "right" as const },
    ];
    const result = renderForTest(
      React.createElement(Table, {
        columns: cols,
        data: [{ item: "Widget", price: 42 }],
      }),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Widget")).toBe(true);
    expect(result.hasText("42")).toBe(true);
  });

  it("renders empty state", () => {
    const result = renderForTest(
      React.createElement(Table, { columns, data: [] }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("No data")).toBe(true);
  });

  it("renders separator between header and body", () => {
    const result = renderForTest(
      React.createElement(Table, {
        columns,
        data: [{ name: "Dan", score: 77 }],
      }),
      { width: 40, height: 10 },
    );
    // Separator uses ─ characters
    expect(result.output.includes("\u2500")).toBe(true);
  });
});
