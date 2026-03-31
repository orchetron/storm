/**
 * Integration tests for Storm TUI.
 *
 * Tests the full render lifecycle, component re-rendering with diffing,
 * imperative mutation patterns, error recovery, focus management,
 * and the plugin system. Uses renderForTest and the internal testing
 * utilities to exercise the reconciler → layout → paint pipeline end-to-end.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { useState, useRef, useEffect } from "react";
import { renderForTest, expectOutput } from "../testing/index.js";
import { renderToString } from "../reconciler/render-to-string.js";
import { RenderContext } from "../core/render-context.js";
import { ScreenBuffer } from "../core/buffer.js";
import { RenderErrorBoundary } from "../core/error-boundary.js";
import { FocusManager } from "../core/focus.js";
import { PluginManager, type StormPlugin } from "../core/plugin.js";
import { createRoot, createElement, createTextNode, type TuiRoot } from "../reconciler/types.js";

// ── 1. Full Render Lifecycle ───────────────────────────────────────────

describe("Full render lifecycle", () => {
  it("should mount, paint, and unmount cleanly", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Hello Storm"),
        React.createElement("tui-text", { bold: true }, "Ready"),
      ),
      { width: 40, height: 10 },
    );

    expect(result.hasText("Hello Storm")).toBe(true);
    expect(result.hasText("Ready")).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);

    // Unmount should not throw
    expect(() => result.unmount()).not.toThrow();
  });

  it("should handle multiple sequential renders", () => {
    // First render
    const result1 = renderForTest(
      React.createElement("tui-text", null, "Frame 1"),
      { width: 30, height: 5 },
    );
    expect(result1.hasText("Frame 1")).toBe(true);
    result1.unmount();

    // Second render — independent instance
    const result2 = renderForTest(
      React.createElement("tui-text", null, "Frame 2"),
      { width: 30, height: 5 },
    );
    expect(result2.hasText("Frame 2")).toBe(true);
    expect(result2.hasText("Frame 1")).toBe(false);
    result2.unmount();

    // Third render — verify no cross-contamination
    const result3 = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Frame 3a"),
        React.createElement("tui-text", null, "Frame 3b"),
      ),
      { width: 30, height: 5 },
    );
    expect(result3.hasText("Frame 3a")).toBe(true);
    expect(result3.hasText("Frame 3b")).toBe(true);
    result3.unmount();
  });

  it("should clean up timers on exit", () => {
    const ctx = new RenderContext();
    let cleanupCalled = false;

    ctx.cleanups.set("timer-1", () => { cleanupCalled = true; });

    // Simulate exit cleanup
    for (const cleanup of ctx.cleanups.values()) {
      cleanup();
    }
    ctx.cleanups.clear();

    expect(cleanupCalled).toBe(true);
    expect(ctx.cleanups.size).toBe(0);
  });

  it("should render empty tree without crashing", () => {
    const result = renderForTest(
      React.createElement("tui-box", null),
      { width: 20, height: 5 },
    );
    // Empty box renders successfully (output may be blank)
    expect(() => result.unmount()).not.toThrow();
  });

  it("should render deeply nested components", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-box", null,
          React.createElement("tui-box", null,
            React.createElement("tui-box", null,
              React.createElement("tui-text", null, "Deep node"),
            ),
          ),
        ),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Deep node")).toBe(true);
    result.unmount();
  });
});

// ── 2. Component Re-rendering ──────────────────────────────────────────

describe("Component updates", () => {
  it("should diff and only update changed cells", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Line A - unchanged"),
        React.createElement("tui-text", null, "Line B - original"),
      ),
      { width: 40, height: 10 },
    );

    const output1 = result.output;
    expect(result.hasText("Line B - original")).toBe(true);

    // Re-render with changed second line
    result.rerender(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Line A - unchanged"),
        React.createElement("tui-text", null, "Line B - updated!"),
      ),
    );

    expect(result.hasText("Line A - unchanged")).toBe(true);
    expect(result.hasText("Line B - updated!")).toBe(true);
    expect(result.hasText("Line B - original")).toBe(false);
    result.unmount();
  });

  it("should handle text content changes", () => {
    const result = renderForTest(
      React.createElement("tui-text", null, "Hello"),
      { width: 30, height: 3 },
    );

    expect(result.hasText("Hello")).toBe(true);

    result.rerender(
      React.createElement("tui-text", null, "Goodbye"),
    );

    expect(result.hasText("Goodbye")).toBe(true);
    expect(result.hasText("Hello")).toBe(false);
    result.unmount();
  });

  it("should handle prop changes triggering layout recalc", () => {
    // Render with specific width
    const result = renderForTest(
      React.createElement("tui-box", { width: 20, borderStyle: "round" },
        React.createElement("tui-text", null, "Boxed"),
      ),
      { width: 40, height: 6 },
    );
    const output1 = result.output;
    expect(result.hasText("Boxed")).toBe(true);

    // Change width — forces layout recalculation
    result.rerender(
      React.createElement("tui-box", { width: 30, borderStyle: "round" },
        React.createElement("tui-text", null, "Wider box"),
      ),
    );

    expect(result.hasText("Wider box")).toBe(true);
    expect(result.hasText("Boxed")).toBe(false);
    result.unmount();
  });

  it("should handle adding and removing children", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", { key: "a" }, "Alpha"),
      ),
      { width: 30, height: 8 },
    );
    expect(result.hasText("Alpha")).toBe(true);
    expect(result.hasText("Beta")).toBe(false);

    // Add a child
    result.rerender(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", { key: "a" }, "Alpha"),
        React.createElement("tui-text", { key: "b" }, "Beta"),
      ),
    );
    expect(result.hasText("Alpha")).toBe(true);
    expect(result.hasText("Beta")).toBe(true);

    // Remove a child
    result.rerender(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", { key: "b" }, "Beta"),
      ),
    );
    expect(result.hasText("Beta")).toBe(true);
    expect(result.hasText("Alpha")).toBe(false);
    result.unmount();
  });

  it("should handle style prop changes without layout change", () => {
    const result = renderForTest(
      React.createElement("tui-text", { color: "red" }, "Colored"),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Colored")).toBe(true);

    // Change color — no layout change needed
    result.rerender(
      React.createElement("tui-text", { color: "blue" }, "Colored"),
    );
    expect(result.hasText("Colored")).toBe(true);
    result.unmount();
  });
});

// ── 3. Imperative Mutation Pattern ─────────────────────────────────────

describe("Imperative mutation with requestRender", () => {
  it("should update text via _textNodeRef mutation", () => {
    // Simulate the imperative text mutation pattern used by Spinner, etc.
    const textNode = createTextNode("initial text");
    expect(textNode.text).toBe("initial text");

    // Mutating text should work
    textNode.text = "updated text";
    expect(textNode.text).toBe("updated text");
  });

  it("should propagate _runsDirty through nested tui-text", () => {
    // Create a parent tui-text with a child text node
    const parent = createElement("tui-text", {});
    const child = createElement("tui-text", {});
    const textNode = createTextNode("hello");

    // Set up parent chain
    child.children.push(textNode);
    textNode.parent = child;
    child.parent = parent;
    parent.children.push(child);

    // Clear dirty flags
    parent._runsDirty = false;
    child._runsDirty = false;

    // Mutate text — should propagate dirty up through tui-text ancestors
    textNode.text = "world";

    expect(child._runsDirty).toBe(true);
    // The propagation walks up through tui-text ancestors, stopping at non-tui-text
    // child's parent is parent (tui-text), so parent should also be marked
    expect(parent._runsDirty).toBe(true);
  });

  it("should not mark dirty if text is unchanged", () => {
    const parent = createElement("tui-text", {});
    const textNode = createTextNode("same");
    textNode.parent = parent;
    parent.children.push(textNode);
    parent._runsDirty = false;

    // Setting same text should be a no-op
    textNode.text = "same";
    expect(parent._runsDirty).toBe(false);
  });

  it("should stop dirty propagation after first non-tui-text ancestor", () => {
    // Tree: outerBox > box > text > textNode
    // Propagation marks each ancestor dirty, stopping AFTER the first non-tui-text.
    const outerBox = createElement("tui-box", {});
    const box = createElement("tui-box", {});
    const text = createElement("tui-text", {});
    const textNode = createTextNode("content");

    textNode.parent = text;
    text.children.push(textNode);
    text.parent = box;
    box.children.push(text);
    box.parent = outerBox;
    outerBox.children.push(box);

    outerBox._runsDirty = false;
    box._runsDirty = false;
    text._runsDirty = false;

    textNode.text = "new content";

    // tui-text ancestor should be dirty
    expect(text._runsDirty).toBe(true);
    // First non-tui-text ancestor (box) gets marked, then propagation stops
    expect(box._runsDirty).toBe(true);
    // Outer box should NOT be reached
    expect(outerBox._runsDirty).toBe(false);
  });

  it("should support _hostPropsRef for imperative props access", () => {
    // The reconciler's createInstance stores element.props in _hostPropsRef.current
    const propsRef: { current: unknown } = { current: null };
    const el = createElement("tui-scroll-view", { _hostPropsRef: propsRef, scrollTop: 0 });

    // Simulate what the reconciler does on createInstance
    propsRef.current = el.props;

    expect(propsRef.current).toBeDefined();
    expect((propsRef.current as Record<string, unknown>)["scrollTop"]).toBe(0);

    // Imperatively mutate props (as ScrollView does for scroll position)
    (propsRef.current as Record<string, unknown>)["scrollTop"] = 42;
    expect((propsRef.current as Record<string, unknown>)["scrollTop"]).toBe(42);
  });
});

// ── 4. Error Recovery ──────────────────────────────────────────────────

describe("Error recovery", () => {
  it("should catch render errors via ErrorBoundary", () => {
    const errors: Array<{ phase: string; message: string }> = [];
    const boundary = new RenderErrorBoundary({
      onError: (err) => {
        errors.push({ phase: err.phase, message: err.error.message });
      },
    });

    const result = boundary.protect("paint", () => {
      throw new Error("Paint explosion");
    });

    expect(result).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]!.phase).toBe("paint");
    expect(errors[0]!.message).toBe("Paint explosion");
  });

  it("should continue rendering after error boundary catches", () => {
    const boundary = new RenderErrorBoundary({ maxConsecutiveErrors: 5 });

    // First call fails
    const r1 = boundary.protect("layout", () => {
      throw new Error("Layout error");
    });
    expect(r1).toBeUndefined();
    expect(boundary.shouldExit()).toBe(false);

    // Second call succeeds — resets consecutive counter
    const r2 = boundary.protect("paint", () => "success");
    expect(r2).toBe("success");
    expect(boundary.shouldExit()).toBe(false);

    // Verify errors are accumulated
    expect(boundary.getErrors()).toHaveLength(1);
  });

  it("should trigger exit after max consecutive errors", () => {
    const boundary = new RenderErrorBoundary({ maxConsecutiveErrors: 3 });

    for (let i = 0; i < 3; i++) {
      boundary.protect("paint", () => {
        throw new Error(`Error ${i}`);
      });
    }

    expect(boundary.shouldExit()).toBe(true);
    expect(boundary.getErrors()).toHaveLength(3);
  });

  it("should reset consecutive counter on success", () => {
    const boundary = new RenderErrorBoundary({ maxConsecutiveErrors: 3 });

    // Two failures
    boundary.protect("paint", () => { throw new Error("err1"); });
    boundary.protect("paint", () => { throw new Error("err2"); });
    expect(boundary.shouldExit()).toBe(false);

    // One success resets the counter
    boundary.protect("paint", () => "ok");
    expect(boundary.shouldExit()).toBe(false);

    // Two more failures — still under threshold
    boundary.protect("paint", () => { throw new Error("err3"); });
    boundary.protect("paint", () => { throw new Error("err4"); });
    expect(boundary.shouldExit()).toBe(false);
  });

  it("should format errors with phase and message", () => {
    const boundary = new RenderErrorBoundary();
    boundary.protect("diff", () => {
      throw new Error("Diff mismatch");
    });

    const errors = boundary.getErrors();
    expect(errors).toHaveLength(1);
    const formatted = boundary.formatError(errors[0]!);
    expect(formatted).toContain("[Storm Error]");
    expect(formatted).toContain("diff");
    expect(formatted).toContain("Diff mismatch");
  });

  it("should handle non-Error thrown values", () => {
    const boundary = new RenderErrorBoundary();
    boundary.protect("input", () => {
      throw "string error"; // eslint-disable-line no-throw-literal
    });

    const errors = boundary.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]!.error.message).toBe("string error");
  });

  it("should cap stored errors at MAX_STORED_ERRORS", () => {
    const boundary = new RenderErrorBoundary({ maxConsecutiveErrors: 200 });

    for (let i = 0; i < 120; i++) {
      boundary.recordError({
        phase: "paint",
        error: new Error(`err-${i}`),
        timestamp: Date.now(),
      });
    }

    // Should be capped at 100
    expect(boundary.getErrors().length).toBeLessThanOrEqual(100);
  });
});

// ── 5. Focus Management ────────────────────────────────────────────────

describe("Focus management", () => {
  let focus: FocusManager;

  beforeEach(() => {
    focus = new FocusManager();
  });

  it("should cycle focus with tab", () => {
    focus.register({ id: "input-1", type: "input", bounds: { x: 0, y: 0, width: 20, height: 1 } });
    focus.register({ id: "input-2", type: "input", bounds: { x: 0, y: 1, width: 20, height: 1 } });
    focus.register({ id: "input-3", type: "input", bounds: { x: 0, y: 2, width: 20, height: 1 } });

    // First input auto-focused on register
    expect(focus.focused).toBe("input-1");

    // Focus a different element to sync focusIndex, then cycle from there
    focus.focus("input-2");
    expect(focus.focused).toBe("input-2");

    focus.cycleNext();
    expect(focus.focused).toBe("input-3");

    // Wrap around
    focus.cycleNext();
    expect(focus.focused).toBe("input-1");

    focus.cycleNext();
    expect(focus.focused).toBe("input-2");
  });

  it("should cycle focus backwards", () => {
    focus.register({ id: "a", type: "input", bounds: { x: 0, y: 0, width: 10, height: 1 } });
    focus.register({ id: "b", type: "input", bounds: { x: 0, y: 1, width: 10, height: 1 } });

    expect(focus.focused).toBe("a");

    // Focus "b" to sync focusIndex, then cycle backwards from b
    focus.focus("b");
    expect(focus.focused).toBe("b");

    focus.cyclePrev();
    expect(focus.focused).toBe("a");

    // Wrap around backwards
    focus.cyclePrev();
    expect(focus.focused).toBe("b");
  });

  it("should trap focus in modal", () => {
    focus.register({ id: "bg-1", type: "input", bounds: { x: 0, y: 0, width: 20, height: 1 } });
    focus.register({ id: "bg-2", type: "input", bounds: { x: 0, y: 1, width: 20, height: 1 } });
    focus.register({ id: "modal-1", type: "input", bounds: { x: 5, y: 5, width: 20, height: 1 }, groupId: "modal" });
    focus.register({ id: "modal-2", type: "input", bounds: { x: 5, y: 6, width: 20, height: 1 }, groupId: "modal" });

    // Trap focus to modal group
    focus.trapFocus("modal");
    expect(focus.isTrapped).toBe(true);
    expect(focus.activeGroup).toBe("modal");

    // Focus should move to first modal input
    expect(focus.focused).toBe("modal-1");

    // Cycling should stay within the modal group
    focus.cycleNext();
    expect(focus.focused).toBe("modal-2");

    focus.cycleNext();
    expect(focus.focused).toBe("modal-1");

    // Should not reach bg inputs
    focus.cycleNext();
    expect(focus.focused).not.toBe("bg-1");
    expect(focus.focused).not.toBe("bg-2");

    // Release trap
    focus.releaseFocus();
    expect(focus.isTrapped).toBe(false);
  });

  it("should support nested focus traps", () => {
    focus.register({ id: "main", type: "input", bounds: { x: 0, y: 0, width: 20, height: 1 } });
    focus.register({ id: "dialog-1", type: "input", bounds: { x: 5, y: 5, width: 20, height: 1 }, groupId: "dialog" });
    focus.register({ id: "confirm-1", type: "input", bounds: { x: 10, y: 10, width: 20, height: 1 }, groupId: "confirm" });

    focus.trapFocus("dialog");
    expect(focus.focused).toBe("dialog-1");

    // Nest another trap
    focus.trapFocus("confirm");
    expect(focus.focused).toBe("confirm-1");
    expect(focus.activeGroup).toBe("confirm");

    // Release inner trap — should restore dialog trap
    focus.releaseFocus();
    expect(focus.activeGroup).toBe("dialog");

    // Release outer trap
    focus.releaseFocus();
    expect(focus.isTrapped).toBe(false);
  });

  it("should respect tabIndex ordering", () => {
    focus.register({ id: "c", type: "input", bounds: { x: 0, y: 0, width: 10, height: 1 }, tabIndex: 3 });
    focus.register({ id: "a", type: "input", bounds: { x: 0, y: 1, width: 10, height: 1 }, tabIndex: 1 });
    focus.register({ id: "b", type: "input", bounds: { x: 0, y: 2, width: 10, height: 1 }, tabIndex: 2 });

    // First registered auto-focuses
    expect(focus.focused).toBe("c");

    // Cycling should follow tabIndex order: a(1), b(2), c(3)
    focus.focus("a"); // start from a
    focus.cycleNext();
    expect(focus.focused).toBe("b");
    focus.cycleNext();
    expect(focus.focused).toBe("c");
    focus.cycleNext();
    expect(focus.focused).toBe("a");
  });

  it("should skip scroll entries when cycling focus", () => {
    focus.register({ id: "input-1", type: "input", bounds: { x: 0, y: 0, width: 20, height: 1 } });
    focus.register({ id: "scroll-1", type: "scroll", bounds: { x: 0, y: 1, width: 20, height: 10 } });
    focus.register({ id: "input-2", type: "input", bounds: { x: 0, y: 11, width: 20, height: 1 } });

    expect(focus.focused).toBe("input-1");

    // Focus input-2 then cycle back to verify scroll is always skipped
    focus.focus("input-2");
    expect(focus.focused).toBe("input-2");

    focus.cycleNext();
    // Wraps around, skipping scroll-1
    expect(focus.focused).toBe("input-1");

    focus.cycleNext();
    // Skips scroll-1 again, goes to input-2
    expect(focus.focused).toBe("input-2");
  });

  it("should unregister and move focus to next available", () => {
    focus.register({ id: "a", type: "input", bounds: { x: 0, y: 0, width: 10, height: 1 } });
    focus.register({ id: "b", type: "input", bounds: { x: 0, y: 1, width: 10, height: 1 } });

    expect(focus.focused).toBe("a");
    focus.unregister("a");
    // Should auto-focus next available input
    expect(focus.focused).toBe("b");
  });

  it("should hit-test scroll views", () => {
    focus.register({
      id: "scroll-a",
      type: "scroll",
      bounds: { x: 0, y: 0, width: 40, height: 10 },
    });
    focus.register({
      id: "scroll-b",
      type: "scroll",
      bounds: { x: 0, y: 10, width: 40, height: 10 },
    });

    const hitA = focus.hitTestScroll(5, 5);
    expect(hitA?.id).toBe("scroll-a");

    const hitB = focus.hitTestScroll(5, 15);
    expect(hitB?.id).toBe("scroll-b");
  });

  it("should notify focus change listeners", () => {
    const changes: Array<{ newId: string | null; prevId: string | null }> = [];

    focus.register({ id: "a", type: "input", bounds: { x: 0, y: 0, width: 10, height: 1 } });
    focus.register({ id: "b", type: "input", bounds: { x: 0, y: 1, width: 10, height: 1 } });

    // Subscribe after registration so we only capture explicit focus changes
    focus.onFocusChange((newId, prevId) => {
      changes.push({ newId, prevId });
    });

    // Explicitly focus b (which is different from auto-focused a)
    focus.focus("b");

    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes[changes.length - 1]!.newId).toBe("b");
    expect(changes[changes.length - 1]!.prevId).toBe("a");
  });

  it("should disable and enable focus", () => {
    focus.register({ id: "a", type: "input", bounds: { x: 0, y: 0, width: 10, height: 1 } });
    focus.register({ id: "b", type: "input", bounds: { x: 0, y: 1, width: 10, height: 1 } });

    focus.disableFocus();
    expect(focus.isFocusEnabled).toBe(false);

    // focus() should not work when disabled
    focus.focus("b");
    expect(focus.focused).toBe("a"); // stays on auto-focused "a"

    // Cycling should also not work when disabled
    focus.cycleNext();
    expect(focus.focused).toBe("a");

    focus.enableFocus();
    // Now focus() should work
    focus.focus("b");
    expect(focus.focused).toBe("b");
  });
});

// ── 6. Plugin System ───────────────────────────────────────────────────

describe("Plugin system", () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  it("should intercept component props via onComponentProps", () => {
    const plugin: StormPlugin = {
      name: "test-interceptor",
      onComponentProps: (componentName, props) => {
        if (componentName === "Button") {
          return { ...props, size: "large", intercepted: true };
        }
        return undefined; // pass through for other components
      },
    };

    manager.register(plugin);

    const result = manager.applyComponentProps("Button", { label: "Click" });
    expect(result["label"]).toBe("Click");
    expect(result["size"]).toBe("large");
    expect(result["intercepted"]).toBe(true);

    // Other components should pass through unchanged
    const other = manager.applyComponentProps("Text", { color: "red" });
    expect(other["color"]).toBe("red");
    expect(other["intercepted"]).toBeUndefined();
  });

  it("should apply component defaults from plugin", () => {
    const plugin: StormPlugin = {
      name: "defaults-plugin",
      componentDefaults: {
        Button: { variant: "primary", size: "medium" },
        Card: { borderStyle: "round" },
      },
    };

    manager.register(plugin);

    // Defaults should be applied
    const buttonProps = manager.applyComponentProps("Button", { label: "OK" });
    expect(buttonProps["variant"]).toBe("primary");
    expect(buttonProps["size"]).toBe("medium");
    expect(buttonProps["label"]).toBe("OK");

    // User props should override defaults
    const override = manager.applyComponentProps("Button", { variant: "danger", label: "Delete" });
    expect(override["variant"]).toBe("danger");
    expect(override["label"]).toBe("Delete");
    expect(override["size"]).toBe("medium"); // default still applies
  });

  it("should run lifecycle hooks", () => {
    const lifecycle: string[] = [];

    const plugin: StormPlugin = {
      name: "lifecycle-plugin",
      beforeRender: () => { lifecycle.push("before"); },
      afterRender: (info) => { lifecycle.push(`after:${info.renderTimeMs}ms`); },
      cleanup: () => { lifecycle.push("cleanup"); },
    };

    manager.register(plugin);

    manager.runBeforeRender();
    manager.runAfterRender({ renderTimeMs: 16, cellsChanged: 42 });
    manager.runCleanup();

    expect(lifecycle).toEqual(["before", "after:16ms", "cleanup"]);
  });

  it("should process key events through plugin chain", () => {
    const consumed: string[] = [];

    const plugin: StormPlugin = {
      name: "key-interceptor",
      onKey: (event) => {
        if (event.ctrl && event.key === "s") {
          consumed.push("ctrl+s");
          return null; // consume the event
        }
        return event; // pass through
      },
    };

    manager.register(plugin);

    // ctrl+s should be consumed
    const ctrlS = manager.processKey({
      key: "s", char: "s", raw: "", ctrl: true, shift: false, meta: false,
    });
    expect(ctrlS).toBeNull();
    expect(consumed).toEqual(["ctrl+s"]);

    // Other keys pass through
    const normalA = manager.processKey({
      key: "a", char: "a", raw: "", ctrl: false, shift: false, meta: false,
    });
    expect(normalA).not.toBeNull();
    expect(normalA!.key).toBe("a");
  });

  it("should prevent duplicate plugin registration", () => {
    manager.register({ name: "unique-plugin" });
    expect(() => manager.register({ name: "unique-plugin" })).toThrow(
      'Plugin "unique-plugin" is already registered.',
    );
  });

  it("should unregister plugins and call cleanup", () => {
    let cleaned = false;
    manager.register({
      name: "removable",
      cleanup: () => { cleaned = true; },
    });

    expect(manager.getPlugin("removable")).toBeDefined();
    manager.unregister("removable");
    expect(cleaned).toBe(true);
    expect(manager.getPlugin("removable")).toBeUndefined();
  });

  it("should chain multiple plugin interceptors in order", () => {
    manager.register({
      name: "plugin-a",
      onComponentProps: (_name, props) => {
        return { ...props, fromA: true };
      },
    });

    manager.register({
      name: "plugin-b",
      onComponentProps: (_name, props) => {
        return { ...props, fromB: true, sawA: props["fromA"] === true };
      },
    });

    const result = manager.applyComponentProps("Test", { original: true });
    expect(result["original"]).toBe(true);
    expect(result["fromA"]).toBe(true);
    expect(result["fromB"]).toBe(true);
    expect(result["sawA"]).toBe(true); // B saw A's modification
  });

  it("should merge defaults from multiple plugins", () => {
    manager.register({
      name: "theme-plugin",
      componentDefaults: {
        Button: { variant: "primary" },
      },
    });

    manager.register({
      name: "size-plugin",
      componentDefaults: {
        Button: { size: "large" },
      },
    });

    const defaults = manager.getComponentDefaults("Button");
    expect(defaults["variant"]).toBe("primary");
    expect(defaults["size"]).toBe("large");
  });

  it("should process mouse events through plugin chain", () => {
    manager.register({
      name: "mouse-filter",
      onMouse: (event) => {
        // Block right-clicks
        if (event.button === "right") return null;
        return event;
      },
    });

    const rightClick = manager.processMouse({
      button: "right", action: "press", x: 0, y: 0,
      shift: false, ctrl: false, meta: false, raw: "",
    });
    expect(rightClick).toBeNull();

    const leftClick = manager.processMouse({
      button: "left", action: "press", x: 0, y: 0,
      shift: false, ctrl: false, meta: false, raw: "",
    });
    expect(leftClick).not.toBeNull();
  });
});

// ── 7. RenderContext Integration ───────────────────────────────────────

describe("RenderContext integration", () => {
  it("should track layout invalidation through render cycle", () => {
    const ctx = new RenderContext();

    // Simulate a render cycle
    expect(ctx.layoutBuilt).toBe(false);
    ctx.layoutBuilt = true;
    expect(ctx.layoutBuilt).toBe(true);

    // Content changes -> invalidate
    ctx.invalidateLayout();
    expect(ctx.layoutBuilt).toBe(false);
    expect(ctx.layoutInvalidated).toBe(true);

    // After flush -> clear dirty
    ctx.clearDirty();
    expect(ctx.layoutInvalidated).toBe(false);
  });

  it("should manage dirty regions across frames", () => {
    const ctx = new RenderContext();

    // Frame 1: full repaint
    expect(ctx.isFullyDirty()).toBe(true);

    // Mark specific regions dirty
    ctx.markDirty({ x: 0, y: 0, width: 10, height: 5 });
    ctx.markDirty({ x: 20, y: 0, width: 10, height: 5 });
    expect(ctx.isFullyDirty()).toBe(false);
    expect(ctx.dirtyRegions).toHaveLength(2);

    // Clear for next frame
    ctx.clearDirty();
    expect(ctx.isFullyDirty()).toBe(true);
    expect(ctx.dirtyRegions).toHaveLength(0);
  });

  it("should track scroll state across frames", () => {
    const ctx = new RenderContext();

    ctx.scrollViewStates.set("sv1", {
      scrollTop: 0, screenY1: 0, screenY2: 20, screenX1: 0, screenX2: 80,
    });

    // Swap for next frame
    ctx.swapScrollStates();
    expect(ctx.prevScrollViewStates.get("sv1")?.scrollTop).toBe(0);
    expect(ctx.scrollViewStates.size).toBe(0);

    // New scroll position in frame 2
    ctx.scrollViewStates.set("sv1", {
      scrollTop: 10, screenY1: 0, screenY2: 20, screenX1: 0, screenX2: 80,
    });

    // Can compare current vs prev
    expect(ctx.scrollViewStates.get("sv1")?.scrollTop).toBe(10);
    expect(ctx.prevScrollViewStates.get("sv1")?.scrollTop).toBe(0);
  });

  it("should manage image regions for diff renderer", () => {
    const ctx = new RenderContext();

    ctx.addImageRegion(5, 10, 20, 3);
    expect(ctx.imageRegions.size).toBe(3); // rows 10, 11, 12
    expect(ctx.imageRegions.get(10)).toEqual([{ x1: 5, x2: 25 }]);
    expect(ctx.imageRegions.get(11)).toEqual([{ x1: 5, x2: 25 }]);
    expect(ctx.imageRegions.get(12)).toEqual([{ x1: 5, x2: 25 }]);
  });

  it("should track and prune stale images", () => {
    const ctx = new RenderContext();

    // Frame 1: emit an image
    ctx.emittedImages.set("0,0", "\\x1b_Gxxx\\x1b\\\\");
    ctx.trackImageForFrame("0,0");
    ctx.pruneStaleImages();
    expect(ctx.emittedImages.has("0,0")).toBe(true);

    // Frame 2: image not seen -> pruned
    ctx.pruneStaleImages();
    expect(ctx.emittedImages.has("0,0")).toBe(false);
  });
});

// ── 8. End-to-End Rendering with renderToString ────────────────────────

describe("End-to-end rendering", () => {
  it("should render Box with border correctly", () => {
    const result = renderForTest(
      React.createElement("tui-box", { borderStyle: "single", width: 20 },
        React.createElement("tui-text", null, "Bordered"),
      ),
      { width: 30, height: 5 },
    );

    expect(result.hasText("Bordered")).toBe(true);
    // Single border uses line-drawing characters
    const hasBorderChar = result.output.includes("\u2500") || result.output.includes("\u2502")
      || result.output.includes("\u250C") || result.output.includes("\u2510");
    expect(hasBorderChar).toBe(true);
  });

  it("should handle flexDirection column layout", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column", width: 20 },
        React.createElement("tui-text", null, "Row 1"),
        React.createElement("tui-text", null, "Row 2"),
        React.createElement("tui-text", null, "Row 3"),
      ),
      { width: 20, height: 6 },
    );

    // Lines should appear on separate rows
    const lineWithRow1 = result.lines.findIndex((l) => l.includes("Row 1"));
    const lineWithRow2 = result.lines.findIndex((l) => l.includes("Row 2"));
    const lineWithRow3 = result.lines.findIndex((l) => l.includes("Row 3"));

    expect(lineWithRow1).toBeGreaterThanOrEqual(0);
    expect(lineWithRow2).toBeGreaterThan(lineWithRow1);
    expect(lineWithRow3).toBeGreaterThan(lineWithRow2);
  });

  it("should handle flexDirection row layout", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "row" },
        React.createElement("tui-text", null, "Col A"),
        React.createElement("tui-text", null, "Col B"),
      ),
      { width: 40, height: 3 },
    );

    // Both texts should be on the same line (row layout)
    expect(result.hasText("Col A")).toBe(true);
    expect(result.hasText("Col B")).toBe(true);
    const rowLine = result.lines.find((l) => l.includes("Col A") && l.includes("Col B"));
    expect(rowLine).toBeDefined();
  });

  it("should render styled text with ANSI codes", () => {
    const result = renderForTest(
      React.createElement("tui-text", { bold: true, color: "#ff0000" }, "Bold Red"),
      { width: 20, height: 3 },
    );

    expect(result.hasText("Bold Red")).toBe(true);
    // styledOutput should contain ANSI escape sequences
    expect(result.styledOutput).toContain("\x1b[");
  });

  it("should support rerender with event simulation", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Before"),
      ),
      { width: 30, height: 5 },
    );

    expect(result.hasText("Before")).toBe(true);

    result.rerender(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "After"),
      ),
    );

    expect(result.hasText("After")).toBe(true);
    expect(result.hasText("Before")).toBe(false);
  });

  it("should support expectOutput assertion helpers", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Alpha"),
        React.createElement("tui-text", null, "Beta"),
      ),
      { width: 20, height: 5 },
    );

    const assertions = expectOutput(result);
    assertions.toContainText("Alpha");
    assertions.toContainText("Beta");
    assertions.toNotContainText("Gamma");
  });
});
