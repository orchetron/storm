# Performance

Storm is designed for sub-millisecond frame times. On a typical scroll frame, 97% of cells have not changed and Storm skips them entirely. This document covers the techniques that make this possible.

## Rendering Pipeline

The pipeline runs on every frame:

```
React Commit -> Layout Engine -> Cell Buffer -> Compositor -> Diff -> Terminal
```

1. **React Commit**: The custom reconciler processes state updates and produces a tree of host elements (`tui-box`, `tui-text`, `tui-scroll`).
2. **Layout Engine**: Pure TypeScript flexbox solver computes `(x, y, width, height)` for every element.
3. **Cell Buffer**: Each element paints its content into a 2D `ScreenBuffer` (characters + fg/bg/attrs per cell).
4. **Diff**: The `DiffRenderer` compares the new buffer against the previous frame and produces the minimal ANSI output.
5. **Terminal**: A single `stdout.write()` call sends the ANSI output atomically (wrapped in synchronized output sequences).

## Cell-Level Diff

The diff engine is the core performance mechanism. It operates at three levels of granularity:

### Row-Level Comparison

Before generating any ANSI output, the diff engine compares each row between the current and previous `ScreenBuffer` using `rowEquals()`:

```
For each row y:
  Compare chars[y*width .. y*width+width]
  Compare fgs[y*width .. y*width+width]
  Compare bgs[y*width .. y*width+width]
  Compare attrs[y*width .. y*width+width]
```

This is a flat integer comparison across typed arrays -- no object allocation, no string building. Rows that are identical produce zero output.

### Cell-Level Diff (Primary Path)

When fewer than 50% of rows changed, the engine drills into each changed row and compares cell-by-cell against the previous buffer:

1. Walk cells left-to-right, comparing `char`, `fg`, `bg`, and `attrs`.
2. Collect consecutive changed cells into "runs."
3. Merge runs separated by fewer than 4 unchanged cells (cheaper than emitting a cursor-position escape).
4. For each run, emit `cursor-position + SGR + characters`.
5. Track SGR state across cells within a run to use `diffSgr()` (which emits only the attributes that actually changed).

This means a cursor blink on a 200-column row emits roughly 10 bytes instead of 200+ bytes.

### Full-Line Replacement (Fallback)

When more than 50% of rows changed (window resize, theme switch, first render), the engine writes complete lines at each changed row position. Each row gets a `cursor-position` escape followed by the full styled line. The engine never uses `\n` for line breaks (which causes scroll artifacts at the bottom of the alternate screen buffer).

## Typed Array Buffer Architecture

The `ScreenBuffer` stores cell data in flat typed arrays instead of per-cell objects:

```typescript
class ScreenBuffer {
  private chars: string[];       // Character at each cell
  private fgs: Int32Array;       // Foreground color (24-bit packed)
  private bgs: Int32Array;       // Background color (24-bit packed)
  private attrArr: Uint8Array;   // Attributes bitmask (bold, dim, italic, etc.)
}
```

Index for cell `(x, y)` is `y * width + x`. This layout provides:

- **No GC pressure**: A 300x100 terminal has 30,000 cells. Object-per-cell would create 30,000 objects per buffer (60,000 for double-buffering). Typed arrays are a single allocation.
- **Cache-friendly**: Sequential memory access during row comparison and string building.
- **Fast copy**: `Int32Array.set()` and `Uint8Array.set()` for buffer-to-buffer copy operations.

## Double Buffering

The diff renderer maintains two `ScreenBuffer` instances (`bufferA` and `bufferB`) and swaps between them each frame. This avoids allocating a new buffer every frame:

```typescript
// Frame N: render to bufferA, prevBuffer points to bufferB
// Frame N+1: render to bufferB, prevBuffer points to bufferA (via copyFrom)
```

The `swapPrevBuffer()` method uses `copyFrom()` (typed array `.set()`) instead of `clone()` after the initial two frames, eliminating per-frame allocation entirely.

