/**
 * OperationTree widget tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { OperationTree, type OpNode } from "../widgets/index.js";

describe("OperationTree", () => {
  it("renders a pending node with circle icon", () => {
    const nodes: OpNode[] = [{ id: "1", label: "Fetching data", status: "pending" }];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("\u25CB")).toBe(true); // ○
    expect(result.hasText("Fetching data")).toBe(true);
  });

  it("renders a completed node with check icon", () => {
    const nodes: OpNode[] = [{ id: "1", label: "Done", status: "completed" }];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("\u2713")).toBe(true); // ✓
    expect(result.hasText("Done")).toBe(true);
  });

  it("renders a failed node with cross icon", () => {
    const nodes: OpNode[] = [{ id: "1", label: "Error step", status: "failed" }];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("\u2717")).toBe(true); // ✗
    expect(result.hasText("Error step")).toBe(true);
  });

  it("shows duration for completed nodes", () => {
    const nodes: OpNode[] = [
      { id: "1", label: "Build", status: "completed", durationMs: 1500 },
    ];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("1.5s")).toBe(true);
  });

  it("renders tree connectors for multiple nodes", () => {
    const nodes: OpNode[] = [
      { id: "1", label: "Step 1", status: "completed" },
      { id: "2", label: "Step 2", status: "pending" },
    ];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes }),
      { width: 60, height: 10 },
    );
    expect(result.output.includes("\u251C\u2500")).toBe(true); // ├─
    expect(result.output.includes("\u2514\u2500")).toBe(true); // └─
  });

  it("renders nested children", () => {
    const nodes: OpNode[] = [{
      id: "1", label: "Parent", status: "completed",
      children: [{ id: "1.1", label: "Child", status: "pending" }],
    }];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("Parent")).toBe(true);
    expect(result.hasText("Child")).toBe(true);
  });

  it("uses custom status icons", () => {
    const nodes: OpNode[] = [{ id: "1", label: "Custom", status: "completed" }];
    const result = renderForTest(
      React.createElement(OperationTree, { nodes, statusIcons: { completed: "OK" } }),
      { width: 60, height: 10 },
    );
    expect(result.hasText("OK")).toBe(true);
  });
});
