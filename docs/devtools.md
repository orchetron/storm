# Storm TUI DevTools

Built-in development tools for debugging rendering, accessibility, performance, and component structure directly in the terminal.

## Quick Start

```ts
import { render } from "@orchetron/storm-tui";
import { enableDevTools } from "@orchetron/storm-tui/devtools";

const app = render(<App />);
enableDevTools(app);
```

That's it. All features are now available. Press `1` through `4` to toggle each tool.

`enableDevTools` returns a `DevToolsHandle` with a `destroy()` method to remove all DevTools middleware and input handlers:

```ts
const devtools = enableDevTools(app);

// Later, tear down everything:
devtools.destroy();
```

---

## Features

### Render Diff Heatmap (key: `1`)

Shows which cells changed each frame as a color overlay on top of your UI:

| Color | Meaning |
|-------|---------|
| Hot red/orange | Changed THIS frame |
| Warm yellow | Changed 2-5 frames ago |
| Cool blue | Changed 6-15 frames ago |
| No overlay | Stable (unchanged 15+ frames) |

A legend bar appears at the bottom-right showing the color scale.

This instantly reveals:
- Components that re-render every frame when they shouldn't
- Animation hotspots (expected hot regions)
- Stable regions that your diff renderer can skip
- Thrashing cells (constantly red = bug or unnecessary work)

### WCAG Accessibility Audit (key: `2`)

Scans every rendered cell for contrast violations against WCAG standards.

- Cells failing the minimum contrast ratio get a **red underline**
- A summary bar at the bottom shows: `[A11y Audit] Score: 94% AA | 12 violations | 3 unique color pairs`
- Detects three violation types:
  - `contrast-aa` -- foreground/background ratio below 4.5:1
  - `contrast-aaa` -- ratio below 7:1 (when AAA checking is enabled)
  - `invisible-text` -- ratio below 1.5:1 (nearly invisible)

The audit scans every 10 frames by default to limit performance overhead. Contrast ratios are cached per unique fg/bg pair.

### Time-Travel Debugging (key: `3`)

Records the last 120 frames in a circular buffer. When activated:

1. Live rendering **pauses**
2. The screen shows the historical frame at the current scrub position
3. A status bar displays frame number, age, trigger type, cells changed, and paint duration
4. A progress bar shows your position in the frame history

**Controls while active:**
| Key | Action |
|-----|--------|
| Left arrow | Previous frame |
| Right arrow | Next frame |
| `3` or Escape | Exit time-travel, resume live rendering |

All other input is swallowed while time-travel is active -- your app won't receive keystrokes.

Each snapshot records: frame number, timestamp, full cell buffer (chars, fg, bg, attrs, underline colors), dimensions, trigger type (`commit`, `repaint`, `resize`, `animation`), paint duration, and cells changed count.

### DevTools Overlay (key: `4`)

A multi-panel debug overlay rendered at the bottom of the screen. Four panels:

**Tree** -- Collapsible component tree showing element type, key, and layout dimensions. The selected element gets a highlight border drawn in the main view above.

**Styles** -- Computed props and layout for the selected tree element: position, size, inner dimensions, content dimensions, and all style props (flexDirection, padding, color, etc.).

**Perf** -- FPS sparkline, paint/diff/flush timing breakdown, cells changed count and percentage, frame count, and a budget bar showing what percentage of the 16.67ms (60fps) budget each frame consumes.

**Events** -- Ring buffer of recent input events with type (key/mouse/paste/resize), detail, and relative timestamp.

**Controls while overlay is visible:**
| Key | Action |
|-----|--------|
| `[` | Previous panel tab |
| `]` | Next panel tab |
| `j` | Select next item in tree |
| `k` | Select previous item in tree |
| Space | Toggle collapse/expand on selected tree node |
| `4` | Close overlay |

---

## Configuration

All options have sensible defaults. Pass a second argument to customize:

```ts
enableDevTools(app, {
  heatmapKey: "1",       // Key to toggle heatmap
  auditKey: "2",         // Key to toggle accessibility audit
  timeTravelKey: "3",    // Key to toggle time-travel
  overlayKey: "4",       // Key to toggle DevTools overlay
  panelHeight: 12,       // Overlay panel height in rows
  maxFrames: 120,        // Time-travel frame history size
  minContrast: 4.5,      // WCAG minimum contrast ratio (4.5 = AA)
});
```