## DECSTBM Scroll Region Optimization

For pure scroll operations (only `scrollTop` changed, content unchanged), Storm uses the terminal's native DECSTBM (Set Top and Bottom Margins) escape sequence instead of repainting:

1. Detect that exactly one `ScrollView` scrolled and nothing else changed.
2. Verify the `ScrollView` spans the full terminal width (DECSTBM operates on full rows).
3. Set the scroll region to the `ScrollView`'s screen coordinates: `\x1b[top;bottomr`
4. Issue scroll up (`\x1b[nS`) or scroll down (`\x1b[nT`).
5. Reset the scroll region: `\x1b[r`
6. Paint only the newly revealed rows (1-5 lines) and update the scrollbar column.

This reduces a scroll frame from repainting hundreds of cells to moving terminal content in hardware and painting a handful of new lines. The optimization is guarded by the `layoutInvalidated` flag: when content changes simultaneously with scrolling (e.g., a new message arrives and `stickToBottom` triggers), the engine falls through to the full cell-level diff path to avoid displaying stale terminal content.

## WASM Acceleration

Storm includes an optional 33KB Rust/WASM module for the `renderLine` function. It loads automatically when present and falls back to TypeScript when absent.

### Adaptive Selection

The engine does not always use WASM. It uses a two-pass approach:

1. **Pass 1** (always TypeScript): Count how many rows changed using cheap typed-array comparison.
2. **Pass 2** (adaptive): Choose WASM or TypeScript based on the change ratio.

```
If changed rows <= 30% of total rows:
  Use WASM for changed rows (scroll-like frames)
Else:
  Use TypeScript for all rows (full repaint)
```

**Why**: WASM wins on scroll (few rows = low boundary-crossing overhead, 75x less GC pressure from avoiding string temporaries). TypeScript wins on full repaint (many rows = boundary-crossing overhead exceeds `renderLine` savings).

### WASM Module

The WASM module is located in `wasm/` and built from Rust using `wasm-pack`. It provides a `WasmBuffer` class and a `render_line` function that operates on the WASM-side buffer. The TypeScript side copies cell data into the WASM buffer only for rows that need rendering.

Check if WASM is active:

```typescript
import { isWasmAccelerated } from "@orchetron/storm-tui";
console.log(isWasmAccelerated()); // true if WASM loaded
```

## Frame Rate Control

The render loop coalesces multiple events (scroll, key, state change) into at most `maxFps` frames per second (default 60):

```
Event arrives:
  If enough time since last frame (>= 1000/maxFps ms):
    Render immediately via queueMicrotask
  Else:
    Schedule render at next frame boundary via setTimeout
```

This prevents wasted frames when events arrive faster than the display can refresh. A render loop detector caps at 200 frames per second and logs a warning if exceeded.

### Dual-Speed Rendering

Storm uses two render paths:

- **Full paint** (`doFullPaint`): Triggered by React commits (structural changes). Rebuilds layout from scratch, then paints and diffs.
- **Fast repaint** (`doFastRepaint`): Triggered by `requestRender()` (scroll, cursor, animation). Skips layout, repaints from cached positions, then diffs.

Components that animate (Spinner, ScrollView, GlowText) use imperative mutation + `requestRender()` instead of `setState()`. This avoids React reconciliation overhead and keeps animation frames under 1ms.

## The layoutInvalidated Guard

The `RenderContext` tracks a `layoutInvalidated` flag:

- Set to `true` when React commits new content (structural change).
- Cleared after each frame flush.

This flag controls two critical behaviors:

1. **DECSTBM skip**: When `layoutInvalidated` is true, scroll region optimization is skipped. DECSTBM moves existing terminal content, which would be wrong when content has changed.
2. **Layout rebuild**: The full paint path checks this flag and rebuilds layout measurements when set. The fast repaint path reuses cached positions.

## Synchronized Output

Every frame is wrapped in synchronized output sequences:

