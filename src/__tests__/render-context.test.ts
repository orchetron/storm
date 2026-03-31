/**
 * RenderContext tests for Storm TUI.
 *
 * Tests the mutable per-render state container: layout invalidation,
 * scroll state management, dirty region tracking, metrics, and cleanup APIs.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RenderContext } from "../core/render-context.js";

describe("RenderContext", () => {
  let ctx: RenderContext;

  beforeEach(() => {
    ctx = new RenderContext();
  });

  // ── Layout invalidation ──────────────────────────────────────────

  it("starts with layoutBuilt=false", () => {
    expect(ctx.layoutBuilt).toBe(false);
  });

  it("starts with layoutInvalidated=false", () => {
    expect(ctx.layoutInvalidated).toBe(false);
  });

  it("invalidateLayout sets layoutBuilt=false and layoutInvalidated=true", () => {
    ctx.layoutBuilt = true;
    ctx.layoutInvalidated = false;
    ctx.invalidateLayout();
    expect(ctx.layoutBuilt).toBe(false);
    expect(ctx.layoutInvalidated).toBe(true);
  });

  it("layoutInvalidated is cleared by clearDirty", () => {
    ctx.invalidateLayout();
    expect(ctx.layoutInvalidated).toBe(true);
    ctx.clearDirty();
    expect(ctx.layoutInvalidated).toBe(false);
  });

  it("invalidateLayout can be called multiple times", () => {
    ctx.invalidateLayout();
    ctx.invalidateLayout();
    ctx.invalidateLayout();
    expect(ctx.layoutInvalidated).toBe(true);
    expect(ctx.layoutBuilt).toBe(false);
  });

  // ── Scroll state ─────────────────────────────────────────────────

  it("starts with empty scroll view states", () => {
    expect(ctx.scrollViewStates.size).toBe(0);
    expect(ctx.prevScrollViewStates.size).toBe(0);
  });

  it("swapScrollStates moves current to prev", () => {
    ctx.scrollViewStates.set("sv1", {
      scrollTop: 10,
      screenY1: 0,
      screenY2: 20,
      screenX1: 0,
      screenX2: 80,
    });
    ctx.scrollViewStates.set("sv2", {
      scrollTop: 5,
      screenY1: 0,
      screenY2: 10,
      screenX1: 0,
      screenX2: 80,
    });

    ctx.swapScrollStates();

    // Previous should now have the two entries
    expect(ctx.prevScrollViewStates.size).toBe(2);
    expect(ctx.prevScrollViewStates.has("sv1")).toBe(true);
    expect(ctx.prevScrollViewStates.has("sv2")).toBe(true);
    expect(ctx.prevScrollViewStates.get("sv1")!.scrollTop).toBe(10);
    expect(ctx.prevScrollViewStates.get("sv2")!.scrollTop).toBe(5);

    // Current should be cleared
    expect(ctx.scrollViewStates.size).toBe(0);
  });

  it("swapScrollStates creates a copy (not a reference)", () => {
    ctx.scrollViewStates.set("sv1", {
      scrollTop: 0, screenY1: 0, screenY2: 10, screenX1: 0, screenX2: 80,
    });
    ctx.swapScrollStates();

    // Modifying current should not affect prev
    ctx.scrollViewStates.set("sv1", {
      scrollTop: 99, screenY1: 0, screenY2: 10, screenX1: 0, screenX2: 80,
    });
    expect(ctx.prevScrollViewStates.get("sv1")!.scrollTop).toBe(0);
  });

  it("double swap preserves state chain", () => {
    ctx.scrollViewStates.set("sv1", {
      scrollTop: 1, screenY1: 0, screenY2: 5, screenX1: 0, screenX2: 80,
    });
    ctx.swapScrollStates();
    // Now current is empty, prev has scrollTop=1

    ctx.scrollViewStates.set("sv1", {
      scrollTop: 2, screenY1: 0, screenY2: 5, screenX1: 0, screenX2: 80,
    });
    ctx.swapScrollStates();
    // Now prev should have scrollTop=2
    expect(ctx.prevScrollViewStates.get("sv1")!.scrollTop).toBe(2);
    expect(ctx.scrollViewStates.size).toBe(0);
  });

  // ── Dirty regions ────────────────────────────────────────────────

  it("starts with no dirty regions", () => {
    expect(ctx.dirtyRegions.length).toBe(0);
  });

  it("isFullyDirty returns true when no regions are marked", () => {
    expect(ctx.isFullyDirty()).toBe(true);
  });

  it("markDirty adds a region", () => {
    ctx.markDirty({ x: 0, y: 0, width: 10, height: 5 });
    expect(ctx.dirtyRegions.length).toBe(1);
    expect(ctx.isFullyDirty()).toBe(false);
  });

  it("markDirty accumulates multiple regions", () => {
    ctx.markDirty({ x: 0, y: 0, width: 10, height: 5 });
    ctx.markDirty({ x: 10, y: 0, width: 10, height: 5 });
    ctx.markDirty({ x: 0, y: 5, width: 20, height: 5 });
    expect(ctx.dirtyRegions.length).toBe(3);
  });

  it("clearDirty removes all regions", () => {
    ctx.markDirty({ x: 0, y: 0, width: 10, height: 5 });
    ctx.markDirty({ x: 5, y: 5, width: 15, height: 10 });
    ctx.clearDirty();
    expect(ctx.dirtyRegions.length).toBe(0);
    expect(ctx.isFullyDirty()).toBe(true);
  });

  it("dirty region stores correct coordinates", () => {
    ctx.markDirty({ x: 3, y: 7, width: 20, height: 12 });
    const region = ctx.dirtyRegions[0]!;
    expect(region.x).toBe(3);
    expect(region.y).toBe(7);
    expect(region.width).toBe(20);
    expect(region.height).toBe(12);
  });

  // ── Cursor state ─────────────────────────────────────────────────

  it("starts with cursor at (-1, -1)", () => {
    expect(ctx.cursorX).toBe(-1);
    expect(ctx.cursorY).toBe(-1);
  });

  it("cursor position can be set", () => {
    ctx.cursorX = 10;
    ctx.cursorY = 5;
    expect(ctx.cursorX).toBe(10);
    expect(ctx.cursorY).toBe(5);
  });

  // ── Layout dimensions ────────────────────────────────────────────

  it("starts with lastLayoutWidth=0 and lastLayoutHeight=0", () => {
    expect(ctx.lastLayoutWidth).toBe(0);
    expect(ctx.lastLayoutHeight).toBe(0);
  });

  it("layout dimensions can be set", () => {
    ctx.lastLayoutWidth = 80;
    ctx.lastLayoutHeight = 24;
    expect(ctx.lastLayoutWidth).toBe(80);
    expect(ctx.lastLayoutHeight).toBe(24);
  });

  // ── Render metrics ───────────────────────────────────────────────

  it("starts with zero metrics", () => {
    expect(ctx.metrics.lastRenderTimeMs).toBe(0);
    expect(ctx.metrics.fps).toBe(0);
    expect(ctx.metrics.cellsChanged).toBe(0);
    expect(ctx.metrics.totalCells).toBe(0);
    expect(ctx.metrics.frameCount).toBe(0);
  });

  it("metrics can be updated", () => {
    ctx.metrics.lastRenderTimeMs = 16;
    ctx.metrics.fps = 60;
    ctx.metrics.cellsChanged = 100;
    ctx.metrics.totalCells = 1920;
    ctx.metrics.frameCount = 42;
    expect(ctx.metrics.lastRenderTimeMs).toBe(16);
    expect(ctx.metrics.fps).toBe(60);
    expect(ctx.metrics.cellsChanged).toBe(100);
    expect(ctx.metrics.totalCells).toBe(1920);
    expect(ctx.metrics.frameCount).toBe(42);
  });

  // ── Focus manager ────────────────────────────────────────────────

  it("has a focus manager", () => {
    expect(ctx.focus).toBeDefined();
  });

  // ── Measurement map ──────────────────────────────────────────────

  it("starts with empty measure map", () => {
    expect(ctx.measureMap.size).toBe(0);
  });

  it("removeMeasure deletes entry", () => {
    ctx.measureMap.set("comp-1", { x: 0, y: 0, width: 10, height: 5 });
    expect(ctx.measureMap.size).toBe(1);
    ctx.removeMeasure("comp-1");
    expect(ctx.measureMap.size).toBe(0);
  });

  it("removeMeasure is idempotent for missing keys", () => {
    ctx.removeMeasure("nonexistent");
    expect(ctx.measureMap.size).toBe(0);
  });

  it("purgeStaleMeasurements removes inactive entries", () => {
    ctx.measureMap.set("a", { x: 0, y: 0, width: 1, height: 1 });
    ctx.measureMap.set("b", { x: 0, y: 0, width: 1, height: 1 });
    ctx.measureMap.set("c", { x: 0, y: 0, width: 1, height: 1 });

    const activeIds = new Set(["a", "c"]);
    ctx.purgeStaleMeasurements(activeIds);

    expect(ctx.measureMap.has("a")).toBe(true);
    expect(ctx.measureMap.has("b")).toBe(false);
    expect(ctx.measureMap.has("c")).toBe(true);
  });

  it("purgeStaleMeasurements with empty active set removes all", () => {
    ctx.measureMap.set("x", { x: 0, y: 0, width: 1, height: 1 });
    ctx.purgeStaleMeasurements(new Set());
    expect(ctx.measureMap.size).toBe(0);
  });

  // ── Runs version ─────────────────────────────────────────────────

  it("starts with runsVersion=1", () => {
    expect(ctx.runsVersion).toBe(1);
  });

  it("runsVersion can be incremented", () => {
    ctx.runsVersion++;
    expect(ctx.runsVersion).toBe(2);
  });

  // ── Buffer ───────────────────────────────────────────────────────

  it("starts with null buffer", () => {
    expect(ctx.buffer).toBeNull();
  });

  // ── Links ────────────────────────────────────────────────────────

  it("starts with empty links array", () => {
    expect(ctx.links.length).toBe(0);
  });

  it("links can be populated", () => {
    ctx.links.push({ url: "https://example.com", y: 0, x1: 0, x2: 10 });
    expect(ctx.links.length).toBe(1);
    expect(ctx.links[0]!.url).toBe("https://example.com");
  });

  // ── Cleanups ─────────────────────────────────────────────────────

  it("starts with empty cleanups map", () => {
    expect(ctx.cleanups.size).toBe(0);
  });

  it("cleanups can be registered and called", () => {
    let called = false;
    ctx.cleanups.set("test-cleanup", () => { called = true; });
    expect(ctx.cleanups.size).toBe(1);
    ctx.cleanups.get("test-cleanup")!();
    expect(called).toBe(true);
  });

  // ── Resize observers ─────────────────────────────────────────────

  it("starts with empty resize observers", () => {
    expect(ctx.resizeObservers.size).toBe(0);
  });

  // ── Animation scheduler ──────────────────────────────────────────

  it("has an animation scheduler", () => {
    expect(ctx.animationScheduler).toBeDefined();
  });
});