---

## Using Individual Tools

Each DevTools feature is a standalone factory function. Use them individually for custom setups or when you only need one tool.

### Time-Travel

```ts
import { createTimeTravel } from "@orchetron/storm-tui/devtools";

const tt = createTimeTravel({ maxFrames: 240 });

// Register as render middleware
app.middleware.use(tt.middleware);

// Control programmatically
tt.enter();                    // Pause on current frame
tt.prevFrame();                // Step backward
tt.nextFrame();                // Step forward
tt.goToFrame(42);              // Jump to specific frame
const state = tt.getState();   // { isActive, currentIndex, frameCount, currentSnapshot }
const snap = tt.getSnapshot(0); // Get frame 0
tt.exit();                     // Resume live rendering
```

### Render Heatmap

```ts
import { createRenderHeatmap } from "@orchetron/storm-tui/devtools";

const heatmap = createRenderHeatmap({
  cooldownFrames: 15,  // Frames before a cell is "cold"
  opacity: 0.6,        // Overlay opacity (0-1)
});

app.middleware.use(heatmap.middleware);

heatmap.toggle();              // Show/hide
heatmap.isVisible();           // Check state
heatmap.getStats();            // { total, hot, warm, cool, stable }
heatmap.reset();               // Clear all tracking data
```

### Accessibility Audit

```ts
import { createAccessibilityAudit } from "@orchetron/storm-tui/devtools";

const audit = createAccessibilityAudit({
  minContrast: 4.5,    // WCAG AA threshold
  checkAAA: false,     // Also flag AAA violations (< 7:1)
  scanInterval: 10,    // Scan every N frames
});

app.middleware.use(audit.middleware);

audit.toggle();                // Show/hide violation overlay
audit.isActive();              // Check state
const report = audit.getReport();
// report.scoreAA          -- percentage of text cells meeting AA
// report.aaViolations     -- count of failing cells
// report.uniqueViolations -- array of { fg, bg, ratio, count }
const violations = audit.getViolations();
// Array of { x, y, type, contrastRatio, fg, bg, char }
```

### DevTools Overlay

```ts
import {
  createDevToolsOverlay,
  createPerformanceMonitor,
  createEventLogger,
} from "@orchetron/storm-tui/devtools";

const perf = createPerformanceMonitor();
const logger = createEventLogger(50);  // Keep last 50 events

const devtools = createDevToolsOverlay({ panelHeight: 14 });
devtools.setRoot(app.root);

app.middleware.use(devtools.middleware);

// Feed data each frame:
devtools.setMetrics(perf.getMetrics());
devtools.setEvents(logger.getEvents());

// Control:
devtools.toggle();
devtools.setPanel("performance");  // "tree" | "styles" | "performance" | "events"
devtools.selectNext();             // Navigate tree down
devtools.selectPrev();             // Navigate tree up
devtools.toggleCollapse();         // Expand/collapse selected node
devtools.selectNextPanel();        // Cycle panel tabs forward
devtools.selectPrevPanel();        // Cycle panel tabs backward
```

---

## Performance Impact

- DevTools middleware adds approximately **1-2ms per frame** when active
- Heatmap tracks per-cell change history using typed arrays -- minimal overhead even when not visible (tracking still runs for instant toggle-on)
- Accessibility audit scans every 10 frames by default and caches contrast ratios per unique color pair (cache limited to 4096 entries)
- Time-travel stores full frame snapshots: approximately **50KB per frame x maxFrames** (120 frames = ~6MB)
- DevTools overlay rebuilds the tree on each visible frame -- cost scales with tree depth

**Production:** Don't call `enableDevTools()`. The middleware is never registered, so there is zero overhead. The devtools code will be tree-shaken if you don't import it.

---

## Exported Types

```ts
// From "@orchetron/storm-tui/devtools"
import type {
  EnableDevToolsOptions,
  DevToolsHandle,
  HeatmapOptions,
  FrameSnapshot,
  TimeTravelState,
  AccessibilityViolation,
  AuditOptions,
  AuditReport,
  DevToolsOverlayOptions,
  DevToolsPanel,
  RenderMetrics,
  LoggedEvent,
  InspectorState,
} from "@orchetron/storm-tui/devtools";
```
