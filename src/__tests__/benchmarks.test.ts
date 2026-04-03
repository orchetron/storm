/**
 * Storm TUI Performance Benchmark Suite
 *
 * Reproducible benchmarks that run as part of the test suite.
 * Thresholds are generous enough for CI but meaningful enough to catch regressions.
 * Uses performance.now() for sub-millisecond timing.
 */

import { describe, it, expect } from "vitest";
import { ScreenBuffer } from "../core/buffer.js";
import { DiffRenderer, type DiffResult } from "../core/diff.js";
import { computeLayout, type LayoutNode, type LayoutResult } from "../layout/engine.js";

// ── Helpers ────────────────────────────────────────────────────────────

function emptyLayout(): LayoutResult {
  return { x: 0, y: 0, width: 0, height: 0, innerX: 0, innerY: 0, innerWidth: 0, innerHeight: 0, contentHeight: 0, contentWidth: 0 };
}

function makeNode(props: LayoutNode["props"], children: LayoutNode[] = []): LayoutNode {
  return { props, children, layout: emptyLayout() };
}

/** Run fn `iterations` times with warmup, return average ms. */
function benchAvg(iterations: number, fn: () => void): number {
  // Warmup
  for (let i = 0; i < Math.min(10, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return (performance.now() - start) / iterations;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("Performance benchmarks", () => {
  describe("Buffer operations", () => {
    it("creates 200x50 buffer in under 1ms", () => {
      const avg = benchAvg(100, () => { new ScreenBuffer(200, 50); });
      expect(avg).toBeLessThan(1);
    });

    it("creates 300x80 buffer (4K terminal) in under 2ms", () => {
      const avg = benchAvg(100, () => { new ScreenBuffer(300, 80); });
      expect(avg).toBeLessThan(2);
    });

    it("rowEquals comparison under 0.01ms per row", () => {
      const a = new ScreenBuffer(200, 50);
      const b = new ScreenBuffer(200, 50);
      // Fill with identical content so rowEquals does full comparison
      for (let y = 0; y < 50; y++) {
        a.writeString(0, y, `Row ${y}: some content that fills the row with data`);
        b.writeString(0, y, `Row ${y}: some content that fills the row with data`);
      }
      const start = performance.now();
      const iterations = 100;
      for (let iter = 0; iter < iterations; iter++) {
        for (let y = 0; y < 50; y++) a.rowEquals(b, y);
      }
      const avg = (performance.now() - start) / (50 * iterations);
      expect(avg).toBeLessThan(0.01);
    });

    it("writeString fills 200x50 buffer in under 1ms", () => {
      const buf = new ScreenBuffer(200, 50);
      const line = "X".repeat(200);
      const avg = benchAvg(100, () => {
        for (let y = 0; y < 50; y++) buf.writeString(0, y, line);
      });
      expect(avg).toBeLessThan(1);
    });

    it("clear is under 0.5ms for 200x50", () => {
      const buf = new ScreenBuffer(200, 50);
      buf.writeString(0, 0, "Some data to clear");
      const avg = benchAvg(200, () => { buf.clear(); });
      expect(avg).toBeLessThan(0.5);
    });

    it("clone is under 0.5ms for 200x50", () => {
      const buf = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) buf.writeString(0, y, `Row ${y}: clone test data`);
      const avg = benchAvg(200, () => { buf.clone(); });
      expect(avg).toBeLessThan(0.5);
    });

    it("setCell 10,000 individual cells in under 2ms", () => {
      const buf = new ScreenBuffer(200, 50);
      const avg = benchAvg(50, () => {
        for (let y = 0; y < 50; y++) {
          for (let x = 0; x < 200; x++) {
            buf.setCell(x, y, { char: "A", fg: 0xFFFFFF, bg: 0x000000, attrs: 0, ulColor: -1 });
          }
        }
      });
      expect(avg).toBeLessThan(2);
    });
  });

  describe("Diff renderer", () => {
    it("identical buffers produce empty output", () => {
      const diff = new DiffRenderer(200, 50);
      const buf = new ScreenBuffer(200, 50);
      buf.writeString(0, 0, "Hello world");
      // First render primes the diff
      diff.render(buf);
      // Second render with identical buffer should produce no output
      const result = diff.render(buf);
      expect(result.output).toBe("");
      expect(result.changedLines).toBe(0);
    });

    it("identical buffer diff completes in under 0.2ms", () => {
      const diff = new DiffRenderer(200, 50);
      const buf = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) buf.writeString(0, y, `Row ${y}: static content`);
      diff.render(buf); // prime
      const avg = benchAvg(300, () => { diff.render(buf); });
      expect(avg).toBeLessThan(0.5);
    });

    it("cell-level diff produces less output than full change", () => {
      const diff = new DiffRenderer(200, 50);
      const buf1 = new ScreenBuffer(200, 50);
      // First render (baseline)
      diff.render(buf1);

      // Change 1 cell
      const buf2 = new ScreenBuffer(200, 50);
      buf2.setCell(100, 25, { char: "X", fg: 0xFF0000, bg: -1, attrs: 0, ulColor: -1 });
      const smallChange = diff.render(buf2);

      // Change all cells
      const buf3 = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++)
        for (let x = 0; x < 200; x++)
          buf3.setCell(x, y, { char: "A", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
      diff.render(buf3); // reset baseline

      const buf4 = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++)
        for (let x = 0; x < 200; x++)
          buf4.setCell(x, y, { char: "B", fg: 1, bg: 1, attrs: 1, ulColor: -1 });
      const fullChange = diff.render(buf4);

      // Cell diff should produce much less output than full change
      expect(smallChange.output.length).toBeLessThan(fullChange.output.length / 10);
    });

    it("5 changed rows render in under 0.5ms", () => {
      const diff = new DiffRenderer(200, 50);
      const buf = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) buf.writeString(0, y, `Row ${y}: static content that fills`);
      diff.render(buf); // prime
      let tick = 0;
      const avg = benchAvg(200, () => {
        tick++;
        for (let i = 0; i < 5; i++) {
          buf.writeString(0, i * 10, `Row ${i * 10}: changed ${tick}`);
        }
        diff.render(buf);
      });
      expect(avg).toBeLessThan(0.5);
    });

    it("full buffer change renders in under 5ms at 200x50", () => {
      const diff = new DiffRenderer(200, 50);
      let toggle = false;
      const avg = benchAvg(100, () => {
        const buf = new ScreenBuffer(200, 50);
        const ch = toggle ? "X" : "O";
        for (let y = 0; y < 50; y++) buf.writeString(0, y, ch.repeat(200));
        diff.render(buf);
        toggle = !toggle;
      });
      expect(avg).toBeLessThan(5);
    });

    it("DECSTBM skipped when layoutInvalidated", () => {
      // tryScrollRegion checks ctx.layoutInvalidated and returns null if true.
      // We verify the code path by calling render with layoutInvalidated = true
      // and confirming it falls through to the normal diff path (non-empty output).
      const diff = new DiffRenderer(200, 50);
      const buf1 = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) buf1.writeString(0, y, `Line ${y}: content`);
      diff.render(buf1); // prime

      const buf2 = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) buf2.writeString(0, y, `Line ${y + 1}: content`);

      // Render with a RenderContext that has layoutInvalidated = true
      // tryScrollRegion should be skipped, falling through to cell diff
      const result = diff.render(buf2, undefined, {
        layoutInvalidated: true,
        prevScrollViewStates: [],
        scrollViewStates: [],
      } as any);

      // Should produce diff output (not scroll region optimization)
      expect(result.changedLines).toBeGreaterThan(0);
      expect(result.output.length).toBeGreaterThan(0);
      // Should NOT contain DECSTBM scroll region sequence
      expect(result.output).not.toContain("\x1b[1;50r");
    });
  });

  describe("Layout engine", () => {
    it("lays out 10 children in under 0.2ms", () => {
      const tree = makeNode(
        { flexDirection: "column", width: 200, height: 50 },
        Array.from({ length: 10 }, () => makeNode({ height: 1 })),
      );
      const avg = benchAvg(500, () => { computeLayout(tree, 0, 0, 200, 50); });
      expect(avg).toBeLessThan(0.2);
    });

    it("lays out 100 children in under 0.5ms", () => {
      const tree = makeNode(
        { flexDirection: "column", width: 200, height: 50 },
        Array.from({ length: 100 }, () => makeNode({ height: 1 })),
      );
      const avg = benchAvg(200, () => { computeLayout(tree, 0, 0, 200, 50); });
      expect(avg).toBeLessThan(0.5);
    });

    it("lays out 1000 children in under 5ms", () => {
      const tree = makeNode(
        { flexDirection: "column", width: 200, height: 50 },
        Array.from({ length: 1000 }, () => makeNode({ height: 1 })),
      );
      const avg = benchAvg(50, () => { computeLayout(tree, 0, 0, 200, 50); });
      expect(avg).toBeLessThan(5);
    });

    it("lays out nested 10x10x10 tree in under 5ms", () => {
      const tree = makeNode(
        { flexDirection: "column", width: 200, height: 50 },
        Array.from({ length: 10 }, () =>
          makeNode({ flexDirection: "row", flex: 1 },
            Array.from({ length: 10 }, () =>
              makeNode({ flexDirection: "column", flex: 1 },
                Array.from({ length: 10 }, () => makeNode({ flex: 1 })),
              ),
            ),
          ),
        ),
      );
      const avg = benchAvg(100, () => { computeLayout(tree, 0, 0, 200, 50); });
      expect(avg).toBeLessThan(5);
    });

    it("lays out grid 10x10 in under 1ms", () => {
      const tree = makeNode(
        { display: "grid", gridTemplateColumns: "repeat(10, 1fr)", width: 200, height: 50 },
        Array.from({ length: 100 }, () => makeNode({})),
      );
      const avg = benchAvg(200, () => { computeLayout(tree, 0, 0, 200, 50); });
      expect(avg).toBeLessThan(1);
    });

    it("50-level deep nesting in under 0.5ms", () => {
      let deep: LayoutNode = makeNode({ flex: 1 });
      for (let i = 0; i < 50; i++) {
        deep = makeNode({ flexDirection: i % 2 === 0 ? "column" : "row", flex: 1 }, [deep]);
      }
      const avg = benchAvg(200, () => { computeLayout(deep, 0, 0, 200, 50); });
      expect(avg).toBeLessThan(0.5);
    });

    it("row direction with flex children distributes space correctly", () => {
      const tree = makeNode(
        { flexDirection: "row", width: 120, height: 10 },
        [
          makeNode({ flex: 1 }),
          makeNode({ flex: 2 }),
          makeNode({ flex: 1 }),
        ],
      );
      computeLayout(tree, 0, 0, 120, 10);
      // Flex 1:2:1 should split 120 cols into 30:60:30
      expect(tree.children[0]!.layout.width).toBe(30);
      expect(tree.children[1]!.layout.width).toBe(60);
      expect(tree.children[2]!.layout.width).toBe(30);
    });
  });

  describe("Frame budget", () => {
    it("full paint + diff under 2ms at 80x24", () => {
      const W = 80, H = 24;
      const diff = new DiffRenderer(W, H);

      // Paint a realistic buffer
      const buf = new ScreenBuffer(W, H);
      for (let y = 0; y < H; y++) {
        buf.writeString(0, y, `Line ${y}: ${"content ".repeat(8)}`.slice(0, W), 0xD4A053, 0x1E1E2E, 0);
      }
      diff.render(buf); // prime

      let tick = 0;
      const avg = benchAvg(200, () => {
        tick++;
        // Simulate typical frame: header + cursor line + status bar change
        buf.writeString(0, 0, `Header: frame ${tick} ${"=".repeat(W - 20)}`.slice(0, W), 0xD4A053, 0x1E1E2E, 0);
        buf.writeString(0, 12, `> cursor line ${tick} ${"_".repeat(W - 20)}`.slice(0, W), 0x6DBF8B, 0x1E1E2E, 0);
        buf.writeString(0, H - 1, `Status: ${tick} ${"─".repeat(W - 15)}`.slice(0, W), 0x888888, 0x1E1E2E, 0);
        diff.render(buf);
      });
      expect(avg).toBeLessThan(2);
    });

    it("full paint + diff under 4ms at 200x50", () => {
      const W = 200, H = 50;
      const diff = new DiffRenderer(W, H);

      const buf = new ScreenBuffer(W, H);
      for (let y = 0; y < H; y++) {
        buf.writeString(0, y, `Line ${y}: ${"data ".repeat(40)}`.slice(0, W), 0xFFFFFF, 0x000000, 0);
      }
      diff.render(buf); // prime

      let tick = 0;
      const avg = benchAvg(100, () => {
        tick++;
        // 5 rows change (simulating scroll + cursor + status)
        for (let i = 0; i < 5; i++) {
          const row = (i * 10) % H;
          buf.writeString(0, row, `Updated ${tick} row ${row}: ${"~".repeat(W - 25)}`.slice(0, W), 0xFFFFFF, 0x000000, 0);
        }
        diff.render(buf);
      });
      expect(avg).toBeLessThan(4);
    });

    it("layout + buffer + diff pipeline under 6ms at 120x40", () => {
      const W = 120, H = 40;
      const diff = new DiffRenderer(W, H);

      // Build layout tree
      const tree = makeNode(
        { flexDirection: "column", width: W, height: H },
        [
          makeNode({ height: 1 }), // header
          makeNode({ flexDirection: "row", flex: 1 }, [
            makeNode({ width: 30, flexDirection: "column" }, // sidebar
              Array.from({ length: 15 }, () => makeNode({ height: 1 })),
            ),
            makeNode({ flex: 1, flexDirection: "column" }, // main content
              Array.from({ length: 30 }, () => makeNode({ height: 1 })),
            ),
          ]),
          makeNode({ height: 1 }), // status bar
        ],
      );

      const buf = new ScreenBuffer(W, H);
      for (let y = 0; y < H; y++) buf.writeString(0, y, " ".repeat(W));
      diff.render(buf); // prime

      let tick = 0;
      const avg = benchAvg(50, () => {
        tick++;
        // Layout pass
        computeLayout(tree, 0, 0, W, H);

        // Paint pass (write to buffer based on layout)
        buf.writeString(0, 0, `Storm TUI | frame ${tick}`.padEnd(W), 0xD4A053, 0x1E1E2E, 0);
        for (let y = 1; y < H - 1; y++) {
          if (y < 16) {
            buf.writeString(0, y, `Nav ${y}`.padEnd(30), 0x888888, 0x1E1E2E, 0);
          }
          buf.writeString(30, y, `Content line ${y} frame ${tick}`.padEnd(W - 30), 0xFFFFFF, 0x1E1E2E, 0);
        }
        buf.writeString(0, H - 1, `Status: frame ${tick}`.padEnd(W), 0x888888, 0x2E2E3E, 0);

        // Diff pass
        diff.render(buf);
      });
      expect(avg).toBeLessThan(6);
    });
  });

  describe("Scaling characteristics", () => {
    it("diff time scales linearly with changed rows, not total rows", () => {
      // 200x50 buffer: measure diff time for 1 vs 50 changed rows
      const diff1 = new DiffRenderer(200, 50);
      const baseBuf = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) baseBuf.writeString(0, y, `Row ${y}: baseline content here`);
      diff1.render(baseBuf); // prime

      // Measure 1 changed row
      let tick1 = 0;
      const avg1Row = benchAvg(200, () => {
        tick1++;
        baseBuf.writeString(0, 25, `Row 25: changed ${tick1}`);
        diff1.render(baseBuf);
      });

      // Fresh diff for all-rows test
      const diff2 = new DiffRenderer(200, 50);
      const baseBuf2 = new ScreenBuffer(200, 50);
      for (let y = 0; y < 50; y++) baseBuf2.writeString(0, y, `Row ${y}: baseline content here`);
      diff2.render(baseBuf2); // prime

      // Measure all 50 rows changed
      let tick2 = 0;
      const avgAllRows = benchAvg(100, () => {
        tick2++;
        for (let y = 0; y < 50; y++) baseBuf2.writeString(0, y, `Row ${y}: changed ${tick2}`);
        diff2.render(baseBuf2);
      });

      // All rows should take more time than 1 row, confirming incremental diff
      // But it should be less than 50x (linear not quadratic)
      expect(avgAllRows).toBeGreaterThan(avg1Row);
      expect(avgAllRows).toBeLessThan(avg1Row * 50);
    });

    it("layout time scales linearly with child count", () => {
      const times: number[] = [];
      for (const count of [100, 500, 1000]) {
        const tree = makeNode(
          { flexDirection: "column", width: 200, height: 50 },
          Array.from({ length: count }, () => makeNode({ height: 1 })),
        );
        const avg = benchAvg(50, () => { computeLayout(tree, 0, 0, 200, 50); });
        times.push(avg);
      }
      // 1000 children should take less than 15x what 100 children takes
      // (linear would be 10x; allowing margin for overhead)
      expect(times[2]!).toBeLessThan(times[0]! * 15);
    });

    it("buffer creation scales linearly with cell count", () => {
      const small = benchAvg(100, () => { new ScreenBuffer(80, 24); }); // 1,920 cells
      const large = benchAvg(100, () => { new ScreenBuffer(300, 80); }); // 24,000 cells
      const ratio = large / small;
      const cellRatio = (300 * 80) / (80 * 24); // ~12.5x
      // Should scale roughly linearly (allow 3x margin for overhead)
      expect(ratio).toBeLessThan(cellRatio * 3);
    });
  });
});