```
\x1b[?2026h  (begin synchronized update)
... all cell changes ...
\x1b[?2026l  (end synchronized update)
```

This tells the terminal to buffer all changes and display them atomically, preventing partial-frame flicker. Terminals that do not support this sequence ignore it harmlessly.

## SGR Diffing

The `diffSgr()` function computes the minimal SGR (Select Graphic Rendition) escape to transition from one style state to another:

- If only the foreground changed, emit just the foreground SGR.
- If only bold was added, emit just the bold attribute.
- If attributes were removed (bold -> not bold), a full reset + re-apply is needed (SGR has no "un-bold" -- only reset all).

This reduces per-cell overhead from ~20 bytes (full SGR) to ~5-10 bytes (incremental SGR) for most transitions.

## Safety Guards

The layout engine and buffer have hard limits to prevent runaway rendering:

| Guard | Limit | Purpose |
|---|---|---|
| `MAX_LAYOUT_DEPTH` | 100 | Prevent stack overflow from deep nesting |
| `MAX_CHILDREN` | 10,000 | Prevent O(n^2) layout in pathological cases |
| `MAX_BUFFER_WIDTH` | 1,000 columns | Prevent memory explosion |
| `MAX_BUFFER_HEIGHT` | 500 rows | Prevent memory explosion |
| Render loop detection | 200 frames/sec | Catch infinite re-render loops |

## Backpressure

The `OutputBuffer` class handles stdout backpressure. If `stdout.write()` returns `false` (buffer full), pending frames are queued and flushed when the `drain` event fires. This prevents the Node.js process from running out of memory when piping to a slow consumer.

## Error Boundary

The `RenderErrorBoundary` wraps paint operations and tracks consecutive failures. After a configurable number of consecutive errors, it triggers auto-exit to prevent the app from spinning in a broken render loop.

## Performance Monitoring

Use the `PerformanceHUD` widget or the `onRender` callback to monitor frame performance:

```tsx
// PerformanceHUD widget (renders as an overlay)
import { PerformanceHUD } from "@orchetron/storm-tui";
<PerformanceHUD />

// onRender callback
render(<App />, {
  onRender: (metrics) => {
    // metrics.lastRenderTimeMs  -- paint+diff+flush time
    // metrics.fps               -- rolling 1-second FPS
    // metrics.cellsChanged      -- cells updated this frame
    // metrics.totalCells        -- width * height
    // metrics.frameCount        -- total frames since start
  },
});
```

## Plugin Hooks

Plugins can hook into the render lifecycle for custom performance monitoring:

```typescript
app.pluginManager.register({
  name: "perf-logger",
  beforeRender: () => { /* start timer */ },
  afterRender: ({ renderTimeMs, cellsChanged }) => {
    if (renderTimeMs > 16) {
      console.warn(`Slow frame: ${renderTimeMs.toFixed(1)}ms, ${cellsChanged} cells`);
    }
  },
});
```

## Benchmarks

Run the built-in benchmark suite:

```bash
npx tsx examples/benchmarks.ts           # Standard suite
npx tsx examples/benchmarks-extreme.ts   # Extreme stress tests
```

## Summary

| Technique | What it avoids | Typical savings |
|---|---|---|
| Cell-level diff | Rewriting unchanged cells | 90-97% of output bytes |
| Typed array buffer | 30K+ objects per frame | ~90% GC reduction |
| Double buffering | Per-frame allocation | 0 allocations after frame 2 |
| DECSTBM scroll | Repainting entire viewport | 95%+ for pure scroll |
| WASM renderLine | String allocation in hot path | 3.4x faster for scroll frames |
| Adaptive WASM/TS | Wrong-tool overhead | Best of both for each frame type |
| Synchronized output | Partial-frame flicker | Atomic display updates |
| SGR diffing | Redundant style escapes | 50-75% fewer SGR bytes |
| Frame rate limiting | Wasted frames | Max 60fps, coalesced events |
| Imperative animation | React reconciliation | Sub-1ms animation frames |
